import { invoke } from "@tauri-apps/api/core";
import { createProviderClient } from "@/ai/providers/factory";
import type { AIProvider, ChatMessage } from "@/ai/providers/types";
import {
  PROMPT_VERSION,
  buildGenerationMessages,
  buildRepairMessages,
  buildRewriteMessages,
  type PromptContext,
} from "@/ai/prompts/build";
import { visionPrompt } from "@/ai/prompts/layers";
import {
  extractJsonObject,
  imageAnalysisSchema,
  type GenerationPayload,
  type ImageAnalysis,
} from "@/ai/schemas/generation";
import {
  normalizePayload,
  validateGenerationOutput,
} from "@/ai/validators/generation";
import * as assetsRepo from "@/db/repositories/assets";
import * as generationsRepo from "@/db/repositories/generations";
import * as personasRepo from "@/db/repositories/personas";
import * as postsRepo from "@/db/repositories/saved-posts";
import * as sessionsRepo from "@/db/repositories/sessions";
import type { Asset, PlatformId } from "@/types/domain";
import { AppError, appError, toAppError } from "@/types/errors";

/** Cuántos intentos de reparación antes de rendirse. Nunca es infinito. */
const MAX_REPAIR_ATTEMPTS = 2;

export interface GenerateInput {
  sessionId: string;
  userContext: string;
  platforms: PlatformId[];
  assetIds: string[];
  writingProviderId: string;
  writingModel: string;
  visionProviderId: string | null;
  visionModel: string | null;
  recentPostsWindow: number;
  styleReferences?: string[];
  signal?: AbortSignal;
  onProgress?: (stage: GenerationStage) => void;
}

export type GenerationStage =
  | "preparing"
  | "analyzing_images"
  | "generating"
  | "validating"
  | "repairing"
  | "saving";

export interface GenerateResult {
  requestId: string;
  payload: GenerationPayload;
  warnings: string[];
}

/**
 * Orquesta el pipeline completo:
 * visión → armado de prompt → generación → validación → reparación → guardado.
 */
export async function generatePosts(input: GenerateInput): Promise<GenerateResult> {
  input.onProgress?.("preparing");

  const session = await sessionsRepo.getSession(input.sessionId);
  if (!session) throw appError("database_error", "La sesion no existe.");

  const persona = await personasRepo.getPersona(session.personaId);
  if (!persona) throw appError("database_error", "La persona no existe.");

  if (!input.platforms.length) {
    throw new AppError(
      "validation_failed",
      "No hay ninguna plataforma seleccionada.",
      "Elegi al menos X o Telegram antes de generar.",
    );
  }

  const [examples, memories, platformSettings, recentPosts, assets] = await Promise.all([
    personasRepo.listExamples(persona.id),
    personasRepo.listMemories(persona.id),
    personasRepo.listPlatformSettings(persona.id),
    postsRepo.listRecentForAntiRepetition(persona.id, input.recentPostsWindow),
    loadAssets(input.assetIds),
  ]);

  const request = await generationsRepo.createRequest({
    sessionId: input.sessionId,
    userContext: input.userContext,
    platforms: input.platforms,
    providerId: input.writingProviderId,
    visionModel: input.visionModel,
    writingModel: input.writingModel,
    promptVersion: PROMPT_VERSION,
    assetIds: input.assetIds,
  });

  try {
    // --- Paso de visión ---
    let imageAnalyses: ImageAnalysis[] = [];
    if (assets.length > 0) {
      input.onProgress?.("analyzing_images");
      await generationsRepo.setRequestStatus(request.id, "analyzing");
      imageAnalyses = await analyzeAssets(assets, input);
    }

    // --- Generación ---
    input.onProgress?.("generating");
    await generationsRepo.setRequestStatus(request.id, "generating");

    const ctx: PromptContext = {
      persona,
      examples,
      memories,
      platformSettings,
      session,
      recentPosts,
      userContext: input.userContext,
      platforms: input.platforms,
      imageAnalyses,
      styleReferences: input.styleReferences,
    };

    const messages = buildGenerationMessages(ctx);
    const writer = await createProviderClient(input.writingProviderId);

    const { payload, raw, warnings } = await generateWithRepair(
      writer,
      messages,
      input,
    );

    // --- Guardado ---
    input.onProgress?.("saving");
    const normalized = normalizePayload(payload, input.platforms);

    await generationsRepo.storeGeneration({
      requestId: request.id,
      rawOutput: raw,
      options: normalized.options.map((option, index) => ({
        optionIndex: index + 1,
        concept: option.concept,
        reasoningSummary: option.reasoning_summary,
        variants: input.platforms
          .filter((p) => option.variants[p])
          .map((p) => ({ platform: p, text: option.variants[p].text })),
      })),
    });

    await generationsRepo.setRequestStatus(request.id, "completed");
    await sessionsRepo.touchSession(input.sessionId);

    return { requestId: request.id, payload: normalized, warnings };
  } catch (error) {
    const appErr = toAppError(error);
    await generationsRepo.setRequestStatus(request.id, "failed", appErr.message);
    throw appErr;
  }
}

async function loadAssets(assetIds: string[]): Promise<Asset[]> {
  const assets: Asset[] = [];
  for (const id of assetIds) {
    const asset = await assetsRepo.getAsset(id);
    if (asset) assets.push(asset);
  }
  return assets;
}

/** Analiza cada imagen por separado: un fallo aislado no tumba la generación. */
async function analyzeAssets(
  assets: Asset[],
  input: GenerateInput,
): Promise<ImageAnalysis[]> {
  const providerId = input.visionProviderId ?? input.writingProviderId;
  const model = input.visionModel ?? input.writingModel;

  const vision = await createProviderClient(providerId);
  if (!vision.capabilities.vision) {
    throw appError("vision_unsupported");
  }

  const analyses: ImageAnalysis[] = [];

  for (const asset of assets) {
    let dataUrl: string;
    try {
      dataUrl = await invoke<string>("read_asset_as_data_url", {
        filePath: asset.filePath,
      });
    } catch (cause) {
      if (String(cause).includes("missing_local_asset")) {
        throw appError("missing_local_asset", cause);
      }
      throw appError("invalid_image", cause);
    }

    const raw = await vision.analyzeImages({
      model,
      images: [{ dataUrl }],
      prompt: visionPrompt(),
      signal: input.signal,
    });

    const json = extractJsonObject(raw);
    const parsed = json ? imageAnalysisSchema.safeParse(safeJsonParse(json)) : null;

    if (parsed?.success) {
      analyses.push(parsed.data);
      await assetsRepo.setAssetDescription(asset.id, parsed.data.scene);
    } else {
      // Si el modelo no devolvió JSON válido, guardamos el texto como escena
      // con confianza baja en vez de descartar la imagen entera.
      analyses.push({
        scene: raw.slice(0, 300),
        mood: "",
        clothing: "",
        environment: "",
        objects: [],
        colors: [],
        activities: [],
        confidence: "low",
      });
    }
  }

  return analyses;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function generateWithRepair(
  provider: AIProvider,
  messages: ChatMessage[],
  input: GenerateInput,
): Promise<{ payload: GenerationPayload; raw: string; warnings: string[] }> {
  let currentMessages = messages;
  let lastErrors: string[] = [];
  let lastRaw = "";

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    if (attempt > 0) input.onProgress?.("repairing");

    const raw = await provider.generateStructured({
      model: input.writingModel,
      messages: currentMessages,
      temperature: attempt === 0 ? 0.85 : 0.4,
      signal: input.signal,
    });
    lastRaw = raw;

    input.onProgress?.("validating");
    const result = validateGenerationOutput(raw, input.platforms);

    if (result.ok) {
      return { payload: result.payload, raw, warnings: result.warnings };
    }

    lastErrors = result.errors;
    currentMessages = buildRepairMessages(messages, raw, result.errors);
  }

  throw new AppError(
    "validation_failed",
    `La IA no devolvio el formato esperado tras ${MAX_REPAIR_ATTEMPTS + 1} intentos.`,
    "Volve a generar o proba con otro modelo. Detalle: " + lastErrors.join("; "),
    lastRaw,
  );
}

export interface RewriteInput {
  variantId: string;
  currentText: string;
  platform: PlatformId;
  instruction: string;
  sessionId: string;
  writingProviderId: string;
  writingModel: string;
  recentPostsWindow: number;
  signal?: AbortSignal;
}

/** Reescribe una sola variante sin tocar el resto de las opciones. */
export async function rewriteVariant(input: RewriteInput): Promise<string> {
  const session = await sessionsRepo.getSession(input.sessionId);
  if (!session) throw appError("database_error", "La sesion no existe.");

  const persona = await personasRepo.getPersona(session.personaId);
  if (!persona) throw appError("database_error", "La persona no existe.");

  const [examples, memories, platformSettings, recentPosts] = await Promise.all([
    personasRepo.listExamples(persona.id),
    personasRepo.listMemories(persona.id),
    personasRepo.listPlatformSettings(persona.id),
    postsRepo.listRecentForAntiRepetition(persona.id, input.recentPostsWindow),
  ]);

  const ctx: PromptContext = {
    persona,
    examples,
    memories,
    platformSettings,
    session,
    recentPosts,
    userContext: "",
    platforms: [input.platform],
    imageAnalyses: [],
  };

  const provider = await createProviderClient(input.writingProviderId);
  const messages = buildRewriteMessages(
    ctx,
    input.currentText,
    input.platform,
    input.instruction,
  );

  const raw = await provider.generateStructured({
    model: input.writingModel,
    messages,
    temperature: 0.8,
    signal: input.signal,
  });

  const json = extractJsonObject(raw);
  const parsed = json ? safeJsonParse(json) : null;
  const text =
    parsed && typeof parsed === "object" && "text" in parsed
      ? String((parsed as { text: unknown }).text)
      : raw.trim();

  if (!text) throw appError("malformed_ai_json", raw);

  return text;
}

import type { ChatMessage } from "@/ai/providers/types";
import type { ImageAnalysis } from "@/ai/schemas/generation";
import {
  imageAnalysisLayer,
  personaCoreLayer,
  platformRulesLayer,
  recentPostsLayer,
  sessionContextLayer,
  styleMemoryLayer,
  systemRulesLayer,
  userRequestLayer,
} from "@/ai/prompts/layers";
import type {
  Persona,
  PersonaExample,
  PersonaMemory,
  PersonaPlatformSettings,
  PlatformId,
  SavedPost,
  Session,
} from "@/types/domain";

/** Version del prompt. Se guarda en el historial para poder depurar regresiones. */
export const PROMPT_VERSION = "post-generation-v1";

export interface PromptContext {
  persona: Persona;
  examples: PersonaExample[];
  memories: PersonaMemory[];
  platformSettings: PersonaPlatformSettings[];
  session: Session;
  recentPosts: SavedPost[];
  userContext: string;
  platforms: PlatformId[];
  imageAnalyses: ImageAnalysis[];
  /** Textos que el usuario marco como referencia ("mas como este"). */
  styleReferences?: string[];
}

function styleReferenceLayer(references: string[] | undefined): string {
  if (!references?.length) return "";
  return [
    "=== REFERENCIA DE ESTILO PEDIDA ===",
    "El usuario quiere mas publicaciones con esta vibra, largo y energia.",
    "Tomalas como referencia de estilo, NO las copies literalmente:",
    ...references.map((r) => `- ${r}`),
  ].join("\n");
}

/**
 * Ensambla el prompt final concatenando las capas que tengan contenido.
 * Las capas vacias (persona sin ejemplos, sesion sin contexto) simplemente
 * no aparecen, en vez de dejar encabezados huerfanos.
 */
export function buildGenerationMessages(ctx: PromptContext): ChatMessage[] {
  const layers = [
    personaCoreLayer(ctx.persona, ctx.examples),
    styleMemoryLayer(ctx.memories),
    platformRulesLayer(ctx.platforms, ctx.platformSettings),
    recentPostsLayer(ctx.recentPosts),
    sessionContextLayer(ctx.session),
    styleReferenceLayer(ctx.styleReferences),
    userRequestLayer(ctx.userContext),
    imageAnalysisLayer(ctx.imageAnalyses),
  ].filter((layer) => layer.trim().length > 0);

  return [
    { role: "system", content: systemRulesLayer(ctx.platforms) },
    { role: "user", content: layers.join("\n\n") },
  ];
}

/**
 * Prompt de reparacion: se le devuelve al modelo su propia salida junto con
 * los errores de validacion concretos, en vez de volver a generar a ciegas.
 */
export function buildRepairMessages(
  original: ChatMessage[],
  invalidOutput: string,
  errors: string[],
): ChatMessage[] {
  return [
    ...original,
    { role: "assistant", content: invalidOutput },
    {
      role: "user",
      content: [
        "Tu respuesta anterior no cumplio el formato requerido:",
        ...errors.map((e) => `- ${e}`),
        "",
        "Devolvela corregida. Responde UNICAMENTE con el objeto JSON valido,",
        "sin markdown ni explicaciones.",
      ].join("\n"),
    },
  ];
}

/** Instruccion extra para las acciones rapidas de reescritura. */
export function buildRewriteMessages(
  ctx: PromptContext,
  currentText: string,
  platform: PlatformId,
  instruction: string,
): ChatMessage[] {
  const base = buildGenerationMessages(ctx);
  return [
    { role: "system", content: base[0].content },
    {
      role: "user",
      content: [
        base[1].content,
        "",
        "=== REESCRITURA PUNTUAL ===",
        `Plataforma: ${platform}`,
        `Texto actual: ${currentText}`,
        `Instruccion: ${instruction}`,
        "",
        'Devolve SOLO este JSON: {"text": "nuevo texto"}',
      ].join("\n"),
    },
  ];
}

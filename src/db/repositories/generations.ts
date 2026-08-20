import { execute, newId, nowIso, parseJson, query, queryOne } from "@/db/client";
import type {
  Generation,
  GenerationOption,
  GenerationRequest,
  GenerationStatus,
  PlatformId,
  PlatformVariant,
} from "@/types/domain";

interface RequestRow {
  id: string;
  session_id: string;
  user_context: string;
  platforms: string;
  provider_id: string;
  vision_model: string | null;
  writing_model: string;
  prompt_version: string;
  status: string;
  error: string | null;
  created_at: string;
}

function mapRequest(row: RequestRow): GenerationRequest {
  return {
    id: row.id,
    sessionId: row.session_id,
    userContext: row.user_context,
    platforms: parseJson<PlatformId[]>(row.platforms, []),
    providerId: row.provider_id,
    visionModel: row.vision_model,
    writingModel: row.writing_model,
    promptVersion: row.prompt_version,
    status: row.status as GenerationStatus,
    error: row.error,
    createdAt: row.created_at,
  };
}

export interface CreateRequestInput {
  sessionId: string;
  userContext: string;
  platforms: PlatformId[];
  providerId: string;
  visionModel: string | null;
  writingModel: string;
  promptVersion: string;
  assetIds: string[];
}

export async function createRequest(
  input: CreateRequestInput,
): Promise<GenerationRequest> {
  const id = newId();
  const ts = nowIso();
  await execute(
    `INSERT INTO generation_requests
       (id, session_id, user_context, platforms, provider_id, vision_model,
        writing_model, prompt_version, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)`,
    [
      id,
      input.sessionId,
      input.userContext,
      JSON.stringify(input.platforms),
      input.providerId,
      input.visionModel,
      input.writingModel,
      input.promptVersion,
      ts,
    ],
  );
  for (const assetId of input.assetIds) {
    await execute(
      "INSERT OR IGNORE INTO generation_request_assets (request_id, asset_id) VALUES ($1,$2)",
      [id, assetId],
    );
  }
  return {
    id,
    sessionId: input.sessionId,
    userContext: input.userContext,
    platforms: input.platforms,
    providerId: input.providerId,
    visionModel: input.visionModel,
    writingModel: input.writingModel,
    promptVersion: input.promptVersion,
    status: "pending",
    error: null,
    createdAt: ts,
  };
}

export async function setRequestStatus(
  id: string,
  status: GenerationStatus,
  error: string | null = null,
): Promise<void> {
  await execute("UPDATE generation_requests SET status = $1, error = $2 WHERE id = $3", [
    status,
    error,
    id,
  ]);
}

export async function listRequests(sessionId: string): Promise<GenerationRequest[]> {
  const rows = await query<RequestRow>(
    "SELECT * FROM generation_requests WHERE session_id = $1 ORDER BY created_at DESC",
    [sessionId],
  );
  return rows.map(mapRequest);
}

/**
 * Marca como fallidas las generaciones que quedaron colgadas.
 * Se llama al arrancar: si la app se cerró a mitad de una generación,
 * el registro quedaría en "generating" para siempre.
 */
export async function failStaleRequests(): Promise<number> {
  const stale = await query<{ id: string }>(
    `SELECT id FROM generation_requests
     WHERE status IN ('pending','analyzing','generating','validating')`,
  );
  for (const { id } of stale) {
    await setRequestStatus(
      id,
      "failed",
      "La aplicación se cerró durante la generación.",
    );
  }
  return stale.length;
}

// ---------- Generaciones ----------

export interface StoreGenerationInput {
  requestId: string;
  rawOutput: string;
  options: {
    optionIndex: number;
    concept: string;
    reasoningSummary: string;
    variants: { platform: PlatformId; text: string }[];
  }[];
}

export async function storeGeneration(
  input: StoreGenerationInput,
): Promise<Generation> {
  const id = newId();
  const ts = nowIso();
  await execute(
    "INSERT INTO generations (id, request_id, raw_output, created_at) VALUES ($1,$2,$3,$4)",
    [id, input.requestId, input.rawOutput, ts],
  );

  for (const option of input.options) {
    const optionId = newId();
    await execute(
      `INSERT INTO generation_options (id, generation_id, option_index, concept, reasoning_summary)
       VALUES ($1,$2,$3,$4,$5)`,
      [optionId, id, option.optionIndex, option.concept, option.reasoningSummary],
    );
    for (const variant of option.variants) {
      await execute(
        `INSERT INTO platform_variants (id, option_id, platform, generated_text, edited_text)
         VALUES ($1,$2,$3,$4,NULL)`,
        [newId(), optionId, variant.platform, variant.text],
      );
    }
  }

  return { id, requestId: input.requestId, rawOutput: input.rawOutput, createdAt: ts };
}

interface OptionRow {
  id: string;
  generation_id: string;
  option_index: number;
  concept: string;
  reasoning_summary: string;
}

interface VariantRow {
  id: string;
  option_id: string;
  platform: string;
  generated_text: string;
  edited_text: string | null;
}

export async function getGenerationByRequest(
  requestId: string,
): Promise<{ generation: Generation; options: GenerationOption[] } | null> {
  const row = await queryOne<{
    id: string;
    request_id: string;
    raw_output: string;
    created_at: string;
  }>("SELECT * FROM generations WHERE request_id = $1", [requestId]);
  if (!row) return null;

  const optionRows = await query<OptionRow>(
    "SELECT * FROM generation_options WHERE generation_id = $1 ORDER BY option_index",
    [row.id],
  );
  const variantRows = await query<VariantRow>(
    `SELECT pv.* FROM platform_variants pv
     JOIN generation_options go ON go.id = pv.option_id
     WHERE go.generation_id = $1`,
    [row.id],
  );

  const options: GenerationOption[] = optionRows.map((o) => ({
    id: o.id,
    generationId: o.generation_id,
    optionIndex: o.option_index,
    concept: o.concept,
    reasoningSummary: o.reasoning_summary,
    variants: variantRows
      .filter((v) => v.option_id === o.id)
      .map<PlatformVariant>((v) => ({
        id: v.id,
        optionId: v.option_id,
        platform: v.platform as PlatformId,
        generatedText: v.generated_text,
        editedText: v.edited_text,
      })),
  }));

  return {
    generation: {
      id: row.id,
      requestId: row.request_id,
      rawOutput: row.raw_output,
      createdAt: row.created_at,
    },
    options,
  };
}

/** Guarda la edición del usuario sin tocar el texto original de la IA. */
export async function setVariantEditedText(
  variantId: string,
  editedText: string | null,
): Promise<void> {
  await execute("UPDATE platform_variants SET edited_text = $1 WHERE id = $2", [
    editedText,
    variantId,
  ]);
}

/** Reemplaza el texto de una variante tras regenerar solo esa opción. */
export async function replaceVariantText(
  variantId: string,
  generatedText: string,
): Promise<void> {
  await execute(
    "UPDATE platform_variants SET generated_text = $1, edited_text = NULL WHERE id = $2",
    [generatedText, variantId],
  );
}

export async function updateOptionMeta(
  optionId: string,
  concept: string,
  reasoningSummary: string,
): Promise<void> {
  await execute(
    "UPDATE generation_options SET concept = $1, reasoning_summary = $2 WHERE id = $3",
    [concept, reasoningSummary, optionId],
  );
}

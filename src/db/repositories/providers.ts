import { execute, fromBool, newId, nowIso, parseJson, query, queryOne, toBool } from "@/db/client";
import type {
  AIModelConfig,
  AIProviderConfig,
  ModelRole,
  ProviderCapabilities,
  ProviderKind,
} from "@/types/domain";
import { invoke } from "@tauri-apps/api/core";

export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  textGeneration: true,
  vision: false,
  structuredOutput: true,
  streaming: false,
};

interface ProviderRow {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  keyring_ref: string | null;
  capabilities: string;
  timeout_ms: number;
  enabled: number;
  created_at: string;
}

function mapProvider(row: ProviderRow): AIProviderConfig {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ProviderKind,
    baseUrl: row.base_url,
    keyringRef: row.keyring_ref,
    capabilities: parseJson<ProviderCapabilities>(row.capabilities, DEFAULT_CAPABILITIES),
    timeoutMs: row.timeout_ms,
    enabled: toBool(row.enabled),
    createdAt: row.created_at,
  };
}

export async function listProviders(): Promise<AIProviderConfig[]> {
  const rows = await query<ProviderRow>("SELECT * FROM ai_providers ORDER BY created_at");
  return rows.map(mapProvider);
}

export async function getProvider(id: string): Promise<AIProviderConfig | null> {
  const row = await queryOne<ProviderRow>("SELECT * FROM ai_providers WHERE id = $1", [id]);
  return row ? mapProvider(row) : null;
}

export interface ProviderInput {
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  capabilities: ProviderCapabilities;
  timeoutMs: number;
  enabled: boolean;
  /** Si viene, se guarda en el llavero del SO (nunca en SQLite). */
  apiKey?: string;
}

export async function createProvider(input: ProviderInput): Promise<AIProviderConfig> {
  const id = newId();
  const ts = nowIso();
  const keyringRef = input.apiKey ? `provider:${id}` : null;

  if (input.apiKey && keyringRef) {
    await invoke("save_secret", { reference: keyringRef, secret: input.apiKey });
  }

  await execute(
    `INSERT INTO ai_providers
       (id, name, kind, base_url, keyring_ref, capabilities, timeout_ms, enabled, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.name,
      input.kind,
      input.baseUrl,
      keyringRef,
      JSON.stringify(input.capabilities),
      input.timeoutMs,
      fromBool(input.enabled),
      ts,
    ],
  );

  return {
    id,
    name: input.name,
    kind: input.kind,
    baseUrl: input.baseUrl,
    keyringRef,
    capabilities: input.capabilities,
    timeoutMs: input.timeoutMs,
    enabled: input.enabled,
    createdAt: ts,
  };
}

export async function updateProvider(
  id: string,
  input: Partial<ProviderInput>,
): Promise<void> {
  const current = await getProvider(id);
  if (!current) return;

  let keyringRef = current.keyringRef;
  if (input.apiKey !== undefined) {
    if (input.apiKey) {
      keyringRef = current.keyringRef ?? `provider:${id}`;
      await invoke("save_secret", { reference: keyringRef, secret: input.apiKey });
    } else if (current.keyringRef) {
      await invoke("delete_secret", { reference: current.keyringRef });
      keyringRef = null;
    }
  }

  await execute(
    `UPDATE ai_providers SET
       name = $1, kind = $2, base_url = $3, keyring_ref = $4,
       capabilities = $5, timeout_ms = $6, enabled = $7
     WHERE id = $8`,
    [
      input.name ?? current.name,
      input.kind ?? current.kind,
      input.baseUrl ?? current.baseUrl,
      keyringRef,
      JSON.stringify(input.capabilities ?? current.capabilities),
      input.timeoutMs ?? current.timeoutMs,
      fromBool(input.enabled ?? current.enabled),
      id,
    ],
  );
}

export async function deleteProvider(id: string): Promise<void> {
  const current = await getProvider(id);
  if (current?.keyringRef) {
    await invoke("delete_secret", { reference: current.keyringRef });
  }
  await execute("DELETE FROM ai_providers WHERE id = $1", [id]);
}

/** Lee la API key desde el llavero del SO. Nunca se cachea ni se loguea. */
export async function getProviderApiKey(
  provider: AIProviderConfig,
): Promise<string | null> {
  if (!provider.keyringRef) return null;
  return invoke<string | null>("get_secret", { reference: provider.keyringRef });
}

// ---------- Modelos ----------

interface ModelRow {
  id: string;
  provider_id: string;
  model_name: string;
  role: string;
  is_default: number;
}

function mapModel(row: ModelRow): AIModelConfig {
  return {
    id: row.id,
    providerId: row.provider_id,
    modelName: row.model_name,
    role: row.role as ModelRole,
    isDefault: toBool(row.is_default),
  };
}

export async function listModels(providerId?: string): Promise<AIModelConfig[]> {
  const rows = providerId
    ? await query<ModelRow>(
        "SELECT * FROM ai_models WHERE provider_id = $1 ORDER BY model_name",
        [providerId],
      )
    : await query<ModelRow>("SELECT * FROM ai_models ORDER BY model_name");
  return rows.map(mapModel);
}

export async function addModel(
  providerId: string,
  modelName: string,
  role: ModelRole,
  isDefault = false,
): Promise<AIModelConfig> {
  const id = newId();
  await execute(
    `INSERT INTO ai_models (id, provider_id, model_name, role, is_default)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (provider_id, model_name) DO UPDATE SET
       role = excluded.role, is_default = excluded.is_default`,
    [id, providerId, modelName, role, fromBool(isDefault)],
  );
  return { id, providerId, modelName, role, isDefault };
}

export async function deleteModel(id: string): Promise<void> {
  await execute("DELETE FROM ai_models WHERE id = $1", [id]);
}

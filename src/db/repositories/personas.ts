import {
  execute,
  fromBool,
  newId,
  nowIso,
  parseJson,
  query,
  queryOne,
  toBool,
} from "@/db/client";
import type {
  EmojiLevel,
  HashtagLevel,
  Persona,
  PersonaExample,
  PersonaExampleKind,
  PersonaMemory,
  PersonaPlatformSettings,
  PersonaStyle,
  PlatformId,
} from "@/types/domain";
import { ALL_PLATFORMS } from "@/types/domain";

interface PersonaRow {
  id: string;
  name: string;
  display_name: string;
  avatar_asset_id: string | null;
  description: string;
  persona_prompt: string;
  language: string;
  tone: string;
  default_platforms: string;
  emoji_level: string;
  hashtag_level: string;
  style: string;
  created_at: string;
  updated_at: string;
}

function mapPersona(row: PersonaRow): Persona {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    avatarAssetId: row.avatar_asset_id,
    description: row.description,
    personaPrompt: row.persona_prompt,
    language: row.language,
    tone: row.tone,
    defaultPlatforms: parseJson<PlatformId[]>(row.default_platforms, [...ALL_PLATFORMS]),
    emojiLevel: row.emoji_level as EmojiLevel,
    hashtagLevel: row.hashtag_level as HashtagLevel,
    style: parseJson<PersonaStyle>(row.style, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PersonaInput = Omit<Persona, "id" | "createdAt" | "updatedAt">;

export async function listPersonas(): Promise<Persona[]> {
  const rows = await query<PersonaRow>("SELECT * FROM personas ORDER BY name COLLATE NOCASE");
  return rows.map(mapPersona);
}

export async function getPersona(id: string): Promise<Persona | null> {
  const row = await queryOne<PersonaRow>("SELECT * FROM personas WHERE id = $1", [id]);
  return row ? mapPersona(row) : null;
}

export async function createPersona(input: PersonaInput): Promise<Persona> {
  const id = newId();
  const ts = nowIso();
  await execute(
    `INSERT INTO personas
       (id, name, display_name, avatar_asset_id, description, persona_prompt,
        language, tone, default_platforms, emoji_level, hashtag_level, style,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      input.name,
      input.displayName,
      input.avatarAssetId,
      input.description,
      input.personaPrompt,
      input.language,
      input.tone,
      JSON.stringify(input.defaultPlatforms),
      input.emojiLevel,
      input.hashtagLevel,
      JSON.stringify(input.style),
      ts,
      ts,
    ],
  );
  return { ...input, id, createdAt: ts, updatedAt: ts };
}

export async function updatePersona(
  id: string,
  input: Partial<PersonaInput>,
): Promise<void> {
  const current = await getPersona(id);
  if (!current) return;
  const merged = { ...current, ...input };
  await execute(
    `UPDATE personas SET
       name = $1, display_name = $2, avatar_asset_id = $3, description = $4,
       persona_prompt = $5, language = $6, tone = $7, default_platforms = $8,
       emoji_level = $9, hashtag_level = $10, style = $11, updated_at = $12
     WHERE id = $13`,
    [
      merged.name,
      merged.displayName,
      merged.avatarAssetId,
      merged.description,
      merged.personaPrompt,
      merged.language,
      merged.tone,
      JSON.stringify(merged.defaultPlatforms),
      merged.emojiLevel,
      merged.hashtagLevel,
      JSON.stringify(merged.style),
      nowIso(),
      id,
    ],
  );
}

export async function deletePersona(id: string): Promise<void> {
  await execute("DELETE FROM personas WHERE id = $1", [id]);
}

// ---------- Ejemplos ----------

interface ExampleRow {
  id: string;
  persona_id: string;
  kind: string;
  text: string;
  created_at: string;
}

export async function listExamples(personaId: string): Promise<PersonaExample[]> {
  const rows = await query<ExampleRow>(
    "SELECT * FROM persona_examples WHERE persona_id = $1 ORDER BY created_at",
    [personaId],
  );
  return rows.map((r) => ({
    id: r.id,
    personaId: r.persona_id,
    kind: r.kind as PersonaExampleKind,
    text: r.text,
    createdAt: r.created_at,
  }));
}

export async function addExample(
  personaId: string,
  kind: PersonaExampleKind,
  text: string,
): Promise<PersonaExample> {
  const id = newId();
  const ts = nowIso();
  await execute(
    "INSERT INTO persona_examples (id, persona_id, kind, text, created_at) VALUES ($1,$2,$3,$4,$5)",
    [id, personaId, kind, text, ts],
  );
  return { id, personaId, kind, text, createdAt: ts };
}

export async function deleteExample(id: string): Promise<void> {
  await execute("DELETE FROM persona_examples WHERE id = $1", [id]);
}

// ---------- Style Memory ----------

interface MemoryRow {
  id: string;
  persona_id: string;
  text: string;
  source: string;
  active: number;
  created_at: string;
}

export async function listMemories(personaId: string): Promise<PersonaMemory[]> {
  const rows = await query<MemoryRow>(
    "SELECT * FROM persona_memories WHERE persona_id = $1 ORDER BY created_at",
    [personaId],
  );
  return rows.map((r) => ({
    id: r.id,
    personaId: r.persona_id,
    text: r.text,
    source: r.source as PersonaMemory["source"],
    active: toBool(r.active),
    createdAt: r.created_at,
  }));
}

export async function addMemory(
  personaId: string,
  text: string,
  source: PersonaMemory["source"] = "manual",
): Promise<PersonaMemory> {
  const id = newId();
  const ts = nowIso();
  await execute(
    "INSERT INTO persona_memories (id, persona_id, text, source, active, created_at) VALUES ($1,$2,$3,$4,1,$5)",
    [id, personaId, text, source, ts],
  );
  return { id, personaId, text, source, active: true, createdAt: ts };
}

export async function setMemoryActive(id: string, active: boolean): Promise<void> {
  await execute("UPDATE persona_memories SET active = $1 WHERE id = $2", [
    fromBool(active),
    id,
  ]);
}

export async function deleteMemory(id: string): Promise<void> {
  await execute("DELETE FROM persona_memories WHERE id = $1", [id]);
}

// ---------- Ajustes por plataforma ----------

interface PlatformSettingsRow {
  id: string;
  persona_id: string;
  platform: string;
  guidance: string;
  max_length: number | null;
  enabled: number;
}

export async function listPlatformSettings(
  personaId: string,
): Promise<PersonaPlatformSettings[]> {
  const rows = await query<PlatformSettingsRow>(
    "SELECT * FROM persona_platform_settings WHERE persona_id = $1",
    [personaId],
  );
  return rows.map((r) => ({
    id: r.id,
    personaId: r.persona_id,
    platform: r.platform as PlatformId,
    guidance: r.guidance,
    maxLength: r.max_length,
    enabled: toBool(r.enabled),
  }));
}

export async function upsertPlatformSettings(
  personaId: string,
  platform: PlatformId,
  values: { guidance: string; maxLength: number | null; enabled: boolean },
): Promise<void> {
  await execute(
    `INSERT INTO persona_platform_settings (id, persona_id, platform, guidance, max_length, enabled)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (persona_id, platform) DO UPDATE SET
       guidance = excluded.guidance,
       max_length = excluded.max_length,
       enabled = excluded.enabled`,
    [
      newId(),
      personaId,
      platform,
      values.guidance,
      values.maxLength,
      fromBool(values.enabled),
    ],
  );
}

import { z } from "zod";
import * as repo from "@/db/repositories/personas";
import type { Persona, PlatformId } from "@/types/domain";
import { AppError } from "@/types/errors";

/** Version del formato de archivo. Sube si el esquema cambia. */
export const PERSONA_FILE_VERSION = 1;

const personaFileSchema = z.object({
  version: z.number().int().positive(),
  persona: z.object({
    name: z.string().min(1),
    displayName: z.string().default(""),
    description: z.string().default(""),
    personaPrompt: z.string().default(""),
    language: z.string().default("es"),
    tone: z.string().default(""),
    defaultPlatforms: z.array(z.string()).default(["x", "telegram"]),
    emojiLevel: z.string().default("low"),
    hashtagLevel: z.string().default("none"),
    style: z.record(z.string(), z.unknown()).default({}),
  }),
  examples: z
    .array(z.object({ kind: z.enum(["good", "bad"]), text: z.string() }))
    .default([]),
  memories: z.array(z.object({ text: z.string() })).default([]),
  platformSettings: z
    .array(
      z.object({
        platform: z.string(),
        guidance: z.string().default(""),
        maxLength: z.number().nullable().default(null),
        enabled: z.boolean().default(true),
      }),
    )
    .default([]),
});

export type PersonaFile = z.infer<typeof personaFileSchema>;

/**
 * Serializa una persona completa a JSON portable.
 * Nunca incluye credenciales ni rutas locales de imagenes.
 */
export async function exportPersona(personaId: string): Promise<string> {
  const persona = await repo.getPersona(personaId);
  if (!persona) {
    throw new AppError(
      "database_error",
      "No se encontro la persona a exportar.",
      "Recarga la aplicacion y volve a intentar.",
    );
  }

  const [examples, memories, platformSettings] = await Promise.all([
    repo.listExamples(personaId),
    repo.listMemories(personaId),
    repo.listPlatformSettings(personaId),
  ]);

  const file: PersonaFile = {
    version: PERSONA_FILE_VERSION,
    persona: {
      name: persona.name,
      displayName: persona.displayName,
      description: persona.description,
      personaPrompt: persona.personaPrompt,
      language: persona.language,
      tone: persona.tone,
      defaultPlatforms: persona.defaultPlatforms,
      emojiLevel: persona.emojiLevel,
      hashtagLevel: persona.hashtagLevel,
      style: persona.style as Record<string, unknown>,
    },
    examples: examples.map((e) => ({ kind: e.kind, text: e.text })),
    memories: memories.map((m) => ({ text: m.text })),
    platformSettings: platformSettings.map((s) => ({
      platform: s.platform,
      guidance: s.guidance,
      maxLength: s.maxLength,
      enabled: s.enabled,
    })),
  };

  return JSON.stringify(file, null, 2);
}

/**
 * Importa una persona desde JSON.
 * Si el nombre ya existe, se le agrega un sufijo en vez de pisar la existente.
 */
export async function importPersona(json: string): Promise<Persona> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new AppError(
      "validation_failed",
      "El archivo no es un JSON valido.",
      "Verifica que sea un archivo .persona.json exportado por esta app.",
      cause,
    );
  }

  const result = personaFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      "validation_failed",
      "El archivo no tiene el formato de una persona.",
      `Detalle: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const file = result.data;
  if (file.version > PERSONA_FILE_VERSION) {
    throw new AppError(
      "validation_failed",
      `El archivo fue creado por una version mas nueva de la app (v${file.version}).`,
      "Actualiza la aplicacion antes de importarlo.",
    );
  }

  const existing = await repo.listPersonas();
  const takenNames = new Set(existing.map((p) => p.name.toLowerCase()));
  let name = file.persona.name;
  let suffix = 2;
  while (takenNames.has(name.toLowerCase())) {
    name = `${file.persona.name} (${suffix++})`;
  }

  const persona = await repo.createPersona({
    name,
    displayName: file.persona.displayName || name,
    avatarAssetId: null,
    description: file.persona.description,
    personaPrompt: file.persona.personaPrompt,
    language: file.persona.language,
    tone: file.persona.tone,
    defaultPlatforms: file.persona.defaultPlatforms as PlatformId[],
    emojiLevel: file.persona.emojiLevel as Persona["emojiLevel"],
    hashtagLevel: file.persona.hashtagLevel as Persona["hashtagLevel"],
    style: file.persona.style as Persona["style"],
  });

  for (const example of file.examples) {
    await repo.addExample(persona.id, example.kind, example.text);
  }
  for (const memory of file.memories) {
    await repo.addMemory(persona.id, memory.text);
  }
  for (const settings of file.platformSettings) {
    await repo.upsertPlatformSettings(persona.id, settings.platform as PlatformId, {
      guidance: settings.guidance,
      maxLength: settings.maxLength,
      enabled: settings.enabled,
    });
  }

  return persona;
}

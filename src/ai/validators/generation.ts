import { z } from "zod";
import {
  buildGenerationSchema,
  extractJsonObject,
  type GenerationPayload,
} from "@/ai/schemas/generation";
import { getPlatformAdapter } from "@/platforms/registry";
import type { PlatformId } from "@/types/domain";

export interface ValidationSuccess {
  ok: true;
  payload: GenerationPayload;
  /** Avisos que no invalidan la respuesta (ej: un post largo para X). */
  warnings: string[];
}

export interface ValidationFailure {
  ok: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Valida la salida cruda del modelo.
 * Los errores se devuelven en lenguaje concreto para poder pedirle al
 * propio modelo que se corrija.
 */
export function validateGenerationOutput(
  raw: string,
  platforms: PlatformId[],
): ValidationResult {
  const json = extractJsonObject(raw);
  if (!json) {
    return {
      ok: false,
      errors: ["La respuesta no contiene un objeto JSON."],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      errors: [`El JSON esta mal formado: ${(error as Error).message}`],
    };
  }

  const schema = buildGenerationSchema(platforms);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result.error) };
  }

  // Longitud fuera de rango es un error duro: no truncamos en silencio.
  const errors: string[] = [];
  const warnings: string[] = [];

  result.data.options.forEach((option, index) => {
    for (const platform of platforms) {
      const variant = option.variants[platform];
      if (!variant) continue;

      const adapter = getPlatformAdapter(platform);
      const validation = adapter.validate(variant.text);

      for (const issue of validation.issues) {
        const label = `Opcion ${index + 1} (${platform})`;
        if (issue.severity === "error") {
          errors.push(`${label}: ${issue.message}`);
        } else {
          warnings.push(`${label}: ${issue.message}`);
        }
      }
    }
  });

  if (errors.length) return { ok: false, errors };

  return { ok: true, payload: result.data as GenerationPayload, warnings };
}

/** Normaliza los textos con las reglas de cada plataforma. */
export function normalizePayload(
  payload: GenerationPayload,
  platforms: PlatformId[],
): GenerationPayload {
  return {
    options: payload.options.map((option) => {
      const variants: GenerationPayload["options"][number]["variants"] = {};
      for (const platform of platforms) {
        const variant = option.variants[platform];
        if (!variant) continue;
        variants[platform] = {
          text: getPlatformAdapter(platform).normalize(variant.text),
        };
      }
      return { ...option, variants };
    }),
  };
}

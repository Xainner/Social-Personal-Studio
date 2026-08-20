import { z } from "zod";
import type { PlatformId } from "@/types/domain";

export const OPTION_COUNT = 5;

const nonEmptyText = z
  .string()
  .trim()
  .min(1, "El texto del post no puede estar vacio");

/**
 * Construye el schema esperado según las plataformas que el usuario eligió.
 * Si solo pidió X, exigir una variante de Telegram sería un falso error.
 *
 * Se usa `record` en vez de `object` para que el tipo inferido siga siendo
 * un mapa indexable por plataforma; las claves obligatorias se comprueban
 * con un refinement que nombra la que falta.
 */
export function buildGenerationSchema(platforms: PlatformId[]) {
  const variantsSchema = z
    .record(z.string(), z.object({ text: nonEmptyText }))
    .superRefine((variants, ctx) => {
      for (const platform of platforms) {
        if (!variants[platform]) {
          ctx.addIssue({
            code: "custom",
            message: `Falta la variante de "${platform}"`,
            path: [platform],
          });
        }
      }
    });

  const optionSchema = z.object({
    id: z.number().int().optional(),
    concept: z.string().trim().min(1, "Falta el nombre del concepto"),
    reasoning_summary: z.string().trim().default(""),
    variants: variantsSchema,
  });

  return z.object({
    options: z
      .array(optionSchema)
      .length(OPTION_COUNT, `Se esperaban exactamente ${OPTION_COUNT} opciones`),
  });
}

export type GenerationPayload = {
  options: {
    id?: number;
    concept: string;
    reasoning_summary: string;
    variants: Record<string, { text: string }>;
  }[];
};

/** Schema del análisis de imágenes (paso de visión). */
export const imageAnalysisSchema = z.object({
  scene: z.string().default(""),
  mood: z.string().default(""),
  clothing: z.string().default(""),
  environment: z.string().default(""),
  objects: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  activities: z.array(z.string()).default([]),
  /** Qué tan seguro está el modelo: filtra alucinaciones de bajo nivel. */
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

/**
 * Extrae el primer objeto JSON de una respuesta que puede venir
 * envuelta en markdown o con texto alrededor.
 */
export function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i++) {
    const char = candidate[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }

  return null;
}

import { describe, expect, it } from "vitest";
import { extractJsonObject } from "@/ai/schemas/generation";
import {
  normalizePayload,
  validateGenerationOutput,
} from "@/ai/validators/generation";
import type { PlatformId } from "@/types/domain";

const BOTH: PlatformId[] = ["x", "telegram"];

function buildValidOutput(count = 5, platforms: PlatformId[] = BOTH) {
  return JSON.stringify({
    options: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      concept: `concepto-${i + 1}`,
      reasoning_summary: "resumen",
      variants: Object.fromEntries(
        platforms.map((p) => [p, { text: `texto para ${p} ${i + 1}` }]),
      ),
    })),
  });
}

describe("extractJsonObject", () => {
  it("extrae JSON plano", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("extrae JSON envuelto en un bloque markdown", () => {
    const raw = 'Aca tenes:\n```json\n{"a":1}\n```\nEspero sirva.';
    expect(extractJsonObject(raw)).toBe('{"a":1}');
  });

  it("extrae JSON con texto alrededor", () => {
    expect(extractJsonObject('Respuesta: {"a":{"b":2}} listo')).toBe('{"a":{"b":2}}');
  });

  it("no se confunde con llaves dentro de strings", () => {
    const raw = '{"text":"esto tiene } una llave"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("maneja comillas escapadas", () => {
    const raw = '{"text":"dijo \\"hola\\" y se fue"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("devuelve null si no hay objeto", () => {
    expect(extractJsonObject("no hay json aca")).toBeNull();
  });
});

describe("validateGenerationOutput", () => {
  it("acepta una salida correcta de 5 opciones", () => {
    const result = validateGenerationOutput(buildValidOutput(), BOTH);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.options).toHaveLength(5);
  });

  it("rechaza cuando no hay exactamente 5 opciones", () => {
    const result = validateGenerationOutput(buildValidOutput(3), BOTH);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("5");
    }
  });

  it("rechaza cuando falta la variante de una plataforma pedida", () => {
    const result = validateGenerationOutput(buildValidOutput(5, ["x"]), BOTH);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("telegram");
    }
  });

  it("acepta una sola plataforma si es la unica pedida", () => {
    const result = validateGenerationOutput(buildValidOutput(5, ["x"]), ["x"]);
    expect(result.ok).toBe(true);
  });

  it("rechaza un post vacio", () => {
    const payload = JSON.parse(buildValidOutput());
    payload.options[2].variants.x.text = "   ";
    const result = validateGenerationOutput(JSON.stringify(payload), BOTH);
    expect(result.ok).toBe(false);
  });

  it("rechaza un post que excede el limite de X", () => {
    const payload = JSON.parse(buildValidOutput());
    payload.options[0].variants.x.text = "a".repeat(400);
    const result = validateGenerationOutput(JSON.stringify(payload), BOTH);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("Opcion 1");
    }
  });

  it("devuelve avisos sin invalidar cuando el post es solo largo", () => {
    const payload = JSON.parse(buildValidOutput());
    payload.options[0].variants.telegram.text = "a".repeat(900);
    const result = validateGenerationOutput(JSON.stringify(payload), BOTH);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("reporta JSON mal formado en vez de lanzar", () => {
    const result = validateGenerationOutput("{ roto: ", BOTH);
    expect(result.ok).toBe(false);
  });

  it("reporta cuando no hay JSON en absoluto", () => {
    const result = validateGenerationOutput("Claro, aca van tus posts!", BOTH);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("JSON");
  });
});

describe("normalizePayload", () => {
  it("limpia los textos con las reglas de cada plataforma", () => {
    const payload = JSON.parse(buildValidOutput());
    payload.options[0].variants.x.text = "  hola   \n\n\n\nmundo  ";
    const normalized = normalizePayload(payload, BOTH);
    expect(normalized.options[0].variants.x.text).toBe("hola\n\nmundo");
  });

  it("descarta variantes de plataformas no pedidas", () => {
    const payload = JSON.parse(buildValidOutput());
    const normalized = normalizePayload(payload, ["x"]);
    expect(normalized.options[0].variants.telegram).toBeUndefined();
    expect(normalized.options[0].variants.x).toBeDefined();
  });
});

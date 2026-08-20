import { describe, expect, it } from "vitest";
import { extractServerMessage } from "@/ai/providers/openai-compatible";

describe("extractServerMessage", () => {
  it("saca el mensaje del formato de error de OpenAI/LiteLLM", () => {
    const body = JSON.stringify({
      error: {
        message:
          "/chat/completions: Invalid model name passed in model=qwen3.8 27b.",
        code: "400",
      },
    });
    expect(extractServerMessage(body)).toContain("Invalid model name");
  });

  it("soporta error como string plano", () => {
    expect(extractServerMessage(JSON.stringify({ error: "algo salio mal" }))).toBe(
      "algo salio mal",
    );
  });

  it("soporta message en la raiz", () => {
    expect(extractServerMessage(JSON.stringify({ message: "sin permiso" }))).toBe(
      "sin permiso",
    );
  });

  it("devuelve el texto tal cual si no es JSON", () => {
    expect(extractServerMessage("502 Bad Gateway")).toBe("502 Bad Gateway");
  });

  it("no explota con cuerpo vacio", () => {
    expect(extractServerMessage("")).toBe("");
  });

  it("recorta cuerpos muy largos", () => {
    expect(extractServerMessage("x".repeat(500))).toHaveLength(200);
  });
});

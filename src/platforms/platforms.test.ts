import { describe, expect, it } from "vitest";
import { getPlatformAdapter, listPlatformAdapters } from "@/platforms/registry";

describe("adaptador de X", () => {
  const x = getPlatformAdapter("x");

  it("acepta un texto dentro del limite", () => {
    const result = x.validate("Hola mundo");
    expect(result.ok).toBe(true);
    expect(result.length).toBe(10);
  });

  it("rechaza texto vacio", () => {
    const result = x.validate("");
    expect(result.ok).toBe(false);
    expect(result.issues[0].severity).toBe("error");
  });

  it("marca error cuando supera 280 caracteres, sin truncar", () => {
    const text = "a".repeat(300);
    const result = x.validate(text);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("20"))).toBe(true);
    // El adaptador nunca modifica el texto: solo informa.
    expect(x.normalize(text)).toHaveLength(300);
  });

  it("cuenta emojis como un solo caracter", () => {
    // Un emoji ocupa 2 unidades UTF-16 pero es 1 caracter para X.
    expect(x.validate("🌊").length).toBe(1);
  });

  it("avisa cuando quedan pocos caracteres", () => {
    const result = x.validate("a".repeat(270));
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("normaliza espacios y saltos sobrantes", () => {
    expect(x.normalize("  hola   \n\n\n\nmundo  ")).toBe("hola\n\nmundo");
  });
});

describe("adaptador de Telegram", () => {
  const telegram = getPlatformAdapter("telegram");

  it("permite textos mas largos que X", () => {
    const text = "a".repeat(500);
    expect(telegram.validate(text).ok).toBe(true);
    expect(getPlatformAdapter("x").validate(text).ok).toBe(false);
  });

  it("avisa cuando el post se vuelve incomodo de leer", () => {
    const result = telegram.validate("a".repeat(900));
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("rechaza superar el limite real de Telegram", () => {
    expect(telegram.validate("a".repeat(5000)).ok).toBe(false);
  });
});

describe("registro de plataformas", () => {
  it("expone las reglas de prompt de cada plataforma", () => {
    for (const adapter of listPlatformAdapters()) {
      expect(adapter.buildPromptRules().length).toBeGreaterThan(0);
      expect(adapter.displayName).toBeTruthy();
    }
  });
});

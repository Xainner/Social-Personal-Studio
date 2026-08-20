import type { PlatformAdapter, PlatformValidation, PlatformValidationIssue } from "@/platforms/types";

/** Limite real de un mensaje de Telegram. */
const MAX_LENGTH = 4096;
/** Umbral editorial: un post de canal mas largo que esto se lee mal. */
const COMFORTABLE_LENGTH = 700;

export const telegramAdapter: PlatformAdapter = {
  id: "telegram",
  displayName: "Telegram",
  maxLength: MAX_LENGTH,

  buildPromptRules(): string {
    return [
      "Reglas para Telegram:",
      "- Puede ser algo mas largo y conversacional que X.",
      "- Se permiten saltos de linea para dar respiro al texto.",
      `- Idealmente por debajo de ${COMFORTABLE_LENGTH} caracteres.`,
      "- Tono cercano, como hablandole a una comunidad que ya te sigue.",
      "- Los hashtags casi nunca aportan aca: usalos solo si la persona lo pide.",
    ].join("\n");
  },

  validate(text: string): PlatformValidation {
    const length = [...text].length;
    const issues: PlatformValidationIssue[] = [];

    if (length === 0) {
      issues.push({ severity: "error", message: "El texto esta vacio." });
    }
    if (length > MAX_LENGTH) {
      issues.push({
        severity: "error",
        message: `Supera el limite de Telegram por ${length - MAX_LENGTH} caracteres.`,
      });
    } else if (length > COMFORTABLE_LENGTH) {
      issues.push({
        severity: "warning",
        message: "Es mas largo de lo habitual para un post de canal.",
      });
    }

    return {
      ok: !issues.some((i) => i.severity === "error"),
      issues,
      length,
      maxLength: MAX_LENGTH,
    };
  },

  normalize(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  },
};

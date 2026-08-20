import type { PlatformAdapter, PlatformValidation, PlatformValidationIssue } from "@/platforms/types";

const MAX_LENGTH = 280;

/**
 * X cuenta por code points, no por unidades UTF-16.
 * Sin esto, un emoji contaría doble.
 */
function countCharacters(text: string): number {
  return [...text].length;
}

export const xAdapter: PlatformAdapter = {
  id: "x",
  displayName: "X",
  maxLength: MAX_LENGTH,

  buildPromptRules(): string {
    return [
      "Reglas para X (Twitter):",
      `- Maximo ${MAX_LENGTH} caracteres, contando emojis y espacios.`,
      "- Directo y con gancho en las primeras palabras.",
      "- Sin saltos de linea innecesarios: una o dos lineas como maximo.",
      "- Evita listas y formato largo.",
    ].join("\n");
  },

  validate(text: string): PlatformValidation {
    const length = countCharacters(text);
    const issues: PlatformValidationIssue[] = [];

    if (length === 0) {
      issues.push({ severity: "error", message: "El texto esta vacio." });
    }
    if (length > MAX_LENGTH) {
      issues.push({
        severity: "error",
        message: `Supera el limite de X por ${length - MAX_LENGTH} caracteres.`,
      });
    } else if (length > MAX_LENGTH - 20) {
      issues.push({
        severity: "warning",
        message: `Quedan ${MAX_LENGTH - length} caracteres.`,
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
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },
};

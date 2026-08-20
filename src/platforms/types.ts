import type { PlatformId } from "@/types/domain";

export interface PlatformValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export interface PlatformValidation {
  ok: boolean;
  issues: PlatformValidationIssue[];
  /** Longitud contada según las reglas de la plataforma. */
  length: number;
  maxLength: number | null;
}

/**
 * Un adaptador encapsula TODO lo específico de una plataforma:
 * reglas de escritura para el prompt, validación y normalización.
 * Ningún componente de UI debe contener condicionales por plataforma.
 */
export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly displayName: string;
  readonly maxLength: number | null;

  /** Reglas que se inyectan en el prompt de generación. */
  buildPromptRules(): string;

  /** Valida un texto. Nunca trunca en silencio: reporta el problema. */
  validate(text: string): PlatformValidation;

  /** Limpieza previsible: espacios sobrantes, saltos de línea excesivos. */
  normalize(text: string): string;
}

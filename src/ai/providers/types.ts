import type { AIProviderConfig, ProviderCapabilities } from "@/types/domain";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ImageInput {
  /** data URL base64 de la imagen. */
  dataUrl: string;
}

export interface GenerateOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  /** Pide al proveedor que responda JSON, si lo soporta. */
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface AnalyzeImagesOptions {
  model: string;
  images: ImageInput[];
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  /** Sobreescribe el timeout del proveedor para esta llamada. */
  timeoutMs?: number;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  models?: string[];
}

/**
 * Contrato que cumple todo proveedor de IA.
 * No todos soportan todo: `capabilities` declara qué puede hacer cada uno.
 */
export interface AIProvider {
  readonly config: AIProviderConfig;
  readonly capabilities: ProviderCapabilities;

  /** Devuelve el texto crudo generado por el modelo. */
  generateText(options: GenerateOptions): Promise<string>;

  /** Igual que generateText, pero pidiendo salida JSON. */
  generateStructured(options: GenerateOptions): Promise<string>;

  /** Describe imágenes. Falla si el proveedor no tiene visión. */
  analyzeImages(options: AnalyzeImagesOptions): Promise<string>;

  testConnection(signal?: AbortSignal): Promise<TestConnectionResult>;

  listModels(signal?: AbortSignal): Promise<string[]>;
}

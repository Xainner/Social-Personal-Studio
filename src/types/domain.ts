/**
 * Modelos de dominio de Social Persona Studio.
 * Independientes de la UI y de cualquier proveedor de IA concreto.
 */

export type PlatformId = "x" | "telegram";

export const ALL_PLATFORMS: readonly PlatformId[] = ["x", "telegram"] as const;

export type EmojiLevel = "none" | "low" | "medium" | "high";
export type HashtagLevel = "none" | "low" | "medium" | "high";

/** Persona Core: solo cambia por edición explícita del usuario. */
export interface Persona {
  id: string;
  name: string;
  displayName: string;
  avatarAssetId: string | null;
  description: string;
  /** Instrucción libre que describe la identidad editorial. */
  personaPrompt: string;
  language: string;
  tone: string;
  defaultPlatforms: PlatformId[];
  emojiLevel: EmojiLevel;
  hashtagLevel: HashtagLevel;
  /** Campos de estilo opcionales y extensibles sin migrar la tabla. */
  style: PersonaStyle;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaStyle {
  personality?: string;
  communicationStyle?: string;
  preferredVocabulary?: string[];
  forbiddenVocabulary?: string[];
  commonExpressions?: string[];
  humorLevel?: string;
  flirtinessLevel?: string;
  formality?: string;
  sentenceLength?: string;
  typicalOpenings?: string[];
  typicalClosings?: string[];
  locale?: string;
}

export type PersonaExampleKind = "good" | "bad";

export interface PersonaExample {
  id: string;
  personaId: string;
  kind: PersonaExampleKind;
  text: string;
  createdAt: string;
}

export type MemorySource = "manual" | "learned";

/** Style Memory: preferencias que evolucionan con el tiempo. */
export interface PersonaMemory {
  id: string;
  personaId: string;
  text: string;
  source: MemorySource;
  active: boolean;
  createdAt: string;
}

export interface PersonaPlatformSettings {
  id: string;
  personaId: string;
  platform: PlatformId;
  /** Notas de estilo específicas de la plataforma para esta persona. */
  guidance: string;
  maxLength: number | null;
  enabled: boolean;
}

export interface Session {
  id: string;
  personaId: string;
  name: string;
  /** Session Context: nunca se vuelve memoria permanente automáticamente. */
  context: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  filePath: string;
  thumbnailPath: string | null;
  fileHash: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
  aiDescription: string | null;
  createdAt: string;
}

export interface AssetUsage {
  generations: number;
  savedPosts: number;
  usedPosts: number;
}

export type GenerationStatus =
  | "pending"
  | "analyzing"
  | "generating"
  | "validating"
  | "completed"
  | "failed";

export interface GenerationRequest {
  id: string;
  sessionId: string;
  userContext: string;
  platforms: PlatformId[];
  providerId: string;
  visionModel: string | null;
  writingModel: string;
  promptVersion: string;
  status: GenerationStatus;
  error: string | null;
  createdAt: string;
}

export interface Generation {
  id: string;
  requestId: string;
  rawOutput: string;
  createdAt: string;
}

export interface GenerationOption {
  id: string;
  generationId: string;
  /** 1..5 */
  optionIndex: number;
  concept: string;
  reasoningSummary: string;
  variants: PlatformVariant[];
}

export interface PlatformVariant {
  id: string;
  optionId: string;
  platform: PlatformId;
  /** Texto original de la IA: nunca se sobreescribe. */
  generatedText: string;
  /** Edición del usuario, si existe. */
  editedText: string | null;
}

export type PostStatus = "draft" | "saved" | "used" | "archived";

export interface SavedPost {
  id: string;
  personaId: string;
  sessionId: string | null;
  variantId: string | null;
  platform: PlatformId;
  finalText: string;
  status: PostStatus;
  favorite: boolean;
  usedAt: string | null;
  notes: string;
  providerModel: string;
  createdAt: string;
  tags?: string[];
}

export type ProviderKind = "openai_compatible" | "anthropic" | "ollama";

export interface ProviderCapabilities {
  textGeneration: boolean;
  vision: boolean;
  structuredOutput: boolean;
  streaming: boolean;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Referencia al secreto en el keychain del SO. La key nunca vive en SQLite. */
  keyringRef: string | null;
  capabilities: ProviderCapabilities;
  /** Milisegundos. Los endpoints locales pueden ser lentos. */
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
}

export type ModelRole = "vision" | "writing" | "both";

export interface AIModelConfig {
  id: string;
  providerId: string;
  modelName: string;
  role: ModelRole;
  isDefault: boolean;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: string;
  defaultPersonaId: string | null;
  defaultPlatforms: PlatformId[];
  writingProviderId: string | null;
  writingModel: string | null;
  visionProviderId: string | null;
  visionModel: string | null;
  recentPostsWindow: number;
  debugMode: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "dark",
  language: "es",
  defaultPersonaId: null,
  defaultPlatforms: ["x", "telegram"],
  writingProviderId: null,
  writingModel: null,
  visionProviderId: null,
  visionModel: null,
  recentPostsWindow: 15,
  debugMode: false,
};

import { fetch } from "@tauri-apps/plugin-http";
import type {
  AIProvider,
  AnalyzeImagesOptions,
  GenerateOptions,
  TestConnectionResult,
} from "@/ai/providers/types";
import type { AIProviderConfig, ProviderCapabilities } from "@/types/domain";
import { appError, AppError } from "@/types/errors";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; code?: string };
}

/**
 * Proveedor para cualquier API con formato OpenAI: /chat/completions.
 * Cubre el endpoint local del usuario (LiteLLM), OpenAI, OpenRouter,
 * LM Studio, llama.cpp server y similares.
 *
 * Se configura con tres datos: URL base, nombre de modelo y API key.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly config: AIProviderConfig;
  readonly capabilities: ProviderCapabilities;
  private readonly apiKey: string | null;

  constructor(config: AIProviderConfig, apiKey: string | null) {
    this.config = config;
    this.capabilities = config.capabilities;
    this.apiKey = apiKey;
  }

  private url(path: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    return `${base}${path}`;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /** Combina el timeout configurado con la cancelación del usuario. */
  private withTimeout(signal?: AbortSignal): {
    signal: AbortSignal;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), this.config.timeoutMs);

    const onAbort = () => controller.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    return {
      signal: controller.signal,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      },
    };
  }

  private async post(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResponse> {
    const { signal: merged, cleanup } = this.withTimeout(signal);

    let response: Response;
    try {
      response = await fetch(this.url(path), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: merged,
      });
    } catch (cause) {
      cleanup();
      if (merged.aborted && merged.reason === "timeout") {
        throw appError("generation_timeout", cause);
      }
      throw appError("provider_unavailable", cause);
    } finally {
      cleanup();
    }

    if (!response.ok) {
      throw this.mapHttpError(response.status, await safeText(response));
    }

    const json = (await response.json()) as ChatCompletionResponse;
    if (json.error) {
      throw OpenAICompatibleProvider.detailedError(
        "provider_unavailable",
        json.error.message ?? "",
      );
    }
    return json;
  }

  /**
   * Construye un AppError conservando el mensaje del servidor.
   * Sin esto, un "modelo invalido" se mostraba como "no se pudo contactar al
   * proveedor" y mandaba al usuario a revisar el servidor equivocado.
   */
  private static detailedError(
    code: Parameters<typeof appError>[0],
    detail: string,
  ): AppError {
    const base = appError(code);
    const clean = extractServerMessage(detail);
    return new AppError(
      code,
      base.message,
      clean ? `El servidor respondio: "${clean}". ${base.action}` : base.action,
      detail,
    );
  }

  private mapHttpError(status: number, body: string): AppError {
    if (status === 401 || status === 403) {
      return OpenAICompatibleProvider.detailedError("invalid_api_key", body);
    }
    if (status === 404) {
      return OpenAICompatibleProvider.detailedError("model_unavailable", body);
    }
    if (status === 429) {
      return OpenAICompatibleProvider.detailedError("rate_limited", body);
    }
    if (status >= 500) {
      return OpenAICompatibleProvider.detailedError("provider_unavailable", body);
    }
    // Un 400 casi siempre es un parametro mal formado; el caso mas comun de
    // lejos es un nombre de modelo que no existe en el servidor.
    if (status === 400 && /model/i.test(body)) {
      return OpenAICompatibleProvider.detailedError("model_unavailable", body);
    }
    return OpenAICompatibleProvider.detailedError("validation_failed", body);
  }

  private static readContent(response: ChatCompletionResponse): string {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw appError("malformed_ai_json", "La respuesta no trae contenido.");
    }
    return content;
  }

  async generateText(options: GenerateOptions): Promise<string> {
    const response = await this.post(
      "/chat/completions",
      {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.8,
      },
      options.signal,
    );
    return OpenAICompatibleProvider.readContent(response);
  }

  async generateStructured(options: GenerateOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.8,
    };
    // No todos los endpoints locales soportan response_format; si falla,
    // reintentamos sin él antes de dar el error por perdido.
    if (options.jsonMode !== false) {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await this.post("/chat/completions", body, options.signal);
      return OpenAICompatibleProvider.readContent(response);
    } catch (error) {
      if (options.jsonMode === false) throw error;
      return this.generateStructured({ ...options, jsonMode: false });
    }
  }

  async analyzeImages(options: AnalyzeImagesOptions): Promise<string> {
    if (!this.capabilities.vision) {
      throw appError("vision_unsupported");
    }

    const content: unknown[] = [{ type: "text", text: options.prompt }];
    for (const image of options.images) {
      content.push({ type: "image_url", image_url: { url: image.dataUrl } });
    }

    const messages: unknown[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content });

    const response = await this.post(
      "/chat/completions",
      { model: options.model, messages, temperature: 0.2 },
      options.signal,
    );
    return OpenAICompatibleProvider.readContent(response);
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const { signal: merged, cleanup } = this.withTimeout(signal);
    try {
      const response = await fetch(this.url("/models"), {
        method: "GET",
        headers: this.headers(),
        signal: merged,
      });
      if (!response.ok) return [];
      const json = (await response.json()) as { data?: { id?: string }[] };
      return (json.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === "string");
    } catch {
      return [];
    } finally {
      cleanup();
    }
  }

  async testConnection(signal?: AbortSignal): Promise<TestConnectionResult> {
    const started = performance.now();
    try {
      const models = await this.listModels(signal);
      return {
        ok: true,
        message: models.length
          ? `Conexion correcta. ${models.length} modelos disponibles.`
          : "Conexion correcta, pero el endpoint no lista modelos.",
        latencyMs: Math.round(performance.now() - started),
        models,
      };
    } catch (error) {
      const appErr = error instanceof AppError ? error : appError("provider_unavailable", error);
      return {
        ok: false,
        message: `${appErr.message} ${appErr.action}`,
        latencyMs: Math.round(performance.now() - started),
      };
    }
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

/**
 * Saca el mensaje humano del cuerpo de error, que suele venir como
 * {"error":{"message":"..."}}. Si no es JSON, devuelve el texto recortado.
 */
export function extractServerMessage(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const raw =
      typeof parsed.error === "string"
        ? parsed.error
        : (parsed.error?.message ?? parsed.message ?? "");
    return raw.trim().slice(0, 200);
  } catch {
    return body.trim().slice(0, 200);
  }
}

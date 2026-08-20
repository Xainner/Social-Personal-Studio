import { OpenAICompatibleProvider } from "@/ai/providers/openai-compatible";
import type { AIProvider } from "@/ai/providers/types";
import { getProvider, getProviderApiKey } from "@/db/repositories/providers";
import { AppError, appError } from "@/types/errors";

/**
 * Construye el adaptador correspondiente a un proveedor guardado.
 * La API key se lee del llavero del SO en el momento del uso: no se cachea.
 */
export async function createProviderClient(providerId: string): Promise<AIProvider> {
  const config = await getProvider(providerId);
  if (!config) throw appError("no_provider_configured");
  if (!config.enabled) {
    throw appError("provider_unavailable", "El proveedor esta desactivado.");
  }

  const apiKey = await getProviderApiKey(config);

  switch (config.kind) {
    case "openai_compatible":
      return new OpenAICompatibleProvider(config, apiKey);

    // Anthropic y Ollama hablan protocolos distintos. Usar el adaptador de
    // OpenAI para ellos produciria errores confusos, asi que fallamos claro
    // hasta que sus adaptadores existan.
    case "anthropic":
    case "ollama":
      throw new AppError(
        "no_provider_configured",
        `El proveedor de tipo "${config.kind}" todavia no esta implementado.`,
        "Usa un proveedor compatible con OpenAI (URL base, modelo y API key).",
      );

    default:
      throw appError("no_provider_configured");
  }
}

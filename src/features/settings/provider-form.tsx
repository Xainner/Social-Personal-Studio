import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Spinner } from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import { useAddModel, useCreateProvider, useUpdateProvider } from "@/hooks/use-providers";
import { DEFAULT_CAPABILITIES } from "@/db/repositories/providers";
import { OpenAICompatibleProvider } from "@/ai/providers/openai-compatible";
import { toAppError } from "@/types/errors";
import type { AIProviderConfig } from "@/types/domain";

const DEFAULT_TIMEOUT_MS = 300_000;

/** Lee la key ya guardada en el llavero para poder listar modelos al editar. */
async function resolveExistingKey(
  provider: AIProviderConfig | undefined,
): Promise<string | null> {
  if (!provider) return null;
  const { getProviderApiKey } = await import("@/db/repositories/providers");
  return getProviderApiKey(provider);
}

interface ProviderFormProps {
  open: boolean;
  onClose: () => void;
  /** Si viene, edita ese proveedor en vez de crear uno nuevo. */
  provider?: AIProviderConfig;
}

/**
 * Formulario del proveedor de IA: los tres datos que pidió el usuario
 * (URL base, modelo y API key) más las capacidades del endpoint.
 */
export function ProviderForm({ open, onClose, provider }: ProviderFormProps) {
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const addModel = useAddModel();

  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasVision, setHasVision] = useState(provider?.capabilities.vision ?? false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    String((provider?.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000),
  );

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<unknown>(null);

  const isEditing = Boolean(provider);
  const pending = createProvider.isPending || updateProvider.isPending;

  /**
   * Consulta al endpoint que modelos ofrece realmente.
   * Elegirlos de una lista evita el error mas facil de cometer y mas dificil
   * de diagnosticar: un nombre de modelo mal tipeado.
   */
  async function loadModels() {
    setModelsError(null);
    setLoadingModels(true);
    try {
      const probe = new OpenAICompatibleProvider(
        {
          id: provider?.id ?? "probe",
          name: name.trim() || "probe",
          kind: "openai_compatible",
          baseUrl: baseUrl.trim(),
          keyringRef: null,
          capabilities: { ...DEFAULT_CAPABILITIES, vision: hasVision },
          timeoutMs: 30_000,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        apiKey || (await resolveExistingKey(provider)),
      );

      const models = await probe.listModels();
      setAvailableModels(models);
      if (models.length === 0) {
        setModelsError(
          new Error("El endpoint respondio pero no devolvio ningun modelo."),
        );
      }
    } catch (error) {
      setModelsError(toAppError(error));
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSubmit() {
    const capabilities = { ...DEFAULT_CAPABILITIES, vision: hasVision };
    const timeoutMs = Math.max(10, Number(timeoutSeconds) || 300) * 1000;

    if (provider) {
      await updateProvider.mutateAsync({
        id: provider.id,
        input: {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          capabilities,
          timeoutMs,
          // Solo tocamos la key si el usuario escribió una nueva.
          ...(apiKey ? { apiKey } : {}),
        },
      });
      if (modelName.trim()) {
        await addModel.mutateAsync({
          providerId: provider.id,
          modelName: modelName.trim(),
          role: hasVision ? "both" : "writing",
          isDefault: true,
        });
      }
    } else {
      const created = await createProvider.mutateAsync({
        name: name.trim(),
        kind: "openai_compatible",
        baseUrl: baseUrl.trim(),
        capabilities,
        timeoutMs,
        enabled: true,
        apiKey: apiKey || undefined,
      });
      if (modelName.trim()) {
        await addModel.mutateAsync({
          providerId: created.id,
          modelName: modelName.trim(),
          role: hasVision ? "both" : "writing",
          isDefault: true,
        });
      }
    }

    setApiKey("");
    setModelName("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar proveedor" : "Nuevo proveedor de IA"}
      description="Compatible con OpenAI: LiteLLM, LM Studio, llama.cpp, OpenRouter, OpenAI."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !baseUrl.trim() || pending}
          >
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="provider-name">Nombre</Label>
          <Input
            id="provider-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mi IA local"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="provider-url">URL base</Label>
          <Input
            id="provider-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.ejemplo.net/v1"
          />
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Sin <code>/chat/completions</code> al final: la app lo agrega.
          </p>
        </div>

        <div>
          <Label htmlFor="provider-model">Modelo</Label>

          {availableModels.length > 0 ? (
            <Select
              id="provider-model"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            >
              <option value="">Elegi un modelo...</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="provider-model"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="qwen3.6-27b"
            />
          )}

          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={loadModels}
            disabled={!baseUrl.trim() || loadingModels}
          >
            {loadingModels ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
            {availableModels.length > 0 ? "Actualizar lista" : "Buscar modelos"}
          </Button>

          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            {availableModels.length > 0
              ? `${availableModels.length} modelos disponibles en el endpoint.`
              : "Cargá la URL y la key, luego buscá los modelos para elegir de la lista y evitar errores de tipeo."}
          </p>

          {isEditing && availableModels.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Dejalo vacio para no agregar otro modelo.
            </p>
          ) : null}

          <ErrorMessage error={modelsError} className="mt-2" />
        </div>

        <div>
          <Label htmlFor="provider-key">API key</Label>
          <div className="flex gap-2">
            <Input
              id="provider-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                isEditing && provider?.keyringRef
                  ? "Guardada. Escribi una nueva para reemplazarla."
                  : "sk-..."
              }
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Ocultar" : "Mostrar"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Se guarda en el Administrador de credenciales de Windows, nunca en la
            base de datos de la app.
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={hasVision}
            onChange={(e) => setHasVision(e.target.checked)}
            className="h-4 w-4"
          />
          El modelo puede analizar imagenes (vision)
        </label>

        <div>
          <Label htmlFor="provider-timeout">Tiempo de espera (segundos)</Label>
          <Input
            id="provider-timeout"
            type="number"
            min={10}
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Los endpoints locales suelen ser lentos. 300 segundos es un valor
            seguro.
          </p>
        </div>

        <ErrorMessage error={createProvider.error ?? updateProvider.error} />
      </div>
    </Dialog>
  );
}

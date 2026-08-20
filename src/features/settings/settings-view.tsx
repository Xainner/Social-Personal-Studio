import { useState } from "react";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { importPersona } from "@/features/personas/persona-io";
import { Check, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  Select,
  Separator,
} from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import { ProviderForm } from "@/features/settings/provider-form";
import {
  useDeleteModel,
  useDeleteProvider,
  useModels,
  useProviders,
  useTestConnection,
} from "@/hooks/use-providers";
import { usePersonas } from "@/hooks/use-personas";
import { useAppStore } from "@/stores/app-store";
import type { AIProviderConfig } from "@/types/domain";

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const { data: providers = [] } = useProviders();
  const { data: allModels = [] } = useModels();
  const { data: personas = [] } = usePersonas();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AIProviderConfig | undefined>();

  const writingModels = allModels.filter(
    (m) => m.providerId === settings.writingProviderId && m.role !== "vision",
  );
  const visionModels = allModels.filter(
    (m) => m.providerId === settings.visionProviderId && m.role !== "writing",
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Ajustes</h1>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Proveedores de IA</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        {providers.length === 0 ? (
          <EmptyState
            title="No hay ningun proveedor configurado"
            description="Agrega tu endpoint compatible con OpenAI: URL base, nombre del modelo y API key."
          />
        ) : (
          <div className="space-y-2">
            {providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                onEdit={() => {
                  setEditing(provider);
                  setFormOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Modelos por rol</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Podes usar un modelo para escribir y otro distinto para leer imagenes.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="writing-provider">Proveedor de escritura</Label>
            <Select
              id="writing-provider"
              value={settings.writingProviderId ?? ""}
              onChange={(e) =>
                updateSettings({
                  writingProviderId: e.target.value || null,
                  writingModel: null,
                })
              }
            >
              <option value="">Sin definir</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="writing-model">Modelo de escritura</Label>
            <Select
              id="writing-model"
              value={settings.writingModel ?? ""}
              onChange={(e) => updateSettings({ writingModel: e.target.value || null })}
              disabled={!settings.writingProviderId}
            >
              <option value="">Sin definir</option>
              {writingModels.map((m) => (
                <option key={m.id} value={m.modelName}>
                  {m.modelName}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="vision-provider">Proveedor de vision</Label>
            <Select
              id="vision-provider"
              value={settings.visionProviderId ?? ""}
              onChange={(e) =>
                updateSettings({
                  visionProviderId: e.target.value || null,
                  visionModel: null,
                })
              }
            >
              <option value="">Usar el de escritura</option>
              {providers
                .filter((p) => p.capabilities.vision)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="vision-model">Modelo de vision</Label>
            <Select
              id="vision-model"
              value={settings.visionModel ?? ""}
              onChange={(e) => updateSettings({ visionModel: e.target.value || null })}
              disabled={!settings.visionProviderId}
            >
              <option value="">Usar el de escritura</option>
              {visionModels.map((m) => (
                <option key={m.id} value={m.modelName}>
                  {m.modelName}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">General</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="theme">Tema</Label>
            <Select
              id="theme"
              value={settings.theme}
              onChange={(e) =>
                updateSettings({ theme: e.target.value as typeof settings.theme })
              }
            >
              <option value="dark">Oscuro</option>
              <option value="light">Claro</option>
              <option value="system">Segun el sistema</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="default-persona">Persona por defecto</Label>
            <Select
              id="default-persona"
              value={settings.defaultPersonaId ?? ""}
              onChange={(e) =>
                updateSettings({ defaultPersonaId: e.target.value || null })
              }
            >
              <option value="">Ninguna</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName || p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="recent-window">
            Publicaciones recientes para evitar repeticion
          </Label>
          <Input
            id="recent-window"
            type="number"
            min={0}
            max={50}
            value={settings.recentPostsWindow}
            onChange={(e) =>
              updateSettings({ recentPostsWindow: Number(e.target.value) || 0 })
            }
            className="max-w-32"
          />
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Cuantos posts guardados o usados se le muestran a la IA para que no
            repita aperturas ni estructuras.
          </p>
        </div>
      </section>

      <Separator />

      <ImportPersonaSection />

      <Separator />

      <BackupSection />

      <ProviderForm
        open={formOpen}
        provider={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
      />
    </div>
  );
}

function ProviderRow({
  provider,
  onEdit,
}: {
  provider: AIProviderConfig;
  onEdit: () => void;
}) {
  const testConnection = useTestConnection();
  const deleteProvider = useDeleteProvider();
  const deleteModel = useDeleteModel();
  const { data: models = [] } = useModels(provider.id);

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{provider.name}</h3>
              {provider.capabilities.vision ? (
                <Badge variant="outline">vision</Badge>
              ) : null}
              {provider.keyringRef ? (
                <Badge variant="outline">key guardada</Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {provider.baseUrl}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => testConnection.mutate(provider.id)}
              disabled={testConnection.isPending}
              aria-label="Probar conexion"
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--destructive)]"
              onClick={() => deleteProvider.mutate(provider.id)}
              aria-label="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {models.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {models.map((model) => (
              <span
                key={model.id}
                className="group inline-flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs"
              >
                {model.modelName}
                <button
                  onClick={() => deleteModel.mutate(model.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-60"
                  aria-label={`Quitar ${model.modelName}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            Sin modelos. Edita el proveedor para agregar uno.
          </p>
        )}

        {testConnection.isPending ? (
          <p className="text-xs text-[var(--muted-foreground)]">Probando...</p>
        ) : testConnection.data ? (
          <p
            className={
              testConnection.data.ok
                ? "text-xs text-[var(--success)]"
                : "text-xs text-[var(--destructive)]"
            }
          >
            {testConnection.data.ok ? <Check className="mr-1 inline h-3 w-3" /> : null}
            {testConnection.data.message} ({testConnection.data.latencyMs} ms)
          </p>
        ) : null}

        <ErrorMessage error={testConnection.error ?? deleteProvider.error} />
      </CardContent>
    </Card>
  );
}

function ImportPersonaSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function handleImport() {
    setError(null);
    setStatus(null);
    try {
      const source = await openDialog({
        title: "Importar persona",
        filters: [{ name: "Persona", extensions: ["json"] }],
      });
      if (!source || Array.isArray(source)) return;

      const json = await readTextFile(source);
      const persona = await importPersona(json);
      qc.invalidateQueries({ queryKey: ["personas"] });
      setStatus(`Persona "${persona.name}" importada.`);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Personas</h2>
      <p className="text-xs text-[var(--muted-foreground)]">
        Podes exportar una persona desde su pantalla de edicion e importarla en
        otra instalacion. Los archivos nunca incluyen API keys.
      </p>

      <Button variant="outline" size="sm" onClick={handleImport}>
        Importar persona
      </Button>

      {status ? <p className="text-xs text-[var(--success)]">{status}</p> : null}
      <ErrorMessage error={error} />
    </section>
  );
}

function BackupSection() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function handleBackup() {
    setError(null);
    setStatus(null);
    try {
      const destination = await save({
        title: "Guardar respaldo",
        defaultPath: `social-persona-studio-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "Respaldo", extensions: ["zip"] }],
      });
      if (!destination) return;

      const result = await invoke<{ files: number; bytes: number }>("create_backup", {
        destination,
        includeAssets: true,
      });
      setStatus(
        `Respaldo creado: ${result.files} archivos (${(result.bytes / 1024 / 1024).toFixed(1)} MB).`,
      );
    } catch (err) {
      setError(err);
    }
  }

  async function handleRestore() {
    setError(null);
    setStatus(null);
    try {
      const source = await openDialog({
        title: "Elegir respaldo",
        filters: [{ name: "Respaldo", extensions: ["zip"] }],
      });
      if (!source || Array.isArray(source)) return;

      await invoke("restore_backup", { source });
      setStatus("Respaldo restaurado. Cerra y volve a abrir la aplicacion.");
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Respaldo</h2>
      <p className="text-xs text-[var(--muted-foreground)]">
        Incluye la base de datos y las imagenes. Las API keys no se respaldan:
        viven en el llavero del sistema.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleBackup}>
          Crear respaldo
        </Button>
        <Button variant="outline" size="sm" onClick={handleRestore}>
          Restaurar
        </Button>
      </div>

      {status ? <p className="text-xs text-[var(--success)]">{status}</p> : null}
      <ErrorMessage error={error} />
    </section>
  );
}

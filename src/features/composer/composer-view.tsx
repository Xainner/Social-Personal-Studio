import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  EmptyState,
  Label,
  Spinner,
  Textarea,
} from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import { ImageDropzone } from "@/features/composer/image-dropzone";
import { OptionCard } from "@/features/generations/option-card";
import { useSessionAssets } from "@/hooks/use-assets";
import { useGeneration } from "@/hooks/use-generation";
import { usePersona } from "@/hooks/use-personas";
import { useSession, useUpdateSession } from "@/hooks/use-sessions";
import { useProviders } from "@/hooks/use-providers";
import { listPlatformAdapters } from "@/platforms/registry";
import { useAppStore } from "@/stores/app-store";
import type { PlatformId } from "@/types/domain";
import { cn } from "@/utils/cn";

export function ComposerView() {
  const activePersonaId = useAppStore((s) => s.activePersonaId);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const settings = useAppStore((s) => s.settings);

  const { data: persona } = usePersona(activePersonaId);
  const { data: session } = useSession(activeSessionId);
  const { data: assets = [] } = useSessionAssets(activeSessionId);
  const { data: providers = [] } = useProviders();
  const updateSession = useUpdateSession(activePersonaId ?? "");
  const generation = useGeneration();

  const [userContext, setUserContext] = useState("");
  const [platforms, setPlatforms] = useState<PlatformId[]>([]);
  const [styleReference, setStyleReference] = useState<string | null>(null);
  const [sessionContext, setSessionContext] = useState("");

  // Solo al cambiar de persona: si dependiera del array de plataformas,
  // cualquier refetch pisaria lo que el usuario acaba de tildar.
  useEffect(() => {
    if (persona) setPlatforms(persona.defaultPlatforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.id]);

  useEffect(() => {
    setSessionContext(session?.context ?? "");
    generation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const writingProviderId =
    settings.writingProviderId ?? providers.find((p) => p.enabled)?.id ?? null;
  const writingModel = settings.writingModel;

  const readyToGenerate = useMemo(
    () =>
      Boolean(
        persona &&
          session &&
          platforms.length > 0 &&
          writingProviderId &&
          writingModel &&
          !generation.isGenerating,
      ),
    [persona, session, platforms, writingProviderId, writingModel, generation.isGenerating],
  );

  if (!persona) {
    return (
      <EmptyState
        title="Elegi o crea una persona"
        description="Cada persona tiene su propia voz, memoria, imagenes e historial. Empeza creando una desde la barra lateral."
      />
    );
  }

  if (!session) {
    return (
      <EmptyState
        title={`Crea una sesion para ${persona.displayName || persona.name}`}
        description="Las sesiones agrupan las imagenes y el contexto de un mismo tema, para poder volver despues."
      />
    );
  }

  const missingProvider = !writingProviderId || !writingModel;

  async function handleGenerate() {
    if (!writingProviderId || !writingModel || !session) return;

    // Persistimos el contexto de la sesión si cambió antes de generar.
    if (sessionContext !== session.context) {
      await updateSession.mutateAsync({
        id: session.id,
        values: { context: sessionContext },
      });
    }

    await generation.run({
      sessionId: session.id,
      userContext,
      platforms,
      assetIds: assets.map((a) => a.id),
      writingProviderId,
      writingModel,
      visionProviderId: settings.visionProviderId,
      visionModel: settings.visionModel,
      recentPostsWindow: settings.recentPostsWindow,
      styleReferences: styleReference ? [styleReference] : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {persona.displayName || persona.name}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">{session.name}</p>
        </div>
        <Link
          to={`/persona/${persona.id}`}
          className="text-xs text-[var(--muted-foreground)] underline-offset-4 hover:underline"
        >
          Editar persona
        </Link>
      </header>

      <ImageDropzone sessionId={session.id} />

      <div>
        <Label htmlFor="session-context">Contexto de la sesion</Label>
        <Textarea
          id="session-context"
          value={sessionContext}
          onChange={(e) => setSessionContext(e.target.value)}
          placeholder={"Fin de semana en la playa.\nNo mencionar la ubicacion."}
          className="min-h-16"
        />
      </div>

      <div>
        <Label htmlFor="user-context">Indicacion para esta generacion</Label>
        <Textarea
          id="user-context"
          value={userContext}
          onChange={(e) => setUserContext(e.target.value)}
          placeholder="Opcional: angulo, idea o algo puntual que quieras esta vez."
          className="min-h-16"
        />
      </div>

      {styleReference ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-3 py-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Usando como referencia de estilo</p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {styleReference}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setStyleReference(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : null}

      <div>
        <Label>Plataformas</Label>
        <div className="flex gap-2">
          {listPlatformAdapters().map((adapter) => {
            const selected = platforms.includes(adapter.id);
            return (
              <button
                key={adapter.id}
                onClick={() =>
                  setPlatforms((current) =>
                    selected
                      ? current.filter((p) => p !== adapter.id)
                      : [...current, adapter.id],
                  )
                }
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 font-medium"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50",
                )}
              >
                {adapter.displayName}
              </button>
            );
          })}
        </div>
        {platforms.length === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--destructive)]">
            Elegi al menos una plataforma.
          </p>
        ) : null}
      </div>

      {missingProvider ? (
        <div className="rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2.5 text-sm">
          <p className="font-medium">Falta configurar la IA</p>
          <p className="mt-0.5 text-[var(--muted-foreground)]">
            Anda a{" "}
            <Link to="/settings" className="underline underline-offset-2">
              Ajustes
            </Link>{" "}
            y agrega tu endpoint (URL base, modelo y API key).
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={handleGenerate} disabled={!readyToGenerate}>
          {generation.isGenerating ? (
            <>
              <Spinner />
              {generation.stageLabel}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generar 5 opciones
            </>
          )}
        </Button>
        {generation.isGenerating ? (
          <Button variant="ghost" onClick={generation.cancel}>
            Cancelar
          </Button>
        ) : null}
      </div>

      <ErrorMessage error={generation.error} />

      {generation.warnings.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {generation.warnings.map((warning, i) => (
            <Badge key={i} variant="warning">
              {warning}
            </Badge>
          ))}
        </div>
      ) : null}

      {generation.options.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Opciones generadas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {generation.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                personaId={persona.id}
                sessionId={session.id}
                writingProviderId={writingProviderId as string}
                writingModel={writingModel as string}
                recentPostsWindow={settings.recentPostsWindow}
                onChanged={generation.refresh}
                onMoreLikeThis={(text) => {
                  setStyleReference(text);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ImagePlus,
  Share2,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
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
        icon={<UserRound className="h-6 w-6" />}
        title="Elegí o creá una persona"
        description="Cada persona tiene su propia voz, memoria, imágenes e historial. Empezá creando una desde la barra lateral."
      />
    );
  }

  if (!session) {
    return (
      <EmptyState
        icon={<ImagePlus className="h-6 w-6" />}
        title={`Creá una sesión para ${persona.displayName || persona.name}`}
        description="Las sesiones agrupan las imágenes y el contexto de un mismo tema, para poder volver después."
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
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      {/* Header: identidad de la persona activa */}
      <header className="flex items-center justify-between gap-4 animate-fade-up">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[oklch(0.45_0.24_292)] text-white shadow-[var(--shadow-glow)]">
            <UserRound className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {persona.displayName || persona.name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <span className="truncate">{session.name}</span>
              {assets.length > 0 ? (
                <Badge variant="outline" className="shrink-0">
                  {assets.length} img
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <Link
          to={`/persona/${persona.id}`}
          className="shrink-0 text-xs font-medium text-[var(--muted-foreground)] underline-offset-4 transition-colors hover:text-[var(--primary)] hover:underline"
        >
          Editar persona
        </Link>
      </header>

      <ImageDropzone sessionId={session.id} />

      <div className="grid gap-5 lg:grid-cols-2 animate-fade-up">
        <Card className="p-4">
          <Label htmlFor="session-context">Contexto de la sesión</Label>
          <Textarea
            id="session-context"
            value={sessionContext}
            onChange={(e) => setSessionContext(e.target.value)}
            placeholder={"Fin de semana en la playa.\nNo mencionar la ubicación."}
            className="min-h-20 bg-[var(--surface)]"
          />
        </Card>

        <Card className="p-4">
          <Label htmlFor="user-context">Indicación para esta generación</Label>
          <Textarea
            id="user-context"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            placeholder="Opcional: ángulo, idea o algo puntual que quieras esta vez."
            className="min-h-20 bg-[var(--surface)]"
          />
        </Card>
      </div>

      {styleReference ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-3.5 py-2.5 animate-fade-in">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Usando como referencia de estilo</p>
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

      <Card className="p-4 animate-fade-up">
              <div className="mb-2.5 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                <Label className="mb-0">Plataformas</Label>
              </div>
        <div className="flex flex-wrap gap-2">
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
                  "cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
                  selected
                    ? "border-[var(--primary)]/40 bg-[var(--primary)]/12 text-[var(--primary)] shadow-[var(--shadow-glow)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)]/40 hover:text-[var(--card-foreground)]",
                )}
              >
                {adapter.displayName}
              </button>
            );
          })}
        </div>
        {platforms.length === 0 ? (
          <p className="mt-2 text-xs font-medium text-[var(--destructive)]">
            Elegí al menos una plataforma.
          </p>
        ) : null}
      </Card>

      {missingProvider ? (
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/8 px-4 py-3 text-sm animate-fade-in">
          <p className="font-semibold">Falta configurar la IA</p>
          <p className="mt-0.5 text-[var(--muted-foreground)]">
            Andá a{" "}
            <Link to="/settings" className="font-medium underline underline-offset-2">
              Ajustes
            </Link>{" "}
            y agregá tu endpoint (URL base, modelo y API key).
          </p>
        </div>
      ) : null}

      {/* CTA principal */}
      <div className="flex items-center gap-3 animate-fade-up">
        <Button
          size="lg"
          className="min-w-56"
          onClick={handleGenerate}
          disabled={!readyToGenerate}
        >
          {generation.isGenerating ? (
            <>
              <Spinner />
              {generation.stageLabel}
              <span className="ml-1 inline-block h-4 w-px bg-white/30" />
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generar 5 opciones
              <ArrowRight className="h-4 w-4 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5" />
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
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold tracking-tight">
              Opciones generadas
            </h2>
            <Badge variant="primary">{generation.options.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {generation.options.map((option, i) => (
              <div
                key={option.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <OptionCard
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
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
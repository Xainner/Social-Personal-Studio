import { useState, type ButtonHTMLAttributes } from "react";
import {
  Archive,
  Check,
  Copy,
  Heart,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  Spinner,
  Textarea,
} from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import { getPlatformAdapter } from "@/platforms/registry";
import {
  replaceVariantText,
  setVariantEditedText,
} from "@/db/repositories/generations";
import {
  useSavePost,
  useSetPostFavorite,
  useSetPostStatus,
} from "@/hooks/use-posts";
import { useRewrite } from "@/hooks/use-generation";
import type { GenerationOption, PlatformId } from "@/types/domain";
import { cn } from "@/utils/cn";

const QUICK_ACTIONS = [
  { label: "Más corto", instruction: "Hacelo mas corto, sin perder la idea." },
  { label: "Más natural", instruction: "Hacelo sonar mas natural y menos escrito." },
  { label: "Más juguetón", instruction: "Subile el tono juguetón." },
  { label: "Más misterioso", instruction: "Hacelo mas misterioso y sugerente." },
  { label: "Más humor", instruction: "Agregale humor sin volverlo chiste facil." },
  { label: "Menos emojis", instruction: "Reduci los emojis al minimo." },
  { label: "Sin hashtags", instruction: "Quita todos los hashtags." },
];

interface OptionCardProps {
  option: GenerationOption;
  personaId: string;
  sessionId: string;
  writingProviderId: string;
  writingModel: string;
  recentPostsWindow: number;
  onChanged: () => void;
  onMoreLikeThis: (text: string) => void;
}

export function OptionCard({
  option,
  personaId,
  sessionId,
  writingProviderId,
  writingModel,
  recentPostsWindow,
  onChanged,
  onMoreLikeThis,
}: OptionCardProps) {
  const platforms = option.variants.map((v) => v.platform);
  const [activePlatform, setActivePlatform] = useState<PlatformId>(
    platforms[0] ?? "x",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const savePost = useSavePost();
  const setStatus = useSetPostStatus();
  const setFavorite = useSetPostFavorite();
  const { rewrite, isRewriting, error: rewriteError } = useRewrite();

  const variant = option.variants.find((v) => v.platform === activePlatform);
  if (!variant) return null;

  const currentText = variant.editedText ?? variant.generatedText;
  const adapter = getPlatformAdapter(activePlatform);
  const validation = adapter.validate(currentText);

  async function handleSaveEdit() {
    if (!variant) return;
    const trimmed = draft.trim();
    // Guardamos la edición aparte: el texto original de la IA no se pisa.
    await setVariantEditedText(variant.id, trimmed || null);
    setIsEditing(false);
    onChanged();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /**
   * Primer clic: guarda la variante como post favorito.
   * Clics siguientes: alterna el favorito del post ya creado, en vez de
   * guardar otra copia identica.
   */
  async function handleSave() {
    if (!variant) return;

    if (savedId) {
      const next = !isFavorite;
      await setFavorite.mutateAsync({ id: savedId, favorite: next });
      setIsFavorite(next);
      return;
    }

    const post = await savePost.mutateAsync({
      personaId,
      sessionId,
      variantId: variant.id,
      platform: activePlatform,
      finalText: currentText,
      providerModel: writingModel,
    });
    await setFavorite.mutateAsync({ id: post.id, favorite: true });
    setSavedId(post.id);
    setIsFavorite(true);
  }

  async function handleMarkUsed() {
    if (!savedId) {
      if (!variant) return;
      const post = await savePost.mutateAsync({
        personaId,
        sessionId,
        variantId: variant.id,
        platform: activePlatform,
        finalText: currentText,
        status: "used",
        providerModel: writingModel,
      });
      setSavedId(post.id);
      return;
    }
    await setStatus.mutateAsync({ id: savedId, status: "used" });
  }

  async function handleQuickAction(instruction: string) {
    if (!variant) return;
    const text = await rewrite({
      variantId: variant.id,
      currentText,
      platform: activePlatform,
      instruction,
      sessionId,
      writingProviderId,
      writingModel,
      recentPostsWindow,
    });
    if (text) {
      await replaceVariantText(variant.id, adapter.normalize(text));
      setShowActions(false);
      onChanged();
    }
  }

  return (
    <Card className="flex h-full flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
      {/* Encabezado: nº de opción + concepto + favorito */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--primary)]/12 text-[11px] font-bold text-[var(--primary)]">
            {option.optionIndex}
          </span>
          <Badge variant="primary" className="max-w-40 truncate">
            {option.concept}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleSave}
          disabled={savePost.isPending || setFavorite.isPending}
          aria-label={isFavorite ? "Quitar de favoritos" : "Guardar como favorito"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite
                ? "fill-[var(--primary)] text-[var(--primary)]"
                : "hover:fill-[var(--primary)]/20",
            )}
          />
        </Button>
      </div>

      {option.reasoningSummary ? (
        <p className="px-4 pt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {option.reasoningSummary}
        </p>
      ) : null}

      {/* Tabs de plataforma */}
      <div className="mt-3 flex gap-1 px-4">
        {option.variants.map((v) => (
          <button
            key={v.platform}
            onClick={() => {
              setActivePlatform(v.platform);
              setIsEditing(false);
            }}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150",
              v.platform === activePlatform
                ? "bg-[var(--surface-2)] text-[var(--card-foreground)] shadow-[var(--shadow-soft)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]",
            )}
          >
            {getPlatformAdapter(v.platform).displayName}
          </button>
        ))}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 pt-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-28 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                <Check className="h-3.5 w-3.5" />
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed">
            {currentText}
          </p>
        )}

        {/* Métricas de validación */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums text-[var(--muted-foreground)]",
              !validation.ok && "font-semibold text-[var(--destructive)]",
            )}
          >
            {validation.length}
            {validation.maxLength ? ` / ${validation.maxLength}` : ""}
          </span>
          {variant.editedText ? <Badge variant="outline">editado</Badge> : null}
          {validation.issues.map((issue, i) => (
            <Badge
              key={i}
              variant={issue.severity === "error" ? "destructive" : "warning"}
            >
              {issue.message}
            </Badge>
          ))}
        </div>

        {showActions ? (
          <div className="space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <RefreshCw className="h-3.5 w-3.5 text-[var(--primary)]" />
                Reescribir
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowActions(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={isRewriting}
                  onClick={() => handleQuickAction(action.instruction)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            {isRewriting ? (
              <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <Spinner />
                Reescribiendo...
              </p>
            ) : null}
            <ErrorMessage error={rewriteError} />
          </div>
        ) : null}

        {/* Barra de acciones */}
        <div className="mt-auto flex flex-wrap gap-0.5 border-t border-[var(--border)] pt-2.5">
          <ActionButton
            onClick={() => {
              setDraft(currentText);
              setIsEditing(true);
            }}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </ActionButton>
          <ActionButton onClick={handleCopy}>
            {copied ? (
              <Check className="h-3 w-3 text-[var(--success)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </ActionButton>
          <ActionButton
            active={showActions}
            onClick={() => setShowActions((v) => !v)}
          >
            <RefreshCw className="h-3 w-3" />
            Reescribir
          </ActionButton>
          <ActionButton onClick={() => onMoreLikeThis(currentText)}>
            <Sparkles className="h-3 w-3" />
            Más como este
          </ActionButton>
          <ActionButton onClick={handleMarkUsed}>
            <Archive className="h-3 w-3" />
            Usado
          </ActionButton>
        </div>

        <ErrorMessage error={savePost.error} />
      </CardContent>
    </Card>
  );
}

function ActionButton({
  children,
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 text-xs", active && "text-[var(--primary)]", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
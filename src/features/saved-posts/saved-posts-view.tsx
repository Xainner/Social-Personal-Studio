import { useState, type ButtonHTMLAttributes } from "react";
import {
  Archive,
  Bookmark,
  Check,
  Copy,
  Heart,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Input,
  Select,
} from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import {
  useDeletePost,
  usePosts,
  useSetPostFavorite,
  useSetPostStatus,
} from "@/hooks/use-posts";
import { getPlatformAdapter } from "@/platforms/registry";
import { useAppStore } from "@/stores/app-store";
import type { PostStatus, SavedPost } from "@/types/domain";
import { cn } from "@/utils/cn";

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Borrador",
  saved: "Guardado",
  used: "Usado",
  archived: "Archivado",
};

const STATUS_BADGE: Record<PostStatus, "default" | "success" | "warning" | "primary"> = {
  draft: "default",
  saved: "primary",
  used: "success",
  archived: "warning",
};

export function SavedPostsView() {
  const activePersonaId = useAppStore((s) => s.activePersonaId);
  const [status, setStatus] = useState<PostStatus | "">("");
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { data: posts = [], isLoading, error } = usePosts({
    personaId: activePersonaId ?? undefined,
    status: status || undefined,
    search: search.trim() || undefined,
    favorite: onlyFavorites || undefined,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-8">
      <header className="flex items-center gap-3.5 animate-fade-up">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[oklch(0.45_0.24_292)] text-white shadow-[var(--shadow-glow)]">
          <Bookmark className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Publicaciones</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {activePersonaId
              ? "De la persona activa."
              : "De todas las personas. Elegi una en la barra lateral para filtrar."}
          </p>
        </div>
        {posts.length > 0 ? (
          <Badge variant="outline" className="ml-auto">
            {posts.length}
          </Badge>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2.5 animate-fade-up">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el texto..."
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as PostStatus | "")}
          className="w-44"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Button
          variant={onlyFavorites ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyFavorites((v) => !v)}
        >
          <Heart className={cn("h-3.5 w-3.5", onlyFavorites && "fill-current")} />
          Favoritos
        </Button>
      </div>

      <ErrorMessage error={error} />

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-6 w-6" />}
          title="No hay publicaciones todavia"
          description="Genera opciones desde la pantalla de creacion y guarda las que te sirvan."
        />
      ) : (
        <ul className="space-y-3">
          {posts.map((post, i) => (
            <li
              key={post.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <PostRow post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostRow({ post }: { post: SavedPost }) {
  const setFavorite = useSetPostFavorite();
  const setStatus = useSetPostStatus();
  const deletePost = useDeletePost();
  const [copied, setCopied] = useState(false);

  const adapter = getPlatformAdapter(post.platform);

  return (
    <Card className="transition-all duration-200 hover:shadow-[var(--shadow-float)]">
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-medium">
            {adapter.displayName}
          </Badge>
          <Badge variant={STATUS_BADGE[post.status]}>
            {STATUS_LABELS[post.status]}
          </Badge>
          {post.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          <span className="ml-auto text-xs tabular-nums text-[var(--muted-foreground)]">
            {new Date(post.createdAt).toLocaleDateString("es-CR")}
          </span>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.finalText}</p>

        <div className="flex flex-wrap gap-0.5 border-t border-[var(--border)] pt-2">
          <RowAction
            onClick={() =>
              setFavorite.mutate({ id: post.id, favorite: !post.favorite })
            }
          >
            <Heart
              className={cn(
                "h-3 w-3 transition-colors",
                post.favorite && "fill-[var(--primary)] text-[var(--primary)]",
              )}
            />
            Favorito
          </RowAction>

          <RowAction
            onClick={async () => {
              await navigator.clipboard.writeText(post.finalText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? (
              <Check className="h-3 w-3 text-[var(--success)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </RowAction>

          {post.status !== "used" ? (
            <RowAction
              onClick={() => setStatus.mutate({ id: post.id, status: "used" })}
            >
              <Check className="h-3 w-3" />
              Marcar usado
            </RowAction>
          ) : null}

          {post.status !== "archived" ? (
            <RowAction
              onClick={() => setStatus.mutate({ id: post.id, status: "archived" })}
            >
              <Archive className="h-3 w-3" />
              Archivar
            </RowAction>
          ) : null}

          <RowAction
            className="text-[var(--destructive)] hover:bg-[var(--destructive)]/12"
            onClick={() => deletePost.mutate(post.id)}
          >
            <Trash2 className="h-3 w-3" />
            Eliminar
          </RowAction>
        </div>
      </CardContent>
    </Card>
  );
}

function RowAction({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 text-xs", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
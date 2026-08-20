import { useState } from "react";
import { Check, Copy, Heart, Search, Trash2 } from "lucide-react";
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
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold">Publicaciones</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {activePersonaId
            ? "De la persona activa."
            : "De todas las personas. Elegi una en la barra lateral para filtrar."}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el texto..."
            className="pl-8"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as PostStatus | "")}
          className="w-40"
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
          title="No hay publicaciones todavia"
          description="Genera opciones desde la pantalla de creacion y guarda las que te sirvan."
        />
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
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
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{adapter.displayName}</Badge>
          <Badge variant={post.status === "used" ? "success" : "default"}>
            {STATUS_LABELS[post.status]}
          </Badge>
          {post.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          <span className="ml-auto text-xs text-[var(--muted-foreground)]">
            {new Date(post.createdAt).toLocaleDateString("es-CR")}
          </span>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.finalText}</p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setFavorite.mutate({ id: post.id, favorite: !post.favorite })}
          >
            <Heart
              className={cn(
                "h-3 w-3",
                post.favorite && "fill-current text-[var(--primary)]",
              )}
            />
            Favorito
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={async () => {
              await navigator.clipboard.writeText(post.finalText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>

          {post.status !== "used" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setStatus.mutate({ id: post.id, status: "used" })}
            >
              Marcar usado
            </Button>
          ) : null}

          {post.status !== "archived" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setStatus.mutate({ id: post.id, status: "archived" })}
            >
              Archivar
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[var(--destructive)]"
            onClick={() => deletePost.mutate(post.id)}
          >
            <Trash2 className="h-3 w-3" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { ErrorMessage } from "@/components/error-message";
import { useAssetUsage, useAssets } from "@/hooks/use-assets";
import type { Asset } from "@/types/domain";

export function MediaView() {
  const { data: assets = [], isLoading, error } = useAssets();
  const [selected, setSelected] = useState<Asset | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center gap-3.5 animate-fade-up">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[oklch(0.45_0.24_292)] text-white shadow-[var(--shadow-glow)]">
          <Images className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Imagenes</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Todas las imagenes importadas. Se reutilizan entre sesiones.
          </p>
        </div>
        {assets.length > 0 ? (
          <Badge variant="outline" className="ml-auto">
            {assets.length}
          </Badge>
        ) : null}
      </header>

      <ErrorMessage error={error} />

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Images className="h-6 w-6" />}
          title="Todavia no hay imagenes"
          description="Subi imagenes desde una sesion en la pantalla de creacion."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
          {assets.map((asset, i) => (
            <button
              key={asset.id}
              onClick={() => setSelected(asset)}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-all duration-200 animate-fade-up hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:shadow-[var(--shadow-float)]"
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <img
                src={convertFileSrc(asset.thumbnailPath ?? asset.filePath)}
                alt={asset.aiDescription ?? ""}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {asset.aiDescription ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 text-left text-[11px] leading-snug text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {asset.aiDescription}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      <AssetDetailDialog asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AssetDetailDialog({
  asset,
  onClose,
}: {
  asset: Asset | null;
  onClose: () => void;
}) {
  const { data: usage } = useAssetUsage(asset?.id ?? null);

  if (!asset) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Detalle de la imagen"
      className="max-w-2xl"
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <img
          src={convertFileSrc(asset.filePath)}
          alt=""
          className="max-h-80 w-full rounded-xl border border-[var(--border)] object-contain"
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Dimensiones
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] tabular-nums">
              {asset.width && asset.height
                ? `${asset.width} x ${asset.height}`
                : "Desconocidas"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Tamano
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] tabular-nums">
              {(asset.size / 1024).toFixed(0)} KB
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Importada
            </dt>
            <dd className="mt-0.5 text-[13px]">
              {new Date(asset.createdAt).toLocaleDateString("es-CR")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Tipo
            </dt>
            <dd className="mt-0.5 font-mono text-[13px]">{asset.mimeType}</dd>
          </div>
        </dl>

        {asset.aiDescription ? (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Lectura de la IA
            </p>
            <p className="text-sm leading-relaxed">{asset.aiDescription}</p>
          </div>
        ) : null}

        {usage ? (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Esta imagen se uso en
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{usage.generations} generaciones</Badge>
              <Badge>{usage.savedPosts} posts guardados</Badge>
              <Badge variant="success">{usage.usedPosts} publicados</Badge>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
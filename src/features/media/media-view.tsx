import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
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
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold">Imagenes</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Todas las imagenes importadas. Se reutilizan entre sesiones.
        </p>
      </header>

      <ErrorMessage error={error} />

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
      ) : assets.length === 0 ? (
        <EmptyState
          title="Todavia no hay imagenes"
          description="Subi imagenes desde una sesion en la pantalla de creacion."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => setSelected(asset)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] transition-opacity hover:opacity-90"
            >
              <img
                src={convertFileSrc(asset.thumbnailPath ?? asset.filePath)}
                alt={asset.aiDescription ?? ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
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
          className="max-h-80 w-full rounded-md object-contain"
        />

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">Dimensiones</dt>
            <dd>
              {asset.width && asset.height
                ? `${asset.width} x ${asset.height}`
                : "Desconocidas"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">Tamano</dt>
            <dd>{(asset.size / 1024).toFixed(0)} KB</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">Importada</dt>
            <dd>{new Date(asset.createdAt).toLocaleDateString("es-CR")}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">Tipo</dt>
            <dd>{asset.mimeType}</dd>
          </div>
        </dl>

        {asset.aiDescription ? (
          <div>
            <p className="mb-1 text-xs text-[var(--muted-foreground)]">
              Lectura de la IA
            </p>
            <p className="text-sm">{asset.aiDescription}</p>
          </div>
        ) : null}

        {usage ? (
          <div>
            <p className="mb-1.5 text-xs text-[var(--muted-foreground)]">
              Esta imagen se uso en
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge>{usage.generations} generaciones</Badge>
              <Badge>{usage.savedPosts} posts guardados</Badge>
              <Badge variant="success">{usage.usedPosts} publicados</Badge>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

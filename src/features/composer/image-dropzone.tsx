import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/error-message";
import { Spinner } from "@/components/ui/primitives";
import { useImportAssets, useSessionAssets, useUnlinkAsset } from "@/hooks/use-assets";
import { cn } from "@/utils/cn";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

export function ImageDropzone({ sessionId }: { sessionId: string }) {
  const { data: assets = [] } = useSessionAssets(sessionId);
  const importAssets = useImportAssets(sessionId);
  const unlinkAsset = useUnlinkAsset(sessionId);
  const [isDragging, setIsDragging] = useState(false);

  async function pickFiles() {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Imagenes", extensions: IMAGE_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await importAssets.mutateAsync(paths);
  }

  return (
    <div className="space-y-3 animate-fade-up">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-9 transition-all duration-200",
          isDragging
            ? "border-[var(--primary)] bg-[var(--primary)]/8 shadow-[var(--shadow-glow)]"
            : "border-[var(--border)] bg-[var(--surface)]/40 hover:border-[var(--muted-foreground)]/40",
        )}
      >
        {importAssets.isPending ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Spinner />
            Importando imagenes...
          </div>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <ImagePlus className="h-5 w-5" />
            </span>
            <p className="text-sm text-[var(--muted-foreground)]">
              Arrastra imagenes aca
            </p>
            <Button variant="outline" size="sm" onClick={pickFiles}>
              Elegir archivos
            </Button>
          </>
        )}
      </div>

      <ErrorMessage error={importAssets.error} />

      {assets.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] transition-all duration-200 hover:border-[var(--primary)]/40 hover:shadow-[var(--shadow-soft)]"
            >
              <img
                src={convertFileSrc(asset.thumbnailPath ?? asset.filePath)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <button
                onClick={() => unlinkAsset.mutate(asset.id)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                aria-label="Quitar de la sesion"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
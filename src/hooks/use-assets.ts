import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import * as repo from "@/db/repositories/assets";
import { appError } from "@/types/errors";

interface ImportedAsset {
  file_path: string;
  thumbnail_path: string;
  file_hash: string;
  mime_type: string;
  width: number;
  height: number;
  size: number;
  deduplicated: boolean;
}

const KEYS = {
  all: ["assets"] as const,
  session: (id: string) => ["assets", "session", id] as const,
  usage: (id: string) => ["assets", id, "usage"] as const,
};

export function useAssets() {
  return useQuery({ queryKey: KEYS.all, queryFn: repo.listAssets });
}

export function useSessionAssets(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.session(sessionId ?? ""),
    queryFn: () => repo.listSessionAssets(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useAssetUsage(assetId: string | null) {
  return useQuery({
    queryKey: KEYS.usage(assetId ?? ""),
    queryFn: () => repo.getAssetUsage(assetId as string),
    enabled: Boolean(assetId),
  });
}

/**
 * Copia las imágenes al almacén local (hash + miniatura en Rust),
 * las registra en la base y las asocia a la sesión.
 */
export function useImportAssets(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paths: string[]) => {
      const imported = [];
      for (const path of paths) {
        let result: ImportedAsset;
        try {
          result = await invoke<ImportedAsset>("import_asset", { sourcePath: path });
        } catch (cause) {
          throw appError("invalid_image", cause);
        }

        const asset = await repo.upsertAsset({
          filePath: result.file_path,
          thumbnailPath: result.thumbnail_path,
          fileHash: result.file_hash,
          mimeType: result.mime_type,
          width: result.width,
          height: result.height,
          size: result.size,
          aiDescription: null,
        });
        await repo.linkAssetToSession(sessionId, asset.id);
        imported.push(asset);
      }
      return imported;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUnlinkAsset(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => repo.unlinkAssetFromSession(sessionId, assetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.session(sessionId) }),
  });
}

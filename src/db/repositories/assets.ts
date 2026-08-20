import { execute, newId, nowIso, query, queryOne } from "@/db/client";
import type { Asset, AssetUsage } from "@/types/domain";

interface AssetRow {
  id: string;
  file_path: string;
  thumbnail_path: string | null;
  file_hash: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  size: number;
  ai_description: string | null;
  created_at: string;
}

function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    fileHash: row.file_hash,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    size: row.size,
    aiDescription: row.ai_description,
    createdAt: row.created_at,
  };
}

export type AssetInput = Omit<Asset, "id" | "createdAt">;

export async function listAssets(): Promise<Asset[]> {
  const rows = await query<AssetRow>("SELECT * FROM assets ORDER BY created_at DESC");
  return rows.map(mapAsset);
}

export async function getAssetByHash(hash: string): Promise<Asset | null> {
  const row = await queryOne<AssetRow>("SELECT * FROM assets WHERE file_hash = $1", [hash]);
  return row ? mapAsset(row) : null;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const row = await queryOne<AssetRow>("SELECT * FROM assets WHERE id = $1", [id]);
  return row ? mapAsset(row) : null;
}

/** Inserta el asset, o devuelve el existente si el hash ya está registrado. */
export async function upsertAsset(input: AssetInput): Promise<Asset> {
  const existing = await getAssetByHash(input.fileHash);
  if (existing) return existing;

  const id = newId();
  const ts = nowIso();
  await execute(
    `INSERT INTO assets
       (id, file_path, thumbnail_path, file_hash, mime_type, width, height, size, ai_description, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.filePath,
      input.thumbnailPath,
      input.fileHash,
      input.mimeType,
      input.width,
      input.height,
      input.size,
      input.aiDescription,
      ts,
    ],
  );
  return { ...input, id, createdAt: ts };
}

export async function setAssetDescription(
  id: string,
  description: string,
): Promise<void> {
  await execute("UPDATE assets SET ai_description = $1 WHERE id = $2", [description, id]);
}

export async function listSessionAssets(sessionId: string): Promise<Asset[]> {
  const rows = await query<AssetRow>(
    `SELECT a.* FROM assets a
     JOIN session_assets sa ON sa.asset_id = a.id
     WHERE sa.session_id = $1
     ORDER BY a.created_at DESC`,
    [sessionId],
  );
  return rows.map(mapAsset);
}

export async function linkAssetToSession(
  sessionId: string,
  assetId: string,
): Promise<void> {
  await execute(
    "INSERT OR IGNORE INTO session_assets (session_id, asset_id) VALUES ($1,$2)",
    [sessionId, assetId],
  );
}

export async function unlinkAssetFromSession(
  sessionId: string,
  assetId: string,
): Promise<void> {
  await execute(
    "DELETE FROM session_assets WHERE session_id = $1 AND asset_id = $2",
    [sessionId, assetId],
  );
}

/** Cuántas veces se usó una imagen: generaciones, posts guardados y publicados. */
export async function getAssetUsage(assetId: string): Promise<AssetUsage> {
  const [gen] = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM generation_request_assets WHERE asset_id = $1",
    [assetId],
  );
  const [saved] = await query<{ n: number }>(
    `SELECT COUNT(DISTINCT sp.id) AS n
     FROM saved_posts sp
     JOIN platform_variants pv ON pv.id = sp.variant_id
     JOIN generation_options go ON go.id = pv.option_id
     JOIN generations g ON g.id = go.generation_id
     JOIN generation_request_assets gra ON gra.request_id = g.request_id
     WHERE gra.asset_id = $1`,
    [assetId],
  );
  const [used] = await query<{ n: number }>(
    `SELECT COUNT(DISTINCT sp.id) AS n
     FROM saved_posts sp
     JOIN platform_variants pv ON pv.id = sp.variant_id
     JOIN generation_options go ON go.id = pv.option_id
     JOIN generations g ON g.id = go.generation_id
     JOIN generation_request_assets gra ON gra.request_id = g.request_id
     WHERE gra.asset_id = $1 AND sp.status = 'used'`,
    [assetId],
  );
  return {
    generations: gen?.n ?? 0,
    savedPosts: saved?.n ?? 0,
    usedPosts: used?.n ?? 0,
  };
}

export async function deleteAsset(id: string): Promise<void> {
  await execute("DELETE FROM assets WHERE id = $1", [id]);
}

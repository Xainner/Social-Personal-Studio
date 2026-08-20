import { execute, fromBool, newId, nowIso, query, queryOne, toBool } from "@/db/client";
import type { PlatformId, PostStatus, SavedPost } from "@/types/domain";

/**
 * Separador usado por GROUP_CONCAT para juntar tags.
 * Es el caracter de control "unit separator": no puede aparecer dentro de un tag,
 * a diferencia de una coma.
 */
const TAG_SEPARATOR = "";

interface SavedPostRow {
  id: string;
  persona_id: string;
  session_id: string | null;
  variant_id: string | null;
  platform: string;
  final_text: string;
  status: string;
  favorite: number;
  used_at: string | null;
  notes: string;
  provider_model: string;
  created_at: string;
  tags: string | null;
}

function mapPost(row: SavedPostRow): SavedPost {
  return {
    id: row.id,
    personaId: row.persona_id,
    sessionId: row.session_id,
    variantId: row.variant_id,
    platform: row.platform as PlatformId,
    finalText: row.final_text,
    status: row.status as PostStatus,
    favorite: toBool(row.favorite),
    usedAt: row.used_at,
    notes: row.notes,
    providerModel: row.provider_model,
    createdAt: row.created_at,
    tags: row.tags ? row.tags.split(TAG_SEPARATOR).filter(Boolean) : [],
  };
}

const SELECT_WITH_TAGS = `
  SELECT sp.*, GROUP_CONCAT(pt.name, char(31)) AS tags
  FROM saved_posts sp
  LEFT JOIN saved_post_tags spt ON spt.post_id = sp.id
  LEFT JOIN post_tags pt ON pt.id = spt.tag_id
`;

export interface SavePostInput {
  personaId: string;
  sessionId: string | null;
  variantId: string | null;
  platform: PlatformId;
  finalText: string;
  status?: PostStatus;
  providerModel?: string;
}

export async function savePost(input: SavePostInput): Promise<SavedPost> {
  const id = newId();
  const ts = nowIso();
  const status = input.status ?? "saved";
  await execute(
    `INSERT INTO saved_posts
       (id, persona_id, session_id, variant_id, platform, final_text, status,
        favorite, used_at, notes, provider_model, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,NULL,'',$8,$9)`,
    [
      id,
      input.personaId,
      input.sessionId,
      input.variantId,
      input.platform,
      input.finalText,
      status,
      input.providerModel ?? "",
      ts,
    ],
  );
  return {
    id,
    personaId: input.personaId,
    sessionId: input.sessionId,
    variantId: input.variantId,
    platform: input.platform,
    finalText: input.finalText,
    status,
    favorite: false,
    usedAt: null,
    notes: "",
    providerModel: input.providerModel ?? "",
    createdAt: ts,
    tags: [],
  };
}

export interface PostFilter {
  personaId?: string;
  status?: PostStatus;
  platform?: PlatformId;
  favorite?: boolean;
  search?: string;
}

export async function listPosts(filter: PostFilter = {}): Promise<SavedPost[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.personaId) {
    params.push(filter.personaId);
    clauses.push(`sp.persona_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`sp.status = $${params.length}`);
  }
  if (filter.platform) {
    params.push(filter.platform);
    clauses.push(`sp.platform = $${params.length}`);
  }
  if (filter.favorite) {
    clauses.push("sp.favorite = 1");
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    clauses.push(`sp.final_text LIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query<SavedPostRow>(
    `${SELECT_WITH_TAGS} ${where} GROUP BY sp.id ORDER BY sp.created_at DESC`,
    params,
  );
  return rows.map(mapPost);
}

export async function getPost(id: string): Promise<SavedPost | null> {
  const row = await queryOne<SavedPostRow>(
    `${SELECT_WITH_TAGS} WHERE sp.id = $1 GROUP BY sp.id`,
    [id],
  );
  return row ? mapPost(row) : null;
}

/**
 * Posts recientes para el contexto anti-repeticion.
 * Solo los que el usuario realmente adopto (guardados o usados).
 */
export async function listRecentForAntiRepetition(
  personaId: string,
  limit: number,
): Promise<SavedPost[]> {
  const rows = await query<SavedPostRow>(
    `${SELECT_WITH_TAGS}
     WHERE sp.persona_id = $1 AND sp.status IN ('saved','used')
     GROUP BY sp.id
     ORDER BY COALESCE(sp.used_at, sp.created_at) DESC
     LIMIT $2`,
    [personaId, limit],
  );
  return rows.map(mapPost);
}

export async function updatePostText(id: string, finalText: string): Promise<void> {
  await execute("UPDATE saved_posts SET final_text = $1 WHERE id = $2", [finalText, id]);
}

export async function setPostStatus(id: string, status: PostStatus): Promise<void> {
  const usedAt = status === "used" ? nowIso() : null;
  await execute(
    "UPDATE saved_posts SET status = $1, used_at = COALESCE($2, used_at) WHERE id = $3",
    [status, usedAt, id],
  );
}

export async function setPostFavorite(id: string, favorite: boolean): Promise<void> {
  await execute("UPDATE saved_posts SET favorite = $1 WHERE id = $2", [
    fromBool(favorite),
    id,
  ]);
}

export async function setPostNotes(id: string, notes: string): Promise<void> {
  await execute("UPDATE saved_posts SET notes = $1 WHERE id = $2", [notes, id]);
}

export async function deletePost(id: string): Promise<void> {
  await execute("DELETE FROM saved_posts WHERE id = $1", [id]);
}

// ---------- Tags ----------

export async function addTagToPost(postId: string, tagName: string): Promise<void> {
  const normalized = tagName.trim().toLowerCase();
  if (!normalized) return;

  let tag = await queryOne<{ id: string }>("SELECT id FROM post_tags WHERE name = $1", [
    normalized,
  ]);
  if (!tag) {
    const id = newId();
    await execute("INSERT INTO post_tags (id, name) VALUES ($1,$2)", [id, normalized]);
    tag = { id };
  }
  await execute(
    "INSERT OR IGNORE INTO saved_post_tags (post_id, tag_id) VALUES ($1,$2)",
    [postId, tag.id],
  );
}

export async function removeTagFromPost(postId: string, tagName: string): Promise<void> {
  await execute(
    `DELETE FROM saved_post_tags
     WHERE post_id = $1
       AND tag_id IN (SELECT id FROM post_tags WHERE name = $2)`,
    [postId, tagName.trim().toLowerCase()],
  );
}

export async function listAllTags(): Promise<string[]> {
  const rows = await query<{ name: string }>("SELECT name FROM post_tags ORDER BY name");
  return rows.map((r) => r.name);
}

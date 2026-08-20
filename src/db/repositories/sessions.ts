import { execute, newId, nowIso, query, queryOne } from "@/db/client";
import type { Session } from "@/types/domain";

interface SessionRow {
  id: string;
  persona_id: string;
  name: string;
  context: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    personaId: row.persona_id,
    name: row.name,
    context: row.context,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSessions(personaId: string): Promise<Session[]> {
  const rows = await query<SessionRow>(
    "SELECT * FROM sessions WHERE persona_id = $1 ORDER BY updated_at DESC",
    [personaId],
  );
  return rows.map(mapSession);
}

export async function getSession(id: string): Promise<Session | null> {
  const row = await queryOne<SessionRow>("SELECT * FROM sessions WHERE id = $1", [id]);
  return row ? mapSession(row) : null;
}

export async function createSession(
  personaId: string,
  name: string,
  context = "",
): Promise<Session> {
  const id = newId();
  const ts = nowIso();
  await execute(
    `INSERT INTO sessions (id, persona_id, name, context, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'',$5,$6)`,
    [id, personaId, name, context, ts, ts],
  );
  return {
    id,
    personaId,
    name,
    context,
    notes: "",
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updateSession(
  id: string,
  values: Partial<Pick<Session, "name" | "context" | "notes">>,
): Promise<void> {
  const current = await getSession(id);
  if (!current) return;
  await execute(
    "UPDATE sessions SET name = $1, context = $2, notes = $3, updated_at = $4 WHERE id = $5",
    [
      values.name ?? current.name,
      values.context ?? current.context,
      values.notes ?? current.notes,
      nowIso(),
      id,
    ],
  );
}

export async function touchSession(id: string): Promise<void> {
  await execute("UPDATE sessions SET updated_at = $1 WHERE id = $2", [nowIso(), id]);
}

export async function deleteSession(id: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE id = $1", [id]);
}

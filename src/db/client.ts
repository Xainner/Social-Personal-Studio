import Database from "@tauri-apps/plugin-sql";
import { appError } from "@/types/errors";

const DB_URL = "sqlite:social-persona-studio.db";

let instance: Database | null = null;
let pending: Promise<Database> | null = null;

/**
 * Conexión única a SQLite. Las migraciones las ejecuta el plugin de Rust
 * al cargar la base por primera vez.
 */
export async function getDb(): Promise<Database> {
  if (instance) return instance;
  if (!pending) {
    pending = Database.load(DB_URL)
      .then((db) => {
        instance = db;
        return db;
      })
      .catch((cause) => {
        pending = null;
        throw appError("database_error", cause);
      });
  }
  return pending;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  try {
    return await db.select<T[]>(sql, params);
  } catch (cause) {
    throw appError("database_error", cause);
  }
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  try {
    await db.execute(sql, params);
  } catch (cause) {
    throw appError("database_error", cause);
  }
}

export async function queryOne<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** SQLite guarda booleanos como 0/1. */
export function toBool(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1;
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

/** Parsea JSON de una columna TEXT, cayendo a un valor por defecto si está corrupta. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

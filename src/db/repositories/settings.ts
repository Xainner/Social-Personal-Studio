import { execute, parseJson, query } from "@/db/client";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/types/domain";

export async function loadSettings(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings",
  );
  const stored: Partial<AppSettings> = {};
  for (const row of rows) {
    (stored as Record<string, unknown>)[row.key] = parseJson<unknown>(row.value, null);
  }
  return { ...DEFAULT_APP_SETTINGS, ...stored };
}

export async function saveSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await execute(
    `INSERT INTO app_settings (key, value) VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}

export async function saveSettings(values: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await saveSetting(key as keyof AppSettings, value as never);
  }
}

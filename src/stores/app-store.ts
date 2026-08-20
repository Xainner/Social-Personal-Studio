import { create } from "zustand";
import type { AppSettings, PlatformId } from "@/types/domain";
import { DEFAULT_APP_SETTINGS } from "@/types/domain";
import { loadSettings, saveSettings } from "@/db/repositories/settings";

interface AppState {
  settings: AppSettings;
  settingsLoaded: boolean;

  activePersonaId: string | null;
  activeSessionId: string | null;

  loadSettingsFromDb: () => Promise<void>;
  updateSettings: (values: Partial<AppSettings>) => Promise<void>;
  setActivePersona: (id: string | null) => void;
  setActiveSession: (id: string | null) => void;
}

function applyTheme(theme: AppSettings["theme"]): void {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  settingsLoaded: false,
  activePersonaId: null,
  activeSessionId: null,

  loadSettingsFromDb: async () => {
    const settings = await loadSettings();
    applyTheme(settings.theme);
    set({
      settings,
      settingsLoaded: true,
      activePersonaId: get().activePersonaId ?? settings.defaultPersonaId,
    });
  },

  updateSettings: async (values) => {
    const next = { ...get().settings, ...values };
    set({ settings: next });
    if (values.theme) applyTheme(values.theme);
    await saveSettings(values);
  },

  setActivePersona: (id) => set({ activePersonaId: id, activeSessionId: null }),
  setActiveSession: (id) => set({ activeSessionId: id }),
}));

/** Plataformas efectivas: las de la persona, o las de los ajustes globales. */
export function resolvePlatforms(
  personaDefaults: PlatformId[] | undefined,
  settings: AppSettings,
): PlatformId[] {
  if (personaDefaults?.length) return personaDefaults;
  return settings.defaultPlatforms;
}

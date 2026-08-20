import type { PlatformAdapter } from "@/platforms/types";
import { telegramAdapter } from "@/platforms/telegram";
import { xAdapter } from "@/platforms/x";
import type { PlatformId } from "@/types/domain";

/**
 * Registro central de plataformas.
 * Agregar Instagram, Threads o Bluesky en el futuro es sumar una entrada aca:
 * el resto de la app no cambia.
 */
const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  x: xAdapter,
  telegram: telegramAdapter,
};

export function getPlatformAdapter(id: PlatformId): PlatformAdapter {
  return ADAPTERS[id];
}

export function listPlatformAdapters(): PlatformAdapter[] {
  return Object.values(ADAPTERS);
}

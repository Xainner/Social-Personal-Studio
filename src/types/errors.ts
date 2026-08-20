/**
 * Errores tipados de la aplicación.
 * Cada variante existe para que la UI pueda mostrar un mensaje accionable
 * en lugar de un genérico "algo salió mal".
 */

export type AppErrorCode =
  | "no_provider_configured"
  | "invalid_api_key"
  | "provider_unavailable"
  | "rate_limited"
  | "model_unavailable"
  | "vision_unsupported"
  | "invalid_image"
  | "malformed_ai_json"
  | "generation_timeout"
  | "database_error"
  | "missing_local_asset"
  | "validation_failed"
  | "unknown";

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Qué puede hacer el usuario para resolverlo. */
  readonly action: string;
  readonly cause?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    action: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.action = action;
    this.cause = cause;
  }
}

const MESSAGES: Record<AppErrorCode, { message: string; action: string }> = {
  no_provider_configured: {
    message: "No hay ningún proveedor de IA configurado.",
    action: "Andá a Ajustes → Proveedores y agregá tu endpoint (URL, modelo y API key).",
  },
  invalid_api_key: {
    message: "El proveedor rechazó la API key.",
    action: "Revisá la API key en Ajustes → Proveedores y probá la conexión de nuevo.",
  },
  provider_unavailable: {
    message: "No se pudo contactar al proveedor de IA.",
    action: "Verificá que el servidor esté encendido y que la URL base sea correcta.",
  },
  rate_limited: {
    message: "El proveedor está limitando la cantidad de solicitudes.",
    action: "Esperá unos minutos antes de volver a generar.",
  },
  model_unavailable: {
    message: "El modelo configurado no está disponible en este proveedor.",
    action: "Elegí otro modelo en Ajustes → Proveedores.",
  },
  vision_unsupported: {
    message: "El modelo configurado no puede analizar imágenes.",
    action:
      "Configurá un modelo con visión en Ajustes → Proveedores, o generá sin imágenes.",
  },
  invalid_image: {
    message: "Una de las imágenes no se pudo leer.",
    action: "Probá con otra imagen en formato JPG, PNG o WebP.",
  },
  malformed_ai_json: {
    message: "La IA devolvió una respuesta que no se pudo interpretar.",
    action: "Volvé a generar. Si sigue fallando, probá con otro modelo.",
  },
  generation_timeout: {
    message: "La generación tardó más de lo permitido.",
    action:
      "Aumentá el tiempo de espera del proveedor en Ajustes, o usá un modelo más rápido.",
  },
  database_error: {
    message: "Ocurrió un error al acceder a la base de datos local.",
    action: "Reiniciá la aplicación. Si persiste, restaurá el último respaldo.",
  },
  missing_local_asset: {
    message: "No se encontró el archivo de una imagen.",
    action: "La imagen fue movida o borrada del disco. Volvé a subirla.",
  },
  validation_failed: {
    message: "La respuesta de la IA no cumplió el formato esperado.",
    action: "Volvé a generar. Si persiste, probá con otro modelo.",
  },
  unknown: {
    message: "Ocurrió un error inesperado.",
    action: "Volvé a intentar. Activá el modo debug en Ajustes para más detalle.",
  },
};

export function appError(code: AppErrorCode, cause?: unknown): AppError {
  const { message, action } = MESSAGES[code];
  return new AppError(code, message, action, cause);
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Convierte cualquier valor lanzado en un AppError con mensaje accionable. */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  const err = appError("unknown", value);
  if (value instanceof Error && value.message) {
    return new AppError("unknown", value.message, err.action, value);
  }
  return err;
}

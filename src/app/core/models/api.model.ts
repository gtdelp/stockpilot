/** Error homogéneo devuelto por la API. */
export interface ApiError {
  /** Código estable (p. ej. `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`). */
  code: string;
  /** Mensaje legible en español. */
  message: string;
  /** Código HTTP. */
  status: number;
}

/** Respuesta de comprobación de disponibilidad. */
export interface AvailabilityResponse {
  /** `true` si el valor está libre. */
  available: boolean;
}

/** Convierte cualquier error en un `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN', message: error.message, status: 0 };
  }
  return { code: 'UNKNOWN', message: 'Se ha producido un error inesperado.', status: 0 };
}

/** Comprueba si un valor tiene forma de `ApiError`. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'status' in value
  );
}

import type { IncomingMessage, ServerResponse } from 'node:http';

/** Error HTTP con código estable y mensaje en español. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Atajos para los errores más comunes. */
export const errors = {
  badRequest: (message = 'Datos no válidos.') => new HttpError(400, 'VALIDATION', message),
  unauthenticated: () => new HttpError(401, 'UNAUTHENTICATED', 'Sesión no válida o caducada.'),
  forbidden: () => new HttpError(403, 'FORBIDDEN', 'No tienes permisos para esta operación.'),
  notFound: (message = 'Recurso no encontrado.') => new HttpError(404, 'NOT_FOUND', message),
  conflict: (code: string, message: string) => new HttpError(409, code, message),
  tooManyRequests: () =>
    new HttpError(429, 'RATE_LIMITED', 'Demasiadas peticiones. Inténtalo en un minuto.'),
};

/** Petición de una función serverless (Vercel añade `query` y `body`). */
export interface ApiRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** Lee y parsea el cuerpo JSON si el entorno no lo ha hecho ya. */
export async function readJsonBody(req: ApiRequest): Promise<unknown> {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? safeParse(req.body) : req.body;
  }
  if (req.method === 'GET' || req.method === 'DELETE') {
    return undefined;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 100_000) {
      throw errors.badRequest('El cuerpo de la petición es demasiado grande.');
    }
    chunks.push(chunk as Buffer);
  }
  return chunks.length ? safeParse(Buffer.concat(chunks).toString('utf8')) : undefined;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw errors.badRequest('JSON mal formado.');
  }
}

/** Envía una respuesta JSON sin caché. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

/**
 * Limitador de peticiones en memoria (por instancia), suficiente para frenar
 * abusos en los endpoints públicos (registro y comprobación de correo).
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Lanza 429 si la clave supera el límite en la ventana actual. */
  check(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count++;
    if (entry.count > this.limit) {
      throw errors.tooManyRequests();
    }
  }
}

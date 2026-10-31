import type { ServerResponse } from 'node:http';
import { createApp } from './_lib/app.js';
import { createNeonDb } from './_lib/db.js';
import { firebaseIdentity, firestoreRealtime } from './_lib/firebase.js';
import { type ApiRequest, HttpError, readJsonBody, sendJson } from './_lib/http.js';

/**
 * Función serverless única de la API REST (Vercel).
 * `vercel.json` reescribe `/api/<ruta>` a `/api/router?path=<ruta>`, de modo que
 * toda la API cabe en una sola función (límite del plan gratuito) con un router propio.
 */
const app = createApp({
  openDb: () => {
    const url = process.env['DATABASE_URL'];
    if (!url) {
      throw new HttpError(500, 'CONFIG', 'Falta la configuración del servidor (DATABASE_URL).');
    }
    return createNeonDb(url);
  },
  identity: firebaseIdentity,
  realtime: firestoreRealtime,
});

export default async function handler(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const query: Record<string, string | undefined> = {};
    url.searchParams.forEach((value, key) => (query[key] = value));
    for (const [key, value] of Object.entries(req.query ?? {})) {
      query[key] = Array.isArray(value) ? value[0] : value;
    }
    const path =
      '/' + String(query['path'] ?? url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+/, '');
    delete query['path'];
    const forwarded = req.headers['x-forwarded-for'];
    const response = await app({
      method: req.method ?? 'GET',
      path,
      query,
      body: await readJsonBody(req),
      authorization: req.headers.authorization,
      clientIp: (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim(),
    });
    sendJson(res, response.status, response.body);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { code: error.code, message: error.message });
      return;
    }
    console.error(error);
    sendJson(res, 500, { code: 'INTERNAL', message: 'Error interno del servidor.' });
  }
}

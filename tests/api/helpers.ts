import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createApp, type AppRequest } from '../../api/_lib/app';
import type { Db, Queryable } from '../../api/_lib/db';
import type { IdentityService, RealtimeService } from '../../api/_lib/services';

/** Adaptador de PGlite (PostgreSQL en WebAssembly) a la interfaz `Db`. */
function wrap(pg: PGlite): Db {
  const queryable = (target: { query: PGlite['query'] }): Queryable => ({
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      return (await target.query<T>(text, params)).rows;
    },
  });
  return {
    ...queryable(pg),
    transaction: (fn) => pg.transaction((tx) => fn(queryable(tx))),
    close: async () => undefined,
  };
}

/** Crea una API de prueba con base de datos efímera y servicios simulados. */
export async function createTestApi() {
  const pg = new PGlite();
  await pg.exec(readFileSync('db/schema.sql', 'utf8'));
  const db = wrap(pg);
  const tokens = new Map<string, string>();
  const events: { type: string; message: string }[] = [];
  const notifications: { uid: string; title: string }[] = [];
  const roles = new Map<string, string>();

  const identity: IdentityService = {
    async verifyToken(token) {
      const uid = tokens.get(token);
      if (!uid) {
        throw new Error('token inválido');
      }
      return { uid, email: '' };
    },
    async createAccount(email) {
      const uid = `uid-${email}`;
      tokens.set(`token-${uid}`, uid);
      return uid;
    },
    async deleteAccount() {
      return undefined;
    },
    async setRole(uid, role) {
      roles.set(uid, role);
    },
  };
  const realtime: RealtimeService = {
    async publishActivity(type, message) {
      events.push({ type, message });
    },
    async notify(uid, title) {
      notifications.push({ uid, title });
    },
  };

  const handle = createApp({
    openDb: async () => db,
    identity,
    realtime,
    logError: () => undefined,
  });

  /** Ejecuta una petición con el token del usuario indicado. */
  const call = (
    method: string,
    path: string,
    options: { as?: string; body?: unknown; query?: Record<string, string> } = {},
  ) =>
    handle({
      method,
      path,
      query: options.query ?? {},
      body: options.body,
      authorization: options.as ? `Bearer token-${options.as}` : undefined,
      clientIp: '127.0.0.1',
    } satisfies AppRequest);

  // Datos base: un administrador, dos usuarios, catálogo mínimo
  await db.query(`INSERT INTO users (id, email, full_name, role) VALUES
    ('admin', 'admin@example.com', 'Admin Pruebas', 'admin'),
    ('ana', 'ana@example.com', 'Ana Pruebas', 'user'),
    ('luis', 'luis@example.com', 'Luis Pruebas', 'user')`);
  for (const uid of ['admin', 'ana', 'luis', 'ghost']) {
    tokens.set(`token-${uid}`, uid);
  }
  await db.query(`INSERT INTO categories (name) VALUES ('Electrónica'), ('Oficina')`);
  await db.query(`INSERT INTO suppliers (name, email) VALUES ('Proveedor Uno', 'uno@example.com')`);
  await db.query(`INSERT INTO products (sku, name, category_id, supplier_id, price, stock, min_stock) VALUES
    ('ELE-0001', 'Auriculares', 1, 1, 50.00, 10, 3),
    ('OFI-0001', 'Folios', 2, 1, 4.50, 100, 10)`);

  return { call, db, events, notifications, roles };
}

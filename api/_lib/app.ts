import type { Db } from './db.js';
import { HttpError, RateLimiter, errors } from './http.js';
import {
  type OrderStatus,
  type UserRow,
  STATUS_LABELS,
  catalogRepo,
  ordersRepo,
  productsRepo,
  statsRepo,
  usersRepo,
} from './repositories.js';
import { parse, schemas } from './schemas.js';
import type { IdentityService, RealtimeService } from './services.js';

/** Dependencias inyectables (permiten probar la API con una base de datos en memoria). */
export interface AppDeps {
  /** Abre una conexión a la base de datos para la petición. */
  openDb: () => Promise<Db>;
  identity: IdentityService;
  realtime: RealtimeService;
  /** Registro de errores (por defecto, `console.error` en el servidor). */
  logError?: (error: unknown) => void;
}

/** Petición normalizada. */
export interface AppRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
  authorization?: string;
  clientIp?: string;
}

/** Respuesta normalizada. */
export interface AppResponse {
  status: number;
  body: unknown;
}

interface Context {
  db: Db;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  user: () => Promise<UserRow>;
  admin: () => Promise<UserRow>;
  clientIp: string;
}

type Handler = (ctx: Context) => Promise<unknown>;

const publicLimiter = new RateLimiter(30, 60_000);

/**
 * Crea el manejador de la API REST. Cada endpoint valida la entrada con zod,
 * comprueba la sesión (JWT) y el rol en el servidor, y devuelve errores
 * homogéneos `{ code, message }`.
 */
export function createApp(deps: AppDeps): (request: AppRequest) => Promise<AppResponse> {
  const { identity, realtime } = deps;
  const logError = deps.logError ?? ((error: unknown) => console.error(error));

  /** Publica en tiempo real sin hacer fallar la operación principal. */
  const publish = async (tasks: Promise<void>[]): Promise<void> => {
    const results = await Promise.allSettled(tasks);
    results
      .filter((result) => result.status === 'rejected')
      .forEach((result) => logError(result.reason));
  };

  const routes: [string, Handler][] = [
    // --- Sesión y registro ---
    ['GET /me', async ({ user }) => user()],
    [
      'PATCH /me',
      async ({ db, user, body }) => {
        const current = await user();
        const { fullName } = parse(schemas.updateMe, body);
        return usersRepo.update(db, current.id, { fullName });
      },
    ],
    [
      'POST /auth/register',
      async ({ db, body, clientIp }) => {
        publicLimiter.check(`register:${clientIp}`);
        const input = parse(schemas.register, body);
        if (await usersRepo.emailExists(db, input.email)) {
          throw errors.conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese correo.');
        }
        const uid = await identity.createAccount(input.email, input.password, input.fullName);
        try {
          const user = await usersRepo.insert(db, {
            id: uid,
            email: input.email,
            fullName: input.fullName,
            role: 'user',
          });
          await publish([
            identity.setRole(uid, 'user'),
            realtime.publishActivity(
              'user_created',
              `Nueva cuenta: ${user.fullName}`,
              user.fullName,
            ),
          ]);
          return user;
        } catch (error) {
          // Compensación: si falla la base de datos, no dejamos una cuenta huérfana
          await identity.deleteAccount(uid).catch(logError);
          throw error;
        }
      },
    ],
    [
      'GET /users/email-available',
      async ({ db, query, clientIp }) => {
        publicLimiter.check(`email:${clientIp}`);
        const { email } = parse(schemas.emailQuery, query);
        return { available: !(await usersRepo.emailExists(db, email)) };
      },
    ],
    // --- Usuarios (admin) ---
    [
      'GET /users',
      async ({ db, admin }) => {
        await admin();
        return usersRepo.list(db);
      },
    ],
    [
      'POST /users',
      async ({ db, admin, body }) => {
        const actor = await admin();
        const input = parse(schemas.createUser, body);
        if (await usersRepo.emailExists(db, input.email)) {
          throw errors.conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese correo.');
        }
        const uid = await identity.createAccount(input.email, input.password, input.fullName);
        try {
          const user = await usersRepo.insert(db, {
            id: uid,
            email: input.email,
            fullName: input.fullName,
            role: input.role,
          });
          await publish([
            identity.setRole(uid, input.role),
            realtime.publishActivity(
              'user_created',
              `Nueva cuenta: ${user.fullName}`,
              actor.fullName,
            ),
          ]);
          return user;
        } catch (error) {
          await identity.deleteAccount(uid).catch(logError);
          throw error;
        }
      },
    ],
    [
      'PATCH /users/:id',
      async ({ db, admin, params, body }) => {
        const actor = await admin();
        const changes = parse(schemas.updateUser, body);
        if (params['id'] === actor.id && changes.role && changes.role !== actor.role) {
          throw errors.conflict('SELF_ROLE', 'No puedes cambiar tu propio rol.');
        }
        const updated = await usersRepo.update(db, params['id'] ?? '', changes);
        if (changes.role) {
          await publish([identity.setRole(updated.id, updated.role)]);
        }
        return updated;
      },
    ],
    // --- Catálogo ---
    [
      'GET /categories',
      async ({ db, user }) => {
        await user();
        return catalogRepo.listCategories(db);
      },
    ],
    [
      'POST /categories',
      async ({ db, admin, body }) => {
        await admin();
        return catalogRepo.saveCategory(db, parse(schemas.category, body));
      },
    ],
    [
      'PATCH /categories/:id',
      async ({ db, admin, params, body }) => {
        await admin();
        return catalogRepo.saveCategory(
          db,
          parse(schemas.category, body),
          parse(schemas.id, params['id']),
        );
      },
    ],
    [
      'DELETE /categories/:id',
      async ({ db, admin, params }) => {
        await admin();
        await catalogRepo.deleteCategory(db, parse(schemas.id, params['id']));
      },
    ],
    [
      'GET /suppliers',
      async ({ db, user }) => {
        await user();
        return catalogRepo.listSuppliers(db);
      },
    ],
    [
      'POST /suppliers',
      async ({ db, admin, body }) => {
        await admin();
        return catalogRepo.saveSupplier(db, parse(schemas.supplier, body));
      },
    ],
    [
      'PATCH /suppliers/:id',
      async ({ db, admin, params, body }) => {
        await admin();
        return catalogRepo.saveSupplier(
          db,
          parse(schemas.supplier, body),
          parse(schemas.id, params['id']),
        );
      },
    ],
    [
      'DELETE /suppliers/:id',
      async ({ db, admin, params }) => {
        await admin();
        await catalogRepo.deleteSupplier(db, parse(schemas.id, params['id']));
      },
    ],
    // --- Productos ---
    [
      'GET /products/sku-available',
      async ({ db, user, query }) => {
        await user();
        const { sku, excludeId } = parse(schemas.skuQuery, query);
        return { available: await productsRepo.skuAvailable(db, sku, excludeId) };
      },
    ],
    [
      'GET /products',
      async ({ db, user, query }) => {
        const current = await user();
        const filter = parse(schemas.productQuery, query);
        return productsRepo.list(db, {
          categoryId: filter.categoryId,
          lowStock: filter.lowStock === 'true',
          // El usuario estándar solo ve productos activos
          activeOnly: current.role !== 'admin' || filter.active === 'true',
        });
      },
    ],
    [
      'POST /products',
      async ({ db, admin, body }) => {
        const actor = await admin();
        const product = await productsRepo.save(db, parse(schemas.product, body));
        await publish(
          productEvents(product.name, product.stock, product.minStock, actor.fullName, 'creado'),
        );
        return product;
      },
    ],
    [
      'PATCH /products/:id',
      async ({ db, admin, params, body }) => {
        const actor = await admin();
        const product = await productsRepo.save(
          db,
          parse(schemas.product, body),
          parse(schemas.id, params['id']),
        );
        await publish(
          productEvents(
            product.name,
            product.stock,
            product.minStock,
            actor.fullName,
            'actualizado',
          ),
        );
        return product;
      },
    ],
    [
      'DELETE /products/:id',
      async ({ db, admin, params }) => {
        await admin();
        await productsRepo.remove(db, parse(schemas.id, params['id']));
      },
    ],
    // --- Pedidos ---
    [
      'GET /orders',
      async ({ db, user, query }) => {
        const current = await user();
        const filter = parse(schemas.orderQuery, query);
        const pageSize = filter.pageSize ?? 1000;
        return ordersRepo.list(db, {
          userId: current.role === 'admin' ? undefined : current.id,
          status: filter.status,
          from: filter.from,
          to: filter.to,
          limit: pageSize,
          offset: ((filter.page ?? 1) - 1) * pageSize,
        });
      },
    ],
    [
      'GET /orders/:id',
      async ({ db, user, params }) => {
        const current = await user();
        const order = await ordersRepo.get(db, parse(schemas.id, params['id']));
        // Un usuario estándar no puede ver pedidos ajenos (404 para no revelar su existencia)
        if (!order || (current.role !== 'admin' && order.userId !== current.id)) {
          throw errors.notFound('Pedido no encontrado.');
        }
        return order;
      },
    ],
    [
      'POST /orders',
      async ({ db, user, body }) => {
        const current = await user();
        const input = parse(schemas.order, body);
        const created = await db.transaction((tx) => ordersRepo.create(tx, current.id, input));
        const admins = (await usersRepo.list(db)).filter((candidate) => candidate.role === 'admin');
        await publish([
          realtime.publishActivity(
            'order_created',
            `Nuevo pedido #${created.id} por ${created.total.toFixed(2).replace('.', ',')} €`,
            current.fullName,
          ),
          ...created.lowStock.flatMap((product) => [
            realtime.publishActivity(
              'low_stock',
              `Stock bajo: ${product.name} (${product.stock} uds.)`,
              'Sistema',
            ),
            ...admins.map((admin) =>
              realtime.notify(
                admin.id,
                'Stock bajo',
                `${product.name} tiene ${product.stock} unidades.`,
              ),
            ),
          ]),
        ]);
        return ordersRepo.get(db, created.id);
      },
    ],
    [
      'PATCH /orders/:id/status',
      async ({ db, admin, params, body }) => {
        const actor = await admin();
        const id = parse(schemas.id, params['id']);
        const { status } = parse(schemas.orderStatus, body);
        const { userId } = await db.transaction((tx) => ordersRepo.updateStatus(tx, id, status));
        const label = STATUS_LABELS[status as OrderStatus];
        await publish([
          realtime.publishActivity('order_status', `Pedido #${id}: ${label}`, actor.fullName),
          realtime.notify(userId, `Pedido #${id} actualizado`, `Nuevo estado: ${label}.`),
        ]);
        return ordersRepo.get(db, id);
      },
    ],
    // --- Estadísticas (admin) ---
    [
      'GET /stats/kpis',
      async ({ db, admin, query }) => {
        await admin();
        return statsRepo.kpis(db, parse(schemas.stats, query));
      },
    ],
    [
      'GET /stats/sales-by-month',
      async ({ db, admin, query }) => {
        await admin();
        return statsRepo.salesByMonth(db, parse(schemas.stats, query));
      },
    ],
    [
      'GET /stats/stock-by-category',
      async ({ db, admin, query }) => {
        await admin();
        return statsRepo.stockByCategory(db, parse(schemas.stats, query));
      },
    ],
    [
      'GET /stats/top-products',
      async ({ db, admin, query }) => {
        await admin();
        return statsRepo.topProducts(db, parse(schemas.stats, query));
      },
    ],
    [
      'GET /stats/orders-by-status',
      async ({ db, admin, query }) => {
        await admin();
        return statsRepo.ordersByStatus(db, parse(schemas.stats, query));
      },
    ],
  ];

  function productEvents(
    name: string,
    stock: number,
    minStock: number,
    actorName: string,
    verb: string,
  ): Promise<void>[] {
    const tasks = [
      realtime.publishActivity('product_updated', `Producto ${verb}: ${name}`, actorName),
    ];
    if (stock <= minStock) {
      tasks.push(
        realtime.publishActivity('low_stock', `Stock bajo: ${name} (${stock} uds.)`, 'Sistema'),
      );
    }
    return tasks;
  }

  return async (request: AppRequest): Promise<AppResponse> => {
    const match = findRoute(routes, request.method, request.path);
    if (!match) {
      return { status: 404, body: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } };
    }
    let db: Db | null = null;
    try {
      db = await deps.openDb();
      const connection = db;
      let cachedUser: Promise<UserRow> | null = null;
      const user = (): Promise<UserRow> => {
        cachedUser ??= authenticate(connection, request.authorization, request.path === '/me');
        return cachedUser;
      };
      const admin = async (): Promise<UserRow> => {
        const current = await user();
        if (current.role !== 'admin') {
          throw errors.forbidden();
        }
        return current;
      };
      const result = await match.handler({
        db: connection,
        params: match.params,
        query: request.query,
        body: request.body,
        user,
        admin,
        clientIp: request.clientIp ?? 'unknown',
      });
      return result === undefined ? { status: 204, body: null } : { status: 200, body: result };
    } catch (error) {
      return toErrorResponse(error, logError);
    } finally {
      await db?.close().catch(logError);
    }
  };

  /** Verifica el JWT y carga el perfil (la fuente de verdad del rol es PostgreSQL). */
  async function authenticate(
    db: Db,
    authorization: string | undefined,
    isMe: boolean,
  ): Promise<UserRow> {
    const token = authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      throw errors.unauthenticated();
    }
    let uid: string;
    try {
      uid = (await identity.verifyToken(token)).uid;
    } catch {
      throw errors.unauthenticated();
    }
    const profile = await usersRepo.get(db, uid);
    if (!profile) {
      throw isMe
        ? new HttpError(404, 'PROFILE_NOT_FOUND', 'No existe un perfil para esta cuenta.')
        : errors.forbidden();
    }
    return profile;
  }
}

function findRoute(
  routes: [string, Handler][],
  method: string,
  path: string,
): { handler: Handler; params: Record<string, string> } | null {
  const pathParts = path.split('/').filter(Boolean);
  for (const [pattern, handler] of routes) {
    const [routeMethod, route] = pattern.split(' ') as [string, string];
    if (routeMethod !== method) {
      continue;
    }
    const routeParts = route.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) {
      continue;
    }
    const params: Record<string, string> = {};
    const ok = routeParts.every((part, index) => {
      const value = decodeURIComponent(pathParts[index] as string);
      if (part.startsWith(':')) {
        params[part.slice(1)] = value;
        return true;
      }
      return part === value;
    });
    if (ok) {
      return { handler, params };
    }
  }
  return null;
}

function toErrorResponse(error: unknown, logError: (error: unknown) => void): AppResponse {
  if (error instanceof HttpError) {
    return { status: error.status, body: { code: error.code, message: error.message } };
  }
  if ((error as { validation?: boolean }).validation) {
    return { status: 400, body: { code: 'VALIDATION', message: (error as Error).message } };
  }
  logError(error);
  return { status: 500, body: { code: 'INTERNAL', message: 'Error interno del servidor.' } };
}

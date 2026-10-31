import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, delay, dematerialize, materialize, of, throwError } from 'rxjs';
import {
  CategoryInput,
  CreateUserInput,
  OrderInput,
  OrderStatus,
  ProductInput,
  RegisterInput,
  Role,
  StatsFilter,
  SupplierInput,
  UserProfile,
} from '../models';
import { DemoDb, DemoHttpError } from './demo-db';

/** Latencia simulada para que se aprecien los estados de carga. */
const LATENCY_MS = 280;

/** Manejador de una ruta simulada. */
type Handler = (context: RouteContext) => unknown;

/** Contexto que recibe cada manejador simulado. */
interface RouteContext {
  /** Parámetros de la ruta. */
  params: Record<string, string>;
  /** Parámetros de la consulta. */
  query: URLSearchParams;
  /** Texto o cuerpo del mensaje. */
  body: unknown;
  /** Devuelve el usuario autenticado (401 si no hay sesión). */
  user: () => UserProfile;
  /** Devuelve el administrador autenticado (403 si no lo es). */
  admin: () => UserProfile;
}

/**
 * Backend simulado del modo demostración. Intercepta las peticiones a `/api`
 * y las resuelve contra {@link DemoDb} aplicando autenticación por token y
 * autorización por rol, igual que las funciones serverless reales.
 */
export const demoBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }
  const db = inject(DemoDb);
  return defer(() => handle(db, req)).pipe(materialize(), delay(LATENCY_MS), dematerialize());
};

/** Resuelve una petición contra la tabla de rutas. */
function handle(db: DemoDb, req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const url = new URL(req.urlWithParams, 'http://demo.local');
  const path = url.pathname.replace(/^\/api/, '');
  const routes = buildRoutes(db);
  for (const [pattern, handler] of routes) {
    const [method, route] = pattern.split(' ') as [string, string];
    const params = matchRoute(route, path);
    if (method !== req.method || !params) {
      continue;
    }
    const user = (): UserProfile => {
      const token = req.headers.get('Authorization')?.replace(/^Bearer demo\./, '');
      if (!token) {
        throw new DemoHttpError(401, 'UNAUTHENTICATED', 'Sesión no válida o caducada.');
      }
      return db.getUser(token);
    };
    const admin = (): UserProfile => {
      const current = user();
      if (current.role !== 'admin') {
        throw new DemoHttpError(403, 'FORBIDDEN', 'No tienes permisos para esta operación.');
      }
      return current;
    };
    try {
      const result = handler({ params, query: url.searchParams, body: req.body, user, admin });
      return of(
        new HttpResponse({
          status: result === undefined ? 204 : 200,
          body: result ?? null,
          url: req.url,
        }),
      );
    } catch (error) {
      return throwError(() => toHttpError(error, req.url));
    }
  }
  return throwError(() =>
    toHttpError(new DemoHttpError(404, 'NOT_FOUND', 'Recurso no encontrado.'), req.url),
  );
}

/** Tabla de rutas de la API simulada (mismo contrato que la real). */
function buildRoutes(db: DemoDb): [string, Handler][] {
  return [
    // --- Sesión y registro ---
    ['GET /me', ({ user }) => user()],
    [
      'PATCH /me',
      ({ user, body }) =>
        db.updateUser(user().id, { fullName: (body as { fullName: string }).fullName }, user().id),
    ],
    ['POST /auth/register', ({ body }) => db.register(body as RegisterInput)],
    [
      'GET /users/email-available',
      ({ query }) => ({ available: db.isEmailAvailable(query.get('email') ?? '') }),
    ],
    // --- Usuarios (admin) ---
    ['GET /users', ({ admin }) => (admin(), db.listUsers())],
    ['POST /users', ({ admin, body }) => db.createUser(body as CreateUserInput, admin().fullName)],
    [
      'PATCH /users/:id',
      ({ admin, params, body }) =>
        db.updateUser(params['id'] ?? '', body as { fullName?: string; role?: Role }, admin().id),
    ],
    // --- Catálogo ---
    ['GET /categories', ({ user }) => (user(), db.listCategories())],
    ['POST /categories', ({ admin, body }) => (admin(), db.saveCategory(body as CategoryInput))],
    [
      'PATCH /categories/:id',
      ({ admin, params, body }) => (
        admin(),
        db.saveCategory(body as CategoryInput, Number(params['id']))
      ),
    ],
    [
      'DELETE /categories/:id',
      ({ admin, params }) => (admin(), db.deleteCategory(Number(params['id']))),
    ],
    ['GET /suppliers', ({ user }) => (user(), db.listSuppliers())],
    ['POST /suppliers', ({ admin, body }) => (admin(), db.saveSupplier(body as SupplierInput))],
    [
      'PATCH /suppliers/:id',
      ({ admin, params, body }) => (
        admin(),
        db.saveSupplier(body as SupplierInput, Number(params['id']))
      ),
    ],
    [
      'DELETE /suppliers/:id',
      ({ admin, params }) => (admin(), db.deleteSupplier(Number(params['id']))),
    ],
    // --- Productos ---
    [
      'GET /products/sku-available',
      ({ user, query }) => (
        user(),
        {
          available: db.isSkuAvailable(
            query.get('sku') ?? '',
            Number(query.get('excludeId')) || undefined,
          ),
        }
      ),
    ],
    [
      'GET /products',
      ({ user, query }) => {
        const current = user();
        return db.listProducts({
          categoryId: Number(query.get('categoryId')) || undefined,
          lowStock: query.get('lowStock') === 'true',
          activeOnly: current.role !== 'admin' || query.get('active') === 'true',
        });
      },
    ],
    ['POST /products', ({ admin, body }) => db.saveProduct(body as ProductInput, admin().fullName)],
    [
      'PATCH /products/:id',
      ({ admin, params, body }) =>
        db.saveProduct(body as ProductInput, admin().fullName, Number(params['id'])),
    ],
    [
      'DELETE /products/:id',
      ({ admin, params }) => (admin(), db.deleteProduct(Number(params['id']))),
    ],
    // --- Pedidos ---
    [
      'GET /orders',
      ({ user, query }) =>
        db.listOrders(user(), {
          status: (query.get('status') as OrderStatus | null) ?? undefined,
          from: query.get('from') ?? undefined,
          to: query.get('to') ?? undefined,
        }),
    ],
    ['GET /orders/:id', ({ user, params }) => db.getOrder(user(), Number(params['id']))],
    ['POST /orders', ({ user, body }) => db.createOrder(user(), body as OrderInput)],
    [
      'PATCH /orders/:id/status',
      ({ admin, params, body }) =>
        db.updateOrderStatus(
          Number(params['id']),
          (body as { status: OrderStatus }).status,
          admin().fullName,
        ),
    ],
    // --- Estadísticas (admin) ---
    ['GET /stats/kpis', ({ admin, query }) => (admin(), db.kpis(toFilter(query)))],
    [
      'GET /stats/sales-by-month',
      ({ admin, query }) => (admin(), db.salesByMonth(toFilter(query))),
    ],
    [
      'GET /stats/stock-by-category',
      ({ admin, query }) => (admin(), db.stockByCategory(toFilter(query))),
    ],
    ['GET /stats/top-products', ({ admin, query }) => (admin(), db.topProducts(toFilter(query)))],
    [
      'GET /stats/orders-by-status',
      ({ admin, query }) => (admin(), db.ordersByStatus(toFilter(query))),
    ],
  ];
}

/** Convierte los parámetros de consulta en filtros de estadísticas. */
function toFilter(query: URLSearchParams): StatsFilter {
  return {
    from: query.get('from') ?? '2000-01-01',
    to: query.get('to') ?? '2100-01-01',
    categoryId: Number(query.get('categoryId')) || null,
    status: (query.get('status') as OrderStatus | null) || null,
  };
}

/** Compara una ruta con parámetros (`/orders/:id/status`) con una ruta real. */
function matchRoute(route: string, path: string): Record<string, string> | null {
  const routeParts = route.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (routeParts.length !== pathParts.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i] as string;
    const pathPart = decodeURIComponent(pathParts[i] as string);
    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = pathPart;
    } else if (routePart !== pathPart) {
      return null;
    }
  }
  return params;
}

/** Convierte un error simulado en `HttpErrorResponse`. */
function toHttpError(error: unknown, url: string): HttpErrorResponse {
  if (error instanceof DemoHttpError) {
    return new HttpErrorResponse({
      status: error.status,
      error: { code: error.code, message: error.message },
      url,
    });
  }
  return new HttpErrorResponse({
    status: 500,
    error: { code: 'INTERNAL', message: 'Error interno del servidor.' },
    url,
  });
}

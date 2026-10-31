import type { Queryable } from './db.js';
import { errors } from './http.js';

// -----------------------------------------------------------------------------
// Tipos de salida (mismos nombres de campo que consume el frontend)
// -----------------------------------------------------------------------------
export type Role = 'admin' | 'user';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface ProductRow {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  categoryName: string;
  supplierId: number;
  supplierName: string;
  price: number;
  stock: number;
  minStock: number;
  active: boolean;
  updatedAt: string;
}

export interface OrderRow {
  id: number;
  userId: string;
  customerName: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  notes: string | null;
  items?: OrderItemRow[];
}

export interface OrderItemRow {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface StatsFilter {
  from: string;
  to: string;
  categoryId?: number;
  status?: OrderStatus;
}

export interface SeriesPoint {
  key: string | number;
  label: string;
  value: number;
}

const STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'cancelled'];
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  processing: 'En preparación',
  shipped: 'Enviado',
  cancelled: 'Cancelado',
};
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const USER_COLUMNS = `id, email, full_name AS "fullName", role, created_at AS "createdAt"`;
const PRODUCT_SELECT = `
  SELECT p.id, p.sku, p.name, p.category_id AS "categoryId", c.name AS "categoryName",
         p.supplier_id AS "supplierId", s.name AS "supplierName", p.price::float8 AS price,
         p.stock, p.min_stock AS "minStock", p.active, p.updated_at AS "updatedAt"
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN suppliers s ON s.id = p.supplier_id`;

/** Traduce errores de restricción de PostgreSQL a errores HTTP legibles. */
export function mapDbError(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === '23505') {
    throw errors.conflict('DUPLICATE', 'Ya existe un registro con ese valor único.');
  }
  // 23503: violación de clave foránea · 23001: violación de ON DELETE RESTRICT
  if (code === '23503' || code === '23001') {
    throw errors.conflict('IN_USE', 'El registro está en uso y no se puede eliminar.');
  }
  if (code === '23514') {
    throw errors.badRequest('Algún valor no cumple las restricciones.');
  }
  throw error;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// -----------------------------------------------------------------------------
// Usuarios
// -----------------------------------------------------------------------------
export const usersRepo = {
  async get(db: Queryable, id: string): Promise<UserRow | undefined> {
    const [row] = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    return row;
  },

  async emailExists(db: Queryable, email: string): Promise<boolean> {
    const rows = await db.query(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [email]);
    return rows.length > 0;
  },

  list(db: Queryable): Promise<UserRow[]> {
    return db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users ORDER BY full_name`);
  },

  async insert(
    db: Queryable,
    user: { id: string; email: string; fullName: string; role: Role },
  ): Promise<UserRow> {
    try {
      const [row] = await db.query<UserRow>(
        `INSERT INTO users (id, email, full_name, role) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
        [user.id, user.email, user.fullName, user.role],
      );
      return row as UserRow;
    } catch (error) {
      return mapDbError(error);
    }
  },

  async update(
    db: Queryable,
    id: string,
    changes: { fullName?: string; role?: Role },
  ): Promise<UserRow> {
    const [row] = await db.query<UserRow>(
      `UPDATE users SET full_name = COALESCE($2, full_name), role = COALESCE($3, role)
       WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [id, changes.fullName ?? null, changes.role ?? null],
    );
    if (!row) {
      throw errors.notFound('Usuario no encontrado.');
    }
    return row;
  },
};

// -----------------------------------------------------------------------------
// Categorías y proveedores
// -----------------------------------------------------------------------------
export const catalogRepo = {
  listCategories(db: Queryable) {
    return db.query(
      `SELECT c.id, c.name, c.description, COUNT(p.id)::int AS "productCount"
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id ORDER BY c.name`,
    );
  },

  async saveCategory(
    db: Queryable,
    input: { name: string; description: string | null },
    id?: number,
  ) {
    try {
      const [row] = id
        ? await db.query<{ id: number }>(
            `UPDATE categories SET name = $2, description = $3 WHERE id = $1 RETURNING id`,
            [id, input.name, input.description],
          )
        : await db.query<{ id: number }>(
            `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id`,
            [input.name, input.description],
          );
      if (!row) {
        throw errors.notFound('Categoría no encontrada.');
      }
      const [saved] = await db.query(
        `SELECT c.id, c.name, c.description, COUNT(p.id)::int AS "productCount"
         FROM categories c LEFT JOIN products p ON p.category_id = c.id WHERE c.id = $1 GROUP BY c.id`,
        [row.id],
      );
      return saved;
    } catch (error) {
      return mapDbError(error);
    }
  },

  async deleteCategory(db: Queryable, id: number): Promise<void> {
    try {
      const rows = await db.query(`DELETE FROM categories WHERE id = $1 RETURNING id`, [id]);
      if (!rows.length) {
        throw errors.notFound('Categoría no encontrada.');
      }
    } catch (error) {
      return mapDbError(error);
    }
  },

  listSuppliers(db: Queryable) {
    return db.query(
      `SELECT s.id, s.name, s.email, s.phone, s.city, COUNT(p.id)::int AS "productCount"
       FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.id
       GROUP BY s.id ORDER BY s.name`,
    );
  },

  async saveSupplier(
    db: Queryable,
    input: { name: string; email: string; phone: string | null; city: string | null },
    id?: number,
  ) {
    try {
      const params = [input.name, input.email, input.phone, input.city];
      const [row] = id
        ? await db.query<{ id: number }>(
            `UPDATE suppliers SET name = $2, email = $3, phone = $4, city = $5 WHERE id = $1 RETURNING id`,
            [id, ...params],
          )
        : await db.query<{ id: number }>(
            `INSERT INTO suppliers (name, email, phone, city) VALUES ($1, $2, $3, $4) RETURNING id`,
            params,
          );
      if (!row) {
        throw errors.notFound('Proveedor no encontrado.');
      }
      const [saved] = await db.query(
        `SELECT s.id, s.name, s.email, s.phone, s.city, COUNT(p.id)::int AS "productCount"
         FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.id WHERE s.id = $1 GROUP BY s.id`,
        [row.id],
      );
      return saved;
    } catch (error) {
      return mapDbError(error);
    }
  },

  async deleteSupplier(db: Queryable, id: number): Promise<void> {
    try {
      const rows = await db.query(`DELETE FROM suppliers WHERE id = $1 RETURNING id`, [id]);
      if (!rows.length) {
        throw errors.notFound('Proveedor no encontrado.');
      }
    } catch (error) {
      return mapDbError(error);
    }
  },
};

// -----------------------------------------------------------------------------
// Productos
// -----------------------------------------------------------------------------
export interface ProductInput {
  sku: string;
  name: string;
  categoryId: number;
  supplierId: number;
  price: number;
  stock: number;
  minStock: number;
  active: boolean;
}

export const productsRepo = {
  list(
    db: Queryable,
    filter: { categoryId?: number; lowStock?: boolean; activeOnly?: boolean },
  ): Promise<ProductRow[]> {
    return db.query<ProductRow>(
      `${PRODUCT_SELECT}
       WHERE ($1::int IS NULL OR p.category_id = $1)
         AND (NOT $2::boolean OR p.stock <= p.min_stock)
         AND (NOT $3::boolean OR p.active)
       ORDER BY p.sku`,
      [filter.categoryId ?? null, filter.lowStock ?? false, filter.activeOnly ?? false],
    );
  },

  async get(db: Queryable, id: number): Promise<ProductRow | undefined> {
    const [row] = await db.query<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
    return row;
  },

  async skuAvailable(db: Queryable, sku: string, excludeId?: number): Promise<boolean> {
    const rows = await db.query(
      `SELECT 1 FROM products WHERE sku = $1 AND ($2::int IS NULL OR id <> $2)`,
      [sku, excludeId ?? null],
    );
    return rows.length === 0;
  },

  async save(db: Queryable, input: ProductInput, id?: number): Promise<ProductRow> {
    const params = [
      input.sku,
      input.name,
      input.categoryId,
      input.supplierId,
      input.price,
      input.stock,
      input.minStock,
      input.active,
    ];
    try {
      const [row] = id
        ? await db.query<{ id: number }>(
            `UPDATE products SET sku = $2, name = $3, category_id = $4, supplier_id = $5, price = $6,
               stock = $7, min_stock = $8, active = $9, updated_at = now()
             WHERE id = $1 RETURNING id`,
            [id, ...params],
          )
        : await db.query<{ id: number }>(
            `INSERT INTO products (sku, name, category_id, supplier_id, price, stock, min_stock, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            params,
          );
      if (!row) {
        throw errors.notFound('Producto no encontrado.');
      }
      return (await productsRepo.get(db, row.id)) as ProductRow;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        throw errors.conflict('SKU_TAKEN', 'Ya existe un producto con ese SKU.');
      }
      if (code === '23503') {
        throw errors.badRequest('Categoría o proveedor no válidos.');
      }
      return mapDbError(error);
    }
  },

  async remove(db: Queryable, id: number): Promise<void> {
    try {
      const rows = await db.query(`DELETE FROM products WHERE id = $1 RETURNING id`, [id]);
      if (!rows.length) {
        throw errors.notFound('Producto no encontrado.');
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23503' || code === '23001') {
        throw errors.conflict(
          'IN_USE',
          'El producto figura en pedidos. Desactívalo en lugar de eliminarlo.',
        );
      }
      return mapDbError(error);
    }
  },
};

// -----------------------------------------------------------------------------
// Pedidos
// -----------------------------------------------------------------------------
const ORDER_SELECT = `
  SELECT o.id, o.user_id AS "userId", u.full_name AS "customerName", o.status, o.total::float8 AS total,
         COALESCE(SUM(oi.quantity), 0)::int AS "itemCount", o.created_at AS "createdAt", o.notes
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN order_items oi ON oi.order_id = o.id`;

export const ordersRepo = {
  list(
    db: Queryable,
    filter: {
      userId?: string;
      status?: OrderStatus;
      from?: string;
      to?: string;
      limit: number;
      offset: number;
    },
  ): Promise<OrderRow[]> {
    return db.query<OrderRow>(
      `${ORDER_SELECT}
       WHERE ($1::text IS NULL OR o.user_id = $1)
         AND ($2::text IS NULL OR o.status = $2)
         AND ($3::date IS NULL OR o.created_at >= $3::date)
         AND ($4::date IS NULL OR o.created_at < $4::date + 1)
       GROUP BY o.id, u.full_name
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $5 OFFSET $6`,
      [
        filter.userId ?? null,
        filter.status ?? null,
        filter.from ?? null,
        filter.to ?? null,
        filter.limit,
        filter.offset,
      ],
    );
  },

  async get(db: Queryable, id: number): Promise<OrderRow | undefined> {
    const [order] = await db.query<OrderRow>(
      `${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id, u.full_name`,
      [id],
    );
    if (!order) {
      return undefined;
    }
    order.items = await db.query<OrderItemRow>(
      `SELECT oi.product_id AS "productId", p.sku, p.name AS "productName", oi.quantity, oi.unit_price::float8 AS "unitPrice"
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY p.name`,
      [id],
    );
    return order;
  },

  /**
   * Crea un pedido de forma atómica: bloquea las filas de producto (`FOR UPDATE`),
   * comprueba stock, lo descuenta e inserta pedido y líneas en la misma transacción.
   * @returns El id del pedido y los productos que han quedado en stock bajo.
   */
  async create(
    tx: Queryable,
    userId: string,
    input: { items: { productId: number; quantity: number }[]; notes: string | null },
  ): Promise<{ id: number; total: number; lowStock: { name: string; stock: number }[] }> {
    const ids = input.items.map((item) => item.productId);
    const products = await tx.query<{
      id: number;
      name: string;
      price: number;
      stock: number;
      minStock: number;
      active: boolean;
    }>(
      `SELECT id, name, price::float8 AS price, stock, min_stock AS "minStock", active
       FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [ids],
    );
    const byId = new Map(products.map((product) => [product.id, product]));
    let total = 0;
    for (const item of input.items) {
      const product = byId.get(item.productId);
      if (!product || !product.active) {
        throw errors.badRequest('Hay productos no disponibles en el pedido.');
      }
      if (item.quantity > product.stock) {
        throw errors.conflict('INSUFFICIENT_STOCK', `Stock insuficiente para ${product.name}.`);
      }
      total += product.price * item.quantity;
    }
    total = round2(total);
    const [order] = await tx.query<{ id: number }>(
      `INSERT INTO orders (user_id, status, total, notes) VALUES ($1, 'pending', $2, $3) RETURNING id`,
      [userId, total, input.notes],
    );
    const orderId = (order as { id: number }).id;
    const lowStock: { name: string; stock: number }[] = [];
    for (const item of input.items) {
      const product = byId.get(item.productId) as {
        name: string;
        price: number;
        stock: number;
        minStock: number;
      };
      await tx.query(`UPDATE products SET stock = stock - $2, updated_at = now() WHERE id = $1`, [
        item.productId,
        item.quantity,
      ]);
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [orderId, item.productId, item.quantity, product.price],
      );
      const remaining = product.stock - item.quantity;
      if (remaining <= product.minStock) {
        lowStock.push({ name: product.name, stock: remaining });
      }
    }
    return { id: orderId, total, lowStock };
  },

  /** Cambia el estado; cancelar devuelve las unidades al stock. */
  async updateStatus(tx: Queryable, id: number, status: OrderStatus): Promise<{ userId: string }> {
    const [order] = await tx.query<{ status: OrderStatus; userId: string }>(
      `SELECT status, user_id AS "userId" FROM orders WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!order) {
      throw errors.notFound('Pedido no encontrado.');
    }
    if (order.status === 'cancelled') {
      throw errors.conflict(
        'INVALID_TRANSITION',
        'Un pedido cancelado no puede cambiar de estado.',
      );
    }
    if (status === 'cancelled') {
      await tx.query(
        `UPDATE products p SET stock = p.stock + oi.quantity, updated_at = now()
         FROM order_items oi WHERE oi.order_id = $1 AND p.id = oi.product_id`,
        [id],
      );
    }
    await tx.query(`UPDATE orders SET status = $2 WHERE id = $1`, [id, status]);
    return { userId: order.userId };
  },
};

// -----------------------------------------------------------------------------
// Estadísticas del cuadro de mando
// -----------------------------------------------------------------------------
/** Líneas de pedido filtradas por periodo, categoría y estado (sin cancelados por defecto). */
const LINES_CTE = `
  WITH lines AS (
    SELECT o.id AS order_id, o.created_at, oi.product_id, p.name, oi.quantity, oi.unit_price
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= $1::date AND o.created_at < $2::date + 1
      AND ($3::int IS NULL OR p.category_id = $3)
      AND (CASE WHEN $4::text IS NULL THEN o.status <> 'cancelled' ELSE o.status = $4 END)
  )`;

function linesParams(filter: StatsFilter, from = filter.from, to = filter.to): unknown[] {
  return [from, to, filter.categoryId ?? null, filter.status ?? null];
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const statsRepo = {
  async kpis(db: Queryable, filter: StatsFilter) {
    const spanDays =
      Math.round(
        (new Date(`${filter.to}T00:00:00Z`).getTime() -
          new Date(`${filter.from}T00:00:00Z`).getTime()) /
          86_400_000,
      ) + 1;
    const prevTo = addDays(filter.from, -1);
    const prevFrom = addDays(filter.from, -spanDays);
    const aggregate = `${LINES_CTE}
      SELECT COALESCE(SUM(quantity * unit_price), 0)::float8 AS revenue, COUNT(DISTINCT order_id)::int AS orders FROM lines`;
    const [[current], [previous], [pending], [low]] = await Promise.all([
      db.query<{ revenue: number; orders: number }>(aggregate, linesParams(filter)),
      db.query<{ revenue: number; orders: number }>(
        aggregate,
        linesParams(filter, prevFrom, prevTo),
      ),
      db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM orders o WHERE o.status = 'pending'
           AND ($1::int IS NULL OR EXISTS (
             SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = o.id AND p.category_id = $1))`,
        [filter.categoryId ?? null],
      ),
      db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM products
         WHERE active AND stock <= min_stock AND ($1::int IS NULL OR category_id = $1)`,
        [filter.categoryId ?? null],
      ),
    ]);
    const cur = current ?? { revenue: 0, orders: 0 };
    const prev = previous ?? { revenue: 0, orders: 0 };
    return {
      revenue: round2(cur.revenue),
      revenuePrev: round2(prev.revenue),
      orders: cur.orders,
      ordersPrev: prev.orders,
      pendingOrders: pending?.count ?? 0,
      lowStock: low?.count ?? 0,
      avgTicket: cur.orders ? round2(cur.revenue / cur.orders) : 0,
      avgTicketPrev: prev.orders ? round2(prev.revenue / prev.orders) : 0,
    };
  },

  async salesByMonth(db: Queryable, filter: StatsFilter): Promise<SeriesPoint[]> {
    const rows = await db.query<{ key: string; value: number }>(
      `${LINES_CTE}
       SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS key, SUM(quantity * unit_price)::float8 AS value
       FROM lines GROUP BY 1`,
      linesParams(filter),
    );
    const totals = new Map(rows.map((row) => [row.key, row.value]));
    const points: SeriesPoint[] = [];
    const cursor = new Date(`${filter.from.slice(0, 7)}-01T00:00:00Z`);
    const end = new Date(`${filter.to}T00:00:00Z`);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 7);
      points.push({
        key,
        label: `${MONTHS[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}`,
        value: round2(totals.get(key) ?? 0),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return points;
  },

  stockByCategory(db: Queryable, filter: StatsFilter): Promise<SeriesPoint[]> {
    return db.query<SeriesPoint>(
      `SELECT c.id AS key, c.name AS label, COALESCE(SUM(p.stock) FILTER (WHERE p.active), 0)::int AS value
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       WHERE ($1::int IS NULL OR c.id = $1)
       GROUP BY c.id ORDER BY c.id`,
      [filter.categoryId ?? null],
    );
  },

  async topProducts(db: Queryable, filter: StatsFilter): Promise<SeriesPoint[]> {
    const rows = await db.query<SeriesPoint>(
      `${LINES_CTE}
       SELECT product_id AS key, name AS label, SUM(quantity * unit_price)::float8 AS value
       FROM lines GROUP BY product_id, name ORDER BY value DESC LIMIT 5`,
      linesParams(filter),
    );
    return rows.map((row) => ({ ...row, value: round2(row.value) }));
  },

  async ordersByStatus(db: Queryable, filter: StatsFilter): Promise<SeriesPoint[]> {
    const rows = await db.query<{ status: OrderStatus; count: number }>(
      `SELECT o.status, COUNT(*)::int AS count FROM orders o
       WHERE o.created_at >= $1::date AND o.created_at < $2::date + 1
         AND ($3::int IS NULL OR EXISTS (
           SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = o.id AND p.category_id = $3))
       GROUP BY o.status`,
      [filter.from, filter.to, filter.categoryId ?? null],
    );
    const counts = new Map(rows.map((row) => [row.status, row.count]));
    return STATUSES.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      value: counts.get(status) ?? 0,
    }));
  },
};

export { STATUS_LABELS };

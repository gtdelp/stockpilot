import type { Queryable } from '../api/_lib/db.js';
import type { DemoDataset } from '../src/app/core/demo/demo-data.js';

/** Cuenta de prueba que se inserta en la tabla `users`. */
interface SeedAccount {
  id: string;
  email: string;
  fullName: string;
}

/** Opciones de la carga de datos. */
export interface SeedOptions {
  admin: SeedAccount;
  user: SeedAccount;
  /** Clientes sintéticos (solo en la base de datos). */
  customers: SeedAccount[];
  /** Traducción de ids del generador a ids reales. */
  userIds: Map<string, string>;
  /** Generador de teléfonos ficticios. */
  phone: () => string;
}

/**
 * Vacía las tablas e inserta el conjunto de datos sintéticos.
 * Debe ejecutarse dentro de una transacción.
 */
export async function insertDataset(
  tx: Queryable,
  data: DemoDataset,
  options: SeedOptions,
): Promise<void> {
  await tx.query(
    'TRUNCATE order_items, orders, products, suppliers, categories, users RESTART IDENTITY CASCADE',
  );
  await tx.query(
    `INSERT INTO users (id, email, full_name, role) VALUES ($1, $2, $3, 'admin'), ($4, $5, $6, 'user')`,
    [
      options.admin.id,
      options.admin.email.toLowerCase(),
      options.admin.fullName,
      options.user.id,
      options.user.email.toLowerCase(),
      options.user.fullName,
    ],
  );
  for (const customer of options.customers) {
    await tx.query(`INSERT INTO users (id, email, full_name, role) VALUES ($1, $2, $3, 'user')`, [
      customer.id,
      customer.email,
      customer.fullName,
    ]);
  }
  for (const category of data.categories) {
    await tx.query(`INSERT INTO categories (id, name, description) VALUES ($1, $2, $3)`, [
      category.id,
      category.name,
      category.description,
    ]);
  }
  for (const supplier of data.suppliers) {
    await tx.query(
      `INSERT INTO suppliers (id, name, email, phone, city) VALUES ($1, $2, $3, $4, $5)`,
      [supplier.id, supplier.name, supplier.email, options.phone(), supplier.city],
    );
  }
  for (const product of data.products) {
    await tx.query(
      `INSERT INTO products (id, sku, name, category_id, supplier_id, price, stock, min_stock, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        product.id,
        product.sku,
        product.name,
        product.categoryId,
        product.supplierId,
        product.price,
        product.stock,
        product.minStock,
        product.active,
      ],
    );
  }
  for (const order of data.orders) {
    await tx.query(
      `INSERT INTO orders (id, user_id, status, total, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        order.id,
        options.userIds.get(order.userId) ?? options.user.id,
        order.status,
        order.total,
        order.notes,
        order.createdAt,
      ],
    );
    for (const item of order.items) {
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.productId, item.quantity, item.unitPrice],
      );
    }
  }
  // Ajusta las secuencias tras insertar ids explícitos
  for (const table of ['categories', 'suppliers', 'products', 'orders']) {
    await tx.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
    );
  }
}

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { insertDataset } from '../../scripts/seed-data';
import { generateDemoData } from '../../src/app/core/demo/demo-data';

describe('script de datos sintéticos', () => {
  it('genera datos que cumplen todas las restricciones del esquema SQL', async () => {
    const pg = new PGlite();
    await pg.exec(readFileSync('db/schema.sql', 'utf8'));
    const data = generateDemoData(2026, new Date('2026-10-31T12:00:00Z'));
    const customers = data.users
      .filter((user) => user.id.startsWith('demo-customer'))
      .map((user, index) => ({
        id: `seed-${index}`,
        email: `cliente${index}@example.com`,
        fullName: user.fullName,
      }));
    const userIds = new Map(
      data.users.filter((u) => u.id.startsWith('demo-customer')).map((u, i) => [u.id, `seed-${i}`]),
    );
    userIds.set('demo-user', 'user-uid');

    await pg.transaction((tx) =>
      insertDataset(
        { query: async (text, params) => (await tx.query(text, params)).rows as never[] },
        data,
        {
          admin: { id: 'admin-uid', email: 'admin@example.com', fullName: 'Administración Demo' },
          user: { id: 'user-uid', email: 'user@example.com', fullName: 'Lucía Romero' },
          customers,
          userIds,
          phone: () => '910 000 000',
        },
      ),
    );

    const counts = await pg.query<{ products: number; orders: number; items: number }>(
      `SELECT (SELECT COUNT(*) FROM products)::int AS products, (SELECT COUNT(*) FROM orders)::int AS orders,
              (SELECT COUNT(*) FROM order_items)::int AS items`,
    );
    expect(counts.rows[0]).toMatchObject({ products: 120, orders: data.orders.length });
    expect(counts.rows[0]?.items).toBeGreaterThan(data.orders.length);
    // La secuencia queda ajustada: se puede insertar un pedido nuevo
    const next = await pg.query<{ id: number }>(
      `INSERT INTO orders (user_id, total) VALUES ('user-uid', 1) RETURNING id`,
    );
    expect(next.rows[0]?.id).toBe(data.orders.length + 1);
  });
});

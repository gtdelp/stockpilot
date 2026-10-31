import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApi } from './helpers';

type Api = Awaited<ReturnType<typeof createTestApi>>;

describe('API REST de StockPilot', () => {
  let api: Api;

  beforeEach(async () => {
    api = await createTestApi();
  });

  describe('autenticación y autorización', () => {
    it('rechaza peticiones sin token (401)', async () => {
      const response = await api.call('GET', '/products');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('devuelve 404 en /me si la cuenta no tiene perfil', async () => {
      const response = await api.call('GET', '/me', { as: 'ghost' });
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'PROFILE_NOT_FOUND' });
    });

    it('impide a un usuario estándar acceder a las estadísticas (403)', async () => {
      const response = await api.call('GET', '/stats/kpis', { as: 'ana' });
      expect(response.status).toBe(403);
    });

    it('permite al administrador listar usuarios', async () => {
      const response = await api.call('GET', '/users', { as: 'admin' });
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('impide que un administrador cambie su propio rol', async () => {
      const response = await api.call('PATCH', '/users/admin', {
        as: 'admin',
        body: { role: 'user' },
      });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'SELF_ROLE' });
    });

    it('el administrador cambia roles y se replican como claim del token', async () => {
      const response = await api.call('PATCH', '/users/ana', {
        as: 'admin',
        body: { role: 'admin' },
      });
      expect(response.body).toMatchObject({ id: 'ana', role: 'admin' });
      expect(api.roles.get('ana')).toBe('admin');
    });

    it('responde 404 en rutas inexistentes', async () => {
      expect((await api.call('GET', '/nope', { as: 'admin' })).status).toBe(404);
    });
  });

  describe('registro y validación asíncrona del correo', () => {
    it('registra una cuenta con rol de usuario estándar', async () => {
      const response = await api.call('POST', '/auth/register', {
        body: { fullName: 'Nueva Persona', email: 'Nueva@Example.com', password: 'Segura123' },
      });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: 'nueva@example.com', role: 'user' });
      expect(api.events.some((event) => event.type === 'user_created')).toBe(true);
      expect(api.roles.get('uid-nueva@example.com')).toBe('user');
    });

    it('rechaza correos duplicados y contraseñas débiles', async () => {
      const duplicate = await api.call('POST', '/auth/register', {
        body: { fullName: 'Ana Otra', email: 'ana@example.com', password: 'Segura123' },
      });
      expect(duplicate.status).toBe(409);
      const weak = await api.call('POST', '/auth/register', {
        body: { fullName: 'Débil', email: 'debil@example.com', password: 'abc' },
      });
      expect(weak.status).toBe(400);
    });

    it('informa de la disponibilidad de un correo', async () => {
      const taken = await api.call('GET', '/users/email-available', {
        query: { email: 'ANA@example.com' },
      });
      const free = await api.call('GET', '/users/email-available', {
        query: { email: 'libre@example.com' },
      });
      expect(taken.body).toEqual({ available: false });
      expect(free.body).toEqual({ available: true });
    });
  });

  describe('productos', () => {
    const product = {
      sku: 'ofi-0002',
      name: 'Grapadora',
      categoryId: 2,
      supplierId: 1,
      price: 7.9,
      stock: 2,
      minStock: 5,
      active: true,
    };

    it('crea productos normalizando el SKU y avisa de stock bajo', async () => {
      const response = await api.call('POST', '/products', { as: 'admin', body: product });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ sku: 'OFI-0002', price: 7.9, categoryName: 'Oficina' });
      expect(api.events.map((event) => event.type)).toContain('low_stock');
    });

    it('valida el formato y la unicidad del SKU', async () => {
      const invalid = await api.call('POST', '/products', {
        as: 'admin',
        body: { ...product, sku: 'X1' },
      });
      expect(invalid.status).toBe(400);
      const duplicate = await api.call('POST', '/products', {
        as: 'admin',
        body: { ...product, sku: 'ELE-0001' },
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({ code: 'SKU_TAKEN' });
      const check = await api.call('GET', '/products/sku-available', {
        as: 'admin',
        query: { sku: 'ele-0001' },
      });
      expect(check.body).toEqual({ available: false });
      const own = await api.call('GET', '/products/sku-available', {
        as: 'admin',
        query: { sku: 'ELE-0001', excludeId: '1' },
      });
      expect(own.body).toEqual({ available: true });
    });

    it('impide a un usuario estándar crear productos', async () => {
      expect((await api.call('POST', '/products', { as: 'ana', body: product })).status).toBe(403);
    });

    it('oculta los productos inactivos al usuario estándar', async () => {
      await api.db.query(`UPDATE products SET active = false WHERE id = 2`);
      const asUser = await api.call('GET', '/products', { as: 'ana' });
      const asAdmin = await api.call('GET', '/products', { as: 'admin' });
      expect(asUser.body).toHaveLength(1);
      expect(asAdmin.body).toHaveLength(2);
    });
  });

  describe('pedidos', () => {
    it('crea un pedido descontando stock y calculando el total en el servidor', async () => {
      const response = await api.call('POST', '/orders', {
        as: 'ana',
        body: {
          items: [
            { productId: 1, quantity: 8 },
            { productId: 2, quantity: 2 },
          ],
          notes: 'Urgente',
        },
      });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'pending',
        total: 409,
        itemCount: 10,
        customerName: 'Ana Pruebas',
      });
      const [row] = await api.db.query<{ stock: number }>(
        `SELECT stock FROM products WHERE id = 1`,
      );
      expect(row?.stock).toBe(2);
      // El producto 1 queda por debajo del mínimo: evento y notificación al admin
      expect(api.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(['order_created', 'low_stock']),
      );
      expect(api.notifications).toContainEqual({ uid: 'admin', title: 'Stock bajo' });
    });

    it('revierte la transacción si no hay stock suficiente', async () => {
      const response = await api.call('POST', '/orders', {
        as: 'ana',
        body: {
          items: [
            { productId: 2, quantity: 5 },
            { productId: 1, quantity: 99 },
          ],
          notes: null,
        },
      });
      expect(response.status).toBe(409);
      const stocks = await api.db.query<{ stock: number }>(
        `SELECT stock FROM products ORDER BY id`,
      );
      expect(stocks.map((row) => row.stock)).toEqual([10, 100]);
      const orders = await api.db.query(`SELECT 1 FROM orders`);
      expect(orders).toHaveLength(0);
    });

    it('rechaza productos repetidos en el pedido', async () => {
      const response = await api.call('POST', '/orders', {
        as: 'ana',
        body: {
          items: [
            { productId: 1, quantity: 1 },
            { productId: 1, quantity: 1 },
          ],
        },
      });
      expect(response.status).toBe(400);
    });

    it('muestra a cada usuario solo sus pedidos', async () => {
      await api.call('POST', '/orders', {
        as: 'ana',
        body: { items: [{ productId: 2, quantity: 1 }] },
      });
      await api.call('POST', '/orders', {
        as: 'luis',
        body: { items: [{ productId: 2, quantity: 1 }] },
      });
      const ana = await api.call('GET', '/orders', { as: 'ana' });
      const admin = await api.call('GET', '/orders', { as: 'admin' });
      expect(ana.body).toHaveLength(1);
      expect(admin.body).toHaveLength(2);
      const foreign = await api.call('GET', '/orders/2', { as: 'ana' });
      expect(foreign.status).toBe(404);
    });

    it('al cancelar devuelve el stock y bloquea cambios posteriores', async () => {
      await api.call('POST', '/orders', {
        as: 'ana',
        body: { items: [{ productId: 1, quantity: 4 }] },
      });
      const cancel = await api.call('PATCH', '/orders/1/status', {
        as: 'admin',
        body: { status: 'cancelled' },
      });
      expect(cancel.status).toBe(200);
      const [row] = await api.db.query<{ stock: number }>(
        `SELECT stock FROM products WHERE id = 1`,
      );
      expect(row?.stock).toBe(10);
      expect(api.notifications).toContainEqual({ uid: 'ana', title: 'Pedido #1 actualizado' });
      const again = await api.call('PATCH', '/orders/1/status', {
        as: 'admin',
        body: { status: 'shipped' },
      });
      expect(again.status).toBe(409);
    });

    it('solo el administrador cambia estados', async () => {
      await api.call('POST', '/orders', {
        as: 'ana',
        body: { items: [{ productId: 2, quantity: 1 }] },
      });
      expect(
        (await api.call('PATCH', '/orders/1/status', { as: 'ana', body: { status: 'shipped' } }))
          .status,
      ).toBe(403);
    });
  });

  describe('estadísticas', () => {
    beforeEach(async () => {
      await api.call('POST', '/orders', {
        as: 'ana',
        body: { items: [{ productId: 1, quantity: 2 }] },
      });
      await api.call('POST', '/orders', {
        as: 'luis',
        body: { items: [{ productId: 2, quantity: 10 }] },
      });
    });

    it('calcula los KPIs del periodo', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const response = await api.call('GET', '/stats/kpis', {
        as: 'admin',
        query: { from: '2020-01-01', to: today },
      });
      expect(response.body).toMatchObject({
        revenue: 145,
        orders: 2,
        avgTicket: 72.5,
        pendingOrders: 2,
      });
    });

    it('filtra por categoría', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const response = await api.call('GET', '/stats/kpis', {
        as: 'admin',
        query: { from: '2020-01-01', to: today, categoryId: '2' },
      });
      expect(response.body).toMatchObject({ revenue: 45, orders: 1 });
    });

    it('rellena con ceros los meses sin ventas', async () => {
      const response = await api.call('GET', '/stats/sales-by-month', {
        as: 'admin',
        query: { from: '2026-01-01', to: '2026-03-31' },
      });
      expect(response.body).toEqual([
        { key: '2026-01', label: 'ene 26', value: 0 },
        { key: '2026-02', label: 'feb 26', value: 0 },
        { key: '2026-03', label: 'mar 26', value: 0 },
      ]);
    });

    it('devuelve los cuatro estados y el top de productos', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const query = { from: '2020-01-01', to: today };
      const statuses = await api.call('GET', '/stats/orders-by-status', { as: 'admin', query });
      expect(statuses.body).toHaveLength(4);
      expect((statuses.body as { value: number }[])[0]?.value).toBe(2);
      const top = await api.call('GET', '/stats/top-products', { as: 'admin', query });
      expect((top.body as { label: string }[])[0]?.label).toBe('Auriculares');
      const stock = await api.call('GET', '/stats/stock-by-category', { as: 'admin', query });
      expect(stock.body).toEqual([
        { key: 1, label: 'Electrónica', value: 8 },
        { key: 2, label: 'Oficina', value: 90 },
      ]);
    });
  });

  describe('datos maestros', () => {
    it('no permite eliminar un producto que figura en pedidos', async () => {
      await api.call('POST', '/orders', {
        as: 'ana',
        body: { items: [{ productId: 1, quantity: 1 }] },
      });
      const response = await api.call('DELETE', '/products/1', { as: 'admin' });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'IN_USE' });
    });

    it('no permite eliminar una categoría con productos', async () => {
      const response = await api.call('DELETE', '/categories/1', { as: 'admin' });
      expect(response.status).toBe(409);
    });

    it('crea, edita y elimina categorías', async () => {
      const created = await api.call('POST', '/categories', {
        as: 'admin',
        body: { name: 'Hogar', description: '' },
      });
      expect(created.body).toMatchObject({ name: 'Hogar', description: null, productCount: 0 });
      const id = (created.body as { id: number }).id;
      const updated = await api.call('PATCH', `/categories/${id}`, {
        as: 'admin',
        body: { name: 'Casa', description: 'Menaje' },
      });
      expect(updated.body).toMatchObject({ name: 'Casa', description: 'Menaje' });
      expect((await api.call('DELETE', `/categories/${id}`, { as: 'admin' })).status).toBe(204);
      const duplicate = await api.call('POST', '/categories', {
        as: 'admin',
        body: { name: 'oficina' },
      });
      expect(duplicate.status).toBe(409);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DemoDb, DemoHttpError } from './demo-db';

describe('DemoDb (reglas de negocio del modo demostración)', () => {
  let db: DemoDb;
  const admin = () => db.getUser('demo-admin');
  const user = () => db.getUser('demo-user');

  beforeEach(() => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(DemoDb);
  });

  it('genera datos sintéticos coherentes', () => {
    expect(db.listCategories()).toHaveLength(8);
    expect(db.listSuppliers()).toHaveLength(12);
    expect(db.listProducts({})).toHaveLength(120);
    expect(db.listOrders(admin(), {}).length).toBeGreaterThan(500);
  });

  it('crea pedidos descontando stock y emite actividad', async () => {
    const product = db.listProducts({ activeOnly: true }).find((item) => item.stock > 5);
    if (!product) {
      throw new Error('sin producto');
    }
    const order = db.createOrder(user(), {
      items: [{ productId: product.id, quantity: 2 }],
      notes: null,
    });
    expect(order.total).toBeCloseTo(product.price * 2);
    expect(db.listProducts({}).find((item) => item.id === product.id)?.stock).toBe(
      product.stock - 2,
    );
    const [latest] = await firstValueFrom(db.activity$(1));
    expect(latest?.type).toBe('order_created');
  });

  it('rechaza pedidos sin stock suficiente sin modificar nada', () => {
    const product = db.listProducts({ activeOnly: true })[0];
    if (!product) {
      throw new Error('sin producto');
    }
    expect(() =>
      db.createOrder(user(), {
        items: [{ productId: product.id, quantity: product.stock + 1 }],
        notes: null,
      }),
    ).toThrow(DemoHttpError);
    expect(db.listProducts({}).find((item) => item.id === product.id)?.stock).toBe(product.stock);
  });

  it('al cancelar repone stock y notifica al cliente', async () => {
    const product = db.listProducts({ activeOnly: true }).find((item) => item.stock > 3);
    if (!product) {
      throw new Error('sin producto');
    }
    const order = db.createOrder(user(), {
      items: [{ productId: product.id, quantity: 3 }],
      notes: null,
    });
    db.updateOrderStatus(order.id, 'cancelled', 'Admin');
    expect(db.listProducts({}).find((item) => item.id === product.id)?.stock).toBe(product.stock);
    const notifications = await firstValueFrom(db.notifications$('demo-user'));
    expect(notifications[0]?.title).toContain(`#${order.id}`);
    expect(() => db.updateOrderStatus(order.id, 'shipped', 'Admin')).toThrow(DemoHttpError);
  });

  it('un usuario solo ve sus pedidos', () => {
    const orders = db.listOrders(user(), {});
    expect(orders.every((order) => order.userId === 'demo-user')).toBe(true);
    const foreign = db.listOrders(admin(), {}).find((order) => order.userId !== 'demo-user');
    expect(() => db.getOrder(user(), foreign?.id ?? 0)).toThrow(DemoHttpError);
  });

  it('calcula estadísticas con periodo anterior y meses completos', () => {
    const filter = { from: '2026-01-01', to: '2026-06-30', categoryId: null, status: null };
    expect(db.salesByMonth(filter)).toHaveLength(6);
    expect(db.ordersByStatus(filter)).toHaveLength(4);
    expect(db.topProducts(filter).length).toBeLessThanOrEqual(5);
    const kpis = db.kpis(filter);
    expect(kpis.avgTicket).toBeCloseTo(kpis.orders ? kpis.revenue / kpis.orders : 0, 1);
  });

  it('valida duplicados de correo y SKU', () => {
    expect(db.isEmailAvailable('ADMIN@stockpilot.demo')).toBe(false);
    expect(db.isSkuAvailable('ele-0001')).toBe(false);
    expect(db.isSkuAvailable('ELE-0001', 1)).toBe(true);
  });

  it('impide que un usuario cambie su propio rol', () => {
    expect(() => db.updateUser('demo-admin', { role: 'user' }, 'demo-admin')).toThrow(
      DemoHttpError,
    );
  });
});

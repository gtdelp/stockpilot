import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import {
  ActivityEvent,
  ActivityType,
  AppNotification,
  Category,
  CategoryInput,
  CreateUserInput,
  Kpis,
  Order,
  OrderInput,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  Product,
  ProductInput,
  RegisterInput,
  Role,
  SeriesPoint,
  StatsFilter,
  Supplier,
  SupplierInput,
  UserProfile,
} from '../models';
import { DemoDataset, DemoOrder, generateDemoData } from './demo-data';

/** Error HTTP simulado con la misma forma que los de la API real. */
export class DemoHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Abreviaturas de los meses en español. */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Base de datos en memoria del modo demostración. Reproduce las reglas de
 * negocio de la API real (validaciones, permisos, stock, eventos) para que la
 * app sea completamente funcional sin servicios externos.
 */
@Injectable({ providedIn: 'root' })
export class DemoDb {
  private readonly data: DemoDataset = generateDemoData();
  private readonly activitySubject = new BehaviorSubject<ActivityEvent[]>(this.data.activity);
  private readonly notificationsSubject = new BehaviorSubject<Record<string, AppNotification[]>>(
    {},
  );
  private sequence = 1;

  // ---------------------------------------------------------------- Usuarios

  /** Busca un usuario por correo. */
  findUserByEmail(email: string): UserProfile | undefined {
    return this.data.users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
  }

  /** Devuelve el perfil de un usuario o lanza 404. */
  getUser(id: string): UserProfile {
    const user = this.data.users.find((candidate) => candidate.id === id);
    if (!user) {
      throw new DemoHttpError(404, 'PROFILE_NOT_FOUND', 'No existe un perfil para esta cuenta.');
    }
    return { ...user };
  }

  /** Lista todos los usuarios ordenados por nombre. */
  listUsers(): UserProfile[] {
    return [...this.data.users].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }

  /** Indica si un correo está libre. */
  isEmailAvailable(email: string): boolean {
    return !this.findUserByEmail(email);
  }

  /** Registra una cuenta con rol de usuario estándar. */
  register(input: RegisterInput): UserProfile {
    return this.createUser({ ...input, role: 'user' }, input.fullName);
  }

  /** Crea un usuario con el rol indicado. */
  createUser(input: CreateUserInput, actorName: string): UserProfile {
    if (!this.isEmailAvailable(input.email)) {
      throw new DemoHttpError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo.');
    }
    const user: UserProfile = {
      id: `demo-${Date.now()}-${this.sequence++}`,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      role: input.role,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(user);
    this.addActivity('user_created', `Nueva cuenta: ${user.fullName}`, actorName);
    return { ...user };
  }

  /** Actualiza nombre y/o rol de un usuario. */
  updateUser(
    id: string,
    changes: { fullName?: string; role?: Role },
    actorId: string,
  ): UserProfile {
    const user = this.data.users.find((candidate) => candidate.id === id);
    if (!user) {
      throw new DemoHttpError(404, 'NOT_FOUND', 'Usuario no encontrado.');
    }
    if (changes.role && id === actorId && changes.role !== user.role) {
      throw new DemoHttpError(409, 'SELF_ROLE', 'No puedes cambiar tu propio rol.');
    }
    if (changes.fullName !== undefined) {
      user.fullName = changes.fullName.trim();
    }
    if (changes.role) {
      user.role = changes.role;
    }
    return { ...user };
  }

  // -------------------------------------------------------------- Catálogo

  /** Lista categorías con su número de productos. */
  listCategories(): Category[] {
    return this.data.categories.map((category) => ({
      ...category,
      productCount: this.data.products.filter((product) => product.categoryId === category.id)
        .length,
    }));
  }

  /** Crea o actualiza una categoría. */
  saveCategory(input: CategoryInput, id?: number): Category {
    const duplicate = this.data.categories.find(
      (category) =>
        category.name.toLowerCase() === input.name.trim().toLowerCase() && category.id !== id,
    );
    if (duplicate) {
      throw new DemoHttpError(409, 'DUPLICATE', 'Ya existe una categoría con ese nombre.');
    }
    if (id) {
      const category = this.data.categories.find((candidate) => candidate.id === id);
      if (!category) {
        throw new DemoHttpError(404, 'NOT_FOUND', 'Categoría no encontrada.');
      }
      Object.assign(category, { name: input.name.trim(), description: input.description });
      this.data.products
        .filter((product) => product.categoryId === id)
        .forEach((product) => (product.categoryName = category.name));
    } else {
      this.data.categories.push({
        id: Math.max(0, ...this.data.categories.map((category) => category.id)) + 1,
        name: input.name.trim(),
        description: input.description,
      });
    }
    const saved = this.listCategories().find((category) =>
      id ? category.id === id : category.name === input.name.trim(),
    );
    return saved as Category;
  }

  /** Elimina una categoría sin productos. */
  deleteCategory(id: number): void {
    if (this.data.products.some((product) => product.categoryId === id)) {
      throw new DemoHttpError(409, 'IN_USE', 'La categoría tiene productos asociados.');
    }
    this.data.categories = this.data.categories.filter((category) => category.id !== id);
  }

  /** Lista proveedores con su número de productos. */
  listSuppliers(): Supplier[] {
    return this.data.suppliers.map((supplier) => ({
      ...supplier,
      productCount: this.data.products.filter((product) => product.supplierId === supplier.id)
        .length,
    }));
  }

  /** Crea o actualiza un proveedor. */
  saveSupplier(input: SupplierInput, id?: number): Supplier {
    if (id) {
      const supplier = this.data.suppliers.find((candidate) => candidate.id === id);
      if (!supplier) {
        throw new DemoHttpError(404, 'NOT_FOUND', 'Proveedor no encontrado.');
      }
      Object.assign(supplier, input);
      this.data.products
        .filter((product) => product.supplierId === id)
        .forEach((product) => (product.supplierName = supplier.name));
      return this.listSuppliers().find((candidate) => candidate.id === id) as Supplier;
    }
    const newId = Math.max(0, ...this.data.suppliers.map((supplier) => supplier.id)) + 1;
    this.data.suppliers.push({ id: newId, ...input });
    return this.listSuppliers().find((candidate) => candidate.id === newId) as Supplier;
  }

  /** Elimina un proveedor sin productos. */
  deleteSupplier(id: number): void {
    if (this.data.products.some((product) => product.supplierId === id)) {
      throw new DemoHttpError(409, 'IN_USE', 'El proveedor tiene productos asociados.');
    }
    this.data.suppliers = this.data.suppliers.filter((supplier) => supplier.id !== id);
  }

  // ------------------------------------------------------------- Productos

  /** Lista productos con filtros opcionales. */
  listProducts(filter: {
    categoryId?: number;
    lowStock?: boolean;
    activeOnly?: boolean;
  }): Product[] {
    return this.data.products
      .filter((product) => !filter.categoryId || product.categoryId === filter.categoryId)
      .filter((product) => !filter.lowStock || product.stock <= product.minStock)
      .filter((product) => !filter.activeOnly || product.active)
      .map((product) => ({ ...product }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  /** Indica si un SKU está libre (ignorando el producto `excludeId`). */
  isSkuAvailable(sku: string, excludeId?: number): boolean {
    return !this.data.products.some(
      (product) =>
        product.sku.toUpperCase() === sku.trim().toUpperCase() && product.id !== excludeId,
    );
  }

  /** Crea o actualiza un producto. */
  saveProduct(input: ProductInput, actorName: string, id?: number): Product {
    if (!this.isSkuAvailable(input.sku, id)) {
      throw new DemoHttpError(409, 'SKU_TAKEN', 'Ya existe un producto con ese SKU.');
    }
    const category = this.data.categories.find((candidate) => candidate.id === input.categoryId);
    const supplier = this.data.suppliers.find((candidate) => candidate.id === input.supplierId);
    if (!category || !supplier) {
      throw new DemoHttpError(400, 'VALIDATION', 'Categoría o proveedor no válidos.');
    }
    const values = {
      ...input,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
      categoryName: category.name,
      supplierName: supplier.name,
      updatedAt: new Date().toISOString(),
    };
    let product: Product;
    if (id) {
      const existing = this.data.products.find((candidate) => candidate.id === id);
      if (!existing) {
        throw new DemoHttpError(404, 'NOT_FOUND', 'Producto no encontrado.');
      }
      product = Object.assign(existing, values);
      this.addActivity('product_updated', `Producto actualizado: ${product.name}`, actorName);
    } else {
      product = {
        id: Math.max(0, ...this.data.products.map((candidate) => candidate.id)) + 1,
        ...values,
      };
      this.data.products.push(product);
      this.addActivity('product_updated', `Producto creado: ${product.name}`, actorName);
    }
    this.checkLowStock(product);
    return { ...product };
  }

  /** Elimina un producto que no figure en ningún pedido. */
  deleteProduct(id: number): void {
    if (this.data.orders.some((order) => order.items.some((item) => item.productId === id))) {
      throw new DemoHttpError(
        409,
        'IN_USE',
        'El producto figura en pedidos. Desactívalo en lugar de eliminarlo.',
      );
    }
    this.data.products = this.data.products.filter((product) => product.id !== id);
  }

  // --------------------------------------------------------------- Pedidos

  /** Lista pedidos (todos para admin, propios para usuario). */
  listOrders(
    user: UserProfile,
    filter: { status?: OrderStatus; from?: string; to?: string },
  ): Order[] {
    return this.data.orders
      .filter((order) => user.role === 'admin' || order.userId === user.id)
      .filter((order) => !filter.status || order.status === filter.status)
      .filter((order) => inRange(order.createdAt, filter.from, filter.to))
      .map((order) => this.toOrder(order, false))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Devuelve un pedido con sus líneas si el usuario tiene permiso. */
  getOrder(user: UserProfile, id: number): Order {
    const order = this.data.orders.find((candidate) => candidate.id === id);
    if (!order || (user.role !== 'admin' && order.userId !== user.id)) {
      throw new DemoHttpError(404, 'NOT_FOUND', 'Pedido no encontrado.');
    }
    return this.toOrder(order, true);
  }

  /** Crea un pedido descontando stock (operación atómica). */
  createOrder(user: UserProfile, input: OrderInput): Order {
    if (!input.items.length) {
      throw new DemoHttpError(400, 'VALIDATION', 'El pedido debe tener al menos una línea.');
    }
    const lines = input.items.map((line) => {
      const product = this.data.products.find((candidate) => candidate.id === line.productId);
      if (!product || !product.active) {
        throw new DemoHttpError(400, 'VALIDATION', 'Hay productos no disponibles en el pedido.');
      }
      if (line.quantity < 1 || line.quantity > product.stock) {
        throw new DemoHttpError(
          409,
          'INSUFFICIENT_STOCK',
          `Stock insuficiente para ${product.name}.`,
        );
      }
      return { product, quantity: line.quantity };
    });
    lines.forEach(({ product, quantity }) => (product.stock -= quantity));
    const order: DemoOrder = {
      id: Math.max(0, ...this.data.orders.map((candidate) => candidate.id)) + 1,
      userId: user.id,
      customerName: user.fullName,
      status: 'pending',
      items: lines.map(({ product, quantity }) => ({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        categoryId: product.categoryId,
      })),
      total: round2(
        lines.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0),
      ),
      itemCount: lines.reduce((sum, { quantity }) => sum + quantity, 0),
      createdAt: new Date().toISOString(),
      notes: input.notes,
    };
    this.data.orders.push(order);
    this.addActivity(
      'order_created',
      `Nuevo pedido #${order.id} por ${euros(order.total)}`,
      user.fullName,
    );
    lines.forEach(({ product }) => this.checkLowStock(product));
    return this.toOrder(order, true);
  }

  /** Cambia el estado de un pedido; cancelar repone el stock. */
  updateOrderStatus(id: number, status: OrderStatus, actorName: string): Order {
    const order = this.data.orders.find((candidate) => candidate.id === id);
    if (!order) {
      throw new DemoHttpError(404, 'NOT_FOUND', 'Pedido no encontrado.');
    }
    if (order.status === 'cancelled') {
      throw new DemoHttpError(
        409,
        'INVALID_TRANSITION',
        'Un pedido cancelado no puede cambiar de estado.',
      );
    }
    if (status === 'cancelled') {
      order.items.forEach((item) => {
        const product = this.data.products.find((candidate) => candidate.id === item.productId);
        if (product) {
          product.stock += item.quantity;
        }
      });
    }
    order.status = status;
    this.addActivity(
      'order_status',
      `Pedido #${order.id}: ${ORDER_STATUS_LABELS[status]}`,
      actorName,
    );
    this.notify(
      order.userId,
      `Pedido #${order.id} actualizado`,
      `Nuevo estado: ${ORDER_STATUS_LABELS[status]}.`,
    );
    return this.toOrder(order, true);
  }

  // ---------------------------------------------------------- Estadísticas

  /** KPIs del periodo y del periodo anterior equivalente. */
  kpis(filter: StatsFilter): Kpis {
    const current = this.aggregate(filter.from, filter.to, filter);
    const span = new Date(filter.to).getTime() - new Date(filter.from).getTime() + 86_400_000;
    const prevTo = new Date(new Date(filter.from).getTime() - 86_400_000);
    const prevFrom = new Date(new Date(filter.from).getTime() - span);
    const previous = this.aggregate(isoDate(prevFrom), isoDate(prevTo), filter);
    return {
      revenue: current.revenue,
      revenuePrev: previous.revenue,
      orders: current.orders,
      ordersPrev: previous.orders,
      pendingOrders: this.data.orders.filter(
        (order) => order.status === 'pending' && matchesCategory(order, filter.categoryId),
      ).length,
      lowStock: this.data.products.filter(
        (product) =>
          product.active &&
          product.stock <= product.minStock &&
          (!filter.categoryId || product.categoryId === filter.categoryId),
      ).length,
      avgTicket: current.orders ? round2(current.revenue / current.orders) : 0,
      avgTicketPrev: previous.orders ? round2(previous.revenue / previous.orders) : 0,
    };
  }

  /** Ventas por mes dentro del periodo (meses sin ventas = 0). */
  salesByMonth(filter: StatsFilter): SeriesPoint[] {
    const points = new Map<string, number>();
    const cursor = new Date(`${filter.from}T00:00:00`);
    cursor.setDate(1);
    const end = new Date(`${filter.to}T00:00:00`);
    while (cursor <= end) {
      points.set(monthKey(cursor), 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const order of this.filteredOrders(filter.from, filter.to, filter)) {
      const key = monthKey(new Date(order.createdAt));
      if (points.has(key)) {
        points.set(key, (points.get(key) ?? 0) + revenueOf(order, filter.categoryId));
      }
    }
    return [...points.entries()].map(([key, value]) => {
      const [year, month] = key.split('-').map(Number) as [number, number];
      return { key, label: `${MONTHS[month - 1]} ${String(year).slice(2)}`, value: round2(value) };
    });
  }

  /** Unidades en stock por categoría. */
  stockByCategory(filter: StatsFilter): SeriesPoint[] {
    return this.data.categories
      .filter((category) => !filter.categoryId || category.id === filter.categoryId)
      .map((category) => ({
        key: category.id,
        label: category.name,
        value: this.data.products
          .filter((product) => product.categoryId === category.id && product.active)
          .reduce((sum, product) => sum + product.stock, 0),
      }));
  }

  /** Cinco productos con más facturación en el periodo. */
  topProducts(filter: StatsFilter): SeriesPoint[] {
    const totals = new Map<number, { label: string; value: number }>();
    for (const order of this.filteredOrders(filter.from, filter.to, filter)) {
      for (const item of order.items) {
        if (filter.categoryId && item.categoryId !== filter.categoryId) {
          continue;
        }
        const entry = totals.get(item.productId) ?? { label: item.productName, value: 0 };
        entry.value += item.quantity * item.unitPrice;
        totals.set(item.productId, entry);
      }
    }
    return [...totals.entries()]
      .map(([key, entry]) => ({ key, label: entry.label, value: round2(entry.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  /** Número de pedidos por estado en el periodo. */
  ordersByStatus(filter: StatsFilter): SeriesPoint[] {
    const orders = this.data.orders.filter(
      (order) =>
        inRange(order.createdAt, filter.from, filter.to) &&
        matchesCategory(order, filter.categoryId),
    );
    return ORDER_STATUSES.map((status) => ({
      key: status,
      label: ORDER_STATUS_LABELS[status],
      value: orders.filter((order) => order.status === status).length,
    }));
  }

  // ---------------------------------------------------------- Tiempo real

  /** Feed de actividad (más reciente primero). */
  activity$(max: number): Observable<ActivityEvent[]> {
    return this.activitySubject.pipe(map((events) => events.slice(0, max)));
  }

  /** Notificaciones de un usuario. */
  notifications$(uid: string): Observable<AppNotification[]> {
    return this.notificationsSubject.pipe(map((all) => all[uid] ?? []));
  }

  /** Marca una notificación como leída. */
  markNotificationRead(uid: string, id: string): void {
    const all = this.notificationsSubject.value;
    this.notificationsSubject.next({
      ...all,
      [uid]: (all[uid] ?? []).map((item) => (item.id === id ? { ...item, read: true } : item)),
    });
  }

  /** Genera un evento sintético (simula la actividad de otros usuarios). */
  simulateExternalActivity(): void {
    const product = this.data.products[Math.floor(Math.random() * this.data.products.length)];
    if (product) {
      this.addActivity(
        'product_updated',
        `Recuento de inventario: ${product.name}`,
        'Almacén central',
      );
    }
  }

  // ------------------------------------------------------------- Internos

  private addActivity(type: ActivityType, message: string, actorName: string): void {
    const event: ActivityEvent = {
      id: `evt-${Date.now()}-${this.sequence++}`,
      type,
      message,
      actorName,
      createdAt: new Date().toISOString(),
    };
    this.activitySubject.next([event, ...this.activitySubject.value].slice(0, 50));
  }

  private notify(uid: string, title: string, body: string): void {
    const all = this.notificationsSubject.value;
    const item: AppNotification = {
      id: `ntf-${Date.now()}-${this.sequence++}`,
      title,
      body,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notificationsSubject.next({ ...all, [uid]: [item, ...(all[uid] ?? [])].slice(0, 30) });
  }

  private checkLowStock(product: Product): void {
    if (product.active && product.stock <= product.minStock) {
      this.addActivity(
        'low_stock',
        `Stock bajo: ${product.name} (${product.stock} uds.)`,
        'Sistema',
      );
      this.data.users
        .filter((user) => user.role === 'admin')
        .forEach((admin) =>
          this.notify(admin.id, 'Stock bajo', `${product.name} tiene ${product.stock} unidades.`),
        );
    }
  }

  private filteredOrders(from: string, to: string, filter: StatsFilter): DemoOrder[] {
    return this.data.orders.filter(
      (order) =>
        inRange(order.createdAt, from, to) &&
        (filter.status ? order.status === filter.status : order.status !== 'cancelled') &&
        matchesCategory(order, filter.categoryId),
    );
  }

  private aggregate(
    from: string,
    to: string,
    filter: StatsFilter,
  ): { revenue: number; orders: number } {
    const orders = this.filteredOrders(from, to, filter);
    return {
      revenue: round2(orders.reduce((sum, order) => sum + revenueOf(order, filter.categoryId), 0)),
      orders: orders.length,
    };
  }

  private toOrder(order: DemoOrder, withItems: boolean): Order {
    const { items, ...rest } = order;
    return withItems
      ? {
          ...rest,
          items: items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }
      : { ...rest };
  }
}

/** Comprueba si una fecha ISO está dentro del rango (ambos extremos incluidos). */
function inRange(iso: string, from?: string, to?: string): boolean {
  const time = new Date(iso).getTime();
  if (from && time < new Date(`${from}T00:00:00`).getTime()) {
    return false;
  }
  if (to && time >= new Date(`${to}T00:00:00`).getTime() + 86_400_000) {
    return false;
  }
  return true;
}

/** Indica si el pedido contiene productos de la categoría. */
function matchesCategory(order: DemoOrder, categoryId: number | null): boolean {
  return !categoryId || order.items.some((item) => item.categoryId === categoryId);
}

/** Importe del pedido (solo líneas de la categoría, si se indica). */
function revenueOf(order: DemoOrder, categoryId: number | null): number {
  return order.items
    .filter((item) => !categoryId || item.categoryId === categoryId)
    .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/** Clave AAAA-MM de una fecha. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Fecha local en formato AAAA-MM-DD. */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Redondea a dos decimales. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Importe con formato «12,34 €». */
function euros(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

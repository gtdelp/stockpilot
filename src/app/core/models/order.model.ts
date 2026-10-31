/** Estados posibles de un pedido. */
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

/** Línea de un pedido. */
export interface OrderItem {
  /** Identificador del producto. */
  productId: number;
  /** Código de producto (SKU). */
  sku: string;
  /** Nombre del producto. */
  productName: string;
  /** Unidades. */
  quantity: number;
  /** Precio unitario en el momento de la compra. */
  unitPrice: number;
}

/** Pedido realizado por un usuario. */
export interface Order {
  /** Identificador único. */
  id: number;
  /** Identificador del usuario. */
  userId: string;
  /** Nombre del cliente. */
  customerName: string;
  /** Estado. */
  status: OrderStatus;
  /** Importe total en euros. */
  total: number;
  /** Unidades totales del pedido. */
  itemCount: number;
  /** Fecha de creación (ISO 8601). */
  createdAt: string;
  /** Notas opcionales. */
  notes: string | null;
  /** Líneas del pedido (solo en el detalle). */
  items?: OrderItem[];
}

/** Datos para crear un pedido. */
export interface OrderInput {
  /** Líneas o elementos asociados. */
  items: { productId: number; quantity: number }[];
  /** Notas opcionales. */
  notes: string | null;
}

/** Filtros del listado de pedidos. */
export interface OrderFilter {
  /** Estado. */
  status?: OrderStatus | null;
  /** Fecha inicial (AAAA-MM-DD). */
  from?: string | null;
  /** Fecha final (AAAA-MM-DD). */
  to?: string | null;
}

/** Etiquetas legibles de cada estado. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  processing: 'En preparación',
  shipped: 'Enviado',
  cancelled: 'Cancelado',
};

/** Lista ordenada de estados para selectores. */
export const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'cancelled'];

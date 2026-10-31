import { OrderStatus } from './order.model';

/** Filtros del cuadro de mando. */
export interface StatsFilter {
  /** Fecha inicial (AAAA-MM-DD). */
  from: string;
  /** Fecha final (AAAA-MM-DD). */
  to: string;
  /** Identificador de la categoría. */
  categoryId: number | null;
  /** Estado. */
  status: OrderStatus | null;
}

/** Indicadores clave del periodo y del periodo anterior equivalente. */
export interface Kpis {
  /** Ventas del periodo en euros. */
  revenue: number;
  /** Ventas del periodo anterior equivalente. */
  revenuePrev: number;
  /** Número de pedidos o lista de pedidos. */
  orders: number;
  /** Pedidos del periodo anterior equivalente. */
  ordersPrev: number;
  /** Pedidos pendientes de preparar. */
  pendingOrders: number;
  /** Productos con stock bajo (o filtro de stock bajo). */
  lowStock: number;
  /** Importe medio por pedido. */
  avgTicket: number;
  /** Importe medio del periodo anterior. */
  avgTicketPrev: number;
}

/** Punto de una serie para gráficos. */
export interface SeriesPoint {
  /** Texto visible. */
  label: string;
  /** Valor numérico. */
  value: number;
  /** Clave asociada (id de categoría, estado...) para filtrar al hacer clic. */
  key?: string | number;
}

/** Datos consolidados del cuadro de mando. */
export interface DashboardData {
  /** Indicadores clave. */
  kpis: Kpis;
  /** Ventas agrupadas por mes. */
  salesByMonth: SeriesPoint[];
  /** Unidades en stock por categoría. */
  stockByCategory: SeriesPoint[];
  /** Productos con más facturación. */
  topProducts: SeriesPoint[];
  /** Pedidos por estado. */
  ordersByStatus: SeriesPoint[];
}

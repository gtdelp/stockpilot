/** Formateador de euros (es-ES). */
const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
/** Formateador de números (es-ES). */
const numberFormatter = new Intl.NumberFormat('es-ES');
/** Formateador de porcentajes (es-ES). */
const percentFormatter = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 1,
});
/** Formateador de fechas DD/MM/AAAA. */
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
/** Formateador de fecha y hora. */
const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Formatea un importe en euros. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Formatea un número con separadores de miles. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Formatea una proporción (0.25 → 25 %). */
export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

/** Formatea una fecha ISO como DD/MM/AAAA. */
export function formatDate(value: string | Date): string {
  return dateFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** Formatea una fecha ISO con hora. */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** Tiempo relativo breve en español ("hace 5 min"). */
export function formatRelative(value: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) {
    return 'ahora mismo';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

/** Variación relativa entre dos valores (null si no hay base de comparación). */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

/** Iniciales de un nombre para avatares. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

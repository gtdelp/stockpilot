/** Definición de una columna exportable. */
export interface ExportColumn<T> {
  /** Cabecera visible. */
  header: string;
  /** Valor de la celda para una fila. */
  value: (row: T) => string | number | boolean | null | undefined;
  /** Alineación en el PDF. */
  align?: 'left' | 'right' | 'center';
}

/** Separador por defecto: `;` para que Excel en español abra el archivo en columnas. */
export const CSV_SEPARATOR = ';';

/**
 * Escapa un valor según RFC 4180: si contiene separador, comillas o saltos
 * de línea se envuelve en comillas dobles y las comillas internas se duplican.
 * También neutraliza fórmulas (inyección CSV) anteponiendo un apóstrofo.
 */
export function escapeCsvValue(value: unknown, separator = CSV_SEPARATOR): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = typeof value === 'number' ? formatCsvNumber(value) : String(value);
  // Evita que hojas de cálculo interpreten el texto como fórmula
  if (/^[=+\-@\t\r]/.test(text) && typeof value !== 'number') {
    text = `'${text}`;
  }
  const mustQuote = text.includes(separator) || text.includes('"') || /[\r\n]/.test(text);
  return mustQuote ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Formatea números con coma decimal (configuración regional española). */
function formatCsvNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
}

/**
 * Construye el contenido CSV (con cabecera) a partir de filas y columnas.
 * Las líneas se separan con CRLF como indica RFC 4180.
 */
export function buildCsv<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
  separator = CSV_SEPARATOR,
): string {
  const header = columns.map((column) => escapeCsvValue(column.header, separator)).join(separator);
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row), separator)).join(separator),
  );
  return [header, ...lines].join('\r\n');
}

/** Nombre de archivo normalizado: `stockpilot_<entidad>_<AAAA-MM-DD>.<ext>`. */
export function exportFileName(
  entity: string,
  extension: 'csv' | 'pdf',
  date = new Date(),
): string {
  const slug = entity
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `stockpilot_${slug}_${toIsoDate(date)}.${extension}`;
}

/** Devuelve la fecha en formato AAAA-MM-DD (hora local). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

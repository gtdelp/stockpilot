import { buildCsv, escapeCsvValue, exportFileName } from './csv';

describe('utilidades CSV', () => {
  it('escapa separadores, comillas y saltos de línea (RFC 4180)', () => {
    expect(escapeCsvValue('simple')).toBe('simple');
    expect(escapeCsvValue('a;b')).toBe('"a;b"');
    expect(escapeCsvValue('dice "hola"')).toBe('"dice ""hola"""');
    expect(escapeCsvValue('línea\nnueva')).toBe('"línea\nnueva"');
  });

  it('formatea números con coma decimal y deja vacíos los nulos', () => {
    expect(escapeCsvValue(12.5)).toBe('12,50');
    expect(escapeCsvValue(7)).toBe('7');
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('neutraliza fórmulas para evitar inyección CSV', () => {
    expect(escapeCsvValue('=SUMA(A1)')).toBe("'=SUMA(A1)");
    expect(escapeCsvValue(-5)).toBe('-5');
  });

  it('construye cabecera y filas separadas por CRLF', () => {
    const csv = buildCsv(
      [
        { name: 'Folios', price: 4.5 },
        { name: 'Caja; grande', price: 10 },
      ],
      [
        { header: 'Producto', value: (row) => row.name },
        { header: 'Precio', value: (row) => row.price },
      ],
    );
    expect(csv).toBe('Producto;Precio\r\nFolios;4,50\r\n"Caja; grande";10');
  });

  it('genera nombres de archivo normalizados', () => {
    expect(exportFileName('Cuadro de mando', 'pdf', new Date(2026, 0, 5))).toBe(
      'stockpilot_cuadro-de-mando_2026-01-05.pdf',
    );
    expect(exportFileName('Categorías', 'csv', new Date(2026, 10, 30))).toBe(
      'stockpilot_categorias_2026-11-30.csv',
    );
  });
});

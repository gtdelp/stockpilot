import { formatCurrency, formatRelative, initials, relativeChange } from './format';

describe('utilidades de formato', () => {
  it('calcula la variación relativa y evita dividir por cero', () => {
    expect(relativeChange(120, 100)).toBeCloseTo(0.2);
    expect(relativeChange(80, 100)).toBeCloseTo(-0.2);
    expect(relativeChange(10, 0)).toBeNull();
  });

  it('obtiene las iniciales de un nombre', () => {
    expect(initials('Lucía Romero García')).toBe('LR');
    expect(initials('  ana ')).toBe('A');
  });

  it('formatea tiempos relativos en español', () => {
    const now = new Date('2026-10-31T12:00:00Z').getTime();
    expect(formatRelative('2026-10-31T11:59:30Z', now)).toBe('ahora mismo');
    expect(formatRelative('2026-10-31T11:45:00Z', now)).toBe('hace 15 min');
    expect(formatRelative('2026-10-31T09:00:00Z', now)).toBe('hace 3 h');
    expect(formatRelative('2026-10-30T12:00:00Z', now)).toBe('hace 1 día');
  });

  it('formatea importes en euros', () => {
    expect(formatCurrency(1234.5).replace(/\s/g, ' ')).toBe('1234,50 €');
  });
});

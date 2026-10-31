import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/** Auditoría automática WCAG 2.2 AA con axe-core en las vistas principales. */
async function audit(page: import('@playwright/test').Page) {
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
  expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

test.describe('accesibilidad (axe-core)', () => {
  test('login', async ({ page }) => {
    await page.goto('/login');
    await audit(page);
  });

  test('cuadro de mando', async ({ page }) => {
    await loginAs(page, 'admin');
    await audit(page);
  });

  test('productos', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/productos');
    await audit(page);
  });

  test('nuevo pedido', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/pedidos/nuevo');
    await audit(page);
  });

  test('el enlace "Saltar al contenido" es lo primero al tabular', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });
});

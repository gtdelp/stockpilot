import { expect, test } from '@playwright/test';
import { chooseOption, loginAs } from './helpers';

test.describe('flujos principales', () => {
  test('un usuario crea un pedido y aparece en su listado', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/pedidos/nuevo');
    await chooseOption(page, /Producto de la línea 1/, /ELE-0001/);
    await page.getByRole('spinbutton', { name: 'Cantidad de la línea 1' }).fill('2');
    await expect(page.getByText(/Total/).last()).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page).toHaveURL(/\/pedidos$/);
    await expect(page.getByText(/Pedido #\d+ creado correctamente/)).toBeVisible();
  });

  test('exporta el catálogo a CSV con el nombre normalizado', async ({ page }) => {
    await loginAs(page, 'user');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^stockpilot_productos_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('exporta los pedidos a PDF', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/pedidos');
    await expect(page.getByText(/de \d+/).first()).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^stockpilot_pedidos_.*\.pdf$/);
  });

  test('busca en la tabla de productos', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/productos');
    await page.getByPlaceholder('Buscar por nombre, SKU, categoría…').fill('ELE-0001');
    await expect(page.getByText('1–1 de 1')).toBeVisible();
  });

  test('el administrador cambia el estado de un pedido', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/pedidos');
    await chooseOption(page, /^Estado/, 'Pendiente');
    const desktop = (page.viewportSize()?.width ?? 0) >= 768;
    const target = desktop
      ? page.getByRole('row', { name: /Ver detalle de #/ }).first()
      : page.locator('.dt__card-title--link').first();
    await target.click();
    await chooseOption(page, /^Cambiar estado/, 'En preparación');
    await page.getByRole('button', { name: 'Guardar estado' }).click();
    await expect(page.getByText(/Pedido #\d+: En preparación/).first()).toBeVisible();
  });

  test('la ayuda contextual se abre desde la cabecera', async ({ page }) => {
    await loginAs(page, 'user');
    await page.getByRole('button', { name: 'Ayuda sobre Catálogo' }).click();
    await expect(
      page.getByRole('heading', { name: 'Ayuda: Productos e inventario' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Ayuda: Productos e inventario' })).toBeHidden();
  });
});

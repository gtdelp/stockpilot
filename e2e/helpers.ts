import { Page, expect } from '@playwright/test';

/** Inicia sesión con una cuenta de demostración. */
export async function loginAs(page: Page, role: 'admin' | 'user'): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page
    .getByRole('button', { name: role === 'admin' ? 'Administrador' : 'Usuario estándar' })
    .click();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(role === 'admin' ? /\/panel$/ : /\/productos$/);
}

/** Abre el menú lateral en pantallas estrechas. */
export async function openMenuIfNeeded(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Abrir menú de navegación' });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
}

/** Elige una opción de un `ion-select` (interfaz popover o modal) por su texto. */
export async function chooseOption(
  page: Page,
  selectName: RegExp,
  option: string | RegExp,
): Promise<void> {
  await page
    .getByRole('button', { name: selectName })
    .filter({ visible: true })
    .first()
    .click({ force: true });
  const overlay = page.locator('ion-popover.select-popover, ion-modal ion-select-modal').last();
  await overlay.getByRole('radio', { name: option }).first().click();
  await expect(overlay).toBeHidden();
}

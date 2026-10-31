import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('autenticación y control de acceso', () => {
  test('redirige al login al entrar sin sesión y vuelve a la URL pedida', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpedidos/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await page.getByLabel('Correo electrónico').fill('usuario@stockpilot.demo');
    await page.getByLabel('Contraseña', { exact: true }).fill('demostracion');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/pedidos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeVisible();
  });

  test('muestra errores de validación y foco en el primer campo inválido', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();
  });

  test('rechaza credenciales incorrectas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('nadie@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta1');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
  });

  test('el usuario estándar no puede acceder al cuadro de mando (403)', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/403$/);
    await expect(page.getByText('Acceso denegado (403)')).toBeVisible();
  });

  test('el administrador ve el cuadro de mando con datos', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Cuadro de mando' })).toBeVisible();
    await expect(page.getByText('Ventas del periodo')).toBeVisible();
    await expect(
      page.getByRole('group', { name: /Ventas del periodo: [1-9][\d.]*,\d{2}\s€/ }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Actividad en tiempo real')).toBeVisible();
  });

  test('valida de forma asíncrona que el correo no esté registrado', async ({ page }) => {
    await page.goto('/registro');
    const email = page.getByLabel('Correo electrónico');
    await email.fill('admin@stockpilot.demo');
    await email.blur();
    await expect(page.getByText('Ya existe una cuenta con este correo.')).toBeVisible();
  });

  test('cierra la sesión', async ({ page }) => {
    await loginAs(page, 'user');
    const toggle = page.getByRole('button', { name: 'Abrir menú de navegación' });
    if (await toggle.isVisible()) {
      await toggle.click();
    }
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

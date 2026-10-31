import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E sobre el build de producción en modo demostración
 * (backend simulado: no necesitan servicios externos ni credenciales).
 * Antes: `npm run build:e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  workers: process.env['CI'] ? 2 : 3,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    locale: 'es-ES',
    trace: 'retain-on-failure',
    // El service worker precarga todos los chunks y falsea los tiempos de los tests
    serviceWorkers: 'block',
    ...(process.env['PLAYWRIGHT_CHROME_PATH']
      ? { launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROME_PATH'] } }
      : {}),
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/serve-spa.mjs www/browser 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env['CI'],
  },
});

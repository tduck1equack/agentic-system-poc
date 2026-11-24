import { defineConfig, devices } from '@playwright/test';
const watch = process.env.PW_WATCH === '1';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: watch ? 180000 : 90000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { headless: !watch, launchOptions: { slowMo: watch ? 700 : 0 }, actionTimeout: 10000, navigationTimeout: 15000, baseURL: 'http://127.0.0.1:43001', trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'node --import tsx tests/browser/server.ts', url: 'http://127.0.0.1:43001', timeout: 90000, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 } },
});

import { defineConfig, devices } from '@playwright/test';

if (process.env.PICTOTREE_E2E !== '1') {
  throw new Error('Run npm run e2e from the repository root, not against an existing server');
}

export default defineConfig({
  testDir: '.',
  testMatch: ['smoke.spec.ts', 'regression.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: '/e2e-results/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '/e2e-results/report', open: 'never' }],
    ['json', { outputFile: '/e2e-results/results.json' }],
  ],
  use: {
    baseURL: 'http://app-e2e:5000',
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    trace: process.env.E2E_TRACE === '1' ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
  }],
});

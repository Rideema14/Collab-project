import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite. It drives the app against a REAL backend + PostgreSQL —
 * there are no mocked API responses anywhere in tests/e2e, deliberately: a
 * mock would only prove the frontend agrees with our own guess at the contract.
 *
 * Both servers must already be running (see tests/e2e/README.md and the
 * `e2e` job in .github/workflows/ci.yml).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // the suite shares one database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: process.env.E2E_APP_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Mobile-first is the house default (Playbook), so it is a first-class target.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});

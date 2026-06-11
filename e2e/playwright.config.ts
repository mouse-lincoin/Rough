import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ./collab-server.mjs',
      port: 3099,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command:
        'VITE_COLLAB_URL=ws://127.0.0.1:3099 pnpm --filter @rough/web build && pnpm --filter @rough/web preview --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_COLLAB_URL: 'ws://127.0.0.1:3099',
      },
    },
  ],
});

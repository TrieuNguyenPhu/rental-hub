import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
})

import { defineConfig } from '@playwright/test'
import path from 'node:path'

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = remoteBaseURL || 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL, headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' } }],
  webServer: remoteBaseURL ? undefined : [{
    command: 'npm run preview -- --host 127.0.0.1 --port 5173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  }, {
    command: 'npm run dev:media',
    url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: false,
    env: { NODE_ENV: 'development', SITE_ORIGIN: baseURL, MEDIA_PORT: '3001', IMAGES_ROOT: path.resolve('.media/e2e/images'), TEMP_ROOT: path.resolve('.media/e2e/tmp') },
  }],
})

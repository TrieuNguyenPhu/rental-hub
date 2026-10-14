import { defineConfig } from '@playwright/test'
import path from 'node:path'

const remoteBaseURL = process.env.SITE_URL || process.env.PLAYWRIGHT_BASE_URL
const baseURL = remoteBaseURL || 'http://127.0.0.1:5173'
const uploadUser = process.env.UPLOAD_TEST_USER
const uploadPassword = process.env.UPLOAD_TEST_PASSWORD
if (Boolean(uploadUser) !== Boolean(uploadPassword)) throw new Error('Set both upload test credentials')
const origin = new URL(baseURL)
const loopback = ['127.0.0.1', 'localhost'].includes(origin.hostname)
if (uploadUser && origin.protocol !== 'https:' && !loopback) throw new Error('Upload credentials require HTTPS')

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: process.env.SITE_URL ? ['**/images.spec.ts'] : ['**/production.spec.ts'],
  fullyParallel: true,
  use: {
    baseURL, headless: true, screenshot: 'only-on-failure', trace: uploadUser ? 'off' : 'retain-on-failure',
    httpCredentials: uploadUser && uploadPassword ? { username: uploadUser, password: uploadPassword, origin: origin.origin } : undefined,
    // Self-signed TLS is only permitted for the explicit local integration fixture.
    ignoreHTTPSErrors: process.env.LOCAL_TLS_TEST === '1' && loopback,
  },
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

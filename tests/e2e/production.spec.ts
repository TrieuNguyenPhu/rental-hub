import { test, expect, request as requestFactory } from '@playwright/test'
import sharp from 'sharp'
import { createBuilding, createRoom } from './helpers'

test('production serves the expected release, real assets and strict static errors', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const sha = process.env.EXPECTED_RELEASE
  expect(sha).toMatch(/^[a-f0-9]{40}$/)
  const manifest = await request.get('/release.json')
  expect(manifest.status()).toBe(200)
  expect(manifest.headers()['cache-control']).toMatch(/no-cache|no-store/)
  expect((await manifest.json()).releaseId).toBe(sha)
  expect(await (await request.get('/api/health')).json()).toEqual({ status: 'ok', releaseId: sha })
  await page.goto('/rooms')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Phòng')
  const index = await request.get('/index.html')
  expect(index.headers()['cache-control']).toMatch(/no-cache|no-store/)
  const script = await page.locator('script[src^="/assets/"]').first().getAttribute('src')
  const asset = await request.get(script!)
  expect(asset.status()).toBe(200)
  expect(asset.headers()['content-type']).toMatch(/javascript/)
  expect(asset.headers()['cache-control']).toContain('immutable')
  for (const url of ['/assets/missing-production.js', '/images/missing-production.webp']) expect((await request.get(url)).status()).toBe(404)
  expect(errors).toEqual([])
})

test('production uploads building and room images over authenticated TLS', async ({ page, request, baseURL }, testInfo) => {
  test.skip(!process.env.UPLOAD_TEST_USER, 'Upload acceptance needs HTTPS and externally supplied test credentials')
  expect(new URL(baseURL!).protocol).toBe('https:')
  const unauthenticated = await requestFactory.newContext({ baseURL, ignoreHTTPSErrors: Boolean(testInfo.project.use.ignoreHTTPSErrors) })
  try {
    const denied = await unauthenticated.post('/api/images?entityType=building&entityId=qa', { data: Buffer.from('invalid'), headers: { Origin: baseURL! } })
    expect(denied.status()).toBe(401)
  } finally { await unauthenticated.dispose() }
  const wrongOrigin = await request.post('/api/images?entityType=building&entityId=qa', { data: Buffer.from('invalid'), headers: { Origin: 'https://wrong.invalid', 'Content-Type': 'image/jpeg' } })
  expect(wrongOrigin.status()).toBe(403)
  const image = { name: 'fixture.jpg', mimeType: 'image/jpeg', buffer: await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#738a94' } }).jpeg().toBuffer() }
  await createBuilding(page)
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  await page.getByLabel('Chọn ảnh').setInputFiles(image)
  await expect(page.getByRole('img', { name: 'Ảnh tòa nhà 1', exact: true })).toHaveJSProperty('naturalWidth', 600)
  const big = await page.getByRole('link', { name: /Xem ảnh 1/ }).getAttribute('href')
  const response = await request.get(big!)
  expect(response.headers()['content-type']).toContain('image/webp')
  expect(response.headers()['cache-control']).toContain('immutable')
  expect((await sharp(await response.body()).metadata()).width).toBe(1200)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('img', { name: 'Ảnh QA Tower', exact: true })).toBeVisible()
  await createRoom(page)
  await page.getByRole('button', { name: 'Sửa phòng QA-101', exact: true }).click()
  await page.getByLabel('Chọn ảnh').setInputFiles(image)
  await expect(page.getByRole('img', { name: 'Ảnh phòng 1', exact: true })).toHaveJSProperty('naturalWidth', 600)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('img', { name: 'Ảnh phòng QA-101', exact: true })).toBeVisible()
})

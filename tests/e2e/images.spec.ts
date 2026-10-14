import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { createBuilding, createRoom } from './helpers'

test.describe.configure({ mode: 'serial' })
const image = async () => ({ name: 'property.jpg', mimeType: 'image/jpeg', buffer: await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#92a6b2' } }).jpeg().toBuffer() })
const storedImages = (page: Page, collection: 'buildings' | 'rooms', name: string) => page.evaluate(({ collection, name }) => {
  const data = JSON.parse(localStorage.getItem('room-finder-estate-v1')!).state
  return data[collection].find((item: { name?: string; roomNumber?: string }) => (item.name ?? item.roomNumber) === name).images
}, { collection, name })

test('images.buildingAndRoomUpload reloads, serves WebP and enforces five images', async ({ page }) => {
  await createBuilding(page)
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  const file = await image()
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Chọn ảnh').setInputFiles(file)
    await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(i + 1)
  }
  await expect(page.getByLabel('Chọn ảnh')).toBeDisabled()
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.getByRole('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: '.local/test-results/images-building-gallery.png', fullPage: true })
  const assets = await storedImages(page, 'buildings', 'QA Tower')
  expect(assets).toHaveLength(5)
  expect(assets[0]).toMatchObject({ width600: 600, width1200: 1200, height600: 375, height1200: 750 })
  await expect(page.getByRole('img', { name: 'Ảnh tòa nhà 1', exact: true })).toHaveJSProperty('naturalWidth', 600)
  const webp = await page.request.get(assets[0].url600)
  expect(webp.headers()['content-type']).toBe('image/webp')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('link', { name: /Xem ảnh 1/ }).click()
  const popup = await popupPromise
  await popup.waitForLoadState()
  await expect(popup.locator('img')).toHaveJSProperty('naturalWidth', 1200)
  await popup.close()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('img', { name: 'Ảnh QA Tower', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(5)
  const deletes: string[] = []
  page.on('request', req => { if (req.method() === 'DELETE') deletes.push(req.url()) })
  await page.getByRole('button', { name: 'Bỏ ảnh 1', exact: true }).click()
  await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(4)
  await expect(page.getByLabel('Chọn ảnh')).toBeEnabled()
  expect((await page.request.get(assets[0].url600)).status()).toBe(200)
  await page.keyboard.press('Escape')
  await createRoom(page)
  await page.getByRole('button', { name: 'Sửa phòng QA-101', exact: true }).click()
  await page.getByLabel('Chọn ảnh').setInputFiles(file)
  await expect(page.getByRole('img', { name: 'Ảnh phòng 1', exact: true })).toHaveJSProperty('naturalWidth', 600)
  const roomAssets = await storedImages(page, 'rooms', 'QA-101')
  expect(roomAssets[0].url1200).toMatch(/^\/images\/room-image\//)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('img', { name: 'Ảnh phòng QA-101', exact: true })).toBeVisible()
  expect(await storedImages(page, 'rooms', 'QA-101')).toEqual(roomAssets)
  expect(deletes).toEqual([])
})

test('images.failedUploadPreservesState for API errors, disconnects and pending uploads', async ({ page }) => {
  await createBuilding(page)
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  const file = await image()
  await page.getByLabel('Chọn ảnh').setInputFiles(file)
  await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(1)
  const before = await storedImages(page, 'buildings', 'QA Tower')
  for (const status of [413, 422, 429, 507]) {
    await page.route('**/api/images?**', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_FAILURE', message: `Upload error ${status}` }) }))
    await page.getByLabel('Chọn ảnh').setInputFiles(file)
    await expect(page.getByRole('alert')).toContainText(`Upload error ${status}`)
    expect(await storedImages(page, 'buildings', 'QA Tower')).toEqual(before)
    await page.unroute('**/api/images?**')
  }
  await page.route('**/api/images?**', route => route.abort('connectionfailed'))
  await page.getByLabel('Chọn ảnh').setInputFiles(file)
  await expect(page.getByRole('alert')).toContainText('Không thể tải ảnh')
  expect(await storedImages(page, 'buildings', 'QA Tower')).toEqual(before)
  await page.unroute('**/api/images?**')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/images?**', async route => { await gate; await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 'BUSY', message: 'Please retry' }) }) })
  await page.getByLabel('Chọn ảnh').setInputFiles(file)
  await expect(page.getByLabel('Chọn ảnh')).toBeDisabled()
  release()
  await expect(page.getByRole('alert')).toContainText('Please retry')
  expect(await storedImages(page, 'buildings', 'QA Tower')).toEqual(before)
})

test('images requires a saved entity and validates type and size before sending', async ({ page }) => {
  await page.goto('/buildings')
  await page.getByRole('button', { name: 'Thêm tòa nhà', exact: true }).click()
  await expect(page.getByText('Lưu tòa nhà trước khi thêm ảnh.')).toBeVisible()
  await expect(page.getByLabel('Chọn ảnh')).not.toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Sửa Riverside Residence', exact: true }).click()
  const posts: string[] = []
  page.on('request', req => { if (req.method() === 'POST') posts.push(req.url()) })
  await page.getByLabel('Chọn ảnh').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG hoặc WebP')
  await page.getByLabel('Chọn ảnh').setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert')).toContainText('10 MiB')
  expect(posts).toEqual([])
})

test('images metadata warns on quota and broken previews have a fallback', async ({ page }) => {
  await createBuilding(page)
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError') } })
  await page.getByLabel('Chọn ảnh').setInputFiles(await image())
  await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(1)
  await expect(page.locator('main > [role="alert"]')).toContainText('sẽ mất khi tải lại')
  await page.route('**/images/**', route => route.fulfill({ status: 404 }))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  await expect(page.getByText('Không tải được ảnh.')).toBeVisible()
})

test('closing a pending upload cancels it before it can restore a removed image', async ({ page }) => {
  await createBuilding(page)
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  const file = await image()
  await page.getByLabel('Chọn ảnh').setInputFiles(file)
  await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(1)
  const [old] = await storedImages(page, 'buildings', 'QA Tower')
  const newId = 'late-image'
  const late = { ...old, id: newId, url600: old.url600.replace(old.id, newId), url1200: old.url1200.replace(old.id, newId) }
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/images?**', async route => { await gate; await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(late) }).catch(() => {}) })
  await page.getByLabel('Chọn ảnh').setInputFiles(file)
  await expect(page.getByLabel('Chọn ảnh')).toBeDisabled()
  const cancelled = page.waitForEvent('requestfailed', { predicate: request => request.url().includes('/api/images?'), timeout: 5000 })
  try {
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
    await page.getByRole('button', { name: 'Bỏ ảnh 1', exact: true }).click()
    await cancelled
  } finally { release() }
  await expect(page.getByRole('img', { name: /^Ảnh tòa nhà/ })).toHaveCount(0)
  expect(await storedImages(page, 'buildings', 'QA Tower')).toEqual([])
})

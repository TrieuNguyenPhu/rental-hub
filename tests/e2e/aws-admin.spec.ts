import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import sharp from 'sharp'
import { createBuilding, createRoom } from './helpers'

test('AWS admin logs in and uploads building and room WebP images', async ({ page, request }) => {
  test.skip(!process.env.AWS_ADMIN_CREDENTIAL_FILE || !process.env.SITE_URL, 'Requires the live Task 3 site and local Admin credential file')
  const credential = readFileSync(process.env.AWS_ADMIN_CREDENTIAL_FILE!, 'utf8')
  const username = credential.match(/^Username: (.+)$/m)?.[1]
  const password = credential.match(/^Password: (.+)$/m)?.[1]
  expect(username && password).toBeTruthy()
  await page.goto('/rooms')
  await expect(page.getByRole('heading', { name: 'Đăng nhập Admin' })).toBeVisible()
  await page.getByLabel('Tên đăng nhập').fill(username!)
  await page.getByLabel('Mật khẩu').fill(password!)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Phòng', exact: true })).toBeVisible()
  await createBuilding(page)
  await page.getByRole('button', { name: 'Sửa QA Tower', exact: true }).click()
  const image = { name: 'qa.jpg', mimeType: 'image/jpeg', buffer: await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#738a94' } }).jpeg().toBuffer() }
  await page.getByLabel('Chọn ảnh').setInputFiles(image)
  await expect(page.getByRole('img', { name: 'Ảnh tòa nhà 1' })).toHaveJSProperty('naturalWidth', 600)
  const buildingImage = await page.getByRole('link', { name: /Xem ảnh 1/ }).getAttribute('href')
  const buildingResponse = await request.get(buildingImage!)
  expect(buildingResponse.headers()['content-type']).toBe('image/webp')
  expect((await sharp(await buildingResponse.body()).metadata()).width).toBe(1200)
  await page.keyboard.press('Escape')
  await createRoom(page)
  await page.getByRole('button', { name: 'Sửa phòng QA-101', exact: true }).click()
  await page.getByLabel('Chọn ảnh').setInputFiles(image)
  await expect(page.getByRole('img', { name: 'Ảnh phòng 1' })).toHaveJSProperty('naturalWidth', 600)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Đăng nhập Admin' })).toBeVisible()
  await page.getByLabel('Mật khẩu').fill(password!)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Ảnh phòng QA-101' })).toBeVisible()
})

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function createBuilding(page: Page) {
  await page.goto('/buildings')
  await page.getByRole('button', { name: 'Thêm tòa nhà', exact: true }).click()
  await page.getByLabel('Tên tòa nhà *').fill('QA Tower')
  await page.getByLabel('Địa chỉ *').fill('12 Nguyễn Trãi')
  await page.getByLabel('Thành phố *').fill('Huế')
  await page.getByLabel('Số tầng *').fill('5')
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}
export async function createRoom(page: Page) {
  await page.goto('/rooms')
  await page.getByRole('button', { name: 'Thêm phòng', exact: true }).click()
  await page.getByLabel('Tòa nhà *', { exact: true }).selectOption({ label: 'QA Tower · Huế' })
  await page.getByLabel('Số phòng *').fill('QA-101')
  await page.getByLabel('Tầng *', { exact: true }).fill('1')
  await page.getByLabel('Diện tích (m²) *').fill('35')
  await page.getByLabel('Giá thuê / tháng (VND) *').fill('5000000')
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}

import { test, expect } from '@playwright/test'

test('AWS static site opens without login and disables image upload', async ({ page }) => {
  test.skip(!process.env.SITE_URL, 'Requires the deployed AWS website URL')
  await page.goto('/buildings')
  await expect(page.getByRole('heading', { name: 'Tòa nhà', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Sửa Riverside Residence', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Bản AWS chỉ hiển thị ảnh đã có; không hỗ trợ tải ảnh mới.')).toBeVisible()
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
})

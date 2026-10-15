import { test, expect } from '@playwright/test'
import sharp from 'sharp'

test('AWS shares building and room WebP images across visitors', async ({ page, request, browser }) => {
  test.skip(!process.env.SITE_URL, 'Requires the deployed AWS website URL')
  const image = { name: 'demo.jpg', mimeType: 'image/jpeg', buffer: await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#738a94' } }).jpeg().toBuffer() }
  const name = `AWS image test ${Date.now()}`
  const roomNumber = `T${Date.now()}`
  const change = async (action: string, id?: string, input?: object) => {
    const snapshot = await (await request.get('/api/estate')).json()
    const response = await request.post('/api/estate', { data: { action, id, input, version: snapshot.version } })
    expect(response.ok()).toBeTruthy()
    return (await response.json()).result.id as string
  }
  const buildingId = await change('addBuilding', undefined, { name, address: 'Demo', city: 'Hanoi', floors: 2, status: 'active' })
  let roomId: string | null = null
  const visitor = await browser.newContext()
  try {
    roomId = await change('addRoom', undefined, { buildingId, roomNumber, floor: 1, area: 30, rentalPrice: 1000000, status: 'available' })
    await page.goto('/buildings')
    await page.getByRole('button', { name: `Sửa ${name}` }).click()
    await page.getByLabel('Chọn ảnh').setInputFiles(image)
    await expect(page.getByRole('img', { name: 'Ảnh tòa nhà 1', exact: true })).toHaveJSProperty('naturalWidth', 600)
    const large = await page.getByRole('link', { name: /Xem ảnh 1/ }).getAttribute('href')
    expect(large).toMatch(/^\/images\/building-image\/.+_1200\.webp$/)
    const response = await request.get(large!)
    expect(response.headers()['content-type']).toContain('image/webp')
    expect((await sharp(await response.body()).metadata()).width).toBe(1200)
    const other = await visitor.newPage()
    await other.goto('/buildings')
    await expect(other.getByRole('img', { name: `Ảnh ${name}` })).toHaveJSProperty('naturalWidth', 600)

    await page.goto('/rooms')
    await page.getByRole('button', { name: `Sửa phòng ${roomNumber}` }).click()
    await page.getByLabel('Chọn ảnh').setInputFiles(image)
    await expect(page.getByRole('img', { name: 'Ảnh phòng 1', exact: true })).toHaveJSProperty('naturalWidth', 600)
    await other.goto('/rooms')
    await expect(other.getByRole('img', { name: `Ảnh phòng ${roomNumber}` })).toHaveJSProperty('naturalWidth', 600)
  } finally {
    await visitor.close()
    if (roomId) await change('deleteRoom', roomId)
    await change('deleteBuilding', buildingId)
  }
})

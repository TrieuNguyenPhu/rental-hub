import assert from 'node:assert/strict'

const [base, sha] = process.argv.slice(2)
assert.match(sha ?? '', /^[a-f0-9]{40}$/)
assert.equal(new URL(base).origin, base, 'Supply an origin, without path or credentials')
async function get(path, status = 200) {
  const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Cache-Control': 'no-cache' } })
  assert.equal(response.status, status, `${path}: unexpected HTTP status`)
  return response
}
const manifestResponse = await get('/release.json')
assert.match(manifestResponse.headers.get('cache-control') ?? '', /no-cache|no-store/)
assert.equal((await manifestResponse.json()).releaseId, sha, 'Wrong public release')
const health = await (await get('/api/health')).json()
assert.deepEqual(health, { status: 'ok', releaseId: sha }, 'Wrong media release')
const index = await (await get('/')).text()
assert.match(index, /id="root"/)
for (const route of ['/buildings', '/rooms', '/bookings']) {
  const response = await get(route)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.equal(await response.text(), index, `${route}: wrong SPA fallback`)
}
const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1])
assert.ok(assets.some(asset => asset.endsWith('.js')), 'No JavaScript entry point')
for (const asset of assets) {
  assert.ok(!asset.includes('..'), 'Unsafe asset path')
  const response = await get(asset)
  const type = response.headers.get('content-type') ?? ''
  assert.match(type, asset.endsWith('.js') ? /javascript|ecmascript/ : /text\/css/)
  assert.ok((await response.arrayBuffer()).byteLength > 0, 'Empty asset')
}
await get('/assets/rental-hub-missing-file.js', 404)
await get('/images/rental-hub-missing-file.webp', 404)
console.log(`SMOKE PASS ${sha} ${base}`)

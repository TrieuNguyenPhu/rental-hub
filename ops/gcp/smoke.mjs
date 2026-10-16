import assert from 'node:assert/strict'

const [base, releaseId, commit] = process.argv.slice(2)
assert.match(releaseId ?? '', /^[0-9]{17}$/)
assert.match(commit ?? '', /^[a-f0-9]{40}$/)
assert.equal(new URL(base).origin, base)

async function get(path, status = 200) {
  const response = await fetch(new URL(path, base), {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { 'Cache-Control': 'no-cache' },
  })
  assert.equal(response.status, status, path)
  return response
}

const release = await (await get('/release.json')).json()
assert.equal(release.releaseId, releaseId)
assert.equal(release.commit, commit)
const index = await (await get('/')).text()
assert.match(index, /id="root"/)
for (const path of ['/buildings', '/rooms', '/bookings']) {
  const response = await get(path)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.equal(await response.text(), index, path)
}
const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1])
assert.ok(assets.some(asset => asset.endsWith('.js')))
assert.ok(assets.some(asset => asset.endsWith('.css')))
for (const asset of assets) {
  const response = await get(asset)
  assert.match(response.headers.get('content-type') ?? '', asset.endsWith('.js') ? /javascript|ecmascript/ : /text\/css/)
  assert.ok((await response.arrayBuffer()).byteLength > 0)
}
await get('/assets/rental-hub-missing.js', 404)
await get('/api/images', 403)
console.log(`SMOKE PASS ${base} ${releaseId}`)

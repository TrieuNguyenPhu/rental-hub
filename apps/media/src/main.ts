import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startMediaServer } from './mediaServer.ts'
import { createMediaStorage } from './mediaStorage.ts'

async function main() {
  const development = process.env.NODE_ENV === 'development'
  const imagesRoot = process.env.IMAGES_ROOT ?? (development ? path.resolve('.local/media/images') : '')
  const tempRoot = process.env.TEMP_ROOT ?? (development ? path.resolve('.local/media/tmp') : '')
  if (development) { await fs.mkdir(imagesRoot, { recursive: true }); await fs.mkdir(tempRoot, { recursive: true }) }
  const releaseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const releaseId = development ? 'local-dev' : JSON.parse(await fs.readFile(path.join(releaseRoot, 'release.json'), 'utf8')).releaseId
  if (!development && !/^[a-f0-9]{40}$/.test(releaseId)) throw new Error('Invalid release manifest')
  if (process.env.MEDIA_READ_ONLY && !['true', 'false'].includes(process.env.MEDIA_READ_ONLY)) throw new Error('Invalid readOnly configuration')
  const server = await startMediaServer({ host: '127.0.0.1', port: Number(process.env.MEDIA_PORT ?? 3001), imagesRoot, tempRoot, siteOrigin: process.env.SITE_ORIGIN ?? (development ? 'http://127.0.0.1:5173' : ''), releaseId, readOnly: process.env.MEDIA_READ_ONLY === 'true', development }, createMediaStorage)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close())
}

if (process.argv[1] && import.meta.url === pathToFileURL(await fs.realpath(process.argv[1])).href) {
  main().catch(() => { console.error('Media startup failed. Check storage, origin, port and release manifest configuration.'); process.exitCode = 1 })
}

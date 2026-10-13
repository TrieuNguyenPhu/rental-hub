import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import { createServer as createLockServer } from 'node:net'
import type { Server as LockServer } from 'node:net'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MAX_IMAGE_BYTES, MediaError, processImage, validTarget } from './images.ts'
import type { ImageTarget } from './images.ts'

export type MediaConfig = {
  host: '127.0.0.1'; port: number
  imagesRoot: string; tempRoot: string; siteOrigin: string
  releaseId: string; readOnly: boolean
}

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

async function writable(root: string): Promise<boolean> {
  const probe = path.join(root, `.health-${randomUUID()}`)
  try { await fs.writeFile(probe, '', { flag: 'wx' }); return true }
  catch { return false }
  finally { await fs.rm(probe, { force: true }).catch(() => {}) }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const finish = (error?: Error) => {
      clearTimeout(timer)
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted)
      if (error) { req.resume(); reject(error) } else resolve(Buffer.concat(chunks, size))
    }
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_IMAGE_BYTES) finish(new MediaError(413, 'TOO_LARGE', 'Image must be at most 10 MiB.'))
      else chunks.push(chunk)
    }
    const onEnd = () => finish()
    const onError = () => finish(new MediaError(400, 'REQUEST_ERROR', 'Could not read upload.'))
    const onAborted = () => finish(new MediaError(400, 'REQUEST_ABORTED', 'Upload was interrupted.'))
    const timer = setTimeout(() => finish(new MediaError(408, 'BODY_TIMEOUT', 'Upload exceeded the 30 second deadline.')), 30_000)
    req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onAborted)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 408 ? { Connection: 'close' } : {}) })
  res.end(JSON.stringify(body))
}

export async function startMediaServer(config: MediaConfig): Promise<Server> {
  if (config.host !== '127.0.0.1' || !Number.isInteger(config.port) || config.port < 0 || config.port > 65535 || !config.releaseId || typeof config.readOnly !== 'boolean') throw new Error('Invalid media configuration')
  let site: URL
  try { site = new URL(config.siteOrigin) } catch { throw new Error('Invalid site origin') }
  if (site.origin !== config.siteOrigin || !['http:', 'https:'].includes(site.protocol) || (site.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname))) throw new Error('Use an exact HTTPS or localhost origin')
  if (!path.isAbsolute(config.imagesRoot) || !path.isAbsolute(config.tempRoot)) throw new Error('Storage roots must be absolute')
  const imagesRoot = await fs.realpath(config.imagesRoot), tempRoot = await fs.realpath(config.tempRoot)
  if (imagesRoot === tempRoot || inside(imagesRoot, tempRoot) || inside(tempRoot, imagesRoot)) throw new Error('Use separate storage roots')
  const imagesStat = await fs.stat(imagesRoot), tempStat = await fs.stat(tempRoot)
  if (!imagesStat.isDirectory() || !tempStat.isDirectory() || imagesStat.dev !== tempStat.dev) throw new Error('Storage directories must share a filesystem')
  const development = process.env.NODE_ENV === 'development'
  let lock: LockServer | undefined
  let busy = false
  let serverClosed = false
  const releaseLock = () => { if (lock?.listening) lock.close() }
  try {
    if (!config.readOnly) {
      if (!['linux', 'win32'].includes(process.platform)) throw new Error('Media locking requires Linux or Windows')
      const key = createHash('sha256').update(tempRoot).digest('hex')
      const address = process.platform === 'win32' ? `\\\\.\\pipe\\rental-hub-media-${key}` : `\0rental-hub-media-${key}`
      // OS ownership avoids stale PID-file races and disappears on process exit.
      lock = createLockServer(socket => socket.destroy())
      await new Promise<void>((resolve, reject) => {
        lock!.once('error', () => reject(new Error('Media service already running or lock unavailable')))
        lock!.listen(address, () => { lock!.removeAllListeners('error'); resolve() })
      })
      for (const entry of await fs.readdir(tempRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^upload-[A-Za-z0-9]{6}$/.test(entry.name)) continue
        const directory = path.join(tempRoot, entry.name)
        const owner = await fs.readFile(path.join(directory, '.owner'), 'utf8').catch(() => '')
        if (owner === 'rental-hub-image-upload') await fs.rm(directory, { recursive: true })
      }
    }
    const server = createServer(async (req, res) => {
      req.on('error', () => {})
      res.on('finish', () => console.info(`${req.method} ${res.statusCode} ${config.releaseId}`))
      let uploadSlot = false
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (req.method === 'GET' && url.pathname === '/api/health') {
          const ready = await writable(imagesRoot) && await writable(tempRoot)
          json(res, ready ? 200 : 503, ready ? { status: 'ok', releaseId: config.releaseId } : { code: 'STORAGE_UNAVAILABLE', message: 'Image storage is unavailable.' })
          return
        }
        if (development && req.method === 'GET' && url.pathname.startsWith('/images/')) {
          const requested = decodeURIComponent(url.pathname.slice('/images/'.length))
          const file = await fs.realpath(path.resolve(imagesRoot, requested)).catch(() => '')
          if (!file || !inside(imagesRoot, file) || !file.endsWith('.webp')) throw new MediaError(404, 'NOT_FOUND', 'Image not found.')
          const data = await fs.readFile(file)
          res.writeHead(200, { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' })
          res.end(data)
          return
        }
        if (req.method !== 'POST' || url.pathname !== '/api/images') throw new MediaError(404, 'NOT_FOUND', 'Route not found.')
        if (req.headers.origin !== config.siteOrigin) throw new MediaError(403, 'ORIGIN_DENIED', 'Upload origin is not allowed.')
        if (config.readOnly) throw new MediaError(503, 'READ_ONLY', 'Uploads are disabled for this candidate.')
        const target = { entityType: url.searchParams.get('entityType'), entityId: url.searchParams.get('entityId') ?? '' } as ImageTarget
        if (!validTarget(target)) throw new MediaError(400, 'INVALID_TARGET', 'Invalid entity type or ID.')
        const length = req.headers['content-length']
        if (length && Number(length) > MAX_IMAGE_BYTES) throw new MediaError(413, 'TOO_LARGE', 'Image must be at most 10 MiB.')
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.headers['content-type'] ?? '')) throw new MediaError(415, 'UNSUPPORTED_TYPE', 'Use JPEG, PNG or WebP.')
        if (busy) throw new MediaError(429, 'BUSY', 'Another image is processing. Please retry.')
        busy = true; uploadSlot = true
        const input = await readBody(req)
        const asset = await processImage(input, req.headers['content-type']!, target, imagesRoot, tempRoot)
        json(res, 201, asset)
      } catch (error) {
        const failure = error instanceof MediaError ? error : (error as NodeJS.ErrnoException).code === 'ENOSPC'
          ? new MediaError(507, 'DISK_FULL', 'Image storage is full.') : new MediaError(500, 'INTERNAL_ERROR', 'Image service failed.')
        if (!res.destroyed && !res.headersSent) json(res, failure.status, { code: failure.code, message: failure.message })
      } finally { if (uploadSlot) { busy = false; if (serverClosed) releaseLock() } }
    })
    server.requestTimeout = 35_000
    server.headersTimeout = 10_000
    server.on('close', () => { serverClosed = true; if (!busy) releaseLock() })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', () => { server.off('error', reject); resolve() }) })
    return server
  } catch (error) { releaseLock(); throw error }
}

async function main() {
  const development = process.env.NODE_ENV === 'development'
  const imagesRoot = process.env.IMAGES_ROOT ?? (development ? path.resolve('.media/images') : '')
  const tempRoot = process.env.TEMP_ROOT ?? (development ? path.resolve('.media/tmp') : '')
  if (development) { await fs.mkdir(imagesRoot, { recursive: true }); await fs.mkdir(tempRoot, { recursive: true }) }
  const releaseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const releaseId = development ? 'local-dev' : JSON.parse(await fs.readFile(path.join(releaseRoot, 'release.json'), 'utf8')).releaseId
  if (!development && !/^[a-f0-9]{40}$/.test(releaseId)) throw new Error('Invalid release manifest')
  if (process.env.MEDIA_READ_ONLY && !['true', 'false'].includes(process.env.MEDIA_READ_ONLY)) throw new Error('Invalid readOnly configuration')
  const server = await startMediaServer({ host: '127.0.0.1', port: Number(process.env.MEDIA_PORT ?? 3001), imagesRoot, tempRoot, siteOrigin: process.env.SITE_ORIGIN ?? (development ? 'http://127.0.0.1:5173' : ''), releaseId, readOnly: process.env.MEDIA_READ_ONLY === 'true' })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close())
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Media startup failed. Check storage, origin, port and release manifest configuration.'); process.exitCode = 1 })
}

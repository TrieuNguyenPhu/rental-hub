import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { MAX_IMAGE_BYTES, MediaError, validTarget, type ImageTarget, type MediaConfig, type OpenMediaStorage } from './media.ts'

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

export async function startMediaServer(config: MediaConfig, openStorage: OpenMediaStorage): Promise<Server> {
  if (config.host !== '127.0.0.1' || !Number.isInteger(config.port) || config.port < 0 || config.port > 65535 || !config.releaseId || typeof config.readOnly !== 'boolean' || typeof config.development !== 'boolean') throw new Error('Invalid media configuration')
  let site: URL
  try { site = new URL(config.siteOrigin) } catch { throw new Error('Invalid site origin') }
  if (site.origin !== config.siteOrigin || !['http:', 'https:'].includes(site.protocol) || (!config.readOnly && site.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname))) throw new Error('Use an exact origin; writable media requires HTTPS or localhost')
  const storage = await openStorage(config)
  let busy = false
  let serverClosed = false
  try {
    const server = createServer(async (req, res) => {
      req.on('error', () => {})
      res.on('finish', () => console.info(`${req.method} ${res.statusCode} ${config.releaseId}`))
      let uploadSlot = false
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (req.method === 'GET' && url.pathname === '/api/health') {
          const ready = await storage.ready()
          json(res, ready ? 200 : 503, ready ? { status: 'ok', releaseId: config.releaseId } : { code: 'STORAGE_UNAVAILABLE', message: 'Image storage is unavailable.' })
          return
        }
        if (config.development && req.method === 'GET' && url.pathname.startsWith('/images/')) {
          const requested = decodeURIComponent(url.pathname.slice('/images/'.length))
          const data = await storage.readImage(requested)
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
        const asset = await storage.processImage(input, req.headers['content-type']!, target)
        json(res, 201, asset)
      } catch (error) {
        const failure = error instanceof MediaError ? error : (error as NodeJS.ErrnoException).code === 'ENOSPC'
          ? new MediaError(507, 'DISK_FULL', 'Image storage is full.') : new MediaError(500, 'INTERNAL_ERROR', 'Image service failed.')
        if (!res.destroyed && !res.headersSent) json(res, failure.status, { code: failure.code, message: failure.message })
      } finally { if (uploadSlot) { busy = false; if (serverClosed) storage.close() } }
    })
    server.requestTimeout = 35_000
    server.headersTimeout = 10_000
    server.on('close', () => { serverClosed = true; if (!busy) storage.close() })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', () => { server.off('error', reject); resolve() }) })
    return server
  } catch (error) { storage.close(); throw error }
}

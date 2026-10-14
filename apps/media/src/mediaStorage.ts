import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createServer as createLockServer, type Server as LockServer } from 'node:net'
import { MediaError, type MediaConfig, type MediaStorage } from './media.ts'
import { processImage } from './images.ts'

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

export async function createMediaStorage(config: MediaConfig): Promise<MediaStorage> {
  if (!path.isAbsolute(config.imagesRoot) || !path.isAbsolute(config.tempRoot)) throw new Error('Storage roots must be absolute')
  const imagesRoot = await fs.realpath(config.imagesRoot), tempRoot = await fs.realpath(config.tempRoot)
  if (imagesRoot === tempRoot || inside(imagesRoot, tempRoot) || inside(tempRoot, imagesRoot)) throw new Error('Use separate storage roots')
  const imagesStat = await fs.stat(imagesRoot), tempStat = await fs.stat(tempRoot)
  if (!imagesStat.isDirectory() || !tempStat.isDirectory() || imagesStat.dev !== tempStat.dev) throw new Error('Storage directories must share a filesystem')
  let lock: LockServer | undefined
  const close = () => { if (lock?.listening) lock.close() }
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
    return {
      ready: async () => await writable(imagesRoot) && await writable(tempRoot),
      readImage: async requested => {
        const file = await fs.realpath(path.resolve(imagesRoot, requested)).catch(() => '')
        if (!file || !inside(imagesRoot, file) || !file.endsWith('.webp')) throw new MediaError(404, 'NOT_FOUND', 'Image not found.')
        return fs.readFile(file)
      },
      processImage: (input, declaredType, target) => processImage(input, declaredType, target, imagesRoot, tempRoot),
      close,
    }
  } catch (error) { close(); throw error }
}

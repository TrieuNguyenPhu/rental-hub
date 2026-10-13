import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { Metadata, OutputInfo } from 'sharp'
import type { EntityType, ImageAsset } from '../src/types/index.ts'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export type ImageTarget = { entityType: EntityType; entityId: string }

export class MediaError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function validTarget(target: ImageTarget): boolean {
  return ['building', 'room'].includes(target.entityType) && /^[A-Za-z0-9_-]{1,64}$/.test(target.entityId)
}

export async function processImage(input: Buffer, declaredType: string, target: ImageTarget, imagesRoot: string, tempRoot: string): Promise<ImageAsset> {
  if (!validTarget(target)) throw new MediaError(400, 'INVALID_TARGET', 'Invalid entity type or ID.')
  if (input.length > MAX_IMAGE_BYTES) throw new MediaError(413, 'TOO_LARGE', 'Image must be at most 10 MiB.')
  if (!input.length) throw new MediaError(422, 'INVALID_IMAGE', 'Image is empty.')
  const formats: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }
  if (!Object.hasOwn(formats, declaredType)) throw new MediaError(415, 'UNSUPPORTED_TYPE', 'Use JPEG, PNG or WebP.')
  const image = sharp(input, { limitInputPixels: 20_000_000, failOn: 'warning' })
  let metadata: Metadata
  try { metadata = await image.metadata() } catch { throw new MediaError(422, 'INVALID_IMAGE', 'Cannot decode image or image exceeds 20 megapixels.') }
  if (metadata.format !== formats[declaredType]) throw new MediaError(415, 'TYPE_MISMATCH', 'Content does not match the declared image type.')
  const rotated = (metadata.orientation ?? 1) >= 5 && (metadata.orientation ?? 1) <= 8
  const width = rotated ? metadata.height : metadata.width
  const height = rotated ? metadata.width : metadata.height
  if ((metadata.pages ?? 1) !== 1 || !width || width < 1200 || !metadata.height || !metadata.width || metadata.width * metadata.height > 20_000_000) throw new MediaError(422, 'IMAGE_LIMIT', 'Use a static image at least 1200px wide and at most 20 megapixels.')
  if (Math.round(height! * 1200 / width) > 16383) throw new MediaError(422, 'IMAGE_LIMIT', 'The 1200px WebP output must be no taller than 16383px.')
  // libpng decodes APNG's first frame without reporting its frame count.
  if (metadata.format === 'png') {
    for (let offset = 8; offset + 12 <= input.length;) {
      const length = input.readUInt32BE(offset)
      if (length > input.length - offset - 12) throw new MediaError(422, 'INVALID_IMAGE', 'Invalid PNG chunks.')
      const type = input.toString('ascii', offset + 4, offset + 8)
      if (type === 'acTL' && length >= 4 && input.readUInt32BE(offset + 8) > 1) throw new MediaError(422, 'IMAGE_LIMIT', 'Use a static PNG image.')
      offset += length + 12
      if (type === 'IEND') break
    }
  }
  const id = randomUUID()
  const base = `${Math.floor(Date.now() / 1000)}-${randomUUID()}`
  const relative = `${target.entityType}-image/${target.entityId}/${id}`
  const pending = await fs.mkdtemp(path.join(tempRoot, 'upload-'))
  try {
    await fs.writeFile(path.join(pending, '.owner'), 'rental-hub-image-upload', { flag: 'wx' })
    const outputs = []
    for (const size of [600, 1200] as const) {
      let output: { data: Buffer; info: OutputInfo }
      try { output = await image.clone().autoOrient().resize({ width: size }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true }) }
      catch { throw new MediaError(422, 'INVALID_IMAGE', 'Cannot decode image pixels.') }
      await fs.writeFile(path.join(pending, `${base}_${size}.webp`), output.data, { flag: 'wx', mode: 0o644 })
      outputs.push(output.info)
    }
    const destination = path.join(imagesRoot, relative)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.unlink(path.join(pending, '.owner'))
    await fs.chmod(pending, 0o755)
    await fs.rename(pending, destination)
    // shortcut: unlinked files remain, add GC only when centralized references and backups exist.
    return {
      id, url600: `/images/${relative}/${base}_600.webp`, url1200: `/images/${relative}/${base}_1200.webp`,
      width600: 600, width1200: 1200, height600: outputs[0].height, height1200: outputs[1].height,
      bytes600: outputs[0].size, bytes1200: outputs[1].size,
    }
  } finally {
    await fs.rm(pending, { recursive: true, force: true })
  }
}

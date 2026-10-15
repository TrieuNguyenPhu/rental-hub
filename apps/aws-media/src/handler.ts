import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { processImage } from '../../media/src/images.ts'
import { MediaError, validTarget, type ImageTarget } from '../../media/src/media.ts'
import { entityExists, estateRoute } from './estate.ts'

type UploadEvent = {
  requestContext?: { http?: { method?: string } }
  rawPath?: string
  queryStringParameters?: Record<string, string | undefined>
  headers?: Record<string, string | undefined>
  body?: string
  isBase64Encoded?: boolean
}

const s3 = new S3Client({})
const maxUploadBytes = 4 * 1024 * 1024

function response(statusCode: number, body: object) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }
}

export async function handler(event: UploadEvent) {
  if (event.rawPath === '/api/estate') return estateRoute(event)
  if (event.requestContext?.http?.method !== 'POST' || event.rawPath !== '/api/images')
    return response(405, { code: 'METHOD_NOT_ALLOWED', message: 'Route not allowed.' })
  const target = {
    entityType: event.queryStringParameters?.entityType,
    entityId: event.queryStringParameters?.entityId,
  } as ImageTarget
  if (!validTarget(target)) return response(400, { code: 'INVALID_TARGET', message: 'Invalid entity type or ID.' })
  const declaredType = event.headers?.['content-type'] ?? event.headers?.['Content-Type'] ?? ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(declaredType))
    return response(415, { code: 'UNSUPPORTED_TYPE', message: 'Use JPEG, PNG or WebP.' })
  if (!event.isBase64Encoded || !event.body) return response(422, { code: 'INVALID_IMAGE', message: 'Image is empty or invalid.' })
  const input = Buffer.from(event.body, 'base64')
  if (input.length > maxUploadBytes) return response(413, { code: 'TOO_LARGE', message: 'Image must be at most 4 MiB on AWS.' })
  const bucket = process.env.IMAGE_BUCKET
  if (!bucket) return response(503, { code: 'NOT_CONFIGURED', message: 'Image storage is unavailable.' })
  try {
    if (!await entityExists(target.entityType, target.entityId)) return response(422, { code: 'TARGET_NOT_FOUND', message: 'Building or room no longer exists.' })
  } catch (error) {
    console.error('AWS image target check failed', error)
    return response(503, { code: 'DATA_UNAVAILABLE', message: 'Shared data is unavailable.' })
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rental-hub-aws-'))
  const imagesRoot = path.join(root, 'images')
  const tempRoot = path.join(root, 'tmp')
  const uploaded: string[] = []
  try {
    await Promise.all([fs.mkdir(imagesRoot), fs.mkdir(tempRoot)])
    const asset = await processImage(input, declaredType, target, imagesRoot, tempRoot)
    for (const url of [asset.url600, asset.url1200]) {
      const key = url.slice(1)
      const data = await fs.readFile(path.join(imagesRoot, key.slice('images/'.length)))
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: 'image/webp', CacheControl: 'public,max-age=31536000,immutable' }))
      uploaded.push(key)
    }
    // shortcut: an image can remain unlinked if the later metadata write fails; add orphan cleanup when retention matters.
    return response(201, asset)
  } catch (error) {
    await Promise.allSettled(uploaded.map(Key => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }))))
    if (error instanceof MediaError) return response(error.status, { code: error.code, message: error.message })
    console.error('AWS image upload failed', error)
    return response(500, { code: 'INTERNAL_ERROR', message: 'Image service failed.' })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { BookingInput, BuildingInput, EstateData, RoomInput } from '../../../packages/domain/models.ts'
import { createEstateActions } from '../../web/src/domain/estateActions.ts'
import { createDemoData } from '../../web/src/domain/demoData.ts'
import { readEstateData } from '../../web/src/services/estatePersistence.ts'

const s3 = new S3Client({})
const key = 'estate.json'
const allowed = new Set(['addBuilding', 'updateBuilding', 'deleteBuilding', 'addRoom', 'updateRoom', 'deleteRoom', 'addBooking', 'updateBooking', 'cancelBooking', 'resetDemoData'])
const reply = (statusCode: number, body: object) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) })

async function load(bucket: string) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const data = readEstateData(JSON.parse(await object.Body!.transformToString()))
    return { data, version: object.ETag! }
  } catch (error) {
    if (error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound')) return { data: createDemoData(), version: null }
    throw error
  }
}

export async function entityExists(type: 'building' | 'room', id: string) {
  const bucket = process.env.DATA_BUCKET
  if (!bucket) return false
  const { data } = await load(bucket)
  return (type === 'building' ? data.buildings : data.rooms).some(item => item.id === id)
}

function validInput(action: string, value: unknown): value is BuildingInput & RoomInput & BookingInput {
  if (['deleteBuilding', 'deleteRoom', 'cancelBooking', 'resetDemoData'].includes(action)) return true
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  const strings = (keys: string[]) => keys.every(field => typeof input[field] === 'string' && (input[field] as string).length <= 500)
  if (action.endsWith('Building')) return strings(['name', 'address', 'city', 'status']) && typeof input.floors === 'number' && (input.images === undefined || Array.isArray(input.images))
  if (action.endsWith('Room')) return strings(['buildingId', 'roomNumber', 'status']) && ['floor', 'area', 'rentalPrice'].every(field => typeof input[field] === 'number') && (input.images === undefined || Array.isArray(input.images))
  return strings(['roomId', 'customerName', 'customerPhone', 'checkIn', 'checkOut'])
}

export async function estateRoute(event: { requestContext?: { http?: { method?: string } }; body?: string; isBase64Encoded?: boolean }) {
  const bucket = process.env.DATA_BUCKET
  if (!bucket) return reply(503, { message: 'Shared data is unavailable.' })
  try {
    if (event.requestContext?.http?.method === 'GET') return reply(200, await load(bucket))
    if (event.requestContext?.http?.method !== 'POST') return reply(405, { message: 'Route not allowed.' })
    if (!event.body || event.body.length > 250_000) return reply(413, { message: 'Request is too large.' })
    const request = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) as Record<string, unknown>
    if (!request || typeof request.action !== 'string' || !allowed.has(request.action) ||
      (request.action.startsWith('update') || request.action.startsWith('delete') || request.action === 'cancelBooking') && (typeof request.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(request.id)) ||
      !validInput(request.action, request.input)) return reply(400, { message: 'Invalid action or input.' })
    const current = await load(bucket)
    if (request.version !== current.version) return reply(409, { message: 'Dữ liệu đã thay đổi. Tải lại trang và thử lại.', ...current })
    let data: EstateData = current.data
    const actions = createEstateActions(() => data, (patch, id) => { data = { ...data, ...patch }; return { ok: true, id } }, { exportData: () => '', reset: () => {} })
    const action = request.action
    const id = request.id as string
    const input = request.input as BuildingInput & RoomInput & BookingInput
    const result = action === 'resetDemoData' ? (data = createDemoData(), { ok: true as const, id: 'demo' }) :
      action === 'addBuilding' ? actions.addBuilding(input) :
      action === 'updateBuilding' ? actions.updateBuilding(id, input) :
      action === 'deleteBuilding' ? actions.deleteBuilding(id) :
      action === 'addRoom' ? actions.addRoom(input) :
      action === 'updateRoom' ? actions.updateRoom(id, input) :
      action === 'deleteRoom' ? actions.deleteRoom(id) :
      action === 'addBooking' ? actions.addBooking(input) :
      action === 'updateBooking' ? actions.updateBooking(id, input) :
      action === 'cancelBooking' ? actions.cancelBooking(id) : { ok: false as const, error: 'Invalid action.' }
    if (!result.ok) return reply(422, { message: result.error })
    const stored = readEstateData({ version: 1, state: data })
    try {
      const saved = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify({ version: 1, state: stored }), ContentType: 'application/json', ...(current.version ? { IfMatch: current.version } : { IfNoneMatch: '*' }) }))
      return reply(200, { data: stored, version: saved.ETag ?? null, result })
    } catch (error) {
      if (error instanceof Error && ['PreconditionFailed', 'ConditionalRequestConflict'].includes(error.name)) return reply(409, { message: 'Dữ liệu đã thay đổi. Tải lại trang và thử lại.', ...await load(bucket) })
      throw error
    }
  } catch (error) {
    if (error instanceof SyntaxError) return reply(400, { message: 'Invalid JSON.' })
    console.error('AWS estate API failed', error)
    return reply(500, { message: 'Shared data service failed.' })
  }
}

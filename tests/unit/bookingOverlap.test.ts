import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasBookingOverlap } from '../../apps/web/src/domain/bookingOverlap.ts'
import type { Booking } from '../../packages/domain/models.ts'

const bookings: Booking[] = [{ id: 'b1', roomId: 'r1', customerName: 'An', customerPhone: '0901234567', checkIn: '2026-10-10', checkOut: '2026-10-20', status: 'confirmed' }]

test('detects partial, contained, encompassing and identical overlaps', () => {
  for (const [start, end] of [['2026-10-09', '2026-10-11'], ['2026-10-19', '2026-10-21'], ['2026-10-12', '2026-10-14'], ['2026-10-01', '2026-10-30'], ['2026-10-10', '2026-10-20']]) {
    assert.equal(hasBookingOverlap(bookings, 'r1', start, end), true)
  }
})
test('allows adjoining dates and non-overlapping dates', () => {
  assert.equal(hasBookingOverlap(bookings, 'r1', '2026-10-01', '2026-10-10'), false)
  assert.equal(hasBookingOverlap(bookings, 'r1', '2026-10-20', '2026-10-25'), false)
})
test('ignores cancelled bookings, other rooms and the booking being edited', () => {
  assert.equal(hasBookingOverlap([{ ...bookings[0], status: 'cancelled' }], 'r1', '2026-10-11', '2026-10-15'), false)
  assert.equal(hasBookingOverlap(bookings, 'r2', '2026-10-11', '2026-10-15'), false)
  assert.equal(hasBookingOverlap(bookings, 'r1', '2026-10-11', '2026-10-15', 'b1'), false)
})

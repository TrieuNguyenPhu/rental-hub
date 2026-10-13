import type { Booking } from '../types/index.ts'

export function hasBookingOverlap(
  bookings: Booking[], roomId: string, checkIn: string, checkOut: string, excludeId?: string,
): boolean {
  return bookings.some(booking =>
    booking.id !== excludeId && booking.roomId === roomId && booking.status === 'confirmed'
    && checkIn < booking.checkOut && checkOut > booking.checkIn,
  )
}

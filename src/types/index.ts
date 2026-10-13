export interface Building {
  id: string
  name: string
  address: string
  city: string
  floors: number
  status: 'active' | 'maintenance'
}

export interface Room {
  id: string
  buildingId: string
  roomNumber: string
  floor: number
  area: number
  rentalPrice: number
  status: 'available' | 'maintenance'
}

export interface Booking {
  id: string
  roomId: string
  customerName: string
  customerPhone: string
  checkIn: string
  checkOut: string
  status: 'confirmed' | 'cancelled'
}

export type BuildingInput = Omit<Building, 'id'>
export type RoomInput = Omit<Room, 'id'>
export type BookingInput = Omit<Booking, 'id' | 'status'>
export interface EstateData {
  buildings: Building[]
  rooms: Room[]
  bookings: Booking[]
}
export type ActionResult = { ok: true } | { ok: false; error: string }

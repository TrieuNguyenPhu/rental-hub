export interface ImageAsset {
  id: string
  url600: string
  url1200: string
  width600: 600
  width1200: 1200
  height600: number
  height1200: number
  bytes600: number
  bytes1200: number
}

export type EntityType = 'building' | 'room'

export interface Building {
  id: string
  name: string
  address: string
  city: string
  floors: number
  status: 'active' | 'maintenance'
  images: ImageAsset[]
}

export interface Room {
  id: string
  buildingId: string
  roomNumber: string
  floor: number
  area: number
  rentalPrice: number
  status: 'available' | 'maintenance'
  images: ImageAsset[]
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

export type BuildingInput = Omit<Building, 'id' | 'images'> & { images?: ImageAsset[] }
export type RoomInput = Omit<Room, 'id' | 'images'> & { images?: ImageAsset[] }
export type BookingInput = Omit<Booking, 'id' | 'status'>
export interface EstateData {
  buildings: Building[]
  rooms: Room[]
  bookings: Booking[]
}
export type ActionResult = { ok: true; id: string } | { ok: false; error: string }

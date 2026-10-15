import type { Booking, Room } from '../../../../packages/domain/models.ts'

export function BookingCustomerCell({ booking }: { booking: Booking }) {
  return (
    <td>
      <div className="entity-cell">
        <span className="customer-avatar">
          {booking.customerName.split(' ').at(-1)?.slice(0, 1)}
        </span>
        <div>
          <strong>{booking.customerName}</strong>
          <span className="cell-subtitle">{booking.customerPhone}</span>
        </div>
      </div>
    </td>
  )
}

export function BookingRoomCell({ room, buildingName }: { room?: Room; buildingName?: string }) {
  return (
    <td>
      <strong className="cell-title">Phòng {room?.roomNumber}</strong>
      <span className="cell-subtitle">{buildingName}</span>
    </td>
  )
}

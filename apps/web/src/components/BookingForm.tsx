import type {
  ActionResult,
  Booking,
  BookingInput,
  Building,
  Room,
} from '../../../../packages/domain/models.ts'
import { bookingRoomError } from '../domain/validation.ts'
import { FormPanel } from './FormPanel'
import { formText } from '../utils/form'

export function BookingForm({
  booking,
  rooms,
  buildings,
  onClose,
  onSave,
}: {
  booking?: Booking
  rooms: Room[]
  buildings: Building[]
  onClose: () => void
  onSave: (input: BookingInput) => ActionResult
}) {
  return (
    <FormPanel
      title={booking ? 'Chỉnh sửa lịch đặt phòng' : 'Thêm lịch đặt phòng'}
      onClose={onClose}
      onSubmit={(data) =>
        onSave({
          roomId: formText(data, 'roomId'),
          customerName: formText(data, 'customerName'),
          customerPhone: formText(data, 'customerPhone'),
          checkIn: formText(data, 'checkIn'),
          checkOut: formText(data, 'checkOut'),
        })
      }
    >
      <label className="full-width">
        Phòng *
        <select aria-label="Phòng *" name="roomId" defaultValue={booking?.roomId ?? ''} required>
          <option value="">Chọn phòng</option>
          {rooms.map((room) => (
            <option
              key={room.id}
              value={room.id}
              disabled={Boolean(bookingRoomError(room, buildings))}
            >
              {buildings.find((item) => item.id === room.buildingId)?.name} · Phòng{' '}
              {room.roomNumber}
              {room.status === 'maintenance' ? ' (Bảo trì)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tên khách hàng *
        <input
          name="customerName"
          defaultValue={booking?.customerName}
          placeholder="Họ và tên"
          required
        />
      </label>
      <label>
        Số điện thoại *
        <input
          name="customerPhone"
          type="tel"
          defaultValue={booking?.customerPhone}
          placeholder="090 123 4567"
          required
        />
      </label>
      <label>
        Ngày nhận phòng *
        <input name="checkIn" type="date" defaultValue={booking?.checkIn} required />
      </label>
      <label>
        Ngày trả phòng *
        <input name="checkOut" type="date" defaultValue={booking?.checkOut} required />
      </label>
      <p className="field-hint full-width">
        Lịch mới được xác nhận khi lưu. Ngày trả phòng có thể trùng ngày nhận phòng của lịch tiếp
        theo.
      </p>
    </FormPanel>
  )
}

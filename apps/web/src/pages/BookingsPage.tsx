import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useEstateStore } from '../AppContext'
import type { Booking } from '../../../../packages/domain/models.ts'
import { bookingRoomError } from '../domain/validation'
import { BookingForm } from '../components/BookingForm'
import { BookingCustomerCell, BookingRoomCell } from '../components/BookingDetails'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, PageHeading, RowActions, SearchInput, SuccessNotice } from '../components/PageParts'
import { dateLabel } from '../utils/format'

export function BookingsPage() {
  const buildings = useEstateStore(state => state.buildings)
  const rooms = useEstateStore(state => state.rooms)
  const bookings = useEstateStore(state => state.bookings)
  const addBooking = useEstateStore(state => state.addBooking)
  const updateBooking = useEstateStore(state => state.updateBooking)
  const cancelBooking = useEstateStore(state => state.cancelBooking)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Booking | 'new' | null>(null)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [message, setMessage] = useState('')
  const canBook = rooms.some(room => !bookingRoomError(room, buildings))
  const filtered = bookings.filter(booking => (!status || booking.status === status) && `${booking.customerName} ${booking.customerPhone}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  return <>
    <PageHeading title="Lịch đặt phòng" subtitle="Quản lý khách hàng, thời gian lưu trú và lịch sử đặt phòng." addLabel="Thêm lịch đặt" onAdd={() => setEditing('new')} disabled={!canBook} />
    {!canBook && <div className="notice info">Cần có phòng không bảo trì trong tòa nhà đang hoạt động để tạo lịch đặt mới.</div>}
    <SuccessNotice message={message} />
    <section className="panel">
      <div className="table-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Tìm khách hàng hoặc số điện thoại..." /><select aria-label="Lọc theo trạng thái booking" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="confirmed">Đã xác nhận</option><option value="cancelled">Đã hủy</option></select><span className="result-count">{filtered.length} lịch đặt</span></div>
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Khách hàng</th><th>Phòng / Tòa nhà</th><th>Nhận phòng</th><th>Trả phòng</th><th>Trạng thái</th><th className="align-right">Thao tác</th></tr></thead><tbody>{filtered.map(booking => {
        const room = rooms.find(item => item.id === booking.roomId)
        return <tr key={booking.id}>
          <BookingCustomerCell booking={booking} />
          <BookingRoomCell room={room} buildingName={buildings.find(item => item.id === room?.buildingId)?.name} />
          <td><span className="date-cell"><CalendarDays size={14} />{dateLabel(booking.checkIn)}</span></td><td>{dateLabel(booking.checkOut)}</td><td><Badge status={booking.status} /></td>
          <td><RowActions name={`lịch của ${booking.customerName}`} deleteLabel="Hủy" disabled={booking.status === 'cancelled'} onEdit={() => setEditing(booking)} onDelete={() => setCancelling(booking)} /></td>
        </tr>
      })}</tbody></table></div> : <EmptyState>{bookings.length ? 'Không tìm thấy lịch đặt phù hợp.' : 'Chọn một phòng khả dụng và tạo lịch đặt đầu tiên.'}</EmptyState>}
      <div className="table-footer">Booking đã hủy được giữ trong lịch sử và không chặn lịch mới.</div>
    </section>
    {editing && <BookingForm booking={editing === 'new' ? undefined : editing} rooms={rooms} buildings={buildings} onClose={() => setEditing(null)} onSave={input => {
      const result = editing === 'new' ? addBooking(input) : updateBooking(editing.id, input)
      if (result.ok) { setMessage(editing === 'new' ? 'Đã tạo và xác nhận lịch đặt phòng.' : 'Đã cập nhật lịch đặt phòng.'); setEditing(null) }
      return result
    }} />}
    {cancelling && <ConfirmDialog title="Hủy lịch đặt phòng?" label="Hủy lịch đặt" description={`Hủy lịch đặt của ${cancelling.customerName} (${dateLabel(cancelling.checkIn)} – ${dateLabel(cancelling.checkOut)})? Thao tác này không thể hoàn tác. Lịch vẫn được giữ trong lịch sử.`} onClose={() => setCancelling(null)} onConfirm={() => {
      const result = cancelBooking(cancelling.id)
      if (result.ok) { setMessage('Đã hủy lịch đặt phòng. Lịch sử được giữ nguyên.'); setCancelling(null) }
      return result
    }} />}
  </>
}

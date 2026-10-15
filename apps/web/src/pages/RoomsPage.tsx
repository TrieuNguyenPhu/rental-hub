import { useState } from 'react'
import { DoorOpen } from 'lucide-react'
import { useEstateStore } from '../AppContext'
import type { Room } from '../../../../packages/domain/models.ts'
import { RoomForm } from '../components/RoomForm'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, PageHeading, RowActions, SearchInput, SuccessNotice } from '../components/PageParts'
import { currency } from '../utils/format'

export function RoomsPage() {
  const buildings = useEstateStore(state => state.buildings)
  const rooms = useEstateStore(state => state.rooms)
  const addRoom = useEstateStore(state => state.addRoom)
  const updateRoom = useEstateStore(state => state.updateRoom)
  const deleteRoom = useEstateStore(state => state.deleteRoom)
  const [query, setQuery] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Room | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)
  const [message, setMessage] = useState('')
  const filtered = rooms.filter(room => (!buildingId || room.buildingId === buildingId) && (!status || room.status === status) && room.roomNumber.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  return <>
    <PageHeading title="Phòng" subtitle="Theo dõi phòng, giá thuê và tình trạng sẵn sàng." addLabel="Thêm phòng" onAdd={() => setEditing('new')} disabled={!buildings.length} />
    {!buildings.length && <div className="notice info">Hãy tạo tòa nhà trước khi thêm phòng.</div>}
    <SuccessNotice message={message} />
    <section className="panel">
      <div className="table-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Tìm theo số phòng..." /><select aria-label="Lọc theo tòa nhà" value={buildingId} onChange={event => setBuildingId(event.target.value)}><option value="">Tất cả tòa nhà</option>{buildings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Lọc theo trạng thái phòng" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="available">Khả dụng</option><option value="occupied">Đang sử dụng</option><option value="maintenance">Bảo trì</option></select><span className="result-count">{filtered.length} phòng</span></div>
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Phòng</th><th>Tòa nhà</th><th>Tầng</th><th>Diện tích</th><th>Giá thuê / tháng</th><th>Trạng thái</th><th className="align-right">Thao tác</th></tr></thead><tbody>{filtered.map(room => <tr key={room.id}>
        <td><div className="entity-cell"><span className="entity-icon"><DoorOpen size={19} />{room.images[0] && <img src={room.images[0].url600} alt={`Ảnh phòng ${room.roomNumber}`} onError={event => { event.currentTarget.hidden = true }} />}</span><strong>Phòng {room.roomNumber}</strong></div></td>
        <td>{buildings.find(item => item.id === room.buildingId)?.name}</td><td>{room.floor}</td><td>{room.area} m²</td><td className="money">{currency(room.rentalPrice)}</td><td><Badge status={room.status} /></td>
        <td><RowActions name={`phòng ${room.roomNumber}`} onEdit={() => setEditing(room)} onDelete={() => setDeleting(room)} /></td>
      </tr>)}</tbody></table></div> : <EmptyState>{rooms.length ? 'Không có phòng phù hợp với các bộ lọc đã chọn.' : 'Thêm phòng vào một tòa nhà để bắt đầu nhận lịch đặt.'}</EmptyState>}
      <div className="table-footer">{rooms.length} phòng trong danh mục · Giá thuê tính bằng VND</div>
    </section>
    {editing && <RoomForm room={editing === 'new' ? undefined : editing} buildings={buildings} onClose={() => setEditing(null)} onSave={input => {
      const result = editing === 'new' ? addRoom(input) : updateRoom(editing.id, input)
      if (result.ok) { setMessage(editing === 'new' ? 'Đã thêm phòng.' : 'Đã cập nhật phòng.'); setEditing(null) }
      return result
    }} />}
    {deleting && <ConfirmDialog title="Xóa phòng?" description={`Bạn muốn xóa phòng ${deleting.roomNumber}? Phòng có booking, kể cả đã hủy, sẽ được giữ lại để bảo toàn lịch sử.`} onClose={() => setDeleting(null)} onConfirm={() => {
      const result = deleteRoom(deleting.id)
      if (result.ok) { setMessage('Đã xóa phòng.'); setDeleting(null) }
      return result
    }} />}
  </>
}

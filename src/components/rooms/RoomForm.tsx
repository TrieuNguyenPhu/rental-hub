import { useState } from 'react'
import type { ActionResult, Building, Room, RoomInput } from '../../types'
import { FormPanel } from '../common/FormPanel'
import { formText } from '../../utils/form'
import { ImageUploader } from '../common/ImageUploader'
import { useEstateStore } from '../../store/estateStore'

export function RoomForm({ room, buildings, onClose, onSave }: { room?: Room; buildings: Building[]; onClose: () => void; onSave: (input: RoomInput) => ActionResult }) {
  const [buildingId, setBuildingId] = useState(room?.buildingId ?? '')
  const building = buildings.find(item => item.id === buildingId)
  const saved = useEstateStore(state => state.rooms.find(item => item.id === room?.id))
  return <FormPanel title={room ? 'Chỉnh sửa phòng' : 'Thêm phòng'} onClose={onClose} onSubmit={data => onSave({
    buildingId, roomNumber: formText(data, 'roomNumber'), floor: Number(data.get('floor')),
    area: Number(data.get('area')), rentalPrice: Number(data.get('rentalPrice')), status: formText(data, 'status') as Room['status'],
  })}>
    <label className="full-width">Tòa nhà *<select aria-label="Tòa nhà *" value={buildingId} onChange={event => setBuildingId(event.target.value)} required><option value="">Chọn tòa nhà</option>{buildings.map(item => <option key={item.id} value={item.id}>{item.name} · {item.city}</option>)}</select></label>
    <label>Số phòng *<input name="roomNumber" defaultValue={room?.roomNumber} placeholder="Ví dụ: 101" required /></label>
    <label>Tầng *<input aria-label="Tầng *" aria-describedby="room-floor-hint" name="floor" type="number" min="1" max={building?.floors} step="1" defaultValue={room?.floor ?? ''} required /><span id="room-floor-hint" className="field-hint">{building ? `Tòa nhà có ${building.floors} tầng.` : 'Chọn tòa nhà để xem số tầng.'}</span></label>
    <label>Diện tích (m²) *<input name="area" type="number" min="0.01" step="any" defaultValue={room?.area ?? ''} required /></label>
    <label>Giá thuê / tháng (VND) *<input name="rentalPrice" type="number" min="0" step="1" defaultValue={room?.rentalPrice ?? ''} required /></label>
    <label className="full-width">Trạng thái *<select aria-label="Trạng thái *" name="status" defaultValue={room?.status ?? 'available'}><option value="available">Khả dụng</option><option value="occupied">Đang sử dụng</option><option value="maintenance">Bảo trì</option></select></label>
    {saved ? <ImageUploader entityType="room" entityId={saved.id} images={saved.images} onChange={images => {
      const current = useEstateStore.getState().rooms.find(item => item.id === saved.id)
      if (!current) throw new Error('Phòng không còn tồn tại.')
      const result = useEstateStore.getState().updateRoom(saved.id, { ...current, images })
      if (!result.ok) throw new Error(result.error)
    }} /> : <p className="field-hint full-width">Lưu phòng trước khi thêm ảnh.</p>}
  </FormPanel>
}

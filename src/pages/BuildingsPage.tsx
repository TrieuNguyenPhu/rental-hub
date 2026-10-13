import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { useEstateStore } from '../store/estateStore'
import type { Building } from '../types'
import { BuildingForm } from '../components/buildings/BuildingForm'
import { Badge } from '../components/common/Badge'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { EmptyState, PageHeading, RowActions, SearchInput, SuccessNotice } from '../components/common/PageParts'

export function BuildingsPage() {
  const { buildings, rooms, addBuilding, updateBuilding, deleteBuilding } = useEstateStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Building | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Building | null>(null)
  const [message, setMessage] = useState('')
  const filtered = buildings.filter(item => item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  return <>
    <PageHeading title="Tòa nhà" subtitle="Quản lý thông tin và trạng thái các tòa nhà của bạn." addLabel="Thêm tòa nhà" onAdd={() => setEditing('new')} />
    <SuccessNotice message={message} />
    <section className="panel">
      <div className="table-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Tìm theo tên tòa nhà..." /><span className="result-count">{filtered.length} / {buildings.length} tòa nhà</span></div>
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Tòa nhà</th><th>Thành phố</th><th>Số tầng</th><th>Phòng</th><th>Trạng thái</th><th className="align-right">Thao tác</th></tr></thead><tbody>{filtered.map(building => <tr key={building.id}>
        <td><div className="entity-cell"><span className="entity-icon"><Building2 size={20} />{building.images[0] && <img src={building.images[0].url600} alt={`Ảnh ${building.name}`} onError={event => { event.currentTarget.hidden = true }} />}</span><div><strong>{building.name}</strong><span className="cell-subtitle">{building.address}</span></div></div></td>
        <td>{building.city}</td><td>{building.floors} tầng</td><td>{rooms.filter(room => room.buildingId === building.id).length} phòng</td><td><Badge status={building.status} /></td>
        <td><RowActions name={building.name} onEdit={() => setEditing(building)} onDelete={() => setDeleting(building)} /></td>
      </tr>)}</tbody></table></div> : <EmptyState>{query ? 'Không tìm thấy tòa nhà phù hợp. Hãy thử tên khác.' : 'Thêm tòa nhà đầu tiên để bắt đầu quản lý phòng.'}</EmptyState>}
      <div className="table-footer">Danh sách tòa nhà · Dữ liệu lưu trên trình duyệt</div>
    </section>
    {editing && <BuildingForm building={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={input => {
      const result = editing === 'new' ? addBuilding(input) : updateBuilding(editing.id, input)
      if (result.ok) { setMessage(editing === 'new' ? 'Đã thêm tòa nhà.' : 'Đã cập nhật tòa nhà.'); setEditing(null) }
      return result
    }} />}
    {deleting && <ConfirmDialog title="Xóa tòa nhà?" description={`Bạn muốn xóa “${deleting.name}”? Chỉ có thể xóa tòa nhà không còn phòng liên kết.`} onClose={() => setDeleting(null)} onConfirm={() => {
      const result = deleteBuilding(deleting.id)
      if (result.ok) { setMessage('Đã xóa tòa nhà.'); setDeleting(null) }
      return result
    }} />}
  </>
}

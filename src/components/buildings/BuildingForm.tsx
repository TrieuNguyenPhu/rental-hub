import type { ActionResult, Building, BuildingInput } from '../../types'
import { FormPanel } from '../common/FormPanel'
import { formText } from '../../utils/form'

export function BuildingForm({ building, onClose, onSave }: { building?: Building; onClose: () => void; onSave: (input: BuildingInput) => ActionResult }) {
  return <FormPanel title={building ? 'Chỉnh sửa tòa nhà' : 'Thêm tòa nhà'} onClose={onClose} onSubmit={data => onSave({
    name: formText(data, 'name'), address: formText(data, 'address'), city: formText(data, 'city'),
    floors: Number(data.get('floors')), status: formText(data, 'status') as Building['status'],
  })}>
    <label className="full-width">Tên tòa nhà *<input name="name" defaultValue={building?.name} placeholder="Ví dụ: Riverside Residence" required /></label>
    <label className="full-width">Địa chỉ *<input name="address" defaultValue={building?.address} placeholder="Số nhà, đường, quận/huyện" required /></label>
    <label>Thành phố *<input name="city" defaultValue={building?.city} placeholder="TP. Hồ Chí Minh" required /></label>
    <label>Số tầng *<input name="floors" type="number" min="1" step="1" defaultValue={building?.floors ?? ''} required /></label>
    <label className="full-width">Trạng thái *<select aria-label="Trạng thái *" name="status" defaultValue={building?.status ?? 'active'}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="maintenance">Bảo trì</option></select></label>
  </FormPanel>
}

import type { ActionResult, Building, BuildingInput } from '../../../../packages/domain/models.ts'
import { FormPanel } from './FormPanel'
import { formText } from '../utils/form'
import { ImageUploader } from './ImageUploader'
import { useEstateStore, useServices } from '../AppContext'

export function BuildingForm({
  building,
  onClose,
  onSave,
}: {
  building?: Building
  onClose: () => void
  onSave: (input: BuildingInput) => ActionResult
}) {
  const { estateStore } = useServices()
  const saved = useEstateStore((state) => state.buildings.find((item) => item.id === building?.id))
  return (
    <FormPanel
      title={building ? 'Chỉnh sửa tòa nhà' : 'Thêm tòa nhà'}
      onClose={onClose}
      onSubmit={(data) =>
        onSave({
          name: formText(data, 'name'),
          address: formText(data, 'address'),
          city: formText(data, 'city'),
          floors: Number(data.get('floors')),
          status: formText(data, 'status') as Building['status'],
        })
      }
    >
      <label className="full-width">
        Tên tòa nhà *
        <input
          name="name"
          defaultValue={building?.name}
          placeholder="Ví dụ: Riverside Residence"
          required
        />
      </label>
      <label className="full-width">
        Địa chỉ *
        <input
          name="address"
          defaultValue={building?.address}
          placeholder="Số nhà, đường, quận/huyện"
          required
        />
      </label>
      <label>
        Thành phố *
        <input name="city" defaultValue={building?.city} placeholder="TP. Hồ Chí Minh" required />
      </label>
      <label>
        Số tầng *
        <input
          name="floors"
          type="number"
          min="1"
          step="1"
          defaultValue={building?.floors ?? ''}
          required
        />
      </label>
      <label className="full-width">
        Trạng thái *
        <select aria-label="Trạng thái *" name="status" defaultValue={building?.status ?? 'active'}>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Ngừng hoạt động</option>
          <option value="maintenance">Bảo trì</option>
        </select>
      </label>
      {saved ? (
        <ImageUploader
          entityType="building"
          entityId={saved.id}
          images={saved.images}
          onChange={(images) => {
            const current = estateStore.getState().buildings.find((item) => item.id === saved.id)
            if (!current) throw new Error('Tòa nhà không còn tồn tại.')
            const result = estateStore.getState().updateBuilding(saved.id, { ...current, images })
            if (!result.ok) throw new Error(result.error)
          }}
        />
      ) : (
        <p className="field-hint full-width">Lưu tòa nhà trước khi thêm ảnh.</p>
      )}
    </FormPanel>
  )
}

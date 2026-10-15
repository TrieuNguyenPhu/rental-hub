import type { Booking, Building, Room } from '../../../../packages/domain/models.ts'

const labels = { active: 'Đang hoạt động', inactive: 'Ngừng hoạt động', maintenance: 'Bảo trì', available: 'Khả dụng', occupied: 'Đang sử dụng', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' }

export function Badge({ status }: { status: Building['status'] | Room['status'] | Booking['status'] }) {
  return <span className={`badge ${status}`}><span className="badge-dot" />{labels[status]}</span>
}

import { ArrowRight, Building2, CalendarCheck2, DoorOpen, MapPin, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEstateStore } from '../AppContext'
import { Badge } from '../components/Badge'
import { BookingCustomerCell, BookingRoomCell } from '../components/BookingDetails'
import { EmptyState, PageHeading } from '../components/PageParts'
import { dateLabel } from '../utils/format'
import { localDate } from '../domain/dates'

export function DashboardPage() {
  const buildings = useEstateStore(state => state.buildings)
  const rooms = useEstateStore(state => state.rooms)
  const bookings = useEstateStore(state => state.bookings)
  const available = rooms.filter(room => room.status === 'available').length
  const current = bookings.filter(booking => booking.status === 'confirmed' && booking.checkOut > localDate())
  const upcoming = [...current].sort((a, b) => a.checkIn.localeCompare(b.checkIn)).slice(0, 5)
  const stats = [
    { label: 'Tổng tòa nhà', value: buildings.length, detail: `${buildings.filter(building => building.status === 'active').length} đang hoạt động`, icon: Building2, color: 'blue', to: '/buildings' },
    { label: 'Tổng số phòng', value: rooms.length, detail: `Thuộc ${buildings.length} tòa nhà`, icon: DoorOpen, color: 'violet', to: '/rooms' },
    { label: 'Phòng khả dụng', value: available, detail: `${rooms.filter(room => room.status === 'maintenance').length} phòng đang bảo trì`, icon: CircleCheck, color: 'green', to: '/rooms' },
    { label: 'Lịch đặt còn hiệu lực', value: current.length, detail: 'Đã xác nhận và chưa trả phòng', icon: CalendarCheck2, color: 'orange', to: '/bookings' },
  ]
  return <>
    <PageHeading title="Tổng quan" subtitle="Mọi thông tin về bất động sản của bạn, trong một không gian." />
    <div className="stats-grid">{stats.map(stat => <Link to={stat.to} className="stat-card" key={stat.label}><div className="stat-top"><span>{stat.label}</span><span className={`stat-icon ${stat.color}`}><stat.icon size={21} /></span></div><strong className="stat-value">{stat.value}</strong><p>{stat.detail}</p></Link>)}</div>
    <section className="panel dashboard-bookings"><div className="section-heading"><div><h2>Lịch đặt còn hiệu lực</h2><p>Các lịch đã xác nhận, theo ngày nhận phòng.</p></div><Link className="text-link" to="/bookings">Xem tất cả <ArrowRight size={16} /></Link></div>
      {upcoming.length ? <div className="table-scroll"><table><thead><tr><th>Khách hàng</th><th>Phòng / Tòa nhà</th><th>Nhận phòng</th><th>Trả phòng</th><th>Trạng thái</th></tr></thead><tbody>{upcoming.map(booking => {
        const room = rooms.find(item => item.id === booking.roomId)
        const building = buildings.find(item => item.id === room?.buildingId)
        return <tr key={booking.id}><BookingCustomerCell booking={booking} /><BookingRoomCell room={room} buildingName={building?.name} /><td>{dateLabel(booking.checkIn)}</td><td>{dateLabel(booking.checkOut)}</td><td><Badge status={booking.status} /></td></tr>
      })}</tbody></table></div> : <EmptyState>Chưa có lịch đặt còn hiệu lực. Bạn có thể tạo lịch mới tại trang Lịch đặt phòng.</EmptyState>}
    </section>
    <section className="portfolio-section"><div className="section-heading"><div><h2>Danh mục tòa nhà</h2><p>Thông tin hoạt động tại từng địa điểm.</p></div><Link className="text-link" to="/buildings">Quản lý tòa nhà <ArrowRight size={16} /></Link></div>
      {buildings.length ? <div className="building-grid">{buildings.map(building => {
        const buildingRooms = rooms.filter(room => room.buildingId === building.id)
        const count = buildingRooms.filter(room => room.status === 'available').length
        return <article className="building-card" key={building.id}><div className="building-card-top"><span className="entity-icon"><Building2 size={22} /></span><Badge status={building.status} /></div><h3>{building.name}</h3><p className="building-location"><MapPin size={14} />{building.city}</p><p className="building-address">{building.address}</p><div className="building-metrics"><div><strong>{building.floors}</strong><span>Tầng</span></div><div><strong>{buildingRooms.length}</strong><span>Phòng</span></div><div><strong>{count}</strong><span>Khả dụng</span></div></div></article>
      })}</div> : <div className="panel"><EmptyState>Thêm tòa nhà để bắt đầu xây dựng danh mục của bạn.</EmptyState></div>}
    </section>
  </>
}

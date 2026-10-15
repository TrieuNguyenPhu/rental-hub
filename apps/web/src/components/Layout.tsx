import { useState } from 'react'
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Database,
  DoorOpen,
  LayoutDashboard,
  Menu,
  RotateCcw,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEstateStore, useServices } from '../AppContext'
import { ConfirmDialog } from './ConfirmDialog'
import { SuccessNotice } from './PageParts'

const navigation = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/buildings', label: 'Tòa nhà', icon: Building2 },
  { to: '/rooms', label: 'Phòng', icon: DoorOpen },
  { to: '/bookings', label: 'Lịch đặt phòng', icon: CalendarDays },
]

export function Layout() {
  const { sharedData } = useServices()
  const [menuOpen, setMenuOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [message, setMessage] = useState('')
  const resetDemoData = useEstateStore((state) => state.resetDemoData)
  const storageWarning = useEstateStore((state) => state.storageWarning)
  const exportData = useEstateStore((state) => state.exportData)
  const downloadData = () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'rental-hub-backup.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const { pathname } = useLocation()
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <NavLink to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">
            <Building2 size={24} />
          </span>
          <span>
            Estate<span className="brand-accent">Flow</span>
            <small>QUẢN LÝ BẤT ĐỘNG SẢN</small>
          </span>
        </NavLink>
        <button
          className="icon-button sidebar-close"
          aria-label="Đóng điều hướng"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <span className="nav-label">KHÔNG GIAN QUẢN LÝ</span>
        <nav aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                setMenuOpen(false)
                setMessage('')
              }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Database size={19} />
            <div>
              <strong>{sharedData ? 'Demo công khai' : 'Không gian local'}</strong>
              <p>{sharedData ? 'Mọi người cùng thấy dữ liệu và ảnh' : 'Dữ liệu trên trình duyệt này'}</p>
            </div>
          </div>
          <button className="reset-button export-button" onClick={downloadData}>
            Xuất dữ liệu
          </button>
          <button
            className="reset-button"
            onClick={() => {
              downloadData()
              setResetOpen(true)
            }}
          >
            <RotateCcw size={16} />
            Khôi phục dữ liệu demo
          </button>
          <p className="version">EstateFlow · MVP 1.0</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="header">
          <div className="header-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở điều hướng"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="header-system">EstateFlow</span>
            <ChevronRight size={15} />
            <span>
              {navigation.find((item) => item.to === pathname)?.label ?? 'Không tìm thấy'}
            </span>
          </div>
          <span className="workspace-label">
            <span />
            {sharedData ? 'Dữ liệu chung trên AWS' : 'Dữ liệu trên thiết bị này'}
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          {sharedData && <div className="notice info" role="note">Demo công khai: mọi người đều xem và sửa cùng dữ liệu, gồm tên và số điện thoại trong lịch đặt. Chỉ nhập dữ liệu giả.</div>}
          <SuccessNotice message={message} />
          {storageWarning && (
            <div className="notice error" role="alert">
              {storageWarning}
            </div>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>EstateFlow · Quản lý bất động sản</span>
          <span>{sharedData ? 'Demo công khai · Chỉ nhập thông tin giả' : 'Dữ liệu được lưu trên trình duyệt này'}</span>
        </footer>
      </div>
      {resetOpen && (
        <ConfirmDialog
          title="Khôi phục dữ liệu demo?"
          label="Khôi phục demo"
          description={sharedData ? 'Dữ liệu chung của tất cả người truy cập sẽ được thay bằng dữ liệu demo. Thao tác này không thể hoàn tác.' : 'Toàn bộ dữ liệu hiện tại trên trình duyệt này sẽ được thay bằng 3 tòa nhà, 12 phòng và 7 lịch đặt demo. Thao tác này không thể hoàn tác.'}
          onClose={() => setResetOpen(false)}
          onConfirm={async () => {
            const result = await resetDemoData()
            if (result.ok) {
              setMessage('Đã khôi phục dữ liệu demo.')
              setResetOpen(false)
            }
            return result
          }}
        />
      )}
    </div>
  )
}

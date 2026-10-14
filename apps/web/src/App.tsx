import { Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { BuildingsPage } from './pages/BuildingsPage'
import { RoomsPage } from './pages/RoomsPage'
import { BookingsPage } from './pages/BookingsPage'
import { AwsAdminGate } from './components/AwsAdminGate'
import { ServicesProvider, useServices, type AppServices } from './AppContext'

export default function App({ services }: { services: AppServices }) {
  return <ServicesProvider value={services}><AppRoutes /></ServicesProvider>
}

function AppRoutes() {
  const { admin } = useServices()
  const routes = <Routes><Route element={<Layout />}>
    <Route index element={<DashboardPage />} />
    <Route path="buildings" element={<BuildingsPage />} />
    <Route path="rooms" element={<RoomsPage />} />
    <Route path="bookings" element={<BookingsPage />} />
    <Route path="*" element={<div className="not-found"><p className="eyebrow">404 · KHÔNG TÌM THẤY</p><h1>Trang này không tồn tại</h1><p>Đường dẫn có thể đã thay đổi. Trở về tổng quan để tiếp tục.</p><Link to="/" className="button primary">Về trang tổng quan</Link></div>} />
  </Route></Routes>
  return admin.enabled ? <AwsAdminGate>{routes}</AwsAdminGate> : routes
}

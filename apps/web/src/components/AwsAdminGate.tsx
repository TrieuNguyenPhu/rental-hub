import { useState, type FormEvent, type ReactNode } from 'react'
import { useServices } from '../AppContext'

export function AwsAdminGate({ children }: { children: ReactNode }) {
  const { admin } = useServices()
  const [signedIn, setSignedIn] = useState(false)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (signedIn) return children
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await admin.signIn(username.trim(), password); setPassword(''); setSignedIn(true) }
    catch { setError('Đăng nhập Admin thất bại. Kiểm tra tài khoản và mật khẩu.') }
    finally { setBusy(false) }
  }
  return <main className="admin-login"><form className="panel" onSubmit={submit}>
    <p className="eyebrow">RENTAL HUB · AWS</p><h1>Đăng nhập Admin</h1>
    <p className="page-subtitle">Tài khoản Cognito để quản lý bất động sản và tải ảnh lên S3.</p>
    <label htmlFor="admin-username">Tên đăng nhập</label><input id="admin-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
    <label htmlFor="admin-password">Mật khẩu</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button primary" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
  </form></main>
}

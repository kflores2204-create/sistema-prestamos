import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, Landmark, Users,
  CalendarDays, RefreshCw, LogOut, UserCog, ClipboardCheck,
} from 'lucide-react'
import { supabase, signOut } from './lib/supabase'
import { syncTodo } from './lib/calendarSync'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Prestamos from './pages/Prestamos'
import NuevoPrestamo from './pages/NuevoPrestamo'
import Cronograma from './pages/Cronograma'
import Cuentas from './pages/Cuentas'
import FlujoCaja from './pages/FlujoCaja'
import Clientes from './pages/Clientes'
import Cobros from './pages/Cobros'
import CuadreCaja from './pages/CuadreCaja'
import Equipo from './pages/Equipo'
import Privacidad from './pages/Privacidad'
import './styles.css'

const MODULOS = [
  { to: '/', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cobros', label: 'Cobros del Dia', icon: Wallet },
  { to: '/cuadre-caja', label: 'Cuadre de Caja', icon: ClipboardCheck },
  { to: '/cuentas', label: 'Cuentas', icon: Landmark },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/cronograma', label: 'Cronograma Cliente', icon: CalendarDays },
  { to: '/equipo', label: 'Equipo', icon: UserCog },
]

function ConfirmModal({ titulo, mensaje, onCancelar, onConfirmar }) {
  return (
    <div className="modal-backdrop" onClick={onCancelar}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <p>{mensaje}</p>
        <div className="confirm-modal-actions">
          <button className="btn secondary" onClick={onCancelar}>Cancelar</button>
          <button className="btn" style={{ background: 'var(--red-bg)', color: 'var(--red)' }} onClick={onConfirmar}>
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  )
}

function UserProfile({ user }) {
  const meta = user?.user_metadata || {}
  const nombre = meta.full_name || meta.name || 'Usuario'
  const email = user?.email || ''
  const iniciales = nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="user-profile">
      {meta.avatar_url
        ? <img className="user-profile-avatar" src={meta.avatar_url} alt={nombre} referrerPolicy="no-referrer" />
        : <div className="user-profile-avatar user-profile-avatar-fallback">{iniciales}</div>
      }
      <div className="user-profile-info">
        <div className="user-profile-name">{nombre}</div>
        <div className="user-profile-email">{email}</div>
      </div>
    </div>
  )
}

function Sidebar({ user, sincronizando, handleSync, sidebarOpen, setSidebarOpen }) {
  const location = useLocation()
  const [confirmando, setConfirmando] = useState(false)

  // cierra el menu automaticamente al navegar (comportamiento esperado en celular)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar no-print ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <h1 className="sidebar-brand">
          <img src="/icon-mark.png" alt="" className="sidebar-brand-icon" />
          Sistema de Prestamos
        </h1>
        <nav>
          {MODULOS.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-item-icon"><Icon size={18} strokeWidth={2} /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn" onClick={handleSync} disabled={sincronizando}>
            <RefreshCw size={16} strokeWidth={2.4} className={sincronizando ? 'spin' : ''} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Calendar'}
          </button>
        </div>
        <div className="sidebar-footer">
          <UserProfile user={user} />
          <button className="btn secondary" style={{ width: '100%' }} onClick={() => setConfirmando(true)}>
            <LogOut size={16} strokeWidth={2.4} />
            Cerrar sesion
          </button>
        </div>
      </aside>
      {confirmando && (
        <ConfirmModal
          titulo="Cerrar sesion"
          mensaje="¿Estas seguro que deseas cerrar sesion?"
          onCancelar={() => setConfirmando(false)}
          onConfirmar={signOut}
        />
      )}
    </>
  )
}

function AppAutenticada({ session }) {
  const [sincronizando, setSincronizando] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSync() {
    setSincronizando(true)
    try {
      const n = await syncTodo()
      alert(`Listo. Se sincronizaron ${n} cuotas con Google Calendar. Busca el calendario "Cobros - Prestamos" en tu lista de calendarios (si es nuevo, puede que tengas que activarlo con el check en el panel izquierdo de Google Calendar).`)
    } catch (err) {
      alert('No se pudo sincronizar con Calendar:\n\n' + err.message)
    }
    setSincronizando(false)
  }

  return (
    <div className="app-shell">
      <button className="hamburger-btn no-print" onClick={() => setSidebarOpen((o) => !o)} aria-label="Abrir menu">
        ☰
      </button>
      <Sidebar
        user={session.user} sincronizando={sincronizando} handleSync={handleSync}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
      />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cobros" element={<Cobros />} />
          <Route path="/cuadre-caja" element={<CuadreCaja />} />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/prestamos/:cuenta" element={<Prestamos />} />
          <Route path="/flujo-caja/:cuenta" element={<FlujoCaja />} />
          <Route path="/nuevo" element={<NuevoPrestamo />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cronograma" element={<Cronograma />} />
          <Route path="/equipo" element={<Equipo />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <BrowserRouter>
      <Routes>
        {/* publica: Google necesita poder acceder a esta pagina sin iniciar sesion */}
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/*" element={session ? <AppAutenticada session={session} /> : <Login />} />
      </Routes>
    </BrowserRouter>
  )
}

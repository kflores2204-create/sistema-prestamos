import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { supabase, signOut } from './lib/supabase'
import { syncTodo } from './lib/calendarSync'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Prestamos from './pages/Prestamos'
import NuevoPrestamo from './pages/NuevoPrestamo'
import Cronograma from './pages/Cronograma'
import FlujoCajaArequipa from './pages/FlujoCajaArequipa'
import Clientes from './pages/Clientes'
import Cobros from './pages/Cobros'
import './styles.css'

function Sidebar({ sincronizando, handleSync, sidebarOpen, setSidebarOpen }) {
  const location = useLocation()

  // cierra el menu automaticamente al navegar (comportamiento esperado en celular)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar no-print ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <h1>Sistema de Prestamos</h1>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/cobros">Cobros del Dia</NavLink>
          <NavLink to="/prestamos/BBVA">Prestamos BBVA</NavLink>
          <NavLink to="/prestamos/Caja Arequipa">Prestamos Caja Arequipa</NavLink>
          <NavLink to="/prestamos/Intereses">Prestamos Intereses</NavLink>
          <NavLink to="/nuevo">Nuevo Prestamo</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/cronograma">Cronograma Cliente</NavLink>
          <NavLink to="/flujo-caja-arequipa">Flujo Caja Arequipa</NavLink>
        </nav>
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn" onClick={handleSync} disabled={sincronizando}>
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Calendar'}
          </button>
          <button className="btn secondary" onClick={signOut}>Cerrar sesion</button>
        </div>
      </aside>
    </>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [sincronizando, setSincronizando] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

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

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div className="app-shell">
        <button className="hamburger-btn no-print" onClick={() => setSidebarOpen((o) => !o)} aria-label="Abrir menu">
          ☰
        </button>
        <Sidebar
          sincronizando={sincronizando} handleSync={handleSync}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        />
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cobros" element={<Cobros />} />
            <Route path="/prestamos/:cuenta" element={<Prestamos />} />
            <Route path="/nuevo" element={<NuevoPrestamo />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/cronograma" element={<Cronograma />} />
            <Route path="/flujo-caja-arequipa" element={<FlujoCajaArequipa />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

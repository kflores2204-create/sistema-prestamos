import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase, signOut } from './lib/supabase'
import { syncTodo } from './lib/calendarSync'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Prestamos from './pages/Prestamos'
import NuevoPrestamo from './pages/NuevoPrestamo'
import Cronograma from './pages/Cronograma'
import FlujoCajaArequipa from './pages/FlujoCajaArequipa'
import './styles.css'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar no-print">
          <h1>Sistema de Prestamos</h1>
          <nav>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/prestamos/BBVA">Prestamos BBVA</NavLink>
            <NavLink to="/prestamos/Caja Arequipa">Prestamos Caja Arequipa</NavLink>
            <NavLink to="/prestamos/Intereses">Prestamos Intereses</NavLink>
            <NavLink to="/nuevo">Nuevo Prestamo</NavLink>
            <NavLink to="/cronograma">Cronograma Cliente</NavLink>
            <NavLink to="/flujo-caja-arequipa">Flujo Caja Arequipa</NavLink>
          </nav>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn" onClick={() => syncTodo()}>Sincronizar Calendar</button>
            <button className="btn secondary" onClick={signOut}>Cerrar sesion</button>
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prestamos/:cuenta" element={<Prestamos />} />
            <Route path="/nuevo" element={<NuevoPrestamo />} />
            <Route path="/cronograma" element={<Cronograma />} />
            <Route path="/flujo-caja-arequipa" element={<FlujoCajaArequipa />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

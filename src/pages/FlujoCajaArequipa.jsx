import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyISO, formatFecha } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

export default function FlujoCajaArequipa() {
  const [movimientos, setMovimientos] = useState([])
  const [capitalPendiente, setCapitalPendiente] = useState(0)
  const [nuevo, setNuevo] = useState({ fecha: hoyISO(), monto: '', detalle: '' })
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data: flujo } = await supabase.from('flujo_caja_arequipa').select('*').order('fecha', { ascending: false })
    setMovimientos(flujo || [])

    const { data: prestamos } = await supabase
      .from('v_prestamo_resumen')
      .select('capital, num_cuotas, cuotas_pagadas')
      .eq('cuenta', 'Caja Arequipa')
    const pendiente = (prestamos || []).reduce((acc, p) => {
      const pagado = (p.cuotas_pagadas / p.num_cuotas) * p.capital
      return acc + (p.capital - pagado)
    }, 0)
    setCapitalPendiente(pendiente)
  }

  useEffect(() => { cargar() }, [])

  const prestamoInicial = movimientos.find((m) => m.detalle.includes('Prestamo inicial'))?.monto || 0
  const gastos = movimientos.filter((m) => !m.detalle.includes('Prestamo inicial'))
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto), 0)
  const disponible = Number(prestamoInicial) - capitalPendiente + totalGastos

  async function agregarGasto(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('flujo_caja_arequipa').insert({
      fecha: nuevo.fecha, monto: -Math.abs(Number(nuevo.monto)), detalle: nuevo.detalle,
    })
    setNuevo({ fecha: hoyISO(), monto: '', detalle: '' })
    setGuardando(false)
    cargar()
  }

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Flujo de Caja Arequipa</h2>
      <p style={{ color: 'var(--muted)' }}>Control del dinero que solicitaste a Caja Arequipa.</p>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Prestamo Inicial</div>
          <div className="value">{money(prestamoInicial)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Capital Prestado a Clientes (afuera)</div>
          <div className="value">{money(capitalPendiente)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Gastos / Retiros</div>
          <div className="value">{money(totalGastos)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Dinero Disponible en Cuenta</div>
          <div className="value">{money(disponible)}</div>
        </div>
      </div>

      <h3 style={{ color: 'var(--navy)' }}>Agregar gasto / retiro</h3>
      <form onSubmit={agregarGasto} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 24 }}>
        <label>Fecha
          <input className="input" type="date" required value={nuevo.fecha} onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))} />
        </label>
        <label>Monto (S/.)
          <input className="input" type="number" min="0" step="0.01" required value={nuevo.monto} onChange={(e) => setNuevo((n) => ({ ...n, monto: e.target.value }))} />
        </label>
        <label>Detalle
          <input className="input" required value={nuevo.detalle} onChange={(e) => setNuevo((n) => ({ ...n, detalle: e.target.value }))} placeholder="Ej: Pago arquitecto" />
        </label>
        <button className="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Agregar'}</button>
      </form>

      <h3 style={{ color: 'var(--navy)' }}>Detalle de Gastos / Retiros</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Monto</th><th>Detalle</th></tr></thead>
        <tbody>
          {gastos.map((g) => (
            <tr key={g.id}>
              <td>{formatFecha(g.fecha)}</td>
              <td>{money(g.monto)}</td>
              <td>{g.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

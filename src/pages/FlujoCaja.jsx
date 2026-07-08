import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyISO, formatFecha } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

export default function FlujoCaja() {
  const { cuenta: cuentaNombre } = useParams()
  const [cuenta, setCuenta] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [capitalPendiente, setCapitalPendiente] = useState(0)
  const [nuevo, setNuevo] = useState({ fecha: hoyISO(), tipo: 'egreso', monto: '', detalle: '' })
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data: c } = await supabase.from('v_saldo_cuentas').select('*').eq('nombre', cuentaNombre).single()
    setCuenta(c)
    if (c) {
      const { data: mov } = await supabase
        .from('movimientos_caja').select('*').eq('cuenta_id', c.id).order('fecha', { ascending: false })
      setMovimientos(mov || [])

      // capital que sigue afuera con clientes, en TODOS los prestamos de esta cuenta
      // (foto en tiempo real, no depende del saldo inicial ni de fechas)
      const { data: prestamos } = await supabase
        .from('v_prestamo_resumen')
        .select('capital, num_cuotas, cuotas_pagadas')
        .eq('cuenta', cuentaNombre)
      const pendiente = (prestamos || []).reduce((acc, p) => {
        const pagado = (p.cuotas_pagadas / p.num_cuotas) * p.capital
        return acc + (p.capital - pagado)
      }, 0)
      setCapitalPendiente(pendiente)
    }
  }

  useEffect(() => { cargar() }, [cuentaNombre])

  async function agregarMovimiento(e) {
    e.preventDefault()
    setGuardando(true)
    const monto = nuevo.tipo === 'ingreso' ? Math.abs(Number(nuevo.monto)) : -Math.abs(Number(nuevo.monto))
    await supabase.from('movimientos_caja').insert({
      cuenta_id: cuenta.id, fecha: nuevo.fecha, monto, detalle: nuevo.detalle,
    })
    setNuevo({ fecha: hoyISO(), tipo: 'egreso', monto: '', detalle: '' })
    setGuardando(false)
    cargar()
  }

  if (!cuenta) return <p style={{ color: 'var(--muted)' }}>Cargando...</p>

  const gastosHistoricoTotal = movimientos.filter((m) => Number(m.monto) < 0).reduce((acc, m) => acc - Number(m.monto), 0)
  const ingresosManualesTotal = movimientos.filter((m) => Number(m.monto) > 0).reduce((acc, m) => acc + Number(m.monto), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
        <Link to="/cuentas" className="volver-link"><ChevronLeft size={18} strokeWidth={2.6} /> Cuentas</Link>
      </div>
      <h2 style={{ color: 'var(--navy)', marginTop: 4 }}>Flujo de Caja - {cuenta.nombre}</h2>
      <p style={{ color: 'var(--muted)' }}>Control del dinero disponible en esta cuenta.</p>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Saldo Inicial ({formatFecha(cuenta.fecha_saldo_inicial)})</div>
          <div className="value">{money(cuenta.saldo_inicial)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Capital Cobrado</div>
          <div className="value">{money(cuenta.capital_cobrado)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Interes Recibido</div>
          <div className="value">{money(cuenta.interes_recibido)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Capital Prestado (nuevo)</div>
          <div className="value">{money(cuenta.capital_prestado_nuevo)}</div>
        </div>
        <div className="kpi-card" style={{ borderColor: 'var(--red)' }}>
          <div className="label">Capital Pendiente (afuera hoy)</div>
          <div className="value" style={{ color: 'var(--red)' }}>{money(capitalPendiente)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Ingresos Manuales</div>
          <div className="value" style={{ color: 'var(--green)' }}>{money(ingresosManualesTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Gastos / Retiros</div>
          <div className="value">{money(gastosHistoricoTotal)}</div>
        </div>
        <div className="kpi-card" style={{ borderColor: 'var(--navy)' }}>
          <div className="label">Saldo Actual</div>
          <div className="value" style={{ color: 'var(--navy)' }}>{money(cuenta.saldo_actual)}</div>
        </div>
      </div>

      <div className="historico-card">
        <div className="historico-card-titulo">Detalle historico (informativo)</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '2px 0 12px' }}>
          Vista de todo el historial de esta cuenta, igual a como la llevabas antes. No afecta el Saldo Actual de arriba.
        </p>
        {cuenta.monto_prestamo_original ? (
          <>
            <div className="historico-linea"><span>Prestamo Inicial recibido</span><b style={{ color: 'var(--navy)' }}>{money(cuenta.monto_prestamo_original)}</b></div>
            <div className="historico-linea"><span>(-) Capital prestado a clientes, aun no recuperado</span><b>- {money(capitalPendiente)}</b></div>
            <div className="historico-linea"><span>(-) Gastos / Retiros (historico completo)</span><b>- {money(gastosHistoricoTotal)}</b></div>
            <div className="historico-linea historico-total">
              <span>Dinero disponible segun formula historica</span>
              <b>{money(cuenta.monto_prestamo_original - capitalPendiente - gastosHistoricoTotal)}</b>
            </div>
          </>
        ) : (
          <>
            <div className="historico-linea"><span>Capital prestado a clientes, aun no recuperado (todos los prestamos)</span><b>- {money(capitalPendiente)}</b></div>
            <div className="historico-linea"><span>Gastos / Retiros (historico completo)</span><b>- {money(gastosHistoricoTotal)}</b></div>
          </>
        )}
      </div>

      <h3 style={{ color: 'var(--navy)' }}>Agregar movimiento</h3>
      <form onSubmit={agregarMovimiento} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 24 }}>
        <label>Tipo
          <select className="input" value={nuevo.tipo} onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value }))}>
            <option value="egreso">Egreso / Retiro</option>
            <option value="ingreso">Ingreso manual</option>
          </select>
        </label>
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

      <h3 style={{ color: 'var(--navy)' }}>Movimientos</h3>
      <table className="table-cards">
        <thead><tr><th>Fecha</th><th>Monto</th><th>Detalle</th></tr></thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td data-label="Fecha">{formatFecha(m.fecha)}</td>
              <td data-label="Monto" style={{ color: Number(m.monto) < 0 ? 'var(--red)' : 'var(--green)' }}>{money(m.monto)}</td>
              <td data-label="Detalle">{m.detalle}</td>
            </tr>
          ))}
          {movimientos.length === 0 && (
            <tr><td data-label="" colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin movimientos registrados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

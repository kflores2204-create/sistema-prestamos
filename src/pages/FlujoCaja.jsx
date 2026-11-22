import { Fragment, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Pencil, Trash2, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyISO, formatFecha } from '../lib/prestamoUtils'
import FechaInput from '../components/FechaInput'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

// Un movimiento de recargo por atraso (o vinculado a una cuota) no se edita ni
// se elimina desde aqui: si se borra, la cuota queda desincronizada. Se protege.
const esRecargo = (m, protegidos) =>
  (m.detalle || '').startsWith('Recargo por atraso') || protegidos.has(m.id)

const escCSV = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function FlujoCaja() {
  const { cuenta: cuentaNombre } = useParams()
  const [cuenta, setCuenta] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [protegidos, setProtegidos] = useState(new Set())
  const [capitalPendiente, setCapitalPendiente] = useState(0)
  const [nuevo, setNuevo] = useState({ fecha: hoyISO(), tipo: 'egreso', monto: '', detalle: '' })
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [edicion, setEdicion] = useState({ fecha: '', tipo: 'egreso', monto: '', detalle: '' })

  async function cargar() {
    const { data: c } = await supabase.from('v_saldo_cuentas').select('*').eq('nombre', cuentaNombre).single()
    setCuenta(c)
    if (c) {
      const { data: mov } = await supabase
        .from('movimientos_caja').select('*').eq('cuenta_id', c.id).order('fecha', { ascending: false })
      const lista = mov || []
      setMovimientos(lista)

      // movimientos que estan vinculados a una cuota como recargo
      const ids = lista.map((m) => m.id)
      let prot = new Set()
      if (ids.length) {
        const { data: cu } = await supabase
          .from('cuotas').select('movimiento_recargo_id').in('movimiento_recargo_id', ids)
        prot = new Set((cu || []).map((x) => x.movimiento_recargo_id))
      }
      setProtegidos(prot)

      // capital que sigue afuera con clientes, en TODOS los prestamos de esta cuenta
      // (foto en tiempo real, no depende del saldo inicial ni de fechas)
      const { data: prestamos } = await supabase
        .from('v_prestamo_resumen')
        .select('capital, total_a_pagar, pagado_hasta_hoy')
        .eq('cuenta', cuentaNombre)
      const pendiente = (prestamos || []).reduce((acc, p) => {
        const pagado = p.total_a_pagar > 0 ? (p.pagado_hasta_hoy / p.total_a_pagar) * p.capital : 0
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

  function iniciarEdicion(m) {
    const monto = Number(m.monto)
    setEditandoId(m.id)
    setEdicion({
      fecha: m.fecha,
      tipo: monto < 0 ? 'egreso' : 'ingreso',
      monto: String(Math.abs(monto)),
      detalle: m.detalle || '',
    })
  }

  function cancelarEdicion() {
    setEditandoId(null)
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    const monto = edicion.tipo === 'ingreso' ? Math.abs(Number(edicion.monto)) : -Math.abs(Number(edicion.monto))
    const { error } = await supabase.from('movimientos_caja')
      .update({ fecha: edicion.fecha, monto, detalle: edicion.detalle })
      .eq('id', editandoId)
    if (error) return alert('Error al guardar: ' + error.message)
    setEditandoId(null)
    cargar()
  }

  async function eliminarMovimiento(m) {
    const ok = window.confirm(
      `¿Eliminar este movimiento?\n\n${formatFecha(m.fecha)} · ${money(m.monto)} · ${m.detalle || ''}\n\nEsta accion no se puede deshacer.`
    )
    if (!ok) return
    const { error } = await supabase.from('movimientos_caja').delete().eq('id', m.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  function exportarCSV() {
    const cabecera = ['Fecha', 'Tipo', 'Monto', 'Detalle'].map(escCSV).join(';')
    const filas = movimientos.map((m) => [
      m.fecha,
      Number(m.monto) < 0 ? 'Egreso' : 'Ingreso',
      Math.abs(Number(m.monto)).toFixed(2).replace('.', ','),
      m.detalle,
    ].map(escCSV).join(';'))
    // BOM para que Excel reconozca los acentos y las tildes
    const contenido = '﻿' + [cabecera, ...filas].join('\r\n')
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos_${cuenta.nombre.trim().replace(/\s+/g, '_')}_${hoyISO()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
          <FechaInput required value={nuevo.fecha} onChange={(v) => setNuevo((n) => ({ ...n, fecha: v }))} />
        </label>
        <label>Monto (S/.)
          <input className="input" type="number" min="0" step="0.01" required value={nuevo.monto} onChange={(e) => setNuevo((n) => ({ ...n, monto: e.target.value }))} />
        </label>
        <label>Detalle
          <input className="input" required value={nuevo.detalle} onChange={(e) => setNuevo((n) => ({ ...n, detalle: e.target.value }))} placeholder="Ej: Pago arquitecto" />
        </label>
        <button className="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Agregar'}</button>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ color: 'var(--navy)', margin: 0 }}>Movimientos</h3>
        <button className="btn secondary" type="button" onClick={exportarCSV} disabled={movimientos.length === 0}>
          <Download size={16} strokeWidth={2.4} /> Exportar a Excel (CSV)
        </button>
      </div>
      <table className="table-cards" style={{ marginTop: 12 }}>
        <thead><tr><th>Fecha</th><th>Monto</th><th>Detalle</th><th>Acciones</th></tr></thead>
        <tbody>
          {movimientos.map((m) => {
            const protegido = esRecargo(m, protegidos)
            const enEdicion = editandoId === m.id
            return (
              <Fragment key={m.id}>
                <tr>
                  <td data-label="Fecha">{formatFecha(m.fecha)}</td>
                  <td data-label="Monto" style={{ color: Number(m.monto) < 0 ? 'var(--red)' : 'var(--green)' }}>{money(m.monto)}</td>
                  <td data-label="Detalle">
                    {m.detalle}
                    {protegido && (
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
                        Recargo ligado a una cuota: no editable desde aqui
                      </span>
                    )}
                  </td>
                  <td data-label="Acciones" style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn secondary"
                      type="button"
                      title={protegido ? 'Bloqueado: recargo ligado a una cuota' : 'Editar'}
                      disabled={protegido || enEdicion}
                      onClick={() => iniciarEdicion(m)}
                      style={{ padding: '4px 10px', fontSize: 13, marginRight: 6 }}
                    >
                      <Pencil size={14} strokeWidth={2.4} /> Editar
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      title={protegido ? 'Bloqueado: recargo ligado a una cuota' : 'Eliminar'}
                      disabled={protegido}
                      onClick={() => eliminarMovimiento(m)}
                      style={{ padding: '4px 10px', fontSize: 13, color: 'var(--red)' }}
                    >
                      <Trash2 size={14} strokeWidth={2.4} /> Eliminar
                    </button>
                  </td>
                </tr>
                {enEdicion && (
                  <tr>
                    <td colSpan={4} style={{ background: 'var(--surface-2, #f7f7f9)' }}>
                      <form onSubmit={guardarEdicion} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', padding: '8px 0' }}>
                        <label>Tipo
                          <select className="input" value={edicion.tipo} onChange={(e) => setEdicion((d) => ({ ...d, tipo: e.target.value }))}>
                            <option value="egreso">Egreso / Retiro</option>
                            <option value="ingreso">Ingreso manual</option>
                          </select>
                        </label>
                        <label>Fecha
                          <FechaInput required value={edicion.fecha} onChange={(v) => setEdicion((d) => ({ ...d, fecha: v }))} />
                        </label>
                        <label>Monto (S/.)
                          <input className="input" type="number" min="0" step="0.01" required value={edicion.monto} onChange={(e) => setEdicion((d) => ({ ...d, monto: e.target.value }))} />
                        </label>
                        <label>Detalle
                          <input className="input" required value={edicion.detalle} onChange={(e) => setEdicion((d) => ({ ...d, detalle: e.target.value }))} />
                        </label>
                        <button className="btn" type="submit">Guardar cambios</button>
                        <button className="btn secondary" type="button" onClick={cancelarEdicion}>Cancelar</button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {movimientos.length === 0 && (
            <tr><td data-label="" colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin movimientos registrados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

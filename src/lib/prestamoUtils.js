import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { syncCuota } from '../lib/calendarSync'
import { FRECUENCIAS, fechaCuota, montoConRecargo, tieneRecargoAplicado, estaAtrasada, formatFecha, hoyISO } from '../lib/prestamoUtils'
import MultiSelect from '../components/MultiSelect'
import EstadoSelect from '../components/EstadoSelect'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fechaCorta = formatFecha
const estadoClass = (e) => e.toLowerCase().replace(' ', '-')
const toDateInput = (d) => String(d).slice(0, 10)
const ESTADOS = ['ACTIVO', 'EN PROCESO', 'ATRASADO', 'FINALIZADO']

export default function Prestamos() {
  const { cuenta } = useParams()
  const [prestamos, setPrestamos] = useState([])
  const [filtroEstados, setFiltroEstados] = useState(new Set(ESTADOS))
  const [busqueda, setBusqueda] = useState('')
  const [ordenFecha, setOrdenFecha] = useState('desc')
  const [expanded, setExpanded] = useState(null)
  const [cuotasDetalle, setCuotasDetalle] = useState([])
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data } = await supabase.from('v_prestamo_resumen').select('*').eq('cuenta', cuenta)
    setPrestamos(data || [])
  }

  useEffect(() => { cargar(); cerrarDrawer(); setFiltroEstados(new Set(ESTADOS)); setBusqueda('') }, [cuenta])

  function cerrarDrawer() {
    setExpanded(null)
    setEditando(false)
  }

  async function cambiarEstadoCuota(cuota, nuevoEstado, prestamo) {
    const { data: updated } = await supabase
      .from('cuotas')
      .update({ estado: nuevoEstado, fecha_pago: nuevoEstado === 'Pagado' ? hoyISO() : null })
      .eq('id', cuota.id).select().single()
    try {
      await syncCuota(updated, {
        codigo: prestamo.codigo, num_cuotas: prestamo.num_cuotas,
        cliente_nombre: prestamo.cliente, cuenta_nombre: prestamo.cuenta,
        recargo_pct: prestamo.recargo_pct,
      })
    } catch (err) {
      alert('El pago se guardo, pero no se pudo sincronizar con Calendar: ' + err.message)
    }
    cargar()
    abrirDetalle(expanded.id)
  }

  async function abrirDetalle(prestamoId) {
    const { data: p } = await supabase.from('v_prestamo_resumen').select('*').eq('id', prestamoId).single()
    setExpanded(p)
    setEditando(false)
    const { data } = await supabase.from('cuotas').select('*').eq('prestamo_id', prestamoId).order('numero_cuota')
    setCuotasDetalle(data || [])
  }

  function empezarEdicion() {
    setFormEdit({
      cliente: expanded.cliente,
      fecha_prestamo: toDateInput(expanded.fecha_prestamo),
      capital: expanded.capital,
      tasa_interes: expanded.tasa_interes,
      num_cuotas: expanded.num_cuotas,
      frecuencia: expanded.frecuencia || 'semanal',
      tieneRecargo: !!expanded.recargo_pct,
      recargoPct: expanded.recargo_pct ? String(Number(expanded.recargo_pct) * 100) : '5',
    })
    setEditando(true)
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      await supabase.from('clientes').update({ nombre: formEdit.cliente }).eq('id', expanded.cliente_id)

      const { data: prestamoActualizado, error: errP } = await supabase
        .from('prestamos')
        .update({
          fecha_prestamo: formEdit.fecha_prestamo,
          capital: Number(formEdit.capital),
          tasa_interes: Number(formEdit.tasa_interes),
          num_cuotas: Number(formEdit.num_cuotas),
          frecuencia: formEdit.frecuencia,
          recargo_pct: formEdit.tieneRecargo ? Number(formEdit.recargoPct) / 100 : null,
        })
        .eq('id', expanded.id)
        .select()
        .single()
      if (errP) throw errP

      // conserva cuales cuotas ya estaban Pagado, por numero de cuota, antes de recalcular fechas/montos
      const { data: cuotasActuales } = await supabase
        .from('cuotas').select('numero_cuota, estado').eq('prestamo_id', expanded.id)
      const pagadasPorNumero = new Set((cuotasActuales || []).filter((c) => c.estado === 'Pagado').map((c) => c.numero_cuota))

      const numCuotasNuevo = Number(formEdit.num_cuotas)
      const sePerderian = [...pagadasPorNumero].filter((n) => n > numCuotasNuevo)
      if (sePerderian.length > 0) {
        const ok = confirm(
          `Advertencia: reducir a ${numCuotasNuevo} cuotas va a eliminar el pago ya registrado en la(s) cuota(s) ${sePerderian.join(', ')}. Continuar de todas formas?`
        )
        if (!ok) { setGuardando(false); return }
      }

      const nuevasCuotas = []
      for (let n = 1; n <= numCuotasNuevo; n++) {
        nuevasCuotas.push({
          prestamo_id: expanded.id, numero_cuota: n,
          fecha_vencimiento: fechaCuota(formEdit.fecha_prestamo, n, formEdit.frecuencia),
          monto: prestamoActualizado.monto_cuota,
          estado: pagadasPorNumero.has(n) ? 'Pagado' : 'Pendiente',
        })
      }

      await supabase.from('cuotas').delete().eq('prestamo_id', expanded.id)
      await supabase.from('cuotas').insert(nuevasCuotas)

      await cargar()
      await abrirDetalle(expanded.id)
      setEditando(false)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    }
    setGuardando(false)
  }

  async function eliminarPrestamo() {
    if (!confirm(`Seguro que quieres eliminar el prestamo ${expanded.codigo} de ${expanded.cliente}? Esta accion no se puede deshacer.`)) return
    await supabase.from('prestamos').delete().eq('id', expanded.id)
    cerrarDrawer()
    cargar()
  }

  const filtrados = prestamos
    .filter((p) => filtroEstados.has(p.estado))
    .filter((p) => {
      if (!busqueda) return true
      const t = `${p.cliente} ${p.cliente_dni || ''} ${p.codigo}`.toLowerCase()
      return t.includes(busqueda.toLowerCase())
    })
    .sort((a, b) => {
      const da = new Date(a.fecha_prestamo), db = new Date(b.fecha_prestamo)
      return ordenFecha === 'asc' ? da - db : db - da
    })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: 'var(--navy)', margin: 0 }}>Prestamos {cuenta}</h2>
        <input
          className="input search-box"
          placeholder="Buscar por nombre, DNI o codigo..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <MultiSelect
          options={ESTADOS}
          selected={filtroEstados}
          onChange={setFiltroEstados}
          placeholder="Filtrar por estado..."
          labelFor={(e) => e.charAt(0) + e.slice(1).toLowerCase()}
        />
      </div>

      <table className="table-cards">
        <thead>
          <tr>
            <th>Codigo</th><th>Cliente</th><th>DNI</th>
            <th className="th-ordenable" onClick={() => setOrdenFecha((o) => (o === 'asc' ? 'desc' : 'asc'))}>
              Fecha {ordenFecha === 'asc' ? '↑' : '↓'}
            </th>
            <th>Capital</th><th>Total a Pagar</th><th>Saldo</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((p) => (
            <tr key={p.id} onClick={() => abrirDetalle(p.id)} style={{ cursor: 'pointer' }}>
              <td data-label="Codigo">{p.codigo}</td>
              <td data-label="Cliente">{p.cliente}</td>
              <td data-label="DNI">{p.cliente_dni || '—'}</td>
              <td data-label="Fecha">{fechaCorta(p.fecha_prestamo)}</td>
              <td data-label="Capital">{money(p.capital)}</td>
              <td data-label="Total a Pagar">{money(p.total_a_pagar)}</td>
              <td data-label="Saldo">{money(p.saldo_pendiente)}</td>
              <td data-label="Estado"><span className={`badge ${estadoClass(p.estado)}`}>{p.estado}</span></td>
            </tr>
          ))}
          {filtrados.length === 0 && (
            <tr><td data-label="" colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>No hay prestamos con estos filtros.</td></tr>
          )}
        </tbody>
      </table>

      {expanded && (
        <>
          <div className="drawer-backdrop" onClick={cerrarDrawer} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>{expanded.cliente}</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>{expanded.codigo} · {expanded.cuenta}</p>
              </div>
              <button className="drawer-close" onClick={cerrarDrawer}>✕</button>
            </div>

            {!editando && (
              <>
                <div className="drawer-info">
                  {expanded.cliente_dni && <p><b>DNI Cliente:</b> {expanded.cliente_dni}</p>}
                  {expanded.aval_nombre && <p><b>Aval / Recomendado:</b> {expanded.aval_nombre}{expanded.aval_dni ? ` (${expanded.aval_dni})` : ''}</p>}
                  <p><b>Capital:</b> {money(expanded.capital)} &nbsp; <b>Total a pagar:</b> {money(expanded.total_a_pagar)}</p>
                  <p><b>Saldo pendiente:</b> {money(expanded.saldo_pendiente)} &nbsp; <span className={`badge ${estadoClass(expanded.estado)}`}>{expanded.estado}</span></p>
                  <p><b>Frecuencia:</b> {(expanded.frecuencia || 'semanal').charAt(0).toUpperCase() + (expanded.frecuencia || 'semanal').slice(1)}
                    {expanded.recargo_pct && <> &nbsp; <b>Recargo por atraso:</b> {(Number(expanded.recargo_pct) * 100).toFixed(0)}%</>}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button className="btn secondary" onClick={empezarEdicion}>
                    <Pencil size={15} strokeWidth={2.4} /> Editar
                  </button>
                  <button className="btn" style={{ background: 'var(--red-bg)', color: 'var(--red)' }} onClick={eliminarPrestamo}>
                    <Trash2 size={15} strokeWidth={2.4} /> Eliminar
                  </button>
                </div>

                <table className="table-cards">
                  <thead><tr><th>N</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead>
                  <tbody>
                    {cuotasDetalle.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Cuota N">{c.numero_cuota}</td>
                        <td data-label="Fecha">{fechaCorta(c.fecha_vencimiento)}</td>
                        <td data-label="Monto">
                          {money(montoConRecargo(c, expanded.recargo_pct))}
                          {tieneRecargoAplicado(c, expanded.recargo_pct) && (
                            <div style={{ fontSize: 11, color: 'var(--red)' }}>
                              incluye recargo {(Number(expanded.recargo_pct) * 100).toFixed(0)}%
                            </div>
                          )}
                        </td>
                        <td data-label="Estado">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <EstadoSelect
                              value={c.estado}
                              onChange={(nuevo) => cambiarEstadoCuota(c, nuevo, expanded)}
                            />
                            {estaAtrasada(c) && (
                              <span className="badge atrasado">Atrasado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {editando && (
              <div>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Nota: las fechas y montos se recalculan segun lo que cambies, pero las
                  cuotas que ya estaban marcadas como Pagado se mantienen asi.
                </p>
                <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label>Cliente
                    <input className="input" required value={formEdit.cliente} onChange={(e) => setFormEdit((f) => ({ ...f, cliente: e.target.value }))} />
                  </label>
                  <label>Fecha de prestamo
                    <input className="input" type="date" required value={formEdit.fecha_prestamo} onChange={(e) => setFormEdit((f) => ({ ...f, fecha_prestamo: e.target.value }))} />
                  </label>
                  <label>Capital (S/.)
                    <input className="input" type="number" min="0" step="0.01" required value={formEdit.capital} onChange={(e) => setFormEdit((f) => ({ ...f, capital: e.target.value }))} />
                  </label>
                  <label>% Interes
                    <input className="input" type="number" min="0" step="0.01" required value={formEdit.tasa_interes} onChange={(e) => setFormEdit((f) => ({ ...f, tasa_interes: e.target.value }))} />
                  </label>
                  <label>Numero de cuotas
                    <input className="input" type="number" min="1" max="6" required value={formEdit.num_cuotas} onChange={(e) => setFormEdit((f) => ({ ...f, num_cuotas: e.target.value }))} />
                  </label>
                  <label>Frecuencia de pago
                    <select className="input" value={formEdit.frecuencia} onChange={(e) => setFormEdit((f) => ({ ...f, frecuencia: e.target.value }))}>
                      {FRECUENCIAS.map((fr) => <option key={fr.value} value={fr.value}>{fr.label}</option>)}
                    </select>
                  </label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={formEdit.tieneRecargo} onChange={(e) => setFormEdit((f) => ({ ...f, tieneRecargo: e.target.checked }))} />
                    Aplicar recargo por atraso
                  </label>
                  {formEdit.tieneRecargo && (
                    <label>% de recargo sobre la cuota vencida
                      <input className="input" type="number" min="0" step="0.1" value={formEdit.recargoPct} onChange={(e) => setFormEdit((f) => ({ ...f, recargoPct: e.target.value }))} />
                    </label>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                    <button className="btn secondary" type="button" onClick={() => setEditando(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

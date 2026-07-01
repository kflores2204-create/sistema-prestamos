import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { syncCuota } from '../lib/calendarSync'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const estadoClass = (e) => e.toLowerCase().replace(' ', '-')
const toDateInput = (d) => new Date(d).toISOString().slice(0, 10)

export default function Prestamos() {
  const { cuenta } = useParams() // 'BBVA' | 'Caja Arequipa' | 'Intereses'
  const [prestamos, setPrestamos] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [cuotasDetalle, setCuotasDetalle] = useState([])
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data } = await supabase
      .from('v_prestamo_resumen')
      .select('*')
      .eq('cuenta', cuenta)
      .order('fecha_prestamo', { ascending: false })
    setPrestamos(data || [])
  }

  useEffect(() => { cargar(); setExpanded(null); setEditando(false) }, [cuenta])

  async function toggleCuota(cuota, prestamo) {
    const nuevoEstado = cuota.estado === 'Pagado' ? 'Pendiente' : 'Pagado'
    const { data: updated } = await supabase
      .from('cuotas').update({ estado: nuevoEstado }).eq('id', cuota.id).select().single()
    await syncCuota(updated, {
      codigo: prestamo.codigo, num_cuotas: prestamo.num_cuotas,
      cliente_nombre: prestamo.cliente, cuenta_nombre: prestamo.cuenta,
    })
    cargar()
    abrirDetalle(expanded.id)
  }

  async function abrirDetalle(prestamoId) {
    const { data: p } = await supabase.from('v_prestamo_resumen').select('*').eq('id', prestamoId).single()
    setExpanded(p)
    setEditando(false)
    const { data } = await supabase
      .from('cuotas').select('*').eq('prestamo_id', prestamoId).order('numero_cuota')
    setCuotasDetalle(data || [])
  }

  function empezarEdicion() {
    setFormEdit({
      cliente: expanded.cliente,
      fecha_prestamo: toDateInput(expanded.fecha_prestamo),
      capital: expanded.capital,
      tasa_interes: expanded.tasa_interes,
      num_cuotas: expanded.num_cuotas,
    })
    setEditando(true)
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      // actualizar nombre de cliente si cambio
      await supabase.from('clientes').update({ nombre: formEdit.cliente }).eq('id', expanded.cliente_id)

      // actualizar datos del prestamo
      const { data: prestamoActualizado, error: errP } = await supabase
        .from('prestamos')
        .update({
          fecha_prestamo: formEdit.fecha_prestamo,
          capital: Number(formEdit.capital),
          tasa_interes: Number(formEdit.tasa_interes),
          num_cuotas: Number(formEdit.num_cuotas),
        })
        .eq('id', expanded.id)
        .select()
        .single()
      if (errP) throw errP

      // como cambiaron capital/fecha/cuotas, se regeneran las cuotas desde cero
      await supabase.from('cuotas').delete().eq('prestamo_id', expanded.id)
      const nuevasCuotas = []
      const fechaBase = new Date(formEdit.fecha_prestamo + 'T00:00:00')
      for (let n = 1; n <= Number(formEdit.num_cuotas); n++) {
        const f = new Date(fechaBase)
        f.setDate(f.getDate() + 7 * n)
        nuevasCuotas.push({
          prestamo_id: expanded.id, numero_cuota: n,
          fecha_vencimiento: f.toISOString().slice(0, 10),
          monto: prestamoActualizado.monto_cuota, estado: 'Pendiente',
        })
      }
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
    setExpanded(null)
    cargar()
  }

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Prestamos {cuenta}</h2>
      <table>
        <thead>
          <tr>
            <th>Codigo</th><th>Cliente</th><th>Fecha</th><th>Capital</th>
            <th>Total a Pagar</th><th>Saldo</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {prestamos.map((p) => (
            <tr key={p.id} onClick={() => abrirDetalle(p.id)} style={{ cursor: 'pointer' }}>
              <td>{p.codigo}</td>
              <td>{p.cliente}</td>
              <td>{new Date(p.fecha_prestamo).toLocaleDateString('es-PE')}</td>
              <td>{money(p.capital)}</td>
              <td>{money(p.total_a_pagar)}</td>
              <td>{money(p.saldo_pendiente)}</td>
              <td><span className={`badge ${estadoClass(p.estado)}`}>{p.estado}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      {expanded && !editando && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--navy)' }}>Cuotas de {expanded.cliente} ({expanded.codigo})</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn secondary" onClick={empezarEdicion}>Editar</button>
              <button className="btn" style={{ background: 'var(--red-bg)', color: 'var(--red)' }} onClick={eliminarPrestamo}>Eliminar</button>
            </div>
          </div>
          <table>
            <thead><tr><th>N Cuota</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead>
            <tbody>
              {cuotasDetalle.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero_cuota}</td>
                  <td>{new Date(c.fecha_vencimiento).toLocaleDateString('es-PE')}</td>
                  <td>{money(c.monto)}</td>
                  <td>
                    <span className={`badge ${c.estado.toLowerCase()}`} onClick={() => toggleCuota(c, expanded)}>
                      {c.estado} (clic para cambiar)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && editando && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ color: 'var(--navy)' }}>Editar prestamo {expanded.codigo}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Nota: si cambias capital, fecha o numero de cuotas, el cronograma de cuotas se
            recalcula desde cero (todas quedan como Pendiente).
          </p>
          <form onSubmit={guardarEdicion} style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
              <button className="btn secondary" type="button" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

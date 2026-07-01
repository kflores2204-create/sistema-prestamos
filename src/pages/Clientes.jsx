import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFecha } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fechaCorta = formatFecha
const estadoClass = (e) => e.toLowerCase().replace(' ', '-')

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ dni: '', nombre: '' })
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState(null)
  const [fusionando, setFusionando] = useState(null)
  const [fusionQuery, setFusionQuery] = useState('')
  const [fusionTarget, setFusionTarget] = useState(null)
  const [fusionando2, setFusionando2] = useState(false)

  async function cargar() {
    const { data: cl } = await supabase.from('clientes').select('id, dni, nombre').order('nombre')
    const { data: pr } = await supabase.from('prestamos').select('cliente_id, codigo')
    const codigosPorCliente = {}
    for (const p of pr || []) {
      (codigosPorCliente[p.cliente_id] ||= []).push(p.codigo)
    }
    setClientes((cl || []).map((c) => ({ ...c, codigos: codigosPorCliente[c.id] || [] })))
  }
  useEffect(() => { cargar() }, [])

  const filtrados = clientes.filter((c) => {
    const t = `${c.nombre} ${c.dni || ''} ${(c.codigos || []).join(' ')}`.toLowerCase()
    return t.includes(busqueda.toLowerCase())
  })

  function empezarEdicion(c) {
    setEditId(c.id)
    setEditForm({ dni: c.dni || '', nombre: c.nombre })
  }

  async function guardarEdicion(id) {
    setGuardando(true)
    const { error } = await supabase.from('clientes').update({ dni: editForm.dni || null, nombre: editForm.nombre }).eq('id', id)
    setGuardando(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    setEditId(null)
    cargar()
    if (historial?.cliente.id === id) verHistorial({ id, dni: editForm.dni, nombre: editForm.nombre })
  }

  function empezarFusion(c) {
    setFusionando(c)
    setFusionQuery('')
    setFusionTarget(null)
  }

  async function confirmarFusion() {
    if (!fusionTarget) return
    if (!confirm(`Todos los prestamos de "${fusionando.nombre}" pasaran a ser de "${fusionTarget.nombre}", y "${fusionando.nombre}" se eliminara. Continuar?`)) return
    setFusionando2(true)
    const { error } = await supabase.rpc('fusionar_clientes', {
      duplicado_id: fusionando.id, principal_id: fusionTarget.id,
    })
    setFusionando2(false)
    if (error) { alert('Error al fusionar: ' + error.message); return }
    setFusionando(null)
    cargar()
  }

  async function verHistorial(c) {
    const { data } = await supabase
      .from('v_prestamo_resumen')
      .select('*')
      .eq('cliente_id', c.id)
      .order('fecha_prestamo', { ascending: false })
    setHistorial({ cliente: c, prestamos: data || [] })
  }

  const totales = historial && {
    capital: historial.prestamos.reduce((a, p) => a + Number(p.capital), 0),
    pagado: historial.prestamos.reduce((a, p) => a + Number(p.pagado_hasta_hoy), 0),
    pendiente: historial.prestamos.reduce((a, p) => a + Number(p.saldo_pendiente), 0),
    activos: historial.prestamos.filter((p) => p.estado !== 'FINALIZADO').length,
    finalizados: historial.prestamos.filter((p) => p.estado === 'FINALIZADO').length,
  }

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Clientes</h2>
      <p style={{ color: 'var(--muted)', marginTop: -8 }}>
        Base de datos de clientes: corrige nombres, agrega DNI, y revisa el historico de cada uno.
      </p>
      <input
        className="input" style={{ maxWidth: 340, marginBottom: 16 }}
        placeholder="Buscar por nombre, DNI o codigo de prestamo..." value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <table>
        <thead><tr><th style={{ width: 120 }}>DNI</th><th>Nombre</th><th style={{ width: 200 }}></th></tr></thead>
        <tbody>
          {filtrados.map((c) => (
            <tr key={c.id}>
              {editId === c.id ? (
                <>
                  <td><input className="input" value={editForm.dni} onChange={(e) => setEditForm((f) => ({ ...f, dni: e.target.value }))} maxLength={8} /></td>
                  <td><input className="input" value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} /></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => guardarEdicion(c.id)} disabled={guardando}>Guardar</button>
                    <button className="btn secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditId(null)}>Cancelar</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{c.dni || <span style={{ color: 'var(--muted)' }}>Sin DNI</span>}</td>
                  <td>{c.nombre}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="chip" onClick={() => verHistorial(c)}>Ver historial</button>
                    <button className="chip" onClick={() => empezarEdicion(c)}>Editar</button>
                    <button className="chip" onClick={() => empezarFusion(c)}>Fusionar</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {filtrados.length === 0 && (
            <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin resultados.</td></tr>
          )}
        </tbody>
      </table>

      {fusionando && (
        <>
          <div className="drawer-backdrop" onClick={() => setFusionando(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>Fusionar cliente</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>{fusionando.nombre}</p>
              </div>
              <button className="drawer-close" onClick={() => setFusionando(null)}>✕</button>
            </div>

            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
              Busca el cliente correcto con el que se debe unir. Todos los prestamos de
              <b> {fusionando.nombre} </b> pasaran a ese cliente, y este registro duplicado se eliminara.
            </p>

            <div className="buscador-persona">
              <input
                className="input" placeholder="Buscar cliente correcto por nombre o DNI..."
                value={fusionQuery} onChange={(e) => { setFusionQuery(e.target.value); setFusionTarget(null) }}
              />
              {fusionQuery.length >= 2 && !fusionTarget && (
                <div className="autocomplete-dropdown">
                  {clientes
                    .filter((c) => c.id !== fusionando.id)
                    .filter((c) => `${c.nombre} ${c.dni || ''}`.toLowerCase().includes(fusionQuery.toLowerCase()))
                    .slice(0, 6)
                    .map((c) => (
                      <div key={c.id} className="autocomplete-item" onMouseDown={() => { setFusionTarget(c); setFusionQuery(c.nombre) }}>
                        <span className="autocomplete-dni">{c.dni || 'S/N'}</span>
                        <span>{c.nombre}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {fusionTarget && (
              <div style={{ marginTop: 16 }}>
                <p>Se va a fusionar <b>{fusionando.nombre}</b> dentro de <b>{fusionTarget.nombre}</b>.</p>
                <button className="btn" onClick={confirmarFusion} disabled={fusionando2}>
                  {fusionando2 ? 'Fusionando...' : 'Confirmar fusion'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {historial && (
        <>
          <div className="drawer-backdrop" onClick={() => setHistorial(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>{historial.cliente.nombre}</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>{historial.cliente.dni || 'Sin DNI'}</p>
              </div>
              <button className="drawer-close" onClick={() => setHistorial(null)}>✕</button>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
              <div className="kpi-card"><div className="label">Capital Historico</div><div className="value" style={{ fontSize: 18 }}>{money(totales.capital)}</div></div>
              <div className="kpi-card"><div className="label">Total Pagado</div><div className="value" style={{ fontSize: 18 }}>{money(totales.pagado)}</div></div>
              <div className="kpi-card"><div className="label">Saldo Pendiente</div><div className="value" style={{ fontSize: 18 }}>{money(totales.pendiente)}</div></div>
              <div className="kpi-card"><div className="label">Activos / Finalizados</div><div className="value" style={{ fontSize: 18 }}>{totales.activos} / {totales.finalizados}</div></div>
            </div>

            <h4 style={{ color: 'var(--navy)' }}>Historial de prestamos</h4>
            <table>
              <thead><tr><th>Codigo</th><th>Cuenta</th><th>Fecha</th><th>Capital</th><th>Estado</th></tr></thead>
              <tbody>
                {historial.prestamos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codigo}</td>
                    <td>{p.cuenta}</td>
                    <td>{fechaCorta(p.fecha_prestamo)}</td>
                    <td>{money(p.capital)}</td>
                    <td><span className={`badge ${estadoClass(p.estado)}`}>{p.estado}</span></td>
                  </tr>
                ))}
                {historial.prestamos.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin prestamos registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

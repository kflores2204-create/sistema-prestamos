import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyISO, formatFecha, formatFechaHora } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

export default function CuadreCaja() {
  const [cargando, setCargando] = useState(true)
  const [pagos, setPagos] = useState([])
  const [fechaDesde, setFechaDesde] = useState(hoyISO())
  const [fechaHasta, setFechaHasta] = useState(hoyISO())

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const { data } = await supabase
        .from('cuotas')
        .select(`
          id, numero_cuota, fecha_vencimiento, fecha_pago, pagado_en, pagado_por, monto, monto_recargo, estado,
          prestamos (
            codigo,
            cuenta:cuentas(nombre),
            cliente:clientes!prestamos_cliente_id_fkey(nombre)
          )
        `)
        .eq('estado', 'Pagado')
        .gte('fecha_pago', fechaDesde)
        .lte('fecha_pago', fechaHasta)
        .order('pagado_en', { ascending: false })
      setPagos(data || [])
      setCargando(false)
    }
    cargar()
  }, [fechaDesde, fechaHasta])

  const filas = useMemo(() => pagos.map((c) => ({
    ...c,
    total: Number(c.monto) + Number(c.monto_recargo || 0),
    usuario: c.pagado_por || 'Sin registrar (pago anterior a esta funcion)',
    cliente: c.prestamos?.cliente?.nombre || '—',
    codigo: c.prestamos?.codigo || '—',
    cuenta: c.prestamos?.cuenta?.nombre || '—',
  })), [pagos])

  const kpis = useMemo(() => {
    const totalCobrado = filas.reduce((a, f) => a + f.total, 0)
    const totalRecargos = filas.reduce((a, f) => a + Number(f.monto_recargo || 0), 0)
    const usuariosUnicos = new Set(filas.map((f) => f.usuario))
    return { totalCobrado, totalRecargos, cantidadPagos: filas.length, cantidadUsuarios: usuariosUnicos.size }
  }, [filas])

  const porUsuario = useMemo(() => {
    const grupos = {}
    for (const f of filas) {
      grupos[f.usuario] ??= { usuario: f.usuario, cantidad: 0, total: 0 }
      grupos[f.usuario].cantidad++
      grupos[f.usuario].total += f.total
    }
    return Object.values(grupos).sort((a, b) => b.total - a.total)
  }, [filas])

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Cuadre de Caja</h2>
      <p style={{ color: 'var(--muted)', marginTop: -8 }}>
        Auditoria de pagos: quien registro cada cobro y cuando, para cuadrar el dinero del dia.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap', marginBottom: 20 }}>
        <label>Desde
          <input className="input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label>Hasta
          <input className="input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        <button className="btn secondary" onClick={() => { setFechaDesde(hoyISO()); setFechaHasta(hoyISO()) }}>Solo hoy</button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="label">Total Cobrado en el Rango</div>
          <div className="value">{money(kpis.totalCobrado)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Cantidad de Pagos</div>
          <div className="value">{kpis.cantidadPagos}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Recargos por Atraso Cobrados</div>
          <div className="value">{money(kpis.totalRecargos)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Usuarios que Cobraron</div>
          <div className="value">{kpis.cantidadUsuarios}</div>
        </div>
      </div>

      <h3 style={{ color: 'var(--navy)' }}>Resumen por usuario</h3>
      <table className="table-cards" style={{ marginBottom: 28 }}>
        <thead><tr><th>Usuario</th><th>Cantidad de Pagos</th><th>Total Cobrado</th></tr></thead>
        <tbody>
          {porUsuario.map((u) => (
            <tr key={u.usuario}>
              <td data-label="Usuario">{u.usuario}</td>
              <td data-label="Cantidad de Pagos">{u.cantidad}</td>
              <td data-label="Total Cobrado">{money(u.total)}</td>
            </tr>
          ))}
          {porUsuario.length === 0 && !cargando && (
            <tr><td data-label="" colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin pagos en este rango.</td></tr>
          )}
        </tbody>
      </table>

      <h3 style={{ color: 'var(--navy)' }}>Detalle de pagos</h3>
      <table className="table-cards">
        <thead>
          <tr><th>Fecha y hora de pago</th><th>Usuario</th><th>Cliente</th><th>Codigo</th><th>Cuenta</th><th>Monto</th><th>Recargo</th><th>Total</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td data-label="Fecha y hora de pago">{f.pagado_en ? formatFechaHora(f.pagado_en) : formatFecha(f.fecha_pago)}</td>
              <td data-label="Usuario">{f.usuario}</td>
              <td data-label="Cliente">{f.cliente}</td>
              <td data-label="Codigo">{f.codigo}</td>
              <td data-label="Cuenta">{f.cuenta}</td>
              <td data-label="Monto">{money(f.monto)}</td>
              <td data-label="Recargo">{Number(f.monto_recargo) > 0 ? <span style={{ color: 'var(--red)' }}>{money(f.monto_recargo)}</span> : '—'}</td>
              <td data-label="Total"><b>{money(f.total)}</b></td>
            </tr>
          ))}
          {filas.length === 0 && !cargando && (
            <tr><td data-label="" colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin pagos en este rango.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

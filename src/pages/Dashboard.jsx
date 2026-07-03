import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { hoyISO, estaAtrasada } from '../lib/prestamoUtils'
import MultiSelect from '../components/MultiSelect'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const moneyCorto = (n) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1000) return `S/. ${(v / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })}k`
  return `S/. ${v.toFixed(0)}`
}

const ESTADOS = ['ACTIVO', 'EN PROCESO', 'ATRASADO', 'FINALIZADO']
const ESTADO_COLOR = { ACTIVO: '#a67c00', 'EN PROCESO': '#3949ab', ATRASADO: '#b3261e', FINALIZADO: '#1e8e5a' }
const PALETA_CUENTAS = ['#0a004d', '#ff82af', '#1e8e5a', '#a67c00', '#3949ab', '#b3261e', '#5e548e', '#00838f']
const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ---- utilidades de meses en base a enteros (evita el bug de zona horaria de Date) ----
function ymDe(fechaStr) {
  const [y, m] = String(fechaStr).slice(0, 7).split('-').map(Number)
  return y * 12 + (m - 1)
}
function ymAInfo(ym) {
  const y = Math.floor(ym / 12)
  const m = (ym % 12) + 1
  return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${MESES_ES[m - 1]} ${y}` }
}

const panelStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px 10px', marginBottom: 20 }
const panelTitle = { color: 'var(--navy)', margin: '0 0 4px', fontSize: 16 }
const panelSub = { color: 'var(--muted)', margin: '0 0 12px', fontSize: 12.5 }

function PanelVacio({ texto = 'No hay datos con estos filtros.' }) {
  return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '30px 0' }}>{texto}</p>
}

export default function Dashboard() {
  const [cargando, setCargando] = useState(true)
  const [prestamos, setPrestamos] = useState([])
  const [cuotas, setCuotas] = useState([])

  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [cuentasSel, setCuentasSel] = useState(null)
  const [estadosSel, setEstadosSel] = useState(null)
  const [clienteQuery, setClienteQuery] = useState('')

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('v_prestamo_resumen').select('*'),
        supabase.from('cuotas').select('id, prestamo_id, numero_cuota, fecha_vencimiento, fecha_pago, monto, estado'),
      ])
      setPrestamos(p || [])
      setCuotas(c || [])
      setCargando(false)
    }
    cargar()
  }, [])

  const cuentasDisponibles = useMemo(
    () => [...new Set(prestamos.map((p) => p.cuenta))].filter(Boolean).sort(),
    [prestamos]
  )

  // Selecciona "todo" por defecto la primera vez que llegan los datos
  useEffect(() => {
    if (prestamos.length && cuentasSel === null) {
      setCuentasSel(new Set(cuentasDisponibles))
      setEstadosSel(new Set(ESTADOS))
    }
  }, [prestamos, cuentasDisponibles, cuentasSel])

  function limpiarFiltros() {
    setFechaDesde('')
    setFechaHasta('')
    setCuentasSel(new Set(cuentasDisponibles))
    setEstadosSel(new Set(ESTADOS))
    setClienteQuery('')
  }

  const listo = cuentasSel !== null && estadosSel !== null

  const filtradosPrestamos = useMemo(() => {
    if (!listo) return []
    return prestamos.filter((p) => {
      if (!cuentasSel.has(p.cuenta)) return false
      if (!estadosSel.has(p.estado)) return false
      if (fechaDesde && String(p.fecha_prestamo).slice(0, 10) < fechaDesde) return false
      if (fechaHasta && String(p.fecha_prestamo).slice(0, 10) > fechaHasta) return false
      if (clienteQuery) {
        const t = `${p.cliente} ${p.cliente_dni || ''}`.toLowerCase()
        if (!t.includes(clienteQuery.toLowerCase())) return false
      }
      return true
    })
  }, [prestamos, cuentasSel, estadosSel, fechaDesde, fechaHasta, clienteQuery, listo])

  const idsFiltrados = useMemo(() => new Set(filtradosPrestamos.map((p) => p.id)), [filtradosPrestamos])
  const filtradasCuotas = useMemo(() => cuotas.filter((c) => idsFiltrados.has(c.prestamo_id)), [cuotas, idsFiltrados])

  // ---------------- KPIs ----------------
  const kpis = useMemo(() => {
    const hoy = hoyISO()
    const en7dias = (() => {
      const [y, m, d] = hoy.split('-').map(Number)
      const dt = new Date(y, m - 1, d + 7)
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    })()

    const capital = filtradosPrestamos.reduce((a, p) => a + Number(p.capital || 0), 0)
    const interes = filtradosPrestamos.reduce((a, p) => a + Number(p.interes_generado || 0), 0)
    const totalPagar = filtradosPrestamos.reduce((a, p) => a + Number(p.total_a_pagar || 0), 0)
    const saldo = filtradosPrestamos.reduce((a, p) => a + Number(p.saldo_pendiente || 0), 0)
    const cobrado = totalPagar - saldo
    const activos = filtradosPrestamos.filter((p) => ['ACTIVO', 'EN PROCESO', 'ATRASADO'].includes(p.estado)).length
    const atrasados = filtradosPrestamos.filter((p) => p.estado === 'ATRASADO').length
    const porCobrar7 = filtradasCuotas
      .filter((c) => c.estado === 'Pendiente' && c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= en7dias)
      .reduce((a, c) => a + Number(c.monto || 0), 0)
    const mora = filtradasCuotas.filter((c) => estaAtrasada(c)).reduce((a, c) => a + Number(c.monto || 0), 0)
    const promedio = filtradosPrestamos.length ? capital / filtradosPrestamos.length : 0

    return [
      ['Capital Total Prestado', money(capital)],
      ['Interes Total Generado', money(interes)],
      ['Total Cobrado', money(cobrado)],
      ['Saldo Pendiente por Cobrar', money(saldo)],
      ['Mora Total (cuotas vencidas)', money(mora)],
      ['Prestamos Activos', activos],
      ['Prestamos Atrasados', atrasados],
      ['Por Cobrar Proximos 7 dias', money(porCobrar7)],
      ['Capital Promedio por Prestamo', money(promedio)],
    ]
  }, [filtradosPrestamos, filtradasCuotas])

  // ---------------- Tendencia mensual (prestado / cobrado / mora) ----------------
  const tendenciaData = useMemo(() => {
    const hoy = hoyISO()
    const ymHoy = ymDe(hoy)
    const ymDesde = fechaDesde ? ymDe(fechaDesde) : ymHoy - 11
    const ymHasta = fechaHasta ? ymDe(fechaHasta) : ymHoy
    const ymIni = Math.min(ymDesde, ymHasta)
    const ymFin = Math.max(ymDesde, ymHasta)
    const cantidad = Math.min(ymFin - ymIni + 1, 36)
    const meses = Array.from({ length: cantidad }, (_, i) => ymAInfo(ymFin - cantidad + 1 + i))

    return meses.map(({ key, label }) => {
      const prestado = filtradosPrestamos
        .filter((p) => String(p.fecha_prestamo).slice(0, 7) === key)
        .reduce((a, p) => a + Number(p.capital || 0), 0)
      const cobrado = filtradasCuotas
        .filter((c) => c.estado === 'Pagado' && c.fecha_pago && String(c.fecha_pago).slice(0, 7) === key)
        .reduce((a, c) => a + Number(c.monto || 0), 0)
      const mora = filtradasCuotas
        .filter((c) => estaAtrasada(c) && String(c.fecha_vencimiento).slice(0, 7) === key)
        .reduce((a, c) => a + Number(c.monto || 0), 0)
      return { mes: label, Prestado: prestado, Cobrado: cobrado, Mora: mora }
    })
  }, [filtradosPrestamos, filtradasCuotas, fechaDesde, fechaHasta])

  // ---------------- Distribucion por cuenta ----------------
  const porCuentaData = useMemo(() => {
    const grouped = {}
    for (const p of filtradosPrestamos) {
      grouped[p.cuenta] ??= { cuenta: p.cuenta, capital: 0, saldo: 0, activos: 0, atrasados: 0, finalizados: 0 }
      grouped[p.cuenta].capital += Number(p.capital || 0)
      grouped[p.cuenta].saldo += Number(p.saldo_pendiente || 0)
      if (['ACTIVO', 'EN PROCESO', 'ATRASADO'].includes(p.estado)) grouped[p.cuenta].activos++
      if (p.estado === 'ATRASADO') grouped[p.cuenta].atrasados++
      if (p.estado === 'FINALIZADO') grouped[p.cuenta].finalizados++
    }
    return Object.values(grouped).sort((a, b) => b.capital - a.capital)
  }, [filtradosPrestamos])

  // ---------------- Distribucion por estado ----------------
  const porEstadoData = useMemo(() => {
    const grouped = {}
    for (const p of filtradosPrestamos) grouped[p.estado] = (grouped[p.estado] || 0) + 1
    return ESTADOS.map((e) => ({ estado: e, cantidad: grouped[e] || 0 })).filter((x) => x.cantidad > 0)
  }, [filtradosPrestamos])

  // ---------------- Top clientes por saldo pendiente ----------------
  const topClientesData = useMemo(() => {
    const grouped = {}
    for (const p of filtradosPrestamos) {
      grouped[p.cliente] ??= { cliente: p.cliente, capital: 0, saldo: 0, prestamos: 0 }
      grouped[p.cliente].capital += Number(p.capital || 0)
      grouped[p.cliente].saldo += Number(p.saldo_pendiente || 0)
      grouped[p.cliente].prestamos++
    }
    return Object.values(grouped).sort((a, b) => b.saldo - a.saldo).slice(0, 8).reverse()
  }, [filtradosPrestamos])

  // ---------------- Proyeccion de cobros (proximos 6 meses) ----------------
  const proyeccionData = useMemo(() => {
    const ymHoy = ymDe(hoyISO())
    const meses = Array.from({ length: 6 }, (_, i) => ymAInfo(ymHoy + i))
    return meses.map(({ key, label }) => ({
      mes: label,
      Proyectado: filtradasCuotas
        .filter((c) => c.estado === 'Pendiente' && String(c.fecha_vencimiento).slice(0, 7) === key)
        .reduce((a, c) => a + Number(c.monto || 0), 0),
    }))
  }, [filtradasCuotas])

  if (cargando || !listo) return <p>Cargando...</p>

  return (
    <div>
      <h2 style={{ color: 'var(--navy)', marginBottom: 4 }}>Dashboard</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 16 }}>
        Vista ejecutiva con filtros.
      </p>

      {/* ---------------- Filtros ---------------- */}
      <div style={{ ...panelStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, alignItems: 'end' }}>
        <label>Desde
          <input className="input" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label>Hasta
          <input className="input" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        <label>Cuenta
          <MultiSelect
            options={cuentasDisponibles}
            selected={cuentasSel}
            onChange={setCuentasSel}
            placeholder="Todas las cuentas"
          />
        </label>
        <label>Estado
          <MultiSelect
            options={ESTADOS}
            selected={estadosSel}
            onChange={setEstadosSel}
            placeholder="Todos los estados"
            labelFor={(e) => e.charAt(0) + e.slice(1).toLowerCase()}
          />
        </label>
        <label>Cliente (nombre o DNI)
          <input className="input" placeholder="Buscar cliente..." value={clienteQuery} onChange={(e) => setClienteQuery(e.target.value)} />
        </label>
        <button className="btn secondary" style={{ width: '100%' }} onClick={limpiarFiltros}>Limpiar filtros</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -12, marginBottom: 24 }}>
        {filtradosPrestamos.length} de {prestamos.length} prestamos coinciden con los filtros actuales.
      </p>

      {/* ---------------- KPIs ---------------- */}
      <div className="kpi-grid">
        {kpis.map(([label, value]) => (
          <div className="kpi-card" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      {/* ---------------- Tendencia mensual ---------------- */}
      <div style={panelStyle}>
        <h3 style={panelTitle}>Tendencia mensual</h3>
        <p style={panelSub}>Capital prestado vs. cobrado por mes, y mora acumulada de cuotas vencidas por mes de vencimiento.</p>
        {tendenciaData.length === 0 ? <PanelVacio /> : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={tendenciaData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={moneyCorto} width={70} />
              <Tooltip formatter={(v) => money(v)} />
              <Legend />
              <Bar dataKey="Prestado" fill="var(--navy)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cobrado" fill="var(--green)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Mora" stroke="var(--red)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---------------- Proyeccion de cobros futuros ---------------- */}
      <div style={panelStyle}>
        <h3 style={panelTitle}>Proyeccion de cobros (proximos 6 meses)</h3>
        <p style={panelSub}>Suma de cuotas pendientes segun su fecha de vencimiento (no incluye recargos por atraso).</p>
        {proyeccionData.every((m) => m.Proyectado === 0) ? <PanelVacio texto="No hay cuotas pendientes futuras con estos filtros." /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={proyeccionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={moneyCorto} width={70} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="Proyectado" fill="var(--pink)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---------------- Distribucion por cuenta y por estado ---------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <div style={panelStyle}>
          <h3 style={panelTitle}>Distribucion de capital por cuenta</h3>
          <p style={panelSub}>Capital prestado, segun los filtros aplicados.</p>
          {porCuentaData.length === 0 ? <PanelVacio /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porCuentaData} dataKey="capital" nameKey="cuenta" cx="50%" cy="50%" outerRadius={85} label={({ cuenta }) => cuenta}>
                  {porCuentaData.map((entry, i) => (
                    <Cell key={entry.cuenta} fill={PALETA_CUENTAS[i % PALETA_CUENTAS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={panelStyle}>
          <h3 style={panelTitle}>Distribucion de prestamos por estado</h3>
          <p style={panelSub}>Cantidad de prestamos, segun los filtros aplicados.</p>
          {porEstadoData.length === 0 ? <PanelVacio /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porEstadoData} dataKey="cantidad" nameKey="estado" cx="50%" cy="50%" outerRadius={85} label={({ estado, cantidad }) => `${estado.charAt(0) + estado.slice(1).toLowerCase()} (${cantidad})`}>
                  {porEstadoData.map((entry) => (
                    <Cell key={entry.estado} fill={ESTADO_COLOR[entry.estado]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ---------------- Top clientes ---------------- */}
      <div style={panelStyle}>
        <h3 style={panelTitle}>Top clientes por saldo pendiente</h3>
        <p style={panelSub}>Los clientes con mayor deuda activa, segun los filtros aplicados.</p>
        {topClientesData.length === 0 ? <PanelVacio /> : (
          <ResponsiveContainer width="100%" height={Math.max(220, topClientesData.length * 42)}>
            <BarChart data={topClientesData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" fontSize={12} tickFormatter={moneyCorto} />
              <YAxis type="category" dataKey="cliente" fontSize={12} width={140} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="saldo" name="Saldo pendiente" fill="var(--navy)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---------------- Tabla resumen por cuenta ---------------- */}
      <h3 style={{ color: 'var(--navy)' }}>Resumen por cuenta</h3>
      <table className="table-cards">
        <thead>
          <tr><th>Cuenta</th><th>Capital Prestado</th><th>Saldo Pendiente</th><th>Activos</th><th>Atrasados</th><th>Finalizados</th></tr>
        </thead>
        <tbody>
          {porCuentaData.map((c) => (
            <tr key={c.cuenta}>
              <td data-label="Cuenta">{c.cuenta}</td>
              <td data-label="Capital Prestado">{money(c.capital)}</td>
              <td data-label="Saldo Pendiente">{money(c.saldo)}</td>
              <td data-label="Activos">{c.activos}</td>
              <td data-label="Atrasados">{c.atrasados}</td>
              <td data-label="Finalizados">{c.finalizados}</td>
            </tr>
          ))}
          {porCuentaData.length === 0 && (
            <tr><td data-label="" colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>No hay prestamos con estos filtros.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

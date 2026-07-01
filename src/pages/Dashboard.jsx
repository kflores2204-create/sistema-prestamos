import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [porCuenta, setPorCuenta] = useState([])

  useEffect(() => {
    supabase.from('v_dashboard').select('*').single().then(({ data }) => setD(data))
    supabase
      .from('v_prestamo_resumen')
      .select('cuenta, capital, saldo_pendiente, estado')
      .then(({ data }) => {
        if (!data) return
        const grouped = {}
        for (const row of data) {
          grouped[row.cuenta] ??= { cuenta: row.cuenta, capital: 0, saldo: 0, activos: 0, atrasados: 0 }
          grouped[row.cuenta].capital += Number(row.capital)
          grouped[row.cuenta].saldo += Number(row.saldo_pendiente)
          if (['ACTIVO', 'EN PROCESO', 'ATRASADO'].includes(row.estado)) grouped[row.cuenta].activos++
          if (row.estado === 'ATRASADO') grouped[row.cuenta].atrasados++
        }
        setPorCuenta(Object.values(grouped))
      })
  }, [])

  if (!d) return <p>Cargando...</p>

  const kpis = [
    ['Capital Total Prestado', money(d.capital_total_prestado)],
    ['Interes Total Generado', money(d.interes_total_generado)],
    ['Total Cobrado', money(d.total_cobrado)],
    ['Saldo Pendiente por Cobrar', money(d.saldo_pendiente_total)],
    ['Prestamos Activos', d.prestamos_activos],
    ['Prestamos Atrasados', d.prestamos_atrasados],
    ['Por Cobrar Proximos 7 dias', money(d.por_cobrar_7_dias)],
  ]

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Dashboard</h2>
      <div className="kpi-grid">
        {kpis.map(([label, value]) => (
          <div className="kpi-card" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <h3 style={{ color: 'var(--navy)' }}>Resumen por cuenta</h3>
      <table>
        <thead>
          <tr><th>Cuenta</th><th>Capital Prestado</th><th>Saldo Pendiente</th><th>Activos</th><th>Atrasados</th></tr>
        </thead>
        <tbody>
          {porCuenta.map((c) => (
            <tr key={c.cuenta}>
              <td>{c.cuenta}</td>
              <td>{money(c.capital)}</td>
              <td>{money(c.saldo)}</td>
              <td>{c.activos}</td>
              <td>{c.atrasados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

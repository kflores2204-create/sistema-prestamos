import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { syncCuota } from '../lib/calendarSync'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const estadoClass = (e) => e.toLowerCase().replace(' ', '-')

export default function Prestamos() {
  const { cuenta } = useParams() // 'BBVA' | 'Caja Arequipa' | 'Intereses'
  const [prestamos, setPrestamos] = useState([])
  const [expanded, setExpanded] = useState(null)

  async function cargar() {
    const { data } = await supabase
      .from('v_prestamo_resumen')
      .select('*')
      .eq('cuenta', cuenta)
      .order('fecha_prestamo', { ascending: false })
    setPrestamos(data || [])
  }

  useEffect(() => { cargar() }, [cuenta])

  async function toggleCuota(cuota, prestamo) {
    const nuevoEstado = cuota.estado === 'Pagado' ? 'Pendiente' : 'Pagado'
    const { data: updated } = await supabase
      .from('cuotas').update({ estado: nuevoEstado }).eq('id', cuota.id).select().single()
    await syncCuota(updated, {
      codigo: prestamo.codigo, num_cuotas: prestamo.num_cuotas,
      cliente_nombre: prestamo.cliente, cuenta_nombre: prestamo.cuenta,
    })
    cargar()
    if (expanded) abrirDetalle(expanded.id)
  }

  const [cuotasDetalle, setCuotasDetalle] = useState([])
  async function abrirDetalle(prestamoId) {
    const p = prestamos.find((x) => x.id === prestamoId)
    setExpanded(p)
    const { data } = await supabase
      .from('cuotas').select('*').eq('prestamo_id', prestamoId).order('numero_cuota')
    setCuotasDetalle(data || [])
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

      {expanded && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ color: 'var(--navy)' }}>Cuotas de {expanded.cliente} ({expanded.codigo})</h3>
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
    </div>
  )
}

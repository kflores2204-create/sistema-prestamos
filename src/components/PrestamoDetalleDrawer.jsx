import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFecha, formatFechaHora, montoConRecargo, tieneRecargoAplicado } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const estadoClass = (e) => e.toLowerCase().replace(' ', '-')

/**
 * Vista rapida (solo lectura) del detalle de un prestamo: KPIs + cronograma
 * de cuotas. Pensado para abrirse como un drawer ENCIMA de la pantalla
 * actual (ej. desde el historial de un cliente), sin navegar a otra pagina
 * y sin perder el contexto de donde estaba el usuario.
 *
 * Props:
 *  prestamoId: string|null  -> si es null, el drawer no se muestra
 *  onClose: () => void
 */
export default function PrestamoDetalleDrawer({ prestamoId, onClose }) {
  const [prestamo, setPrestamo] = useState(null)
  const [cuotas, setCuotas] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!prestamoId) { setPrestamo(null); setCuotas([]); return }
    async function cargar() {
      setCargando(true)
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('v_prestamo_resumen').select('*').eq('id', prestamoId).single(),
        supabase.from('cuotas').select('*').eq('prestamo_id', prestamoId).order('numero_cuota'),
      ])
      setPrestamo(p)
      setCuotas(c || [])
      setCargando(false)
    }
    cargar()
  }, [prestamoId])

  if (!prestamoId) return null

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        {cargando || !prestamo ? <p style={{ color: 'var(--muted)' }}>Cargando...</p> : (
          <>
            <div className="drawer-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--navy)' }}>{prestamo.codigo}</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  {prestamo.cliente} &middot; {prestamo.cuenta}
                </p>
              </div>
              <button className="drawer-close" onClick={onClose}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
              <span className={`badge ${estadoClass(prestamo.estado)}`}>{prestamo.estado}</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Prestado el {formatFecha(prestamo.fecha_prestamo)}</span>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 20 }}>
              <div className="kpi-card"><div className="label">Capital</div><div className="value" style={{ fontSize: 18 }}>{money(prestamo.capital)}</div></div>
              <div className="kpi-card"><div className="label">Total a Pagar</div><div className="value" style={{ fontSize: 18 }}>{money(prestamo.total_a_pagar)}</div></div>
              <div className="kpi-card"><div className="label">Saldo</div><div className="value" style={{ fontSize: 18 }}>{money(prestamo.saldo_pendiente)}</div></div>
            </div>

            <h4 style={{ color: 'var(--navy)' }}>Cronograma de cuotas</h4>
            <table className="table-cards">
              <thead><tr><th>N</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead>
              <tbody>
                {cuotas.map((c) => {
                  const yaPagada = c.estado === 'Pagado'
                  const montoFinal = yaPagada ? Number(c.monto) + Number(c.monto_recargo || 0) : montoConRecargo(c, prestamo.recargo_pct)
                  return (
                    <tr key={c.id}>
                      <td data-label="Cuota N">{c.numero_cuota}</td>
                      <td data-label="Fecha">
                        {formatFecha(c.fecha_vencimiento)}
                        {yaPagada && c.pagado_en && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pagado: {formatFechaHora(c.pagado_en)}</div>
                        )}
                      </td>
                      <td data-label="Monto">
                        <b>{money(montoFinal)}</b>
                        {yaPagada && Number(c.monto_recargo) > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--red)' }}>incluye recargo {money(c.monto_recargo)}</div>
                        )}
                        {!yaPagada && tieneRecargoAplicado(c, prestamo.recargo_pct) && (
                          <div style={{ fontSize: 11, color: 'var(--red)' }}>incluye recargo {(Number(prestamo.recargo_pct) * 100).toFixed(0)}%</div>
                        )}
                      </td>
                      <td data-label="Estado"><span className={`badge ${estadoClass(c.estado)}`}>{c.estado}</span></td>
                    </tr>
                  )
                })}
                {cuotas.length === 0 && (
                  <tr><td data-label="" colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin cuotas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  )
}

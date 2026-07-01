import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fecha = (d) => new Date(d).toLocaleDateString('es-PE')

export default function Cronograma() {
  const [opciones, setOpciones] = useState([])
  const [seleccion, setSeleccion] = useState('')
  const [prestamo, setPrestamo] = useState(null)
  const [cuotas, setCuotas] = useState([])

  useEffect(() => {
    supabase
      .from('v_prestamo_resumen')
      .select('id, codigo, cliente, cuenta')
      .order('fecha_prestamo', { ascending: false })
      .then(({ data }) => setOpciones(data || []))
  }, [])

  useEffect(() => {
    if (!seleccion) { setPrestamo(null); setCuotas([]); return }
    supabase.from('v_prestamo_resumen').select('*').eq('id', seleccion).single()
      .then(({ data }) => setPrestamo(data))
    supabase.from('cuotas').select('*').eq('prestamo_id', seleccion).order('numero_cuota')
      .then(({ data }) => setCuotas(data || []))
  }, [seleccion])

  return (
    <div>
      <div className="no-print">
        <h2 style={{ color: 'var(--navy)' }}>Cronograma de Pagos</h2>
        <label>
          Selecciona Cliente:
          <select className="input" value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
            <option value="">-- elegir --</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>{o.cuenta} | {o.cliente} | {o.codigo}</option>
            ))}
          </select>
        </label>
        {prestamo && (
          <button className="btn" style={{ marginTop: 12 }} onClick={() => window.print()}>
            Descargar / Imprimir PDF
          </button>
        )}
      </div>

      {prestamo && (
        <div className="cronograma-print">
          <h1 style={{ color: 'var(--navy)' }}>CRONOGRAMA DE PAGOS</h1>
          <table>
            <tbody>
              <tr><td><b>Cliente</b></td><td>{prestamo.cliente}</td></tr>
              <tr><td><b>Cuenta</b></td><td>{prestamo.cuenta}</td></tr>
              <tr><td><b>Fecha de Prestamo</b></td><td>{fecha(prestamo.fecha_prestamo)}</td></tr>
              <tr><td><b>Capital Prestado</b></td><td>{money(prestamo.capital)}</td></tr>
              <tr><td><b>Tasa de Interes</b></td><td>{(prestamo.tasa_interes * 100).toFixed(0)}%</td></tr>
              <tr><td><b>Total a Pagar</b></td><td>{money(prestamo.total_a_pagar)}</td></tr>
            </tbody>
          </table>

          <h3 style={{ color: 'var(--navy)', marginTop: 24 }}>Detalle de Cuotas</h3>
          <table>
            <thead>
              <tr><th>N Cuota</th><th>Fecha de Pago</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {cuotas.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero_cuota}</td>
                  <td>{fecha(c.fecha_vencimiento)}</td>
                  <td>{money(c.monto)}</td>
                  <td><span className={`badge ${c.estado.toLowerCase()}`}>{c.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 24, color: 'var(--muted)', fontStyle: 'italic' }}>
            Generado el {new Date().toLocaleDateString('es-PE')} - Gracias por su confianza.
          </p>
        </div>
      )}
    </div>
  )
}

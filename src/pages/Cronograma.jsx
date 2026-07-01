import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fecha = (d) => new Date(d).toLocaleDateString('es-PE')

export default function Cronograma() {
  const [opciones, setOpciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState('')
  const [prestamo, setPrestamo] = useState(null)
  const [cuotas, setCuotas] = useState([])

  useEffect(() => {
    supabase
      .from('v_prestamo_resumen')
      .select('id, codigo, cliente, cuenta')
      .order('cuenta', { ascending: true })
      .order('codigo', { ascending: true })
      .then(({ data }) => setOpciones(data || []))
  }, [])

  useEffect(() => {
    if (!seleccion) { setPrestamo(null); setCuotas([]); return }
    supabase.from('v_prestamo_resumen').select('*').eq('id', seleccion).single()
      .then(({ data }) => setPrestamo(data))
    supabase.from('cuotas').select('*').eq('prestamo_id', seleccion).order('numero_cuota')
      .then(({ data }) => setCuotas(data || []))
  }, [seleccion])

  const filtradas = opciones.filter((o) => {
    const texto = `${o.cliente} ${o.codigo} ${o.cuenta}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  return (
    <div>
      <div className="no-print">
        <h2 style={{ color: 'var(--navy)' }}>Cronograma de Pagos</h2>
        <label>
          Buscar cliente o codigo:
          <input
            className="input" placeholder="Ej: Juan Perez o PR-CAJA-0012"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <label style={{ marginTop: 10 }}>
          Selecciona Cliente: ({filtradas.length} resultado{filtradas.length === 1 ? '' : 's'})
          <select className="input" size={Math.min(8, Math.max(4, filtradas.length))} value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
            {filtradas.map((o) => (
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

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { montoConRecargo, tieneRecargoAplicado, formatFecha } from '../lib/prestamoUtils'
import { Printer } from 'lucide-react'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fecha = formatFecha

export default function Cronograma() {
  const [opciones, setOpciones] = useState([])
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [prestamo, setPrestamo] = useState(null)
  const [cuotas, setCuotas] = useState([])

  useEffect(() => {
    supabase
      .from('v_prestamo_resumen')
      .select('id, codigo, cliente, cliente_dni, cuenta, fecha_prestamo')
      .order('fecha_prestamo', { ascending: false })
      .then(({ data }) => setOpciones(data || []))
  }, [])

  useEffect(() => {
    if (!prestamo) { setCuotas([]); return }
    supabase.from('cuotas').select('*').eq('prestamo_id', prestamo.id).order('numero_cuota')
      .then(({ data }) => setCuotas(data || []))
  }, [prestamo])

  const sugerencias = query.length >= 1
    ? opciones.filter((o) => {
        const texto = `${o.cliente} ${o.codigo} ${o.cliente_dni || ''}`.toLowerCase()
        return texto.includes(query.toLowerCase())
      }).slice(0, 8)
    : []

  async function elegir(o) {
    setQuery(o.cliente)
    setAbierto(false)
    const { data } = await supabase.from('v_prestamo_resumen').select('*').eq('id', o.id).single()
    setPrestamo(data)
  }

  return (
    <div>
      <div className="no-print">
        <h2 style={{ color: 'var(--navy)' }}>Cronograma de Pagos</h2>
        <div className="buscador-persona" style={{ maxWidth: 420 }}>
          <label>Buscar cliente
            <input
              className="input" placeholder="Nombre, DNI o codigo del prestamo..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setAbierto(true); if (!e.target.value) setPrestamo(null) }}
              onFocus={() => setAbierto(true)}
              onBlur={() => setTimeout(() => setAbierto(false), 150)}
            />
          </label>
          {abierto && sugerencias.length > 0 && (
            <div className="autocomplete-dropdown">
              {sugerencias.map((o) => (
                <div key={o.id} className="autocomplete-item" onMouseDown={() => elegir(o)}>
                  <span style={{ fontWeight: 600 }}>{o.cliente}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    Inicio: {fecha(o.fecha_prestamo)} · {o.cuenta} · {o.codigo}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {prestamo && (
          <button className="btn" style={{ marginTop: 16 }} onClick={() => window.print()}>
            <Printer size={16} strokeWidth={2.4} /> Descargar / Imprimir PDF
          </button>
        )}
      </div>

      {prestamo && (
        <div className="cronograma-print">
          <h1 style={{ color: 'var(--navy)' }}>CRONOGRAMA DE PAGOS</h1>
          <table>
            <tbody>
              <tr><td><b>Cliente</b></td><td>{prestamo.cliente}</td></tr>
              {prestamo.cliente_dni && <tr><td><b>DNI</b></td><td>{prestamo.cliente_dni}</td></tr>}
              {prestamo.aval_nombre && <tr><td><b>Aval / Recomendado</b></td><td>{prestamo.aval_nombre}</td></tr>}
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
                  <td>
                    {money(montoConRecargo(c, prestamo.recargo_pct))}
                    {tieneRecargoAplicado(c, prestamo.recargo_pct) && (
                      <span style={{ fontSize: 11, color: 'var(--red)', display: 'block' }}>
                        incluye recargo por atraso
                      </span>
                    )}
                  </td>
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

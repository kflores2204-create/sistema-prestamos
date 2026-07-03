import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { montoConRecargo, tieneRecargoAplicado, formatFecha } from '../lib/prestamoUtils'
import { Printer, ChevronLeft } from 'lucide-react'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fecha = formatFecha

// Referencia neutral para el cliente: no debe revelar de que cuenta interna (BBVA,
// Caja Arequipa, Intereses) sale el dinero. Se deriva del id interno del prestamo
// (UUID), asi que no requiere tocar la base de datos ni el codigo interno existente.
function referenciaCliente(id) {
  return (id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
}

export default function Cronograma() {
  const [searchParams] = useSearchParams()
  const [opciones, setOpciones] = useState([])
  const [query, setQuery] = useState('')
  const [prestamo, setPrestamo] = useState(null)
  const [cuotas, setCuotas] = useState([])

  useEffect(() => {
    supabase
      .from('v_prestamo_resumen')
      .select('id, codigo, cliente, cliente_dni, cuenta, fecha_prestamo')
      .order('fecha_prestamo', { ascending: false })
      .then(({ data }) => setOpciones(data || []))
  }, [])

  // si venimos con ?id=... (ej. justo despues de crear un prestamo nuevo), lo
  // seleccionamos solo, sin que el usuario tenga que buscarlo en la lista
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    supabase.from('v_prestamo_resumen').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setPrestamo(data)
    })
  }, [searchParams])

  useEffect(() => {
    if (!prestamo) { setCuotas([]); return }
    supabase.from('cuotas').select('*').eq('prestamo_id', prestamo.id).order('numero_cuota')
      .then(({ data }) => setCuotas(data || []))
  }, [prestamo])

  const filtrados = query.length >= 1
    ? opciones.filter((o) => `${o.cliente} ${o.codigo} ${o.cliente_dni || ''}`.toLowerCase().includes(query.toLowerCase()))
    : opciones

  async function elegir(o) {
    const { data } = await supabase.from('v_prestamo_resumen').select('*').eq('id', o.id).single()
    setPrestamo(data)
  }

  // ---------- Vista de detalle (cronograma de un prestamo puntual) ----------
  if (prestamo) {
    return (
      <div>
        <div className="no-print">
          <button className="volver-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setPrestamo(null)}>
            <ChevronLeft size={16} strokeWidth={2.4} /> Todos los cronogramas
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: 'var(--navy)', margin: 0 }}>Cronograma de Pagos</h2>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={16} strokeWidth={2.4} /> Descargar / Imprimir PDF
            </button>
          </div>
        </div>

        <div className="cronograma-print">
          <div className="cronograma-header">
            <img src="/logo-confianza-horizontal.png" alt="Confianza Prestamos" className="cronograma-logo" />
            <div className="cronograma-header-box">
              <div className="cronograma-header-box-title">CRONOGRAMA DE PAGOS</div>
              <div>Ref. {referenciaCliente(prestamo.id)}</div>
              <div>Generado: {new Date().toLocaleDateString('es-PE')}</div>
            </div>
          </div>

          <div className="cronograma-ficha">
            <div className="cronograma-ficha-item"><span>CLIENTE</span><b>{prestamo.cliente}</b></div>
            {prestamo.cliente_dni && <div className="cronograma-ficha-item"><span>DNI</span><b>{prestamo.cliente_dni}</b></div>}
            {prestamo.aval_nombre && <div className="cronograma-ficha-item"><span>AVAL / RECOMENDADO</span><b>{prestamo.aval_nombre}</b></div>}
            <div className="cronograma-ficha-item"><span>FECHA DE PRESTAMO</span><b>{fecha(prestamo.fecha_prestamo)}</b></div>
            <div className="cronograma-ficha-item"><span>CAPITAL PRESTADO</span><b>{money(prestamo.capital)}</b></div>
            <div className="cronograma-ficha-item"><span>TASA DE INTERES</span><b>{(prestamo.tasa_interes * 100).toFixed(0)}%</b></div>
          </div>
          <div className="cronograma-total">
            <span>TOTAL A PAGAR</span>
            <b>{money(prestamo.total_a_pagar)}</b>
          </div>

          <h3 className="cronograma-subtitulo">Detalle de Cuotas</h3>
          <table className="cronograma-tabla">
            <thead>
              <tr><th>N Cuota</th><th>Fecha de Pago</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {cuotas.map((c, i) => (
                <tr key={c.id} className={i % 2 === 1 ? 'cronograma-fila-par' : ''}>
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

          <div className="cronograma-footer">
            Confianza Prestamos · Soluciones que te acercan. Gracias por su confianza.
          </div>
        </div>
      </div>
    )
  }

  // ---------- Vista de lista (todos los cronogramas, filtrable) ----------
  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Cronograma de Pagos</h2>
      <p style={{ color: 'var(--muted)', marginTop: -8 }}>
        Todos los prestamos. Busca por nombre, DNI o codigo para filtrar, o elegi uno de la lista.
      </p>
      <input
        className="input search-box" style={{ marginBottom: 16 }}
        placeholder="Buscar por nombre, DNI o codigo..."
        value={query} onChange={(e) => setQuery(e.target.value)}
      />

      <table className="table-cards">
        <thead><tr><th>Cliente</th><th>Codigo</th><th>Cuenta</th><th>Fecha</th></tr></thead>
        <tbody>
          {filtrados.map((o) => (
            <tr key={o.id} onClick={() => elegir(o)} style={{ cursor: 'pointer' }}>
              <td data-label="Cliente">{o.cliente}</td>
              <td data-label="Codigo">{o.codigo}</td>
              <td data-label="Cuenta">{o.cuenta}</td>
              <td data-label="Fecha">{fecha(o.fecha_prestamo)}</td>
            </tr>
          ))}
          {filtrados.length === 0 && (
            <tr><td data-label="" colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin resultados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

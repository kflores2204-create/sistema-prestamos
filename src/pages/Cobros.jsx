import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { syncCuota } from '../lib/calendarSync'
import { montoConRecargo, estaAtrasada, hoyISO, formatFecha } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

// Desglose capital/interes de una cuota individual, util para saber cuanto
// transferir a cada cuenta destino en el banco al momento de repartir el cobro.
function desglose(prestamo) {
  const capital = Number(prestamo.capital) / Number(prestamo.num_cuotas)
  const interes = Number(prestamo.interes_generado || 0) / Number(prestamo.num_cuotas)
  return { capital, interes }
}

export default function Cobros() {
  const [fecha, setFecha] = useState(hoyISO())
  const [incluirAtrasados, setIncluirAtrasados] = useState(true)
  const [cuotas, setCuotas] = useState([])
  const [cargando, setCargando] = useState(false)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('cuotas')
      .select(`
        id, numero_cuota, fecha_vencimiento, monto, estado,
        prestamos (
          id, codigo, num_cuotas, recargo_pct, capital, interes_generado,
          cuenta:cuentas(nombre),
          cliente:clientes!prestamos_cliente_id_fkey(nombre, dni)
        )
      `)
      .eq('estado', 'Pendiente')
      .lte('fecha_vencimiento', fecha)
      .order('fecha_vencimiento', { ascending: true })
    const filtradas = incluirAtrasados
      ? (data || [])
      : (data || []).filter((c) => c.fecha_vencimiento === fecha)
    setCuotas(filtradas)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [fecha, incluirAtrasados])

  async function marcarPagado(cuota) {
    const { data: updated } = await supabase
      .from('cuotas').update({ estado: 'Pagado', fecha_pago: hoyISO() }).eq('id', cuota.id).select().single()
    try {
      await syncCuota(updated, {
        codigo: cuota.prestamos.codigo,
        num_cuotas: cuota.prestamos.num_cuotas,
        recargo_pct: cuota.prestamos.recargo_pct,
        cliente_nombre: cuota.prestamos.cliente?.nombre || 'Cliente',
        cuenta_nombre: cuota.prestamos.cuenta?.nombre || '',
      })
    } catch (err) {
      alert('El pago se guardo, pero no se pudo sincronizar con Calendar: ' + err.message)
    }
    cargar()
  }

  const totalDelDia = cuotas.reduce((acc, c) => acc + montoConRecargo(c, c.prestamos.recargo_pct), 0)

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Cobros del Dia</h2>
      <p style={{ color: 'var(--muted)', marginTop: -8 }}>
        Quien debe pagar en una fecha especifica, de tus 3 cuentas a la vez.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>Fecha
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <div className="filtro-chips">
          <button className={`chip ${incluirAtrasados ? 'chip-active' : ''}`} onClick={() => setIncluirAtrasados(true)}>
            Ese dia + atrasados
          </button>
          <button className={`chip ${!incluirAtrasados ? 'chip-active' : ''}`} onClick={() => setIncluirAtrasados(false)}>
            Solo ese dia
          </button>
        </div>
      </div>

      <div className="kpi-card" style={{ maxWidth: 260, marginBottom: 20 }}>
        <div className="label">Total a cobrar (con recargos)</div>
        <div className="value">{money(totalDelDia)}</div>
      </div>

      <table className="table-cards">
        <thead>
          <tr><th>Cliente</th><th>DNI</th><th>Cuenta</th><th>Codigo</th><th>Fecha</th><th>Capital</th><th>Interes</th><th>Monto</th><th></th></tr>
        </thead>
        <tbody>
          {cuotas.map((c) => {
            const { capital, interes } = desglose(c.prestamos)
            return (
              <tr key={c.id}>
                <td data-label="Cliente">{c.prestamos.cliente?.nombre || '—'}</td>
                <td data-label="DNI">{c.prestamos.cliente?.dni || '—'}</td>
                <td data-label="Cuenta">{c.prestamos.cuenta?.nombre || '—'}</td>
                <td data-label="Codigo">{c.prestamos.codigo}</td>
                <td data-label="Fecha">
                  {formatFecha(c.fecha_vencimiento)}
                  {estaAtrasada(c) && <span className="badge atrasado" style={{ marginLeft: 6 }}>Atrasado</span>}
                </td>
                <td data-label="Capital">{money(capital)}</td>
                <td data-label="Interes">{money(interes)}</td>
                <td data-label="Monto"><b>{money(montoConRecargo(c, c.prestamos.recargo_pct))}</b></td>
                <td data-label="">
                  <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => marcarPagado(c)}>
                    Marcar Pagado
                  </button>
                </td>
              </tr>
            )
          })}
          {!cargando && cuotas.length === 0 && (
            <tr><td data-label="" colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>Nadie debe pagar en este rango.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

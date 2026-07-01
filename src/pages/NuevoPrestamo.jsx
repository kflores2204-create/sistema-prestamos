import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CUENTAS = ['BBVA', 'Caja Arequipa', 'Intereses']
const PREFIX = { BBVA: 'BBVA', 'Caja Arequipa': 'CAJA', Intereses: 'INT' }

export default function NuevoPrestamo() {
  const [form, setForm] = useState({
    cuenta: 'BBVA', cliente: '', fecha: new Date().toISOString().slice(0, 10),
    capital: '', tasa: '0.2', cuotas: '4',
  })
  const [estado, setEstado] = useState({ cargando: false, mensaje: '', error: false })
  const [clientes, setClientes] = useState([])

  useEffect(() => {
    supabase.from('clientes').select('nombre').order('nombre').then(({ data }) => setClientes(data || []))
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function siguienteCodigo(cuenta, cuentaId) {
    const { count } = await supabase
      .from('prestamos').select('id', { count: 'exact', head: true }).eq('cuenta_id', cuentaId)
    const n = (count || 0) + 1
    return `PR-${PREFIX[cuenta]}-${String(n).padStart(4, '0')}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setEstado({ cargando: true, mensaje: '', error: false })
    try {
      const { data: cuentaRow } = await supabase
        .from('cuentas').select('id').eq('nombre', form.cuenta).single()

      let clienteId
      const { data: clienteExistente } = await supabase
        .from('clientes').select('id').ilike('nombre', form.cliente.trim()).limit(1).maybeSingle()
      if (clienteExistente) {
        clienteId = clienteExistente.id
      } else {
        const { data: nuevoCliente, error: errCliente } = await supabase
          .from('clientes').insert({ nombre: form.cliente.trim() }).select().single()
        if (errCliente) throw errCliente
        clienteId = nuevoCliente.id
      }

      const codigo = await siguienteCodigo(form.cuenta, cuentaRow.id)

      const { data: prestamo, error: errPrestamo } = await supabase
        .from('prestamos')
        .insert({
          codigo, cuenta_id: cuentaRow.id, cliente_id: clienteId,
          fecha_prestamo: form.fecha, capital: Number(form.capital),
          tasa_interes: Number(form.tasa), num_cuotas: Number(form.cuotas),
        })
        .select()
        .single()
      if (errPrestamo) throw errPrestamo

      const cuotas = []
      const fechaBase = new Date(form.fecha + 'T00:00:00')
      for (let n = 1; n <= Number(form.cuotas); n++) {
        const fecha = new Date(fechaBase)
        fecha.setDate(fecha.getDate() + 7 * n)
        cuotas.push({
          prestamo_id: prestamo.id, numero_cuota: n,
          fecha_vencimiento: fecha.toISOString().slice(0, 10),
          monto: prestamo.monto_cuota, estado: 'Pendiente',
        })
      }
      const { error: errCuotas } = await supabase.from('cuotas').insert(cuotas)
      if (errCuotas) throw errCuotas

      setEstado({ cargando: false, mensaje: `Prestamo ${codigo} creado correctamente.`, error: false })
      setForm((f) => ({ ...f, cliente: '', capital: '' }))
    } catch (err) {
      setEstado({ cargando: false, mensaje: err.message, error: true })
    }
  }

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Nuevo Prestamo</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label>
          Cuenta
          <select value={form.cuenta} onChange={(e) => set('cuenta', e.target.value)} className="input">
            {CUENTAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Cliente (elige uno existente o escribe uno nuevo)
          <input className="input" list="lista-clientes" required value={form.cliente} onChange={(e) => set('cliente', e.target.value)} placeholder="Nombre del cliente" />
          <datalist id="lista-clientes">
            {clientes.map((c) => <option key={c.nombre} value={c.nombre} />)}
          </datalist>
        </label>
        <label>
          Fecha de prestamo
          <input className="input" type="date" required value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
        </label>
        <label>
          Capital (S/.)
          <input className="input" type="number" min="0" step="0.01" required value={form.capital} onChange={(e) => set('capital', e.target.value)} />
        </label>
        <label>
          % Interes (ej. 0.2 = 20%)
          <input className="input" type="number" min="0" step="0.01" required value={form.tasa} onChange={(e) => set('tasa', e.target.value)} />
        </label>
        <label>
          Numero de cuotas
          <input className="input" type="number" min="1" max="6" required value={form.cuotas} onChange={(e) => set('cuotas', e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={estado.cargando}>
          {estado.cargando ? 'Guardando...' : 'Registrar prestamo'}
        </button>
        {estado.mensaje && (
          <p style={{ color: estado.error ? 'var(--red)' : 'var(--green)' }}>{estado.mensaje}</p>
        )}
      </form>
    </div>
  )
}

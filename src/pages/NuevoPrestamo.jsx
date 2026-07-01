import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FRECUENCIAS, fechaCuota } from '../lib/prestamoUtils'

const CUENTAS = ['BBVA', 'Caja Arequipa', 'Intereses']
const PREFIX = { BBVA: 'BBVA', 'Caja Arequipa': 'CAJA', Intereses: 'INT' }

function BuscadorPersona({ label, dni, nombre, onChangeDni, onChangeNombre, personas, required }) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)

  const sugerencias = query.length >= 2
    ? personas.filter((p) =>
        (p.dni || '').includes(query) || p.nombre.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : []

  function elegir(p) {
    onChangeDni(p.dni || '')
    onChangeNombre(p.nombre)
    setQuery(p.nombre)
    setAbierto(false)
  }

  return (
    <div className="buscador-persona">
      <label>{label}
        <input
          className="input" placeholder="Buscar por DNI o nombre..." value={query}
          onChange={(e) => { setQuery(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
        />
      </label>
      {abierto && sugerencias.length > 0 && (
        <div className="autocomplete-dropdown">
          {sugerencias.map((p) => (
            <div key={p.id} className="autocomplete-item" onMouseDown={() => elegir(p)}>
              <span className="autocomplete-dni">{p.dni || 'S/N'}</span>
              <span>{p.nombre}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <label style={{ flex: 1 }}>DNI
          <input className="input" value={dni} onChange={(e) => onChangeDni(e.target.value)} maxLength={8} required={required} />
        </label>
        <label style={{ flex: 2 }}>Nombres y Apellidos
          <input className="input" value={nombre} onChange={(e) => onChangeNombre(e.target.value)} required={required} />
        </label>
      </div>
    </div>
  )
}

export default function NuevoPrestamo() {
  const [cuenta, setCuenta] = useState('BBVA')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [capital, setCapital] = useState('')
  const [tasa, setTasa] = useState('0.2')
  const [cuotas, setCuotas] = useState('4')
  const [frecuencia, setFrecuencia] = useState('semanal')
  const [tieneRecargo, setTieneRecargo] = useState(false)
  const [recargoPct, setRecargoPct] = useState('5')

  const [clienteDni, setClienteDni] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')

  const [tieneAval, setTieneAval] = useState(false)
  const [avalDni, setAvalDni] = useState('')
  const [avalNombre, setAvalNombre] = useState('')

  const [personas, setPersonas] = useState([])
  const [estado, setEstado] = useState({ cargando: false, mensaje: '', error: false })

  useEffect(() => {
    supabase.from('clientes').select('id, dni, nombre').order('nombre').then(({ data }) => setPersonas(data || []))
  }, [])

  async function siguienteCodigo(cuentaNombre, cuentaId) {
    const { count } = await supabase
      .from('prestamos').select('id', { count: 'exact', head: true }).eq('cuenta_id', cuentaId)
    const n = (count || 0) + 1
    return `PR-${PREFIX[cuentaNombre]}-${String(n).padStart(4, '0')}`
  }

  async function resolverPersona(dni, nombre) {
    if (dni) {
      const { data: porDni } = await supabase.from('clientes').select('id').eq('dni', dni).maybeSingle()
      if (porDni) return porDni.id
    }
    const { data: porNombre } = await supabase
      .from('clientes').select('id').ilike('nombre', nombre.trim()).limit(1).maybeSingle()
    if (porNombre) return porNombre.id

    const { data: nuevo, error } = await supabase
      .from('clientes').insert({ dni: dni || null, nombre: nombre.trim() }).select().single()
    if (error) throw error
    return nuevo.id
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setEstado({ cargando: true, mensaje: '', error: false })
    try {
      const { data: cuentaRow } = await supabase.from('cuentas').select('id').eq('nombre', cuenta).single()

      const clienteId = await resolverPersona(clienteDni, clienteNombre)
      let avalId = null
      if (tieneAval && avalNombre.trim()) {
        avalId = await resolverPersona(avalDni, avalNombre)
      }

      const codigo = await siguienteCodigo(cuenta, cuentaRow.id)

      const { data: prestamo, error: errPrestamo } = await supabase
        .from('prestamos')
        .insert({
          codigo, cuenta_id: cuentaRow.id, cliente_id: clienteId, aval_id: avalId,
          fecha_prestamo: fecha, capital: Number(capital),
          tasa_interes: Number(tasa), num_cuotas: Number(cuotas),
          frecuencia, recargo_pct: tieneRecargo ? Number(recargoPct) / 100 : null,
        })
        .select()
        .single()
      if (errPrestamo) throw errPrestamo

      const nuevasCuotas = []
      const fechaBase = new Date(fecha + 'T00:00:00')
      for (let n = 1; n <= Number(cuotas); n++) {
        const f = fechaCuota(fechaBase, n, frecuencia)
        nuevasCuotas.push({
          prestamo_id: prestamo.id, numero_cuota: n,
          fecha_vencimiento: f.toISOString().slice(0, 10),
          monto: prestamo.monto_cuota, estado: 'Pendiente',
        })
      }
      const { error: errCuotas } = await supabase.from('cuotas').insert(nuevasCuotas)
      if (errCuotas) throw errCuotas

      setEstado({ cargando: false, mensaje: `Prestamo ${codigo} creado correctamente.`, error: false })
      setClienteDni(''); setClienteNombre(''); setCapital('')
      setTieneAval(false); setAvalDni(''); setAvalNombre('')
      setFrecuencia('semanal'); setTieneRecargo(false); setRecargoPct('5')
    } catch (err) {
      setEstado({ cargando: false, mensaje: err.message, error: true })
    }
  }

  return (
    <div>
      <h2 style={{ color: 'var(--navy)' }}>Nuevo Prestamo</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <label>
          Cuenta
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="input">
            {CUENTAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <BuscadorPersona
          label="Cliente" dni={clienteDni} nombre={clienteNombre}
          onChangeDni={setClienteDni} onChangeNombre={setClienteNombre}
          personas={personas} required
        />

        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={tieneAval} onChange={(e) => setTieneAval(e.target.checked)} />
          Tiene Aval o Recomendado (opcional)
        </label>

        {tieneAval && (
          <BuscadorPersona
            label="Aval / Recomendado" dni={avalDni} nombre={avalNombre}
            onChangeDni={setAvalDni} onChangeNombre={setAvalNombre}
            personas={personas}
          />
        )}

        <label>
          Fecha de prestamo
          <input className="input" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Capital (S/.)
          <input className="input" type="number" min="0" step="0.01" required value={capital} onChange={(e) => setCapital(e.target.value)} />
        </label>
        <label>
          % Interes (ej. 0.2 = 20%)
          <input className="input" type="number" min="0" step="0.01" required value={tasa} onChange={(e) => setTasa(e.target.value)} />
        </label>
        <label>
          Numero de cuotas
          <input className="input" type="number" min="1" max="6" required value={cuotas} onChange={(e) => setCuotas(e.target.value)} />
        </label>
        <label>
          Frecuencia de pago
          <select className="input" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
            {FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>

        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={tieneRecargo} onChange={(e) => setTieneRecargo(e.target.checked)} />
          Aplicar recargo por atraso (opcional)
        </label>
        {tieneRecargo && (
          <label>
            % de recargo sobre la cuota vencida (ej. 5 = 5%)
            <input className="input" type="number" min="0" step="0.1" value={recargoPct} onChange={(e) => setRecargoPct(e.target.value)} />
          </label>
        )}
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

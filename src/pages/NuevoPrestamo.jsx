import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { FRECUENCIAS, fechaCuota, hoyISO } from '../lib/prestamoUtils'
import FechaInput from '../components/FechaInput'
import BuscadorPersona from '../components/BuscadorPersona'

export default function NuevoPrestamo() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cuentaPreseleccionada = searchParams.get('cuenta')

  const [cuentasDisponibles, setCuentasDisponibles] = useState([])
  const [cuenta, setCuenta] = useState(cuentaPreseleccionada || '')
  const [fecha, setFecha] = useState(hoyISO())
  const [capital, setCapital] = useState('')
  const [tasa, setTasa] = useState('0.2')
  const [cuotas, setCuotas] = useState('4')
  const [frecuencia, setFrecuencia] = useState('semanal')
  const [tieneRecargo, setTieneRecargo] = useState(false)
  const [recargoPct, setRecargoPct] = useState('5')

  const [clienteDni, setClienteDni] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTipoDoc, setClienteTipoDoc] = useState('DNI')

  const [tieneAval, setTieneAval] = useState(false)
  const [avalDni, setAvalDni] = useState('')
  const [avalNombre, setAvalNombre] = useState('')
  const [avalTipoDoc, setAvalTipoDoc] = useState('DNI')

  const [personas, setPersonas] = useState([])
  const [estado, setEstado] = useState({ cargando: false, mensaje: '', error: false })

  useEffect(() => {
    supabase.from('clientes').select('id, dni, nombre').order('nombre').then(({ data }) => setPersonas(data || []))
    supabase.from('cuentas').select('id, nombre, prefijo').order('nombre').then(({ data }) => {
      setCuentasDisponibles(data || [])
      if (!cuentaPreseleccionada && data?.length) setCuenta(data[0].nombre)
    })
  }, [])

  async function siguienteCodigo(cuentaId, prefijo) {
    const { count } = await supabase
      .from('prestamos').select('id', { count: 'exact', head: true }).eq('cuenta_id', cuentaId)
    const n = (count || 0) + 1
    return `PR-${prefijo}-${String(n).padStart(4, '0')}`
  }

  async function resolverPersona(dni, nombre, tipoDocumento) {
    if (dni) {
      const { data: porDni } = await supabase.from('clientes').select('id').eq('dni', dni).maybeSingle()
      if (porDni) return porDni.id
    }
    const { data: porNombre } = await supabase
      .from('clientes').select('id').ilike('nombre', nombre.trim()).limit(1).maybeSingle()
    if (porNombre) return porNombre.id

    const { data: nuevo, error } = await supabase
      .from('clientes').insert({ dni: dni || null, nombre: nombre.trim(), tipo_documento: tipoDocumento || 'DNI' }).select().single()
    if (error) throw error
    return nuevo.id
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setEstado({ cargando: true, mensaje: '', error: false })
    try {
      const cuentaRow = cuentasDisponibles.find((c) => c.nombre === cuenta)
      if (!cuentaRow) throw new Error('Selecciona una cuenta valida.')

      const clienteId = await resolverPersona(clienteDni, clienteNombre, clienteTipoDoc)
      let avalId = null
      if (tieneAval && avalNombre.trim()) {
        avalId = await resolverPersona(avalDni, avalNombre, avalTipoDoc)
      }

      const codigo = await siguienteCodigo(cuentaRow.id, cuentaRow.prefijo || cuenta.slice(0, 4).toUpperCase())

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
      for (let n = 1; n <= Number(cuotas); n++) {
        nuevasCuotas.push({
          prestamo_id: prestamo.id, numero_cuota: n,
          fecha_vencimiento: fechaCuota(fecha, n, frecuencia),
          monto: prestamo.monto_cuota, estado: 'Pendiente',
        })
      }
      const { error: errCuotas } = await supabase.from('cuotas').insert(nuevasCuotas)
      if (errCuotas) throw errCuotas

      // listo: vamos directo al cronograma de este prestamo recien creado,
      // no hace falta que el usuario lo busque de nuevo
      navigate(`/cronograma?id=${prestamo.id}`)
    } catch (err) {
      setEstado({ cargando: false, mensaje: err.message, error: true })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
        <Link to="/cuentas" className="volver-link"><ChevronLeft size={18} strokeWidth={2.6} /> Cuentas</Link>
      </div>
      <h2 style={{ color: 'var(--navy)' }}>Nuevo Prestamo</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <label>
          Cuenta
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="input">
            {cuentasDisponibles.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </label>

        <BuscadorPersona
          label="Cliente" dni={clienteDni} nombre={clienteNombre} tipoDocumento={clienteTipoDoc}
          onChangeDni={setClienteDni} onChangeNombre={setClienteNombre} onChangeTipoDocumento={setClienteTipoDoc}
          personas={personas} required
        />

        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={tieneAval} onChange={(e) => setTieneAval(e.target.checked)} />
          Tiene Aval o Recomendado (opcional)
        </label>

        {tieneAval && (
          <BuscadorPersona
            label="Aval / Recomendado" dni={avalDni} nombre={avalNombre} tipoDocumento={avalTipoDoc}
            onChangeDni={setAvalDni} onChangeNombre={setAvalNombre} onChangeTipoDocumento={setAvalTipoDoc}
            personas={personas}
          />
        )}

        <label>
          Fecha de prestamo
          <FechaInput required value={fecha} onChange={setFecha} />
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

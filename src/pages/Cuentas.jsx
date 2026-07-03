import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Landmark, ArrowRight, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyISO, formatFecha } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

const TIPOS = [
  { value: 'propio', label: 'Capital propio' },
  { value: 'prestamo_solicitado', label: 'Prestamo solicitado (a un banco/caja)' },
  { value: 'reinversion', label: 'Reinversion de ganancias' },
]

function FormCuenta({ inicial, onGuardar, onCancelar, cuentas, guardando }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '')
  const [prefijo, setPrefijo] = useState(inicial?.prefijo || '')
  const [tipo, setTipo] = useState(inicial?.tipo || 'propio')
  const [saldoInicial, setSaldoInicial] = useState(inicial?.saldo_inicial ?? '')
  const [fechaSaldo, setFechaSaldo] = useState(inicial?.fecha_saldo_inicial || hoyISO())
  const [destinoInteres, setDestinoInteres] = useState(inicial?.cuenta_destino_interes_id || '')

  function submit(e) {
    e.preventDefault()
    onGuardar({
      nombre, prefijo: prefijo.toUpperCase(), tipo,
      saldo_inicial: Number(saldoInicial) || 0,
      fecha_saldo_inicial: fechaSaldo,
      cuenta_destino_interes_id: destinoInteres || null,
    })
  }

  return (
    <form onSubmit={submit} className="cuenta-form">
      <label>Nombre de la cuenta
        <input className="input" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Prestamos BCP" />
      </label>
      <label>Prefijo para el codigo de prestamo (ej: BCP -&gt; PR-BCP-0001)
        <input className="input" required maxLength={12} value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="Ej: BCP" />
      </label>
      <label>Tipo de cuenta
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 12 }}>
        <label style={{ flex: 1 }}>Saldo inicial (S/.)
          <input className="input" type="number" step="0.01" required value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
        </label>
        <label style={{ flex: 1 }}>Fecha de ese saldo
          <input className="input" type="date" required value={fechaSaldo} onChange={(e) => setFechaSaldo(e.target.value)} />
        </label>
      </div>
      <label>A donde va el interes que generen los prestamos de esta cuenta
        <select className="input" value={destinoInteres} onChange={(e) => setDestinoInteres(e.target.value)}>
          <option value="">Se queda en la misma cuenta</option>
          {cuentas.filter((c) => c.id !== inicial?.id).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        <button className="btn secondary" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

export default function Cuentas() {
  const [cuentas, setCuentas] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function cargar() {
    const { data, error } = await supabase.from('v_saldo_cuentas').select('*').order('nombre')
    if (error) setError(error.message)
    setCuentas(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function crear(valores) {
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('cuentas').insert(valores)
    if (error) setError(error.message)
    else { setMostrarForm(false); cargar() }
    setGuardando(false)
  }

  async function actualizar(valores) {
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('cuentas').update(valores).eq('id', editando.id)
    if (error) setError(error.message)
    else { setEditando(null); cargar() }
    setGuardando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: 'var(--navy)', margin: 0 }}>Cuentas</h2>
        <button className="btn" onClick={() => { setMostrarForm(true); setEditando(null) }}>
          <Plus size={16} strokeWidth={2.4} /> Nueva cuenta
        </button>
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 4, marginBottom: 20 }}>
        Cada cuenta representa una fuente de capital independiente, con su propio saldo y control de caja.
      </p>

      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {mostrarForm && (
        <div className="cuenta-form-card">
          <h3 style={{ color: 'var(--navy)', margin: '0 0 14px' }}>Nueva cuenta</h3>
          <FormCuenta cuentas={cuentas || []} onGuardar={crear} onCancelar={() => setMostrarForm(false)} guardando={guardando} />
        </div>
      )}

      <div className="cuentas-grid">
        {cuentas?.map((c) => (
          <div className="cuenta-card" key={c.id}>
            {editando?.id === c.id ? (
              <FormCuenta
                inicial={editando} cuentas={cuentas}
                onGuardar={actualizar} onCancelar={() => setEditando(null)} guardando={guardando}
              />
            ) : (
              <>
                <div className="cuenta-card-header">
                  <div className="cuenta-card-icon"><Landmark size={18} strokeWidth={2.2} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="cuenta-card-nombre">{c.nombre}</div>
                    <div className="cuenta-card-tipo">{TIPOS.find((t) => t.value === c.tipo)?.label || c.tipo}</div>
                  </div>
                  <button className="chip" onClick={() => { setEditando(c); setMostrarForm(false) }}>
                    <Pencil size={13} strokeWidth={2.4} /> Editar
                  </button>
                </div>

                <div className="cuenta-card-saldo">
                  <span>Saldo actual</span>
                  <b>{money(c.saldo_actual)}</b>
                </div>

                <div className="cuenta-card-detalle">
                  <div><span>Saldo inicial</span><b>{money(c.saldo_inicial)} ({formatFecha(c.fecha_saldo_inicial)})</b></div>
                  {c.cuenta_destino_interes && <div><span>Interes va a</span><b>{c.cuenta_destino_interes}</b></div>}
                </div>

                <div className="cuenta-card-acciones">
                  <button className="btn secondary" style={{ flex: 1 }} onClick={() => navigate(`/prestamos/${encodeURIComponent(c.nombre)}`)}>
                    Ver prestamos <ArrowRight size={14} strokeWidth={2.4} />
                  </button>
                  <button className="btn secondary" style={{ flex: 1 }} onClick={() => navigate(`/flujo-caja/${encodeURIComponent(c.nombre)}`)}>
                    Flujo de caja <ArrowRight size={14} strokeWidth={2.4} />
                  </button>
                </div>
                <button
                  className="btn" style={{ width: '100%', marginTop: 8 }}
                  onClick={() => navigate(`/nuevo?cuenta=${encodeURIComponent(c.nombre)}`)}
                >
                  <Plus size={16} strokeWidth={2.4} /> Nuevo prestamo en {c.nombre}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

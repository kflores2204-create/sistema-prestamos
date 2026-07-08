import { useEffect, useState } from 'react'
import { UserPlus, Trash2, Mail, Search } from 'lucide-react'
import { getAccessToken } from '../lib/supabase'

function generarPassword() {
  // password temporal legible, la persona la puede cambiar despues si Supabase lo permite
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function llamarApi(path, options = {}) {
  const token = await getAccessToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error inesperado')
  return data
}

export default function Equipo() {
  const [usuarios, setUsuarios] = useState(null)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generarPassword())
  const [creando, setCreando] = useState(false)
  const [creado, setCreado] = useState(null)

  const [rucQuery, setRucQuery] = useState('')
  const [rucResultado, setRucResultado] = useState(null)
  const [rucError, setRucError] = useState('')
  const [rucBuscando, setRucBuscando] = useState(false)

  const [dniQuery, setDniQuery] = useState('')
  const [dniResultado, setDniResultado] = useState(null)
  const [dniError, setDniError] = useState('')
  const [dniBuscando, setDniBuscando] = useState(false)

  async function cargar() {
    setError('')
    try {
      const data = await llamarApi('/api/list-users')
      setUsuarios(data.usuarios)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { cargar() }, [])

  async function crear(e) {
    e.preventDefault()
    setCreando(true)
    setError('')
    try {
      await llamarApi('/api/create-user', {
        method: 'POST',
        body: JSON.stringify({ nombre, dni, email, password }),
      })
      setCreado({ nombre, email, password })
      setNombre(''); setDni(''); setEmail(''); setPassword(generarPassword())
      setMostrarForm(false)
      cargar()
    } catch (err) {
      setError(err.message)
    }
    setCreando(false)
  }

  async function quitarAcceso(u) {
    if (!confirm(`¿Quitar el acceso de ${u.nombre} (${u.email})? Esta accion no se puede deshacer.`)) return
    try {
      await llamarApi('/api/delete-user', { method: 'POST', body: JSON.stringify({ userId: u.id }) })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function buscarRuc(e) {
    e.preventDefault()
    setRucBuscando(true)
    setRucError('')
    setRucResultado(null)
    try {
      const data = await llamarApi(`/api/consulta-ruc?ruc=${encodeURIComponent(rucQuery.trim())}`)
      setRucResultado(data)
    } catch (err) {
      setRucError(err.message)
    }
    setRucBuscando(false)
  }

  async function buscarDni(e) {
    e.preventDefault()
    setDniBuscando(true)
    setDniError('')
    setDniResultado(null)
    try {
      const data = await llamarApi(`/api/consulta-dni?dni=${encodeURIComponent(dniQuery.trim())}`)
      setDniResultado(data)
    } catch (err) {
      setDniError(err.message)
    }
    setDniBuscando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: 'var(--navy)', margin: 0 }}>Equipo</h2>
        <button className="btn" onClick={() => setMostrarForm((v) => !v)}>
          <UserPlus size={16} strokeWidth={2.4} /> Nuevo acceso
        </button>
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 4, marginBottom: 20 }}>
        Personas con acceso al sistema. Podes crear cuentas nuevas con correo y contraseña,
        sin que necesiten una cuenta de Google.
      </p>

      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {creado && (
        <div className="kpi-card" style={{ marginBottom: 20, borderColor: 'var(--green)' }}>
          <div className="label" style={{ color: 'var(--green)' }}>Acceso creado</div>
          <p style={{ margin: '10px 0 4px', fontSize: 14 }}>
            Compartile estos datos a <b>{creado.nombre}</b> para que entre en "Entrar con correo y contraseña":
          </p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Correo:</b> {creado.email}</p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Contraseña:</b> {creado.password}</p>
          <button className="chip" style={{ marginTop: 8 }} onClick={() => setCreado(null)}>Cerrar</button>
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={crear} className="drawer-info" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          <label>Nombre completo
            <input className="input" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label>DNI (opcional)
            <input className="input" value={dni} onChange={(e) => setDni(e.target.value)} maxLength={8} />
          </label>
          <label>Correo
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>Contraseña temporal
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="chip" onClick={() => setPassword(generarPassword())}>Generar</button>
            </div>
          </label>
          <button className="btn" type="submit" disabled={creando}>
            {creando ? 'Creando...' : 'Crear acceso'}
          </button>
        </form>
      )}

      <table className="table-cards">
        <thead>
          <tr><th>Nombre</th><th>Correo</th><th>Acceso</th><th>Ultimo ingreso</th><th></th></tr>
        </thead>
        <tbody>
          {usuarios === null && !error && (
            <tr><td data-label="" colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Cargando...</td></tr>
          )}
          {usuarios?.map((u) => (
            <tr key={u.id}>
              <td data-label="Nombre">{u.nombre}</td>
              <td data-label="Correo">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} /> {u.email}
                </span>
              </td>
              <td data-label="Acceso">{u.proveedor === 'google' ? 'Google' : 'Correo y contraseña'}</td>
              <td data-label="Ultimo ingreso">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-PE') : 'Nunca'}</td>
              <td data-label="">
                <button className="chip" onClick={() => quitarAcceso(u)} style={{ color: 'var(--red)' }}>
                  <Trash2 size={13} strokeWidth={2.4} /> Quitar acceso
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ color: 'var(--navy)', marginTop: 32 }}>Probar consulta de RUC</h3>
      <p style={{ color: 'var(--muted)', marginTop: 4, marginBottom: 16 }}>
        Bloque temporal para verificar que la integracion con Decolecta funciona.
        Requiere la variable de entorno DECOLECTA_TOKEN configurada en Vercel.
      </p>
      <form onSubmit={buscarRuc} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16, maxWidth: 500 }}>
        <label style={{ flex: 1 }}>RUC (11 digitos)
          <input className="input" value={rucQuery} onChange={(e) => setRucQuery(e.target.value)} maxLength={11} placeholder="Ej: 20601030013" />
        </label>
        <button className="btn" type="submit" disabled={rucBuscando}>
          <Search size={15} strokeWidth={2.4} /> {rucBuscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>
      {rucError && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14, maxWidth: 500 }}>
          {rucError}
        </div>
      )}
      {rucResultado && (
        <div className="kpi-card" style={{ maxWidth: 500 }}>
          <div className="label">Resultado</div>
          <p style={{ margin: '10px 0 4px', fontSize: 14 }}><b>RUC:</b> {rucResultado.ruc}</p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Razon social:</b> {rucResultado.razon_social || '—'}</p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Direccion:</b> {rucResultado.direccion || '—'}</p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Estado:</b> {rucResultado.estado || '—'}</p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Condicion:</b> {rucResultado.condicion || '—'}</p>
        </div>
      )}

      <h3 style={{ color: 'var(--navy)', marginTop: 32 }}>Probar consulta de DNI</h3>
      <p style={{ color: 'var(--muted)', marginTop: 4, marginBottom: 16 }}>
        Mismo proveedor (Decolecta). Si esto falla con error de autorizacion, es
        señal de que el servicio de DNI si esta cerrado para tu cuenta.
      </p>
      <form onSubmit={buscarDni} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16, maxWidth: 500 }}>
        <label style={{ flex: 1 }}>DNI (8 digitos)
          <input className="input" value={dniQuery} onChange={(e) => setDniQuery(e.target.value)} maxLength={8} placeholder="Ej: 46027897" />
        </label>
        <button className="btn" type="submit" disabled={dniBuscando}>
          <Search size={15} strokeWidth={2.4} /> {dniBuscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>
      {dniError && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14, maxWidth: 500 }}>
          {dniError}
        </div>
      )}
      {dniResultado && (
        <div className="kpi-card" style={{ maxWidth: 500 }}>
          <div className="label">Resultado</div>
          <p style={{ margin: '10px 0 4px', fontSize: 14 }}><b>DNI:</b> {dniResultado.dni}</p>
          <p style={{ margin: '4px 0', fontSize: 14 }}><b>Nombre completo:</b> {dniResultado.nombre_completo || '—'}</p>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { buscarNombrePorDni, buscarRazonSocialPorRuc } from '../lib/identidad'
import Modal from './Modal'
import TipoDocumentoInput from './TipoDocumentoInput'
import FechaInput from './FechaInput'

/**
 * Clasifica lo que ya se escribio en el buscador antes de abrir el modal.
 * Si es un numero de documento lo mandamos al campo de NUMERO (no al nombre)
 * y detectamos el tipo por su longitud:
 *   - 8 digitos  -> DNI
 *   - 11 digitos -> RUC
 *   - otro numero -> igual va al campo de documento (nunca al nombre)
 * Cualquier texto se toma como nombre, como antes.
 */
function clasificarInicial(valorInicial) {
  const v = (valorInicial || '').trim()
  if (/^\d{8}$/.test(v)) return { tipoDocumento: 'DNI', dni: v, nombre: '' }
  if (/^\d{11}$/.test(v)) return { tipoDocumento: 'RUC', dni: v, nombre: '' }
  if (/^\d+$/.test(v)) return { tipoDocumento: 'DNI', dni: v, nombre: '' }
  return { tipoDocumento: 'DNI', dni: '', nombre: v }
}

function formVacio(nombreInicial) {
  const { tipoDocumento, dni, nombre } = clasificarInicial(nombreInicial)
  return {
    dni, nombre, tipoDocumento, celular: '', correo: '',
    fechaNacimiento: '', genero: '', facebook: '', instagram: '', tiktok: '', comentario: '',
  }
}

function formDesdeCliente(c) {
  return {
    dni: c.dni || '', nombre: c.nombre || '', tipoDocumento: c.tipo_documento || 'DNI',
    celular: c.celular || '', correo: c.correo || '',
    fechaNacimiento: c.fecha_nacimiento || '', genero: c.genero || '',
    facebook: c.facebook || '', instagram: c.instagram || '', tiktok: c.tiktok || '',
    comentario: c.comentario || '',
  }
}

/**
 * Ventana flotante para crear O editar un cliente. Se usa en:
 *  - Clientes.jsx (boton "Nuevo cliente" -> crear; boton "Editar" -> editar)
 *  - BuscadorPersona.jsx (cuando buscas a alguien y no existe -> crear)
 *  - (ya no en Prestamos.jsx: ese boton se retiro)
 *
 * Comportamiento:
 *  - CREAR: si el buscador traia un numero (DNI/RUC), al abrir se enruta al
 *    campo de documento y se dispara la deteccion automatica al instante.
 *  - EDITAR: se abre precargado con el cliente (clienteInicial). Si cambias el
 *    numero de documento a un DNI/RUC valido, se vuelve a consultar RENIEC/SUNAT
 *    y se refrescan los datos; si ese documento pertenece a OTRO cliente, avisa
 *    y no secuestra la edicion.
 *  - En cuanto el numero llega a la longitud esperada (8 DNI, 11 RUC) se busca
 *    automaticamente, sin esperar a salir del campo.
 *  - Al crear, si el numero YA es de un cliente existente, el formulario pasa a
 *    editar ese cliente (avisa con un banner).
 *
 * Props:
 *  nombreInicial: string (opcional, lo escrito en la busqueda: nombre O documento)
 *  clienteInicial: objeto cliente completo (opcional) -> abre en modo EDITAR
 *  onClose: () => void
 *  onCreado: (cliente) => void  -> se llama con la fila creada o actualizada
 */
export default function ClienteModalCrear({ nombreInicial, clienteInicial, onClose, onCreado }) {
  const esEdicion = !!clienteInicial
  const [form, setForm] = useState(() => esEdicion ? formDesdeCliente(clienteInicial) : formVacio(nombreInicial))
  const [existenteId, setExistenteId] = useState(clienteInicial?.id || null)
  // Id del registro que estamos editando (estable entre renders): sirve para no
  // confundir "el mismo cliente" con "otro cliente que ya tiene ese documento".
  const registroId = useRef(clienteInicial?.id || null)
  const [aviso, setAviso] = useState('')
  const [tab, setTab] = useState('principales')
  const [buscando, setBuscando] = useState(false)
  const [sinResultado, setSinResultado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function manejarNumero(valor) {
    setForm((f) => ({ ...f, dni: valor }))
    setSinResultado(false)
    setAviso('')
    // Al editar SIEMPRE seguimos sobre el mismo registro; solo al crear
    // olvidamos cualquier "cliente existente" detectado en un intento previo.
    if (!esEdicion) setExistenteId(null)

    const esDni = form.tipoDocumento === 'DNI' && /^\d{8}$/.test(valor)
    const esRuc = form.tipoDocumento === 'RUC' && /^\d{11}$/.test(valor)
    if (!esDni && !esRuc) return

    // 1. Revisamos si ese numero ya pertenece a algun cliente.
    const { data: existente } = await supabase.from('clientes').select('*').eq('dni', valor).maybeSingle()
    if (existente && existente.id !== registroId.current) {
      if (esEdicion) {
        // Editando: el documento es de OTRO cliente. Avisamos, no secuestramos.
        setAviso('Ese documento ya pertenece a otro cliente.')
      } else {
        // Creando: el documento ya existe -> pasamos a editar ese cliente.
        setForm(formDesdeCliente(existente))
        setExistenteId(existente.id)
        registroId.current = existente.id
        setAviso('El cliente ya existe en el sistema')
      }
      return
    }

    // 2. Autocompletamos el nombre por DNI/RUC (servicio externo).
    //    Al crear respetamos un nombre ya escrito; al editar siempre refrescamos.
    if (!esEdicion && form.nombre.trim()) return
    setBuscando(true)
    try {
      if (esDni) {
        const n = await buscarNombrePorDni(valor)
        if (n) setForm((f) => ({ ...f, nombre: n }))
        else setSinResultado(true)
      } else {
        const r = await buscarRazonSocialPorRuc(valor)
        if (r?.razon_social) setForm((f) => ({ ...f, nombre: r.razon_social }))
        else setSinResultado(true)
      }
    } catch { setSinResultado(true) }
    setBuscando(false)
  }

  // Al ABRIR CREANDO ya con un numero (venido del buscador), disparamos la
  // misma deteccion/autocompletado. Al editar NO auto-consultamos en la apertura
  // (respetamos los datos guardados hasta que el usuario cambie el documento).
  useEffect(() => {
    if (!esEdicion && form.dni && (form.tipoDocumento === 'DNI' || form.tipoDocumento === 'RUC')) {
      manejarNumero(form.dni)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardar(e) {
    e.preventDefault()
    const nombre = form.nombre.trim()
    if (!nombre) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    setError('')
    const payload = {
      dni: form.tipoDocumento === 'Sin Documento' ? null : (form.dni.trim() || null),
      nombre,
      tipo_documento: form.tipoDocumento,
      celular: form.celular.trim() || null,
      correo: form.correo.trim() || null,
      fecha_nacimiento: form.fechaNacimiento || null,
      genero: form.genero || null,
      facebook: form.facebook.trim() || null,
      instagram: form.instagram.trim() || null,
      tiktok: form.tiktok.trim() || null,
      comentario: form.comentario.trim() || null,
    }
    const { data, error: err } = existenteId
      ? await supabase.from('clientes').update(payload).eq('id', existenteId).select().single()
      : await supabase.from('clientes').insert(payload).select().single()
    setGuardando(false)
    if (err) {
      setError(err.code === '23505' ? 'Ya existe un cliente con ese documento.' : 'Error al guardar: ' + err.message)
      return
    }
    onCreado(data)
  }

  return (
    <Modal title={existenteId ? 'Editar cliente' : 'Nuevo cliente'} subtitle="Agregar un cliente a la base de datos" onClose={onClose}>
      {aviso && (
        <div className="aviso-banner">
          {aviso}
          <button type="button" onClick={() => setAviso('')}>✕</button>
        </div>
      )}

      <div className="tabs-simple">
        <button type="button" className={tab === 'principales' ? 'activo' : ''} onClick={() => setTab('principales')}>Principales</button>
        <button type="button" className={tab === 'adicionales' ? 'activo' : ''} onClick={() => setTab('adicionales')}>Adicionales</button>
      </div>

      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'principales' ? (
          <>
            <TipoDocumentoInput
              tipo={form.tipoDocumento} numero={form.dni}
              onChangeTipo={(t) => setForm((f) => ({ ...f, tipoDocumento: t, dni: t === 'Sin Documento' ? '' : f.dni }))}
              onChangeNumero={manejarNumero}
              buscando={buscando}
            />
            <label>Nombres y Apellidos
              <input className="input" required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
            </label>
            {sinResultado && (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                No encontramos datos para ese numero, completalo a mano.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>Celular (opcional)
                <input className="input" value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} />
              </label>
              <label style={{ flex: 1 }}>Correo electronico (opcional)
                <input className="input" type="email" value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} />
              </label>
            </div>
          </>
        ) : (
          <div className="adicionales-grid">
            <label>Genero (opcional)
              <select className="input" value={form.genero} onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}>
                <option value="">No especificar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label>Fecha de nacimiento (opcional)
              <FechaInput value={form.fechaNacimiento} onChange={(v) => setForm((f) => ({ ...f, fechaNacimiento: v }))} />
            </label>
            <div>
              <span className="field-label">Redes sociales (opcional)</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input className="input" placeholder="Facebook" value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} />
                <input className="input" placeholder="Instagram" value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} />
                <input className="input" placeholder="TikTok" value={form.tiktok} onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))} />
              </div>
            </div>
            <label>Comentarios (opcional)
              <textarea className="input" rows={5} value={form.comentario} onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))} />
            </label>
          </div>
        )}

        {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : existenteId ? 'Guardar cambios' : 'Crear cliente'}
          </button>
          <button className="btn secondary" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Modal>
  )
}

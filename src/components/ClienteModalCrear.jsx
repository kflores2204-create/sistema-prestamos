import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { buscarNombrePorDni, buscarRazonSocialPorRuc } from '../lib/identidad'
import Modal from './Modal'
import TipoDocumentoInput from './TipoDocumentoInput'
import FechaInput from './FechaInput'

function formVacio(nombreInicial) {
  return {
    dni: '', nombre: nombreInicial || '', tipoDocumento: 'DNI', celular: '', correo: '',
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
 * Ventana flotante para crear (o editar, si el documento ya existe) un
 * cliente. Se usa en dos lugares:
 *  - Clientes.jsx (boton "Nuevo cliente")
 *  - BuscadorPersona.jsx (cuando buscas a alguien y no existe)
 *
 * Comportamiento:
 *  - En cuanto el numero de documento llega a la longitud esperada (8 DNI,
 *    11 RUC) se busca automaticamente, SIN esperar a salir del campo.
 *  - Si ese numero YA es de un cliente existente, el formulario se llena con
 *    sus datos reales y pasa a modo "Editar cliente" (avisa con un banner).
 *  - Si no existe, se autocompleta el nombre via RENIEC/SUNAT (Decolecta) y
 *    se sigue en modo "Nuevo cliente".
 *
 * Props:
 *  nombreInicial: string (opcional, precarga el nombre con lo que ya se escribio en la busqueda)
 *  onClose: () => void
 *  onCreado: (cliente) => void  -> se llama con la fila creada o actualizada
 */
export default function ClienteModalCrear({ nombreInicial, onClose, onCreado }) {
  const [form, setForm] = useState(() => formVacio(nombreInicial))
  const [existenteId, setExistenteId] = useState(null)
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
    setExistenteId(null)

    const esDni = form.tipoDocumento === 'DNI' && /^\d{8}$/.test(valor)
    const esRuc = form.tipoDocumento === 'RUC' && /^\d{11}$/.test(valor)
    if (!esDni && !esRuc) return

    // 1. Primero, revisamos si ese numero ya es de un cliente existente.
    const { data: existente } = await supabase.from('clientes').select('*').eq('dni', valor).maybeSingle()
    if (existente) {
      setForm(formDesdeCliente(existente))
      setExistenteId(existente.id)
      setAviso('El cliente ya existe en el sistema')
      return
    }

    // 2. Si no existe, autocompletamos el nombre por DNI/RUC (servicio externo).
    if (form.nombre.trim()) return
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

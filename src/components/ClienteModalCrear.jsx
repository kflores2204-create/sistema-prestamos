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

/**
 * Ventana flotante para crear un cliente nuevo. Se usa en dos lugares:
 *  - Clientes.jsx (boton "Nuevo cliente")
 *  - BuscadorPersona.jsx (cuando buscas a alguien y no existe)
 * En ambos casos el comportamiento y el diseño son identicos.
 *
 * Props:
 *  nombreInicial: string (opcional, precarga el nombre con lo que ya se escribio en la busqueda)
 *  onClose: () => void
 *  onCreado: (clienteCreado) => void  -> se llama con la fila insertada
 */
export default function ClienteModalCrear({ nombreInicial, onClose, onCreado }) {
  const [form, setForm] = useState(() => formVacio(nombreInicial))
  const [tab, setTab] = useState('principales')
  const [buscando, setBuscando] = useState(false)
  const [sinResultado, setSinResultado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function autocompletar(valor) {
    setSinResultado(false)
    if (form.nombre.trim()) return
    if (form.tipoDocumento === 'DNI' && /^\d{8}$/.test(valor)) {
      setBuscando(true)
      try {
        const n = await buscarNombrePorDni(valor)
        if (n) setForm((f) => ({ ...f, nombre: n }))
        else setSinResultado(true)
      } catch { setSinResultado(true) }
      setBuscando(false)
    } else if (form.tipoDocumento === 'RUC' && /^\d{11}$/.test(valor)) {
      setBuscando(true)
      try {
        const r = await buscarRazonSocialPorRuc(valor)
        if (r?.razon_social) setForm((f) => ({ ...f, nombre: r.razon_social }))
        else setSinResultado(true)
      } catch { setSinResultado(true) }
      setBuscando(false)
    }
  }

  async function crear(e) {
    e.preventDefault()
    const nombre = form.nombre.trim()
    if (!nombre) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    setError('')
    const { data, error: err } = await supabase.from('clientes').insert({
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
    }).select().single()
    setGuardando(false)
    if (err) {
      setError(err.code === '23505' ? 'Ya existe un cliente con ese documento.' : 'Error al guardar: ' + err.message)
      return
    }
    onCreado(data)
  }

  return (
    <Modal title="Nuevo cliente" subtitle="Agregar un cliente a la base de datos" onClose={onClose}>
      <div className="tabs-simple">
        <button type="button" className={tab === 'principales' ? 'activo' : ''} onClick={() => setTab('principales')}>Principales</button>
        <button type="button" className={tab === 'adicionales' ? 'activo' : ''} onClick={() => setTab('adicionales')}>Adicionales</button>
      </div>

      <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'principales' ? (
          <>
            <TipoDocumentoInput
              tipo={form.tipoDocumento} numero={form.dni}
              onChangeTipo={(t) => setForm((f) => ({ ...f, tipoDocumento: t, dni: t === 'Sin Documento' ? '' : f.dni }))}
              onChangeNumero={(v) => setForm((f) => ({ ...f, dni: v }))}
              onBlurNumero={autocompletar}
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
          <>
            <label>Fecha de nacimiento (opcional)
              <FechaInput value={form.fechaNacimiento} onChange={(v) => setForm((f) => ({ ...f, fechaNacimiento: v }))} />
            </label>
            <label>Genero (opcional)
              <select className="input" value={form.genero} onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}>
                <option value="">No especificar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label>Facebook (opcional)
              <input className="input" placeholder="https://facebook.com/tu-perfil" value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} />
            </label>
            <label>Instagram (opcional)
              <input className="input" placeholder="https://instagram.com/tu-perfil" value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} />
            </label>
            <label>TikTok (opcional)
              <input className="input" placeholder="https://tiktok.com/@tu-perfil" value={form.tiktok} onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))} />
            </label>
            <label>Comentarios (opcional)
              <textarea className="input" rows={3} value={form.comentario} onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))} />
            </label>
          </>
        )}

        {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Crear cliente'}
          </button>
          <button className="btn secondary" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Modal>
  )
}

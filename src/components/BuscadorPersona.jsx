import { useState } from 'react'
import { Plus } from 'lucide-react'
import { buscarNombrePorDni, buscarRazonSocialPorRuc } from '../lib/identidad'
import TipoDocumentoInput from './TipoDocumentoInput'

/**
 * Buscador de cliente (persona) reutilizable, con autocompletado y opcion de
 * crear un cliente nuevo si no existe. Este es el UNICO tipo de campo que
 * debe usarse cuando la accion es "elegir o crear un cliente" (a diferencia
 * de los buscadores de LISTA como en Prestamos/Clientes/Cronograma, que solo
 * filtran una tabla existente y no deben mezclarse con creacion de clientes).
 *
 * Props:
 *  label: string
 *  dni, nombre: string (valores actuales del numero de documento y el nombre)
 *  tipoDocumento: string ('DNI'|'RUC'|'Pasaporte'|'Carne Extranjeria'|'Sin Documento')
 *  onChangeDni, onChangeNombre, onChangeTipoDocumento: (string) => void
 *  personas: [{ id, dni, nombre }]  -> lista completa de clientes para autocompletar
 *  required: boolean
 */
export default function BuscadorPersona({
  label, dni, nombre, tipoDocumento, onChangeDni, onChangeNombre, onChangeTipoDocumento, personas, required,
}) {
  const [query, setQuery] = useState(nombre || '')
  const [abierto, setAbierto] = useState(false)
  const [buscandoDoc, setBuscandoDoc] = useState(false)
  const [sinResultado, setSinResultado] = useState(false)

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

  function crearNuevo() {
    onChangeDni('')
    onChangeNombre(query.trim())
    setQuery(query.trim())
    setAbierto(false)
  }

  async function autocompletar(valor) {
    setSinResultado(false)
    if (nombre.trim()) return
    if (tipoDocumento === 'DNI' && /^\d{8}$/.test(valor)) {
      setBuscandoDoc(true)
      try {
        const encontrado = await buscarNombrePorDni(valor)
        if (encontrado) { onChangeNombre(encontrado); setQuery(encontrado) }
        else setSinResultado(true)
      } catch { setSinResultado(true) }
      setBuscandoDoc(false)
    } else if (tipoDocumento === 'RUC' && /^\d{11}$/.test(valor)) {
      setBuscandoDoc(true)
      try {
        const resultado = await buscarRazonSocialPorRuc(valor)
        if (resultado?.razon_social) { onChangeNombre(resultado.razon_social); setQuery(resultado.razon_social) }
        else setSinResultado(true)
      } catch { setSinResultado(true) }
      setBuscandoDoc(false)
    }
  }

  return (
    <div className="buscador-persona-wrap">
      <div className="buscador-persona">
        <label>{label}
          <input
            className="input" placeholder="Buscar por DNI o nombre..." value={query}
            onChange={(e) => { setQuery(e.target.value); setAbierto(true) }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
          />
        </label>
        {abierto && query.length >= 2 && (
          <div className="autocomplete-dropdown">
            <div className="autocomplete-crear" onMouseDown={crearNuevo}>
              <Plus size={14} strokeWidth={2.6} /> Crear cliente nuevo: "{query.trim()}"
            </div>
            {sugerencias.map((p) => (
              <div key={p.id} className="autocomplete-item" onMouseDown={() => elegir(p)}>
                <span className="autocomplete-dni">{p.dni || 'S/N'}</span>
                <span>{p.nombre}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TipoDocumentoInput
          tipo={tipoDocumento} numero={dni}
          onChangeTipo={onChangeTipoDocumento} onChangeNumero={onChangeDni}
          onBlurNumero={autocompletar}
          required={required && tipoDocumento !== 'Sin Documento'}
          buscando={buscandoDoc}
        />
        <label>Nombres y Apellidos
          <input className="input" value={nombre} onChange={(e) => onChangeNombre(e.target.value)} required={required} />
        </label>
      </div>
      {sinResultado && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
          No encontramos un nombre para ese numero, completalo a mano.
        </p>
      )}
    </div>
  )
}

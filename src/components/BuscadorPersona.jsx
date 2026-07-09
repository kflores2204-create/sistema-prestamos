import { useState } from 'react'
import { Plus } from 'lucide-react'
import ClienteModalCrear from './ClienteModalCrear'

/**
 * Buscador de cliente (persona): UN SOLO campo de busqueda. Si la persona ya
 * existe, se selecciona de la lista de sugerencias. Si no existe, se abre una
 * ventana flotante (modal) para crearla, con todos sus datos - no hay campos
 * de DNI/Nombre sueltos aparte del buscador, para no duplicar la interfaz.
 *
 * Este es el UNICO tipo de campo que debe usarse cuando la accion es "elegir
 * o crear un cliente" (a diferencia de los buscadores de LISTA como en
 * Prestamos/Clientes/Cronograma, que solo filtran una tabla existente).
 *
 * Props:
 *  label: string
 *  dni, nombre, tipoDocumento: valores actuales de la persona seleccionada
 *  onChangeDni, onChangeNombre, onChangeTipoDocumento: (string) => void
 *  personas: [{ id, dni, nombre, tipo_documento }]  -> lista completa para autocompletar
 *  required: boolean
 */
export default function BuscadorPersona({
  label, dni, nombre, tipoDocumento, onChangeDni, onChangeNombre, onChangeTipoDocumento, personas, required,
}) {
  const [query, setQuery] = useState(nombre || '')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)

  const sugerencias = query.length >= 2
    ? personas.filter((p) =>
        (p.dni || '').includes(query) || p.nombre.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : []

  function elegir(p) {
    onChangeDni(p.dni || '')
    onChangeNombre(p.nombre)
    onChangeTipoDocumento?.(p.tipo_documento || 'DNI')
    setQuery(p.nombre)
    setAbierto(false)
  }

  function onCreado(cliente) {
    onChangeDni(cliente.dni || '')
    onChangeNombre(cliente.nombre)
    onChangeTipoDocumento?.(cliente.tipo_documento || 'DNI')
    setQuery(cliente.nombre)
    setCreando(false)
  }

  return (
    <div className="buscador-persona-wrap">
      <div className="buscador-persona">
        <label>{label}
          <input
            className="input" placeholder="Buscar por DNI o nombre..." value={query} required={required && !nombre}
            onChange={(e) => { setQuery(e.target.value); setAbierto(true); if (nombre) { onChangeNombre(''); onChangeDni('') } }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
          />
        </label>
        {abierto && query.length >= 2 && (
          <div className="autocomplete-dropdown">
            <div className="autocomplete-crear" onMouseDown={() => setCreando(true)}>
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

      {creando && (
        <ClienteModalCrear nombreInicial={query} onClose={() => setCreando(false)} onCreado={onCreado} />
      )}
    </div>
  )
}

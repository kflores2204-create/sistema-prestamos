import { useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Buscador de cliente (persona) reutilizable, con autocompletado y opcion de
 * crear un cliente nuevo si no existe. Este es el UNICO tipo de campo que
 * debe usarse cuando la accion es "elegir o crear un cliente" (a diferencia
 * de los buscadores de LISTA como en Prestamos/Clientes/Cronograma, que solo
 * filtran una tabla existente y no deben mezclarse con creacion de clientes).
 *
 * Props:
 *  label: string
 *  dni, nombre: string (valores actuales)
 *  onChangeDni, onChangeNombre: (string) => void
 *  personas: [{ id, dni, nombre }]  -> lista completa de clientes para autocompletar
 *  required: boolean
 */
export default function BuscadorPersona({ label, dni, nombre, onChangeDni, onChangeNombre, personas, required }) {
  const [query, setQuery] = useState(nombre || '')
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

  function crearNuevo() {
    onChangeDni('')
    onChangeNombre(query.trim())
    setQuery(query.trim())
    setAbierto(false)
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

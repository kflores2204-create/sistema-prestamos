import { useState } from 'react'

/**
 * Barra de busqueda para FILTRAR una lista (NO crea clientes). Muestra un
 * autocompletado con sugerencias mientras escribes; al elegir una, se coloca
 * ese texto como filtro. Si no eliges ninguna, filtra por texto libre igual
 * que un input normal. Reutiliza las clases de autocompletado ya existentes
 * (.buscador-persona / .autocomplete-dropdown / .autocomplete-item).
 *
 * A diferencia de BuscadorPersona, este NO ofrece "Crear cliente": es solo
 * para acotar una tabla existente (Prestamos, Cronograma, Dashboard).
 *
 * Props:
 *  value: string                       -> texto actual del filtro
 *  onChange: (string) => void          -> actualizar el filtro
 *  placeholder: string
 *  sugerencias: [{ key, texto, etiqueta }]
 *      texto    = lo que se coloca como filtro al elegir (ej. nombre del cliente)
 *      etiqueta = dato secundario mostrado a la izquierda (ej. DNI)
 *  wrapperClassName: string (opcional) -> clases extra del contenedor (ej. "search-box")
 *  wrapperStyle: object (opcional)     -> estilos extra del contenedor (ej. margenes)
 *  inputClassName: string (opcional)   -> por defecto "input"
 *  minLen: number (opcional, default 2)
 */
export default function BuscadorFiltro({
  value, onChange, placeholder, sugerencias = [],
  wrapperClassName = '', wrapperStyle, inputClassName = 'input', minLen = 2,
}) {
  const [abierto, setAbierto] = useState(false)
  const q = (value || '').trim().toLowerCase()

  const lista = q.length >= minLen
    ? sugerencias.filter((s) =>
        s.texto.toLowerCase().includes(q) || (s.etiqueta || '').toLowerCase().includes(q)
      ).slice(0, 6)
    : []

  return (
    <div className={`buscador-persona ${wrapperClassName}`.trim()} style={wrapperStyle}>
      <input
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {abierto && lista.length > 0 && (
        <div className="autocomplete-dropdown">
          {lista.map((s) => (
            <div key={s.key} className="autocomplete-item" onMouseDown={() => { onChange(s.texto); setAbierto(false) }}>
              {s.etiqueta && <span className="autocomplete-dni">{s.etiqueta}</span>}
              <span>{s.texto}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

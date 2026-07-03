import { useEffect, useRef, useState } from 'react'

/**
 * Filtro multi-select.
 * - Por defecto (todas las opciones seleccionadas) muestra una caja de una
 *   sola linea con el placeholder (ej. "Todas las cuentas"), igual a un
 *   <select> nativo.
 * - En cuanto el usuario desmarca alguna opcion (seleccion parcial), la caja
 *   muestra chips individuales removibles. Los chips viven en su propia
 *   columna que puede crecer HACIA ABAJO (nunca cambia el ancho de la caja),
 *   y las acciones (limpiar / flecha) quedan fijas en su propia columna a la
 *   derecha, por lo que nunca se tapan con los chips sin importar cuantas
 *   lineas ocupen.
 *
 * Semantica: por defecto TODAS las opciones deben venir seleccionadas
 * (asi el resumen muestra el placeholder). Es responsabilidad del
 * componente padre inicializar "selected" con todas las opciones.
 *
 * Props:
 *  options: string[]           -> todas las opciones posibles
 *  selected: Set<string>       -> opciones actualmente seleccionadas
 *  onChange: (Set<string>) => void
 *  placeholder: string         -> texto cuando estan todas seleccionadas (ej. "Todas las cuentas")
 *  labelFor: (opcion) => string  -> texto a mostrar (opcional, por defecto la opcion misma)
 */
export default function MultiSelect({ options, selected, onChange, placeholder = 'Seleccionar...', labelFor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const label = labelFor || ((o) => o)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('touchstart', onClickOutside)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('touchstart', onClickOutside)
    }
  }, [])

  function toggle(opt) {
    const next = new Set(selected)
    if (next.has(opt)) next.delete(opt); else next.add(opt)
    onChange(next)
  }

  function removeChip(opt, e) {
    e.stopPropagation()
    const next = new Set(selected)
    next.delete(opt)
    onChange(next)
  }

  function clearAll(e) {
    e.stopPropagation()
    onChange(new Set(options))
  }

  const todasSeleccionadas = selected.size === options.length
  const ningunaSeleccionada = selected.size === 0

  return (
    <div className="multiselect" ref={ref}>
      <div className="multiselect-box" onClick={() => setOpen((o) => !o)}>
        <div className="multiselect-chips">
          {todasSeleccionadas && <span className="multiselect-placeholder">{placeholder}</span>}
          {ningunaSeleccionada && <span className="multiselect-placeholder">Ninguno seleccionado</span>}
          {!todasSeleccionadas && !ningunaSeleccionada && options.filter((opt) => selected.has(opt)).map((opt) => (
            <span key={opt} className="multiselect-chip">
              {label(opt)}
              <button type="button" onClick={(e) => removeChip(opt, e)} aria-label={`Quitar ${label(opt)}`}>×</button>
            </span>
          ))}
        </div>
        <div className="multiselect-actions">
          {!todasSeleccionadas && (
            <button type="button" className="multiselect-clear" onClick={clearAll} aria-label="Seleccionar todos">×</button>
          )}
          <span className={`multiselect-chevron ${open ? 'open' : ''}`}>▾</span>
        </div>
      </div>
      {open && (
        <div className="multiselect-dropdown">
          {options.map((opt) => (
            <div
              key={opt}
              className={`multiselect-option ${selected.has(opt) ? 'checked' : ''}`}
              onClick={() => toggle(opt)}
            >
              <span className="multiselect-checkbox">{selected.has(opt) && '✓'}</span>
              {label(opt)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

/**
 * Filtro multi-select con chips removibles.
 * - Muestra los seleccionados como chips con "x" dentro de una caja tipo input.
 * - Al hacer click en la caja se despliega una lista con checkboxes.
 * - Click afuera cierra el dropdown.
 *
 * Props:
 *  options: string[]           -> todas las opciones posibles
 *  selected: Set<string>       -> opciones actualmente seleccionadas
 *  onChange: (Set<string>) => void
 *  placeholder: string
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
    onChange(new Set())
  }

  return (
    <div className="multiselect" ref={ref}>
      <div className="multiselect-box" onClick={() => setOpen((o) => !o)}>
        {selected.size === 0 && <span className="multiselect-placeholder">{placeholder}</span>}
        {[...selected].map((opt) => (
          <span key={opt} className="multiselect-chip">
            {label(opt)}
            <button type="button" onClick={(e) => removeChip(opt, e)} aria-label={`Quitar ${label(opt)}`}>×</button>
          </span>
        ))}
        <span className="multiselect-actions">
          {selected.size > 0 && (
            <button type="button" className="multiselect-clear" onClick={clearAll} aria-label="Limpiar todo">×</button>
          )}
          <span className={`multiselect-chevron ${open ? 'open' : ''}`}>▾</span>
        </span>
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

import { useEffect, useRef, useState } from 'react'

/**
 * Filtro multi-select con caja cerrada de UNA sola linea y altura fija
 * (igual a un <select> nativo / un .input), para que nunca se deforme ni
 * quede mas grande/chico que los campos vecinos, sin importar cuantas
 * opciones tenga seleccionadas. El detalle (chips, checkboxes) vive
 * unicamente dentro del desplegable, no en la caja cerrada.
 *
 * Semantica: "selected" vacio = sin filtro (equivalente a "todas/todos"),
 * es responsabilidad del componente padre interpretarlo asi al filtrar.
 * Empezar vacio y dejar que el usuario elija activamente es el
 * comportamiento esperado en todo el sistema.
 *
 * Props:
 *  options: string[]           -> todas las opciones posibles
 *  selected: Set<string>       -> opciones actualmente seleccionadas (vacio = todas)
 *  onChange: (Set<string>) => void
 *  placeholder: string         -> texto cuando no hay nada seleccionado (ej. "Todas las cuentas")
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

  function clearAll(e) {
    e.stopPropagation()
    onChange(new Set())
  }

  const resumen = selected.size === 0
    ? placeholder
    : selected.size === 1
      ? label([...selected][0])
      : `${selected.size} seleccionadas`

  return (
    <div className="multiselect" ref={ref}>
      <div className="multiselect-box" onClick={() => setOpen((o) => !o)}>
        <span className={selected.size === 0 ? 'multiselect-placeholder' : 'multiselect-summary'}>{resumen}</span>
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

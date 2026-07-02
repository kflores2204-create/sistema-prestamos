import { useEffect, useRef, useState } from 'react'

const OPCIONES = [
  { value: 'Pendiente', className: 'pendiente' },
  { value: 'Pagado', className: 'pagado' },
]

/**
 * Dropdown de estado de cuota (Pendiente / Pagado) con colores por opcion,
 * igual al comportamiento de referencia (fondo de color en cada opcion del menu).
 */
export default function EstadoSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const actual = OPCIONES.find((o) => o.value === value) || OPCIONES[0]

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

  return (
    <div className="estado-select" ref={ref}>
      <button
        type="button"
        className={`estado-select-btn ${actual.className}`}
        onClick={() => setOpen((o) => !o)}
      >
        {actual.value}
        <span className={`estado-select-chevron ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="estado-select-dropdown">
          {OPCIONES.map((o) => (
            <div
              key={o.value}
              className={`estado-select-option ${o.className} ${o.value === value ? 'selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.value}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

const OPCIONES = [
  { value: 'Pendiente', className: 'pendiente' },
  { value: 'Pagado', className: 'pagado' },
]
const ALTO_ESTIMADO_MENU = 100 // px, altura aproximada del menu desplegado (2 opciones)

/**
 * Dropdown de estado de cuota (Pendiente / Pagado) con colores por opcion,
 * igual al comportamiento de referencia (fondo de color en cada opcion del menu).
 * Se abre hacia arriba automaticamente si no hay espacio suficiente debajo.
 */
export default function EstadoSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [abrirArriba, setAbrirArriba] = useState(false)
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

  function abrir() {
    if (ref.current) {
      const espacioAbajo = window.innerHeight - ref.current.getBoundingClientRect().bottom
      setAbrirArriba(espacioAbajo < ALTO_ESTIMADO_MENU)
    }
    setOpen((o) => !o)
  }

  return (
    <div className="estado-select" ref={ref}>
      <button
        type="button"
        className={`estado-select-btn ${actual.className}`}
        onClick={abrir}
      >
        {actual.value}
        <span className={`estado-select-chevron ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className={`estado-select-dropdown ${abrirArriba ? 'abrir-arriba' : ''}`}>
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

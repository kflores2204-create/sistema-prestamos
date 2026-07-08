import { useRef } from 'react'
import { formatFecha } from '../lib/prestamoUtils'

/**
 * Input de fecha con apariencia 100% propia (texto "dd/mm/aaaa" y flechita
 * identicos en CUALQUIER dispositivo/navegador), en vez de depender del
 * placeholder nativo del <input type="date">, que en muchos navegadores
 * moviles (Chrome/Brave Android) simplemente no se dibuja cuando esta vacio.
 *
 * Al hacer click en CUALQUIER parte de la caja (no solo un icono) se abre el
 * selector de fecha nativo del sistema operativo via showPicker(), asi que
 * no se pierde nada de funcionalidad.
 *
 * Props: value (string 'YYYY-MM-DD' o ''), onChange(value), required, min, max
 */
export default function FechaInput({ value, onChange, required, min, max }) {
  const ref = useRef(null)

  function abrirCalendario() {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return } catch { /* sigue al fallback */ }
    }
    el.focus()
  }

  return (
    <div className="fecha-input-wrap">
      <div className="fecha-input-display" onClick={abrirCalendario}>
        <span className={value ? 'fecha-input-valor' : 'fecha-input-placeholder'}>
          {value ? formatFecha(value) : 'dd/mm/aaaa'}
        </span>
        <span className="fecha-input-chevron">▾</span>
      </div>
      <input
        ref={ref}
        type="date"
        className="fecha-input-nativo"
        value={value || ''}
        required={required}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

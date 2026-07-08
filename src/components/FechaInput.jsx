import { formatFecha } from '../lib/prestamoUtils'

/**
 * Input de fecha con apariencia 100% propia (texto "dd/mm/aaaa" y flechita
 * identicos en CUALQUIER dispositivo/navegador), en vez de depender del
 * placeholder nativo del <input type="date">, que en muchos navegadores
 * moviles (Chrome/Brave Android) simplemente no se dibuja cuando esta vacio.
 *
 * Por debajo, sigue habiendo un <input type="date"> real y funcional
 * (invisible, superpuesto), asi que al tocar la caja se sigue abriendo el
 * selector de fecha nativo del sistema operativo — no se pierde nada de
 * funcionalidad, solo se reemplaza la parte visual que era inconsistente.
 *
 * Props: value (string 'YYYY-MM-DD' o ''), onChange(value), required, min, max
 */
export default function FechaInput({ value, onChange, required, min, max }) {
  return (
    <div className="fecha-input-wrap">
      <div className="fecha-input-display">
        <span className={value ? 'fecha-input-valor' : 'fecha-input-placeholder'}>
          {value ? formatFecha(value) : 'dd/mm/aaaa'}
        </span>
        <span className="fecha-input-chevron">▾</span>
      </div>
      <input
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

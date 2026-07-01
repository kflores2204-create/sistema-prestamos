export const FRECUENCIAS = [
  { value: 'semanal', label: 'Semanal (cada 7 dias)' },
  { value: 'quincenal', label: 'Quincenal (cada 15 dias)' },
  { value: 'mensual', label: 'Mensual (cada mes)' },
]

/** Calcula la fecha de la cuota N a partir de la fecha de prestamo y la frecuencia elegida. */
export function fechaCuota(fechaBase, n, frecuencia) {
  const f = new Date(fechaBase)
  if (frecuencia === 'quincenal') {
    f.setDate(f.getDate() + 15 * n)
  } else if (frecuencia === 'mensual') {
    f.setMonth(f.getMonth() + n)
  } else {
    f.setDate(f.getDate() + 7 * n) // semanal (default)
  }
  return f
}

const HOY = () => new Date(new Date().toDateString())

/** Una cuota tiene recargo aplicado si esta vencida, pendiente, y el prestamo tiene recargo configurado. */
export function tieneRecargoAplicado(cuota, recargoPct) {
  if (!recargoPct) return false
  if (cuota.estado !== 'Pendiente') return false
  return new Date(cuota.fecha_vencimiento) < HOY()
}

/** Monto a cobrar hoy por esa cuota, incluyendo el recargo si corresponde. */
export function montoConRecargo(cuota, recargoPct) {
  const base = Number(cuota.monto)
  if (tieneRecargoAplicado(cuota, recargoPct)) {
    return base * (1 + Number(recargoPct))
  }
  return base
}

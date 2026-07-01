export const FRECUENCIAS = [
  { value: 'semanal', label: 'Semanal (cada 7 dias)' },
  { value: 'quincenal', label: 'Quincenal (cada 15 dias)' },
  { value: 'mensual', label: 'Mensual (cada mes)' },
]

/**
 * ============================================================
 * Utilidades de fecha SEGURAS respecto a zona horaria.
 * ============================================================
 * Nunca usar .toISOString() ni new Date("YYYY-MM-DD") directamente para
 * fechas de negocio: JS interpreta los strings "YYYY-MM-DD" como UTC, pero
 * las fechas con hora (o Date.now()) usan la zona horaria local. Mezclar
 * ambas formas es lo que causaba que a veces se "perdiera" un dia (Peru
 * esta UTC-5). Estas funciones siempre trabajan en fecha LOCAL, sin pasar
 * nunca por una conversion UTC.
 */

/** Fecha de hoy en formato YYYY-MM-DD, usando la fecha LOCAL del dispositivo. */
export function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Convierte un objeto Date a texto YYYY-MM-DD usando sus componentes LOCALES (sin pasar por UTC). */
export function toDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Parsea un string YYYY-MM-DD como fecha LOCAL (no UTC), para poder hacer operaciones como setDate/setMonth. */
export function parseFechaLocal(fechaStr) {
  const [y, m, d] = String(fechaStr).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Formatea un string YYYY-MM-DD (tal como viene de la base de datos) a DD/MM/YYYY, sin usar objetos Date. */
export function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  const [y, m, d] = String(fechaStr).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Calcula la fecha de la cuota N a partir de la fecha de prestamo (string YYYY-MM-DD) y la frecuencia elegida. */
export function fechaCuota(fechaBaseStr, n, frecuencia) {
  const f = parseFechaLocal(fechaBaseStr)
  if (frecuencia === 'quincenal') {
    f.setDate(f.getDate() + 15 * n)
  } else if (frecuencia === 'mensual') {
    f.setMonth(f.getMonth() + n)
  } else {
    f.setDate(f.getDate() + 7 * n) // semanal (default)
  }
  return toDateOnly(f)
}

/** Una cuota esta atrasada si sigue Pendiente y ya paso su fecha de vencimiento (comparacion por texto, sin Date). */
export function estaAtrasada(cuota) {
  return cuota.estado === 'Pendiente' && String(cuota.fecha_vencimiento).slice(0, 10) < hoyISO()
}

/** Una cuota tiene recargo aplicado si esta atrasada Y el prestamo tiene recargo configurado. */
export function tieneRecargoAplicado(cuota, recargoPct) {
  if (!recargoPct) return false
  return estaAtrasada(cuota)
}

/** Monto a cobrar hoy por esa cuota, incluyendo el recargo si corresponde. */
export function montoConRecargo(cuota, recargoPct) {
  const base = Number(cuota.monto)
  if (tieneRecargoAplicado(cuota, recargoPct)) {
    return base * (1 + Number(recargoPct))
  }
  return base
}

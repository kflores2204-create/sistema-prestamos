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

/**
 * ============================================================
 * Recargo segun la FECHA REAL DE PAGO (no segun "hoy").
 * ============================================================
 * Caso real: el cliente paga el dia que le toca (a tiempo), pero el pago se
 * registra en el sistema uno o dos dias despues. Si el recargo se calculara
 * con la fecha de HOY, ese cliente puntual quedaria marcado como atrasado y
 * se le cobraria un recargo que no le corresponde.
 *
 * Por eso el recargo se decide comparando el VENCIMIENTO contra la FECHA EN
 * QUE EL CLIENTE REALMENTE PAGO, no contra la fecha en que se registra.
 */

/** True si el pago llego DESPUES del vencimiento (comparacion por texto YYYY-MM-DD, sin Date). */
export function atrasadaAlPagar(cuota, fechaPago) {
  const venc = String(cuota.fecha_vencimiento).slice(0, 10)
  const pago = String(fechaPago || hoyISO()).slice(0, 10)
  return venc < pago
}

/** Dias de atraso entre el vencimiento y la fecha real de pago (0 si llego a tiempo). */
export function diasAtraso(cuota, fechaPago) {
  const venc = parseFechaLocal(cuota.fecha_vencimiento)
  const pago = parseFechaLocal(fechaPago || hoyISO())
  const dias = Math.round((pago - venc) / 86400000)
  return dias > 0 ? dias : 0
}

/**
 * Recargo que le corresponde a la cuota si se paga en `fechaPago`.
 * Devuelve 0 si el cliente pago a tiempo o si el prestamo no tiene recargo.
 */
export function recargoPorPago(cuota, recargoPct, fechaPago) {
  if (!recargoPct) return 0
  if (!atrasadaAlPagar(cuota, fechaPago)) return 0
  return Number((Number(cuota.monto) * Number(recargoPct)).toFixed(2))
}

/** Formatea un timestamp ISO completo (con hora, ej. columna pagado_en) a "DD/MM/YYYY HH:mm". */
export function formatFechaHora(isoTimestamp) {
  if (!isoTimestamp) return ''
  const d = new Date(isoTimestamp)
  const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return `${fecha} ${hora}`
}

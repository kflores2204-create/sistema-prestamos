import { supabase } from './supabase'
import { hoyISO, estaAtrasada, montoConRecargo } from './prestamoUtils'

// Cache en memoria del id de la cuenta "Intereses" (evita una consulta extra en cada pago).
let cuentaInteresesId

async function obtenerCuentaInteresesId() {
  if (cuentaInteresesId !== undefined) return cuentaInteresesId
  const { data } = await supabase.from('cuentas').select('id').eq('nombre', 'Intereses').maybeSingle()
  cuentaInteresesId = data?.id || null
  return cuentaInteresesId
}

/**
 * Cambia el estado de una cuota (Pendiente <-> Pagado), registrando:
 *  - fecha_pago: la fecha (solo dia) del pago, para reportes que agrupan por dia
 *  - pagado_en: el instante EXACTO (fecha + hora) en que se hizo el cambio
 *  - pagado_por: el email del usuario que hizo el cambio
 *  - monto_recargo: el recargo por atraso, calculado UNA sola vez y congelado
 *
 * Regla de negocio: todo recargo por atraso cobrado, sin excepcion, se
 * registra como un ingreso en la cuenta "Intereses" (via movimientos_caja),
 * sin importar de que cuenta es el prestamo original. Si se revierte el pago
 * a Pendiente, ese ingreso se elimina para no dejar el flujo de caja inflado.
 *
 * @param cuota fila de la tabla cuotas (necesita id, monto, estado, fecha_vencimiento)
 * @param nuevoEstado 'Pagado' | 'Pendiente'
 * @param recargoPct recargo_pct del prestamo (numero, ej. 0.05)
 * @param contextoDetalle texto para el detalle del movimiento en Intereses (ej. "PR-BBVA-0008 - Juan Perez")
 * @returns la fila de cuotas actualizada
 */
export async function cambiarEstadoCuotaConAuditoria(cuota, nuevoEstado, recargoPct, contextoDetalle = '') {
  if (nuevoEstado === 'Pagado') {
    const montoRecargo = estaAtrasada(cuota) && recargoPct
      ? Number((montoConRecargo(cuota, recargoPct) - Number(cuota.monto)).toFixed(2))
      : 0

    const { data: userData } = await supabase.auth.getUser()

    let movimientoId = null
    if (montoRecargo > 0) {
      const cuentaId = await obtenerCuentaInteresesId()
      if (cuentaId) {
        const { data: mov } = await supabase.from('movimientos_caja').insert({
          cuenta_id: cuentaId,
          fecha: hoyISO(),
          monto: montoRecargo,
          detalle: `Recargo por atraso${contextoDetalle ? ' - ' + contextoDetalle : ''}`,
        }).select().single()
        movimientoId = mov?.id || null
      }
    }

    const { data: updated, error } = await supabase
      .from('cuotas')
      .update({
        estado: 'Pagado',
        fecha_pago: hoyISO(),
        pagado_en: new Date().toISOString(),
        pagado_por: userData?.user?.email || null,
        monto_recargo: montoRecargo,
        movimiento_recargo_id: movimientoId,
      })
      .eq('id', cuota.id).select().single()
    if (error) throw error
    return updated
  }

  // Revertir a Pendiente: si habia un movimiento de recargo asociado, lo borramos primero.
  if (cuota.movimiento_recargo_id) {
    await supabase.from('movimientos_caja').delete().eq('id', cuota.movimiento_recargo_id)
  }
  const { data: updated, error } = await supabase
    .from('cuotas')
    .update({
      estado: nuevoEstado, fecha_pago: null, pagado_en: null, pagado_por: null,
      monto_recargo: 0, movimiento_recargo_id: null,
    })
    .eq('id', cuota.id).select().single()
  if (error) throw error
  return updated
}

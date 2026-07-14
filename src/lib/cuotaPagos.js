import { supabase } from './supabase'
import { hoyISO, recargoPorPago } from './prestamoUtils'

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
 *  - fecha_pago: la fecha REAL en que el cliente pago (no la fecha en que se registra)
 *  - pagado_en: el instante EXACTO en que se hizo el cambio en el sistema (auditoria)
 *  - pagado_por: el email del usuario que hizo el cambio
 *  - monto_recargo: el recargo por atraso, calculado UNA sola vez y congelado
 *
 * POR QUE fecha_pago IMPORTA TANTO:
 * El saldo de cada cuenta (v_saldo_cuentas) solo cuenta como "cobro nuevo" las
 * cuotas con fecha_pago >= fecha_saldo_inicial (la fecha de corte de la cuenta).
 * Si a una cuota pagada ANTES del corte se le pone la fecha de hoy, ese dinero
 * se cuenta DOS veces (una dentro del saldo inicial y otra como cobro nuevo) y
 * el saldo se infla. Por eso siempre se guarda la fecha real del pago.
 *
 * EL RECARGO SE DECIDE CON LA FECHA REAL DE PAGO:
 * Si el cliente pago el dia que le tocaba pero el pago se registra dos dias
 * despues, NO hay recargo. El atraso se mide contra la fecha en que pago, no
 * contra la fecha en que se registra. Igual se puede forzar el recargo (o
 * quitarlo) manualmente con `aplicarRecargo`, para los casos excepcionales.
 *
 * Regla de negocio: todo recargo cobrado se registra como ingreso en la cuenta
 * "Intereses" (via movimientos_caja), sin importar de que cuenta es el prestamo.
 * Si se revierte el pago a Pendiente, ese ingreso se elimina para no dejar el
 * flujo de caja inflado.
 *
 * @param cuota fila de cuotas (necesita id, monto, estado, fecha_vencimiento)
 * @param nuevoEstado 'Pagado' | 'Pendiente'
 * @param recargoPct recargo_pct del prestamo (numero, ej. 0.05)
 * @param contextoDetalle texto para el detalle del movimiento (ej. "PR-BBVA-0008 - Juan Perez")
 * @param opciones { fechaPago?: 'YYYY-MM-DD', aplicarRecargo?: boolean }
 *        fechaPago      -> por defecto hoy. Poner la fecha REAL en que pago el cliente.
 *        aplicarRecargo -> por defecto se decide solo (true si pago despues del
 *                          vencimiento). Solo mandarlo para forzar o perdonar el recargo.
 * @returns la fila de cuotas actualizada
 */
export async function cambiarEstadoCuotaConAuditoria(
  cuota, nuevoEstado, recargoPct, contextoDetalle = '', opciones = {},
) {
  if (nuevoEstado === 'Pagado') {
    const fechaPago = opciones.fechaPago || hoyISO()

    // Recargo sugerido segun la fecha real de pago (0 si pago a tiempo).
    const recargoSugerido = recargoPorPago(cuota, recargoPct, fechaPago)
    // Si no se especifica nada, se respeta la sugerencia. Si se especifica,
    // manda la decision manual (perdonar un recargo, o cobrarlo igual).
    const aplicar = opciones.aplicarRecargo === undefined
      ? recargoSugerido > 0
      : Boolean(opciones.aplicarRecargo)

    const montoRecargo = aplicar && recargoPct
      ? Number((Number(cuota.monto) * Number(recargoPct)).toFixed(2))
      : 0

    const { data: userData } = await supabase.auth.getUser()

    // Si esta cuota ya tenia un movimiento de recargo de un intento anterior,
    // lo eliminamos antes de crear el nuevo (evita recargos duplicados en Intereses).
    if (cuota.movimiento_recargo_id) {
      await supabase.from('movimientos_caja').delete().eq('id', cuota.movimiento_recargo_id)
    }

    let movimientoId = null
    if (montoRecargo > 0) {
      const cuentaId = await obtenerCuentaInteresesId()
      if (cuentaId) {
        const { data: mov } = await supabase.from('movimientos_caja').insert({
          cuenta_id: cuentaId,
          // el ingreso del recargo se fecha el dia REAL del pago, no el dia del registro
          fecha: fechaPago,
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
        fecha_pago: fechaPago,
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

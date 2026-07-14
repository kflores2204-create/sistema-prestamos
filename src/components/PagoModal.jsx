import { useState } from 'react'
import Modal from './Modal'
import FechaInput from './FechaInput'
import { hoyISO, formatFecha, recargoPorPago, diasAtraso, atrasadaAlPagar } from '../lib/prestamoUtils'

const money = (n) => `S/. ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

/**
 * Ventana para registrar el pago de una cuota.
 *
 * Existe por un caso real: el cliente paga el dia que le toca, pero el pago se
 * registra uno o dos dias despues (por ejemplo, cuando el aviso del yape llega
 * al dia siguiente). Antes, para no cobrarle un recargo injusto habia que EDITAR
 * el prestamo y quitarle el recargo — una maniobra peligrosa que regeneraba las
 * cuotas y borraba pagos anteriores.
 *
 * Ahora simplemente se indica la FECHA REAL en que el cliente pago:
 *  - Si pago a tiempo, no se le aplica recargo (aunque se registre despues).
 *  - Si pago tarde, el recargo se calcula y se puede confirmar o perdonar.
 *  - La fecha real tambien mantiene sano el saldo de la cuenta (el saldo cuenta
 *    los cobros por su fecha de pago, no por la fecha de registro).
 *
 * Props:
 *  cuota: fila de cuotas (necesita monto, fecha_vencimiento)
 *  recargoPct: recargo_pct del prestamo (ej. 0.05) o null si no tiene
 *  titulo: texto opcional para el subtitulo (ej. "PR-CAJA-0097 - Enrique")
 *  onClose: () => void
 *  onConfirmar: ({ fechaPago, aplicarRecargo }) => Promise<void>
 */
export default function PagoModal({ cuota, recargoPct, titulo, onClose, onConfirmar }) {
  const [fechaPago, setFechaPago] = useState(hoyISO())
  // null = seguir la sugerencia automatica; true/false = decision manual del usuario
  const [override, setOverride] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const recargoSugerido = recargoPorPago(cuota, recargoPct, fechaPago)
  const llegoTarde = atrasadaAlPagar(cuota, fechaPago)
  const dias = diasAtraso(cuota, fechaPago)

  const aplicarRecargo = override === null ? recargoSugerido > 0 : override
  const montoRecargo = aplicarRecargo && recargoPct
    ? Number((Number(cuota.monto) * Number(recargoPct)).toFixed(2))
    : 0
  const total = Number(cuota.monto) + montoRecargo

  // Al cambiar la fecha volvemos a la sugerencia automatica (si el usuario
  // corrige la fecha, lo logico es recalcular el recargo desde cero).
  function cambiarFecha(v) {
    setFechaPago(v)
    setOverride(null)
  }

  async function confirmar() {
    setGuardando(true)
    try {
      await onConfirmar({ fechaPago, aplicarRecargo })
    } catch (err) {
      alert('Error al registrar el pago: ' + err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Registrar pago" subtitle={titulo} onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          Cuota de <b style={{ color: 'var(--navy)' }}>{money(cuota.monto)}</b>
          {' '}&middot; vence el <b style={{ color: 'var(--navy)' }}>{formatFecha(cuota.fecha_vencimiento)}</b>
        </div>

        <label>Fecha en que pago el cliente
          <FechaInput value={fechaPago} onChange={cambiarFecha} />
        </label>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-6px 0 0' }}>
          Si el cliente pago a tiempo pero recien lo registras hoy, pone aqui la fecha
          real en que pago: asi no se le cobra un recargo que no le corresponde.
        </p>

        {recargoPct ? (
          <div className="historico-card" style={{ padding: 12 }}>
            {llegoTarde ? (
              <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>
                Pago con <b>{dias} {dias === 1 ? 'dia' : 'dias'}</b> de atraso.
                Le corresponde recargo del {(Number(recargoPct) * 100).toFixed(0)}%.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--green)', marginBottom: 8 }}>
                Pago a tiempo. No le corresponde recargo.
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={aplicarRecargo}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Cobrar recargo del {(Number(recargoPct) * 100).toFixed(0)}%
              {montoRecargo > 0 ? ` (${money(montoRecargo)})` : ''}
            </label>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Este prestamo no tiene recargo por atraso configurado.
          </div>
        )}

        <div className="historico-linea historico-total" style={{ marginTop: 0 }}>
          <span>Total a cobrar</span>
          <b style={{ color: 'var(--navy)' }}>{money(total)}</b>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="button" onClick={confirmar} disabled={guardando}>
            {guardando ? 'Registrando...' : 'Registrar pago'}
          </button>
          <button className="btn secondary" type="button" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

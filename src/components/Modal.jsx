/**
 * Ventana flotante centrada (a diferencia de .drawer, que sale desde la
 * derecha). Usar para acciones puntuales y autocontenidas como crear un
 * cliente nuevo, donde no tiene sentido "empujar" el resto de la pantalla.
 */
export default function Modal({ title, subtitle, onClose, children, width = 480 }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, color: 'var(--navy)' }}>{title}</h3>
            {subtitle && <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>{subtitle}</p>}
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

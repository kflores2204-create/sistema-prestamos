import { Loader2 } from 'lucide-react'

export const TIPOS_DOCUMENTO = ['DNI', 'RUC', 'Pasaporte', 'Carne Extranjeria', 'Sin Documento']

const MAXLEN = { DNI: 8, RUC: 11, Pasaporte: 15, 'Carne Extranjeria': 15 }

/**
 * Selector de "Tipo de documento" + campo de numero adaptado (DNI 8 digitos,
 * RUC 11 digitos, Pasaporte/Carne libre, Sin Documento oculta el campo).
 * Reutilizable en cualquier formulario que registre una persona (cliente o aval).
 *
 * Props:
 *  tipo, numero: valores actuales
 *  onChangeTipo, onChangeNumero: (string) => void
 *  onBlurNumero: (valorLimpio) => void  (opcional, para autocompletar por DNI/RUC)
 *  required: boolean
 *  buscando: boolean (muestra un spinner mientras se autocompleta)
 */
export default function TipoDocumentoInput({ tipo, numero, onChangeTipo, onChangeNumero, onBlurNumero, required, buscando }) {
  const sinDocumento = tipo === 'Sin Documento'

  function cambiarTipo(nuevoTipo) {
    onChangeTipo(nuevoTipo)
    if (nuevoTipo === 'Sin Documento') onChangeNumero('')
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <label style={{ width: 170, flexShrink: 0 }}>Tipo de documento
        <select className="input" value={tipo} onChange={(e) => cambiarTipo(e.target.value)}>
          {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      {!sinDocumento && (
        <label style={{ flex: 1 }}>Numero de {tipo}
          <div style={{ position: 'relative' }}>
            <input
              className="input" value={numero} maxLength={MAXLEN[tipo]} required={required}
              onChange={(e) => onChangeNumero(e.target.value)}
              onBlur={onBlurNumero ? (e) => onBlurNumero(e.target.value.trim()) : undefined}
            />
            {buscando && (
              <Loader2 size={16} className="spin" style={{ position: 'absolute', right: 10, top: 12, color: 'var(--muted)' }} />
            )}
          </div>
        </label>
      )}
    </div>
  )
}

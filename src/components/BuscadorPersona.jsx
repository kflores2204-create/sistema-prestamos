import { useState } from 'react'
import { Plus } from 'lucide-react'
import ClienteModalCrear from './ClienteModalCrear'

/**
 * Buscador de cliente (persona): UN SOLO campo de busqueda que se reutiliza
 * tanto para BUSCAR como para CREAR (igual que el sistema de referencia: no
 * hay boton "crear cliente" aparte). Al escribir un nombre o un documento:
 *   - Aparece SIEMPRE como primera opcion "Crear cliente ..." (incluso con un
 *     solo caracter o un espacio), y debajo las coincidencias existentes.
 *   - Si lo escrito es un numero, la opcion Crear lo trata como DOCUMENTO;
 *     si es texto, como NOMBRE. El modal recibe ese valor y lo enruta al
 *     campo correcto (numero de DNI/RUC vs. Nombres), autocompletando por
 *     RENIEC/SUNAT cuando aplica.
 *
 * Este es el UNICO tipo de campo que debe usarse cuando la accion es "elegir
 * o crear un cliente" (a diferencia de los buscadores de LISTA como en
 * Prestamos/Clientes/Cronograma/Dashboard, que solo filtran una tabla).
 *
 * Props:
 *  label: string
 *  dni, nombre, tipoDocumento: valores actuales de la persona seleccionada
 *  onChangeDni, onChangeNombre, onChangeTipoDocumento: (string) => void
 *  personas: [{ id, dni, nombre, tipo_documento }]  -> lista completa para autocompletar
 *  required: boolean
 */
export default function BuscadorPersona({
  label, dni, nombre, tipoDocumento, onChangeDni, onChangeNombre, onChangeTipoDocumento, personas, required,
}) {
  const [query, setQuery] = useState(nombre || '')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)

  const q = query.trim()
  // Si lo escrito son solo digitos, la opcion Crear lo tratara como documento.
  const esNumero = /^\d+$/.test(q)

  // Las coincidencias se buscan a partir de 2 caracteres (para no listar todo),
  // pero la opcion "Crear" aparece con cualquier contenido, incluso un espacio.
  const sugerencias = q.length >= 2
    ? personas.filter((p) =>
        (p.dni || '').includes(q) || p.nombre.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 6)
    : []

  // Se abre el desplegable en cuanto el campo tiene ALGO escrito (un espacio
  // basta), igual que el sistema de referencia.
  const mostrarDropdown = abierto && query.length >= 1

  function elegir(p) {
    onChangeDni(p.dni || '')
    onChangeNombre(p.nombre)
    onChangeTipoDocumento?.(p.tipo_documento || 'DNI')
    setQuery(p.nombre)
    setAbierto(false)
  }

  function onCreado(cliente) {
    onChangeDni(cliente.dni || '')
    onChangeNombre(cliente.nombre)
    onChangeTipoDocumento?.(cliente.tipo_documento || 'DNI')
    setQuery(cliente.nombre)
    setCreando(false)
  }

  return (
    <div className="buscador-persona-wrap">
      <div className="buscador-persona">
        <label>{label}
          <input
            className="input" placeholder="Busca por nombre o documento..." value={query} required={required && !nombre}
            onChange={(e) => { setQuery(e.target.value); setAbierto(true); if (nombre) { onChangeNombre(''); onChangeDni('') } }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
          />
        </label>
        {mostrarDropdown && (
          <div className="autocomplete-dropdown">
            <div className="autocomplete-crear" onMouseDown={() => setCreando(true)}>
              <Plus size={14} strokeWidth={2.6} />
              {q.length === 0
                ? <>Crear cliente nuevo</>
                : esNumero
                  ? <>Crear cliente con documento "{q}"</>
                  : <>Crear cliente nuevo: "{q}"</>}
            </div>
            {sugerencias.map((p) => (
              <div key={p.id} className="autocomplete-item" onMouseDown={() => elegir(p)}>
                <span className="autocomplete-dni">{p.dni || 'S/N'}</span>
                <span>{p.nombre}</span>
              </div>
            ))}
            {q.length >= 2 && sugerencias.length === 0 && (
              <div className="autocomplete-item" style={{ color: 'var(--muted)', cursor: 'default' }}>
                Sin resultados
              </div>
            )}
          </div>
        )}
      </div>

      {creando && (
        <ClienteModalCrear nombreInicial={q} onClose={() => setCreando(false)} onCreado={onCreado} />
      )}
    </div>
  )
}

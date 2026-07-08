import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const EmpresaContext = createContext(null)

/**
 * Provee la lista de empresas a las que pertenece el usuario logueado, y cual
 * es la "empresa actual" (la que se usa para filtrar todo lo que se ve en
 * pantalla). Hoy por hoy todos los usuarios pertenecen a una sola empresa
 * (Confianza Prestamos), asi que se selecciona sola sin pedirle nada al
 * usuario. El dia que un usuario (vos, como dueño del software) pertenezca a
 * mas de una empresa, esto ya esta listo para mostrar un selector.
 *
 * IMPORTANTE: este provider todavia NO se usa para filtrar ninguna consulta
 * en el resto del sistema (eso es la Fase B). Por ahora solo expone los datos
 * para que podamos empezar a probarlo sin riesgo.
 */
export function EmpresaProvider({ children }) {
  const [empresas, setEmpresas] = useState([])
  const [empresaActual, setEmpresaActual] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setEmpresas([])
      setEmpresaActual(null)
      setCargando(false)
      return
    }
    const { data, error } = await supabase
      .from('usuarios_empresas')
      .select('rol, empresas (id, nombre, slug, modo, logo_url)')
      .eq('usuario_id', user.id)

    if (error) {
      // Si la tabla todavia no existe (por ejemplo, no se corrio la migracion),
      // no rompemos el resto del sistema: simplemente no hay empresa actual.
      console.warn('EmpresaProvider: no se pudo cargar usuarios_empresas', error.message)
      setEmpresas([])
      setEmpresaActual(null)
      setCargando(false)
      return
    }

    const propias = (data || [])
      .filter((r) => r.empresas)
      .map((r) => ({ ...r.empresas, rol: r.rol }))
    setEmpresas(propias)

    const guardadaId = localStorage.getItem('empresa_actual_id')
    const inicial = propias.find((e) => e.id === guardadaId) || propias[0] || null
    setEmpresaActual(inicial)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function cambiarEmpresa(empresaId) {
    const e = empresas.find((x) => x.id === empresaId)
    if (e) {
      setEmpresaActual(e)
      localStorage.setItem('empresa_actual_id', empresaId)
    }
  }

  return (
    <EmpresaContext.Provider value={{ empresas, empresaActual, cambiarEmpresa, cargando, recargar: cargar }}>
      {children}
    </EmpresaContext.Provider>
  )
}

/** Hook para leer la empresa actual y la lista de empresas desde cualquier componente. */
export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa() debe usarse dentro de <EmpresaProvider>')
  return ctx
}

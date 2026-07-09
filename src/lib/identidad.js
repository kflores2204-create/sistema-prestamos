import { getAccessToken } from './supabase'

/**
 * Busca el nombre completo asociado a un DNI (via RENIEC/Decolecta, con
 * nuestro backend como intermediario para no exponer el token).
 * Devuelve el nombre completo (string) o null si no se encontro nada.
 * Lanza un error si la peticion falla (red, autorizacion, etc.).
 */
export async function buscarNombrePorDni(dni) {
  const token = await getAccessToken()
  const res = await fetch(`/api/consulta-dni?dni=${encodeURIComponent(dni)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error consultando el DNI')
  return data.nombre_completo || null
}

/** Igual que buscarNombrePorDni, pero para RUC (empresas). */
export async function buscarRazonSocialPorRuc(ruc) {
  const token = await getAccessToken()
  const res = await fetch(`/api/consulta-ruc?ruc=${encodeURIComponent(ruc)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error consultando el RUC')
  return data
}

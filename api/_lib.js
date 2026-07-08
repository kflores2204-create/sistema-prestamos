import { createClient } from '@supabase/supabase-js'

// Cliente con permisos de administrador (service role). SOLO se usa en el servidor,
// nunca se expone al navegador. La SUPABASE_SERVICE_ROLE_KEY vive como variable de
// entorno en Vercel (Project Settings -> Environment Variables), no en el repo.
export function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Lista de correos autorizados a administrar el equipo (crear/quitar accesos).
// Configurable via variable de entorno ADMIN_EMAILS (separados por coma).
// Si no se configura, no autoriza a nadie (falla cerrado, mas seguro).
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Verifica que la peticion venga de un usuario logueado valido (cualquier
 * miembro del equipo, no necesariamente admin). Util para endpoints que no
 * son de administracion, como la consulta de RUC.
 */
export async function verificarUsuario(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null

  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

/**
 * Verifica el token del usuario que hace la peticion y confirma que es un admin autorizado.
 * Devuelve el usuario si es valido, o null si no.
 */
export async function verificarAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null

  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null

  const email = (data.user.email || '').toLowerCase()
  if (!adminEmails().includes(email)) return null

  return data.user
}

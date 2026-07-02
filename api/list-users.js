import { adminClient, verificarAdmin } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' })

  const admin = await verificarAdmin(req)
  if (!admin) return res.status(403).json({ error: 'No autorizado' })

  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (error) return res.status(400).json({ error: error.message })

  const usuarios = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.user_metadata?.full_name || u.user_metadata?.name || '—',
    dni: u.user_metadata?.dni || null,
    proveedor: u.app_metadata?.provider || 'email',
    creado: u.created_at,
    ultimo_acceso: u.last_sign_in_at,
  }))

  res.status(200).json({ usuarios })
}

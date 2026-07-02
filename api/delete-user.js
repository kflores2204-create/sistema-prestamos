import { adminClient, verificarAdmin } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' })

  const admin = await verificarAdmin(req)
  if (!admin) return res.status(403).json({ error: 'No autorizado' })

  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'Falta userId' })
  if (userId === admin.id) return res.status(400).json({ error: 'No podes quitarte el acceso a vos mismo' })

  const supabase = adminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return res.status(400).json({ error: error.message })

  res.status(200).json({ ok: true })
}

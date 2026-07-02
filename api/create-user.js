import { adminClient, verificarAdmin } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' })

  const admin = await verificarAdmin(req)
  if (!admin) return res.status(403).json({ error: 'No autorizado' })

  const { email, password, nombre, dni } = req.body || {}
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Faltan datos: email, password y nombre son obligatorios' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
  }

  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no requiere que confirme el correo, puede entrar de inmediato
    user_metadata: { full_name: nombre, dni: dni || null, creado_por: admin.email },
  })

  if (error) return res.status(400).json({ error: error.message })

  res.status(200).json({
    user: { id: data.user.id, email: data.user.email, nombre, dni: dni || null },
  })
}

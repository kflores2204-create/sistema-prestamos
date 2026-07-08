import { verificarUsuario } from './_lib.js'

// Consulta de RUC (dato publico de registro comercial, sin restricciones de
// proteccion de datos personales, a diferencia del DNI). Usa Decolecta como
// proveedor: https://decolecta.com/services/2-api-sunat-consulta-ruc.html
//
// Requiere la variable de entorno DECOLECTA_TOKEN en Vercel (Project Settings
// -> Environment Variables). El token NUNCA se expone al navegador: esta
// funcion corre en el servidor y actua de intermediario.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' })

  const usuario = await verificarUsuario(req)
  if (!usuario) return res.status(403).json({ error: 'No autorizado' })

  const ruc = String(req.query.ruc || '').trim()
  if (!/^\d{11}$/.test(ruc)) {
    return res.status(400).json({ error: 'El RUC debe tener 11 digitos' })
  }

  const token = process.env.DECOLECTA_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'Falta configurar DECOLECTA_TOKEN en las variables de entorno del servidor' })
  }

  try {
    const r = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${ruc}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      const texto = await r.text()
      return res.status(r.status).json({ error: 'El proveedor de datos respondio con un error', detalle: texto })
    }
    const data = await r.json()
    res.status(200).json({
      ruc,
      razon_social: data.razon_social || data.nombre_o_razon_social || data.nombre || null,
      direccion: data.direccion || null,
      estado: data.estado || null,
      condicion: data.condicion || null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Error consultando el RUC: ' + err.message })
  }
}

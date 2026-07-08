import { verificarUsuario } from './_lib.js'

// Consulta de DNI via Decolecta (RENIEC): https://api.decolecta.com/v1/reniec/dni
//
// OJO: Decolecta marca en su pagina de marketing que este servicio "ya no se
// ofrece de forma publica" por la normativa de proteccion de datos, pero su
// documentacion tecnica sigue publicando el endpoint completo. Si esta
// funcion empieza a devolver error 401/403/404 de forma consistente, es
// senal de que el acceso se cerro de verdad y hay que migrar a otro
// proveedor (apiperu.dev, Factiliza).
//
// Requiere la misma variable de entorno DECOLECTA_TOKEN que consulta-ruc.js.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo no permitido' })

  const usuario = await verificarUsuario(req)
  if (!usuario) return res.status(403).json({ error: 'No autorizado' })

  const dni = String(req.query.dni || '').trim()
  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'El DNI debe tener 8 digitos' })
  }

  const token = process.env.DECOLECTA_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'Falta configurar DECOLECTA_TOKEN en las variables de entorno del servidor' })
  }

  try {
    const r = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      const texto = await r.text()
      return res.status(r.status).json({ error: 'El proveedor de datos respondio con un error', detalle: texto })
    }
    const data = await r.json()
    res.status(200).json({
      dni,
      nombre_completo: data.full_name || null,
      nombres: data.first_name || null,
      apellido_paterno: data.first_last_name || null,
      apellido_materno: data.second_last_name || null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Error consultando el DNI: ' + err.message })
  }
}

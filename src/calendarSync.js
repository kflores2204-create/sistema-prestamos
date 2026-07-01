/**
 * Sincroniza las cuotas pendientes con Google Calendar, usando el access
 * token de Google que Supabase guarda tras el login (scope calendar.events).
 *
 * Misma logica que el script de Apps Script: un evento por cuota pendiente,
 * de color segun cuan cerca este de vencer, y se borra cuando se marca
 * como Pagado.
 */
import { supabase } from './supabase'

const CALENDAR_SUMMARY = 'Cobros - Prestamos'
const COLOR = { ATRASADO: '11', PRONTO: '5', FUTURO: '9' } // ids de color de Google Calendar

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.provider_token) {
    throw new Error('No hay token de Google. Vuelve a iniciar sesion.')
  }
  return session.provider_token
}

async function gcal(path, token, opts = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
  })
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function getOrCreateCalendarId(token) {
  const list = await gcal('users/me/calendarList', token)
  const existing = list.items?.find((c) => c.summary === CALENDAR_SUMMARY)
  if (existing) return existing.id
  const created = await gcal('calendars', token, {
    method: 'POST',
    body: JSON.stringify({ summary: CALENDAR_SUMMARY }),
  })
  return created.id
}

function colorFor(fecha) {
  const dias = Math.floor((new Date(fecha) - new Date()) / 86400000)
  if (dias < 0) return COLOR.ATRASADO
  if (dias <= 3) return COLOR.PRONTO
  return COLOR.FUTURO
}

/** Sincroniza una cuota puntual (llamar al marcar Pagado/Pendiente). */
export async function syncCuota(cuota, prestamo) {
  const token = await getAccessToken()
  const calendarId = await getOrCreateCalendarId(token)

  if (cuota.estado === 'Pagado') {
    if (cuota.calendar_event_id) {
      await gcal(`calendars/${calendarId}/events/${cuota.calendar_event_id}`, token, { method: 'DELETE' }).catch(() => {})
      await supabase.from('cuotas').update({ calendar_event_id: null }).eq('id', cuota.id)
    }
    return
  }

  const body = {
    summary: `Cobrar S/ ${cuota.monto} - ${prestamo.cliente_nombre} (${prestamo.cuenta_nombre})`,
    description: `Cuota ${cuota.numero_cuota} de ${prestamo.num_cuotas} - Prestamo ${prestamo.codigo}`,
    start: { date: cuota.fecha_vencimiento },
    end: { date: cuota.fecha_vencimiento },
    colorId: colorFor(cuota.fecha_vencimiento),
  }

  if (cuota.calendar_event_id) {
    await gcal(`calendars/${calendarId}/events/${cuota.calendar_event_id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  } else {
    const created = await gcal(`calendars/${calendarId}/events`, token, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    await supabase.from('cuotas').update({ calendar_event_id: created.id }).eq('id', cuota.id)
  }
}

/** Sincroniza TODAS las cuotas pendientes/atrasadas de una vez. */
export async function syncTodo() {
  const { data: cuotas, error } = await supabase
    .from('cuotas')
    .select('*, prestamos(codigo, num_cuotas, cliente:clientes(nombre), cuenta:cuentas(nombre))')
  if (error) throw error

  for (const c of cuotas) {
    const prestamo = {
      codigo: c.prestamos.codigo,
      num_cuotas: c.prestamos.num_cuotas,
      cliente_nombre: c.prestamos.cliente.nombre,
      cuenta_nombre: c.prestamos.cuenta.nombre,
    }
    await syncCuota(c, prestamo)
  }
}

/**
 * Sincroniza las cuotas pendientes con Google Calendar, usando el access
 * token de Google que Supabase guarda tras el login (scope calendar.events).
 *
 * Misma logica que el script de Apps Script: un evento por cuota pendiente,
 * de color segun cuan cerca este de vencer, y se borra cuando se marca
 * como Pagado.
 */
import { supabase } from './supabase'
import { montoConRecargo, tieneRecargoAplicado } from './prestamoUtils'

const CALENDAR_SUMMARY = 'Cobros - Prestamos'
const COLOR = { ATRASADO: '11', PRONTO: '5', FUTURO: '9' } // ids de color de Google Calendar

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.provider_token) {
    throw new Error(
      'No hay una sesion activa de Google Calendar. Cierra sesion y vuelve a entrar con ' +
      'el boton "Entrar con Google" para reactivar la sincronizacion.'
    )
  }
  return session.provider_token
}

async function gcal(path, token, opts = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
  })
  if (res.status === 401) {
    throw new Error(
      'Tu sesion de Google Calendar expiro (esto pasa despues de 1 hora). ' +
      'Cierra sesion y vuelve a entrar con Google para reactivar la sincronizacion.'
    )
  }
  if (res.status === 403) {
    throw new Error(
      'Google Calendar rechazo el permiso (403). Revisa que hayas aceptado el acceso a ' +
      'Calendar al iniciar sesion, y que la Google Calendar API este habilitada en tu proyecto de Google Cloud.'
    )
  }
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
  // el calendario nuevo no aparece solo en la lista de calendarios visibles del usuario;
  // hay que insertarlo explicitamente en la calendarList para que se vea en Google Calendar
  await gcal('users/me/calendarList', token, {
    method: 'POST',
    body: JSON.stringify({ id: created.id }),
  }).catch(() => {}) // si ya esta suscrito, esto puede fallar con 409, lo ignoramos
  return created.id
}

function colorFor(fecha) {
  const dias = Math.floor((new Date(fecha) - new Date()) / 86400000)
  if (dias < 0) return COLOR.ATRASADO
  if (dias <= 3) return COLOR.PRONTO
  return COLOR.FUTURO
}

/** Busca en Google Calendar los eventos ya asociados a esta cuota (via extendedProperties),
 *  sin importar lo que diga el ID guardado localmente. Esto es lo que hace que la sincronizacion
 *  sea idempotente: no importa si el dato local quedo desactualizado (por ejemplo porque otra
 *  persona sincronizo desde su propia cuenta, o porque hubo dos sincronizaciones superpuestas),
 *  siempre se reconcilia contra lo que realmente existe en el calendario. */
async function buscarEventosDeCuota(calendarId, token, cuotaId) {
  const params = new URLSearchParams({
    privateExtendedProperty: `cuota_id=${cuotaId}`,
    showDeleted: 'false',
    singleEvents: 'true',
  })
  const res = await gcal(`calendars/${calendarId}/events?${params.toString()}`, token)
  return res.items || []
}

/**
 * Limpieza unica: borra los eventos que hayan quedado de sincronizaciones anteriores al
 * arreglo (antes de que cada evento llevara su etiqueta interna de identificacion). No
 * comparamos texto porque si el nombre del cliente cambio despues, el texto viejo ya no
 * coincide con nada y quedaria huerfano para siempre. En cambio: de ahora en mas, todo
 * evento legitimo SIEMPRE va a tener la etiqueta interna (cuota_id). Cualquier evento sin
 * esa etiqueta es, por definicion, basura de antes del arreglo, y se borra directamente.
 * Se puede correr las veces que haga falta sin riesgo: si no hay basura vieja, no borra nada.
 */
export async function limpiarDuplicados() {
  const token = await getAccessToken()
  const calendarId = await getOrCreateCalendarId(token)

  const desde = new Date(); desde.setFullYear(desde.getFullYear() - 1)
  const hasta = new Date(); hasta.setFullYear(hasta.getFullYear() + 1)

  let eventos = []
  let pageToken = null
  do {
    const params = new URLSearchParams({
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      showDeleted: 'false',
      singleEvents: 'true',
      maxResults: '2500',
      ...(pageToken ? { pageToken } : {}),
    })
    const res = await gcal(`calendars/${calendarId}/events?${params.toString()}`, token)
    eventos = eventos.concat(res.items || [])
    pageToken = res.nextPageToken || null
  } while (pageToken)

  let borrados = 0
  for (const ev of eventos) {
    if (ev.extendedProperties?.private?.cuota_id) continue // evento legitimo, se deja
    await gcal(`calendars/${calendarId}/events/${ev.id}`, token, { method: 'DELETE' }).catch(() => {})
    borrados++
  }
  return borrados
}

/** Sincroniza una cuota puntual (llamar al marcar Pagado/Pendiente). */
export async function syncCuota(cuota, prestamo) {
  const token = await getAccessToken()
  const calendarId = await getOrCreateCalendarId(token)
  const existentes = await buscarEventosDeCuota(calendarId, token, cuota.id)

  if (cuota.estado === 'Pagado') {
    // se borran todos los eventos encontrados (normalmente uno, pero si habia quedado
    // un duplicado de antes, esto limpia todos los que correspondan a esta cuota)
    for (const ev of existentes) {
      await gcal(`calendars/${calendarId}/events/${ev.id}`, token, { method: 'DELETE' }).catch(() => {})
    }
    if (cuota.calendar_event_id) {
      await supabase.from('cuotas').update({ calendar_event_id: null }).eq('id', cuota.id)
    }
    return
  }

  const montoAviso = montoConRecargo(cuota, prestamo.recargo_pct)
  const conRecargo = tieneRecargoAplicado(cuota, prestamo.recargo_pct)

  const body = {
    summary: conRecargo
      ? `Cobrar S/ ${montoAviso.toFixed(2)} (incluye recargo) - ${prestamo.cliente_nombre} (${prestamo.cuenta_nombre})`
      : `Cobrar S/ ${cuota.monto} - ${prestamo.cliente_nombre} (${prestamo.cuenta_nombre})`,
    description: conRecargo
      ? `Cuota ${cuota.numero_cuota} de ${prestamo.num_cuotas} - Prestamo ${prestamo.codigo}. ` +
        `Monto original S/ ${cuota.monto}, mas recargo por atraso del ${(prestamo.recargo_pct * 100).toFixed(0)}%.`
      : `Cuota ${cuota.numero_cuota} de ${prestamo.num_cuotas} - Prestamo ${prestamo.codigo}`,
    start: { date: cuota.fecha_vencimiento },
    end: { date: cuota.fecha_vencimiento },
    colorId: colorFor(cuota.fecha_vencimiento),
    extendedProperties: { private: { cuota_id: cuota.id } },
  }

  if (existentes.length > 0) {
    // actualizamos el primero que ya existe, y si habia quedado mas de uno duplicado
    // de una sincronizacion anterior con el bug, aprovechamos para borrar los sobrantes
    const [principal, ...duplicados] = existentes
    await gcal(`calendars/${calendarId}/events/${principal.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    for (const dup of duplicados) {
      await gcal(`calendars/${calendarId}/events/${dup.id}`, token, { method: 'DELETE' }).catch(() => {})
    }
    if (cuota.calendar_event_id !== principal.id) {
      await supabase.from('cuotas').update({ calendar_event_id: principal.id }).eq('id', cuota.id)
    }
  } else {
    const created = await gcal(`calendars/${calendarId}/events`, token, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    await supabase.from('cuotas').update({ calendar_event_id: created.id }).eq('id', cuota.id)
  }
}

/** Sincroniza TODAS las cuotas pendientes/atrasadas de una vez. Devuelve cuantas proceso.
 *  Antes de sincronizar, limpia en silencio cualquier duplicado que haya podido quedar de
 *  sincronizaciones anteriores (esto es automatico, no requiere ninguna accion del usuario). */
export async function syncTodo() {
  await limpiarDuplicados()

  const { data: cuotas, error } = await supabase
    .from('cuotas')
    .select('*, prestamos(codigo, num_cuotas, recargo_pct, cliente:clientes!prestamos_cliente_id_fkey(nombre), cuenta:cuentas(nombre))')
  if (error) throw error

  let procesadas = 0
  for (const c of cuotas) {
    if (!c.prestamos) continue
    const prestamo = {
      codigo: c.prestamos.codigo,
      num_cuotas: c.prestamos.num_cuotas,
      recargo_pct: c.prestamos.recargo_pct,
      cliente_nombre: c.prestamos.cliente?.nombre || 'Cliente',
      cuenta_nombre: c.prestamos.cuenta?.nombre || '',
    }
    await syncCuota(c, prestamo)
    procesadas++
  }
  return procesadas
}

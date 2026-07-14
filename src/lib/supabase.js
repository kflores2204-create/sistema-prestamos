import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
})

/**
 * Login con Google usando SOLO los scopes basicos (email y perfil), que Google
 * considera NO sensibles.
 *
 * Antes se pedia tambien 'https://www.googleapis.com/auth/calendar' para la
 * sincronizacion con Google Calendar. Ese es un scope SENSIBLE: cualquier app
 * que lo solicita y no ha pasado la verificacion de Google muestra la pantalla
 * de advertencia "Google no ha verificado esta aplicacion" antes de dejar
 * entrar. Como el control de cobros ahora se lleva dentro del sistema (pantalla
 * "Cobros del Dia"), ya no hace falta Calendar, y al no pedir scopes sensibles
 * la advertencia desaparece.
 *
 * Los queryParams (access_type: offline / prompt: consent) tampoco hacen falta:
 * existian para obtener el refresh token que necesitaba Calendar.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

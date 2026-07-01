import { signInWithGoogle } from '../lib/supabase'

export default function Login() {
  return (
    <div className="login-screen">
      <h1 style={{ color: 'var(--navy)' }}>Sistema de Prestamos</h1>
      <p style={{ color: 'var(--muted)' }}>Panel personal - acceso solo con tu cuenta de Google.</p>
      <button className="btn" onClick={signInWithGoogle}>Entrar con Google</button>
    </div>
  )
}

import { useState } from 'react'
import { signInWithGoogle, signInWithPassword } from '../lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

export default function Login() {
  const [modoCorreo, setModoCorreo] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrarConCorreo(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      setError('Correo o contraseña incorrectos.')
    }
    setCargando(false)
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-card">
          <img src="/logo-confianza-horizontal.png" alt="Confianza Prestamos" className="login-logo" />
          <p>Panel personal de gestion de prestamos.</p>

          {!modoCorreo ? (
            <>
              <button className="btn login-google-btn" onClick={signInWithGoogle}>
                <GoogleIcon /> Entrar con Google
              </button>
              <button className="login-switch" onClick={() => setModoCorreo(true)}>
                Entrar con correo y contraseña
              </button>
            </>
          ) : (
            <form onSubmit={entrarConCorreo} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>Correo
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>Contraseña
                <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
              <button className="btn" type="submit" disabled={cargando} style={{ justifyContent: 'center' }}>
                {cargando ? 'Ingresando...' : 'Ingresar'}
              </button>
              <button type="button" className="login-switch" onClick={() => setModoCorreo(false)}>
                Volver a entrar con Google
              </button>
            </form>
          )}
        </div>
        <a href="/privacidad" className="privacidad-link">Politica de privacidad</a>
      </div>
    </div>
  )
}

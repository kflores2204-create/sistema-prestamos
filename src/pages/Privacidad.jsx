import { Wallet } from 'lucide-react'

export default function Privacidad() {
  return (
    <div className="privacidad-screen">
      <div className="privacidad-card">
        <div className="privacidad-header">
          <div className="login-icon-fallback"><Wallet size={22} strokeWidth={2.2} /></div>
          <div>
            <h1>Politica de Privacidad</h1>
            <p className="privacidad-subtitle">Sistema de Prestamos - Confianza Prestamos</p>
          </div>
        </div>

        <p className="privacidad-fecha">Ultima actualizacion: {new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <p>
          Sistema de Prestamos ("el Sistema") es una herramienta de uso personal y privado, desarrollada
          para la gestion de un pequeno negocio de prestamos. No es un producto publico ni esta disponible
          para el publico en general: su acceso esta limitado exclusivamente al propietario del negocio y a
          un numero reducido de personas autorizadas por el (por ejemplo, familiares o colaboradores directos).
        </p>

        <h2>Que informacion recopilamos</h2>
        <p>Cuando iniciás sesion con tu cuenta de Google, accedemos unicamente a:</p>
        <ul>
          <li>Tu nombre, correo electronico y foto de perfil, para identificarte dentro del Sistema.</li>
          <li>
            Acceso a Google Calendar, con el unico fin de crear y actualizar recordatorios de las fechas de
            pago de los prestamos que vos mismo registras en el Sistema.
          </li>
        </ul>
        <p>
          Adicionalmente, el Sistema almacena la informacion que el usuario ingresa manualmente para operar
          el negocio: datos de clientes (nombre, DNI), montos y fechas de prestamos, cuotas y su estado de pago.
        </p>

        <h2>Como usamos esta informacion</h2>
        <p>
          Toda la informacion se utiliza exclusivamente para el funcionamiento del Sistema: mostrar el
          cronograma de pagos, calcular montos, y sincronizar recordatorios en el Google Calendar del propio
          usuario. No usamos esta informacion con fines publicitarios, de perfilamiento, ni la compartimos
          con terceros.
        </p>

        <h2>Donde se almacena</h2>
        <p>
          Los datos se almacenan en una base de datos privada (Supabase), protegida con reglas de acceso que
          restringen la visibilidad de la informacion unicamente a las cuentas autorizadas por el propietario
          del Sistema.
        </p>

        <h2>No compartimos tu informacion</h2>
        <p>
          No vendemos, alquilamos ni compartimos tu informacion personal ni la de tus clientes con terceros,
          salvo que la ley lo exija.
        </p>

        <h2>Eliminacion de datos</h2>
        <p>
          Si sos una persona con acceso al Sistema y queres que se elimine tu informacion, o si queres revocar
          el acceso otorgado a tu cuenta de Google, escribinos al correo de contacto abajo.
        </p>

        <h2>Contacto</h2>
        <p>
          Para consultas sobre esta politica de privacidad o sobre tus datos, escribinos a{' '}
          <a href="mailto:kflores.2204@gmail.com">kflores.2204@gmail.com</a>.
        </p>
      </div>
    </div>
  )
}

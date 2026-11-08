import { useState } from 'react'
import { login, registrar, textoError } from './api.ts'
import { guardarSesion, sesionDesdeToken, type Sesion } from './sesion.ts'
import { Aviso, Campo, CampoPassword, Icono } from './ui.tsx'

const BENEFICIOS = [
  'Guardás tu nombre y contacto una sola vez.',
  'Accedés a tu historial de reclamos desde cualquier dispositivo.',
  'Seguís el estado de cada reclamo que hagas, cuando quieras.',
]

export function FormularioCuenta({
  onListo,
  detalle,
}: {
  onListo: (sesion: Sesion) => void
  detalle: string
}) {
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function cambiarModo(nuevo: 'login' | 'registro') {
    setModo(nuevo)
    setError(null)
    setPassword2('')
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    if (modo === 'registro' && password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setOcupado(true)
    try {
      if (modo === 'registro') {
        await registrar(email.trim(), password)
      }
      const emitido = await login(email.trim(), password)
      const sesion = sesionDesdeToken(emitido.token, emitido.expira)
      guardarSesion(sesion)
      onListo(sesion)
    } catch (fallo) {
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="tarjeta formulario tarjeta-cuenta" onSubmit={(evento) => void enviar(evento)}>
      <div className="cuenta-encabezado">
        <span className="cuenta-icono">
          <Icono nombre={modo === 'login' ? 'vecinos' : 'nuevo'} />
        </span>
        <div>
          <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
          <p className="bajada">{detalle}</p>
        </div>
      </div>

      <div className="segmento segmento-ancho" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'login'}
          className={modo === 'login' ? 'activo' : ''}
          onClick={() => cambiarModo('login')}
        >
          Ya tengo cuenta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'registro'}
          className={modo === 'registro' ? 'activo' : ''}
          onClick={() => cambiarModo('registro')}
        >
          Registrarme
        </button>
      </div>

      {modo === 'registro' ? (
        <ul className="lista-beneficios">
          {BENEFICIOS.map((item) => (
            <li key={item}>
              <Icono nombre="nuevo" className="lista-beneficios__check" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <Campo etiqueta="Email" hint="Usá el mail con el que te registraste.">
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          placeholder="vecino@gmail.com"
        />
      </Campo>
      <CampoPassword
        etiqueta="Contraseña"
        hint="Mínimo 8 caracteres."
        required
        minLength={8}
        maxLength={72}
        autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
        value={password}
        onChange={setPassword}
      />
      {modo === 'registro' ? (
        <CampoPassword
          etiqueta="Repetir contraseña"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={password2}
          onChange={setPassword2}
        />
      ) : null}
      {error ? <Aviso tono="error">{error}</Aviso> : null}
      <button className="btn btn-primario" type="submit" disabled={ocupado}>
        {ocupado ? 'Entrando…' : modo === 'login' ? 'Entrar' : 'Registrarme y entrar'}
      </button>
    </form>
  )
}

import { useState } from 'react'
import { login, registrar, textoError } from './api.ts'
import { guardarSesion, sesionDesdeToken, type Sesion } from './sesion.ts'
import { Aviso, Campo } from './ui.tsx'

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
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
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
    <form className="tarjeta formulario" onSubmit={(evento) => void enviar(evento)}>
      <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
      <p className="bajada">{detalle}</p>
      <div className="segmento" role="tablist">
        <button
          type="button"
          className={modo === 'login' ? 'activo' : ''}
          onClick={() => setModo('login')}
        >
          Ya tengo cuenta
        </button>
        <button
          type="button"
          className={modo === 'registro' ? 'activo' : ''}
          onClick={() => setModo('registro')}
        >
          Registrarme
        </button>
      </div>
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
      <Campo etiqueta="Contraseña" hint="Mínimo 8 caracteres.">
        <input
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
      </Campo>
      {error ? <Aviso tono="error">{error}</Aviso> : null}
      <button className="btn btn-primario" type="submit" disabled={ocupado}>
        {ocupado ? 'Entrando…' : modo === 'login' ? 'Entrar' : 'Registrarme y entrar'}
      </button>
    </form>
  )
}

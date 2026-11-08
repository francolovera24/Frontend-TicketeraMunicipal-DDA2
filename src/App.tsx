import { useCallback, useEffect, useState } from 'react'
import { comprobarBackend } from './api.ts'
import { FormularioCuenta } from './cuenta.tsx'
import { borrarSesion, leerSesion, type Sesion } from './sesion.ts'
import { Campo, Icono, Panel } from './ui.tsx'
import { VistaMunicipal } from './views/Municipal.tsx'
import { VistaVecino } from './views/Vecino.tsx'

type Vista = 'vecino' | 'municipal'

function vistaDe(sesion: Sesion): Vista {
  return sesion.email.toLowerCase().endsWith('@admin.com') ? 'municipal' : 'vecino'
}

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const [backend, setBackend] = useState<'comprobando' | 'ok' | 'caido'>('comprobando')
  const [perfilAbierto, setPerfilAbierto] = useState(false)

  useEffect(() => {
    let cancelado = false
    const revisar = () => {
      void comprobarBackend().then((ok) => {
        if (!cancelado) setBackend(ok ? 'ok' : 'caido')
      })
    }
    revisar()
    const timer = window.setInterval(revisar, 15000)
    return () => {
      cancelado = true
      window.clearInterval(timer)
    }
  }, [])

  function entrar(nueva: Sesion) {
    setSesion(nueva)
  }

  const salir = useCallback(() => {
    borrarSesion()
    setSesion(null)
  }, [])

  const vista: Vista | null = sesion ? vistaDe(sesion) : null

  return (
    <div className="pagina" data-vista={vista ?? 'cuenta'}>
      <header className="barra">
        <div>
          <p className="marca">Ticketera municipal</p>
          <p className="bajada marca-sub">Gestión de reclamos de infraestructura urbana</p>
        </div>
        <div className="sesion">
          {sesion ? (
            <>
              <button type="button" className="btn btn-secundario" onClick={() => setPerfilAbierto(true)}>
                <Icono nombre="vecinos" /> Mi perfil
              </button>
              <button type="button" className="btn btn-secundario" onClick={salir}>
                <Icono nombre="salir" /> Salir
              </button>
            </>
          ) : null}
        </div>
      </header>

      {backend === 'caido' ? (
        <p className="aviso aviso-error banner" role="alert">
          Ahora no podemos cargar los reclamos. Probá de nuevo en unos minutos.
        </p>
      ) : null}

      <main>
        {!sesion ? (
          <div className="angosta portada">
            <FormularioCuenta
              onListo={entrar}
              detalle="Entrá para cargar un reclamo y seguir cómo avanza."
            />
          </div>
        ) : null}

        {vista === 'vecino' && sesion ? (
          <VistaVecino
            sesion={sesion}
            perfilAbierto={perfilAbierto}
            onCerrarPerfil={() => setPerfilAbierto(false)}
          />
        ) : null}

        {vista === 'municipal' && sesion ? (
          <>
            <VistaMunicipal sesion={sesion} onExpirar={salir} />
            <Panel abierto={perfilAbierto} onCerrar={() => setPerfilAbierto(false)} titulo="Mi perfil">
              <div className="formulario">
                <p className="bajada">Datos de tu cuenta municipal.</p>
                <Campo etiqueta="Email">
                  <input value={sesion.email} disabled readOnly />
                </Campo>
                <Campo etiqueta="Rol">
                  <input value="Administrador" disabled readOnly />
                </Campo>
              </div>
            </Panel>
          </>
        ) : null}
      </main>

      <footer className="pie">
        <span>Sistema de gestión de reclamos de infraestructura urbana.</span>
      </footer>
    </div>
  )
}

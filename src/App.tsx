import { useCallback, useEffect, useState } from 'react'
import { comprobarBackend } from './api.ts'
import { FormularioCuenta } from './cuenta.tsx'
import { borrarSesion, leerSesion, type Sesion } from './sesion.ts'
import { VistaMunicipal } from './views/Municipal.tsx'
import { VistaVecino } from './views/Vecino.tsx'

type Vista = 'vecino' | 'municipal'

function vistaDe(sesion: Sesion): Vista {
  return sesion.email.toLowerCase().endsWith('@admin.com') ? 'municipal' : 'vecino'
}

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const [backend, setBackend] = useState<'comprobando' | 'ok' | 'caido'>('comprobando')

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
    <div className="pagina" data-vista={vista ?? 'vecino'}>
      <header className="barra">
        <div>
          <p className="marca">Ticketera municipal</p>
          <p className="bajada marca-sub">Reclamos de infraestructura · CABA</p>
        </div>
        <div className="sesion">
          {sesion ? (
            <>
              <span className="quien">
                {sesion.email}
                <small>{vista === 'municipal' ? 'Panel municipal' : 'Vecino'}</small>
              </span>
              <button type="button" className="btn btn-secundario" onClick={salir}>
                Salir
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

        {vista === 'vecino' && sesion ? <VistaVecino sesion={sesion} /> : null}

        {vista === 'municipal' && sesion ? <VistaMunicipal sesion={sesion} onExpirar={salir} /> : null}
      </main>

      <footer className="pie">
        <span>Reclamos de la Ciudad de Buenos Aires.</span>
      </footer>
    </div>
  )
}

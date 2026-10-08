import { useEffect, useState } from 'react'
import {
  esNoAutorizado,
  historialCiudadano,
  obtenerCiudadano,
  textoError,
  type Ciudadano,
  type Reclamo,
} from '../api.ts'
import { ETIQUETA_TIPO, formatearFecha } from '../catalogo.ts'
import { Aviso, PastillaEstado } from '../ui.tsx'
import { DetalleReclamo } from './Reclamos.tsx'

function textoReclamo(reclamo: Reclamo): string {
  return reclamo.titulo.trim() || reclamo.descripcion.trim()
}

export function PanelCiudadano({
  token,
  onExpirar,
  idInicial = '',
  onVerZona,
  onVerSoap,
}: {
  token: string
  onExpirar: () => void
  idInicial?: string
  onVerZona: (barrio: string) => void
  onVerSoap: (reclamoId: string) => void
}) {
  const [ciudadano, setCiudadano] = useState<Ciudadano | null>(null)
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!idInicial) return
    let cancelado = false
    setOcupado(true)
    setError(null)
    setCiudadano(null)
    setReclamos([])
    setSeleccionadoId(null)
    void Promise.all([obtenerCiudadano(token, idInicial), historialCiudadano(token, idInicial)])
      .then(([ficha, historial]) => {
        if (cancelado) return
        setCiudadano(ficha)
        setReclamos(historial)
      })
      .catch((fallo: unknown) => {
        if (cancelado) return
        if (esNoAutorizado(fallo)) onExpirar()
        setError(textoError(fallo))
      })
      .finally(() => {
        if (!cancelado) setOcupado(false)
      })
    return () => {
      cancelado = true
    }
  }, [idInicial, token, onExpirar])

  const seleccionado = reclamos.find((item) => item.id === seleccionadoId) ?? null

  return (
    <div className="columna">
      <section className="tarjeta">
        <h2>Vecino</h2>
        {!idInicial ? <p className="bajada">Abrilo desde un reclamo, con el botón Ver vecino.</p> : null}
        {ocupado ? <p className="bajada">Cargando…</p> : null}
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        {ciudadano ? (
          <>
            <p className="vecino-nombre">
              {ciudadano.nombre}
              <span>{ciudadano.contacto}</span>
            </p>
            {reclamos.length === 0 ? (
              <p className="bajada">Todavía no cargó reclamos.</p>
            ) : (
              <ul className="lista-simple">
                {reclamos.map((reclamo) => {
                  const elegido = reclamo.id === seleccionadoId
                  return (
                    <li key={reclamo.id}>
                      <button
                        type="button"
                        className={`item-lista ${elegido ? 'activo' : ''}`}
                        aria-expanded={elegido}
                        onClick={() => setSeleccionadoId(elegido ? null : reclamo.id)}
                      >
                        <PastillaEstado estado={reclamo.estado} />
                        <span className="item-lista-titulo">{textoReclamo(reclamo)}</span>
                        <small>
                          {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.barrio} · {formatearFecha(reclamo.fechaCreacion)}
                        </small>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : null}
      </section>

      {seleccionado && ciudadano ? (
        <section className="tarjeta">
          <DetalleReclamo
            token={token}
            reclamo={seleccionado}
            onExpirar={onExpirar}
            onActualizado={(reclamo) => {
              setReclamos((actual) => actual.map((item) => (item.id === reclamo.id ? reclamo : item)))
            }}
            onVerZona={onVerZona}
            onVerSoap={onVerSoap}
          />
        </section>
      ) : null}
    </div>
  )
}

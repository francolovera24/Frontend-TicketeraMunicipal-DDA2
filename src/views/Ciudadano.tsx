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
import { Aviso, Campo, PastillaEstado } from '../ui.tsx'

export function PanelCiudadano({
  token,
  onExpirar,
  idInicial = '',
}: {
  token: string
  onExpirar: () => void
  idInicial?: string
}) {
  const [id, setId] = useState(idInicial)
  const [ciudadano, setCiudadano] = useState<Ciudadano | null>(null)
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function cargar(ciudadanoId: string) {
    setOcupado(true)
    setError(null)
    setCiudadano(null)
    setReclamos([])
    try {
      const [ficha, historial] = await Promise.all([
        obtenerCiudadano(token, ciudadanoId),
        historialCiudadano(token, ciudadanoId),
      ])
      setCiudadano(ficha)
      setReclamos(historial)
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    if (!idInicial) return
    void cargar(idInicial)
  }, [idInicial])

  function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    void cargar(id.trim())
  }

  return (
    <section className="tarjeta formulario">
      <h2>Ciudadano e historial</h2>
      <p className="bajada">
        GET /ciudadanos/&#123;id&#125; y GET /ciudadanos/&#123;id&#125;/reclamos. Un admin ve cualquiera. Un vecino
        logueado solo ve el suyo (eso se prueba desde la vista Vecino, con GET /ciudadanos/yo).
      </p>
      <form onSubmit={(evento) => void buscar(evento)}>
        <Campo etiqueta="Id del ciudadano">
          <input
            required
            spellCheck={false}
            value={id}
            onChange={(evento) => setId(evento.target.value)}
            placeholder="Pegá el id que figura en el reclamo"
          />
        </Campo>
        <button className="btn btn-primario" type="submit" disabled={ocupado}>
          {ocupado ? 'Buscando…' : 'Consultar'}
        </button>
      </form>
      {error ? <Aviso tono="error">{error}</Aviso> : null}
      {ciudadano ? (
        <>
          <p className="vecino-nombre">
            {ciudadano.nombre}
            <span>{ciudadano.contacto}</span>
          </p>
          {reclamos.length === 0 ? (
            <p className="bajada">Este ciudadano no tiene reclamos.</p>
          ) : (
            <ul className="lista-simple">
              {reclamos.map((reclamo) => (
                <li key={reclamo.id} className="item-estatico">
                  <PastillaEstado estado={reclamo.estado} />
                  <span className="relato corto">{reclamo.descripcion}</span>
                  <small>
                    {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.barrio} · {formatearFecha(reclamo.fechaCreacion)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}

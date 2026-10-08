import { useEffect, useState } from 'react'
import { consultarEstadoSoap, textoError, type EstadoReclamo, type TipoReclamo } from '../api.ts'
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, formatearFecha } from '../catalogo.ts'
import { Aviso, Campo, PastillaEstado } from '../ui.tsx'

type EstadoSoap = {
  id: string
  tipo: string
  estado: string
  urgente: string
  barrio: string
  cuadrillaAsignada: string
  reclamoOriginalId: string
  fechaCreacion: string
  fechaActualizacion: string
}

function textoLocal(xml: Document, nombre: string): string {
  const nodos = xml.getElementsByTagName('*')
  for (const nodo of nodos) {
    if (nodo.localName === nombre && nodo.textContent) return nodo.textContent
  }
  return ''
}

function leerEstado(xml: string): { fault: string | null; estado: EstadoSoap | null } {
  const documento = new DOMParser().parseFromString(xml, 'text/xml')
  const fallaParser = documento.querySelector('parsererror')
  if (fallaParser) return { fault: 'La respuesta no es XML.', estado: null }
  const fault = textoLocal(documento, 'faultstring') || textoLocal(documento, 'Text')
  if (fault && !textoLocal(documento, 'estado')) return { fault, estado: null }
  if (!textoLocal(documento, 'estado')) return { fault: fault || 'Sin datos de reclamo en la respuesta.', estado: null }
  return {
    fault: null,
    estado: {
      id: textoLocal(documento, 'id'),
      tipo: textoLocal(documento, 'tipo'),
      estado: textoLocal(documento, 'estado'),
      urgente: textoLocal(documento, 'urgente'),
      barrio: textoLocal(documento, 'barrio'),
      cuadrillaAsignada: textoLocal(documento, 'cuadrillaAsignada'),
      reclamoOriginalId: textoLocal(documento, 'reclamoOriginalId'),
      fechaCreacion: textoLocal(documento, 'fechaCreacion'),
      fechaActualizacion: textoLocal(documento, 'fechaActualizacion'),
    },
  }
}

export function PanelSoap({ idInicial = '' }: { idInicial?: string }) {
  const [id, setId] = useState(idInicial)
  const [xml, setXml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function consultarId(reclamoId: string) {
    setOcupado(true)
    setError(null)
    setXml(null)
    try {
      const respuesta = await consultarEstadoSoap(reclamoId)
      setXml(respuesta.xml)
    } catch (fallo) {
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    if (!idInicial) return
    void consultarId(idInicial)
  }, [idInicial])

  function consultar(evento: React.FormEvent) {
    evento.preventDefault()
    void consultarId(id.trim())
  }

  const leido = xml ? leerEstado(xml) : null

  return (
    <section className="tarjeta formulario">
      <h2>Estado</h2>
      <p className="bajada">Pegá el número de seguimiento para ver en qué está el reclamo.</p>
      <form onSubmit={(evento) => void consultar(evento)}>
        <Campo etiqueta="Número de seguimiento">
          <input
            required
            spellCheck={false}
            value={id}
            onChange={(evento) => setId(evento.target.value)}
            placeholder="Pegá el número"
          />
        </Campo>
        <button className="btn btn-primario" type="submit" disabled={ocupado}>
          {ocupado ? 'Consultando…' : 'Ver estado'}
        </button>
      </form>
      {error ? <Aviso tono="error">{error}</Aviso> : null}
      {leido?.fault ? <Aviso tono="error">{leido.fault}</Aviso> : null}
      {leido?.estado ? (
        <dl className="datos">
          <div>
            <dt>Estado</dt>
            <dd>
              {leido.estado.estado in ETIQUETA_ESTADO ? (
                <PastillaEstado estado={leido.estado.estado as EstadoReclamo} />
              ) : (
                leido.estado.estado
              )}
            </dd>
          </div>
          <div>
            <dt>Problema</dt>
            <dd>
              {leido.estado.tipo in ETIQUETA_TIPO
                ? ETIQUETA_TIPO[leido.estado.tipo as TipoReclamo]
                : leido.estado.tipo}
            </dd>
          </div>
          <div>
            <dt>Barrio</dt>
            <dd>{leido.estado.barrio}</dd>
          </div>
          <div>
            <dt>Urgente</dt>
            <dd>{leido.estado.urgente === 'true' ? 'Sí' : 'No'}</dd>
          </div>
          <div>
            <dt>Equipo</dt>
            <dd>{leido.estado.cuadrillaAsignada ? 'Asignado' : 'Sin equipo'}</dd>
          </div>
          <div>
            <dt>Ingreso</dt>
            <dd>{formatearFecha(leido.estado.fechaCreacion)}</dd>
          </div>
          <div>
            <dt>Actualización</dt>
            <dd>{formatearFecha(leido.estado.fechaActualizacion)}</dd>
          </div>
        </dl>
      ) : null}
      {leido?.estado?.reclamoOriginalId ? (
        <p className="bajada">Ya había un reclamo igual. Se sigue ese.</p>
      ) : null}
    </section>
  )
}

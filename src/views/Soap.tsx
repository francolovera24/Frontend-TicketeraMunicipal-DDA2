import { useEffect, useState } from 'react'
import { consultarEstadoSoap, textoError } from '../api.ts'
import { Aviso, Campo } from '../ui.tsx'

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
  const [status, setStatus] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function consultarId(reclamoId: string) {
    setOcupado(true)
    setError(null)
    setXml(null)
    try {
      const respuesta = await consultarEstadoSoap(reclamoId)
      setStatus(respuesta.status)
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
      <h2>SOAP · consultar estado</h2>
      <p className="bajada">
        POST /ws, operación consultarEstadoReclamo. Es el servicio para integraciones externas (no hace falta token).
        El WSDL está en{' '}
        <a href="http://localhost:8080/ws/reclamos.wsdl" target="_blank" rel="noreferrer">
          /ws/reclamos.wsdl
        </a>
        . Un id inexistente o mal formado devuelve un Fault de cliente.
      </p>
      <form onSubmit={(evento) => void consultar(evento)}>
        <Campo etiqueta="Id del reclamo">
          <input
            required
            spellCheck={false}
            value={id}
            onChange={(evento) => setId(evento.target.value)}
          />
        </Campo>
        <button className="btn btn-primario" type="submit" disabled={ocupado}>
          {ocupado ? 'Consultando…' : 'Consultar por SOAP'}
        </button>
      </form>
      {error ? <Aviso tono="error">{error}</Aviso> : null}
      {leido?.fault ? <Aviso tono="error">{leido.fault}</Aviso> : null}
      {leido?.estado ? (
        <dl className="datos">
          <div>
            <dt>HTTP</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{leido.estado.estado}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{leido.estado.tipo}</dd>
          </div>
          <div>
            <dt>Barrio</dt>
            <dd>{leido.estado.barrio}</dd>
          </div>
          <div>
            <dt>Urgente</dt>
            <dd>{leido.estado.urgente}</dd>
          </div>
          <div>
            <dt>Cuadrilla asignada</dt>
            <dd>{leido.estado.cuadrillaAsignada}</dd>
          </div>
          <div>
            <dt>Original</dt>
            <dd>{leido.estado.reclamoOriginalId || '—'}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{leido.estado.fechaCreacion}</dd>
          </div>
          <div>
            <dt>Actualización</dt>
            <dd>{leido.estado.fechaActualizacion}</dd>
          </div>
        </dl>
      ) : null}
      {xml ? (
        <details>
          <summary>XML de respuesta</summary>
          <pre className="crudo">{xml}</pre>
        </details>
      ) : null}
    </section>
  )
}

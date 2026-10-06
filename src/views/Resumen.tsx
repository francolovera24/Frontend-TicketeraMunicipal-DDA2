import { useState } from 'react'
import { esNoAutorizado, obtenerResumen, textoError, type ResumenZona } from '../api.ts'
import { BARRIOS, ETIQUETA_TIPO, formatearFecha, TIPOS } from '../catalogo.ts'
import { Aviso, Campo, PastillaEstado } from '../ui.tsx'

export function PanelResumen({
  token,
  onExpirar,
  barrioInicial,
}: {
  token: string
  onExpirar: () => void
  barrioInicial: string
}) {
  const [barrio, setBarrio] = useState(barrioInicial)
  const [barrioVisto, setBarrioVisto] = useState(barrioInicial)
  const [tipo, setTipo] = useState('')
  const [desde, setDesde] = useState('')
  const [resumen, setResumen] = useState<ResumenZona | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  if (barrioVisto !== barrioInicial) {
    setBarrioVisto(barrioInicial)
    setBarrio(barrioInicial)
  }

  async function pedir(evento: React.FormEvent) {
    evento.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      setResumen(await obtenerResumen(token, barrio, tipo || undefined, desde || undefined))
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setResumen(null)
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="corte">
      <div className="columna">
        <form className="tarjeta formulario" onSubmit={(evento) => void pedir(evento)}>
          <h2>Resumen de zona</h2>
          <p className="bajada">
            GET /resumen-zona. Arma el ranking de reclamos activos y pide el texto al generador de IA. La cache dura 5
            minutos por barrio + tipo + fecha; un evento del barrio la invalida.
          </p>
          <Campo etiqueta="Barrio">
            <select required value={barrio} onChange={(evento) => setBarrio(evento.target.value)}>
              {BARRIOS.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </Campo>
          <div className="fila-2">
            <Campo etiqueta="Tipo" hint="Opcional.">
              <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
                <option value="">Todos</option>
                {TIPOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Desde" hint="Opcional. Inicio de ese día, hora de Buenos Aires.">
              <input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} />
            </Campo>
          </div>
          {error ? <Aviso tono="error">{error}</Aviso> : null}
          <button className="btn btn-primario" type="submit" disabled={ocupado}>
            {ocupado ? 'Generando…' : 'Pedir resumen'}
          </button>
        </form>

        {resumen ? (
          <article className="tarjeta">
            <div className="fila-meta">
              <h2>
                {resumen.barrio}
                {resumen.tipo ? ` · ${ETIQUETA_TIPO[resumen.tipo]}` : ''}
              </h2>
              <span className={`pastilla ${resumen.generadoPorIa ? 'ia-ok' : 'ia-fallback'}`}>
                {resumen.generadoPorIa ? 'Generador respondió' : 'Texto de fallback'}
              </span>
            </div>
            <p className="meta">Generado {formatearFecha(resumen.timestampGeneracion)}</p>
            <p className="relato">{resumen.textoResumen}</p>
            <p className="bajada">
              generadoPorIa en true quiere decir que el generador contestó: la plantilla stub o Gemini, según
              IA_GENERADOR. En false el modelo falló y se devolvió solo el ranking, con cache corta de 30 segundos.
              Al modelo no se le manda nombre ni contacto: la descripción se anonimiza antes. Esta pantalla muestra la
              descripción guardada, no la versión que viaja al modelo.
            </p>
            {resumen.ranking.length === 0 ? (
              <p className="bajada">No hay reclamos activos con esos filtros.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Reclamo</th>
                    <th>Estado</th>
                    <th>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.ranking.map((item) => (
                    <tr key={item.reclamoId}>
                      <td>{item.score}</td>
                      <td>
                        <strong>{item.titulo}</strong>
                        {item.urgente ? ' · urgente' : ''}
                        <br />
                        {ETIQUETA_TIPO[item.tipo]} · {item.descripcion}
                        <br />
                        <span className="meta">{item.direccion}</span>
                      </td>
                      <td>
                        <PastillaEstado estado={item.estado} />
                      </td>
                      <td>{item.antiguedadHoras}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        ) : null}
      </div>

      <aside className="tarjeta mapa-ia">
        <h2>Componentes de IA del backend</h2>
        <p className="bajada">Qué está ejercitando este pedido, y qué se ve en el alta de un reclamo.</p>
        <ol className="mapa">
          <li>
            <strong>Ranking (CriticidadStrategy).</strong> Score = peso de riesgo × k + mín(antigüedad en horas, tope) +
            similares en el barrio × m. Cableado: k 10, tope 48, m 5. Bacheo: k 5, tope 72, m 15. El resto usa
            ScoreGenerico: k 5, tope 96, m 3. Cableado nace urgente.
          </li>
          <li>
            <strong>Texto (GeneradorDeResumen).</strong> Por defecto es un stub con plantilla, sin credenciales. Con
            IA_GENERADOR=llm y LLM_API_KEY usa Gemini. Si el modelo no responde, el ranking igual vuelve y
            generadoPorIa queda en false.
          </li>
          <li>
            <strong>Privacidad (Anonimizador).</strong> Antes del modelo se borran de la descripción el nombre, el
            contacto y cualquier email, DNI o teléfono. No detecta nombres de terceros escritos en el texto.
          </li>
          <li>
            <strong>Cache (CacheResumenes).</strong> 5 minutos en memoria por combinación de filtros. Un evento
            reclamo.* de ese barrio invalida todas las variantes. Redis está reservado y hoy no se usa.
          </li>
          <li>
            <strong>Duplicados (DetectorDeDuplicados).</strong> Al crearse un reclamo, si hay candidatos del mismo tipo,
            activos, de los últimos 30 días y a menos de 150 m (o del mismo barrio si no hay coordenadas), el
            comparador decide. En stub compara palabras; con llm, el modelo. Si coincide, el estado pasa a Duplicado,
            guarda reclamoOriginalId y no asigna cuadrilla. Si el modelo falla, no se considera duplicado.
          </li>
          <li>
            <strong>Geo (GeoClient / Nominatim).</strong> Si el alta no trae barrio, la dirección se geocodifica. Como
            máximo un pedido por segundo. Si Nominatim falla y el barrio vino informado, el reclamo se registra igual.
          </li>
        </ol>
      </aside>
    </div>
  )
}

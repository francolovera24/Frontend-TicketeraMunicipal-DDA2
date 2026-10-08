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
    <div className="columna">
      <form className="tarjeta formulario" onSubmit={(evento) => void pedir(evento)}>
        <h2>Resumen del barrio</h2>
        <p className="bajada">Un texto corto de lo que está pasando, con los reclamos abiertos ordenados por prioridad.</p>
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
          <Campo etiqueta="Problema" hint="Opcional.">
            <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
              <option value="">Todos</option>
              {TIPOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Desde" hint="Opcional.">
            <input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} />
          </Campo>
        </div>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        <button className="btn btn-primario" type="submit" disabled={ocupado}>
          {ocupado ? 'Armando el resumen…' : 'Ver resumen'}
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
              {resumen.generadoPorIa ? 'Resumen listo' : 'Sin texto, solo el listado'}
            </span>
          </div>
          <p className="meta">{formatearFecha(resumen.timestampGeneracion)}</p>
          <p className="relato">{resumen.textoResumen}</p>
          {resumen.ranking.length === 0 ? (
            <p className="bajada">No hay reclamos abiertos con esos filtros.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Prioridad</th>
                  <th>Reclamo</th>
                  <th>Estado</th>
                  <th>Antigüedad</th>
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
                    <td>{item.antiguedadHoras === 1 ? '1 hora' : `${item.antiguedadHoras} horas`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      ) : null}
    </div>
  )
}

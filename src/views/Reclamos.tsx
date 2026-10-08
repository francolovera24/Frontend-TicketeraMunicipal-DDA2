import { useCallback, useEffect, useRef, useState } from 'react'
import {
  asignarCuadrilla,
  cambiarEstado,
  esNoAutorizado,
  listarCuadrillas,
  listarReclamos,
  obtenerCiudadano,
  textoError,
  type Ciudadano,
  type Cuadrilla,
  type EstadoReclamo,
  type Reclamo,
  type TipoReclamo,
} from '../api.ts'
import {
  BARRIOS,
  COLOR_TIPO,
  destinosManuales,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  formatearFecha,
} from '../catalogo.ts'
import { Aviso, Campo, PastillaEstado } from '../ui.tsx'
import { MapaReclamos } from './MapaReclamos.tsx'

const COLUMNAS_KANBAN: EstadoReclamo[] = [
  'NUEVO',
  'EN_ANALISIS',
  'ASIGNADO',
  'EN_PROCESO',
  'RESUELTO',
  'RECHAZADO',
  'DUPLICADO',
]

export function PanelReclamos({
  token,
  onExpirar,
  onVerZona,
  onVerCiudadano,
  onVerSoap,
}: {
  token: string
  onExpirar: () => void
  onVerZona: (barrio: string) => void
  onVerCiudadano: (ciudadanoId: string) => void
  onVerSoap: (reclamoId: string) => void
}) {
  const [barrio, setBarrio] = useState('')
  const [tipo, setTipo] = useState('')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')
  const [enVivo, setEnVivo] = useState(true)
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [recien, setRecien] = useState<Set<string>>(new Set())
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const conocidos = useRef<Set<string> | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const lista = await listarReclamos(token, barrio || undefined)
      const ids = new Set(lista.map((item) => item.id))
      if (conocidos.current) {
        const novedades = new Set<string>()
        for (const id of ids) {
          if (!conocidos.current.has(id)) novedades.add(id)
        }
        if (novedades.size > 0) {
          setRecien(novedades)
          window.setTimeout(() => setRecien(new Set()), 12000)
        }
      }
      conocidos.current = ids
      setReclamos(lista)
      setError(null)
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    } finally {
      setCargando(false)
    }
  }, [token, barrio, onExpirar])

  useEffect(() => {
    conocidos.current = null
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!enVivo) return
    const timer = window.setInterval(() => void cargar(), 4000)
    return () => window.clearInterval(timer)
  }, [enVivo, cargar])

  const visibles = reclamos.filter((reclamo) => {
    if (tipo && reclamo.tipo !== tipo) return false
    if (estado && reclamo.estado !== estado) return false
    if (!texto.trim()) return true
    const busqueda = texto.trim().toLowerCase()
    return (
      reclamo.titulo.toLowerCase().includes(busqueda) ||
      reclamo.descripcion.toLowerCase().includes(busqueda) ||
      reclamo.ubicacion.direccion.toLowerCase().includes(busqueda) ||
      reclamo.id.toLowerCase().includes(busqueda)
    )
  })

  const seleccionado = reclamos.find((item) => item.id === seleccionadoId) ?? null
  const enMapa = visibles.filter(
    (reclamo) =>
      reclamo.estado !== 'DUPLICADO' && reclamo.ubicacion.lat != null && reclamo.ubicacion.lon != null,
  )

  const porColumna = new Map<EstadoReclamo, Reclamo[]>(COLUMNAS_KANBAN.map((est) => [est, []]))
  for (const reclamo of visibles) {
    porColumna.get(reclamo.estado)?.push(reclamo)
  }

  return (
    <div className="columna">
      <MapaReclamos
        reclamos={enMapa}
        seleccionadoId={seleccionadoId}
        onElegir={setSeleccionadoId}
        tipo={tipo}
        onTipo={setTipo}
        barrio={barrio}
        onBarrio={(valor) => {
          conocidos.current = null
          setBarrio(valor)
        }}
      />

      <section className="tarjeta">
        <div className="encabezado-panel">
          <h2>Reclamos</h2>
          <label className="check">
            <input type="checkbox" checked={enVivo} onChange={(evento) => setEnVivo(evento.target.checked)} />
            Se actualiza solo
          </label>
        </div>
        <p className="bajada">Filtrá por barrio, problema o estado. Con la actualización automática ves los reclamos nuevos al toque.</p>
        <div className="fila-2">
          <Campo etiqueta="Barrio">
            <select
              value={barrio}
              onChange={(evento) => {
                conocidos.current = null
                setBarrio(evento.target.value)
              }}
            >
              <option value="">Todos</option>
              {BARRIOS.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Problema">
            <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReclamo | '')}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETA_TIPO).map(([id, etiqueta]) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Estado">
            <select value={estado} onChange={(evento) => setEstado(evento.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETA_ESTADO).map(([id, etiqueta]) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Buscar" hint="Título, dirección o texto.">
          <input value={texto} onChange={(evento) => setTexto(evento.target.value)} />
        </Campo>
        <button className="btn btn-secundario" type="button" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
      </section>

      <section className="tarjeta tarjeta-tablero">
        <h2>Tablero</h2>
        <p className="bajada">Elegí un reclamo para ver el detalle y cambiar su estado.</p>
        {visibles.length === 0 ? (
          <p className="bajada">No hay reclamos con esos filtros.</p>
        ) : (
          <div className="tablero-kanban">
            {COLUMNAS_KANBAN.map((columnaEstado) => {
              const items = porColumna.get(columnaEstado) ?? []
              return (
                <div className="columna-kanban" key={columnaEstado}>
                  <div className={`columna-kanban__cabecera estado-${columnaEstado}`}>
                    <span>{ETIQUETA_ESTADO[columnaEstado]}</span>
                    <span className="columna-kanban__contador">{items.length}</span>
                  </div>
                  <div className="columna-kanban__cuerpo">
                    {items.map((reclamo) => (
                      <button
                        key={reclamo.id}
                        type="button"
                        style={{ borderLeftColor: COLOR_TIPO[reclamo.tipo] }}
                        className={`tarjeta-kanban ${reclamo.id === seleccionadoId ? 'activo' : ''} ${recien.has(reclamo.id) ? 'recien' : ''}`}
                        onClick={() => setSeleccionadoId(reclamo.id)}
                      >
                        <span className="fila-meta">
                          {reclamo.urgente ? <span className="pastilla urgente">Urgente</span> : null}
                          {recien.has(reclamo.id) ? <span className="pastilla nuevo">Recién llegado</span> : null}
                        </span>
                        <span className="tarjeta-kanban__titulo">{reclamo.titulo}</span>
                        <small>
                          {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.barrio}
                        </small>
                        <small>{formatearFecha(reclamo.fechaCreacion)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="tarjeta">
        {seleccionado ? (
          <DetalleReclamo
            token={token}
            reclamo={seleccionado}
            onExpirar={onExpirar}
            onActualizado={(reclamo) => {
              setReclamos((actual) => actual.map((item) => (item.id === reclamo.id ? reclamo : item)))
            }}
            onVerZona={onVerZona}
            onVerCiudadano={onVerCiudadano}
            onVerSoap={onVerSoap}
          />
        ) : (
          <>
            <h2>Detalle</h2>
            <p className="bajada">Elegí un reclamo del tablero para ver qué pasó y quién lo cargó.</p>
          </>
        )}
      </section>
    </div>
  )
}

export function DetalleReclamo({
  token,
  reclamo,
  onExpirar,
  onActualizado,
  onVerZona,
  onVerCiudadano,
  onVerSoap,
}: {
  token: string
  reclamo: Reclamo
  onExpirar: () => void
  onActualizado: (reclamo: Reclamo) => void
  onVerZona: (barrio: string) => void
  onVerCiudadano?: (ciudadanoId: string) => void
  onVerSoap: (reclamoId: string) => void
}) {
  const [vecino, setVecino] = useState<Ciudadano | null>(null)
  const [errorVecino, setErrorVecino] = useState<string | null>(null)
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([])
  const [cuadrillaId, setCuadrillaId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let cancelado = false
    setVecino(null)
    setErrorVecino(null)
    setOk(null)
    setError(null)
    void obtenerCiudadano(token, reclamo.ciudadanoId)
      .then((ciudadano) => {
        if (!cancelado) setVecino(ciudadano)
      })
      .catch((fallo: unknown) => {
        if (cancelado) return
        if (esNoAutorizado(fallo)) onExpirar()
        setErrorVecino(textoError(fallo))
      })
    return () => {
      cancelado = true
    }
  }, [token, reclamo.id, reclamo.ciudadanoId, onExpirar])

  const esperaAsignacion = (reclamo.estado === 'NUEVO' || reclamo.estado === 'EN_ANALISIS') && !reclamo.cuadrillaId

  useEffect(() => {
    let cancelado = false
    void listarCuadrillas(token, reclamo.tipo)
      .then((lista) => {
        if (cancelado) return
        setCuadrillas(lista)
        setCuadrillaId(lista.find((item) => item.disponible)?.id ?? '')
      })
      .catch((fallo: unknown) => {
        if (cancelado) return
        if (esNoAutorizado(fallo)) onExpirar()
        setError(textoError(fallo))
      })
    return () => {
      cancelado = true
    }
  }, [token, reclamo.tipo, reclamo.id, onExpirar])

  const destinos = destinosManuales(reclamo.estado)
  const libres = cuadrillas.filter((item) => item.disponible)
  const equipo = cuadrillas.find((item) => item.id === reclamo.cuadrillaId)

  async function aplicarEstado(nuevo: EstadoReclamo) {
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      const actualizado = await cambiarEstado(token, reclamo.id, nuevo)
      onActualizado(actualizado)
      setOk(`Pasó a ${ETIQUETA_ESTADO[actualizado.estado]}.`)
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  async function aplicarCuadrilla(evento: React.FormEvent) {
    evento.preventDefault()
    if (!cuadrillaId) return
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      const actualizado = await asignarCuadrilla(token, reclamo.id, cuadrillaId)
      onActualizado(actualizado)
      setOk('Equipo asignado.')
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="detalle-reclamo">
      <div className="detalle-cuerpo">
        <div className="fila-meta">
          <h2>{reclamo.titulo.trim() || reclamo.descripcion.trim()}</h2>
          {reclamo.urgente ? <span className="pastilla urgente">Urgente</span> : null}
        </div>
        {vecino ? (
          <p className="vecino-nombre">
            {vecino.nombre}
            <span>{vecino.contacto}</span>
          </p>
        ) : (
          <p className="bajada">{errorVecino ?? 'Cargando datos del vecino…'}</p>
        )}
        {reclamo.titulo.trim() ? <p className="relato">{reclamo.descripcion}</p> : null}
        <dl className="datos">
          <div>
            <dt>Problema</dt>
            <dd>{ETIQUETA_TIPO[reclamo.tipo]}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{reclamo.ubicacion.direccion}</dd>
          </div>
          <div>
            <dt>Barrio</dt>
            <dd>{reclamo.barrio}</dd>
          </div>
          <div>
            <dt>Equipo</dt>
            <dd>{equipo ? equipo.nombre : 'Sin equipo'}</dd>
          </div>
          <div>
            <dt>Ingreso</dt>
            <dd>{formatearFecha(reclamo.fechaCreacion)}</dd>
          </div>
          <div>
            <dt>Actualización</dt>
            <dd>{formatearFecha(reclamo.fechaActualizacion)}</dd>
          </div>
        </dl>
        {reclamo.estado === 'DUPLICADO' ? (
          <p className="bajada">Ya había un reclamo igual. Se sigue ese y no se manda otro equipo.</p>
        ) : null}
        <div className="acciones">
          {onVerCiudadano ? (
            <button className="btn btn-secundario" type="button" onClick={() => onVerCiudadano(reclamo.ciudadanoId)}>
              Ver vecino
            </button>
          ) : null}
          <button className="btn btn-secundario" type="button" onClick={() => onVerSoap(reclamo.id)}>
            Ver estado
          </button>
          <button className="btn btn-texto" type="button" onClick={() => onVerZona(reclamo.barrio)}>
            Ver resumen de {reclamo.barrio}
          </button>
        </div>
      </div>

      <aside className="detalle-estados">
        <details className="lista-abrible" open key={reclamo.id}>
          <summary>
            <span>Estado</span>
            <PastillaEstado estado={reclamo.estado} />
          </summary>
          <ol className="lista-estados">
            {COLUMNAS_KANBAN.map((estado) => {
              const actual = estado === reclamo.estado
              const posible = destinos.includes(estado)
              return (
                <li key={estado} className={actual ? 'actual' : posible ? 'posible' : 'otro'}>
                  {posible ? (
                    <button type="button" disabled={ocupado} onClick={() => void aplicarEstado(estado)}>
                      <PastillaEstado estado={estado} />
                    </button>
                  ) : (
                    <span>
                      <PastillaEstado estado={estado} />
                      {actual ? <small>Actual</small> : null}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </details>
        {destinos.length === 0 && !esperaAsignacion ? (
          <p className="bajada">Este reclamo ya no cambia de estado.</p>
        ) : null}
        {esperaAsignacion ? (
          <form className="bloque" onSubmit={(evento) => void aplicarCuadrilla(evento)}>
            <h3>Asignar equipo</h3>
            <p className="bajada">Elegí quién se ocupa. El reclamo pasa a Asignado.</p>
            {libres.length === 0 ? (
              <p className="bajada">No hay equipos libres para este problema.</p>
            ) : (
              <>
                <Campo etiqueta="Equipo">
                  <select value={cuadrillaId} onChange={(evento) => setCuadrillaId(evento.target.value)}>
                    {libres.map((cuadrilla) => (
                      <option key={cuadrilla.id} value={cuadrilla.id}>
                        {cuadrilla.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
                <button className="btn btn-primario" type="submit" disabled={ocupado || !cuadrillaId}>
                  Asignar
                </button>
              </>
            )}
          </form>
        ) : null}
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      </aside>
    </div>
  )
}

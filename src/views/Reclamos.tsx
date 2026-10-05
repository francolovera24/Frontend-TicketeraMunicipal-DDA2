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
import { BARRIOS, destinosManuales, ETIQUETA_ESTADO, ETIQUETA_TIPO, formatearFecha, recortar } from '../catalogo.ts'
import { Aviso, Campo, Copiar, PastillaEstado } from '../ui.tsx'
import { MapaReclamos } from './MapaReclamos.tsx'

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
      <div className="corte">
      <section className="tarjeta">
        <div className="encabezado-panel">
          <h2>Reclamos</h2>
          <label className="check">
            <input type="checkbox" checked={enVivo} onChange={(evento) => setEnVivo(evento.target.checked)} />
            En vivo
          </label>
        </div>
        <p className="bajada">
          GET /reclamos es solo ADMIN. El barrio lo filtra el backend; el tipo, el estado y el texto se filtran acá.
          Con “en vivo” se actualiza cada 4 segundos para ver el reclamo apenas lo carga un vecino.
        </p>
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
        <Campo etiqueta="Buscar en la descripción, la dirección o el id">
          <input value={texto} onChange={(evento) => setTexto(evento.target.value)} />
        </Campo>
        <button className="btn btn-secundario" type="button" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        {visibles.length === 0 ? (
          <p className="bajada">No hay reclamos con esos filtros.</p>
        ) : (
          <ul className="lista-simple lista-scroll">
            {visibles.map((reclamo) => (
              <li key={reclamo.id}>
                <button
                  type="button"
                  className={`item-lista ${reclamo.id === seleccionadoId ? 'activo' : ''} ${recien.has(reclamo.id) ? 'recien' : ''}`}
                  onClick={() => setSeleccionadoId(reclamo.id)}
                >
                  <span className="fila-meta">
                    <PastillaEstado estado={reclamo.estado} />
                    {reclamo.urgente ? <span className="pastilla urgente">Urgente</span> : null}
                    {recien.has(reclamo.id) ? <span className="pastilla nuevo">Recién llegado</span> : null}
                  </span>
                  <span className="relato corto">{reclamo.descripcion}</span>
                  <small>
                    {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.ubicacion.direccion} · {reclamo.barrio} · score{' '}
                    {reclamo.scoreCriticidad} · {formatearFecha(reclamo.fechaCreacion)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
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
            <p className="bajada">Elegí un reclamo para ver el texto del vecino, su contacto y las acciones de gestión.</p>
          </>
        )}
      </section>
      </div>
    </div>
  )
}

function DetalleReclamo({
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
  onVerCiudadano: (ciudadanoId: string) => void
  onVerSoap: (reclamoId: string) => void
}) {
  const [vecino, setVecino] = useState<Ciudadano | null>(null)
  const [errorVecino, setErrorVecino] = useState<string | null>(null)
  const [destino, setDestino] = useState<EstadoReclamo | ''>('')
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([])
  const [cuadrillaId, setCuadrillaId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let cancelado = false
    setVecino(null)
    setErrorVecino(null)
    setDestino('')
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
    if (!esperaAsignacion) return
    let cancelado = false
    void listarCuadrillas(token, reclamo.tipo, 'true')
      .then((lista) => {
        if (cancelado) return
        setCuadrillas(lista)
        setCuadrillaId(lista[0]?.id ?? '')
      })
      .catch((fallo: unknown) => {
        if (cancelado) return
        if (esNoAutorizado(fallo)) onExpirar()
        setError(textoError(fallo))
      })
    return () => {
      cancelado = true
    }
  }, [esperaAsignacion, token, reclamo.tipo, reclamo.id, onExpirar])

  const destinos = destinosManuales(reclamo.estado)

  async function aplicarEstado(evento: React.FormEvent) {
    evento.preventDefault()
    if (!destino) return
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      const actualizado = await cambiarEstado(token, reclamo.id, destino)
      onActualizado(actualizado)
      setOk(`Estado actualizado a ${ETIQUETA_ESTADO[actualizado.estado]}.`)
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
      setOk('Cuadrilla asignada. El reclamo pasó a Asignado.')
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h2>Lo que ingresó el vecino</h2>
      {vecino ? (
        <p className="vecino-nombre">
          {vecino.nombre}
          <span>{vecino.contacto}</span>
        </p>
      ) : (
        <p className="bajada">{errorVecino ?? 'Cargando ciudadano…'}</p>
      )}
      <p className="relato">{reclamo.descripcion}</p>
      <dl className="datos">
        <div>
          <dt>Tipo</dt>
          <dd>{ETIQUETA_TIPO[reclamo.tipo]}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <PastillaEstado estado={reclamo.estado} />
            {reclamo.urgente ? <span className="pastilla urgente">Urgente</span> : null}
          </dd>
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
          <dt>Coordenadas</dt>
          <dd>
            {reclamo.ubicacion.lat != null && reclamo.ubicacion.lon != null
              ? `${reclamo.ubicacion.lat}, ${reclamo.ubicacion.lon}`
              : 'Sin coordenadas'}
          </dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{reclamo.scoreCriticidad}</dd>
        </div>
        <div>
          <dt>Cuadrilla</dt>
          <dd>{reclamo.cuadrillaId ? <code>{reclamo.cuadrillaId}</code> : 'Sin asignar'}</dd>
        </div>
        <div>
          <dt>Original</dt>
          <dd>{reclamo.reclamoOriginalId ? <code>{reclamo.reclamoOriginalId}</code> : '—'}</dd>
        </div>
        <div>
          <dt>Alta</dt>
          <dd>{formatearFecha(reclamo.fechaCreacion)}</dd>
        </div>
        <div>
          <dt>Actualización</dt>
          <dd>{formatearFecha(reclamo.fechaActualizacion)}</dd>
        </div>
      </dl>
      <p className="meta">
        Reclamo <code>{recortar(reclamo.id)}</code> <Copiar valor={reclamo.id} />
        {' · '}
        Ciudadano <code>{recortar(reclamo.ciudadanoId)}</code> <Copiar valor={reclamo.ciudadanoId} />
      </p>
      <div className="acciones">
        <button className="btn btn-secundario" type="button" onClick={() => onVerCiudadano(reclamo.ciudadanoId)}>
          Ver ciudadano
        </button>
        <button className="btn btn-secundario" type="button" onClick={() => onVerSoap(reclamo.id)}>
          Consultar por SOAP
        </button>
        <button className="btn btn-texto" type="button" onClick={() => onVerZona(reclamo.barrio)}>
          Ver resumen de IA de {reclamo.barrio}
        </button>
      </div>

      {destinos.length > 0 ? (
        <form className="bloque" onSubmit={(evento) => void aplicarEstado(evento)}>
          <h3>Cambiar estado</h3>
          <p className="bajada">
            PUT /reclamos/&#123;id&#125;/estado. Asignado y Duplicado no se eligen acá: Asignado sale de asignar una
            cuadrilla y Duplicado lo marca la detección. El resto publica reclamo.estado_cambiado; Resuelto publica
            reclamo.resuelto y libera la cuadrilla.
          </p>
          <Campo etiqueta="Nuevo estado">
            <select
              required
              value={destino}
              onChange={(evento) => setDestino(evento.target.value as EstadoReclamo)}
            >
              <option value="">Elegir…</option>
              {destinos.map((item) => (
                <option key={item} value={item}>
                  {ETIQUETA_ESTADO[item]}
                </option>
              ))}
            </select>
          </Campo>
          <button className="btn btn-primario" type="submit" disabled={ocupado || !destino}>
            Guardar estado
          </button>
        </form>
      ) : (
        <p className="bajada">Este estado es final. No admite otra transición.</p>
      )}

      {esperaAsignacion ? (
        <form className="bloque" onSubmit={(evento) => void aplicarCuadrilla(evento)}>
          <h3>Asignar cuadrilla a mano</h3>
          <p className="bajada">
            PUT /reclamos/&#123;id&#125;/asignar-cuadrilla. Pasa el reclamo a Asignado y publica reclamo.asignado. Solo
            cuadrillas libres de {ETIQUETA_TIPO[reclamo.tipo]}. Si el alta ya tomó una automáticamente, este bloque no
            aparece.
          </p>
          {cuadrillas.length === 0 ? (
            <p className="bajada">No hay cuadrillas libres de esta especialidad.</p>
          ) : (
            <>
              <Campo etiqueta="Cuadrilla">
                <select value={cuadrillaId} onChange={(evento) => setCuadrillaId(evento.target.value)}>
                  {cuadrillas.map((cuadrilla) => (
                    <option key={cuadrilla.id} value={cuadrilla.id}>
                      {cuadrilla.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <button className="btn btn-primario" type="submit" disabled={ocupado}>
                Asignar
              </button>
            </>
          )}
        </form>
      ) : null}

      {error ? <Aviso tono="error">{error}</Aviso> : null}
      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
    </>
  )
}

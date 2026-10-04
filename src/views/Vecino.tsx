import { useEffect, useState } from 'react'
import {
  ApiError,
  crearCiudadano,
  crearReclamo,
  historialCiudadano,
  miCiudadano,
  obtenerReclamo,
  textoError,
  type Ciudadano,
  type Reclamo,
  type TipoReclamo,
} from '../api.ts'
import { BARRIOS, ETIQUETA_TIPO, formatearFecha, recortar, TIPOS } from '../catalogo.ts'
import type { Sesion } from '../sesion.ts'
import { Aviso, Campo, Copiar, PastillaEstado } from '../ui.tsx'

const CLAVE_FICHA = 'ticketera.ficha'
const CLAVE_RECLAMOS = 'ticketera.reclamos'

function leerIdsLocales(): string[] {
  const crudo = localStorage.getItem(CLAVE_RECLAMOS)
  if (!crudo) return []
  try {
    const lista = JSON.parse(crudo) as unknown
    return Array.isArray(lista) ? lista.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function recordarReclamo(id: string): void {
  const ids = [id, ...leerIdsLocales().filter((item) => item !== id)].slice(0, 20)
  localStorage.setItem(CLAVE_RECLAMOS, JSON.stringify(ids))
}

type FichaLocal = Ciudadano

function leerFichaLocal(): FichaLocal | null {
  const crudo = localStorage.getItem(CLAVE_FICHA)
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as FichaLocal
  } catch {
    return null
  }
}

function numeroOpcional(valor: string, nombre: string): number | undefined {
  const limpio = valor.trim().replace(',', '.')
  if (!limpio) return undefined
  const numero = Number(limpio)
  if (Number.isNaN(numero)) throw new Error(`${nombre} no es un número`)
  return numero
}

export function VistaVecino({ sesion, avisoAdmin }: { sesion: Sesion | null; avisoAdmin?: boolean }) {
  const [nombre, setNombre] = useState(() => (sesion ? '' : (leerFichaLocal()?.nombre ?? '')))
  const [contacto, setContacto] = useState(() => (sesion ? '' : (leerFichaLocal()?.contacto ?? '')))
  const [ficha, setFicha] = useState<Ciudadano | null>(() => (sesion ? null : leerFichaLocal()))
  const [sinFicha, setSinFicha] = useState(false)
  const [cargandoFicha, setCargandoFicha] = useState(false)

  const [tipo, setTipo] = useState<TipoReclamo>('CABLEADO')
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [barrio, setBarrio] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seguimiento, setSeguimiento] = useState<Reclamo | null>(null)
  const [correlationId, setCorrelationId] = useState<string | null>(null)
  const [vigilarId, setVigilarId] = useState<string | null>(null)

  const [historial, setHistorial] = useState<Reclamo[]>([])
  const [consultaId, setConsultaId] = useState('')
  const [consulta, setConsulta] = useState<Reclamo | null>(null)
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null)

  const sesionId = sesion?.usuarioId ?? 'anon'
  const [origen, setOrigen] = useState(sesionId)
  if (origen !== sesionId) {
    setOrigen(sesionId)
    setHistorial([])
    if (!sesion) {
      const local = leerFichaLocal()
      setFicha(local)
      setSinFicha(!local)
      if (local) {
        setNombre(local.nombre)
        setContacto(local.contacto)
      }
    } else {
      setFicha(null)
      setSinFicha(false)
    }
  }

  useEffect(() => {
    if (!sesion) return

    let cancelado = false
    setCargandoFicha(true)
    setError(null)
    void miCiudadano(sesion.token)
      .then((ciudadano) => {
        if (cancelado) return
        setFicha(ciudadano)
        setSinFicha(false)
        setNombre(ciudadano.nombre)
        setContacto(ciudadano.contacto)
      })
      .catch((fallo: unknown) => {
        if (cancelado) return
        if (fallo instanceof ApiError && fallo.status === 404) {
          setFicha(null)
          setSinFicha(true)
          return
        }
        setError(textoError(fallo))
      })
      .finally(() => {
        if (!cancelado) setCargandoFicha(false)
      })

    return () => {
      cancelado = true
    }
  }, [sesion])

  useEffect(() => {
    if (sesion) {
      if (!ficha) return
      let cancelado = false
      void historialCiudadano(sesion.token, ficha.id)
        .then((lista) => {
          if (!cancelado) setHistorial(lista)
        })
        .catch((fallo: unknown) => {
          if (!cancelado) setError(textoError(fallo))
        })
      return () => {
        cancelado = true
      }
    }

    const ids = leerIdsLocales()
    if (ids.length === 0) return
    let cancelado = false
    void Promise.all(ids.map((id) => obtenerReclamo(id).catch(() => null))).then((lista) => {
      if (cancelado) return
      setHistorial(lista.filter((item): item is Reclamo => item !== null))
    })
    return () => {
      cancelado = true
    }
  }, [sesion, ficha])

  useEffect(() => {
    if (!vigilarId) return
    let cancelado = false
    let intentos = 0
    let timer = 0

    const tick = () => {
      intentos += 1
      void obtenerReclamo(vigilarId)
        .then((reclamo) => {
          if (cancelado) return
          setSeguimiento(reclamo)
          setHistorial((actual) => actual.map((item) => (item.id === reclamo.id ? reclamo : item)))
          if (reclamo.estado !== 'NUEVO' || intentos >= 10) window.clearInterval(timer)
        })
        .catch(() => {
          if (intentos >= 10) window.clearInterval(timer)
        })
    }

    timer = window.setInterval(tick, 1500)
    tick()
    return () => {
      cancelado = true
      window.clearInterval(timer)
    }
  }, [vigilarId])

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const latitud = numeroOpcional(lat, 'La latitud')
      const longitud = numeroOpcional(lon, 'La longitud')
      if (latitud !== undefined && (latitud < -90 || latitud > 90)) {
        throw new Error('La latitud tiene que estar entre -90 y 90')
      }
      if (longitud !== undefined && (longitud < -180 || longitud > 180)) {
        throw new Error('La longitud tiene que estar entre -180 y 180')
      }

      let ciudadano = ficha
      const contactoLimpio = contacto.trim()
      const nombreLimpio = nombre.trim()
      const reutiliza =
        ciudadano !== null &&
        ciudadano.contacto === contactoLimpio &&
        (sesion !== null || ciudadano.nombre === nombreLimpio)

      if (!reutiliza) {
        ciudadano = await crearCiudadano(nombreLimpio, contactoLimpio, sesion?.token)
        if (!sesion) localStorage.setItem(CLAVE_FICHA, JSON.stringify(ciudadano))
        setFicha(ciudadano)
        setSinFicha(false)
      }
      if (!ciudadano) throw new Error('No se pudo registrar el ciudadano')

      const correlacion = `web-${Date.now().toString(36)}`
      const reclamo = await crearReclamo(
        {
          ciudadanoId: ciudadano.id,
          tipo,
          descripcion: descripcion.trim(),
          direccion: direccion.trim(),
          lat: latitud,
          lon: longitud,
          barrio: barrio || undefined,
        },
        correlacion,
        sesion?.token,
      )
      setCorrelationId(correlacion)
      setSeguimiento(reclamo)
      setVigilarId(reclamo.id)
      if (!sesion) recordarReclamo(reclamo.id)
      setHistorial((actual) => [reclamo, ...actual.filter((item) => item.id !== reclamo.id)])
      setDescripcion('')
    } catch (fallo) {
      setError(fallo instanceof Error && !(fallo instanceof ApiError) && !(fallo instanceof TypeError)
        ? fallo.message
        : textoError(fallo))
    } finally {
      setEnviando(false)
    }
  }

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    setErrorConsulta(null)
    setConsulta(null)
    try {
      setConsulta(await obtenerReclamo(consultaId.trim()))
    } catch (fallo) {
      setErrorConsulta(textoError(fallo))
    }
  }

  const notaTipo = TIPOS.find((item) => item.id === tipo)?.nota

  return (
    <div className="grilla-2">
      <form className="tarjeta formulario" onSubmit={(evento) => void enviar(evento)}>
        <h2>Nuevo reclamo</h2>
        <p className="bajada">
          {avisoAdmin
            ? 'Tu sesión es de admin y este formulario no la usa: el reclamo se carga como alta pública, y el panel lo va a listar.'
            : sesion
              ? 'Estás logueado como vecino: el ciudadano queda vinculado a tu cuenta y después podés ver el historial.'
              : 'Sin cuenta también se puede reclamar. El alta de ciudadano y de reclamo son públicas. Iniciá sesión en la barra si querés historial.'}
        </p>

        {cargandoFicha ? <p className="bajada">Buscando tu ficha…</p> : null}

        <Campo etiqueta="Nombre">
          <input
            required
            maxLength={150}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            disabled={Boolean(sesion && ficha)}
          />
        </Campo>
        <Campo etiqueta="Contacto" hint="Email o teléfono. Tiene que ser único.">
          <input
            required
            maxLength={150}
            value={contacto}
            onChange={(evento) => setContacto(evento.target.value)}
            disabled={Boolean(sesion && ficha)}
          />
        </Campo>
        {sesion && sinFicha ? (
          <p className="bajada">Tu cuenta todavía no tiene ciudadano. Se crea al enviar el reclamo.</p>
        ) : null}
        {ficha ? (
          <p className="meta">
            Ciudadano <code>{recortar(ficha.id)}</code>
          </p>
        ) : null}

        <Campo etiqueta="Tipo" hint={notaTipo}>
          <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReclamo)}>
            {TIPOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Qué está pasando">
          <textarea
            required
            maxLength={1000}
            rows={4}
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Cable pelado colgando sobre la vereda"
          />
        </Campo>
        <Campo etiqueta="Dirección">
          <input
            required
            maxLength={255}
            value={direccion}
            onChange={(evento) => setDireccion(evento.target.value)}
            placeholder="Av. Santa Fe 3200"
          />
        </Campo>
        <Campo
          etiqueta="Barrio"
          hint="Si lo dejás vacío, el backend lo pide a Nominatim a partir de la dirección. Hace falta internet y puede tardar unos segundos."
        >
          <select value={barrio} onChange={(evento) => setBarrio(evento.target.value)}>
            <option value="">Resolver con la dirección</option>
            {BARRIOS.map((nombreBarrio) => (
              <option key={nombreBarrio} value={nombreBarrio}>
                {nombreBarrio}
              </option>
            ))}
          </select>
        </Campo>
        <div className="fila-2">
          <Campo etiqueta="Latitud" hint="Opcional. Entre -90 y 90.">
            <input inputMode="decimal" value={lat} onChange={(evento) => setLat(evento.target.value)} placeholder="-34.5875" />
          </Campo>
          <Campo etiqueta="Longitud" hint="Opcional. Entre -180 y 180.">
            <input inputMode="decimal" value={lon} onChange={(evento) => setLon(evento.target.value)} placeholder="-58.4108" />
          </Campo>
        </div>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        <button className="btn btn-primario" type="submit" disabled={enviando || cargandoFicha}>
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </button>
      </form>

      <div className="columna">
        {seguimiento ? (
          <article className="tarjeta">
            <h2>Lo que registró el backend</h2>
            <FichaReclamo reclamo={seguimiento} />
            {correlationId ? (
              <p className="meta">
                Correlation id <code>{correlationId}</code> (header X-Correlation-Id, queda en el log).
              </p>
            ) : null}
            <Pasos reclamo={seguimiento} />
            <p className="bajada">
              Para probar duplicados, cargá otro reclamo del mismo tipo, con una descripción parecida, en el mismo
              barrio (o a menos de 150 m si completás coordenadas). El segundo debería quedar en Duplicado, con el id
              del original, y sin cuadrilla.
            </p>
          </article>
        ) : (
          <article className="tarjeta">
            <h2>Seguimiento</h2>
            <p className="bajada">
              Después del alta, esta pantalla consulta el reclamo varias veces. La validación de IA y la asignación de
              cuadrilla ocurren por RabbitMQ, un instante después del POST.
            </p>
          </article>
        )}

        <article className="tarjeta">
          <h2>{sesion ? 'Mi historial' : 'Reclamos de esta ficha'}</h2>
          {historial.length === 0 ? (
            <p className="bajada">Todavía no hay reclamos para mostrar.</p>
          ) : (
            <ul className="lista-simple">
              {historial.map((reclamo) => (
                <li key={reclamo.id}>
                  <button type="button" className="item-lista" onClick={() => setSeguimiento(reclamo)}>
                    <PastillaEstado estado={reclamo.estado} />
                    <span>{reclamo.descripcion}</span>
                    <small>
                      {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.barrio} · {formatearFecha(reclamo.fechaCreacion)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <form className="tarjeta formulario" onSubmit={(evento) => void buscar(evento)}>
          <h2>Consultar estado</h2>
          <p className="bajada">GET /reclamos/&#123;id&#125; es público: alcanza con el id, sin cuenta.</p>
          <Campo etiqueta="Id del reclamo">
            <input
              required
              spellCheck={false}
              value={consultaId}
              onChange={(evento) => setConsultaId(evento.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </Campo>
          {errorConsulta ? <Aviso tono="error">{errorConsulta}</Aviso> : null}
          <button className="btn btn-secundario" type="submit">
            Consultar
          </button>
          {consulta ? <FichaReclamo reclamo={consulta} /> : null}
        </form>
      </div>
    </div>
  )
}

function FichaReclamo({ reclamo }: { reclamo: Reclamo }) {
  return (
    <div className="ficha">
      <div className="fila-meta">
        <PastillaEstado estado={reclamo.estado} />
        {reclamo.urgente ? <span className="pastilla urgente">Urgente</span> : null}
        <span className="meta">Score {reclamo.scoreCriticidad}</span>
      </div>
      <p className="relato">{reclamo.descripcion}</p>
      <p>
        {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.ubicacion.direccion} · {reclamo.barrio}
      </p>
      <p className="meta">
        Id <code>{reclamo.id}</code> <Copiar valor={reclamo.id} />
      </p>
      {reclamo.reclamoOriginalId ? (
        <p className="meta">
          Duplicado de <code>{reclamo.reclamoOriginalId}</code>
        </p>
      ) : null}
      {reclamo.cuadrillaId ? (
        <p className="meta">
          Cuadrilla <code>{reclamo.cuadrillaId}</code>
        </p>
      ) : (
        <p className="meta">Sin cuadrilla asignada.</p>
      )}
      <p className="meta">Actualizado {formatearFecha(reclamo.fechaActualizacion)}</p>
    </div>
  )
}

function Pasos({ reclamo }: { reclamo: Reclamo }) {
  const duplicado = reclamo.estado === 'DUPLICADO'
  const dejoDeSerNuevo = reclamo.estado !== 'NUEVO'
  // El alta guarda score 0. SvcIA lo escribe al validar. Si sigue en Nuevo con score, no había cuadrilla libre.
  const validado = dejoDeSerNuevo || reclamo.scoreCriticidad > 0
  const sinCuadrillaLibre = reclamo.estado === 'NUEVO' && reclamo.scoreCriticidad > 0 && !reclamo.cuadrillaId
  return (
    <ol className="pasos">
      <li className="hecho">Alta publicada (reclamo.creado).</li>
      <li className={validado ? 'hecho' : 'espera'}>
        {validado
          ? 'SvcIA ya lo validó: buscó duplicados y, si no lo era, calculó el score.'
          : 'Esperando a SvcIA. Si sigue en Nuevo y el score queda en 0, revisá que RabbitMQ esté corriendo: la validación no es parte del POST.'}
      </li>
      <li className={duplicado || reclamo.cuadrillaId ? 'hecho' : 'espera'}>
        {duplicado
          ? 'Quedó duplicado: no recibe cuadrilla.'
          : reclamo.cuadrillaId
            ? 'SvcCuadrillas asignó una cuadrilla libre de la especialidad.'
            : sinCuadrillaLibre
              ? 'No hay una cuadrilla libre de esta especialidad: las que hay ya están ocupadas. El reclamo queda en Nuevo hasta que se resuelva otro del mismo tipo y se libere una, o hasta que el panel municipal asigne una a mano.'
              : validado
                ? 'Validado, pero todavía no tiene cuadrilla. En el panel municipal se puede asignar una a mano.'
                : 'La cuadrilla se asigna recién después de la validación.'}
      </li>
    </ol>
  )
}

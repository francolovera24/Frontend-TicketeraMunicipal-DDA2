import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  crearCiudadano,
  crearReclamo,
  historialCiudadano,
  miCiudadano,
  obtenerReclamo,
  textoError,
  type AlcanceReclamo,
  type Ciudadano,
  type EstadoReclamo,
  type Reclamo,
  type TipoReclamo,
} from '../api.ts'
import { BARRIOS, ETIQUETA_ALCANCE, ETIQUETA_TIPO, formatearFecha, TIPOS } from '../catalogo.ts'
import type { Sesion } from '../sesion.ts'
import { Aviso, Campo, Copiar, FotoReclamo, MiniFoto, PastillaEstado } from '../ui.tsx'

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

type FotoLista = { base64: string; tipo: string; vista: string }

async function prepararFoto(archivo: File): Promise<FotoLista> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Elegí una foto (JPEG, PNG o WebP).')
  }
  const bitmap = await createImageBitmap(archivo)
  const maximo = 1280
  const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.max(1, Math.round(bitmap.width * escala))
  const alto = Math.max(1, Math.round(bitmap.height * escala))
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar la foto.')
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    lienzo.toBlob((resultado) => {
      if (resultado) resolve(resultado)
      else reject(new Error('No se pudo preparar la foto.'))
    }, 'image/jpeg', 0.82)
  })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)))
  }
  return { base64: btoa(binario), tipo: 'image/jpeg', vista: URL.createObjectURL(blob) }
}

const ESTADO_VECINO: Record<EstadoReclamo, string> = {
  NUEVO: 'Recibido',
  EN_ANALISIS: 'En revisión',
  ASIGNADO: 'Con un equipo',
  EN_PROCESO: 'En curso',
  RESUELTO: 'Resuelto',
  RECHAZADO: 'Cerrado',
  DUPLICADO: 'Ya estaba cargado',
}

export function VistaVecino({ sesion, avisoAdmin }: { sesion: Sesion | null; avisoAdmin?: boolean }) {
  const [nombre, setNombre] = useState(() => (sesion ? '' : (leerFichaLocal()?.nombre ?? '')))
  const [contacto, setContacto] = useState(() => (sesion ? '' : (leerFichaLocal()?.contacto ?? '')))
  const [ficha, setFicha] = useState<Ciudadano | null>(() => (sesion ? null : leerFichaLocal()))
  const [sinFicha, setSinFicha] = useState(false)
  const [cargandoFicha, setCargandoFicha] = useState(false)

  const [tipo, setTipo] = useState<TipoReclamo>('CABLEADO')
  const [alcance, setAlcance] = useState<AlcanceReclamo | ''>('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [barrio, setBarrio] = useState('')
  const [foto, setFoto] = useState<FotoLista | null>(null)
  const fotoInput = useRef<HTMLInputElement>(null)

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seguimiento, setSeguimiento] = useState<Reclamo | null>(null)
  const [vigilarId, setVigilarId] = useState<string | null>(null)

  const detalleRef = useRef<HTMLElement>(null)
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

  useEffect(() => {
    if (!seguimiento) return
    detalleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [seguimiento?.id])

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    if (!alcance) {
      setError('Seleccioná a quién afecta el problema.')
      return
    }
    setEnviando(true)
    try {
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
          alcance,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          direccion: direccion.trim(),
          barrio: barrio || undefined,
          imagen: foto?.base64,
          imagenTipo: foto?.tipo,
        },
        correlacion,
        sesion?.token,
      )
      setSeguimiento(reclamo)
      setVigilarId(reclamo.id)
      if (!sesion) recordarReclamo(reclamo.id)
      setHistorial((actual) => [reclamo, ...actual.filter((item) => item.id !== reclamo.id)])
      setAlcance('')
      setTitulo('')
      setDescripcion('')
      if (foto) URL.revokeObjectURL(foto.vista)
      setFoto(null)
      if (fotoInput.current) fotoInput.current.value = ''
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

  return (
    <div className="grilla-2">
      <form className="tarjeta formulario" onSubmit={(evento) => void enviar(evento)}>
        <h2>Nuevo reclamo</h2>
        <p className="bajada">
          {avisoAdmin
            ? 'Desde acá podés cargar un reclamo como lo haría un vecino.'
            : 'Contanos qué está pasando y dónde. Después vas a poder seguir el estado desde esta misma pantalla.'}
        </p>

        {cargandoFicha ? <p className="bajada">Cargando tus datos…</p> : null}

        <Campo etiqueta="Nombre">
          <input
            required
            maxLength={150}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            disabled={Boolean(sesion && ficha)}
          />
        </Campo>
        <Campo etiqueta="Contacto" hint="Un mail o un teléfono para poder avisarte.">
          <input
            required
            maxLength={150}
            value={contacto}
            onChange={(evento) => setContacto(evento.target.value)}
            disabled={Boolean(sesion && ficha)}
          />
        </Campo>
        {sesion && sinFicha ? (
          <p className="bajada">La primera vez guardamos tu nombre y contacto junto con el reclamo.</p>
        ) : null}

        <Campo etiqueta="Problema">
          <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReclamo)}>
            {TIPOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="¿A quién afecta el problema?">
          <select
            required
            value={alcance}
            onChange={(evento) => setAlcance(evento.target.value as AlcanceReclamo | '')}
          >
            <option value="">Seleccioná una opción</option>
            <option value="PERSONAL">Personal: solo me afecta a mí</option>
            <option value="COLECTIVO">Colectivo: afecta a varias personas</option>
          </select>
        </Campo>
        <Campo etiqueta="Título" hint="Un resumen corto.">
          <input
            required
            maxLength={150}
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Cable colgando sobre la vereda"
          />
        </Campo>
        <Campo etiqueta="Qué está pasando">
          <textarea
            required
            maxLength={1000}
            rows={4}
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Cable pelado colgando desde el poste, a metros de la esquina"
          />
        </Campo>
        <Campo etiqueta="Foto" hint="Opcional. Gemma la usa para ver el daño y afinar el análisis.">
          <input
            ref={fotoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              if (!archivo) return
              void prepararFoto(archivo)
                .then((lista) => {
                  setFoto((anterior) => {
                    if (anterior) URL.revokeObjectURL(anterior.vista)
                    return lista
                  })
                  setError(null)
                })
                .catch((fallo: unknown) => {
                  setError(fallo instanceof Error ? fallo.message : 'No se pudo leer la foto.')
                })
            }}
          />
        </Campo>
        {foto ? (
          <div className="foto-elegida">
            <img src={foto.vista} alt="Vista previa de la foto" />
            <div>
              <p className={descripcion.trim() ? 'foto-elegida-texto' : 'bajada'}>
                {descripcion.trim() || 'Contá arriba qué se ve en la foto.'}
              </p>
              <button
                type="button"
                className="btn btn-texto"
                onClick={() => {
                  URL.revokeObjectURL(foto.vista)
                  setFoto(null)
                  if (fotoInput.current) fotoInput.current.value = ''
                }}
              >
                Quitar foto
              </button>
            </div>
          </div>
        ) : null}
        <Campo etiqueta="Dirección">
          <input
            required
            maxLength={255}
            value={direccion}
            onChange={(evento) => setDireccion(evento.target.value)}
            placeholder="Av. Santa Fe 3200"
          />
        </Campo>
        <Campo etiqueta="Barrio" hint="Si no lo sabés, lo completamos con la dirección.">
          <select value={barrio} onChange={(evento) => setBarrio(evento.target.value)}>
            <option value="">No estoy seguro</option>
            {BARRIOS.map((nombreBarrio) => (
              <option key={nombreBarrio} value={nombreBarrio}>
                {nombreBarrio}
              </option>
            ))}
          </select>
        </Campo>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        <button className="btn btn-primario" type="submit" disabled={enviando || cargandoFicha}>
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </button>
      </form>

      <div className="columna">
        {seguimiento ? (
          <article className="tarjeta" ref={detalleRef}>
            <DetalleVecino reclamo={seguimiento} />
          </article>
        ) : (
          <article className="tarjeta">
            <h2>Seguimiento</h2>
            <p className="bajada">Cuando envíes un reclamo, acá vas a ver en qué está.</p>
          </article>
        )}

        <article className="tarjeta">
          <h2>Mis reclamos</h2>
          {historial.length === 0 ? (
            <p className="bajada">Todavía no enviaste ninguno.</p>
          ) : (
            <ul className="lista-simple">
              {historial.map((reclamo) => (
                <li key={reclamo.id}>
                  <button
                    type="button"
                    className={`item-lista ${seguimiento?.id === reclamo.id ? 'activo' : ''}`}
                    onClick={() => setSeguimiento(reclamo)}
                  >
                    <PastillaEstado estado={reclamo.estado} texto={ESTADO_VECINO[reclamo.estado]} />
                    {reclamo.tieneImagen ? <MiniFoto id={reclamo.id} /> : null}
                    <span className="item-lista-titulo">{reclamo.titulo.trim() || reclamo.descripcion.trim()}</span>
                    {reclamo.descripcion.trim() && reclamo.descripcion.trim() !== reclamo.titulo.trim() ? (
                      <small>{reclamo.descripcion}</small>
                    ) : null}
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
          <h2>Buscar un reclamo</h2>
          <p className="bajada">Si te pasaron un número de seguimiento, pegalo acá.</p>
          <Campo etiqueta="Número de seguimiento">
            <input
              required
              spellCheck={false}
              value={consultaId}
              onChange={(evento) => setConsultaId(evento.target.value)}
              placeholder="Pegá el número"
            />
          </Campo>
          {errorConsulta ? <Aviso tono="error">{errorConsulta}</Aviso> : null}
          <button className="btn btn-secundario" type="submit">
            Ver estado
          </button>
          {consulta ? <DetalleVecino reclamo={consulta} /> : null}
        </form>
      </div>
    </div>
  )
}

function DetalleVecino({ reclamo }: { reclamo: Reclamo }) {
  const titulo = reclamo.titulo.trim()
  return (
    <div className="detalle-reclamo">
      <div className="detalle-cuerpo">
        {reclamo.tieneImagen ? <FotoReclamo id={reclamo.id} descripcion={reclamo.descripcion} /> : null}
        <div className="fila-meta">
          <h2>{titulo || reclamo.descripcion.trim()}</h2>
          {reclamo.urgente ? <span className="pastilla urgente">Urgente</span> : null}
        </div>
        {titulo && !reclamo.tieneImagen ? <p className="relato">{reclamo.descripcion}</p> : null}
        <p>
          {ETIQUETA_TIPO[reclamo.tipo]} · {reclamo.ubicacion.direccion}
          {reclamo.barrio ? ` · ${reclamo.barrio}` : ''}
        </p>
        <p>Alcance: {reclamo.alcance ? ETIQUETA_ALCANCE[reclamo.alcance] : 'Sin especificar'}</p>
        {reclamo.estado === 'DUPLICADO' ? (
          <p className="bajada">Ya había un reclamo igual en la zona. Vamos a seguir ese.</p>
        ) : reclamo.cuadrillaId ? (
          <p className="bajada">Hay un equipo a cargo.</p>
        ) : null}
        <p className="meta seguimiento-numero">
          Número de seguimiento
          <span>{reclamo.id}</span>
          <Copiar valor={reclamo.id} />
        </p>
        <p className="meta">Actualizado {formatearFecha(reclamo.fechaActualizacion)}</p>
      </div>
      <aside className="detalle-estados">
        <details className="lista-abrible" open>
          <summary>
            <span>Estado</span>
            <PastillaEstado estado={reclamo.estado} texto={ESTADO_VECINO[reclamo.estado]} />
          </summary>
          <Pasos reclamo={reclamo} />
        </details>
      </aside>
    </div>
  )
}

function Pasos({ reclamo }: { reclamo: Reclamo }) {
  const duplicado = reclamo.estado === 'DUPLICADO'
  const revisado = reclamo.estado !== 'NUEVO' || reclamo.scoreCriticidad > 0
  const conEquipo = Boolean(reclamo.cuadrillaId)
  const esperandoEquipo = revisado && !duplicado && !conEquipo && reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'RECHAZADO'
  return (
    <ol className="pasos">
      <li className="hecho">Recibimos tu reclamo.</li>
      <li className={revisado ? 'hecho' : 'espera'}>
        {duplicado
          ? 'Encontramos uno igual que ya estaba cargado.'
          : revisado
            ? 'Ya lo revisamos.'
            : 'Lo estamos revisando.'}
      </li>
      <li className={duplicado || conEquipo || reclamo.estado === 'RESUELTO' ? 'hecho' : 'espera'}>
        {duplicado
          ? 'No hace falta mandar otro equipo.'
          : reclamo.estado === 'RESUELTO'
            ? 'Quedó resuelto.'
            : reclamo.estado === 'RECHAZADO'
              ? 'Se cerró sin intervención.'
              : conEquipo
                ? 'Hay un equipo trabajando en esto.'
                : esperandoEquipo
                  ? 'Todavía no hay un equipo libre. Te avisamos cuando se asigne.'
                  : 'El equipo se asigna después de la revisión.'}
      </li>
    </ol>
  )
}

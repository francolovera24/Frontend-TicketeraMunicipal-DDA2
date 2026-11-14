import { useEffect, useRef, useState } from 'react'
import {
  actualizarMiPerfil,
  ApiError,
  asistirReclamo,
  crearCiudadano,
  crearReclamo,
  geocodificarDireccion,
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
import { BARRIOS, ETIQUETA_ALCANCE, ETIQUETA_TIPO, formatearFecha, normalizarBarrio, TIPOS } from '../catalogo.ts'
import type { Sesion } from '../sesion.ts'
import { Aviso, Campo, Copiar, Encabezado, Estadistica, FotoReclamo, Icono, MiniFoto, Panel, PastillaEstado } from '../ui.tsx'

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

export function VistaVecino({
  sesion,
  avisoAdmin,
  perfilAbierto,
  onCerrarPerfil,
}: {
  sesion: Sesion | null
  avisoAdmin?: boolean
  perfilAbierto: boolean
  onCerrarPerfil: () => void
}) {
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

  const [formAbierto, setFormAbierto] = useState(false)
  const [seguimientoAbierto, setSeguimientoAbierto] = useState(false)
  const [buscarAbierto, setBuscarAbierto] = useState(false)

  const [perfilNombre, setPerfilNombre] = useState('')
  const [perfilApellido, setPerfilApellido] = useState('')
  const [perfilContacto, setPerfilContacto] = useState('')
  const [perfilDireccion, setPerfilDireccion] = useState('')
  const [perfilGuardando, setPerfilGuardando] = useState(false)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [perfilOk, setPerfilOk] = useState(false)

  const [pasoForm, setPasoForm] = useState<'redactar' | 'confirmar'>('redactar')
  const [relato, setRelato] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null)
  const [avisoIa, setAvisoIa] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [avisoDireccion, setAvisoDireccion] = useState<string | null>(null)

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
    setAvisoDireccion(null)
    const direccionLimpia = direccion.trim()
    if (!barrio || direccionLimpia.length < 6) return
    let cancelado = false
    const timer = window.setTimeout(() => {
      void geocodificarDireccion(direccionLimpia)
        .then((geo) => {
          if (cancelado || !geo.barrio) return
          if (normalizarBarrio(geo.barrio) !== normalizarBarrio(barrio)) {
            setAvisoDireccion(
              `Esa dirección parece estar en ${geo.barrio}, no en ${barrio}. Revisala o elegí el barrio correcto.`,
            )
          }
        })
        .catch(() => undefined)
    }, 900)
    return () => {
      cancelado = true
      window.clearTimeout(timer)
    }
  }, [direccion, barrio])

  useEffect(() => {
    if (!perfilAbierto) return
    setPerfilNombre(ficha?.nombre ?? nombre)
    setPerfilApellido(ficha?.apellido ?? '')
    setPerfilContacto(ficha?.contacto ?? contacto)
    setPerfilDireccion(ficha?.direccion ?? '')
    setPerfilError(null)
    setPerfilOk(false)
    // Solo al abrir: no queremos pisar lo que el vecino está tipeando con cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilAbierto])

  async function guardarPerfil(evento: React.FormEvent) {
    evento.preventDefault()
    if (!sesion) return
    setPerfilError(null)
    setPerfilOk(false)
    setPerfilGuardando(true)
    try {
      const actualizado = await actualizarMiPerfil(sesion.token, {
        nombre: perfilNombre.trim(),
        apellido: perfilApellido.trim() || null,
        contacto: perfilContacto.trim(),
        direccion: perfilDireccion.trim() || null,
      })
      setFicha(actualizado)
      setNombre(actualizado.nombre)
      setContacto(actualizado.contacto)
      setPerfilOk(true)
    } catch (fallo) {
      setPerfilError(textoError(fallo))
    } finally {
      setPerfilGuardando(false)
    }
  }

  async function analizar(evento: React.FormEvent) {
    evento.preventDefault()
    setErrorAnalisis(null)
    if (!relato.trim()) {
      setErrorAnalisis('Contanos qué está pasando.')
      return
    }
    setAnalizando(true)
    try {
      const borrador = await asistirReclamo(relato.trim(), foto?.base64, foto?.tipo)
      setTipo(borrador.tipo ?? tipo)
      setTitulo(borrador.titulo ?? '')
      setDescripcion(borrador.descripcion ?? relato.trim())
      setAlcance(borrador.alcance ?? '')
      setAvisoIa(
        borrador.generadoPorIa
          ? { ok: true, mensaje: 'Esto es lo que entendimos. Revisalo y corregí lo que haga falta antes de enviar.' }
          : { ok: false, mensaje: 'No pudimos usar el asistente ahora. Completá o corregí los campos a mano.' },
      )
      setPasoForm('confirmar')
    } catch (fallo) {
      setErrorAnalisis(textoError(fallo))
    } finally {
      setAnalizando(false)
    }
  }

  function saltarAsistente() {
    setTitulo('')
    setDescripcion(relato.trim())
    setAlcance('')
    setAvisoIa(null)
    setErrorAnalisis(null)
    setPasoForm('confirmar')
  }

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
      setFormAbierto(false)
      setSeguimientoAbierto(true)
      setPasoForm('redactar')
      setRelato('')
      setAvisoIa(null)
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

  const enCurso = historial.filter(
    (item) => item.estado !== 'RESUELTO' && item.estado !== 'RECHAZADO' && item.estado !== 'DUPLICADO',
  ).length
  const resueltos = historial.filter((item) => item.estado === 'RESUELTO').length

  return (
    <div className="columna">
      <div className="grilla-2 grilla-2-vecino">
        <section className="tarjeta hero-vecino">
          <h1>{nombre.trim() ? `Hola, ${nombre.trim().split(' ')[0]}` : 'Hola, vecino'}</h1>
          <p className="bajada">
            {avisoAdmin
              ? 'Desde acá podés cargar un reclamo como lo haría un vecino.'
              : 'Contanos qué está pasando y dónde. Después vas a poder seguir el estado desde acá.'}
          </p>
          {historial.length > 0 ? (
            <div className="stats-fila">
              <Estadistica etiqueta="Reclamos" valor={historial.length} />
              <Estadistica etiqueta="En curso" valor={enCurso} tono="acento" />
              <Estadistica etiqueta="Resueltos" valor={resueltos} tono="ok" />
            </div>
          ) : null}
          <div className="hero-vecino__acciones">
            <button
              className="btn btn-primario"
              type="button"
              onClick={() => {
                setPasoForm('redactar')
                setFormAbierto(true)
              }}
            >
              <Icono nombre="nuevo" /> Reportar un problema
            </button>
            <button className="btn btn-secundario" type="button" onClick={() => setBuscarAbierto(true)}>
              <Icono nombre="buscar" /> Tengo un número de seguimiento
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <Encabezado
            titulo="Mis reclamos"
            descripcion={historial.length > 0 ? 'Tocá uno para ver en qué está.' : undefined}
          />
          {historial.length === 0 ? (
            <p className="bajada">Todavía no enviaste ninguno.</p>
          ) : (
            <ul className="lista-simple">
              {historial.map((reclamo) => (
                <li key={reclamo.id}>
                  <button
                    type="button"
                    className="item-lista"
                    onClick={() => {
                      setSeguimiento(reclamo)
                      setSeguimientoAbierto(true)
                    }}
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
        </section>
      </div>

      <Panel abierto={formAbierto} onCerrar={() => setFormAbierto(false)} titulo="Nuevo reclamo" ancho="l">
        {pasoForm === 'redactar' ? (
          <form className="formulario" onSubmit={(evento) => void analizar(evento)}>
            <p className="bajada">
              {avisoAdmin
                ? 'Desde acá podés cargar un reclamo como lo haría un vecino.'
                : 'Contanos qué está pasando, con tus palabras. Un asistente ordena los datos y te los muestra antes de enviarlos.'}
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

            <Campo etiqueta="Contanos qué está pasando" hint="Escribilo como quieras: lo ordenamos nosotros.">
              <textarea
                required
                maxLength={1000}
                rows={5}
                value={relato}
                onChange={(evento) => setRelato(evento.target.value)}
                placeholder="Hay un cable pelado colgando del poste de la esquina, a la altura de un auto…"
              />
            </Campo>
            <Campo etiqueta="Foto" hint="Opcional. El asistente la usa para ver el daño y afinar el análisis.">
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
                      setErrorAnalisis(null)
                    })
                    .catch((fallo: unknown) => {
                      setErrorAnalisis(fallo instanceof Error ? fallo.message : 'No se pudo leer la foto.')
                    })
                }}
              />
            </Campo>
            {foto ? (
              <div className="foto-elegida">
                <img src={foto.vista} alt="Vista previa de la foto" />
                <div>
                  <p className={relato.trim() ? 'foto-elegida-texto' : 'bajada'}>
                    {relato.trim() || 'Contá arriba qué se ve en la foto.'}
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
            {avisoDireccion ? <Aviso tono="aviso">{avisoDireccion}</Aviso> : null}
            {errorAnalisis ? <Aviso tono="error">{errorAnalisis}</Aviso> : null}
            <button className="btn btn-primario" type="submit" disabled={analizando || cargandoFicha}>
              {analizando ? 'Analizando tu reclamo…' : 'Analizar con el asistente'}
            </button>
            <button type="button" className="btn btn-texto" onClick={saltarAsistente} disabled={analizando}>
              Prefiero completar el formulario a mano
            </button>
          </form>
        ) : (
          <form className="formulario" onSubmit={(evento) => void enviar(evento)}>
            {avisoIa ? <Aviso tono={avisoIa.ok ? 'ok' : 'info'}>{avisoIa.mensaje}</Aviso> : null}
            <div className="foto-elegida">
              {foto ? <img src={foto.vista} alt="Vista previa de la foto" /> : null}
              <p className="meta">
                {direccion}
                {barrio ? ` · ${barrio}` : ''}
              </p>
            </div>

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
            {error ? <Aviso tono="error">{error}</Aviso> : null}
            <div className="hero-vecino__acciones">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setPasoForm('redactar')}
                disabled={enviando}
              >
                Volver
              </button>
              <button className="btn btn-primario" type="submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Confirmar y enviar'}
              </button>
            </div>
          </form>
        )}
      </Panel>

      <Panel abierto={seguimientoAbierto} onCerrar={() => setSeguimientoAbierto(false)} titulo="Seguimiento">
        {seguimiento ? <DetalleVecino reclamo={seguimiento} /> : null}
      </Panel>

      <Panel abierto={buscarAbierto} onCerrar={() => setBuscarAbierto(false)} titulo="Buscar un reclamo">
        <form className="formulario" onSubmit={(evento) => void buscar(evento)}>
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
        </form>
        {consulta ? <DetalleVecino reclamo={consulta} /> : null}
      </Panel>

      <Panel abierto={perfilAbierto} onCerrar={onCerrarPerfil} titulo="Mi perfil">
        <form className="formulario" onSubmit={(evento) => void guardarPerfil(evento)}>
          <p className="bajada">
            Estos son el nombre y el contacto que se usan para precargar tus reclamos.
          </p>
          <Campo etiqueta="Email de tu cuenta">
            <input value={sesion?.email ?? ''} disabled readOnly />
          </Campo>
          <Campo etiqueta="Rol">
            <input value="Vecino" disabled readOnly />
          </Campo>
          <Campo etiqueta="Nombre">
            <input
              required
              maxLength={150}
              value={perfilNombre}
              onChange={(evento) => setPerfilNombre(evento.target.value)}
            />
          </Campo>
          <Campo etiqueta="Apellido" hint="Opcional.">
            <input
              maxLength={150}
              value={perfilApellido}
              onChange={(evento) => setPerfilApellido(evento.target.value)}
            />
          </Campo>
          <Campo etiqueta="Contacto" hint="Un mail o un teléfono para poder avisarte.">
            <input
              required
              maxLength={150}
              value={perfilContacto}
              onChange={(evento) => setPerfilContacto(evento.target.value)}
            />
          </Campo>
          <Campo etiqueta="Dónde vivís" hint="Opcional. No es la dirección de un reclamo puntual.">
            <input
              maxLength={255}
              value={perfilDireccion}
              onChange={(evento) => setPerfilDireccion(evento.target.value)}
              placeholder="Av. Santa Fe 3200"
            />
          </Campo>
          {perfilError ? <Aviso tono="error">{perfilError}</Aviso> : null}
          {perfilOk ? <Aviso tono="ok">Guardamos los cambios.</Aviso> : null}
          <button className="btn btn-primario" type="submit" disabled={perfilGuardando}>
            {perfilGuardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </Panel>
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

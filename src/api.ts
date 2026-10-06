export type Rol = 'ADMIN' | 'VECINO'

export type TipoReclamo = 'CABLEADO' | 'BACHEO' | 'ALUMBRADO' | 'ARBOLADO' | 'RUIDOS_MOLESTOS'

export type EstadoReclamo =
  | 'NUEVO'
  | 'EN_ANALISIS'
  | 'ASIGNADO'
  | 'EN_PROCESO'
  | 'RESUELTO'
  | 'RECHAZADO'
  | 'DUPLICADO'

export type Reclamo = {
  id: string
  tipo: TipoReclamo
  titulo: string
  descripcion: string
  estado: EstadoReclamo
  urgente: boolean
  scoreCriticidad: number
  ubicacion: { direccion: string; lat: number | null; lon: number | null }
  barrio: string
  ciudadanoId: string
  cuadrillaId: string | null
  reclamoOriginalId: string | null
  fechaCreacion: string
  fechaActualizacion: string
}

export type Ciudadano = {
  id: string
  nombre: string
  contacto: string
}

export type Usuario = {
  id: string
  email: string
  rol: Rol
}

export type TokenEmitido = {
  token: string
  tipo: string
  expira: string
}

export type Cuadrilla = {
  id: string
  nombre: string
  especialidad: TipoReclamo
  disponible: boolean
}

export type ItemRanking = {
  reclamoId: string
  tipo: TipoReclamo
  titulo: string
  descripcion: string
  direccion: string
  estado: EstadoReclamo
  urgente: boolean
  antiguedadHoras: number
  score: number
}

export type ResumenZona = {
  barrio: string
  tipo: TipoReclamo | null
  desde: string | null
  textoResumen: string
  timestampGeneracion: string
  generadoPorIa: boolean
  ranking: ItemRanking[]
}

export type ErrorCampo = {
  campo: string
  mensaje: string
}

const BASE = '/api'

export class ApiError extends Error {
  readonly status: number
  readonly titulo: string
  readonly errores: ErrorCampo[]

  constructor(status: number, titulo: string, detalle: string, errores: ErrorCampo[] = []) {
    const campos = errores.map((error) => `${error.campo}: ${error.mensaje}`).join(' · ')
    super(campos ? `${detalle} (${campos})` : detalle)
    this.name = 'ApiError'
    this.status = status
    this.titulo = titulo
    this.errores = errores
  }
}

export function textoError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) {
    return 'No hay conexión con el backend. Levantalo en la carpeta ticketera con docker compose up (puerto 8080).'
  }
  return 'Ocurrió un error inesperado.'
}

export function esNoAutorizado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

type Problema = {
  title?: string
  detail?: string
  errores?: ErrorCampo[]
}

function esProblema(valor: unknown): valor is Problema {
  return typeof valor === 'object' && valor !== null
}

function parsearJson(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return null
  }
}

async function pedir<T>(
  path: string,
  opciones: {
    method?: string
    body?: unknown
    token?: string | null
    headers?: Record<string, string>
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opciones.headers,
  }
  if (opciones.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opciones.token) headers.Authorization = `Bearer ${opciones.token}`

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${path}`, {
      method: opciones.method ?? (opciones.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    })
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('No se pudo contactar al backend')
  }

  const texto = await respuesta.text()
  const datos = texto ? parsearJson(texto) : null

  if (!respuesta.ok) {
    if (esProblema(datos) && (datos.title || datos.detail)) {
      throw new ApiError(
        respuesta.status,
        datos.title ?? 'Error',
        datos.detail ?? respuesta.statusText,
        Array.isArray(datos.errores) ? datos.errores : [],
      )
    }
    if (respuesta.status >= 500) {
      throw new TypeError('backend caido')
    }
    throw new ApiError(respuesta.status, 'Error', texto || respuesta.statusText)
  }

  return datos as T
}

function consulta(params: Record<string, string | undefined>): string {
  const busqueda = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) busqueda.set(clave, valor)
  }
  const texto = busqueda.toString()
  return texto ? `?${texto}` : ''
}

export function comprobarBackend(): Promise<boolean> {
  return fetch(`${BASE}/v3/api-docs`)
    .then((respuesta) => respuesta.ok)
    .catch(() => false)
}

export function registrar(email: string, password: string): Promise<Usuario> {
  return pedir<Usuario>('/auth/registro', { method: 'POST', body: { email, password } })
}

export function login(email: string, password: string): Promise<TokenEmitido> {
  return pedir<TokenEmitido>('/auth/login', { method: 'POST', body: { email, password } })
}

export function crearCiudadano(nombre: string, contacto: string, token?: string | null): Promise<Ciudadano> {
  return pedir<Ciudadano>('/ciudadanos', {
    method: 'POST',
    body: { nombre, contacto },
    token,
  })
}

export function miCiudadano(token: string): Promise<Ciudadano> {
  return pedir<Ciudadano>('/ciudadanos/yo', { token })
}

export function obtenerCiudadano(token: string, id: string): Promise<Ciudadano> {
  return pedir<Ciudadano>(`/ciudadanos/${id}`, { token })
}

export function historialCiudadano(token: string, id: string): Promise<Reclamo[]> {
  return pedir<Reclamo[]>(`/ciudadanos/${id}/reclamos`, { token })
}

export type AltaReclamo = {
  ciudadanoId: string
  tipo: TipoReclamo
  titulo: string
  descripcion: string
  direccion: string
  lat?: number
  lon?: number
  barrio?: string
}

export function crearReclamo(alta: AltaReclamo, correlationId: string, token?: string | null): Promise<Reclamo> {
  const body: Record<string, unknown> = {
    ciudadanoId: alta.ciudadanoId,
    tipo: alta.tipo,
    titulo: alta.titulo,
    descripcion: alta.descripcion,
    direccion: alta.direccion,
  }
  if (alta.lat !== undefined) body.lat = alta.lat
  if (alta.lon !== undefined) body.lon = alta.lon
  if (alta.barrio) body.barrio = alta.barrio
  return pedir<Reclamo>('/reclamos', {
    method: 'POST',
    body,
    token,
    headers: { 'X-Correlation-Id': correlationId },
  })
}

export function obtenerReclamo(id: string): Promise<Reclamo> {
  return pedir<Reclamo>(`/reclamos/${id}`)
}

export function listarReclamos(token: string, barrio?: string): Promise<Reclamo[]> {
  return pedir<Reclamo[]>(`/reclamos${consulta({ barrio })}`, { token })
}

export function cambiarEstado(token: string, id: string, estado: EstadoReclamo): Promise<Reclamo> {
  return pedir<Reclamo>(`/reclamos/${id}/estado`, {
    method: 'PUT',
    token,
    body: { estado },
  })
}

export function asignarCuadrilla(token: string, reclamoId: string, cuadrillaId: string): Promise<Reclamo> {
  return pedir<Reclamo>(`/reclamos/${reclamoId}/asignar-cuadrilla`, {
    method: 'PUT',
    token,
    body: { cuadrillaId },
  })
}

export function listarCuadrillas(
  token: string,
  especialidad?: string,
  disponible?: string,
): Promise<Cuadrilla[]> {
  return pedir<Cuadrilla[]>(`/cuadrillas${consulta({ especialidad, disponible })}`, { token })
}

export function obtenerResumen(
  token: string,
  barrio: string,
  tipo?: string,
  desde?: string,
): Promise<ResumenZona> {
  return pedir<ResumenZona>(`/resumen-zona${consulta({ barrio, tipo, desde })}`, { token })
}

export async function consultarEstadoSoap(id: string): Promise<{ status: number; xml: string }> {
  const idXml = id
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  const sobre = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:rec="http://municipio.com/ticketera/reclamos">
  <soapenv:Body>
    <rec:consultarEstadoReclamoRequest>
      <rec:id>${idXml}</rec:id>
    </rec:consultarEstadoReclamoRequest>
  </soapenv:Body>
</soapenv:Envelope>`

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}/ws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'text/xml, application/xml, text/plain',
      },
      body: sobre,
    })
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('No se pudo contactar al backend')
  }

  return { status: respuesta.status, xml: await respuesta.text() }
}

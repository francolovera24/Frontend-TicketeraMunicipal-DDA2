import type { Rol } from './api.ts'

export type Sesion = {
  token: string
  expira: string
  email: string
  rol: Rol
  usuarioId: string
}

const CLAVE = 'ticketera.sesion'

type PayloadJwt = {
  sub?: string
  email?: string
  rol?: string
  exp?: number
}

function esRol(valor: unknown): valor is Rol {
  return valor === 'ADMIN' || valor === 'VECINO'
}

export function decodificarJwt(token: string): PayloadJwt {
  const parte = token.split('.')[1]
  if (!parte) throw new Error('El token no tiene el formato esperado')
  const json = atob(parte.replaceAll('-', '+').replaceAll('_', '/'))
  return JSON.parse(json) as PayloadJwt
}

export function sesionDesdeToken(token: string, expira: string): Sesion {
  const payload = decodificarJwt(token)
  if (!payload.sub || !payload.email || !esRol(payload.rol)) {
    throw new Error('El token no trae email o rol')
  }
  return {
    token,
    expira,
    email: payload.email,
    rol: payload.rol,
    usuarioId: payload.sub,
  }
}

export function leerSesion(): Sesion | null {
  const crudo = localStorage.getItem(CLAVE)
  if (!crudo) return null
  try {
    const sesion = JSON.parse(crudo) as Sesion
    const payload = decodificarJwt(sesion.token)
    if (!payload.exp || payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(CLAVE)
      return null
    }
    return sesion
  } catch {
    localStorage.removeItem(CLAVE)
    return null
  }
}

export function guardarSesion(sesion: Sesion): void {
  localStorage.setItem(CLAVE, JSON.stringify(sesion))
}

export function borrarSesion(): void {
  localStorage.removeItem(CLAVE)
}

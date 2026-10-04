import type { EstadoReclamo, TipoReclamo } from './api.ts'

export const BARRIOS = [
  'Agronomía',
  'Almagro',
  'Balvanera',
  'Barracas',
  'Belgrano',
  'Boedo',
  'Caballito',
  'Chacarita',
  'Coghlan',
  'Colegiales',
  'Constitución',
  'Flores',
  'Floresta',
  'La Boca',
  'La Paternal',
  'Liniers',
  'Mataderos',
  'Monte Castro',
  'Monserrat',
  'Nueva Pompeya',
  'Núñez',
  'Palermo',
  'Parque Avellaneda',
  'Parque Chacabuco',
  'Parque Chas',
  'Parque Patricios',
  'Puerto Madero',
  'Recoleta',
  'Retiro',
  'Saavedra',
  'San Cristóbal',
  'San Nicolás',
  'San Telmo',
  'Vélez Sarsfield',
  'Versalles',
  'Villa Crespo',
  'Villa del Parque',
  'Villa Devoto',
  'Villa General Mitre',
  'Villa Lugano',
  'Villa Luro',
  'Villa Ortúzar',
  'Villa Pueyrredón',
  'Villa Real',
  'Villa Riachuelo',
  'Villa Santa Rita',
  'Villa Soldati',
  'Villa Urquiza',
] as const

export const TIPOS: { id: TipoReclamo; etiqueta: string; nota: string }[] = [
  {
    id: 'CABLEADO',
    etiqueta: 'Cableado',
    nota: 'Peso de riesgo 10. La fábrica lo crea urgente.',
  },
  { id: 'BACHEO', etiqueta: 'Bacheo', nota: 'Peso de riesgo 5. Estrategia propia de criticidad.' },
  { id: 'ALUMBRADO', etiqueta: 'Alumbrado', nota: 'Peso de riesgo 6. Usa la estrategia genérica.' },
  { id: 'ARBOLADO', etiqueta: 'Arbolado', nota: 'Peso de riesgo 2. Usa la estrategia genérica.' },
  { id: 'RUIDOS_MOLESTOS', etiqueta: 'Ruidos molestos', nota: 'Peso de riesgo 3. Usa la estrategia genérica.' },
]

export const ETIQUETA_ESTADO: Record<EstadoReclamo, string> = {
  NUEVO: 'Nuevo',
  EN_ANALISIS: 'En análisis',
  ASIGNADO: 'Asignado',
  EN_PROCESO: 'En proceso',
  RESUELTO: 'Resuelto',
  RECHAZADO: 'Rechazado',
  DUPLICADO: 'Duplicado',
}

export const ETIQUETA_TIPO: Record<TipoReclamo, string> = {
  CABLEADO: 'Cableado',
  BACHEO: 'Bacheo',
  ALUMBRADO: 'Alumbrado',
  ARBOLADO: 'Arbolado',
  RUIDOS_MOLESTOS: 'Ruidos molestos',
}

/**
 * Transiciones de PUT /reclamos/{id}/estado.
 * ASIGNADO solo sale de asignar una cuadrilla; DUPLICADO lo marca SvcIA al validar.
 * Pedirlos por este endpoint devuelve 409.
 */
export function destinosManuales(estado: EstadoReclamo): EstadoReclamo[] {
  switch (estado) {
    case 'NUEVO':
      return ['EN_ANALISIS', 'RECHAZADO']
    case 'EN_ANALISIS':
      return ['RECHAZADO']
    case 'ASIGNADO':
      return ['EN_PROCESO', 'RESUELTO']
    case 'EN_PROCESO':
      return ['RESUELTO']
    default:
      return []
  }
}

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(fecha)
}

export function recortar(id: string): string {
  return id.slice(0, 8)
}

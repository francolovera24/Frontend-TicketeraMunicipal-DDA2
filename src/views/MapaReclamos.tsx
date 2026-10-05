import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Reclamo } from '../api.ts'
import { BARRIOS, COLOR_TIPO, ETIQUETA_ESTADO, ETIQUETA_TIPO, TIPOS } from '../catalogo.ts'
import { Campo } from '../ui.tsx'

const CENTRO_CABA: L.LatLngExpression = [-34.61, -58.44]

type Limites = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: { barrio: string }
    geometry: GeoJSON.Geometry
  }>
}

let limitesGuardados: Promise<Limites> | null = null

function cargarLimites(): Promise<Limites> {
  limitesGuardados ??= fetch('/barrios.geojson').then((respuesta) => {
    if (!respuesta.ok) throw new Error('No se pudieron cargar los límites de los barrios')
    return respuesta.json() as Promise<Limites>
  })
  return limitesGuardados
}

/** Iguala el nombre del catálogo con el del GeoJSON oficial (datos abiertos GCBA). */
function claveBarrio(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replaceAll('.', '')
    .replaceAll(/\s+/g, ' ')
    .trim()
  if (base === 'LA BOCA') return 'BOCA'
  if (base === 'LA PATERNAL') return 'PATERNAL'
  if (base === 'VILLA GENERAL MITRE') return 'VILLA GRAL MITRE'
  return base
}

function escapar(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function MapaReclamos({
  reclamos,
  seleccionadoId,
  onElegir,
  tipo,
  onTipo,
  barrio,
  onBarrio,
}: {
  reclamos: Reclamo[]
  seleccionadoId: string | null
  onElegir: (id: string) => void
  tipo: string
  onTipo: (tipo: string) => void
  barrio: string
  onBarrio: (barrio: string) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.LayerGroup | null>(null)
  const contorno = useRef<L.GeoJSON | null>(null)
  const firma = useRef('')
  const elegir = useRef(onElegir)
  const puntos = useRef(reclamos)
  const barrioActual = useRef(barrio)
  elegir.current = onElegir
  puntos.current = reclamos
  barrioActual.current = barrio

  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo || mapa.current) return
    const instancia = L.map(nodo, { scrollWheelZoom: true }).setView(CENTRO_CABA, 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(instancia)
    capa.current = L.layerGroup().addTo(instancia)
    mapa.current = instancia
    const ajustar = window.setTimeout(() => instancia.invalidateSize(), 0)
    return () => {
      window.clearTimeout(ajustar)
      instancia.remove()
      mapa.current = null
      capa.current = null
      contorno.current = null
      firma.current = ''
    }
  }, [])

  useEffect(() => {
    const grupo = capa.current
    const instancia = mapa.current
    if (!grupo || !instancia) return
    grupo.clearLayers()
    const posiciones: L.LatLngExpression[] = []
    for (const reclamo of reclamos) {
      const lat = reclamo.ubicacion.lat
      const lon = reclamo.ubicacion.lon
      if (lat == null || lon == null) continue
      posiciones.push([lat, lon])
      const elegido = reclamo.id === seleccionadoId
      const marca = L.circleMarker([lat, lon], {
        radius: elegido ? 11 : 8,
        color: elegido ? '#1c1915' : '#fffcf7',
        weight: elegido ? 3 : 2,
        fillColor: COLOR_TIPO[reclamo.tipo],
        fillOpacity: 0.95,
      })
      marca.bindPopup(
        `<strong>${escapar(ETIQUETA_TIPO[reclamo.tipo])}</strong> · ${escapar(ETIQUETA_ESTADO[reclamo.estado])}<br>${escapar(reclamo.ubicacion.direccion)}<br>${escapar(reclamo.descripcion)}`,
      )
      marca.on('click', () => elegir.current(reclamo.id))
      marca.addTo(grupo)
    }
    const ids = reclamos.map((reclamo) => reclamo.id).join('|')
    if (ids !== firma.current) {
      firma.current = ids
      if (!barrioActual.current) {
        if (posiciones.length === 1) instancia.setView(posiciones[0], 15)
        else if (posiciones.length > 1) instancia.fitBounds(L.latLngBounds(posiciones), { padding: [32, 32], maxZoom: 15 })
        else instancia.setView(CENTRO_CABA, 12)
      }
    }
  }, [reclamos, seleccionadoId])

  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    contorno.current?.remove()
    contorno.current = null
    if (!barrio) return
    let cancelado = false
    void cargarLimites()
      .then((coleccion) => {
        if (cancelado || mapa.current !== instancia) return
        const buscado = claveBarrio(barrio)
        const feature = coleccion.features.find((item) => claveBarrio(item.properties.barrio) === buscado)
        if (!feature) return
        const borde = L.geoJSON(feature, {
          style: {
            color: '#0f4c5c',
            weight: 3,
            dashArray: '7 7',
            fillColor: '#0f4c5c',
            fillOpacity: 0.06,
            interactive: false,
          },
        })
        borde.addTo(instancia)
        borde.bringToBack()
        contorno.current = borde
        const bounds = borde.getBounds()
        if (bounds.isValid()) instancia.fitBounds(bounds, { padding: [28, 28] })
      })
      .catch(() => undefined)
    return () => {
      cancelado = true
    }
  }, [barrio])

  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !seleccionadoId) return
    const reclamo = puntos.current.find((item) => item.id === seleccionadoId)
    if (reclamo?.ubicacion.lat == null || reclamo.ubicacion.lon == null) return
    instancia.panTo([reclamo.ubicacion.lat, reclamo.ubicacion.lon])
  }, [seleccionadoId])

  return (
    <section className="tarjeta mapa-panel">
      <div className="encabezado-panel">
        <h2>Mapa</h2>
        <p className="meta">{reclamos.length === 1 ? '1 punto' : `${reclamos.length} puntos`}</p>
      </div>
      <div className="fila-2">
        <Campo etiqueta="Problema">
          <select value={tipo} onChange={(evento) => onTipo(evento.target.value)}>
            <option value="">Todos</option>
            {TIPOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Barrio">
          <select value={barrio} onChange={(evento) => onBarrio(evento.target.value)}>
            <option value="">Todos</option>
            {BARRIOS.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <ul className="leyenda">
        {TIPOS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={tipo === item.id ? 'activo' : ''}
              aria-pressed={tipo === item.id}
              onClick={() => onTipo(tipo === item.id ? '' : item.id)}
            >
              <span className="punto-leyenda" style={{ background: COLOR_TIPO[item.id] }} />
              {item.etiqueta}
            </button>
          </li>
        ))}
      </ul>
      <div ref={contenedor} className="mapa-lienzo" />
      <p className="bajada">
        Al elegir un barrio se marca su límite con una línea punteada. Los duplicados no se marcan, ni los reclamos
        sin coordenadas.
      </p>
    </section>
  )
}

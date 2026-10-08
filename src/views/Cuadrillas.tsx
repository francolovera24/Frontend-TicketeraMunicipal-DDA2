import { useCallback, useEffect, useState } from 'react'
import {
  esNoAutorizado,
  listarCuadrillas,
  listarReclamos,
  textoError,
  type Cuadrilla,
  type Reclamo,
  type TipoReclamo,
} from '../api.ts'
import { ETIQUETA_TIPO, TIPOS } from '../catalogo.ts'
import { Aviso, Campo } from '../ui.tsx'
import { DetalleReclamo } from './Reclamos.tsx'

function textoEnlace(reclamo: Reclamo): string {
  const titulo = reclamo.titulo.trim()
  if (titulo) return titulo
  return reclamo.descripcion.trim()
}

function reclamoEnCurso(reclamos: Reclamo[], equipoId: string): Reclamo | null {
  const enCurso = reclamos.filter(
    (reclamo) =>
      reclamo.cuadrillaId === equipoId && (reclamo.estado === 'ASIGNADO' || reclamo.estado === 'EN_PROCESO'),
  )
  enCurso.sort((a, b) => b.fechaActualizacion.localeCompare(a.fechaActualizacion))
  return enCurso[0] ?? null
}

export function PanelCuadrillas({
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
  const [especialidad, setEspecialidad] = useState('')
  const [disponible, setDisponible] = useState('')
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([])
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [equipos, lista] = await Promise.all([
        listarCuadrillas(token, especialidad || undefined, disponible || undefined),
        listarReclamos(token),
      ])
      setCuadrillas(equipos)
      setReclamos(lista)
      setError(null)
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    }
  }, [token, especialidad, disponible, onExpirar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const seleccionado = reclamos.find((item) => item.id === seleccionadoId) ?? null

  return (
    <div className="columna">
      <section className="tarjeta">
        <h2>Equipos</h2>
        <p className="bajada">
          Cada reclamo toma un equipo libre de su problema. Si está ocupado, abrí el mismo detalle que en Reclamos.
        </p>
        <div className="fila-2">
          <Campo etiqueta="Problema">
            <select value={especialidad} onChange={(evento) => setEspecialidad(evento.target.value)}>
              <option value="">Todas</option>
              {TIPOS.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Disponibilidad">
            <select value={disponible} onChange={(evento) => setDisponible(evento.target.value)}>
              <option value="">Todas</option>
              <option value="true">Libres</option>
              <option value="false">Ocupadas</option>
            </select>
          </Campo>
        </div>
        {error ? <Aviso tono="error">{error}</Aviso> : null}
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Problema</th>
              <th>Estado</th>
              <th>Reclamo</th>
            </tr>
          </thead>
          <tbody>
            {cuadrillas.map((cuadrilla) => {
              const reclamo = cuadrilla.disponible ? null : reclamoEnCurso(reclamos, cuadrilla.id)
              const elegido = reclamo !== null && reclamo.id === seleccionadoId
              return (
                <tr key={cuadrilla.id}>
                  <td>{cuadrilla.nombre}</td>
                  <td>{ETIQUETA_TIPO[cuadrilla.especialidad as TipoReclamo]}</td>
                  <td>
                    <span className={`pastilla ${cuadrilla.disponible ? 'equipo-libre' : 'equipo-ocupada'}`}>
                      {cuadrilla.disponible ? 'Libre' : 'Ocupada'}
                    </span>
                  </td>
                  <td>
                    {reclamo ? (
                      <button
                        type="button"
                        className="btn btn-texto enlace-reclamo"
                        aria-expanded={elegido}
                        onClick={() => setSeleccionadoId(elegido ? null : reclamo.id)}
                      >
                        {elegido ? 'Ocultar detalle' : textoEnlace(reclamo)}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {cuadrillas.length === 0 ? <p className="bajada">No hay equipos con esos filtros.</p> : null}
      </section>

      {seleccionado ? (
        <section className="tarjeta">
          <DetalleReclamo
            token={token}
            reclamo={seleccionado}
            onExpirar={onExpirar}
            onActualizado={(reclamo) => {
              setReclamos((actual) => actual.map((item) => (item.id === reclamo.id ? reclamo : item)))
              void cargar()
            }}
            onVerZona={onVerZona}
            onVerCiudadano={onVerCiudadano}
            onVerSoap={onVerSoap}
          />
        </section>
      ) : null}
    </div>
  )
}

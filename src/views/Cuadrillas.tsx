import { useCallback, useEffect, useState } from 'react'
import { esNoAutorizado, listarCuadrillas, textoError, type Cuadrilla, type TipoReclamo } from '../api.ts'
import { ETIQUETA_TIPO, TIPOS } from '../catalogo.ts'
import { Aviso, Campo } from '../ui.tsx'

export function PanelCuadrillas({ token, onExpirar }: { token: string; onExpirar: () => void }) {
  const [especialidad, setEspecialidad] = useState('')
  const [disponible, setDisponible] = useState('')
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([])
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setCuadrillas(await listarCuadrillas(token, especialidad || undefined, disponible || undefined))
      setError(null)
    } catch (fallo) {
      if (esNoAutorizado(fallo)) onExpirar()
      setError(textoError(fallo))
    }
  }, [token, especialidad, disponible, onExpirar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <section className="tarjeta">
      <h2>Cuadrillas</h2>
      <p className="bajada">
        GET /cuadrillas. Al validarse un reclamo, el backend ocupa por su cuenta una cuadrilla libre de esa especialidad. Cuando
        el reclamo pasa a Resuelto, la libera y se la da al pendiente más antiguo del mismo tipo.
      </p>
      <div className="fila-2">
        <Campo etiqueta="Especialidad">
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
            <th>Especialidad</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {cuadrillas.map((cuadrilla) => (
            <tr key={cuadrilla.id}>
              <td>{cuadrilla.nombre}</td>
              <td>{ETIQUETA_TIPO[cuadrilla.especialidad as TipoReclamo]}</td>
              <td>{cuadrilla.disponible ? 'Libre' : 'Ocupada'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cuadrillas.length === 0 ? <p className="bajada">No hay cuadrillas con esos filtros.</p> : null}
    </section>
  )
}

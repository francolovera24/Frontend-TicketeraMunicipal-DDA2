import { useState } from 'react'
import type { Sesion } from '../sesion.ts'
import { PanelCiudadano } from './Ciudadano.tsx'
import { PanelCuadrillas } from './Cuadrillas.tsx'
import { PanelReclamos } from './Reclamos.tsx'
import { PanelResumen } from './Resumen.tsx'
import { PanelSoap } from './Soap.tsx'

type Tab = 'reclamos' | 'cuadrillas' | 'ia' | 'ciudadano' | 'soap'

const TABS: { id: Tab; etiqueta: string }[] = [
  { id: 'reclamos', etiqueta: 'Reclamos' },
  { id: 'cuadrillas', etiqueta: 'Equipos' },
  { id: 'ia', etiqueta: 'Resumen' },
  { id: 'ciudadano', etiqueta: 'Vecinos' },
  { id: 'soap', etiqueta: 'Estado' },
]

export function VistaMunicipal({ sesion, onExpirar }: { sesion: Sesion; onExpirar: () => void }) {
  const [tab, setTab] = useState<Tab>('reclamos')
  const [barrioIa, setBarrioIa] = useState('Palermo')
  const [ciudadanoId, setCiudadanoId] = useState('')
  const [reclamoSoapId, setReclamoSoapId] = useState('')

  return (
    <div className="columna">
      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'activo' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.etiqueta}
          </button>
        ))}
      </div>
      {tab === 'reclamos' ? (
        <PanelReclamos
          token={sesion.token}
          onExpirar={onExpirar}
          onVerZona={(barrio) => {
            setBarrioIa(barrio)
            setTab('ia')
          }}
          onVerCiudadano={(id) => {
            setCiudadanoId(id)
            setTab('ciudadano')
          }}
          onVerSoap={(id) => {
            setReclamoSoapId(id)
            setTab('soap')
          }}
        />
      ) : null}
      {tab === 'cuadrillas' ? (
        <PanelCuadrillas
          token={sesion.token}
          onExpirar={onExpirar}
          onVerZona={(barrio) => {
            setBarrioIa(barrio)
            setTab('ia')
          }}
          onVerCiudadano={(id) => {
            setCiudadanoId(id)
            setTab('ciudadano')
          }}
          onVerSoap={(id) => {
            setReclamoSoapId(id)
            setTab('soap')
          }}
        />
      ) : null}
      {tab === 'ia' ? (
        <PanelResumen token={sesion.token} onExpirar={onExpirar} barrioInicial={barrioIa} />
      ) : null}
      {tab === 'ciudadano' ? (
        <PanelCiudadano
          key={ciudadanoId || 'vacio'}
          token={sesion.token}
          onExpirar={onExpirar}
          idInicial={ciudadanoId}
          onVerZona={(barrio) => {
            setBarrioIa(barrio)
            setTab('ia')
          }}
          onVerSoap={(id) => {
            setReclamoSoapId(id)
            setTab('soap')
          }}
        />
      ) : null}
      {tab === 'soap' ? <PanelSoap key={reclamoSoapId || 'vacio'} idInicial={reclamoSoapId} /> : null}
    </div>
  )
}

import { useState } from 'react'
import type { Sesion } from '../sesion.ts'
import { Icono, type NombreIcono } from '../ui.tsx'
import { PanelCiudadano } from './Ciudadano.tsx'
import { PanelCuadrillas } from './Cuadrillas.tsx'
import { PanelReclamos } from './Reclamos.tsx'
import { PanelResumen } from './Resumen.tsx'
import { PanelSoap } from './Soap.tsx'

type Tab = 'reclamos' | 'cuadrillas' | 'ia' | 'ciudadano' | 'soap'

const TABS: { id: Tab; etiqueta: string; icono: NombreIcono }[] = [
  { id: 'reclamos', etiqueta: 'Reclamos', icono: 'reclamos' },
  { id: 'cuadrillas', etiqueta: 'Equipos', icono: 'equipos' },
  { id: 'ia', etiqueta: 'Resumen de zona', icono: 'resumen' },
  { id: 'ciudadano', etiqueta: 'Vecinos', icono: 'vecinos' },
  { id: 'soap', etiqueta: 'Consultar reclamo', icono: 'soap' },
]

export function VistaMunicipal({ sesion, onExpirar }: { sesion: Sesion; onExpirar: () => void }) {
  const [tab, setTab] = useState<Tab>('reclamos')
  const [barrioIa, setBarrioIa] = useState('Palermo')
  const [ciudadanoId, setCiudadanoId] = useState('')
  const [reclamoSoapId, setReclamoSoapId] = useState('')
  const [reclamoDetalleId, setReclamoDetalleId] = useState<string | null>(null)

  return (
    <div className="portal">
      <nav className="portal-nav" aria-label="Secciones del panel municipal" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`portal-nav__item ${tab === item.id ? 'activo' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <Icono nombre={item.icono} />
            {item.etiqueta}
          </button>
        ))}
      </nav>
      <div className="portal-main">
      {tab === 'reclamos' ? (
        <PanelReclamos
          token={sesion.token}
          reclamoInicial={reclamoDetalleId}
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
        <PanelResumen
          token={sesion.token}
          onExpirar={onExpirar}
          barrioInicial={barrioIa}
          onVerReclamo={(id) => {
            setReclamoDetalleId(id)
            setTab('reclamos')
          }}
        />
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
    </div>
  )
}

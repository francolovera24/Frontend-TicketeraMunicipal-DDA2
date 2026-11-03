import { useState, type ReactNode } from 'react'
import { urlImagen, type EstadoReclamo } from './api.ts'
import { ETIQUETA_ESTADO } from './catalogo.ts'

export function Aviso({ tono, children }: { tono: 'error' | 'ok' | 'info'; children: string }) {
  return (
    <p className={`aviso aviso-${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Campo({
  etiqueta,
  hint,
  children,
}: {
  etiqueta: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function FotoReclamo({ id }: { id: string }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <img
      className="foto-reclamo"
      src={urlImagen(id)}
      alt="Foto del problema"
      onError={() => setVisible(false)}
    />
  )
}

export function PastillaEstado({ estado, texto }: { estado: EstadoReclamo; texto?: string }) {
  return <span className={`pastilla estado-${estado}`}>{texto ?? ETIQUETA_ESTADO[estado]}</span>
}

export function Copiar({ valor }: { valor: string }) {
  return (
    <button
      type="button"
      className="btn btn-texto"
      onClick={() => {
        void navigator.clipboard.writeText(valor).catch(() => undefined)
      }}
    >
      Copiar
    </button>
  )
}

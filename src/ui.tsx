import type { ReactNode } from 'react'
import type { EstadoReclamo } from './api.ts'
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

export function PastillaEstado({ estado }: { estado: EstadoReclamo }) {
  return <span className={`pastilla estado-${estado}`}>{ETIQUETA_ESTADO[estado]}</span>
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

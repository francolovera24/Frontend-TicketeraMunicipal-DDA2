import { useEffect, useState, type ReactNode } from 'react'
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

export function MiniFoto({ id }: { id: string }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <img
      className="mini-foto"
      src={urlImagen(id)}
      alt=""
      onError={() => setVisible(false)}
    />
  )
}

export function FotoReclamo({ id, descripcion }: { id: string; descripcion?: string }) {
  const [visible, setVisible] = useState(true)
  const [ampliada, setAmpliada] = useState(false)
  const texto = descripcion?.trim() ?? ''
  useEffect(() => {
    if (!ampliada) return
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAmpliada(false)
    }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [ampliada])
  if (!visible) return null
  return (
    <>
      <figure className="foto-bloque">
        <button type="button" onClick={() => setAmpliada(true)}>
          <img
            className="foto-reclamo"
            src={urlImagen(id)}
            alt={texto || 'Foto del problema'}
            onError={() => setVisible(false)}
          />
        </button>
        {texto ? <figcaption>{texto}</figcaption> : null}
      </figure>
      {ampliada ? (
        <div
          className="foto-ampliada"
          role="dialog"
          aria-modal="true"
          aria-label="Foto del problema"
          onClick={() => setAmpliada(false)}
        >
          <figure onClick={(evento) => evento.stopPropagation()}>
            <img src={urlImagen(id)} alt={texto || 'Foto del problema'} />
            {texto ? <figcaption>{texto}</figcaption> : null}
            <button type="button" className="btn btn-secundario" onClick={() => setAmpliada(false)}>
              Cerrar
            </button>
          </figure>
        </div>
      ) : null}
    </>
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

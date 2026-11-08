import { useEffect, useState, type ReactNode } from 'react'
import { urlImagen, type EstadoReclamo } from './api.ts'
import { ETIQUETA_ESTADO } from './catalogo.ts'

export function Aviso({ tono, children }: { tono: 'error' | 'ok' | 'info' | 'aviso'; children: string }) {
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
  className,
}: {
  etiqueta: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`campo ${className ?? ''}`}>
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

const TRAZO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export type NombreIcono =
  | 'reclamos'
  | 'equipos'
  | 'vecinos'
  | 'resumen'
  | 'soap'
  | 'nuevo'
  | 'buscar'
  | 'mapa'
  | 'lista'
  | 'tablero'
  | 'cerrar'
  | 'salir'
  | 'ojo'
  | 'ojo-cerrado'

const FORMAS: Record<NombreIcono, ReactNode> = {
  reclamos: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.3" width="6" height="3" rx="1" />
      <line x1="8" y1="10.5" x2="16" y2="10.5" />
      <line x1="8" y1="14.3" x2="16" y2="14.3" />
      <line x1="8" y1="18.1" x2="13" y2="18.1" />
    </>
  ),
  equipos: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <circle cx="17.3" cy="9.2" r="2.3" />
      <path d="M15.8 14.3c2.5.4 4.2 2.5 4.2 5.2" />
    </>
  ),
  vecinos: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" />
    </>
  ),
  resumen: (
    <>
      <line x1="4" y1="21" x2="20" y2="21" />
      <rect x="6" y="13" width="3.2" height="8" rx="0.8" />
      <rect x="10.4" y="8" width="3.2" height="13" rx="0.8" />
      <rect x="14.8" y="4" width="3.2" height="17" rx="0.8" />
    </>
  ),
  soap: (
    <>
      <circle cx="5.5" cy="12" r="2.3" />
      <circle cx="18.5" cy="6" r="2.3" />
      <circle cx="18.5" cy="18" r="2.3" />
      <line x1="7.5" y1="11" x2="16.5" y2="7" />
      <line x1="7.5" y1="13" x2="16.5" y2="17" />
    </>
  ),
  nuevo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  buscar: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
    </>
  ),
  mapa: (
    <>
      <path d="M12 21c0 0-7-6.3-7-11.2A7 7 0 0 1 19 9.8C19 14.7 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  lista: (
    <>
      <line x1="4" y1="6" x2="4.01" y2="6" />
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="4.01" y2="12" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="4.01" y2="18" />
      <line x1="8" y1="18" x2="20" y2="18" />
    </>
  ),
  tablero: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
      <rect x="15.5" y="4" width="5" height="13" rx="1.5" />
    </>
  ),
  cerrar: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  salir: (
    <>
      <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" />
      <line x1="10.5" y1="12" x2="3" y2="12" />
      <path d="M7 8.5 3 12l4 3.5" />
    </>
  ),
  ojo: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  'ojo-cerrado': (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <circle cx="12" cy="12" r="2.6" />
      <line x1="4" y1="20" x2="20" y2="4" />
    </>
  ),
}

export function Icono({ nombre, className }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className={`icono ${className ?? ''}`}
      {...TRAZO}
    >
      {FORMAS[nombre]}
    </svg>
  )
}

export function CampoPassword({
  etiqueta,
  hint,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  maxLength,
}: {
  etiqueta: string
  hint?: string
  value: string
  onChange: (valor: string) => void
  autoComplete?: string
  required?: boolean
  minLength?: number
  maxLength?: number
}) {
  const [visible, setVisible] = useState(false)
  return (
    <Campo etiqueta={etiqueta} hint={hint}>
      <div className="campo-contrasena">
        <input
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
        />
        <button
          type="button"
          className="campo-contrasena__alternar"
          onClick={() => setVisible((actual) => !actual)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icono nombre={visible ? 'ojo-cerrado' : 'ojo'} />
        </button>
      </div>
    </Campo>
  )
}

export function Encabezado({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
}) {
  return (
    <div className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {descripcion ? <p className="bajada">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="encabezado__acciones">{acciones}</div> : null}
    </div>
  )
}

export function Estadistica({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string
  valor: string | number
  tono?: 'acento' | 'ok' | 'aviso' | 'error'
}) {
  return (
    <div className={`estadistica ${tono ? `estadistica-${tono}` : ''}`}>
      <span className="estadistica__valor">{valor}</span>
      <span className="estadistica__etiqueta">{etiqueta}</span>
    </div>
  )
}

export function Panel({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'm',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  children: ReactNode
  ancho?: 'm' | 'l'
}) {
  useEffect(() => {
    if (!abierto) return
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div className="panel-fondo" role="presentation" onClick={onCerrar}>
      <aside
        className={`panel-lateral panel-lateral-${ancho}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="panel-lateral__cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="panel-lateral__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="panel-lateral__cuerpo">{children}</div>
      </aside>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import { X, Search, Minus, Plus, CheckCircle2, AlertTriangle, XCircle, Info, Martini } from 'lucide-react'
import { useApp, dismissToast } from './store.js'

export const cls = (...a) => a.filter(Boolean).join(' ')

/* ---- Points & niveaux ---- */
export const PT_LABEL = { 0: 'Sans alcool', 1: 'Léger', 2: 'Moyen', 3: 'Fort' }
export const levelOf = p => (p >= 6 ? 'red' : p >= 4 ? 'orange' : 'green')
export const LEVEL_EMOJI = { green: '🟢', orange: '🟠', red: '🔴' }
export const LEVEL_LABEL = { green: 'Consommation faible', orange: 'Consommation modérée', red: 'Consommation élevée' }
export const LEVEL_COLOR = { green: 'var(--green)', orange: 'var(--orange)', red: 'var(--red)' }

export const plural = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`

export function timeAgo(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return `il y a ${h} h${m % 60 ? ` ${m % 60}` : ''}`
}

export function useTick(ms = 30000) {
  const [, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN(n => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

/* ---- Visuel cocktail (photo ou art généré) ---- */
export function cocktailArt(c) {
  const h = c.hue ?? 300
  return `linear-gradient(135deg, hsl(${h} 82% 58%) 0%, hsl(${(h + 55) % 360} 82% 42%) 100%)`
}

export function CocktailArt({ c, detail }) {
  return (
    <div className={detail ? 'ck-detail-art' : 'ck-art'} style={{ background: cocktailArt(c) }}>
      {c.imageUrl ? <img src={c.imageUrl} alt={c.name} loading="lazy" /> : <span className="a-emoji">{c.emoji || '🍸'}</span>}
      <div className="a-sheen" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 18% 0%, rgba(255,255,255,.2), transparent 45%)' }} />
    </div>
  )
}

export const PtsBadge = ({ points }) => (
  <span className="pts-badge">🍸 {points === 0 ? 'Sans alcool' : plural(points, 'pt')}</span>
)

/* ---- Primitives ----
   Les surcouches sont rendues via un portail vers <body> : un ancêtre avec
   backdrop-filter/transform (header vitré, cartes animées) piégerait sinon
   leurs éléments position:fixed. */
export function Modal({ open, onClose, title, children, wide, foot }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div className="modal-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
            <motion.div
              className={cls('modal', wide && 'wide')}
              initial={{ opacity: 0, scale: 0.92, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="row between" style={{ marginBottom: 18 }}>
                <h3>{title}</h3>
                <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={17} /></button>
              </div>
              <div className="col" style={{ gap: 14 }}>{children}</div>
              {foot && <div className="row" style={{ marginTop: 20, gap: 10 }}>{foot}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export function Sheet({ open, onClose, title, children, foot }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div className="sheet-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
            <motion.div
              className="sheet"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="sheet-head">
                <h3 className="grow">{title}</h3>
                <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={17} /></button>
              </div>
              <div className="sheet-body">{children}</div>
              {foot && <div className="sheet-foot">{foot}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export function BottomSheet({ open, onClose, title, children }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div className="bsheet-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
            <motion.div
              className="bsheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="grabber" />
              <div className="row between" style={{ padding: '8px 20px 12px' }}>
                <h3 style={{ fontSize: 18 }}>{title}</h3>
                <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={17} /></button>
              </div>
              <div className="sheet-body">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* Bouton destructif à double confirmation tactile. */
export function ConfirmBtn({ onConfirm, children, confirmLabel = 'Confirmer ?', className = 'btn sm danger', ...props }) {
  const [arm, setArm] = useState(false)
  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(false), 2600)
    return () => clearTimeout(t)
  }, [arm])
  return (
    <button
      className={className}
      style={arm ? { background: 'var(--red)', color: '#fff', borderColor: 'transparent' } : undefined}
      onClick={() => { if (arm) { setArm(false); onConfirm() } else setArm(true) }}
      {...props}
    >
      {arm ? confirmLabel : children}
    </button>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, editable, suffix }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const commit = () => {
    setEditing(false)
    const v = parseFloat(String(draft).replace(',', '.'))
    if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
  }
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label="Diminuer"><Minus size={17} /></button>
      <div className="val">
        {editing ? (
          <input
            autoFocus inputMode="decimal" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === 'Enter' && commit()}
          />
        ) : (
          <span onClick={() => { if (editable) { setDraft(String(value)); setEditing(true) } }} style={editable ? { cursor: 'text' } : undefined}>
            {value}{suffix ? <span className="tiny muted"> {suffix}</span> : null}
          </span>
        )}
      </div>
      <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} aria-label="Augmenter"><Plus size={17} /></button>
    </div>
  )
}

export const Switch = ({ checked, onChange, ...props }) => (
  <button role="switch" aria-checked={checked} className={cls('switch', checked && 'on')} onClick={() => onChange(!checked)} {...props} />
)

export const Seg = ({ options, value, onChange }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o.value} className={cls(value === o.value && 'active')} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
)

export function SearchBar({ value, onChange, placeholder = 'Rechercher…', style }) {
  return (
    <div className="search grow" style={style}>
      <Search size={17} />
      <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button className="btn ghost icon sm clear" onClick={() => onChange('')} aria-label="Effacer"><X size={15} /></button>}
    </div>
  )
}

export const Field = ({ label, children }) => (
  <div className="field"><label>{label}</label>{children}</div>
)

export const Empty = ({ icon = '🫥', title, text }) => (
  <div className="empty fade-up">
    <div className="e-icon">{icon}</div>
    {title && <b>{title}</b>}
    {text && <p>{text}</p>}
  </div>
)

/* ---- Suivi de consommation ---- */
export function LevelTrack({ points }) {
  const cells = Array.from({ length: 8 }, (_, i) => i + 1)
  return (
    <div className="level-track">
      {cells.map(i => (
        <div
          key={i}
          className="seg-cell"
          style={i <= points ? { background: LEVEL_COLOR[levelOf(i)], boxShadow: `0 0 8px ${LEVEL_COLOR[levelOf(i)]}44` } : undefined}
        />
      ))}
    </div>
  )
}

/* ---- Statut de connexion ---- */
export function ConnDot() {
  const { conn } = useApp()
  const c = conn === 'online' ? 'var(--green)' : conn === 'offline' ? 'var(--red)' : 'var(--orange)'
  const label = conn === 'online' ? 'Synchronisé' : conn === 'offline' ? 'Hors ligne' : 'Connexion…'
  return (
    <span className="conn-pill" title={label}>
      <span className={cls('dot', conn !== 'online' && 'pulse')} style={{ background: c }} />
      <span className="nowrap conn-label">{label}</span>
    </span>
  )
}

/* ---- Toasts ---- */
const TOAST_ICON = {
  success: <CheckCircle2 size={19} />,
  warn: <AlertTriangle size={19} />,
  error: <XCircle size={19} />,
  info: <Info size={19} />,
}

export function ToastHost() {
  const { toasts } = useApp()
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id} className={cls('toast', t.level)}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={() => dismissToast(t.id)}
            layout
          >
            <div className="t-icon">{TOAST_ICON[t.level] || TOAST_ICON.info}</div>
            <div className="grow">
              <b>{t.title}</b>
              {t.msg && <p>{t.msg}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ---- Fond ambiant + splash ---- */
export const Orbs = () => (
  <div className="orbs" aria-hidden="true">
    <div className="orb p" /><div className="orb v" /><div className="orb b" />
  </div>
)

export const Splash = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
    <motion.div
      animate={{ opacity: [0.4, 1, 0.4], scale: [0.97, 1.03, 0.97] }}
      transition={{ duration: 1.8, repeat: Infinity }}
      className="row" style={{ gap: 12 }}
    >
      <Martini size={26} style={{ color: 'var(--violet)' }} />
      <span className="grad-text" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>XOXO</span>
    </motion.div>
  </div>
)

/* ---- Temps d'attente ---- */
export const clock = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// Minutes restantes avant un horodatage (recalculé chaque seconde côté client).
export function useMinutesLeft(at) {
  useTick(1000)
  if (!at) return null
  return Math.max(0, Math.ceil((at - Date.now()) / 60000))
}

export function etaLabel(minutes) {
  if (minutes == null) return ''
  return `~${Math.max(1, minutes)} min`
}

// Statut d'ouverture des commandes, en clair.
export function serviceStatus(wait) {
  if (!wait) return { tone: 'muted', label: 'Connexion…' }
  if (wait.closed) return { tone: 'red', label: 'Commandes fermées' }
  if (wait.paused) return { tone: 'orange', label: `Pause jusqu'à ${clock(wait.pauseUntil)}` }
  if (wait.full) return { tone: 'orange', label: 'File complète' }
  return { tone: 'green', label: 'Commandes ouvertes' }
}

/* ---- QR code (accès carte, sessions de commande) ---- */
export function QRCanvas({ url, size = 220 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && url) {
      QRCode.toCanvas(ref.current, url, { width: size, margin: 1, color: { dark: '#08080c', light: '#ffffff' } })
    }
  }, [url, size])
  if (!url) return null
  return <div className="qr-box"><canvas ref={ref} /></div>
}

/* ---- Sélecteur de cocktail (grille tactile) ---- */
export function CocktailPicker({ cocktails, onPick, selectedId, showUnavailable = true }) {
  const [q, setQ] = useState('')
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const list = cocktails
    .filter(c => !c.archived)
    .filter(c => showUnavailable || c.makeable)
    .filter(c => !q || norm(c.name).includes(norm(q)))
    .sort((a, b) => (b.makeable - a.makeable) || a.name.localeCompare(b.name))
  return (
    <div className="col" style={{ gap: 12 }}>
      <SearchBar value={q} onChange={setQ} placeholder="Chercher un cocktail…" />
      <div className="pick-grid">
        {list.map(c => (
          <button key={c.id} className={cls('pick-tile', !c.makeable && 'off', selectedId === c.id && 'selected')} onClick={() => onPick(c)}>
            <span className="p-emoji">{c.emoji}</span>
            <b>{c.name}</b>
            <span className="tiny muted">{c.points === 0 ? 'Sans alcool' : plural(c.points, 'pt')}{!c.makeable ? ' · épuisé' : ''}</span>
          </button>
        ))}
        {!list.length && <Empty icon="🔍" title="Aucun résultat" />}
      </div>
    </div>
  )
}

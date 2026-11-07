import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../store.js'

const MEDALS = ['🥇', '🥈', '🥉']
const eur = n => `${String(+(+n).toFixed(2)).replace('.', ',')} €`

// Garde l'écran allumé (TV / tablette dédiée).
export function useWakeLock() {
  useEffect(() => {
    let lock = null
    const req = async () => {
      try { lock = await navigator.wakeLock?.request('screen') } catch { /* refusé */ }
    }
    const onVis = () => document.visibilityState === 'visible' && req()
    req()
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}) }
  }, [])
}

export function goFullscreen() {
  const el = document.documentElement
  ;(el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {})
}

/* Tableau d'honneur des donateurs (réutilisé par la borne). */
export function LeaderboardView({ lb, compact }) {
  const top = lb?.top || []
  return (
    <div className={compact ? 'lb lb-compact' : 'lb'}>
      <div className="lb-head">
        <p className="overline">Tableau d'honneur</p>
        <h1 className="grad-text">Les généreux 💎</h1>
        <p className="lb-total">
          <b className="tabular">{eur(lb?.total || 0)}</b> pour les barmans · {lb?.donors || 0} donateur{(lb?.donors || 0) > 1 ? 's' : ''}
        </p>
      </div>
      {top.length ? (
        <ol className="lb-list">
          <AnimatePresence>
            {top.map((d, i) => (
              <motion.li
                key={d.key || d.name}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className={i < 3 ? `lb-row podium p${i + 1}` : 'lb-row'}
              >
                <span className="lb-rank">{MEDALS[i] || i + 1}</span>
                <span className="lb-name ellipsis">{d.name}{d.anonymous ? ' 🕶️' : ''}</span>
                <span className="lb-count">{d.count > 1 ? `×${d.count}` : ''}</span>
                <span className="lb-amount tabular">{eur(d.amount)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      ) : (
        <div className="lb-empty">
          <span>🫙</span>
          <p>La boîte à tips attend son premier héros.</p>
        </div>
      )}
    </div>
  )
}

/* Écran plein écran dédié (TV, vieux iPad…) : n'affiche que le classement. */
export default function Screen() {
  const { pub } = useApp()
  const lb = pub?.leaderboard
  const [flash, setFlash] = useState(null)
  const [cursor, setCursor] = useState(true)
  const lastAt = useRef(null)
  useWakeLock()

  // Nouveau don → célébration plein écran quelques secondes.
  useEffect(() => {
    const at = lb?.last?.at
    if (!at) return
    if (lastAt.current && at > lastAt.current) {
      setFlash(lb.last)
      const t = setTimeout(() => setFlash(null), 6000)
      lastAt.current = at
      return () => clearTimeout(t)
    }
    lastAt.current = at
  }, [lb?.last?.at])

  // Curseur masqué après 3 s d'inactivité.
  useEffect(() => {
    let t
    const move = () => { setCursor(true); clearTimeout(t); t = setTimeout(() => setCursor(false), 3000) }
    move()
    window.addEventListener('mousemove', move)
    return () => { window.removeEventListener('mousemove', move); clearTimeout(t) }
  }, [])

  return (
    <div className="screen-page" style={{ cursor: cursor ? 'default' : 'none' }} onDoubleClick={goFullscreen}>
      <LeaderboardView lb={lb} />
      <p className="screen-foot">
        {pub?.rules ? `${eur(pub.rules.donationAmount)} dans la boîte à tips ou sur PayPal = ta commande passe en priorité` : ''}
      </p>
      {cursor && <button className="btn ghost sm screen-fs" onClick={goFullscreen}>⛶ Plein écran</button>}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="screen-flash"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <span className="sf-emoji">💎</span>
            <b>+{eur(flash.amount)}</b>
            <p>Merci {flash.name} !</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

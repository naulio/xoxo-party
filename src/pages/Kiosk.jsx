import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Maximize, Timer, X, Ban, Gem, Delete } from 'lucide-react'
import { useApp, api, joinKiosk, onKioskEvent } from '../store.js'
import { QRCanvas, cocktailArt, clock, etaLabel, serviceStatus, useTick, cls } from '../ui.jsx'
import { LeaderboardView, useWakeLock, goFullscreen } from './Screen.jsx'

/* Borne iPad fixe pour les invités (mode « kiosque ») :
   - QR de commande qui change chaque minute (+ code à 4 chiffres) ;
   - progression en direct de toutes les commandes (prêtes / en préparation / file) ;
   - appels « c'est prêt » plein écran, messages et QR envoyés depuis l'iPad barman.
   Sortie : appui long (2 s) sur le logo + PIN staff. */

const kioskId = 'k-' + Math.random().toString(36).slice(2, 10)
const first = n => String(n || 'Invité').split(' ')[0]

function useOrderPass(cocktailId = null, active = true) {
  const [p, setP] = useState(null)
  useEffect(() => {
    if (!active) return
    let stop = false
    const get = async () => {
      try {
        const r = await api('POST', '/api/kiosk/pass', { kioskId, cocktailId })
        if (!stop) setP(r)
      } catch { /* hors ligne : on garde l'ancien jusqu'au prochain essai */ }
    }
    get()
    const t = setInterval(get, 60000)
    return () => { stop = true; clearInterval(t) }
  }, [cocktailId, active])
  return p
}

function ExitModal({ onClose }) {
  const nav = useNavigate()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const press = async d => {
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length >= 4) {
      try {
        await api('POST', '/api/auth/check-pin', { pin: next })
        nav('/bar')
      } catch {
        if (next.length === 6) { setErr(true); setPin(''); setTimeout(() => setErr(false), 600) }
      }
    }
  }
  return (
    <div className="k-exit" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={cls('card pad col', err && 'shake')} style={{ alignItems: 'center', gap: 14, background: '#12121b' }}>
        <b>Quitter le mode borne</b>
        <div className="pin-dots">{Array.from({ length: 6 }, (_, i) => <span key={i} className={cls('pd', pin.length > i && 'on')} />)}</div>
        <div className="pinpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => <button key={d} onClick={() => press(String(d))}>{d}</button>)}
          <button onClick={onClose} style={{ fontSize: 13 }}>Annuler</button>
          <button onClick={() => press('0')}>0</button>
          <button onClick={() => setPin(pin.slice(0, -1))}><Delete size={20} /></button>
        </div>
      </div>
    </div>
  )
}

function Picker({ cocktails, appUrl, onClose }) {
  const [ck, setCk] = useState(null)
  const p = useOrderPass(ck?.id || null, !!ck)
  return (
    <motion.div className="k-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="btn icon k-close" onClick={onClose} aria-label="Fermer"><X size={22} /></button>
      {!ck ? (
        <div className="k-picker">
          <h2>Choisis ton cocktail</h2>
          <p className="muted">Puis scanne le QR avec ton téléphone pour valider.</p>
          <div className="k-grid">
            {cocktails.map(c => (
              <button key={c.id} className="k-tile" onClick={() => setCk(c)}>
                <span className="k-tile-art" style={{ background: cocktailArt(c) }}>{c.imageUrl ? <img src={c.imageUrl} alt="" /> : c.emoji}</span>
                <b>{c.name}</b>
                <span className="tiny muted">{c.points ? `${c.points} pt${c.points > 1 ? 's' : ''} alcool` : 'Sans alcool'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="k-ckqr">
          <span className="k-ck-emoji" style={{ background: cocktailArt(ck) }}>{ck.emoji}</span>
          <h2>{ck.name}</h2>
          <p className="muted">Scanne avec ton téléphone pour valider ta commande</p>
          {p ? <QRCanvas url={`${appUrl}#/commander?p=${p.pass}&ck=${ck.id}`} size={300} /> : <div className="skel" style={{ width: 300, height: 300 }} />}
          <button className="btn" onClick={() => setCk(null)}>← Choisir un autre</button>
        </div>
      )}
    </motion.div>
  )
}

export default function Kiosk() {
  useTick(1000)
  useWakeLock()
  const { staff, pub } = useApp()
  const p = useOrderPass()
  const [picker, setPicker] = useState(false)
  const [exit, setExit] = useState(false)
  const [calls, setCalls] = useState([])       // file d'appels « c'est prêt »
  const [overlay, setOverlay] = useState(null) // { type: 'qr' | 'leaderboard', until }
  const [toasts, setToasts] = useState([])     // confirmations de commande / dons
  const press = useRef(null)

  useEffect(() => joinKiosk(), [])

  useEffect(() => onKioskEvent(e => {
    const now = Date.now()
    if (e.type === 'ready' || e.type === 'call') setCalls(c => [...c, { ...e, id: now + Math.random() }].slice(-6))
    if (e.type === 'qr') setOverlay({ ...e, until: now + 90000 })
    if (e.type === 'leaderboard') setOverlay({ type: 'leaderboard', until: now + (e.seconds || 20) * 1000 })
    if (e.type === 'clear') { setOverlay(null); setCalls([]) }
    if (e.type === 'created') {
      const t = { id: now + Math.random(), text: `✅ ${first(e.guestName)} — ${e.qty > 1 ? e.qty + '× ' : ''}${e.emoji} ${e.name}`, sub: e.minutes ? `prête ${etaLabel(e.minutes)}` : 'commande reçue' }
      setToasts(x => [...x, t].slice(-3))
      setTimeout(() => setToasts(x => x.filter(y => y.id !== t.id)), 6000)
      if (e.kioskId === kioskId) setPicker(false)
    }
    if (e.type === 'donation') {
      const t = { id: now + Math.random(), text: `💎 Merci ${e.name} !`, sub: `+${String(e.amount).replace('.', ',')} € pour les barmans` }
      setToasts(x => [...x, t].slice(-3))
      setTimeout(() => setToasts(x => x.filter(y => y.id !== t.id)), 6000)
    }
  }), [])

  // Un appel à la fois, 7 s chacun.
  useEffect(() => {
    if (!calls.length) return
    const t = setTimeout(() => setCalls(c => c.slice(1)), 7000)
    return () => clearTimeout(t)
  }, [calls])

  if (overlay && overlay.until < Date.now()) setTimeout(() => setOverlay(null), 0)

  const board = useMemo(() => {
    if (!staff) return null
    const live = staff.orders.filter(o => !o.archived)
    const byId = Object.fromEntries(live.map(o => [o.id, o]))
    const eta = staff.queue?.eta || {}
    return {
      ready: live.filter(o => o.status === 'ready').sort((a, b) => (b.readyAt || b.updatedAt) - (a.readyAt || a.updatedAt)),
      preparing: live.filter(o => o.status === 'preparing').sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0)),
      queue: (staff.queue?.order || []).map(id => byId[id]).filter(Boolean),
      eta,
    }
  }, [staff])

  if (!staff || !board) return <div className="kiosk" />

  const wait = pub?.wait
  const st = serviceStatus(wait)
  const appUrl = staff.meta?.appUrl || location.href.split('#')[0]
  const msg = staff.settings.kioskMessage && (!staff.settings.kioskMessage.until || staff.settings.kioskMessage.until > Date.now()) ? staff.settings.kioskMessage : null
  const lb = pub?.leaderboard
  const pLeft = p ? Math.max(0, Math.round((p.exp - 3 * 60000 - Date.now()) / 1000)) : null

  const startPress = () => { press.current = setTimeout(() => setExit(true), 2000) }
  const endPress = () => clearTimeout(press.current)

  return (
    <div className="kiosk">
      <header className="k-head">
        <span className="logo-mark grad-text k-logo" onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress}>
          {pub?.partyName || 'XOXO PARTY'}
        </span>
        <div className="grow" />
        <span className={cls('badge k-badge', st.tone)}>{st.label}</span>
        {wait?.open && <span className="k-wait"><Timer size={20} /> Attente <b>{etaLabel(wait.minutes)}</b></span>}
        <button className="btn ghost icon" onClick={goFullscreen} aria-label="Plein écran"><Maximize size={18} /></button>
      </header>

      <AnimatePresence>
        {msg && (
          <motion.div className="k-message" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            📣 {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="k-main">
        <section className="k-order card">
          <p className="overline">Commande ici 📱</p>
          <h2>Scanne avec ton téléphone</h2>
          <div className={cls('k-qr', !wait?.open && 'dim')}>
            {p ? <QRCanvas url={`${appUrl}#/commander?p=${p.pass}`} size={260} /> : <div className="skel" style={{ width: 260, height: 260 }} />}
            {!wait?.open && <span className="k-qr-closed">{st.label}</span>}
          </div>
          {p && (
            <p className="k-code">ou code <b className="tabular">{p.code}</b> dans l'app <span className="faint tiny">· change dans {pLeft}s</span></p>
          )}
          <ol className="k-steps">
            <li><span>1</span> Scanne</li>
            <li><span>2</span> Choisis + ton prénom</li>
            <li><span>3</span> Notif quand c'est prêt</li>
          </ol>
          <div className="rule-card compact"><Ban size={16} /><div><b>Pas de commande au comptoir — uniquement via l'app.</b></div></div>
          <button className="btn lg full" disabled={!wait?.open} onClick={() => setPicker(true)}>Choisir sur la borne →</button>
        </section>

        <section className="k-board">
          <div className="k-col ready">
            <h3>✨ Prêtes — viens les chercher</h3>
            <AnimatePresence>
              {board.ready.length ? board.ready.slice(0, 6).map(o => (
                <motion.div key={o.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="k-item ready">
                  <span className="k-emoji">{o.emoji}</span>
                  <b className="ellipsis">{first(o.guestName)}</b>
                  <span className="muted ellipsis">{o.qty > 1 ? `${o.qty}× ` : ''}{o.name}</span>
                </motion.div>
              )) : <p className="faint small">—</p>}
            </AnimatePresence>
          </div>
          <div className="k-col">
            <h3>🍸 En préparation</h3>
            {board.preparing.length ? board.preparing.slice(0, 6).map(o => (
              <div key={o.id} className="k-item">
                <span className="k-emoji">{o.emoji}</span>
                <b className="ellipsis">{first(o.guestName)}</b>
                <span className="muted ellipsis">{o.name}</span>
                <span className="k-eta">{etaLabel(board.eta[o.id]?.minutes)}</span>
              </div>
            )) : <p className="faint small">Les shakers attendent…</p>}
          </div>
          <div className="k-col">
            <h3>⏳ File d'attente <span className="faint">({board.queue.length})</span></h3>
            {board.queue.length ? board.queue.slice(0, 7).map((o, i) => (
              <div key={o.id} className="k-item">
                <span className="k-pos tabular">#{i + 1}</span>
                <b className="ellipsis">{first(o.guestName)}{o.priority ? ' 💎' : ''}</b>
                <span className="muted ellipsis">{o.emoji} {o.name}</span>
                <span className="k-eta">{board.eta[o.id] ? clock(board.eta[o.id].at) : ''}</span>
              </div>
            )) : <p className="faint small">Personne — c'est le moment de commander !</p>}
            {board.queue.length > 7 && <p className="faint tiny">+ {board.queue.length - 7} autres</p>}
          </div>
        </section>
      </main>

      <footer className="k-foot">
        <span className="k-foot-prio"><Gem size={16} /> {String(pub?.rules?.donationAmount ?? 2).replace('.', ',')} € dans la boîte à tips ou PayPal = priorité</span>
        <span className="grow" />
        {lb?.top?.length > 0 && (
          <span className="k-foot-lb">🏆 {lb.top.slice(0, 3).map((d, i) => `${['🥇', '🥈', '🥉'][i]} ${d.name}`).join('  ')}</span>
        )}
      </footer>

      <div className="k-toasts">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} className="k-toast" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <b>{t.text}</b><span>{t.sub}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {picker && <Picker cocktails={pub?.cocktails || []} appUrl={appUrl} onClose={() => setPicker(false)} />}
        {overlay?.type === 'qr' && (
          <motion.div className="k-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOverlay(null)}>
            <div className="k-ckqr">
              <span className="k-ck-emoji">{overlay.emoji}</span>
              <h2>{first(overlay.guestName)}, scanne ta commande</h2>
              <p className="muted">{overlay.qty > 1 ? `${overlay.qty}× ` : ''}{overlay.name} — suivi en direct + notification</p>
              <QRCanvas url={`${appUrl}#/c/${overlay.token}`} size={300} />
            </div>
          </motion.div>
        )}
        {overlay?.type === 'leaderboard' && (
          <motion.div className="k-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOverlay(null)}>
            <LeaderboardView lb={lb} compact />
          </motion.div>
        )}
        {calls[0] && (
          <motion.div key={calls[0].id} className="k-call" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }}>
            <span className="k-call-emoji">{calls[0].emoji}</span>
            <h1>{first(calls[0].guestName).toUpperCase()}</h1>
            <p>{calls[0].qty > 1 ? `${calls[0].qty}× ` : ''}{calls[0].name} — c'est prêt, viens au bar ! ✨</p>
          </motion.div>
        )}
      </AnimatePresence>

      {exit && <ExitModal onClose={() => setExit(false)} />}
    </div>
  )
}

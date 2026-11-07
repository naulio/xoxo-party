import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, BellRing, BellOff, Timer, Share, Martini, Gem, Coins, Copy, Hourglass, ListOrdered } from 'lucide-react'
import { useApp, onTrack, toast } from '../store.js'
import { apiUrl, fixAssets, getDeviceId, isStandalone, readMine, saveMine } from '../net.js'
import { Modal, Switch, clock, etaLabel, useMinutesLeft, cocktailArt } from '../ui.jsx'
import InstallPrompt from '../InstallPrompt.jsx'

const STEPS = [
  { key: 'pending', emoji: '🕐', label: 'En attente', desc: 'Le bar a bien reçu ta commande.' },
  { key: 'preparing', emoji: '🍸', label: 'En préparation', desc: 'Shaker en action, ça arrive.' },
  { key: 'ready', emoji: '✨', label: 'Prête !', desc: 'Viens la récupérer au comptoir.' },
]
const STEP_INDEX = { pending: 0, preparing: 1, ready: 2, served: 3 }

const urlB64ToUint8 = base64 => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)))
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const pushSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const post = (path, body) => fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })

function NotifCard({ order }) {
  const [state, setState] = useState('checking') // checking | prompt | on | denied | unsupported | busy
  const [errDetail, setErrDetail] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const auto = useRef(false)

  const subscribe = async () => {
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'prompt')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(order.vapidKey),
      })
      const r = await post(`/api/track/${order.token}/subscribe`, { subscription: sub, deviceId: getDeviceId() })
      setState(r.ok ? 'on' : 'prompt')
    } catch (e) {
      setErrDetail(e?.message || String(e))
      setState('unsupported')
    }
  }

  const testPush = async () => {
    setTestMsg('…')
    try {
      const r = await post(`/api/track/${order.token}/test-push`).then(x => x.json())
      setTestMsg(r.sent > 0 ? '✅ Envoyée — elle arrive !' : (r.error || '⚠ Aucun abonnement actif'))
    } catch {
      setTestMsg('⚠ Échec du test')
    }
    setTimeout(() => setTestMsg(''), 6000)
  }

  useEffect(() => {
    if (!pushSupported() || !order.vapidKey) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('denied')
    if (Notification.permission === 'granted') {
      // Déjà autorisé (commande précédente) : on abonne silencieusement.
      if (!auto.current) { auto.current = true; subscribe() }
    } else {
      setState('prompt')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.token, order.vapidKey])

  if (order.status === 'served') return null

  return (
    <div className="card pad col notif-card" style={{ gap: 10, width: '100%' }}>
      {state === 'prompt' && (
        <>
          <button className="btn primary lg full" onClick={subscribe}>
            <Bell size={18} /> Me prévenir quand c'est prêt
          </button>
          <p className="tiny muted center" style={{ textAlign: 'center' }}>
            Une seule autorisation. Tu peux verrouiller ton téléphone tranquille.
          </p>
        </>
      )}
      {state === 'busy' && <p className="small muted" style={{ textAlign: 'center' }}>Activation…</p>}
      {state === 'on' && (
        <>
          <div className="row" style={{ gap: 10 }}>
            <span className="t-icon" style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(52,211,153,.14)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BellRing size={18} />
            </span>
            <div className="grow">
              <b className="small">Notification activée</b>
              <p className="tiny muted">Ton téléphone sonnera dès que ta commande sera prête — même verrouillé.</p>
            </div>
          </div>
          <div className="row between">
            <button className="btn ghost sm" onClick={testPush}>🔔 Tester la notification</button>
            {testMsg && <span className="tiny muted">{testMsg}</span>}
          </div>
        </>
      )}
      {state === 'denied' && (
        <div className="row" style={{ gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(251,191,36,.13)', color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BellOff size={18} />
          </span>
          <p className="tiny muted">
            Notifications bloquées dans le navigateur. Pas grave : cette page se met à jour toute seule, et la borne du bar affiche ton prénom quand c'est prêt.
          </p>
        </div>
      )}
      {state === 'unsupported' && (
        <div className="col" style={{ gap: 8 }}>
          {isIOS && !isStandalone() ? (
            <p className="tiny muted">
              📲 <b>Sur iPhone :</b> appuie sur <Share size={12} style={{ verticalAlign: '-2px' }} /> <b>Partager</b> →
              <b> « Sur l'écran d'accueil »</b>, puis ouvre l'icône XOXO : elle s'ouvre directement sur cette commande et peut te notifier.
              Sinon, garde cette page ouverte — et la borne affiche ton prénom quand c'est prêt.
            </p>
          ) : (
            <p className="tiny muted">
              Les notifications ne sont pas disponibles ici — garde la page ouverte, elle se met à jour toute seule.
              {errDetail && <span className="faint"> ({errDetail})</span>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* Priorité contre un pourboire (validé par un barman). */
function PriorityCard({ order }) {
  const [open, setOpen] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const amount = order.donationAmount
  const amountLabel = `${String(amount).replace('.', ',')} €`
  const email = order.paypalEmail

  const claim = async method => {
    setBusy(true)
    try {
      const r = await post(`/api/track/${order.token}/donation`, { method, anonymous })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Impossible pour le moment')
      setOpen(false)
      toast('success', 'Merci ! 💎', 'Un barman vérifie et valide ta priorité.')
    } catch (e) {
      toast('error', 'Oups', e.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(email); toast('success', 'Adresse copiée', email) } catch { toast('info', 'PayPal', email) }
  }

  if (order.priority) {
    return (
      <div className="card pad row prio-card on">
        <Gem size={20} />
        <div><b>Commande prioritaire 💎</b><p className="tiny muted">Merci pour les barmans, tu passes devant !</p></div>
      </div>
    )
  }
  if (order.status !== 'pending') return null
  const d = order.donation

  return (
    <>
      {d?.status === 'claimed' ? (
        <div className="card pad row prio-card">
          <Hourglass size={20} />
          <div><b>Don déclaré — vérification en cours</b><p className="tiny muted">Un barman valide ta priorité dès qu'il a vu ton {amountLabel}.</p></div>
        </div>
      ) : (
        <button className="card pad row prio-card cta" onClick={() => setOpen(true)}>
          <Gem size={20} />
          <div className="grow" style={{ textAlign: 'left' }}>
            <b>Pressé·e ? Passe en priorité — {amountLabel}</b>
            <p className="tiny muted">
              {d?.status === 'refused' ? 'Le bar n\'a pas retrouvé ton don — réessaie ou parle-leur 🙂' : 'Seule façon de doubler la file : un pourboire pour les barmans.'}
            </p>
          </div>
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`💎 Priorité — ${amountLabel}`}>
        <p className="small muted">
          Au bar, c'est <b style={{ color: 'var(--text)' }}>premier arrivé, premier servi</b>. Seule exception : {amountLabel} pour les barmans,
          et ta commande passe devant (validé par un barman). Ton prénom rejoint le tableau d'honneur des donateurs.
        </p>
        <div className="pay-option">
          <Coins size={20} />
          <div className="grow">
            <b>Boîte à tips du bar</b>
            <p className="tiny muted">Dépose {amountLabel} dans la boîte, puis appuie ici.</p>
          </div>
          <button className="btn" disabled={busy} onClick={() => claim('cash')}>C'est fait</button>
        </div>
        {email && (
          <div className="pay-option col" style={{ alignItems: 'stretch' }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="paypal-mark">P</span>
              <div className="grow">
                <b>PayPal</b>
                <p className="tiny muted">Envoie {amountLabel} « entre proches » à :</p>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <code className="grow small ellipsis paypal-email">{email}</code>
              <button className="btn ghost icon sm" onClick={copy} aria-label="Copier"><Copy size={15} /></button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn grow" target="_blank" rel="noopener noreferrer"
                href={`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(email)}&item_name=${encodeURIComponent('Pourboire barmans XOXO PARTY')}&amount=${amount}&currency_code=EUR`}>
                Ouvrir PayPal
              </a>
              <button className="btn primary grow" disabled={busy} onClick={() => claim('paypal')}>J'ai envoyé</button>
            </div>
          </div>
        )}
        <div className="row between">
          <span className="small">Apparaître en anonyme au tableau d'honneur</span>
          <Switch checked={anonymous} onChange={setAnonymous} />
        </div>
      </Modal>
    </>
  )
}

function EtaCard({ order }) {
  const left = useMinutesLeft(order.eta?.at)
  if (!order.eta || !['pending', 'preparing'].includes(order.status)) return null
  const pos = order.eta.position
  return (
    <div className="card pad eta-card">
      <div className="row" style={{ gap: 12 }}>
        <span className="eta-big tabular">{left <= 1 ? '≤1' : left}<small>min</small></span>
        <div className="grow">
          <b>{order.status === 'preparing' ? 'En cours de préparation' : `Prête vers ${clock(order.eta.at)}`}</b>
          <p className="tiny muted">
            {order.status === 'pending'
              ? <><ListOrdered size={12} style={{ verticalAlign: '-2px' }} /> {pos === 1 ? 'Tu es le prochain !' : `${pos}ᵉ dans la file`} · premier arrivé, premier servi</>
              : `Encore ${etaLabel(left)} environ`}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Track() {
  const { token } = useParams()
  const { conn } = useApp()
  const [order, setOrder] = useState(null)
  const [gone, setGone] = useState(false)
  const prevStatus = useRef(null)

  useEffect(() => {
    // Le téléphone « réclame » la commande (ID unique) : fiche invité liée,
    // identités Safari/app fusionnées ; la réponse est l'état de la commande.
    ;(async () => {
      try {
        const r = await post(`/api/track/${token}/claim`, { deviceId: getDeviceId() })
        if (r.status === 404) return setGone(true)
        if (r.ok) return setOrder(fixAssets(await r.json()))
        throw new Error()
      } catch {
        fetch(apiUrl(`/api/track/${token}`))
          .then(r => (r.ok ? r.json() : Promise.reject()))
          .then(p => setOrder(fixAssets(p)))
          .catch(() => setGone(true))
      }
    })()
  }, [token])

  useEffect(() => {
    if (conn !== 'online') return
    return onTrack(token, p => (p.deleted ? setGone(true) : setOrder(p)))
  }, [token, conn])

  useEffect(() => {
    if (!order) return
    saveMine(order)
    if (prevStatus.current && prevStatus.current !== order.status && order.status === 'ready') {
      try { navigator.vibrate?.([120, 60, 120, 60, 200]) } catch { /* non supporté */ }
    }
    prevStatus.current = order.status
  }, [order])

  const others = readMine().filter(o => o.token !== token && Date.now() - o.at < 6 * 3600 * 1000)

  if (gone) {
    return (
      <div className="track-page">
        <div className="empty" style={{ paddingTop: 90 }}>
          <div className="e-icon">🫥</div>
          <b>Commande introuvable</b>
          <p>Elle a peut-être été annulée — repasse voir le bar, ils sont sympas.</p>
          <Link to="/" className="btn" style={{ marginTop: 12 }}>Voir la carte des cocktails</Link>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="track-page">
        <div className="skel" style={{ width: 132, height: 132, borderRadius: 36, marginTop: 40 }} />
        <div className="skel" style={{ width: 190, height: 26 }} />
        <div className="skel" style={{ width: '100%', height: 200 }} />
      </div>
    )
  }

  const idx = STEP_INDEX[order.status] ?? 0
  const served = order.status === 'served'
  const ready = order.status === 'ready'

  return (
    <div className="track-page">
      <p className="overline" style={{ marginTop: 8 }}>{order.partyName || 'XOXO PARTY'} · Suivi de commande</p>

      <div
        className={`track-art ${ready ? 'ready-glow ready-pulse' : ''}`}
        style={{ background: cocktailArt(order) }}
      >
        {order.imageUrl ? <img src={order.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{order.emoji}</span>}
        {order.priority && <span className="prio-flag">💎</span>}
      </div>

      <div className="col center" style={{ alignItems: 'center', gap: 4 }}>
        <h1 style={{ fontSize: 30, textAlign: 'center' }}>{order.qty > 1 ? `${order.qty}× ` : ''}{order.name}</h1>
        <motion.p
          key={order.status}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={served ? 'grad-text bold' : ready ? 'bold' : 'muted'}
          style={{ fontSize: 17, textAlign: 'center', color: ready ? 'var(--green)' : undefined }}
        >
          {(() => {
            const g = order.guestName
            if (served) return g ? `Santé ${g} ! 🥂` : 'Servie — santé ! 🥂'
            if (ready) return g ? `✨ ${g}, c'est prêt — viens au bar !` : '✨ C\'est prêt, viens au bar !'
            if (order.status === 'preparing') return g ? `Salut ${g}, ta boisson est bientôt prête !` : STEPS[idx].desc
            return g ? `Salut ${g} 👋 — le bar a bien reçu ta commande.` : STEPS[idx].desc
          })()}
        </motion.p>
      </div>

      <EtaCard order={order} />

      {!served && (
        <div className="tsteps card pad" style={{ paddingBottom: 6 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} className={`tstep ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
              <div className="t-rail">
                <div className="t-dot">{i < idx ? '✓' : s.emoji}</div>
                {i < STEPS.length - 1 && <div className="t-line" />}
              </div>
              <div className="t-body">
                <b style={{ fontSize: 15 }}>{s.label}</b>
                {i === idx && <p className="tiny muted" style={{ marginTop: 2 }}>{s.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {served ? (
        <div className="card pad col center" style={{ alignItems: 'center', gap: 8, width: '100%' }}>
          <span style={{ fontSize: 40 }}>🥂</span>
          <b>Bonne dégustation !</b>
          <p className="small muted" style={{ textAlign: 'center' }}>Envie d'un autre ? Repasse scanner la borne au bar.</p>
          <div className="row" style={{ marginTop: 6 }}>
            <Link to="/" className="btn"><Martini size={16} /> La carte</Link>
            <Link to="/commander" className="btn primary">Commander</Link>
          </div>
        </div>
      ) : (
        <>
          <NotifCard order={order} />
          <PriorityCard order={order} />
          <p className="tiny faint" style={{ textAlign: 'center' }}>
            <Timer size={11} style={{ verticalAlign: '-1px' }} /> Cette page se met à jour toute seule — inutile de rafraîchir.
          </p>
        </>
      )}

      {others.length > 0 && (
        <div className="col" style={{ width: '100%', gap: 8, marginTop: 8 }}>
          <p className="overline">Tes autres commandes</p>
          <div className="row wrap">
            {others.slice(0, 4).map(o => (
              <Link key={o.token} to={`/c/${o.token}`} className="chip">{o.emoji} {o.name}</Link>
            ))}
            <Link to="/moi" className="chip">Tout voir →</Link>
          </div>
        </div>
      )}

      <p className="faint tiny" style={{ marginTop: 'auto', paddingTop: 30 }}>
        <span className="grad-text bold" style={{ fontFamily: 'var(--display)' }}>XOXO PARTY</span> · L'abus d'alcool est dangereux pour la santé
      </p>

      <InstallPrompt active={!!order && order.status !== 'served'} />
    </div>
  )
}

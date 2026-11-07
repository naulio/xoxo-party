import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ScanLine, KeyRound, ChevronLeft, Timer, Smartphone, Gem, ArrowRight, Ban } from 'lucide-react'
import { useApp, api, toast } from '../store.js'
import { getDeviceId, getPass, savePass, clearPass, getSavedName, saveName, saveMine, apiUrl } from '../net.js'
import { BottomSheet, Stepper, Empty, cls, plural, clock, etaLabel, serviceStatus, useTick, cocktailArt } from '../ui.jsx'

/* Règle de la soirée, affichée partout où l'on peut commander. */
export function AppOnlyRule({ compact }) {
  return (
    <div className={cls('rule-card', compact && 'compact')}>
      <Ban size={compact ? 16 : 20} />
      <div>
        <b>Ici, on commande uniquement via l'app.</b>
        {!compact && <p>Les barmans ne prennent aucune commande au comptoir : scanne la borne, choisis, reçois une notif quand c'est prêt.</p>}
      </div>
    </div>
  )
}

/* Échange un pass de borne (QR ou code à 4 chiffres) contre un pass personnel. */
export async function redeemPass({ pass, code }) {
  const r = await api('POST', '/api/pass/redeem', { pass, code, deviceId: getDeviceId() })
  savePass(r)
  return r
}

/* Invitation à scanner la borne (pas de pass valide). */
export function ScanPrompt({ onPass, title = 'Pour commander, scanne la borne au bar', noScan }) {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (code.length !== 4) return
    setBusy(true)
    try {
      const p = await redeemPass({ code })
      onPass?.(p)
      setCode('')
    } catch (e) {
      toast('error', 'Code refusé', e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card pad col scan-prompt" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="sp-icon"><ScanLine size={22} /></span>
        <div>
          <b style={{ fontSize: 15.5 }}>{title}</b>
          <p className="small muted" style={{ marginTop: 2 }}>
            {noScan ? 'Entre le code à 4 chiffres affiché sous le QR de la borne :' : 'Avec l\'appareil photo de ton téléphone, ou directement ici :'}
          </p>
        </div>
      </div>
      {!noScan && (
        <button className="btn primary lg full" onClick={() => nav('/scan')}>
          <ScanLine size={18} /> Scanner le QR de la borne
        </button>
      )}
      <div className="row" style={{ gap: 8 }}>
        <div className="search grow">
          <KeyRound size={16} />
          <input
            className="input" inputMode="numeric" maxLength={4} value={code} placeholder="Ou le code à 4 chiffres"
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>
        <button className="btn" disabled={code.length !== 4 || busy} onClick={submit}>OK</button>
      </div>
    </div>
  )
}

function PassTimer({ pass }) {
  useTick(1000)
  const s = Math.max(0, Math.round((pass.exp - Date.now()) / 1000))
  return (
    <span className="badge green tabular">
      <Smartphone size={12} /> Pass valide {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  )
}

function OrderSheet({ c, onClose, pass, rules, wait, onDone, onPassLost }) {
  const [qty, setQty] = useState(1)
  const [name, setName] = useState(getSavedName())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (c) { setQty(1); setNote('') } }, [c])

  const submit = async () => {
    if (!name.trim()) return toast('error', 'Prénom manquant', 'Ton prénom permet au bar de t\'appeler quand c\'est prêt.')
    setBusy(true)
    try {
      const r = await api('POST', '/api/public/orders', {
        pass: pass?.pass, cocktailId: c.id, qty, guestName: name.trim(), note, deviceId: getDeviceId(),
      })
      saveName(name.trim())
      clearPass()
      saveMine({ token: r.token, name: c.name, emoji: c.emoji, status: 'pending' })
      onDone(r.token)
    } catch (e) {
      if (e.data?.code === 'active' && e.data.token) {
        toast('warn', 'Une commande à la fois', e.message)
        onDone(e.data.token)
      } else if (e.data?.code === 'pass') {
        clearPass()
        onPassLost()
        toast('warn', 'Pass expiré', e.message)
      } else {
        toast('error', 'Commande refusée', e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const minutes = wait?.minutes
  return (
    <BottomSheet open={!!c} onClose={onClose} title={c ? `${c.emoji} ${c.name}` : ''}>
      {c && (
        <div className="col" style={{ gap: 16 }}>
          <div className="order-hero" style={{ background: cocktailArt(c) }}>
            {c.imageUrl ? <img src={c.imageUrl} alt="" /> : <span>{c.emoji}</span>}
          </div>
          <p className="small muted">{c.description}</p>
          <div className="row between">
            <div>
              <b className="small">Quantité</b>
              <p className="tiny faint">{rules.maxQty > 1 ? `Jusqu'à ${rules.maxQty} (un pour ton ami·e ?)` : 'Une boisson par commande'}</p>
            </div>
            <Stepper value={qty} onChange={setQty} min={1} max={rules.maxQty || 2} />
          </div>
          <div className="field">
            <label>Ton prénom (le bar t'appellera comme ça)</label>
            <input className="input" value={name} maxLength={30} onChange={e => setName(e.target.value)} placeholder="Lucas, Léa…" autoComplete="given-name" />
          </div>
          <div className="field">
            <label>Petite note (optionnel)</label>
            <input className="input" value={note} maxLength={80} onChange={e => setNote(e.target.value)} placeholder="Sans glace, peu sucré…" />
          </div>
          <div className="eta-preview">
            <Timer size={18} />
            <div>
              <b>Prête vers {clock(Date.now() + (minutes || 1) * 60000)}</b>
              <p className="tiny muted">
                {wait?.queue ? `${plural(wait.queue, 'commande')} avant toi · ` : 'Personne devant toi · '}
                {etaLabel(minutes)} — premier arrivé, premier servi.
              </p>
            </div>
          </div>
          <p className="tiny faint row" style={{ gap: 6 }}>
            <Gem size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            Pressé·e ? Après la commande, {rules.donationAmount} € pour les barmans = ta commande passe en priorité.
          </p>
          <button className="btn primary lg full" disabled={busy} onClick={submit}>
            {busy ? 'Envoi…' : <>Valider ma commande <ArrowRight size={17} /></>}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}

export default function Order() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { pub } = useApp()
  const [pass, setPass] = useState(getPass())
  const [sel, setSel] = useState(null)
  const [active, setActive] = useState(null)
  const [redeemErr, setRedeemErr] = useState('')
  useTick(5000)

  // Arrivée depuis le QR de la borne : #/commander?p=<pass>&ck=<cocktail>
  useEffect(() => {
    const p = params.get('p')
    if (!p) return
    redeemPass({ pass: p })
      .then(r => { setPass(r); setRedeemErr('') })
      .catch(e => setRedeemErr(e.message))
      .finally(() => {
        const ck = params.get('ck')
        setParams(ck ? { ck } : {}, { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Commande déjà en cours sur ce téléphone ?
  useEffect(() => {
    fetch(apiUrl(`/api/device/${getDeviceId()}/orders`))
      .then(r => r.json())
      .then(r => setActive(r.orders?.find(o => ['pending', 'preparing'].includes(o.status)) || null))
      .catch(() => {})
  }, [])

  // Pré-sélection depuis la borne (« Commander ce Mojito »).
  const ck = params.get('ck') || pass?.cocktailId
  useEffect(() => {
    if (ck && pub && pass && !sel) {
      const c = pub.cocktails.find(x => x.id === ck) || pub.secrets?.find(x => x.id === ck)
      if (c) setSel(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ck, pub, pass])

  const groups = useMemo(() => {
    if (!pub) return []
    return pub.categories.map(cat => ({ cat, items: pub.cocktails.filter(c => c.category === cat) })).filter(g => g.items.length)
  }, [pub])

  const validPass = pass && pass.exp > Date.now() ? pass : null
  const wait = pub?.wait
  const status = serviceStatus(wait)
  const canOrder = wait?.open && !active && (validPass || pub?.rules?.requirePass === false)

  return (
    <div className="order-page">
      <header className="pub-top">
        <Link to="/" className="btn ghost sm"><ChevronLeft size={16} /> Carte</Link>
        <span className={cls('badge', status.tone)}>{status.label}</span>
      </header>

      <div className="col" style={{ gap: 6, marginBottom: 6 }}>
        <p className="overline">{pub?.partyName || 'XOXO PARTY'}</p>
        <h1 style={{ fontSize: 30 }}>Commander</h1>
        {wait && (
          <p className="muted small">
            <Timer size={14} style={{ verticalAlign: '-2px' }} /> Attente actuelle <b style={{ color: 'var(--text)' }}>{etaLabel(wait.minutes)}</b>
            {wait.queue > 0 && <> · {plural(wait.queue, 'commande')} en cours</>}
          </p>
        )}
      </div>

      <AppOnlyRule />

      {active && (
        <Link to={`/c/${active.token}`} className="card pad row active-order">
          <span style={{ fontSize: 28 }}>{active.emoji}</span>
          <div className="grow">
            <b>Ta commande est en cours : {active.qty > 1 ? `${active.qty}× ` : ''}{active.name}</b>
            <p className="tiny muted">Une commande à la fois, pour que tout le monde soit servi. Suis-la ici →</p>
          </div>
          <ArrowRight size={18} />
        </Link>
      )}

      {wait && !wait.open && (
        <div className="card pad closed-card">
          <b>{status.label}</b>
          <p className="small muted">
            {wait.closed && 'Le bar a mis les commandes en pause. Réessaie un peu plus tard 🙏'}
            {wait.paused && `Les barmans soufflent un peu. Reprise à ${clock(wait.pauseUntil)}.`}
            {wait.full && !wait.closed && !wait.paused && `La file est pleine (${wait.drinks} boissons). Réessaie dans quelques minutes.`}
          </p>
        </div>
      )}

      {!validPass && pub?.rules?.requirePass !== false && !active && (
        <>
          {redeemErr && <p className="small" style={{ color: 'var(--orange)' }}>⚠ {redeemErr}</p>}
          <ScanPrompt onPass={setPass} />
        </>
      )}

      {validPass && <div className="row"><PassTimer pass={validPass} /><span className="tiny faint">Choisis ton cocktail avant la fin du compte à rebours.</span></div>}

      {!pub ? null : groups.length ? (
        groups.map(g => (
          <section key={g.cat} className="col" style={{ gap: 8 }}>
            <p className="overline" style={{ marginTop: 6 }}>{g.cat}</p>
            {g.items.map(c => (
              <button
                key={c.id}
                className={cls('card order-row', !canOrder && 'disabled')}
                onClick={() => canOrder ? setSel(c) : toast('info', 'Pas encore', !validPass ? 'Scanne d\'abord la borne au bar 📱' : status.label)}
              >
                <span className="or-art" style={{ background: cocktailArt(c) }}>
                  {c.imageUrl ? <img src={c.imageUrl} alt="" /> : c.emoji}
                </span>
                <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>{c.name}</b>
                  <span className="tiny muted ellipsis" style={{ display: 'block' }}>{c.ingredients.join(' · ')}</span>
                </span>
                <span className="pts-mini">{c.points === 0 ? '0 pt' : `${c.points} pt${c.points > 1 ? 's' : ''}`}</span>
              </button>
            ))}
          </section>
        ))
      ) : (
        <Empty icon="🍸" title="Le bar recharge ses stocks" text="Les cocktails réapparaissent dès qu'ils sont disponibles." />
      )}

      <OrderSheet
        c={sel}
        onClose={() => setSel(null)}
        pass={validPass}
        rules={pub?.rules || {}}
        wait={wait}
        onDone={token => nav(`/c/${token}`, { replace: true })}
        onPassLost={() => { setPass(null); setSel(null) }}
      />
    </div>
  )
}

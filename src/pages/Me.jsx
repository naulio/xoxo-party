import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Link2, ArrowRight, ScanLine } from 'lucide-react'
import { api, toast } from '../store.js'
import { apiUrl, getDeviceId, isStandalone } from '../net.js'
import { Empty, etaLabel, cls } from '../ui.jsx'

const STATUS = { pending: 'En attente', preparing: 'En préparation', ready: 'Prête ✨', served: 'Servie' }

/* « Mes commandes » + liaison entre l'app installée et le navigateur.
   Sur iPhone, l'app de l'écran d'accueil a son propre stockage : un code à
   4 chiffres relie les deux pour que les notifications arrivent dans l'app. */
export default function Me() {
  const [data, setData] = useState(null)
  const [myCode, setMyCode] = useState(null)
  const [code, setCode] = useState('')

  const load = () =>
    fetch(apiUrl(`/api/device/${getDeviceId()}/orders`))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ orders: [] }))
  useEffect(() => { load() }, [])

  const showCode = async () => {
    try {
      const r = await api('POST', '/api/device/link-code', { deviceId: getDeviceId() })
      setMyCode(r.code)
    } catch (e) { toast('error', 'Oups', e.message) }
  }

  const link = async () => {
    try {
      const r = await api('POST', '/api/device/link', { code, deviceId: getDeviceId() })
      toast('success', 'Appareils reliés', `Bienvenue ${r.guestName} — tes notifications arriveront ici 🔔`)
      setCode('')
      load()
    } catch (e) { toast('error', 'Liaison impossible', e.message) }
  }

  const orders = data?.orders || []
  const standalone = isStandalone()

  return (
    <div className="order-page">
      <header className="pub-top">
        <Link to="/" className="btn ghost sm"><ChevronLeft size={16} /> Carte</Link>
        <Link to="/commander" className="btn sm"><ScanLine size={15} /> Commander</Link>
      </header>
      <div>
        <p className="overline">{standalone ? 'App XOXO' : 'Mon téléphone'}</p>
        <h1 style={{ fontSize: 30 }}>{data?.guestName ? `Salut ${data.guestName} 👋` : 'Mes commandes'}</h1>
      </div>

      {!data ? (
        <div className="skel" style={{ height: 120 }} />
      ) : orders.length ? (
        <div className="col" style={{ gap: 8 }}>
          {orders.map(o => (
            <Link key={o.token} to={`/c/${o.token}`} className={cls('card order-row', o.status === 'ready' && 'is-ready')}>
              <span className="or-art" style={{ background: 'var(--surface2)' }}>{o.emoji}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <b style={{ display: 'block' }}>{o.qty > 1 ? `${o.qty}× ` : ''}{o.name}</b>
                <span className="tiny muted">
                  {STATUS[o.status]}{o.eta && ['pending', 'preparing'].includes(o.status) ? ` · ${etaLabel(o.eta.minutes)}` : ''}
                </span>
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty icon="🍸" title="Aucune commande sur ce téléphone" text={standalone ? 'Tu as commandé depuis le navigateur ? Relie-le juste en dessous.' : 'Scanne la borne au bar pour commander.'} />
      )}

      <div className="card pad col" style={{ gap: 12 }}>
        <b className="row" style={{ gap: 8 }}><Link2 size={17} /> Relier l'app et le navigateur</b>
        <p className="small muted">
          Sur iPhone, l'app installée et Safari ne se « voient » pas. Affiche un code sur l'un, tape-le sur l'autre :
          tes commandes et notifications seront réunies.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          {myCode ? (
            <span className="link-code tabular">{myCode}</span>
          ) : (
            <button className="btn" onClick={showCode}>Afficher mon code</button>
          )}
          <span className="tiny faint">valable 15 min</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input grow" inputMode="numeric" maxLength={4} value={code} placeholder="Code de l'autre appareil"
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && code.length === 4 && link()} />
          <button className="btn primary" disabled={code.length !== 4} onClick={link}>Relier</button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Routes, Route, NavLink, Navigate, Link, useNavigate } from 'react-router-dom'
import { Timer, LogOut, LayoutDashboard, Eye, ClipboardList, Boxes, Users, Martini, SquarePen, Gauge, Pause, Play } from 'lucide-react'
import { useApp, call, logout } from '../../store.js'
import { ConnDot, Modal, Stepper, cls, clock, etaLabel, serviceStatus } from '../../ui.jsx'
import Orders from './Orders.jsx'
import Stock from './Stock.jsx'
import Guests from './Guests.jsx'
import Carte from './Carte.jsx'
import Edition from './Edition.jsx'
import Service from './Service.jsx'

/* Pastille d'en-tête : estimation live + réglages express du rythme. */
function ServiceChip() {
  const { staff, pub } = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const q = staff?.queue
  const wait = pub?.wait
  const st = serviceStatus(wait)
  const service = body => call('PATCH', '/api/settings/service', body)
  if (!q) return null
  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)} title="Estimation live du temps d'attente">
        <span className="dot" style={{ background: `var(--${st.tone === 'muted' ? 'text3' : st.tone})` }} />
        <Timer size={15} style={{ color: 'var(--blue)' }} />
        <span className="tabular">{etaLabel(q.nextMinutes)}</span>
        <span className="tiny muted nowrap conn-label">· {q.pendingCount} en file</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Rythme du bar">
        <div className="eta-live">
          <span className="tabular">{etaLabel(q.nextMinutes)}</span>
          <p className="tiny muted">annoncé aux invités · prête vers {clock(Date.now() + q.nextMinutes * 60000)} · {q.queuedDrinks} boisson{q.queuedDrinks > 1 ? 's' : ''} en cours</p>
        </div>
        <div className="row between">
          <span className="small bold">Barmans en service</span>
          <Stepper value={staff.settings.barmen} onChange={v => service({ barmen: v })} min={1} max={10} />
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {wait?.paused ? (
            <button className="btn primary grow" onClick={() => service({ pauseMinutes: 0 })}><Play size={15} /> Reprendre (pause jusqu'à {clock(wait.pauseUntil)})</button>
          ) : (
            [5, 10, 15].map(m => <button key={m} className="chip" onClick={() => service({ pauseMinutes: m })}><Pause size={13} /> Pause {m} min</button>)
          )}
        </div>
        <button className="btn ghost" onClick={() => { setOpen(false); nav('/bar/service') }}><Gauge size={15} /> Tous les réglages du service</button>
      </Modal>
    </>
  )
}

const TABS = [
  { to: 'commandes', label: 'Commandes', icon: ClipboardList },
  { to: 'service', label: 'Service', icon: Gauge },
  { to: 'stocks', label: 'Stocks', icon: Boxes },
  { to: 'invites', label: 'Invités', icon: Users },
  { to: 'carte', label: 'Carte', icon: Martini },
  { to: 'edition', label: 'Édition', icon: SquarePen },
]

export default function Bar() {
  const { me, staff } = useApp()
  const claims = staff?.orders.filter(o => o.donation?.status === 'claimed' && !o.priority && !o.archived).length || 0
  return (
    <div className="staff-page">
      <header className="staff-head glass">
        <Link to="/" className="logo-mark grad-text" style={{ fontSize: 17 }}>XOXO</Link>
        <nav className="seg bar-tabs">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => cls('seg-tab', isActive && 'active')}>
              <t.icon size={16} />
              <span className="bar-tab-label">{t.label}</span>
              {t.to === 'commandes' && claims > 0 && <span className="tab-dot">{claims}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="grow" />
        <ServiceChip />
        <ConnDot />
        {me?.role === 'admin' && (
          <Link to="/admin" className="btn sm ghost" title="Administration"><LayoutDashboard size={16} /></Link>
        )}
        <Link to="/" className="btn sm ghost" title="Voir la carte invités"><Eye size={16} /></Link>
        <button className="btn sm ghost" onClick={logout} title="Se déconnecter"><LogOut size={16} /></button>
      </header>
      <div className="staff-body">
        <Routes>
          <Route path="commandes" element={<Orders />} />
          <Route path="service" element={<Service />} />
          <Route path="stocks" element={<Stock />} />
          <Route path="invites" element={<Guests />} />
          <Route path="carte" element={<Carte />} />
          <Route path="edition" element={<Edition />} />
          <Route path="*" element={<Navigate to="commandes" replace />} />
        </Routes>
      </div>
    </div>
  )
}

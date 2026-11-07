import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Martini, Clock, ClipboardList, Users, TrendingUp, AlertTriangle, GlassWater } from 'lucide-react'
import { useApp } from '../../store.js'
import { stockLevel } from '../bar/Stock.jsx'
import { levelOf, LEVEL_COLOR, plural, cls } from '../../ui.jsx'

function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card stat-card fade-up">
      <span className="s-label"><Icon size={14} style={{ color: color || 'var(--violet)' }} /> {label}</span>
      <span className="s-value tabular">{value}</span>
      {sub && <span className="s-sub">{sub}</span>}
    </div>
  )
}

const STATUS_META = [
  { key: 'pending', label: 'En attente', color: 'var(--orange)' },
  { key: 'preparing', label: 'En préparation', color: 'var(--blue)' },
  { key: 'ready', label: 'Prêtes', color: 'var(--green)' },
  { key: 'served', label: 'Servies', color: '#8b8ba3' },
]

export default function Dashboard() {
  const { staff } = useApp()

  const d = useMemo(() => {
    if (!staff) return null
    const orders = staff.orders
    const count = s => orders.filter(o => o.status === s && !o.archived).length
    const served = orders.filter(o => o.status === 'served')
    const available = staff.cocktails.filter(c => c.available).length
    const unavailable = staff.cocktails.length - available
    const lows = staff.ingredients.filter(i => stockLevel(i) !== 'green')
      .sort((a, b) => (a.stock / (a.initialStock || 1)) - (b.stock / (b.initialStock || 1)))
    const pointsServed = served.reduce((s, o) => s + o.points * o.qty, 0)
      + staff.guests.reduce((s, g) => s + Math.max(0, g.adjust || 0), 0)
    const top = Object.values(
      served.reduce((acc, o) => {
        acc[o.name] = acc[o.name] || { name: o.name, emoji: o.emoji, n: 0 }
        acc[o.name].n += o.qty
        return acc
      }, {})
    ).sort((a, b) => b.n - a.n).slice(0, 6)
    const statusCounts = {
      pending: count('pending'), preparing: count('preparing'), ready: count('ready'),
      served: served.length,
    }
    return { available, unavailable, lows, pointsServed, top, statusCounts, servedTotal: served.length }
  }, [staff])

  if (!staff || !d) return null

  const totalStatus = Object.values(d.statusCounts).reduce((a, b) => a + b, 0)
  let acc = 0
  const donutStops = STATUS_META.map(s => {
    const from = totalStatus ? (acc / totalStatus) * 360 : 0
    acc += d.statusCounts[s.key]
    const to = totalStatus ? (acc / totalStatus) * 360 : 0
    return `${s.color} ${from}deg ${to}deg`
  }).join(', ')

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Tableau de bord</h2>
          <p className="small muted">La soirée en un coup d'œil — tout se met à jour en direct.</p>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon={Martini} label="Cocktails dispo" value={`${d.available}/${staff.cocktails.length}`}
          sub={d.unavailable ? `${plural(d.unavailable, 'indisponible')}` : 'Carte complète 🎉'} color="var(--pink)" />
        <Stat icon={ClipboardList} label="En attente" value={d.statusCounts.pending} sub="commandes à lancer" color="var(--orange)" />
        <Stat icon={GlassWater} label="En préparation" value={d.statusCounts.preparing} sub={`${d.statusCounts.ready} prête${d.statusCounts.ready > 1 ? 's' : ''} au comptoir`} color="var(--blue)" />
        <Stat icon={TrendingUp} label="Servies" value={d.servedTotal} sub={`${d.pointsServed} points alcool au total`} color="var(--green)" />
        <Stat icon={Clock} label="Attente affichée" value={`${staff.queue?.nextMinutes ?? 1} min`} sub={`estimation live · ${staff.queue?.pendingCount ?? 0} en file`} color="var(--blue)" />
        <Stat icon={Users} label="Invités suivis" value={staff.guests.length}
          sub={`${staff.guests.filter(g => levelOf(g.total) === 'red').length} au niveau rouge`} color="var(--violet)" />
      </div>

      <div className="dash-cols">
        <div className="card pad col" style={{ gap: 14 }}>
          <div className="row between">
            <h3 style={{ fontSize: 16 }}>Commandes par statut</h3>
            <Link to="/bar/commandes" className="btn ghost sm">Ouvrir →</Link>
          </div>
          <div className="row" style={{ gap: 22, flexWrap: 'wrap' }}>
            <div className="donut" style={{ background: totalStatus ? `conic-gradient(${donutStops})` : 'var(--surface2)' }}>
              <div className="d-center">
                <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--display)' }}>{totalStatus}</span>
                <span className="tiny muted">commandes</span>
              </div>
            </div>
            <div className="legend grow">
              {STATUS_META.map(s => (
                <div key={s.key} className="row between">
                  <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: s.color }} /> {s.label}</span>
                  <b className="tabular">{d.statusCounts[s.key]}</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card pad col" style={{ gap: 14 }}>
          <div className="row between">
            <h3 style={{ fontSize: 16 }}>Top cocktails servis</h3>
          </div>
          <div className="col" style={{ gap: 11 }}>
            {d.top.map(t => (
              <div key={t.name} className="hbar">
                <span style={{ width: 150 }} className="ellipsis">{t.emoji} {t.name}</span>
                <div className="hb-track"><div className="hb-fill" style={{ width: `${(t.n / d.top[0].n) * 100}%` }} /></div>
                <b className="tabular" style={{ width: 22, textAlign: 'right' }}>{t.n}</b>
              </div>
            ))}
            {!d.top.length && <p className="small faint">Les premières commandes servies apparaîtront ici.</p>}
          </div>
        </div>

        <div className="card pad col" style={{ gap: 12 }}>
          <div className="row between">
            <h3 style={{ fontSize: 16 }}>Stocks à surveiller</h3>
            <Link to="/bar/stocks" className="btn ghost sm">Gérer →</Link>
          </div>
          {d.lows.slice(0, 6).map(i => {
            const lvl = stockLevel(i)
            return (
              <div key={i.id} className="hbar">
                <span style={{ width: 150 }} className="ellipsis">{i.emoji} {i.name}</span>
                <div className="hb-track">
                  <div className="hb-fill" style={{ width: `${Math.min(100, (i.stock / (i.initialStock || 1)) * 100)}%`, background: lvl === 'red' ? 'var(--red)' : 'var(--orange)' }} />
                </div>
                <span className={cls('tabular small bold nowrap')} style={{ color: lvl === 'red' ? 'var(--red)' : 'var(--orange)', minWidth: 54, textAlign: 'right' }}>
                  {i.stock} {i.unit}
                </span>
              </div>
            )
          })}
          {!d.lows.length && <p className="small faint">✅ Aucun stock critique pour le moment.</p>}
        </div>

        <div className="card pad col" style={{ gap: 12 }}>
          <div className="row between">
            <h3 style={{ fontSize: 16 }}>Niveaux invités</h3>
            <Link to="/bar/invites" className="btn ghost sm">Ouvrir →</Link>
          </div>
          {[...staff.guests].sort((a, b) => b.total - a.total).slice(0, 6).map(g => {
            const lvl = levelOf(g.total)
            return (
              <div key={g.id} className="row between">
                <span className="ellipsis">{g.name}</span>
                <span className="badge" style={{ color: LEVEL_COLOR[lvl], borderColor: 'var(--border)' }}>
                  {g.total} pts
                </span>
              </div>
            )
          })}
          {!staff.guests.length && <p className="small faint">Aucune fiche invité pour l'instant.</p>}
        </div>
      </div>
    </>
  )
}

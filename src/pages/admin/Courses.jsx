import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Minus, Plus, RotateCcw, Check, ChevronDown } from 'lucide-react'
import { api, toast, onShoppingChanged } from '../../store.js'

/* Liste de courses interactive (admin) — volontairement sobre et claire,
   pensée pour être utilisée en magasin sur téléphone (ou imprimée).
   Calcul côté serveur ; coches et quantités partagées entre appareils. */

const eur = n => (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const num = n => String(n).replace('.', ',')

function Qty({ value, onChange }) {
  return (
    <div className="sh-qty" onClick={e => e.stopPropagation()}>
      <button onClick={() => onChange(Math.max(0, value - 1))} aria-label="Moins"><Minus size={14} /></button>
      <span className="tabular">{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="Plus"><Plus size={14} /></button>
    </div>
  )
}

function Field({ label, hint, value, step, min, max, suffix, onChange }) {
  const fmt = v => num(v) + (suffix || '')
  return (
    <div className="sh-field">
      <div>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      <div className="sh-qty">
        <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label="Moins"><Minus size={14} /></button>
        <span className="tabular">{fmt(value)}</span>
        <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} aria-label="Plus"><Plus size={14} /></button>
      </div>
    </div>
  )
}

export default function Courses() {
  const [data, setData] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const load = useCallback(() => api('GET', '/api/shopping').then(setData).catch(e => toast('error', 'Liste indisponible', e.message)), [])
  useEffect(() => { load() }, [load])
  useEffect(() => onShoppingChanged(load), [load])

  const send = async (path, body, method = 'POST') => {
    try { setData(await api(method, path, body)) } catch (e) { toast('error', 'Oups', e.message); load() }
  }

  // Cocher : mise à jour immédiate à l'écran, puis enregistrement.
  const toggle = item => {
    setData(d => {
      const items = d.items.map(l => (l.key === item.key ? { ...l, checked: !l.checked } : l))
      const remaining = items.filter(l => !l.checked).reduce((t, l) => t + l.total, 0)
      return { ...d, items, totals: { ...d.totals, remaining, bought: d.totals.total - remaining, checked: items.filter(l => l.checked && l.qty > 0).length } }
    })
    send('/api/shopping/line', { key: item.key, checked: !item.checked })
  }

  const sections = useMemo(() => {
    if (!data) return []
    return data.aisles
      .map(a => {
        const items = data.items.filter(l => l.aisle === a.id)
        return { ...a, items, total: items.reduce((t, l) => t + l.total, 0), left: items.filter(l => !l.checked && l.qty > 0).length }
      })
      .filter(s => s.items.length)
  }, [data])

  if (!data) return <div className="shop"><p className="sh-muted">Calcul de la liste…</p></div>

  const t = data.totals
  const s = data.settings
  const pct = t.total > 0 ? Math.round((t.bought / t.total) * 100) : 0
  const setSetting = patch => send('/api/shopping/settings', patch, 'PATCH')

  return (
    <div className="shop">
      <header className="sh-head">
        <div>
          <p className="sh-kicker">Admin · Liste de courses</p>
          <h1>Courses de la soirée</h1>
          <p className="sh-muted">
            Calculée depuis la carte du bar : <b>{data.drinks} boissons</b> pour <b>{data.guests} invités</b> ({num(s.drinksPerGuest)} par personne, marge {s.margin} %).
          </p>
        </div>
        <button className="sh-btn no-print" onClick={() => window.print()}><Printer size={15} /> Imprimer</button>
      </header>

      <div className="sh-summary">
        <div className="sh-sum">
          <span>Total estimé</span>
          <b className="tabular">{eur(t.total)}</b>
          <small>{eur(t.perGuest)} par invité · dont alcools {eur(t.alcohol)}</small>
        </div>
        <div className="sh-sum">
          <span>Reste à acheter</span>
          <b className="tabular">{eur(t.remaining)}</b>
          <small>{t.checked} / {t.count} articles dans le caddie</small>
        </div>
        <div className="sh-progress" aria-label={`${pct} % acheté`}><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="sh-panel no-print">
        <button className="sh-toggle" onClick={() => setShowSettings(v => !v)}>
          <span>Paramètres du calcul</span>
          <ChevronDown size={16} style={{ transform: showSettings ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        {showSettings && (
          <div className="sh-settings">
            <Field label="Invités" value={s.guests} step={5} min={5} max={500} onChange={v => setSetting({ guests: v })} />
            <Field label="Boissons par invité" hint="cocktails, shots et softs compris" value={s.drinksPerGuest} step={0.5} min={0.5} max={10} onChange={v => setSetting({ drinksPerGuest: v })} />
            <Field label="Marge de sécurité" value={s.margin} step={5} min={0} max={50} suffix=" %" onChange={v => setSetting({ margin: v })} />
            <label className="sh-field sh-check-field">
              <div>
                <b>Déduire ce qu'il reste au bar</b>
                <small>Utilise les stocks saisis dans l'onglet Stocks (bouteilles entamées…)</small>
              </div>
              <input type="checkbox" checked={!!s.deductStock} onChange={e => setSetting({ deductStock: e.target.checked })} />
            </label>
            <p className="sh-muted sh-small">
              Répartition prévue (ventes réelles de la soirée 1 + estimation pour les nouveautés) :{' '}
              {data.plan.filter(p => p.n >= 0.5).sort((a, b) => b.n - a.n).map(p => `${p.name} ×${Math.round(p.n)}`).join(' · ')}
            </p>
            <div className="sh-row">
              <button className="sh-btn" onClick={() => send('/api/shopping/reset', { checks: true })}><RotateCcw size={14} /> Tout décocher</button>
              <button className="sh-btn" onClick={() => send('/api/shopping/reset', { checks: false, quantities: true })}>Rétablir les quantités calculées</button>
            </div>
          </div>
        )}
      </div>

      {(data.costly?.length > 0 || data.tips?.length > 0) && (
        <div className="sh-panel sh-tips no-print">
          <b>Pour alléger la note</b>
          <ul>
            {data.costly.map(c => (
              <li key={c.name}>
                <span>Retirer {c.emoji} {c.name} de la carte <small>(≈ {c.glasses} verres prévus, bouteilles peu utilisées)</small></span>
                <b>−{eur(c.saving)}</b>
              </li>
            ))}
            {data.tips.map(x => (
              <li key={x.label}><span>{x.label}</span><b>−{eur(x.saving)}</b></li>
            ))}
          </ul>
          <small className="sh-muted">Indicatif : rien n'est retiré automatiquement (archiver un cocktail se fait dans Édition).</small>
        </div>
      )}

      {sections.map(sec => (
        <section key={sec.id} className="sh-section">
          <h2>
            <span>{sec.label}</span>
            <small className="tabular">{sec.left ? `${sec.left} à prendre · ` : '✓ · '}{eur(sec.total)}</small>
          </h2>
          <ul>
            {sec.items.map(l => (
              <li key={l.key} className={l.checked ? 'done' : l.qty === 0 ? 'zero' : ''} onClick={() => l.qty > 0 && toggle(l)}>
                <span className="sh-box" aria-hidden="true">{l.checked && <Check size={14} strokeWidth={3} />}</span>
                <div className="sh-item">
                  <div className="sh-name">
                    <b>{l.name}</b> <span className="sh-fmt">{l.format}</span>
                    {l.overridden && <span className="sh-tag">modifié</span>}
                  </div>
                  <small>
                    {[l.note, l.need && `besoin ≈ ${l.needLeft || l.need}`, l.usedBy].filter(Boolean).join(' · ')}
                  </small>
                </div>
                <Qty value={l.qty} onChange={v => send('/api/shopping/line', { key: l.key, qty: v })} />
                <div className="sh-price">
                  <b className="tabular">{eur(l.total)}</b>
                  <small className="tabular">{l.qty > 1 || l.qty === 0 ? `${eur(l.price)} l'unité` : ''}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="sh-muted sh-small">{data.pricesNote} Quantités arrondies aux formats vendus en magasin, combinaison la moins chère.</p>
    </div>
  )
}

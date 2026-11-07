import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useApp, call } from '../../store.js'
import { Modal, Field, SearchBar, ConfirmBtn, Empty } from '../../ui.jsx'
import { stockLevel } from '../bar/Stock.jsx'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const UNITS = ['cl', 'pièce', 'brin', 'feuille', 'cuillère', 'trait', 'portion']
const LEVEL_BG = { red: 'var(--red)', orange: 'var(--orange)', green: 'var(--green)' }

const blank = { name: '', emoji: '🧪', unit: 'cl', stock: 100, low: 15, step: 5 }

function Editor({ open, ing, onClose }) {
  const [d, setD] = useState(blank)
  useEffect(() => {
    if (open) setD(ing ? { name: ing.name, emoji: ing.emoji, unit: ing.unit, stock: ing.stock, low: ing.low, step: ing.step, initialStock: ing.initialStock } : blank)
  }, [open, ing])
  const set = patch => setD(x => ({ ...x, ...patch }))
  const num = v => String(v).replace(',', '.')

  const save = async () => {
    const r = ing
      ? await call('PATCH', `/api/ingredients/${ing.id}`, d)
      : await call('POST', '/api/ingredients', d)
    if (r) onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={ing ? `Modifier ${ing.name}` : 'Nouvel ingrédient'}>
      <div className="row" style={{ gap: 10 }}>
        <Field label="Emoji">
          <input className="input" style={{ width: 70, textAlign: 'center', fontSize: 19 }} value={d.emoji} onChange={e => set({ emoji: e.target.value })} />
        </Field>
        <div className="grow"><Field label="Nom">
          <input className="input" autoFocus={!ing} value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Vodka, Menthe fraîche…" />
        </Field></div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="grow"><Field label="Unité">
          <select className="input" value={d.unit} onChange={e => set({ unit: e.target.value })}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field></div>
        <div className="grow"><Field label={ing ? 'Stock actuel' : 'Stock de départ'}>
          <input className="input" inputMode="decimal" value={d.stock} onChange={e => set({ stock: num(e.target.value) })} />
        </Field></div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="grow"><Field label="Seuil d'alerte">
          <input className="input" inputMode="decimal" value={d.low} onChange={e => set({ low: num(e.target.value) })} />
        </Field></div>
        <div className="grow"><Field label="Pas des boutons +/−">
          <input className="input" inputMode="decimal" value={d.step} onChange={e => set({ step: num(e.target.value) })} />
        </Field></div>
        {ing && (
          <div className="grow"><Field label="Stock de référence">
            <input className="input" inputMode="decimal" value={d.initialStock} onChange={e => set({ initialStock: num(e.target.value) })} />
          </Field></div>
        )}
      </div>
      <p className="tiny faint">Sous le seuil d'alerte, une notification préviendra le bar. Le stock de référence sert au bouton « recharger ».</p>
      <button className="btn primary full" onClick={save}>{ing ? 'Enregistrer' : 'Créer l\'ingrédient'}</button>
    </Modal>
  )
}

export default function Ingredients() {
  const { staff, me } = useApp()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | {} | ingredient

  const list = useMemo(
    () => (staff?.ingredients || [])
      .filter(i => !q || norm(i.name).includes(norm(q)))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, q]
  )

  if (!staff) return null

  const usedIn = ingId => staff.cocktails.filter(c => c.ingredients.some(l => l.ingredientId === ingId)).length

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Ingrédients</h2>
          <p className="small muted">Base entièrement modifiable — les recettes et la disponibilité suivent automatiquement.</p>
        </div>
        <div className="grow" />
        <button className="btn primary" onClick={() => setEditing({})}><Plus size={17} /> Nouvel ingrédient</button>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Chercher un ingrédient…" style={{ maxWidth: 380 }} />
      </div>

      <div className="col" style={{ gap: 9 }}>
        {list.map(i => {
          const lvl = stockLevel(i)
          const n = usedIn(i.id)
          return (
            <div key={i.id} className="card list-row hover" style={{ cursor: 'pointer' }} onClick={() => setEditing(i)}>
              <span className="s-emoji" style={{ fontSize: 24, width: 34, textAlign: 'center' }}>{i.emoji}</span>
              <div className="grow">
                <span className="bold" style={{ fontSize: 15 }}>{i.name}</span>
                <div className="tiny muted" style={{ marginTop: 2 }}>
                  seuil {i.low} {i.unit} · pas ±{i.step} · dans {n} recette{n > 1 ? 's' : ''}
                </div>
              </div>
              <span className="stock-qty nowrap tabular" style={{ color: LEVEL_BG[lvl] }}>
                {i.stock}<span className="unit">/ {i.initialStock} {i.unit}</span>
              </span>
              <button className="btn icon sm" onClick={e => { e.stopPropagation(); setEditing(i) }} aria-label="Modifier"><Pencil size={15} /></button>
              {me?.role === 'admin' && (
                <ConfirmBtn
                  className="btn ghost icon sm"
                  onConfirm={() => call('DELETE', `/api/ingredients/${i.id}`)}
                  confirmLabel="Sûr ?"
                >
                  <Trash2 size={15} />
                </ConfirmBtn>
              )}
            </div>
          )
        })}
        {!list.length && <Empty icon="📦" title="Aucun ingrédient" text="Ajoute ton premier ingrédient pour construire les recettes." />}
      </div>

      <Editor open={editing !== null} ing={editing?.id ? editing : null} onClose={() => setEditing(null)} />
    </>
  )
}

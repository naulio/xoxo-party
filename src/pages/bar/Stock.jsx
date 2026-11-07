import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Settings2 } from 'lucide-react'
import { useApp, call } from '../../store.js'
import { SearchBar, Seg, Stepper, Empty, cls } from '../../ui.jsx'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function stockLevel(i) {
  if (i.stock <= 0) return 'red'
  if (i.stock <= i.low) return 'orange'
  return 'green'
}
const LEVEL_BG = { red: 'var(--red)', orange: 'var(--orange)', green: 'var(--green)' }

function StockRow({ i }) {
  const lvl = stockLevel(i)
  const pct = i.initialStock > 0 ? Math.min(100, (i.stock / i.initialStock) * 100) : 0
  const setStock = v => call('PATCH', `/api/ingredients/${i.id}`, { stock: v })
  return (
    <div className="card stock-row">
      <span className="s-emoji">{i.emoji}</span>
      <div className="grow">
        <div className="row" style={{ gap: 8 }}>
          <span className="bold ellipsis">{i.name}</span>
          {lvl === 'red' && <span className="badge red">Rupture</span>}
          {lvl === 'orange' && <span className="badge orange">Faible</span>}
        </div>
        <div className="stock-bar">
          <div style={{ width: `${pct}%`, background: LEVEL_BG[lvl] }} />
        </div>
      </div>
      <div className="stock-qty nowrap">
        <span className="tabular" style={{ color: LEVEL_BG[lvl] }}>{i.stock}</span>
        <span className="unit">{i.unit}</span>
      </div>
      <Stepper value={i.stock} onChange={setStock} step={i.step || 1} min={0} editable />
      <button
        className="btn ghost icon sm" title={`Recharger à ${i.initialStock} ${i.unit}`}
        onClick={() => call('POST', `/api/ingredients/${i.id}/restock`)}
      >
        <RotateCcw size={15} />
      </button>
    </div>
  )
}

export default function Stock() {
  const { staff, me } = useApp()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('level')

  const list = useMemo(() => {
    const arr = (staff?.ingredients || []).filter(i => !q || norm(i.name).includes(norm(q)))
    if (sort === 'level') {
      const rank = { red: 0, orange: 1, green: 2 }
      arr.sort((a, b) => rank[stockLevel(a)] - rank[stockLevel(b)] || a.name.localeCompare(b.name))
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name))
    }
    return arr
  }, [staff, q, sort])

  if (!staff) return null
  const lowCount = staff.ingredients.filter(i => stockLevel(i) !== 'green').length

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Stocks</h2>
          <p className="small muted">
            {lowCount > 0
              ? `${lowCount} ingrédient${lowCount > 1 ? 's' : ''} à surveiller — la carte des invités s'ajuste automatiquement.`
              : 'Tous les niveaux sont bons. La carte des invités s\'ajuste automatiquement.'}
          </p>
        </div>
        <div className="grow" />
        {me?.role === 'admin' && (
          <Link to="/admin/ingredients" className="btn sm ghost"><Settings2 size={15} /> Gérer les ingrédients</Link>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Chercher un ingrédient…" style={{ maxWidth: 380 }} />
        <Seg
          value={sort} onChange={setSort}
          options={[{ value: 'level', label: 'Critiques d\'abord' }, { value: 'name', label: 'A → Z' }]}
        />
      </div>

      <div className="col" style={{ gap: 9 }}>
        {list.map(i => <StockRow key={i.id} i={i} />)}
        {!list.length && <Empty icon="📦" title="Aucun ingrédient" text="Ajoute des ingrédients depuis l'espace admin." />}
      </div>
    </>
  )
}

import { useApp, call } from '../../store.js'
import { Switch, Empty, cls, plural } from '../../ui.jsx'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function Carte() {
  const { staff } = useApp()
  if (!staff) return null
  const list = staff.cocktails.filter(c => !c.archived)
  const visibleCount = list.filter(c => c.available).length
  const archivedCount = staff.cocktails.length - list.length

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Carte des invités</h2>
          <p className="small muted">
            {visibleCount}/{list.length} cocktails affichés aux invités{archivedCount ? ` (${archivedCount} archivés, réactivables dans Édition)` : ''}.
            Un cocktail sans stock disparaît automatiquement ; le switch permet d'en masquer un même s'il est réalisable.
          </p>
        </div>
      </div>

      <div className="col" style={{ gap: 9 }}>
        {list.map(c => (
          <div key={c.id} className="card list-row">
            <div className="thumb" style={{ background: `linear-gradient(135deg, hsl(${c.hue ?? 300} 82% 58%), hsl(${((c.hue ?? 300) + 55) % 360} 82% 42%))` }}>
              {c.imageUrl ? <img src={c.imageUrl} alt="" /> : c.emoji}
            </div>
            <div className="grow">
              <div className="row wrap" style={{ gap: 8 }}>
                <span className="bold" style={{ fontSize: 15.5 }}>{c.name}</span>
                <span className="tag">{c.category}</span>
                <span className="badge violet">{c.points === 0 ? 'Sans alcool' : plural(c.points, 'pt')}</span>
                {c.secret && <span className="badge orange" title="Révélé par le bouton « Futur champion » en bas de la carte publique">🏆 Secret</span>}
              </div>
              <div className="small row wrap" style={{ gap: 6, marginTop: 3 }}>
                {c.makeable ? (
                  <span className="row" style={{ gap: 5, color: 'var(--green)' }}>
                    <CheckCircle2 size={14} /> Réalisable {Number.isFinite(c.maxCount) && c.maxCount < 99 ? `×${c.maxCount}` : ''}
                  </span>
                ) : (
                  <span className="row" style={{ gap: 5, color: 'var(--red)' }}>
                    <XCircle size={14} /> Manque : {c.missing.join(', ')}
                  </span>
                )}
                {!c.visible && <span className="faint">· masqué manuellement</span>}
              </div>
            </div>
            <div className="col" style={{ alignItems: 'center', gap: 4 }}>
              <Switch checked={c.visible} onChange={v => call('PATCH', `/api/cocktails/${c.id}`, { visible: v })} />
              <span className="tiny faint">{c.visible ? 'Visible' : 'Masqué'}</span>
            </div>
          </div>
        ))}
        {!staff.cocktails.length && <Empty icon="🍸" title="Aucun cocktail" text="Crée la carte depuis l'espace admin." />}
      </div>
    </>
  )
}

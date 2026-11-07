import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, ImagePlus, X, CheckCircle2, XCircle } from 'lucide-react'
import { useApp, call, uploadImage, toast } from '../../store.js'
import { Sheet, Field, Seg, Switch, SearchBar, ConfirmBtn, Empty, cls, plural, PT_LABEL } from '../../ui.jsx'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const EMOJIS = ['🍸', '🍹', '🥃', '🍷', '🥂', '🍾', '🌿', '🍃', '🍋', '🍊', '🍑', '🍓', '🍍', '🥥', '🫐', '💙', '💜', '🖤', '🌅', '⚡', '🔥', '🧊', '🫧', '✨']

const blank = () => ({
  name: '', emoji: '🍸', hue: 300, category: 'Classiques', points: 2,
  description: '', steps: '', visible: true, secret: false, ingredients: [],
})

function Editor({ open, cocktail, onClose }) {
  const { staff, me } = useApp()
  const [d, setD] = useState(blank())
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const isNew = !cocktail?.id

  useEffect(() => {
    if (open) {
      setD(cocktail?.id ? {
        name: cocktail.name, emoji: cocktail.emoji, hue: cocktail.hue ?? 300,
        category: cocktail.category, points: cocktail.points, description: cocktail.description,
        steps: cocktail.steps || '', visible: cocktail.visible, secret: cocktail.secret || false,
        archived: cocktail.archived || false,
        ingredients: cocktail.ingredients.map(l => ({ ...l })),
      } : blank())
      setFile(null)
      setPreview(null)
    }
  }, [open, cocktail])

  const set = patch => setD(x => ({ ...x, ...patch }))
  const ingredients = staff?.ingredients || []
  const usedIds = new Set(d.ingredients.map(l => l.ingredientId))
  const firstFree = ingredients.find(i => !usedIds.has(i.id))

  const pickFile = f => {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const save = async () => {
    if (!d.name.trim()) return toast('error', 'Nom manquant', 'Donne un nom à ce cocktail.')
    const lines = d.ingredients.filter(l => l.ingredientId && +l.qty > 0)
    if (!lines.length) return toast('error', 'Recette vide', 'Ajoute au moins un ingrédient.')
    setSaving(true)
    try {
      const payload = { ...d, ingredients: lines }
      const saved = isNew
        ? await call('POST', '/api/cocktails', payload)
        : await call('PATCH', `/api/cocktails/${cocktail.id}`, payload)
      if (saved && file) await uploadImage(`/api/cocktails/${saved.id}/image`, file)
      if (saved) {
        toast('success', isNew ? 'Cocktail créé' : 'Cocktail mis à jour', `${d.emoji} ${d.name}`)
        onClose()
      }
    } catch (e) {
      toast('error', 'Photo non envoyée', e.message)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const currentImage = preview || (!file && cocktail?.imageUrl) || null

  return (
    <Sheet
      open={open} onClose={onClose}
      title={isNew ? 'Nouveau cocktail' : `Modifier ${cocktail?.name}`}
      foot={
        <>
          {!isNew && me?.role === 'admin' && (
            <ConfirmBtn className="btn danger" onConfirm={async () => { await call('DELETE', `/api/cocktails/${cocktail.id}`); onClose() }}>
              <Trash2 size={15} /> Supprimer
            </ConfirmBtn>
          )}
          <div className="grow" />
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>
      }
    >
      <div
        className="ck-detail-art"
        style={{ background: `linear-gradient(135deg, hsl(${d.hue} 82% 58%), hsl(${(d.hue + 55) % 360} 82% 42%))`, marginBottom: 0 }}
      >
        {currentImage ? <img src={currentImage} alt="" /> : <span className="a-emoji">{d.emoji}</span>}
        <div className="row" style={{ position: 'absolute', bottom: 10, right: 10, gap: 8 }}>
          <label className="btn sm glass" style={{ cursor: 'pointer' }}>
            <ImagePlus size={15} /> Photo
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => pickFile(e.target.files?.[0])} />
          </label>
          {(currentImage) && (
            <button
              className="btn sm glass"
              onClick={() => { setFile(null); setPreview(null); if (cocktail?.imageUrl && !isNew) call('DELETE', `/api/cocktails/${cocktail.id}/image`) }}
            >
              <X size={14} /> Retirer
            </button>
          )}
        </div>
      </div>

      <Field label="Nom">
        <input className="input" value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Mojito Royal" />
      </Field>

      <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
        <Field label="Emoji">
          <input className="input" style={{ width: 76, textAlign: 'center', fontSize: 20 }} value={d.emoji} onChange={e => set({ emoji: e.target.value })} />
        </Field>
        <div className="field grow">
          <label>Teinte du visuel</label>
          <input type="range" className="hue-slider" min="0" max="360" value={d.hue} onChange={e => set({ hue: +e.target.value })} />
        </div>
      </div>
      <div className="emoji-quick">
        {EMOJIS.map(e => <button key={e} onClick={() => set({ emoji: e })}>{e}</button>)}
      </div>

      <div className="row" style={{ gap: 12 }}>
        <Field label="Catégorie">
          <input className="input" list="cats" value={d.category} onChange={e => set({ category: e.target.value })} />
          <datalist id="cats">{staff?.settings.categories.map(c => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="field">
          <label>Visible</label>
          <div style={{ height: 46, display: 'flex', alignItems: 'center' }}>
            <Switch checked={d.visible} onChange={v => set({ visible: v })} />
          </div>
        </div>
        <div className="field">
          <label>🤫 Secret</label>
          <div style={{ height: 46, display: 'flex', alignItems: 'center' }}>
            <Switch checked={d.secret} onChange={v => set({ secret: v })} />
          </div>
        </div>
      </div>
      {d.secret && (
        <p className="tiny" style={{ color: 'var(--orange)', marginTop: -6 }}>
          Hors carte publique — révélé uniquement par le bouton « 🏆 Futur champion » en bas de la carte.
        </p>
      )}
      {!isNew && (
        <div className="row between card" style={{ padding: '10px 14px', borderRadius: 12 }}>
          <div>
            <div className="bold small">📦 Archivé</div>
            <div className="tiny muted">Retiré de la carte et des listes, recette conservée — réactivable à tout moment.</div>
          </div>
          <Switch checked={d.archived} onChange={v => set({ archived: v })} />
        </div>
      )}

      <Field label={`Points alcool — ${PT_LABEL[d.points]}`}>
        <Seg
          value={d.points} onChange={v => set({ points: v })}
          options={[{ value: 0, label: '0 · Sans' }, { value: 1, label: '1 · Léger' }, { value: 2, label: '2 · Moyen' }, { value: 3, label: '3 · Fort' }]}
        />
      </Field>

      <Field label="Description (visible par les invités)">
        <textarea className="input" value={d.description} onChange={e => set({ description: e.target.value })} placeholder="Frais, fruité, dangereusement bon…" />
      </Field>

      <Field label="Recette — étapes de préparation (une par ligne)">
        <textarea className="input" style={{ minHeight: 110 }} value={d.steps} onChange={e => set({ steps: e.target.value })} placeholder={'Piler la menthe…\nAjouter le rhum…'} />
      </Field>

      <div className="field">
        <label>Ingrédients & quantités</label>
        <div className="col" style={{ gap: 8 }}>
          {d.ingredients.map((l, idx) => {
            const ing = ingredients.find(i => i.id === l.ingredientId)
            return (
              <div key={idx} className="recipe-line">
                <select
                  className="input" value={l.ingredientId}
                  onChange={e => set({ ingredients: d.ingredients.map((x, j) => j === idx ? { ...x, ingredientId: e.target.value } : x) })}
                >
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.emoji} {i.name}</option>)}
                </select>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    className="input" style={{ textAlign: 'right' }} inputMode="decimal" value={l.qty}
                    onChange={e => set({ ingredients: d.ingredients.map((x, j) => j === idx ? { ...x, qty: e.target.value.replace(',', '.') } : x) })}
                  />
                  <span className="tiny muted nowrap" style={{ width: 34 }}>{ing?.unit}</span>
                </div>
                <button className="btn ghost icon sm" onClick={() => set({ ingredients: d.ingredients.filter((_, j) => j !== idx) })} aria-label="Retirer">
                  <X size={15} />
                </button>
              </div>
            )
          })}
          <button
            className="btn sm" disabled={!firstFree}
            onClick={() => set({ ingredients: [...d.ingredients, { ingredientId: firstFree.id, qty: 4 }] })}
          >
            <Plus size={15} /> Ajouter un ingrédient
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export default function Cocktails() {
  const { staff } = useApp()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (nouveau) | cocktail
  const [showArchived, setShowArchived] = useState(false)

  const all = useMemo(
    () => (staff?.cocktails || []).filter(c => !q || norm(c.name + ' ' + c.category).includes(norm(q))),
    [staff, q]
  )
  const list = all.filter(c => !c.archived)
  const archived = all.filter(c => c.archived)

  if (!staff) return null

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Cocktails</h2>
          <p className="small muted">{list.length} recettes à la carte{archived.length ? ` · ${archived.length} archivées` : ''} — disponibilité recalculée en direct selon les stocks.</p>
        </div>
        <div className="grow" />
        <button className="btn primary" onClick={() => setEditing({})}><Plus size={17} /> Nouveau cocktail</button>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Chercher un cocktail…" style={{ maxWidth: 380 }} />
      </div>

      <div className="col" style={{ gap: 9 }}>
        {list.map(c => (
          <div key={c.id} className="card list-row hover" style={{ cursor: 'pointer' }} onClick={() => setEditing(c)}>
            <div className="thumb" style={{ background: `linear-gradient(135deg, hsl(${c.hue ?? 300} 82% 58%), hsl(${((c.hue ?? 300) + 55) % 360} 82% 42%))` }}>
              {c.imageUrl ? <img src={c.imageUrl} alt="" /> : c.emoji}
            </div>
            <div className="grow">
              <div className="row wrap" style={{ gap: 8 }}>
                <span className="bold" style={{ fontSize: 15.5 }}>{c.name}</span>
                <span className="tag">{c.category}</span>
                <span className="badge violet">{c.points === 0 ? 'Sans alcool' : plural(c.points, 'pt')}</span>
                {c.secret && <span className="badge orange">🏆 Secret</span>}
                {!c.visible && <span className="badge">Masqué</span>}
              </div>
              <div className="small muted ellipsis" style={{ marginTop: 3, maxWidth: 560 }}>
                {plural(c.ingredients.length, 'ingrédient')} · {c.description || 'Pas de description'}
              </div>
            </div>
            <span className={cls('row small bold nowrap')} style={{ gap: 5, color: c.makeable ? 'var(--green)' : 'var(--red)' }}>
              {c.makeable ? <><CheckCircle2 size={15} /> ×{c.maxCount < 99 ? c.maxCount : '∞'}</> : <><XCircle size={15} /> épuisé</>}
            </span>
            <button className="btn icon sm" onClick={e => { e.stopPropagation(); setEditing(c) }} aria-label="Modifier"><Pencil size={15} /></button>
          </div>
        ))}
        {!list.length && <Empty icon="🍸" title="Aucun cocktail" text="Crée ta première recette avec le bouton ci-dessus." />}
      </div>

      {archived.length > 0 && (
        <div className="col" style={{ gap: 9, marginTop: 22 }}>
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowArchived(v => !v)}>
            📦 Archivés ({archived.length}) {showArchived ? '▴' : '▾'}
          </button>
          {showArchived && archived.map(c => (
            <div key={c.id} className="card list-row" style={{ opacity: 0.7 }}>
              <div className="thumb" style={{ background: `linear-gradient(135deg, hsl(${c.hue ?? 300} 82% 58%), hsl(${((c.hue ?? 300) + 55) % 360} 82% 42%))` }}>
                {c.imageUrl ? <img src={c.imageUrl} alt="" /> : c.emoji}
              </div>
              <div className="grow">
                <span className="bold">{c.name}</span>
                <div className="tiny muted">{c.category} · recette conservée</div>
              </div>
              <button className="btn sm" onClick={() => call('PATCH', `/api/cocktails/${c.id}`, { archived: false, visible: true })}>Réactiver</button>
              <button className="btn icon sm" onClick={() => setEditing(c)} aria-label="Modifier"><Pencil size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <Editor open={editing !== null} cocktail={editing?.id ? editing : null} onClose={() => setEditing(null)} />
    </>
  )
}

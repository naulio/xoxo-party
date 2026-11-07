import { forwardRef, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Martini, Pencil, Trash2, X, Smartphone } from 'lucide-react'
import { useApp, call } from '../../store.js'
import {
  Modal, BottomSheet, CocktailPicker, SearchBar, Seg, Stepper, ConfirmBtn, Empty,
  LevelTrack, levelOf, LEVEL_EMOJI, LEVEL_LABEL, LEVEL_COLOR, cls, plural, timeAgo, useTick,
} from '../../ui.jsx'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const GuestCard = forwardRef(function GuestCard({ g, onServe, onEdit }, ref) {
  const lvl = levelOf(g.total)
  const recent = [...g.drinks].slice(-3).reverse()
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="card guest-card"
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="g-name">{g.name}</span>
            {g.deviceId && (
              <span
                className="tiny faint row nowrap"
                style={{ gap: 3, fontFamily: 'ui-monospace, monospace', alignSelf: 'center' }}
                title={`Téléphone lié — ID unique : ${g.deviceId}`}
              >
                <Smartphone size={11} /> #{g.deviceId.slice(0, 8)}
              </span>
            )}
          </div>
          {g.comment && <div className="g-comment">« {g.comment} »</div>}
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
          <span className={cls('level-num', `lvl-${lvl}`)}>{g.total}<span style={{ fontSize: 13, fontWeight: 600 }}> pts</span></span>
          <span className="tiny muted nowrap">{LEVEL_EMOJI[lvl]} {LEVEL_LABEL[lvl]}</span>
        </div>
      </div>

      <div>
        <LevelTrack points={g.total} />
        <div className="row between tiny faint" style={{ marginTop: 5, padding: '0 1px' }}>
          <span>🟢 3</span><span>🟠 5</span><span>🔴 6+</span>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="drink-chips">
          {recent.map((d, i) => (
            <span key={i} className="tag" title={timeAgo(d.at)}>
              {d.emoji} {d.qty > 1 ? `${d.qty}× ` : ''}{d.name}
            </span>
          ))}
          {g.drinks.length > 3 && <span className="tag">+{g.drinks.length - 3}</span>}
        </div>
      )}

      <div className="row" style={{ marginTop: 'auto' }}>
        <button className="btn primary grow" onClick={() => onServe(g)}>
          <Martini size={16} /> Servir
        </button>
        <Stepper
          value={g.total}
          onChange={v => call('PATCH', `/api/guests/${g.id}`, { adjust: (g.adjust || 0) + (v - g.total) })}
          min={0} step={1}
        />
        <button className="btn icon" onClick={() => onEdit(g)} aria-label="Modifier"><Pencil size={16} /></button>
      </div>
    </motion.div>
  )
})

function EditGuest({ g, onClose }) {
  const [name, setName] = useState(g?.name || '')
  const [comment, setComment] = useState(g?.comment || '')
  const save = async () => {
    const r = await call('PATCH', `/api/guests/${g.id}`, { name, comment })
    if (r) onClose()
  }
  return (
    <Modal open={!!g} onClose={onClose} title={`Fiche de ${g?.name}`}>
      {g && (
        <>
          <div className="field"><label>Prénom ou surnom</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label>Commentaire libre</label>
            <textarea className="input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Allergies, taxi prévu, mood du soir…" /></div>
          <div className="field">
            <label>Boissons servies ({plural(g.drinks.length, 'entrée')})</label>
            <div className="col" style={{ gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {g.drinks.map((d, i) => (
                <div key={i} className="row card" style={{ padding: '8px 12px', borderRadius: 12 }}>
                  <span>{d.emoji}</span>
                  <span className="grow small">{d.qty > 1 ? `${d.qty}× ` : ''}{d.name}</span>
                  <span className="tiny faint">{timeAgo(d.at)}</span>
                  <span className="badge violet">{d.points} pt{d.points > 1 ? 's' : ''}</span>
                  <button className="btn ghost icon sm" onClick={() => call('DELETE', `/api/guests/${g.id}/drinks/${i}`)} aria-label="Retirer"><X size={14} /></button>
                </div>
              ))}
              {!g.drinks.length && <span className="small faint">Rien encore — la soirée commence.</span>}
            </div>
          </div>
          {g.deviceId && (
            <p className="tiny faint row" style={{ gap: 5 }}>
              <Smartphone size={12} /> Téléphone lié — ID unique : <code style={{ fontFamily: 'ui-monospace, monospace' }}>{g.deviceId}</code>
            </p>
          )}
          <div className="row between">
            <ConfirmBtn onConfirm={async () => { await call('DELETE', `/api/guests/${g.id}`); onClose() }}>
              <Trash2 size={14} /> Supprimer la fiche
            </ConfirmBtn>
            <button className="btn primary" onClick={save}>Enregistrer</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default function Guests() {
  useTick(60000)
  const { staff } = useApp()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('points')
  const [serving, setServing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newComment, setNewComment] = useState('')

  const guests = useMemo(() => {
    const arr = (staff?.guests || []).filter(g => !q || norm(g.name + ' ' + (g.comment || '')).includes(norm(q)))
    if (sort === 'points') arr.sort((a, b) => b.total - a.total)
    else if (sort === 'recent') arr.sort((a, b) => Math.max(b.createdAt, ...b.drinks.map(d => d.at)) - Math.max(a.createdAt, ...a.drinks.map(d => d.at)))
    else arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr
  }, [staff, q, sort])

  // Les cartes se re-rendent via le broadcast : on garde la fiche fraîche.
  const editingFresh = editing ? staff?.guests.find(g => g.id === editing.id) : null
  const servingFresh = serving ? staff?.guests.find(g => g.id === serving.id) : null

  const create = async () => {
    if (!newName.trim()) return
    const r = await call('POST', '/api/guests', { name: newName, comment: newComment })
    if (r) { setCreating(false); setNewName(''); setNewComment('') }
  }

  if (!staff) return null

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Pense-bête invités</h2>
          <p className="small muted">Un tap sur « Servir » ajoute les points du cocktail. Le niveau se met à jour tout seul.</p>
        </div>
        <div className="grow" />
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={17} /> Nouvelle fiche</button>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Retrouver un invité…" style={{ maxWidth: 380 }} />
        <Seg
          value={sort} onChange={setSort}
          options={[{ value: 'points', label: 'Points' }, { value: 'recent', label: 'Récents' }, { value: 'name', label: 'A → Z' }]}
        />
      </div>

      <motion.div className="guest-grid" layout>
        <AnimatePresence mode="popLayout">
          {guests.map(g => <GuestCard key={g.id} g={g} onServe={setServing} onEdit={setEditing} />)}
        </AnimatePresence>
      </motion.div>
      {!guests.length && (
        <Empty
          icon="🫶" title={q ? 'Aucune fiche ne correspond' : 'Aucune fiche pour l\'instant'}
          text={q ? 'Vérifie l\'orthographe ou crée une nouvelle fiche.' : 'Crée une fiche par invité pour suivre sa consommation en douceur.'}
        />
      )}

      <BottomSheet
        open={!!servingFresh}
        onClose={() => setServing(null)}
        title={servingFresh ? `Servir ${servingFresh.name} — ${servingFresh.total} pts ${LEVEL_EMOJI[levelOf(servingFresh.total)]}` : ''}
      >
        {servingFresh && (
          <CocktailPicker
            cocktails={staff.cocktails}
            onPick={async c => {
              await call('POST', `/api/guests/${servingFresh.id}/serve`, { cocktailId: c.id })
              setServing(null)
            }}
          />
        )}
      </BottomSheet>

      <EditGuest g={editingFresh} onClose={() => setEditing(null)} />

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle fiche invité">
        <div className="field"><label>Prénom ou surnom</label>
          <input className="input" autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Léa, DJ Tonio…" onKeyDown={e => e.key === 'Enter' && create()} /></div>
        <div className="field"><label>Commentaire libre (optionnel)</label>
          <textarea className="input" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Allergies, taxi prévu, mood du soir…" /></div>
        <button className="btn primary full" onClick={create}>Créer la fiche</button>
      </Modal>
    </>
  )
}

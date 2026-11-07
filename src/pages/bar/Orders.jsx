import { forwardRef, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, ChevronLeft, ChevronRight, Check, Trash2, Sparkles, QrCode, WifiOff, Megaphone, Gem, X, MonitorUp, Smartphone, Tablet, UserRound } from 'lucide-react'
import { useApp, call, toast } from '../../store.js'
import { Modal, CocktailPicker, Stepper, ConfirmBtn, QRCanvas, useTick, timeAgo, cls, clock } from '../../ui.jsx'

const COLS = [
  { key: 'pending', label: 'File d\'attente', color: 'var(--orange)' },
  { key: 'preparing', label: 'En préparation', color: 'var(--blue)' },
  { key: 'ready', label: 'Prête', color: 'var(--green)' },
  { key: 'served', label: 'Servie', color: 'var(--text3)' },
]
const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'served' }
const PREV = { preparing: 'pending', ready: 'preparing', served: 'ready' }
const NEXT_LABEL = { pending: 'Préparer', preparing: 'Prête', ready: 'Servie' }
const SOURCE = {
  app: { icon: Smartphone, label: 'Commandé depuis le téléphone' },
  kiosk: { icon: Tablet, label: 'Choisi sur la borne' },
  staff: { icon: UserRound, label: 'Commande manuelle (staff)' },
}
const eur = n => `${String(+(+n).toFixed(2)).replace('.', ',')} €`

const OrderCard = forwardRef(function OrderCard({ o, eta, nextUp, onQr }, ref) {
  const setStatus = status => call('PATCH', `/api/orders/${o.id}`, { status })
  const donation = (action, extra) => call('POST', `/api/orders/${o.id}/donation`, { action, ...extra })
  const Src = SOURCE[o.source]?.icon || UserRound
  const claimed = o.donation?.status === 'claimed' && !o.priority
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className={cls('card order-card', o.priority && 'prio', claimed && 'claimed')}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {o.status === 'pending' && eta?.position ? (
          <span className="o-pos tabular">#{eta.position}</span>
        ) : (
          <span style={{ fontSize: 26, lineHeight: 1.2 }}>{o.emoji}</span>
        )}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="o-name">
            {o.priority && <span title={o.donation ? `${eur(o.donation.amount)} · ${o.donation.method === 'paypal' ? 'PayPal' : 'boîte à tips'}` : ''}>💎 </span>}
            {o.status === 'pending' ? `${o.emoji} ` : ''}{o.qty > 1 ? `${o.qty}× ` : ''}{o.name}
          </div>
          <div className="tiny muted row wrap" style={{ gap: '2px 7px' }}>
            {o.guestName && <span className="bold nowrap" style={{ color: 'var(--text2)' }}>{o.guestName}</span>}
            <Src size={12} title={SOURCE[o.source]?.label} />
            <span className="faint nowrap">{timeAgo(o.createdAt)}</span>
            {eta && ['pending', 'preparing'].includes(o.status) && (
              <span className="o-eta nowrap">⏱ {o.status === 'pending' ? clock(eta.at) : `~${eta.minutes} min`}</span>
            )}
          </div>
        </div>
      </div>
      {o.note && <div className="o-note">📝 {o.note}</div>}

      {claimed && (
        <div className="o-claim">
          <span className="grow">💎 Don déclaré : {eur(o.donation.amount)} {o.donation.method === 'paypal' ? 'PayPal' : 'boîte à tips'} — vérifié ?</span>
          <button className="btn sm icon" onClick={() => donation('refuse')} title="Pas reçu" aria-label="Refuser"><X size={15} /></button>
          <button className="btn sm primary" onClick={() => donation('confirm')}><Check size={15} /> Reçu</button>
        </div>
      )}
      {o.status === 'pending' && !o.priority && !claimed && (
        <button className="o-tip" onClick={() => donation('confirm', { method: 'cash' })}>
          <Gem size={12} /> Tip reçu → prioritaire
        </button>
      )}

      <div className="order-actions">
        {PREV[o.status] && (
          <button className="btn sm icon" onClick={() => setStatus(PREV[o.status])} aria-label="Revenir en arrière">
            <ChevronLeft size={16} />
          </button>
        )}
        {o.status === 'ready' && (
          <button className="btn sm icon" onClick={() => call('POST', '/api/kiosk/push', { type: 'call', orderId: o.id })} title="Appeler sur la borne" aria-label="Appeler sur la borne">
            <Megaphone size={15} />
          </button>
        )}
        {['pending', 'preparing'].includes(o.status) && (
          <button className="btn ghost icon sm" onClick={() => onQr(o)} title="QR de suivi" aria-label="QR de suivi">
            <QrCode size={15} />
          </button>
        )}
        <ConfirmBtn className="btn ghost icon sm" onConfirm={() => call('DELETE', `/api/orders/${o.id}`)} confirmLabel="Sûr ?">
          <Trash2 size={15} />
        </ConfirmBtn>
        {NEXT[o.status] ? (
          <button
            className={cls('btn sm next', (o.status === 'ready' || nextUp) ? 'primary' : '')}
            onClick={() => setStatus(NEXT[o.status])}
          >
            {NEXT_LABEL[o.status]} {o.status === 'ready' ? <Check size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className="badge green next center" style={{ height: 34, justifyContent: 'center' }}>
            <Check size={13} /> Servie {o.servedAt ? timeAgo(o.servedAt) : ''}
          </span>
        )}
      </div>
    </motion.div>
  )
})

/* QR de suivi : à faire scanner (commande manuelle) — sur l'iPad barman ou
   envoyé sur la borne invités. */
function OrderQRModal({ order, onClose }) {
  const { staff } = useApp()
  const base = staff?.meta?.appUrl || location.href.split('#')[0]
  const online = !!staff?.meta?.tunnel
  const url = order ? `${base}#/c/${order.token}` : null
  return (
    <Modal open={!!order} onClose={onClose} title={order ? `${order.emoji} ${order.qty > 1 ? order.qty + '× ' : ''}${order.name}` : ''}>
      {order && (
        <div className="col center" style={{ alignItems: 'center', gap: 14 }}>
          <p className="small muted" style={{ textAlign: 'center' }}>
            À faire scanner : suivi en direct + <b style={{ color: 'var(--text)' }}>notification</b> quand c'est prêt.
          </p>
          <QRCanvas url={url} size={248} />
          <code className="tiny faint ellipsis" style={{ maxWidth: '100%', fontFamily: 'ui-monospace, monospace' }}>{url}</code>
          {!online && (
            <div className="row card" style={{ padding: '9px 12px', borderRadius: 12, gap: 10, borderColor: 'rgba(251,191,36,.3)' }}>
              <WifiOff size={16} style={{ color: 'var(--orange)', flexShrink: 0 }} />
              <span className="tiny muted">Mode Wi-Fi local : pas de notification push. Lance <b>start-en-ligne.bat</b> pour le lien fixe + notifs.</span>
            </div>
          )}
          <div className="row" style={{ width: '100%' }}>
            <button className="btn grow" onClick={async () => {
              const r = await call('POST', '/api/kiosk/push', { type: 'qr', orderId: order.id })
              if (r) { toast('success', 'Envoyé sur la borne', 'Le QR s\'affiche 90 s sur l\'iPad invités.'); onClose() }
            }}>
              <MonitorUp size={16} /> Afficher sur la borne
            </button>
            <button className="btn primary grow" onClick={onClose}>C'est scanné ✓</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function NewOrder({ open, onClose, onCreated }) {
  const { staff } = useApp()
  const [ck, setCk] = useState(null)
  const [qty, setQty] = useState(1)
  const [guestName, setGuestName] = useState('')
  const [note, setNote] = useState('')
  const reset = () => { setCk(null); setQty(1); setGuestName(''); setNote('') }

  const submit = async () => {
    if (!guestName.trim()) return toast('error', 'Prénom manquant', 'Le prénom relie la commande à la fiche de l\'invité.')
    const r = await call('POST', '/api/orders', { cocktailId: ck.id, qty, guestName, note })
    if (r) { reset(); onClose(); onCreated(r) }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={ck ? `${ck.emoji} ${ck.name}` : 'Commande manuelle'} wide>
      {!ck ? (
        <>
          <p className="small" style={{ color: 'var(--orange)' }}>
            ⚠ Exception uniquement (invité sans téléphone). La règle : les invités commandent eux-mêmes via la borne — pas au comptoir.
          </p>
          <CocktailPicker cocktails={staff?.cocktails || []} onPick={setCk} />
        </>
      ) : (
        <>
          <div className="row between">
            <span className="muted">Quantité</span>
            <Stepper value={qty} onChange={setQty} min={1} max={9} />
          </div>
          <div className="field">
            <label>Prénom de l'invité (obligatoire)</label>
            <input
              className="input" list="guest-names" value={guestName} autoFocus
              onChange={e => setGuestName(e.target.value)} placeholder="Lucas, Léa, DJ Tonio…"
            />
            <datalist id="guest-names">
              {staff?.guests.map(g => <option key={g.id} value={g.name} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Note pour le bar (optionnel)</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Sans glace, peu sucré…" />
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn" onClick={() => setCk(null)}><ChevronLeft size={16} /> Changer</button>
            <button className="btn primary grow" onClick={submit}>Ajouter à la file <ChevronRight size={16} /></button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default function Orders() {
  useTick(30000)
  const { staff } = useApp()
  const [openNew, setOpenNew] = useState(false)
  const [qrOrder, setQrOrder] = useState(null)

  const byCol = useMemo(() => {
    const map = { pending: [], preparing: [], ready: [], served: [] }
    if (!staff) return map
    const live = staff.orders.filter(o => !o.archived)
    const byId = Object.fromEntries(live.map(o => [o.id, o]))
    // File d'attente dans l'ordre officiel (priorités 💎, puis arrivée).
    map.pending = (staff.queue?.order || []).map(id => byId[id]).filter(Boolean)
    for (const o of live) if (o.status !== 'pending') map[o.status]?.push(o)
    map.preparing.sort((a, b) => (a.startedAt || a.updatedAt) - (b.startedAt || b.updatedAt))
    map.ready.sort((a, b) => (a.readyAt || a.updatedAt) - (b.readyAt || b.updatedAt))
    map.served.sort((a, b) => (b.servedAt || 0) - (a.servedAt || 0))
    return map
  }, [staff])

  if (!staff) return null
  const eta = staff.queue?.eta || {}
  const barmen = staff.queue?.barmen || 1
  const claims = staff.orders.filter(o => o.donation?.status === 'claimed' && !o.priority && !o.archived).length

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Commandes</h2>
          <p className="small muted">
            Ordre d'arrivée strict — seules les commandes 💎 (tip validé) passent devant. Prépare les cartes en surbrillance.
            {claims > 0 && <b style={{ color: 'var(--blue)' }}> · {claims} don{claims > 1 ? 's' : ''} à vérifier</b>}
          </p>
        </div>
        <div className="grow" />
        {byCol.served.length > 0 && (
          <button className="btn sm ghost" onClick={() => call('POST', '/api/orders/clear-served')}>
            <Sparkles size={15} /> Nettoyer les servies
          </button>
        )}
        <button className="btn" onClick={() => setOpenNew(true)} title="Exception : invité sans téléphone"><Plus size={17} /> Commande manuelle</button>
      </div>

      <div className="kanban">
        {COLS.map(col => (
          <div key={col.key} className="kcol">
            <div className="kcol-head">
              <span className="dot" style={{ background: col.color, boxShadow: `0 0 10px ${col.color}` }} />
              {col.label}
              <span className="count">{byCol[col.key].length}</span>
            </div>
            <div className="kcol-cards">
              <AnimatePresence mode="popLayout">
                {byCol[col.key].map((o, i) => (
                  <OrderCard key={o.id} o={o} eta={eta[o.id]} nextUp={col.key === 'pending' && i < barmen} onQr={setQrOrder} />
                ))}
              </AnimatePresence>
              {!byCol[col.key].length && (
                <div className="empty" style={{ padding: '28px 10px' }}>
                  <span className="tiny faint">— vide —</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <NewOrder open={openNew} onClose={() => setOpenNew(false)} onCreated={setQrOrder} />
      <OrderQRModal order={qrOrder} onClose={() => setQrOrder(null)} />
    </>
  )
}

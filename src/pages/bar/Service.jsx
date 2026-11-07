import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, Users, Gauge, ShieldCheck, MonitorSmartphone, Gem, Trash2, Megaphone, Trophy, ExternalLink, Copy } from 'lucide-react'
import { useApp, call, toast } from '../../store.js'
import { Stepper, Switch, Field, QRCanvas, ConfirmBtn, cls, clock, etaLabel, serviceStatus, timeAgo, useTick } from '../../ui.jsx'

const eur = n => `${String(+(+n).toFixed(2)).replace('.', ',')} €`
const service = body => call('PATCH', '/api/settings/service', body)

function Section({ icon: Icon, title, sub, children }) {
  return (
    <div className="card pad col" style={{ gap: 14 }}>
      <div>
        <h3 style={{ fontSize: 16 }} className="row"><Icon size={17} /> {title}</h3>
        {sub && <p className="tiny muted" style={{ marginTop: 3 }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Line({ label, hint, children }) {
  return (
    <div className="row between wrap" style={{ gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div className="bold small">{label}</div>
        {hint && <div className="tiny muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

export default function Service() {
  useTick(5000)
  const { staff, pub } = useApp()
  const [msg, setMsg] = useState('')
  const [msgSec, setMsgSec] = useState(300)
  const [don, setDon] = useState({ name: '', amount: '', method: 'cash', anonymous: false })
  const [paypal, setPaypal] = useState(null)

  if (!staff) return null
  const s = staff.settings
  const q = staff.queue
  const wait = pub?.wait
  const st = serviceStatus(wait)
  const appUrl = staff.meta?.appUrl || location.href.split('#')[0]
  const screenUrl = `${appUrl}#/ecran`
  const kioskMsg = s.kioskMessage && (!s.kioskMessage.until || s.kioskMessage.until > Date.now()) ? s.kioskMessage : null
  const lb = staff.leaderboard

  const sendMsg = async () => {
    if (!msg.trim()) return
    const r = await call('POST', '/api/kiosk/push', { type: 'message', text: msg, seconds: msgSec })
    if (r) { toast('success', 'Message affiché', 'Visible en haut de la borne invités.'); setMsg('') }
  }

  const addDonation = async () => {
    const r = await call('POST', '/api/donations', { ...don, amount: +String(don.amount).replace(',', '.') || s.donationAmount })
    if (r) { toast('success', 'Merci pour eux 💎', `${r.name} · ${eur(r.amount)}`); setDon({ name: '', amount: '', method: 'cash', anonymous: false }) }
  }

  const copy = async u => { try { await navigator.clipboard.writeText(u); toast('success', 'Copié', u) } catch { toast('info', 'Lien', u) } }

  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Service</h2>
          <p className="small muted">Rythme du bar, file d'attente, borne invités et dons — tout se répercute en direct.</p>
        </div>
        <div className="grow" />
        <span className={cls('badge', st.tone)} style={{ height: 32 }}>{st.label}</span>
      </div>

      <div className="service-grid">
        <Section icon={Pause} title="Ouverture des commandes" sub="Pour souffler : les invités voient clairement la pause et l'heure de reprise.">
          <Line label="Commandes ouvertes" hint="Coupé = plus aucune nouvelle commande">
            <Switch checked={s.ordersOpen !== false} onChange={v => service({ ordersOpen: v })} />
          </Line>
          <div className="col" style={{ gap: 8 }}>
            <span className="bold small">Pause express</span>
            <div className="row wrap" style={{ gap: 8 }}>
              {[5, 10, 15, 30].map(m => (
                <button key={m} className="chip" onClick={() => service({ pauseMinutes: m })}>⏸ {m} min</button>
              ))}
              {wait?.paused && <button className="chip active" onClick={() => service({ pauseMinutes: 0 })}><Play size={14} /> Reprendre maintenant</button>}
            </div>
            {wait?.paused && <span className="tiny" style={{ color: 'var(--orange)' }}>En pause jusqu'à {clock(wait.pauseUntil)} — la file en cours continue d'avancer.</span>}
          </div>
        </Section>

        <Section icon={Gauge} title="Estimation live" sub="Calculée sur la file réelle, le nombre de barmans et votre rythme mesuré.">
          <div className="eta-live">
            <span className="tabular">{etaLabel(q.nextMinutes)}</span>
            <p className="tiny muted">pour une commande passée maintenant · prête vers {clock(Date.now() + q.nextMinutes * 60000)} · {q.queuedDrinks} boisson{q.queuedDrinks > 1 ? 's' : ''} en cours</p>
          </div>
          <Line label={<span className="row" style={{ gap: 6 }}><Users size={14} /> Barmans en service</span>} hint="Le travail est réparti entre vous">
            <Stepper value={s.barmen} onChange={v => service({ barmen: v })} min={1} max={10} />
          </Line>
          <Line label="Rythme de base" hint={s.learnedPace ? `Mesuré ce soir : ${String(s.learnedPace).replace('.', ',')} min / boisson (${s.learnedSamples} mesures) → utilisé ${String(q.pace).replace('.', ',')} min` : 'Minutes par boisson pour un barman — s\'affine tout seul avec les vraies durées'}>
            <Stepper value={s.paceMinutes} onChange={v => service({ paceMinutes: v })} step={0.5} min={0.5} max={15} suffix="min" />
          </Line>
          <div className="col" style={{ gap: 8 }}>
            <span className="bold small">Marge de confort <span className="tiny muted">(ajoutée aux temps annoncés)</span></span>
            <div className="row wrap" style={{ gap: 8 }}>
              {[0, 2, 5, 10].map(m => (
                <button key={m} className={cls('chip', (s.waitMargin || 0) === m && 'active')} onClick={() => service({ waitMargin: m })}>
                  {m ? `+${m} min` : 'Aucune'}
                </button>
              ))}
            </div>
          </div>
          {s.learnedSamples > 0 && (
            <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => service({ resetLearning: true })}>Réinitialiser le rythme mesuré</button>
          )}
        </Section>

        <Section icon={ShieldCheck} title="Garde-fous" sub="Pour que la file reste humaine.">
          <Line label="File maximale" hint="Au-delà, les commandes attendent qu'une place se libère">
            <Stepper value={s.maxQueue} onChange={v => service({ maxQueue: v })} min={1} max={200} suffix="boissons" />
          </Line>
          <Line label="Commandes en cours par téléphone" hint="1 = une à la fois">
            <Stepper value={s.maxActivePerDevice} onChange={v => service({ maxActivePerDevice: v })} min={1} max={5} />
          </Line>
          <Line label="Boissons par commande" hint="2 = une pour soi + une pour un·e ami·e">
            <Stepper value={s.maxQty} onChange={v => service({ maxQty: v })} min={1} max={5} />
          </Line>
          <Line label="Scan de la borne obligatoire" hint="Empêche de commander hors de la soirée (le lien est public)">
            <Switch checked={s.requirePass !== false} onChange={v => service({ requirePass: v })} />
          </Line>
        </Section>

        <Section icon={MonitorSmartphone} title="Borne invités" sub={staff.meta?.kiosks ? `${staff.meta.kiosks} borne${staff.meta.kiosks > 1 ? 's' : ''} connectée${staff.meta.kiosks > 1 ? 's' : ''} ✅` : 'Aucune borne connectée — ouvre « Mode borne » sur l\'iPad invités'}>
          {kioskMsg && (
            <div className="row card" style={{ padding: '10px 12px', borderRadius: 12, gap: 10 }}>
              <Megaphone size={16} style={{ color: 'var(--orange)' }} />
              <span className="grow small">« {kioskMsg.text} »{kioskMsg.until ? <span className="tiny muted"> · jusqu'à {clock(kioskMsg.until)}</span> : ''}</span>
              <button className="btn ghost sm" onClick={() => call('POST', '/api/kiosk/push', { type: 'clear' })}>Retirer</button>
            </div>
          )}
          <Field label="Message sur la borne">
            <input className="input" value={msg} maxLength={140} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
              placeholder="Le 2-0 est dispo 🏆 · Pause dans 5 min · Dernière tournée !" />
          </Field>
          <div className="row wrap" style={{ gap: 8 }}>
            {[[60, '1 min'], [300, '5 min'], [900, '15 min'], [0, 'Jusqu\'à retrait']].map(([v, l]) => (
              <button key={v} className={cls('chip', msgSec === v && 'active')} onClick={() => setMsgSec(v)}>{l}</button>
            ))}
            <div className="grow" />
            <button className="btn primary" disabled={!msg.trim()} onClick={sendMsg}><Megaphone size={15} /> Afficher</button>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn" onClick={() => call('POST', '/api/kiosk/push', { type: 'leaderboard', seconds: 20 })}><Trophy size={15} /> Classement sur la borne (20 s)</button>
            <Link to="/borne" className="btn ghost"><MonitorSmartphone size={15} /> Passer CET appareil en mode borne</Link>
          </div>
          <p className="tiny faint">Astuce : les QR des commandes manuelles s'envoient sur la borne depuis leur carte (icône QR → « Afficher sur la borne »).</p>
        </Section>

        <Section icon={Gem} title="Dons & priorité" sub={`${eur(s.donationAmount)} = commande prioritaire. Validez seulement après avoir vu la pièce ou le paiement PayPal.`}>
          <div className="eta-live">
            <span className="tabular">{eur(lb.total)}</span>
            <p className="tiny muted">{lb.count} don{lb.count > 1 ? 's' : ''} · {lb.donors} donateur{lb.donors > 1 ? 's' : ''}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" placeholder="Prénom" value={don.name} onChange={e => setDon({ ...don, name: e.target.value })} />
            <input className="input" style={{ width: 90 }} inputMode="decimal" placeholder={eur(s.donationAmount)} value={don.amount} onChange={e => setDon({ ...don, amount: e.target.value })} />
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className={cls('chip', don.method === 'cash' && 'active')} onClick={() => setDon({ ...don, method: 'cash' })}>🪙 Boîte à tips</button>
            <button className={cls('chip', don.method === 'paypal' && 'active')} onClick={() => setDon({ ...don, method: 'paypal' })}>PayPal</button>
            <label className="row tiny muted" style={{ gap: 6 }}><Switch checked={don.anonymous} onChange={v => setDon({ ...don, anonymous: v })} /> Anonyme</label>
            <div className="grow" />
            <button className="btn primary" onClick={addDonation}>Ajouter un tip</button>
          </div>
          {staff.donations.length > 0 && (
            <div className="col" style={{ gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {[...staff.donations].reverse().map(d => (
                <div key={d.id} className="row card" style={{ padding: '8px 12px', borderRadius: 12 }}>
                  <span className="grow small">{d.anonymous ? '🕶️ ' : ''}<b>{d.name}</b> · {eur(d.amount)} {d.method === 'paypal' ? 'PayPal' : '🪙'}{d.orderId ? ' · 💎' : ''}</span>
                  <span className="tiny faint">{timeAgo(d.at)}{d.by ? ` · ${d.by}` : ''}</span>
                  <ConfirmBtn className="btn ghost icon sm" onConfirm={() => call('DELETE', `/api/donations/${d.id}`)} confirmLabel="Sûr ?"><Trash2 size={14} /></ConfirmBtn>
                </div>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <Field label="Adresse PayPal affichée aux invités">
              <input className="input" value={paypal ?? s.paypalEmail} onChange={e => setPaypal(e.target.value)}
                onBlur={() => { if (paypal !== null && paypal !== s.paypalEmail) service({ paypalEmail: paypal }); setPaypal(null) }} />
            </Field>
            <Field label="Montant">
              <Stepper value={s.donationAmount} onChange={v => service({ donationAmount: v })} step={0.5} min={0.5} max={100} suffix="€" />
            </Field>
          </div>
          <div className="row wrap" style={{ gap: 14, alignItems: 'center' }}>
            <QRCanvas url={screenUrl} size={110} />
            <div className="col" style={{ gap: 6, minWidth: 0 }}>
              <b className="small">Écran plein écran des donateurs</b>
              <code className="tiny faint ellipsis" style={{ maxWidth: 260 }}>{screenUrl}</code>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn sm" onClick={() => copy(screenUrl)}><Copy size={13} /> Copier</button>
                <a className="btn sm ghost" href={screenUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Ouvrir</a>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}

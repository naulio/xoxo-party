// File d'attente & estimation live.
//
// Ordre de passage strict : premier arrivé, premier servi. Seule exception :
// les commandes « prioritaires » (don de 2 € validé par un barman) passent
// devant, entre elles dans l'ordre de validation du don.
//
// Estimation : chaque boisson coûte `pace` minutes à UN barman. Ce rythme part
// d'une valeur de réglage puis apprend du terrain (durée réelle entre
// « En préparation » et « Prête »). Le travail en file est réparti sur les
// barmans en service, plus une marge de confort réglable.

export const ACTIVE = ['pending', 'preparing']
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export const queueSort = (a, b) => {
  const pa = a.priority ? 0 : 1
  const pb = b.priority ? 0 : 1
  if (pa !== pb) return pa - pb
  if (a.priority && b.priority) return (a.priorityAt || a.createdAt) - (b.priorityAt || b.createdAt)
  return a.createdAt - b.createdAt
}

// Minutes par boisson pour un barman : réglage de base pondéré par l'appris.
export function effectivePace(s) {
  const base = clamp(+s.paceMinutes || 2, 0.5, 15)
  if (!s.learnedPace) return base
  const w = Math.min((s.learnedSamples || 0) / 8, 0.75)
  return +(base * (1 - w) + s.learnedPace * w).toFixed(2)
}

export function learnFromOrder(s, o, now = Date.now()) {
  if (!o.startedAt) return
  const sample = (now - o.startedAt) / 60000 / Math.max(1, o.qty)
  if (sample < 0.25 || sample > 15) return
  s.learnedPace = s.learnedPace ? +(s.learnedPace * 0.75 + sample * 0.25).toFixed(2) : +sample.toFixed(2)
  s.learnedSamples = (s.learnedSamples || 0) + 1
}

export function computeQueue(state, now = Date.now()) {
  const s = state.settings
  const pace = effectivePace(s)
  const barmen = clamp(Math.round(+s.barmen || 1), 1, 10)
  const margin = clamp(+s.waitMargin || 0, 0, 60)
  const live = state.orders.filter(o => !o.archived)
  const preparing = live
    .filter(o => o.status === 'preparing')
    .sort((a, b) => (a.startedAt || a.updatedAt) - (b.startedAt || b.updatedAt))
  const pending = live.filter(o => o.status === 'pending').sort(queueSort)

  const eta = {}
  let work = 0 // minutes-barman restantes avant la commande considérée
  for (const o of preparing) {
    const elapsed = (now - (o.startedAt || o.updatedAt)) / 60000
    const rem = Math.max(0.5, pace * o.qty - elapsed)
    eta[o.id] = { minutes: Math.max(1, Math.ceil(rem)), position: 0, at: Math.round(now + rem * 60000) }
    work += rem
  }
  pending.forEach((o, i) => {
    work += pace * o.qty
    const m = work / barmen + margin
    eta[o.id] = { minutes: Math.max(1, Math.ceil(m)), position: i + 1, at: Math.round(now + m * 60000) }
  })

  const queuedDrinks = [...pending, ...preparing].reduce((t, o) => t + (o.qty || 1), 0)
  const nextMinutes = Math.max(1, Math.ceil((work + pace) / barmen + margin))
  const paused = !!(s.pauseUntil && s.pauseUntil > now)
  const closed = s.ordersOpen === false
  const full = queuedDrinks >= (s.maxQueue || 20)
  return {
    pace, barmen, margin, eta,
    pendingCount: pending.length,
    preparingCount: preparing.length,
    readyCount: live.filter(o => o.status === 'ready').length,
    queuedDrinks,
    nextMinutes,
    open: !closed && !paused && !full,
    closed, paused, full,
    pauseUntil: paused ? s.pauseUntil : null,
    order: pending.map(o => o.id),
  }
}

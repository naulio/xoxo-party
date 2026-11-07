import { computeQueue } from './queue.js'

// Calculs dérivés : disponibilité des cocktails à partir du stock,
// payloads publics (invités), staff (barmans / admins) et suivi de commande.

export function enrichCocktails(state) {
  const ingById = Object.fromEntries(state.ingredients.map(i => [i.id, i]))
  return state.cocktails.map(c => {
    const missing = c.ingredients
      .filter(l => { const ing = ingById[l.ingredientId]; return !ing || ing.stock < l.qty })
      .map(l => ingById[l.ingredientId]?.name || 'Ingrédient supprimé')
    const maxCount = c.ingredients.length
      ? Math.min(...c.ingredients.map(l => {
          const ing = ingById[l.ingredientId]
          return ing && l.qty > 0 ? Math.floor(ing.stock / l.qty) : 0
        }))
      : 99
    const makeable = missing.length === 0
    return { ...c, missing, maxCount, makeable, available: makeable && c.visible && !c.archived }
  })
}

const round2 = n => Math.round(n * 100) / 100

// Clé stable et opaque pour l'affichage (évite d'exposer les id de fiches).
const opaque = s => {
  let h = 5381
  for (const ch of String(s)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0
  return 'd' + h.toString(36)
}

// Tableau d'honneur des donateurs : cumul par invité (fiche) ou par prénom.
export function leaderboard(state) {
  const groups = new Map()
  const list = state.donations || []
  for (const d of list) {
    const key = d.guestId || 'n:' + String(d.name || '').trim().toLowerCase()
    const g = groups.get(key) || { key: opaque(key), name: d.name, amount: 0, count: 0, anonymous: true, first: d.at }
    g.amount += +d.amount || 0
    g.count++
    g.first = Math.min(g.first, d.at)
    if (!d.anonymous) { g.anonymous = false; g.name = d.name }
    groups.set(key, g)
  }
  const top = [...groups.values()]
    .sort((a, b) => b.amount - a.amount || a.first - b.first)
    .slice(0, 10)
    .map(g => ({ key: g.key, name: g.anonymous ? 'Anonyme' : g.name, anonymous: g.anonymous, amount: round2(g.amount), count: g.count }))
  const lastD = list.length ? list.reduce((a, b) => (b.at > a.at ? b : a)) : null
  return {
    total: round2(list.reduce((t, d) => t + (+d.amount || 0), 0)),
    count: list.length,
    donors: groups.size,
    top,
    last: lastD ? { name: lastD.anonymous ? 'Anonyme' : lastD.name, amount: round2(lastD.amount), at: lastD.at } : null,
  }
}

export function waitInfo(q) {
  return {
    minutes: q.nextMinutes,
    open: q.open, closed: q.closed, paused: q.paused, full: q.full, pauseUntil: q.pauseUntil,
    queue: q.pendingCount + q.preparingCount,
    drinks: q.queuedDrinks,
    barmen: q.barmen,
  }
}

export function publicState(state) {
  const ingById = Object.fromEntries(state.ingredients.map(i => [i.id, i]))
  const s = state.settings
  const pub = c => ({
    id: c.id, name: c.name, emoji: c.emoji, hue: c.hue, imageUrl: c.imageUrl,
    description: c.description, category: c.category, points: c.points,
    ingredients: c.ingredients.map(l => ingById[l.ingredientId]?.name).filter(Boolean),
  })
  const enriched = enrichCocktails(state)
  const cocktails = enriched.filter(c => c.available && !c.secret).map(pub)
  // Cocktails secrets : jamais dans la grille publique, révélés uniquement
  // par le bouton « Futur champion » (disponibilité affichée honnêtement).
  const secrets = enriched.filter(c => c.secret && c.visible && !c.archived).map(c => ({ ...pub(c), available: c.makeable }))
  const q = computeQueue(state)
  return {
    partyName: s.partyName,
    waitTime: q.nextMinutes,
    wait: waitInfo(q),
    rules: {
      donationAmount: s.donationAmount ?? 2,
      paypalEmail: s.paypalEmail || '',
      maxQty: s.maxQty || 2,
      maxActive: s.maxActivePerDevice || 1,
      requirePass: s.requirePass !== false,
    },
    leaderboard: leaderboard(state),
    categories: s.categories.filter(cat => cocktails.some(c => c.category === cat)),
    cocktails,
    secrets,
  }
}

export const guestTotal = g => g.drinks.reduce((s, d) => s + d.points, 0) + (g.adjust || 0)

export function staffState(state, meta) {
  return {
    ingredients: state.ingredients,
    cocktails: enrichCocktails(state),
    orders: state.orders,
    guests: state.guests.map(g => ({ ...g, total: guestTotal(g) })),
    donations: state.donations || [],
    leaderboard: leaderboard(state),
    queue: computeQueue(state),
    settings: { ...state.settings, vapid: undefined },
    users: state.users.map(({ pinHash, ...u }) => u),
    meta,
  }
}

// Payload public du suivi de commande (page #/c/:token).
export function trackPayload(state, o, q = computeQueue(state)) {
  const c = state.cocktails.find(x => x.id === o.cocktailId)
  const s = state.settings
  const eta = q.eta[o.id] || null
  return {
    token: o.token, name: o.name, emoji: o.emoji, qty: o.qty, status: o.status,
    guestName: o.guestName || null,
    hue: c?.hue ?? 300, imageUrl: c?.imageUrl || null,
    createdAt: o.createdAt, servedAt: o.servedAt, readyAt: o.readyAt || null,
    eta,
    ahead: eta && eta.position ? eta.position - 1 : null,
    priority: !!o.priority,
    donation: o.donation ? { status: o.donation.status, method: o.donation.method } : null,
    donationAmount: s.donationAmount ?? 2,
    paypalEmail: s.paypalEmail || '',
    waitTime: q.nextMinutes,
    partyName: s.partyName,
    vapidKey: s.vapid?.publicKey || null,
  }
}

// Instantané avant mutation → événements de notification après mutation.
export function snapshotForDiff(state) {
  return {
    ingredients: new Map(state.ingredients.map(i => [i.id, { stock: i.stock, low: i.low }])),
    availability: new Map(enrichCocktails(state).map(c => [c.id, c.available])),
  }
}

export function diffEvents(before, state) {
  const events = []
  for (const i of state.ingredients) {
    const prev = before.ingredients.get(i.id)
    if (!prev) continue
    if (prev.stock > 0 && i.stock <= 0) {
      events.push({ level: 'error', title: 'Rupture de stock', msg: `${i.emoji} ${i.name} est épuisé` })
    } else if (prev.stock > i.low && i.stock <= i.low && i.stock > 0) {
      events.push({ level: 'warn', title: 'Stock faible', msg: `${i.emoji} ${i.name} — ${i.stock} ${i.unit} restants` })
    }
  }
  for (const c of enrichCocktails(state)) {
    const prev = before.availability.get(c.id)
    if (prev === undefined || c.archived) continue
    if (prev && !c.available) {
      events.push({ level: 'warn', title: 'Cocktail indisponible', msg: `${c.emoji} ${c.name} n'est plus proposé aux invités` })
    } else if (!prev && c.available) {
      events.push({ level: 'success', title: 'Cocktail de retour', msg: `${c.emoji} ${c.name} est de nouveau disponible` })
    }
  }
  return events
}

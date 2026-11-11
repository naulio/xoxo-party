import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './db.js'

// Liste de courses calculée à partir du bar :
//  1. boissons attendues = invités × boissons par invité ;
//  2. réparties entre les cocktails actifs selon les ventes réelles des
//     soirées précédentes (archives) + un a priori par catégorie ;
//  3. besoins par ingrédient (+ marge), arrondis aux formats vendus en
//     magasin avec la combinaison la moins chère ;
//  4. prix estimés : supermarché, marques distributeur / entrée de gamme,
//     hors promotions (relevés automne 2026). Indicatifs.

export const SHOPPING_DEFAULTS = { guests: 50, drinksPerGuest: 3, margin: 10, deductStock: false }

const AISLES = [
  { id: 'fruits', label: 'Fruits & légumes' },
  { id: 'boissons', label: 'Boissons sans alcool' },
  { id: 'sirops', label: 'Sirops' },
  { id: 'alcools', label: 'Alcools & spiritueux' },
  { id: 'epicerie', label: 'Épicerie' },
  { id: 'bazar', label: 'Bazar & jetable' },
  { id: 'surgeles', label: 'Surgelés — à prendre en dernier' },
]

const ICE_KG_PER_PORTION = 0.15
const F = (label, size, price) => ({ label, size, price })

// Catalogue : formats réellement vendus (taille dans l'unité de l'ingrédient).
const CATALOG = [
  { id: 'vodka', unit: 'cl', test: n => /\bvodka\b/.test(n), aisle: 'alcools', name: 'Vodka', note: 'entrée de gamme', formats: [F('70 cl', 70, 10.9), F('1 L', 100, 13.9)] },
  { id: 'rhum', unit: 'cl', test: n => /\brhum\b|\brum\b/.test(n), aisle: 'alcools', name: 'Rhum blanc', note: 'type Old Nick / MDD', formats: [F('70 cl', 70, 9.9), F('1 L', 100, 12.9)] },
  { id: 'tequila', unit: 'cl', test: n => /tequila/.test(n), aisle: 'alcools', name: 'Tequila', note: 'entrée de gamme', formats: [F('70 cl', 70, 15.9)] },
  { id: 'gin', unit: 'cl', test: n => /(^|\s)gin(\s|$)/.test(n), aisle: 'alcools', name: 'Gin', note: 'marque distributeur', formats: [F('70 cl', 70, 11.9), F('1 L', 100, 15.9)] },
  { id: 'whisky', unit: 'cl', test: n => /whisk/.test(n), aisle: 'alcools', name: 'Whisky', note: 'blend entrée de gamme', formats: [F('70 cl', 70, 13.9), F('1 L', 100, 18.9)] },
  { id: 'triplesec', unit: 'cl', test: n => /triple/.test(n), aisle: 'alcools', name: 'Triple sec', note: 'marque distributeur', formats: [F('70 cl', 70, 9.9)] },
  { id: 'peche', unit: 'cl', test: n => /liqueur|creme de peche/.test(n) && /peche/.test(n), aisle: 'alcools', name: 'Crème / liqueur de pêche', note: 'marque distributeur', formats: [F('70 cl', 70, 7.9)] },
  { id: 'curacao', unit: 'cl', test: n => /curacao/.test(n), aisle: 'alcools', name: 'Curaçao bleu', note: 'marque distributeur', formats: [F('70 cl', 70, 8.9)] },

  { id: 'icetea', unit: 'cl', test: n => /ice ?tea|the glace/.test(n), aisle: 'boissons', name: 'Thé glacé pêche', note: 'marque distributeur', formats: [F('1,5 L', 150, 0.99)] },
  { id: 'oasis', unit: 'cl', test: n => /oasis/.test(n), aisle: 'boissons', name: 'Oasis Tropical', note: '', formats: [F('2 L', 200, 2.39)] },
  { id: 'tropical', unit: 'cl', test: n => /tropical|multifruit/.test(n), aisle: 'boissons', name: 'Jus multifruits tropical', note: 'marque distributeur', formats: [F('1 L', 100, 1.49), F('1,5 L', 150, 1.99)] },
  { id: 'orange', unit: 'cl', test: n => /orange/.test(n), aisle: 'boissons', name: "Jus d'orange", note: 'à base de concentré, MDD', formats: [F('1 L', 100, 1.29), F('1,5 L', 150, 1.85)] },
  { id: 'cranberry', unit: 'cl', test: n => /cranberry|canneberge/.test(n), aisle: 'boissons', name: 'Cocktail cranberry', note: 'marque distributeur', formats: [F('1 L', 100, 2.29)] },
  { id: 'ananas', unit: 'cl', test: n => /ananas/.test(n), aisle: 'boissons', name: "Jus d'ananas", note: 'marque distributeur', formats: [F('1 L', 100, 1.59)] },
  { id: 'cola', unit: 'cl', test: n => /coca|cola/.test(n), aisle: 'boissons', name: 'Cola', note: 'marque distributeur (Coca-Cola ≈ 2,10 € la 1,5 L)', formats: [F('1,5 L', 150, 0.89)] },
  { id: 'limonade', unit: 'cl', test: n => /limonade/.test(n), aisle: 'boissons', name: 'Limonade', note: 'marque distributeur', formats: [F('1,5 L', 150, 0.69)] },
  { id: 'tonic', unit: 'cl', test: n => /tonic|schweppes/.test(n), aisle: 'boissons', name: 'Tonic', note: 'marque distributeur', formats: [F('1 L', 100, 0.99)] },
  { id: 'ginger', unit: 'cl', test: n => /ginger/.test(n), aisle: 'boissons', name: 'Ginger beer', note: 'pack 4 × 33 cl', formats: [F('pack 4 × 33 cl', 132, 3.99)] },
  { id: 'gazeuse', unit: 'cl', test: n => /gazeuse|petillante/.test(n), aisle: 'boissons', name: 'Eau gazeuse', note: '', formats: [F('1,25 L', 125, 0.45)] },
  { id: 'jusCitron', unit: 'cl', test: n => /jus/.test(n) && /citron/.test(n), aisle: 'boissons', name: 'Jus de citron vert', note: '100 % jus', formats: [F('25 cl', 25, 2.19)] },

  { id: 'citronVert', unit: 'pièce', test: n => /citron/.test(n), aisle: 'fruits', name: 'Citrons verts', note: '', formats: [F('à la pièce', 1, 0.35), F('filet de 6', 6, 1.79)] },
  { id: 'menthe', unit: 'brin', test: n => /menthe/.test(n), aisle: 'fruits', name: 'Menthe fraîche', note: '≈ 15 brins la botte', formats: [F('botte', 15, 1.49)] },

  { id: 'sucre', unit: 'cl', test: n => /sucre|canne/.test(n), aisle: 'sirops', name: 'Sirop de sucre de canne', note: 'marque distributeur', formats: [F('70 cl', 70, 2.69)] },
  { id: 'grenadine', unit: 'cl', test: n => /grenadine/.test(n), aisle: 'sirops', name: 'Sirop de grenadine', note: 'marque distributeur', formats: [F('75 cl', 75, 1.59)] },
  { id: 'bubblegum', unit: 'cl', test: n => /bubble|chewing/.test(n), aisle: 'sirops', name: 'Sirop bubble-gum', note: 'magasin spécialisé ou en ligne (type Monin) — dure plusieurs soirées', formats: [F('70 cl', 70, 8.9)] },

  { id: 'piquant', unit: 'cl', test: n => /tabasco|piment|piquant/.test(n), aisle: 'epicerie', name: 'Sauce piquante (type Tabasco)', note: 'marque distributeur', formats: [F('60 ml', 6, 1.99)] },
  { id: 'coco', unit: 'cl', test: n => /coco/.test(n), aisle: 'epicerie', name: 'Lait de coco', note: 'marque distributeur', formats: [F('boîte 40 cl', 40, 1.39)] },

  { id: 'glace', unit: 'portion', test: n => /glacon|glace/.test(n), aisle: 'surgeles', name: 'Glaçons', note: 'sac Eco+ / MDD', formats: [F('sac 2 kg', 2 / ICE_KG_PER_PORTION, 1.99)] },
]

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Combinaison de formats la moins chère couvrant le besoin (au plus 3 formats).
function cheapest(need, formats) {
  if (need <= 0) return []
  const fs_ = formats.slice(0, 3)
  const maxN = f => Math.ceil(need / f.size) + 1
  let best = null
  const rec = (i, counts, covered, cost) => {
    if (best && cost >= best.cost) return
    if (i === fs_.length) {
      if (covered + 1e-9 >= need) best = { counts: [...counts], cost }
      return
    }
    for (let n = 0; n <= maxN(fs_[i]); n++) {
      counts[i] = n
      rec(i + 1, counts, covered + n * fs_[i].size, cost + n * fs_[i].price)
    }
  }
  rec(0, [], 0, 0)
  return best ? fs_.map((f, i) => ({ ...f, count: best.counts[i] })).filter(f => f.count > 0) : []
}

// Ventes réelles des soirées passées (archives) + de la soirée en cours.
let archiveCache = null
function salesHistory(state) {
  if (!archiveCache) {
    archiveCache = {}
    const dir = path.join(DATA_DIR, 'archives')
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
        for (const o of d.orders || []) {
          if (o.status !== 'served') continue
          const k = norm(o.name)
          archiveCache[k] = (archiveCache[k] || 0) + (o.qty || 1)
        }
      }
    } catch { /* pas d'archives */ }
  }
  const out = { ...archiveCache }
  for (const o of state.orders) {
    if (o.status !== 'served') continue
    const k = norm(o.name)
    out[k] = (out[k] || 0) + (o.qty || 1)
  }
  return out
}

const PRIOR = { softs: 3, 'sans alcool': 2, shots: 1.5, secrets: 0.5 }
const round2 = n => Math.round(n * 100) / 100
const fmtNeed = (v, unit) => {
  if (unit === 'cl') return v >= 100 ? `${String(round2(v / 100)).replace('.', ',')} L` : `${Math.ceil(v)} cl`
  if (unit === 'portion') return `${String(round2(v * ICE_KG_PER_PORTION)).replace('.', ',')} kg`
  return `${Math.ceil(v)} ${unit}${Math.ceil(v) > 1 && !unit.endsWith('s') ? 's' : ''}`
}

function computeLines(state, settings) {
  const st = { ...SHOPPING_DEFAULTS, ...settings }
  const guests = Math.max(1, +st.guests || 1)
  const drinks = guests * Math.max(0, +st.drinksPerGuest || 0)
  const margin = 1 + Math.max(0, +st.margin || 0) / 100
  const history = salesHistory(state)

  const active = state.cocktails.filter(c => !c.archived && c.visible !== false && c.ingredients.length)
  const weights = active.map(c => (history[norm(c.name)] || 0) + (PRIOR[norm(c.category)] ?? 2))
  const sumW = weights.reduce((a, b) => a + b, 0) || 1
  const counts = active.map((c, i) => ({ c, n: (drinks * weights[i]) / sumW }))

  // Besoins par ingrédient, puis regroupés par produit du catalogue.
  const ingById = Object.fromEntries(state.ingredients.map(i => [i.id, i]))
  const needs = new Map() // productKey -> { product, need, unit, usedBy:Set }
  for (const { c, n } of counts) {
    for (const l of c.ingredients) {
      const ing = ingById[l.ingredientId]
      if (!ing) continue
      const nn = norm(ing.name)
      const product = CATALOG.find(p => p.unit === ing.unit && p.test(nn))
      const key = product ? product.id : 'ing:' + ing.id
      const cur = needs.get(key) || {
        product: product || {
          id: key, unit: ing.unit, aisle: ing.unit === 'cl' ? 'boissons' : 'epicerie', name: ing.name, note: 'prix à vérifier',
          formats: ing.unit === 'cl' ? [F('1 L', 100, 3)] : [F('à l\'unité', 1, 0.5)],
        },
        need: 0, unit: ing.unit, usedBy: new Set(), stock: 0, ings: new Set(),
      }
      cur.need += n * l.qty * margin
      cur.usedBy.add(c.name)
      if (!cur.ings.has(ing.id)) { cur.ings.add(ing.id); cur.stock += +ing.stock || 0 }
      needs.set(key, cur)
    }
  }

  const lines = []
  for (const [key, x] of needs) {
    const need = Math.max(0, x.need - (st.deductStock ? x.stock : 0))
    const picks = cheapest(need, x.product.formats)
    const used = [...x.usedBy]
    for (const f of x.product.formats) {
      const pick = picks.find(p => p.size === f.size)
      lines.push({
        key: `${key}@${f.label}`, product: key, aisle: x.product.aisle, name: x.product.name, format: f.label,
        note: x.product.note, price: f.price, suggested: pick ? pick.count : 0,
        need: fmtNeed(x.need, x.unit), needLeft: st.deductStock && x.stock ? fmtNeed(need, x.unit) : null,
        usedBy: used.slice(0, 4).join(', ') + (used.length > 4 ? '…' : ''),
      })
    }
  }

  // Essentiels de soirée (hors recettes) — modifiables / supprimables.
  const shots = counts.filter(x => norm(x.c.category) === 'shots').reduce((a, x) => a + x.n, 0)
  const extra = (key, aisle, name, format, price, suggested, note) =>
    lines.push({ key: `extra:${key}`, product: `extra:${key}`, aisle, name, format, note, price, suggested, need: null, usedBy: null, extra: true })
  extra('eau', 'boissons', 'Eau plate', 'pack 6 × 1,5 L', 1.89, Math.ceil((guests * 0.4) / 9), '≈ 0,4 L par invité — indispensable')
  extra('gobelets', 'bazar', 'Gobelets carton 25 cl', 'paquet de 50', 2.99, Math.ceil((guests * 2) / 50), '≈ 2 par invité')
  if (shots > 0) extra('shots', 'bazar', 'Gobelets à shot', 'paquet de 50', 2.49, Math.ceil((shots * margin) / 50), '')
  extra('serviettes', 'bazar', 'Serviettes en papier', 'paquet de 100', 1.29, 1, '')
  extra('poubelle', 'bazar', 'Sacs poubelle 50 L', 'rouleau de 20', 2.49, 1, '')
  extra('pailles', 'bazar', 'Pailles papier', 'paquet de 100', 1.99, 0, 'optionnel')

  return { lines, drinks, guests, plan: counts.map(x => ({ name: x.c.name, emoji: x.c.emoji, n: round2(x.n) })) }
}

const totalOf = (lines, overrides) => round2(lines.reduce((t, l) => t + (overrides[l.key] ?? l.suggested) * l.price, 0))

export function computeShopping(state) {
  const sh = state.shopping
  const settings = { ...SHOPPING_DEFAULTS, ...sh.settings }
  const { lines, drinks, guests, plan } = computeLines(state, settings)
  const order = Object.fromEntries(AISLES.map((a, i) => [a.id, i]))
  const items = lines
    .map(l => {
      const qty = sh.overrides[l.key] ?? l.suggested
      return { ...l, qty, overridden: sh.overrides[l.key] !== undefined, checked: !!sh.checked[l.key], total: round2(qty * l.price) }
    })
    // On n'affiche que ce qui est à acheter (ou modifié à la main / optionnel).
    .filter(l => l.qty > 0 || l.overridden || l.extra)
    .sort((a, b) => order[a.aisle] - order[b.aisle] || a.name.localeCompare(b.name) || b.price - a.price)

  const total = round2(items.reduce((t, l) => t + l.total, 0))
  const remaining = round2(items.filter(l => !l.checked).reduce((t, l) => t + l.total, 0))
  const alcohol = round2(items.filter(l => l.aisle === 'alcools').reduce((t, l) => t + l.total, 0))

  // Pistes d'économie chiffrées (calculées, pas devinées).
  const tips = []
  if (settings.drinksPerGuest > 1) {
    const alt = computeLines(state, { ...settings, drinksPerGuest: settings.drinksPerGuest - 0.5 }).lines
    tips.push({ label: `${String(settings.drinksPerGuest - 0.5).replace('.', ',')} boissons par invité au lieu de ${String(settings.drinksPerGuest).replace('.', ',')}`, saving: round2(total - totalOf(alt, sh.overrides)) })
  }
  if (settings.margin > 0) {
    const alt = computeLines(state, { ...settings, margin: 0 }).lines
    tips.push({ label: 'Sans marge de sécurité', saving: round2(total - totalOf(alt, sh.overrides)) })
  }

  // Cocktails qui obligent à acheter des bouteilles pour très peu de verres :
  // économie réelle si on les retire de la carte (les verres se reportent sur
  // les autres cocktails). Indicatif — la décision reste à l'organisateur.
  const costly = []
  for (const c of state.cocktails.filter(x => !x.archived && x.visible !== false && x.ingredients.length)) {
    const alt = computeLines({ ...state, cocktails: state.cocktails.filter(x => x.id !== c.id) }, settings).lines
    const saving = round2(total - totalOf(alt, sh.overrides))
    if (saving >= 6) costly.push({ name: c.name, emoji: c.emoji, saving, glasses: Math.round(plan.find(p => p.name === c.name)?.n || 0) })
  }
  costly.sort((a, b) => b.saving - a.saving)

  return {
    settings, aisles: AISLES, items, plan, drinks, guests, costly: costly.slice(0, 3),
    totals: { total, remaining, bought: round2(total - remaining), alcohol, perGuest: round2(total / guests), count: items.filter(l => l.qty > 0).length, checked: items.filter(l => l.checked && l.qty > 0).length },
    tips: tips.filter(t => t.saving > 0.5),
    pricesNote: 'Prix estimés en supermarché (marques distributeur / entrée de gamme, hors promos, automne 2026) — indicatifs.',
  }
}

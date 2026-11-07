// Adresse du serveur.
// - Servi par le PC (Wi-Fi local ou tunnel) : même origine, rien à résoudre.
// - Servi par GitHub Pages (lien fixe) : le serveur publie son adresse de
//   tunnel du moment dans ./api.json ; on la lit puis on vérifie qu'elle répond.

export const IS_PAGES = import.meta.env.VITE_PAGES === '1'
const LS_API = 'xoxo_api'

let base = ''
export const apiBase = () => base
export const apiUrl = p => base + p

// Les photos de cocktails sont servies par le serveur (/uploads/…).
export const assetUrl = u => (typeof u === 'string' && u.startsWith('/') ? base + u : u)

export function fixAssets(x) {
  if (!base || !x || typeof x !== 'object') return x
  if (Array.isArray(x)) return x.map(fixAssets)
  const out = {}
  for (const [k, v] of Object.entries(x)) {
    out[k] = k === 'imageUrl' ? assetUrl(v) : (v && typeof v === 'object' ? fixAssets(v) : v)
  }
  return out
}

function withTimeout(ms) {
  const ctl = new AbortController()
  setTimeout(() => ctl.abort(), ms)
  return ctl.signal
}

async function probe(b) {
  try {
    const r = await fetch(b + '/api/ping', { signal: withTimeout(6000), cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

async function readPointer() {
  try {
    const r = await fetch('api.json?t=' + Date.now(), { cache: 'no-store', signal: withTimeout(8000) })
    if (!r.ok) return null
    const j = await r.json()
    return typeof j.api === 'string' ? j.api.replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

// Renvoie l'adresse joignable, ou null si le bar est hors ligne.
export async function resolveApiBase() {
  if (!IS_PAGES) { base = ''; return base }
  const qs = new URLSearchParams(location.search).get('api')
  const candidates = []
  if (qs) candidates.push(qs.replace(/\/+$/, ''))
  const pointer = await readPointer()
  if (pointer) candidates.push(pointer)
  try { const c = localStorage.getItem(LS_API); if (c) candidates.push(c) } catch { /* stockage indisponible */ }
  for (const c of [...new Set(candidates)]) {
    if (await probe(c)) {
      base = c
      try { localStorage.setItem(LS_API, c) } catch { /* idem */ }
      return base
    }
  }
  return null
}

// Après une coupure : le tunnel a peut-être changé d'adresse.
export async function pointerChanged() {
  if (!IS_PAGES) return false
  const p = await readPointer()
  return !!p && p !== base && (await probe(p))
}

/* ---- Identité de l'appareil ---- */
export function getDeviceId() {
  let d = null
  try { d = localStorage.getItem('xoxo_device_id') } catch { /* privé */ }
  if (!d) {
    d = crypto.randomUUID?.() || 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
    try { localStorage.setItem('xoxo_device_id', d) } catch { /* privé */ }
  }
  return d
}

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

/* ---- Pass de commande (scan de la borne) ---- */
const LS_PASS = 'xoxo_pass'
export function getPass() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PASS))
    return p && p.exp > Date.now() + 5000 ? p : null
  } catch { return null }
}
export function savePass(p) {
  try { localStorage.setItem(LS_PASS, JSON.stringify(p)) } catch { /* privé */ }
}
export function clearPass() {
  try { localStorage.removeItem(LS_PASS) } catch { /* privé */ }
}

export function getSavedName() {
  try { return localStorage.getItem('xoxo_name') || '' } catch { return '' }
}
export function saveName(n) {
  try { localStorage.setItem('xoxo_name', n) } catch { /* privé */ }
}

/* ---- Mes commandes (mémoire locale) ---- */
const LS_ORDERS = 'xoxo_my_orders'
export const readMine = () => { try { return JSON.parse(localStorage.getItem(LS_ORDERS)) || [] } catch { return [] } }
export const saveMine = o => {
  const list = readMine().filter(x => x.token !== o.token)
  list.unshift({ token: o.token, name: o.name, emoji: o.emoji, status: o.status, at: Date.now() })
  try { localStorage.setItem(LS_ORDERS, JSON.stringify(list.slice(0, 12))) } catch { /* privé */ }
}

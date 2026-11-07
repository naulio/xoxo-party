import { useSyncExternalStore } from 'react'
import { io } from 'socket.io-client'
import { apiUrl, apiBase, fixAssets, resolveApiBase, pointerChanged, IS_PAGES } from './net.js'

// Store global minimaliste : l'état vient du serveur via Socket.IO,
// les mutations passent par l'API REST puis reviennent en broadcast.

let state = {
  booted: false,
  conn: 'connecting', // connecting | online | offline | searching
  me: null,
  pub: null,   // état public (carte, attente, tableau d'honneur)
  staff: null, // état complet staff
  toasts: [],
}

const subs = new Set()
const emit = () => subs.forEach(fn => fn())
const set = patch => { state = { ...state, ...patch }; emit() }
const getSnapshot = () => state
const subscribe = fn => { subs.add(fn); return () => subs.delete(fn) }

export const useApp = () => useSyncExternalStore(subscribe, getSnapshot)

const TOKEN_KEY = 'xoxo_token'
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }

let socket = null
let failures = 0
let rechecking = false

const kioskListeners = new Set()
export const onKioskEvent = fn => { kioskListeners.add(fn); return () => kioskListeners.delete(fn) }

export function connect() {
  socket?.disconnect()
  socket = io(apiBase() || undefined, { auth: { token: getToken() } })
  socket.on('connect', () => { failures = 0; set({ conn: 'online' }) })
  socket.on('disconnect', () => set({ conn: 'offline' }))
  socket.on('connect_error', async () => {
    set({ conn: 'offline' })
    // Lien fixe GitHub : après quelques échecs, le tunnel a peut-être changé
    // d'adresse — on relit api.json et on bascule tout seul.
    if (!IS_PAGES || rechecking || ++failures < 3) return
    rechecking = true
    try {
      if (await pointerChanged()) {
        await resolveApiBase()
        connect()
      }
    } finally {
      rechecking = false
      failures = 0
    }
  })
  socket.on('public:state', pub => set({ pub: fixAssets(pub) }))
  socket.on('staff:state', staff => set({ staff: fixAssets(staff) }))
  socket.on('notify', e => toast(e.level, e.title, e.msg))
  socket.on('kiosk:event', e => kioskListeners.forEach(fn => fn(e)))
}

export const getSocket = () => socket

export function joinKiosk() {
  const join = () => socket?.emit('kiosk:join')
  socket?.on('connect', join)
  if (socket?.connected) join()
  return () => socket?.off('connect', join)
}

export async function api(method, path, body) {
  const res = await fetch(apiUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Erreur serveur')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// Variante "safe" : affiche l'erreur en toast et renvoie null.
export async function call(method, path, body) {
  try {
    return await api(method, path, body)
  } catch (e) {
    toast('error', 'Oups', e.message)
    return null
  }
}

export async function uploadImage(path, file) {
  const fd = new FormData()
  fd.append('photo', file)
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Envoi impossible')
  return data
}

let toastId = 0
export function toast(level, title, msg) {
  const t = { id: ++toastId, level: level || 'info', title, msg }
  set({ toasts: [...state.toasts, t].slice(-4) })
  setTimeout(() => dismissToast(t.id), 5200)
}
export function dismissToast(id) {
  set({ toasts: state.toasts.filter(t => t.id !== id) })
}

// Suivi d'une commande (page #/c/:token) : rejoint la room socket
// dédiée et rappelle cb à chaque mise à jour, reconnexions comprises.
export function onTrack(token, cb) {
  const handler = p => { if (p && p.token === token) cb(fixAssets(p)) }
  const join = () => socket?.emit('track', token)
  socket?.on('order:update', handler)
  socket?.on('connect', join)
  if (socket?.connected) join()
  return () => {
    socket?.off('order:update', handler)
    socket?.off('connect', join)
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function boot() {
  set({ conn: 'connecting' })
  let b = await resolveApiBase()
  while (b === null) {
    // Lien fixe mais serveur éteint (ou en train de démarrer) : on patiente.
    set({ conn: 'searching' })
    await sleep(6000)
    b = await resolveApiBase()
  }
  if (getToken()) {
    try {
      const { user } = await api('GET', '/api/auth/me')
      set({ me: user })
    } catch (e) {
      // Seul un refus explicite déconnecte (pas une coupure réseau).
      if (e.status === 401) { try { localStorage.removeItem(TOKEN_KEY) } catch { /* privé */ } }
    }
  }
  set({ booted: true })
  connect()
}

export async function login(userId, pin) {
  const { token, user } = await api('POST', '/api/auth/login', { userId, pin })
  localStorage.setItem(TOKEN_KEY, token)
  set({ me: user })
  connect()
  return user
}

export async function logout() {
  try { await api('POST', '/api/auth/logout') } catch { /* déjà déconnecté */ }
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* privé */ }
  set({ me: null, staff: null })
  connect()
}

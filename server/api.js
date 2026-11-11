import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { db, id, persist, UPLOADS_DIR } from './db.js'
import { hashPin, checkPin, createSession, destroySession, requireStaff, requireAdmin, publicUser } from './auth.js'
import { publicState, staffState, snapshotForDiff, diffEvents, guestTotal, trackPayload, enrichCocktails } from './derive.js'
import { computeQueue, learnFromOrder, ACTIVE } from './queue.js'
import { issuePass, checkPass, passFromCode, consumePass } from './passes.js'
import { pushToOrder, registerDeviceSub } from './push.js'
import { computeShopping } from './shopping.js'

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'served']
const bad = (res, msg) => res.status(400).json({ error: msg })
const notFound = (res, msg = 'Introuvable') => res.status(404).json({ error: msg })
const refuse = (res, msg, extra = {}) => res.status(409).json({ error: msg, ...extra })
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const validDevice = d => /^[\w-]{8,64}$/.test(String(d || ''))
const hhmm = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const euros = n => `${String(+(+n).toFixed(2)).replace('.', ',')} €`

// Retrouve (ou crée) la fiche invité d'une commande : d'abord par l'ID unique
// du téléphone (ou un de ses alias), sinon par prénom, sinon nouvelle fiche.
// Deux invités homonymes gardent ainsi des fiches distinctes.
const guestByDevice = (s, d) =>
  d ? s.guests.find(x => x.deviceId === d || (x.altIds || []).includes(d)) || null : null

function identityIds(s, deviceId) {
  const ids = new Set([deviceId])
  const g = guestByDevice(s, deviceId)
  if (g) {
    if (g.deviceId) ids.add(g.deviceId)
    for (const a of g.altIds || []) ids.add(a)
  }
  return ids
}

function linkGuestForOrder(s, o) {
  let g = guestByDevice(s, o.deviceId)
  if (!g && o.guestName) {
    const n = o.guestName.trim().toLowerCase()
    const candidates = s.guests.filter(x => x.name.trim().toLowerCase() === n)
    // On ne rattache jamais une fiche déjà liée à un autre téléphone.
    g = candidates.find(x => !x.deviceId) || (!o.deviceId ? candidates[0] : null) || null
  }
  let created = false
  if (!g) {
    g = {
      id: id(), name: (o.guestName || 'Invité').trim(), comment: '', drinks: [], adjust: 0,
      createdAt: Date.now(), deviceId: o.deviceId || null, altIds: [],
    }
    s.guests.push(g)
    created = true
  } else if (o.deviceId && !g.deviceId) {
    g.deviceId = o.deviceId
  }
  return { guest: g, created }
}

// Garde-fou consommation : quand le profil d'un invité est reconnu, le bar est
// prévenu s'il approche (🟠) ou dépasse (🔴) la limite. Jamais bloquant.
function consumptionAlert(guest, o, notify) {
  const total = guestTotal(guest)
  const projected = total + o.points * o.qty
  const drink = `${o.qty > 1 ? o.qty + '× ' : ''}${o.name}`
  if (total >= 6) {
    notify({ level: 'error', title: '🔴 Invité au-dessus de la limite', msg: `${guest.name} 📱 est à ${total} pts (élevé) — ${projected} pts avec ${drink}. À toi de juger.` })
  } else if (total >= 4) {
    notify({ level: 'warn', title: '🟠 Invité proche de la limite', msg: `${guest.name} 📱 est à ${total} pts — ${projected} pts avec ${drink}. À toi de juger.` })
  }
}

function newOrder(c, { qty = 1, guestName = '', note = '', deviceId = null, source = 'staff' }) {
  return {
    id: id(), token: crypto.randomUUID(), cocktailId: c.id, name: c.name, emoji: c.emoji, points: c.points,
    qty, guestName: String(guestName).trim().slice(0, 30), note: String(note).trim().slice(0, 80),
    status: 'pending', source, createdAt: Date.now(), updatedAt: Date.now(),
    startedAt: null, readyAt: null, servedAt: null,
    priority: false, priorityAt: null, donation: null,
    stockDeducted: false, pointsCredited: false, archived: false, subscriptions: [], deviceId,
  }
}

function moveStock(s, o, sign) {
  const c = s.cocktails.find(x => x.id === o.cocktailId)
  c?.ingredients.forEach(l => {
    const ing = s.ingredients.find(i => i.id === l.ingredientId)
    if (ing) ing.stock = Math.max(0, +(ing.stock + sign * l.qty * o.qty).toFixed(2))
  })
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype]
      cb(ext ? null : new Error('Format d\'image non supporté (JPEG, PNG, WebP ou GIF)'), crypto.randomBytes(8).toString('hex') + (ext || ''))
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
})

// Codes de liaison app ↔ navigateur (iPhone : stockages séparés).
const linkCodes = new Map() // code -> { deviceId, exp }

export function registerApi(app, io, meta) {
  const r = express.Router()

  const broadcast = () => {
    const state = db()
    const q = computeQueue(state)
    io.emit('public:state', publicState(state))
    io.to('staff').emit('staff:state', staffState(state, meta()))
    // Pages de suivi ouvertes : chaque room « track:<token> » reçoit sa commande à jour.
    for (const room of io.sockets.adapter.rooms.keys()) {
      if (!room.startsWith('track:')) continue
      const token = room.slice(6)
      const o = state.orders.find(x => x.token === token)
      io.to(room).emit('order:update', o ? trackPayload(state, o, q) : { deleted: true, token })
    }
  }
  const notify = evt => io.to('staff').emit('notify', evt)
  const kioskEvent = evt => io.to('kiosk').emit('kiosk:event', { at: Date.now(), ...evt })

  // Applique une mutation, persiste, diffuse l'état + les alertes dérivées
  // (stock faible, cocktail devenu indisponible…).
  const mutate = fn => {
    const before = snapshotForDiff(db())
    const out = fn(db())
    persist()
    broadcast()
    diffEvents(before, db()).forEach(notify)
    return out
  }

  // ---- Santé ------------------------------------------------------------
  r.get('/ping', (req, res) => res.json({ ok: true, party: db().settings.partyName }))

  // ---- Auth -------------------------------------------------------------
  r.get('/auth/logins', (req, res) => {
    res.json(db().users.map(publicUser))
  })

  r.post('/auth/login', (req, res) => {
    const { userId, pin } = req.body || {}
    const user = db().users.find(u => u.id === userId)
    if (!user || !checkPin(pin, user.pinHash)) return res.status(401).json({ error: 'Code PIN incorrect' })
    res.json({ token: createSession(user.id), user: publicUser(user) })
  })

  // Vérifie un PIN sans ouvrir de nouvelle session (sortie du mode borne).
  r.post('/auth/check-pin', requireStaff, (req, res) => {
    const ok = db().users.some(u => checkPin(req.body?.pin, u.pinHash))
    if (!ok) return res.status(401).json({ error: 'Code PIN incorrect' })
    res.json({ ok: true })
  })

  r.post('/auth/logout', (req, res) => {
    destroySession(req.token)
    res.json({ ok: true })
  })

  r.get('/auth/me', requireStaff, (req, res) => {
    res.json({ user: publicUser(req.user) })
  })

  // ---- États ------------------------------------------------------------
  r.get('/public/state', (req, res) => res.json(publicState(db())))
  r.get('/staff/state', requireStaff, (req, res) => res.json(staffState(db(), meta())))

  // ---- Ingrédients ------------------------------------------------------
  r.post('/ingredients', requireStaff, (req, res) => {
    const { name, emoji = '🧪', unit = 'cl', stock = 0, low = 0, step = 1 } = req.body || {}
    if (!name?.trim()) return bad(res, 'Le nom est requis')
    const ing = mutate(s => {
      const it = { id: id(), name: name.trim(), emoji, unit, stock: +stock || 0, initialStock: +stock || 0, low: +low || 0, step: +step || 1 }
      s.ingredients.push(it)
      return it
    })
    res.json(ing)
  })

  r.patch('/ingredients/:id', requireStaff, (req, res) => {
    const ing = db().ingredients.find(i => i.id === req.params.id)
    if (!ing) return notFound(res)
    const body = req.body || {}
    mutate(() => {
      if (body.stock !== undefined) ing.stock = Math.max(0, +body.stock || 0)
      if (body.name !== undefined && body.name.trim()) ing.name = body.name.trim()
      if (body.emoji !== undefined) ing.emoji = body.emoji
      if (body.unit !== undefined) ing.unit = body.unit
      if (body.low !== undefined) ing.low = Math.max(0, +body.low || 0)
      if (body.step !== undefined) ing.step = Math.max(0.25, +body.step || 1)
      if (body.initialStock !== undefined) ing.initialStock = Math.max(0, +body.initialStock || 0)
    })
    res.json(ing)
  })

  r.post('/ingredients/:id/restock', requireStaff, (req, res) => {
    const ing = db().ingredients.find(i => i.id === req.params.id)
    if (!ing) return notFound(res)
    mutate(() => { ing.stock = ing.initialStock })
    res.json(ing)
  })

  r.delete('/ingredients/:id', requireAdmin, (req, res) => {
    mutate(s => {
      s.ingredients = s.ingredients.filter(i => i.id !== req.params.id)
      s.cocktails.forEach(c => { c.ingredients = c.ingredients.filter(l => l.ingredientId !== req.params.id) })
    })
    res.json({ ok: true })
  })

  // ---- Cocktails ----------------------------------------------------------
  const readCocktailBody = body => ({
    name: String(body.name || '').trim(),
    emoji: body.emoji || '🍸',
    hue: Math.max(0, Math.min(360, +body.hue || 0)),
    category: String(body.category || 'Classiques').trim() || 'Classiques',
    points: Number.isFinite(+body.points) ? Math.max(0, Math.min(3, Math.round(+body.points))) : 2,
    description: String(body.description || '').trim(),
    steps: String(body.steps || '').trim(),
    secret: !!body.secret,
    archived: !!body.archived,
    ingredients: Array.isArray(body.ingredients)
      ? body.ingredients
          .map(l => ({ ingredientId: l.ingredientId, qty: +l.qty || 0 }))
          .filter(l => l.qty > 0 && db().ingredients.some(i => i.id === l.ingredientId))
      : [],
  })

  r.post('/cocktails', requireStaff, (req, res) => {
    const data = readCocktailBody(req.body || {})
    if (!data.name) return bad(res, 'Le nom est requis')
    if (!data.ingredients.length) return bad(res, 'Ajoute au moins un ingrédient à la recette')
    const c = mutate(s => {
      const it = { id: id(), ...data, imageUrl: null, visible: req.body.visible !== false, createdAt: Date.now() }
      s.cocktails.push(it)
      if (!s.settings.categories.includes(it.category)) s.settings.categories.push(it.category)
      return it
    })
    res.json(c)
  })

  r.patch('/cocktails/:id', requireStaff, (req, res) => {
    const c = db().cocktails.find(x => x.id === req.params.id)
    if (!c) return notFound(res)
    const body = req.body || {}
    const quick = ['visible', 'archived']
    const keys = Object.keys(body)
    mutate(s => {
      if (body.visible !== undefined) c.visible = !!body.visible
      if (body.archived !== undefined) c.archived = !!body.archived
      if (keys.some(k => !quick.includes(k))) {
        const data = readCocktailBody({ ...c, ...body })
        if (!data.name) data.name = c.name
        if (!data.ingredients.length) return
        Object.assign(c, data)
        if (!s.settings.categories.includes(c.category)) s.settings.categories.push(c.category)
      }
    })
    res.json(c)
  })

  r.post('/cocktails/:id/image', requireStaff, upload.single('photo'), (req, res) => {
    const c = db().cocktails.find(x => x.id === req.params.id)
    if (!c) return notFound(res)
    if (!req.file) return bad(res, 'Aucune image reçue')
    mutate(() => {
      if (c.imageUrl) { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(c.imageUrl))) } catch {} }
      c.imageUrl = '/uploads/' + req.file.filename
    })
    res.json(c)
  })

  r.delete('/cocktails/:id/image', requireStaff, (req, res) => {
    const c = db().cocktails.find(x => x.id === req.params.id)
    if (!c) return notFound(res)
    mutate(() => {
      if (c.imageUrl) { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(c.imageUrl))) } catch {} }
      c.imageUrl = null
    })
    res.json(c)
  })

  r.delete('/cocktails/:id', requireAdmin, (req, res) => {
    const c = db().cocktails.find(x => x.id === req.params.id)
    if (c?.imageUrl) { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(c.imageUrl))) } catch {} }
    mutate(s => { s.cocktails = s.cocktails.filter(x => x.id !== req.params.id) })
    res.json({ ok: true })
  })

  // ---- Passes de commande (borne → téléphone) -----------------------------
  r.post('/kiosk/pass', requireStaff, (req, res) => {
    const { cocktailId = null, kioskId = null } = req.body || {}
    res.json(issuePass({ cocktailId, kioskId: String(kioskId || '').slice(0, 40) || null }))
  })

  // Le téléphone échange le pass de la borne (QR ou code à 4 chiffres) contre
  // un pass personnel : 10 minutes pour choisir tranquillement.
  r.post('/pass/redeem', (req, res) => {
    const { pass, code, deviceId } = req.body || {}
    if (!validDevice(deviceId)) return bad(res, 'Identifiant d\'appareil invalide')
    const src = pass ? (checkPass(pass) && { pass, ...checkPass(pass) }) : passFromCode(code)
    if (!src) return res.status(410).json({ error: code ? 'Code inconnu ou expiré — regarde celui affiché sur la borne' : 'QR expiré — rescanne la borne au bar' })
    if (src.personal) {
      if (src.deviceId !== deviceId) return res.status(403).json({ error: 'Ce pass appartient à un autre téléphone — scanne la borne' })
      return res.json({ pass, exp: src.exp, cocktailId: src.cocktailId })
    }
    const personal = issuePass({ cocktailId: src.cocktailId, kioskId: src.kioskId, deviceId, personal: true })
    res.json({ pass: personal.pass, exp: personal.exp, cocktailId: personal.cocktailId })
  })

  // ---- Commandes passées par les invités (app uniquement) -----------------
  r.post('/public/orders', (req, res) => {
    const { pass, cocktailId, qty = 1, guestName = '', note = '', deviceId } = req.body || {}
    const state = db()
    const s = state.settings
    if (!validDevice(deviceId)) return bad(res, 'Identifiant d\'appareil invalide')
    const p = checkPass(pass)
    if (s.requirePass !== false) {
      if (!p) return refuse(res, 'Scanne le QR de la borne au bar pour commander 📱', { code: 'pass' })
      if (p.personal && p.deviceId !== deviceId) return refuse(res, 'Ce pass appartient à un autre téléphone', { code: 'pass' })
    }
    const name = String(guestName).trim().slice(0, 30)
    if (!name) return bad(res, 'Ton prénom est obligatoire')
    const c = enrichCocktails(state).find(x => x.id === cocktailId)
    if (!c || c.archived) return notFound(res, 'Cocktail introuvable')
    if (!c.visible || !c.makeable) return refuse(res, `${c.emoji} ${c.name} est victime de son succès — choisis-en un autre`, { code: 'unavailable' })

    const q = computeQueue(state)
    if (q.closed) return refuse(res, 'Les commandes sont fermées pour le moment — le bar souffle un peu 😮‍💨', { code: 'closed' })
    if (q.paused) return refuse(res, `Le bar fait une pause jusqu'à ${hhmm(q.pauseUntil)} — reviens juste après 🙏`, { code: 'paused' })
    if (q.full) return refuse(res, `La file est complète (${q.queuedDrinks} boissons). Réessaie dans ~${Math.max(2, Math.ceil(q.pace))} min`, { code: 'full' })

    const ids = identityIds(state, deviceId)
    const active = state.orders.filter(o => !o.archived && ACTIVE.includes(o.status) && ids.has(o.deviceId))
    if (active.length >= (s.maxActivePerDevice || 1)) {
      return refuse(res, 'Tu as déjà une commande en cours — une à la fois, pour que tout le monde soit servi 😉', { code: 'active', token: active[0].token })
    }

    const qn = clamp(Math.round(+qty) || 1, 1, s.maxQty || 2)
    const o = mutate(st => {
      const it = newOrder(c, { qty: qn, guestName: name, note, deviceId, source: p?.kioskId ? 'kiosk' : 'app' })
      st.orders.push(it)
      const { guest, created } = linkGuestForOrder(st, it)
      if (created) notify({ level: 'info', title: 'Nouvelle fiche invité', msg: `${guest.name} a commandé depuis son téléphone 📱` })
      consumptionAlert(guest, it, notify)
      return it
    })
    if (p) consumePass(pass)
    const eta = computeQueue(db()).eta[o.id]
    kioskEvent({ type: 'created', kioskId: p?.kioskId || null, guestName: o.guestName, name: o.name, emoji: o.emoji, qty: o.qty, minutes: eta?.minutes })
    res.json({ token: o.token, eta })
  })

  // Commande manuelle staff : exception (invité sans téléphone).
  r.post('/orders', requireStaff, (req, res) => {
    const { cocktailId, qty = 1, guestName = '', note = '' } = req.body || {}
    const c = db().cocktails.find(x => x.id === cocktailId)
    if (!c) return notFound(res, 'Cocktail introuvable')
    if (!String(guestName).trim()) return bad(res, 'Le prénom de l\'invité est obligatoire')
    const order = mutate(s => {
      const it = newOrder(c, { qty: clamp(Math.round(+qty) || 1, 1, 9), guestName, note, source: 'staff' })
      s.orders.push(it)
      return it
    })
    res.json(order)
  })

  r.patch('/orders/:id', requireStaff, (req, res) => {
    const o = db().orders.find(x => x.id === req.params.id)
    if (!o) return notFound(res)
    const { status } = req.body || {}
    if (!ORDER_STATUSES.includes(status)) return bad(res, 'Statut invalide')
    const prevStatus = o.status
    if (prevStatus === status) return res.json(o)
    mutate(s => {
      const now = Date.now()
      o.status = status
      o.updatedAt = now
      if (status === 'pending') o.startedAt = null
      if (status === 'preparing' && prevStatus === 'pending') o.startedAt = now
      if (status === 'ready') {
        if (prevStatus === 'preparing') learnFromOrder(s.settings, o, now)
        o.readyAt = now
      }
      // Le stock est décompté quand la préparation démarre (une seule fois).
      if (status !== 'pending' && !o.stockDeducted) {
        moveStock(s, o, -1)
        o.stockDeducted = true
      }
      if (status === 'served') {
        o.servedAt = o.servedAt || now
        if (!o.pointsCredited && s.settings.autoLink && (o.guestName || o.deviceId)) {
          const { guest: g, created } = linkGuestForOrder(s, o)
          g.drinks.push({ cocktailId: o.cocktailId, name: o.name, emoji: o.emoji, qty: o.qty, points: o.points * o.qty, at: now })
          o.pointsCredited = true
          notify({
            level: 'info',
            title: created ? 'Fiche invité créée' : 'Points ajoutés',
            msg: `${o.points * o.qty} pt${o.points * o.qty > 1 ? 's' : ''} sur la fiche de ${g.name} (${guestTotal(g)} au total)${g.deviceId ? ' 📱' : ''}`,
          })
        }
      }
    })
    const label = { ready: 'Commande prête', served: 'Commande servie' }[status]
    if (label) notify({ level: status === 'ready' ? 'success' : 'info', title: label, msg: `${o.qty}× ${o.emoji} ${o.name}${o.guestName ? ' — ' + o.guestName : ''}` })
    if (status === 'ready' && prevStatus !== 'ready') {
      kioskEvent({ type: 'ready', guestName: o.guestName, name: o.name, emoji: o.emoji, qty: o.qty })
      // Web Push automatique vers le(s) téléphone(s) de l'invité.
      pushToOrder(o, {
        title: `${o.emoji} ${o.qty > 1 ? o.qty + '× ' : ''}${o.name} — c'est prêt !`,
        body: `${o.guestName ? 'Salut ' + o.guestName + ', v' : 'V'}iens le récupérer au bar 🖤`,
        url: `#/c/${o.token}`,
        tag: `order-${o.token}`,
      }).catch(() => {})
    }
    res.json(o)
  })

  r.delete('/orders/:id', requireStaff, (req, res) => {
    const o = db().orders.find(x => x.id === req.params.id)
    if (!o) return notFound(res)
    mutate(s => {
      // Annulation avant service : on restitue les ingrédients décomptés.
      if (o.stockDeducted && o.status !== 'served') moveStock(s, o, +1)
      s.orders = s.orders.filter(x => x.id !== req.params.id)
    })
    res.json({ ok: true })
  })

  r.post('/orders/clear-served', requireStaff, (req, res) => {
    mutate(s => s.orders.forEach(o => { if (o.status === 'served') o.archived = true }))
    res.json({ ok: true })
  })

  // ---- Priorité contre don (2 € boîte à tips ou PayPal) -------------------
  const recordDonation = (s, { name, amount, method, anonymous = false, orderId = null, deviceId = null, by = null }) => {
    const g = deviceId ? guestByDevice(s, deviceId) : s.guests.find(x => x.name.trim().toLowerCase() === String(name).trim().toLowerCase())
    const d = {
      id: id(), name: String(g?.name || name || 'Anonyme').trim().slice(0, 30), guestId: g?.id || null,
      amount: +(+amount).toFixed(2), method, anonymous: !!anonymous, orderId, at: Date.now(), by,
    }
    s.donations.push(d)
    return d
  }

  // L'invité déclare son don ; un barman valide (pièce vue / PayPal reçu).
  r.post('/track/:token/donation', (req, res) => {
    const o = db().orders.find(x => x.token === req.params.token)
    if (!o) return notFound(res, 'Commande introuvable')
    if (o.priority) return res.json({ ok: true })
    if (o.status !== 'pending') return refuse(res, 'Ta commande est déjà en préparation — plus besoin de priorité 😉')
    const method = req.body?.method === 'paypal' ? 'paypal' : 'cash'
    const amount = db().settings.donationAmount ?? 2
    mutate(() => {
      o.donation = { status: 'claimed', method, anonymous: !!req.body?.anonymous, amount, at: Date.now() }
    })
    notify({
      level: 'warn',
      title: '💎 Don déclaré — à vérifier',
      msg: `${o.guestName || 'Un invité'} · ${euros(amount)} ${method === 'paypal' ? 'via PayPal' : 'dans la boîte à tips'} · ${o.emoji} ${o.name}`,
    })
    res.json({ ok: true })
  })

  r.post('/orders/:id/donation', requireStaff, (req, res) => {
    const o = db().orders.find(x => x.id === req.params.id)
    if (!o) return notFound(res)
    const { action = 'confirm', method } = req.body || {}
    const s = db().settings
    if (action === 'refuse') {
      mutate(() => { o.donation = { ...(o.donation || {}), status: 'refused', at: Date.now() } })
      return res.json(o)
    }
    if (action === 'undo') {
      mutate(st => {
        o.priority = false
        o.priorityAt = null
        st.donations = st.donations.filter(d => d.orderId !== o.id)
        o.donation = null
      })
      return res.json(o)
    }
    if (o.priority) return res.json(o)
    const amount = clamp(+(req.body?.amount ?? o.donation?.amount ?? s.donationAmount ?? 2), 0.5, 500)
    const m = method || o.donation?.method || 'cash'
    mutate(st => {
      o.priority = true
      o.priorityAt = Date.now()
      o.donation = { ...(o.donation || {}), status: 'confirmed', method: m, amount, at: Date.now() }
      recordDonation(st, { name: o.guestName, amount, method: m, anonymous: o.donation.anonymous, orderId: o.id, deviceId: o.deviceId, by: req.user.name })
    })
    pushToOrder(o, {
      title: o.guestName ? `💎 Merci ${o.guestName} !` : '💎 Merci !',
      body: `Ton ${o.name} passe en priorité. Les barmans te remercient 🖤`,
      url: `#/c/${o.token}`,
      tag: `order-${o.token}`,
    }).catch(() => {})
    kioskEvent({ type: 'donation', name: o.donation?.anonymous ? 'Anonyme' : o.guestName, amount })
    res.json(o)
  })

  // Pourboire sans commande (ou ajouté après coup) → tableau d'honneur.
  r.post('/donations', requireStaff, (req, res) => {
    const { name = '', amount, method = 'cash', anonymous = false } = req.body || {}
    if (!String(name).trim() && !anonymous) return bad(res, 'Indique un prénom (ou coche anonyme)')
    const a = +amount
    if (!(a > 0 && a <= 500)) return bad(res, 'Montant invalide')
    const d = mutate(st => recordDonation(st, { name: name || 'Anonyme', amount: a, method: method === 'paypal' ? 'paypal' : 'cash', anonymous, by: req.user.name }))
    kioskEvent({ type: 'donation', name: d.anonymous ? 'Anonyme' : d.name, amount: d.amount })
    res.json(d)
  })

  r.delete('/donations/:id', requireStaff, (req, res) => {
    mutate(st => { st.donations = st.donations.filter(d => d.id !== req.params.id) })
    res.json({ ok: true })
  })

  // ---- Suivi de commande (public, via QR) -----------------------------------
  r.get('/track/:token', (req, res) => {
    const o = db().orders.find(x => x.token === req.params.token)
    if (!o) return notFound(res, 'Commande introuvable')
    res.json(trackPayload(db(), o))
  })

  // Ouverture de la page de suivi : le téléphone « réclame » la commande avec
  // son ID unique. Si une autre identité du même téléphone l'a déjà (Safari
  // iOS vs app installée : stockages séparés), le token partagé prouve que
  // c'est la même personne → les identités sont fusionnées sur la fiche.
  r.post('/track/:token/claim', (req, res) => {
    const o = db().orders.find(x => x.token === req.params.token)
    if (!o) return notFound(res, 'Commande introuvable')
    const deviceId = String(req.body?.deviceId || '').slice(0, 64)
    if (!validDevice(deviceId)) return bad(res, 'Identifiant d\'appareil invalide')
    if (o.deviceId && o.deviceId !== deviceId) {
      const g = guestByDevice(db(), o.deviceId)
      if (g && g.deviceId !== deviceId && !(g.altIds || []).includes(deviceId)) {
        mutate(() => {
          g.altIds = g.altIds || []
          if (g.altIds.length >= 4) g.altIds.shift()
          g.altIds.push(deviceId)
        })
      }
    }
    if (!o.deviceId) {
      mutate(s => {
        o.deviceId = deviceId
        const { guest, created } = linkGuestForOrder(s, o)
        notify({
          level: 'info',
          title: created ? 'Fiche invité créée' : 'Invité identifié',
          msg: `${guest.name} a scanné sa commande — fiche liée à son téléphone 📱`,
        })
        consumptionAlert(guest, o, notify)
      })
    }
    res.json(trackPayload(db(), o))
  })

  r.post('/track/:token/subscribe', (req, res) => {
    const o = db().orders.find(x => x.token === req.params.token)
    if (!o) return notFound(res, 'Commande introuvable')
    const sub = req.body?.subscription
    if (!sub?.endpoint || !sub?.keys) return bad(res, 'Abonnement invalide')
    o.subscriptions = o.subscriptions || []
    if (!o.subscriptions.some(x => x.endpoint === sub.endpoint)) {
      if (o.subscriptions.length >= 6) o.subscriptions.shift()
      o.subscriptions.push(sub)
      persist()
    }
    const deviceId = String(req.body?.deviceId || '').slice(0, 64)
    if (validDevice(deviceId)) registerDeviceSub(deviceId, sub)
    res.json({ ok: true })
  })

  // Notification d'essai — vérifie la chaîne complète sur le téléphone.
  r.post('/track/:token/test-push', async (req, res) => {
    const o = db().orders.find(x => x.token === req.params.token)
    if (!o) return notFound(res, 'Commande introuvable')
    if (o.lastTestPush && Date.now() - o.lastTestPush < 10000) return bad(res, 'Attends quelques secondes entre deux essais')
    o.lastTestPush = Date.now()
    const out = await pushToOrder(o, {
      title: '🔔 Test réussi !',
      body: `Tu seras prévenu comme ça quand ${o.qty > 1 ? 'tes' : 'ton'} ${o.name} sera prêt.`,
      url: `#/c/${o.token}`,
      tag: `order-${o.token}`,
    })
    res.json(out)
  })

  // ---- Appareils : mes commandes + liaison app ↔ navigateur -----------------
  r.get('/device/:deviceId/orders', (req, res) => {
    const deviceId = req.params.deviceId
    if (!validDevice(deviceId)) return bad(res, 'Identifiant invalide')
    const state = db()
    const ids = identityIds(state, deviceId)
    const since = Date.now() - 12 * 3600 * 1000
    const q = computeQueue(state)
    const list = state.orders
      .filter(o => ids.has(o.deviceId) && o.createdAt > since)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12)
      .map(o => ({ token: o.token, name: o.name, emoji: o.emoji, qty: o.qty, status: o.status, createdAt: o.createdAt, eta: q.eta[o.id] || null }))
    const g = guestByDevice(state, deviceId)
    res.json({ orders: list, guestName: g?.name || null })
  })

  r.post('/device/link-code', (req, res) => {
    const deviceId = String(req.body?.deviceId || '')
    if (!validDevice(deviceId)) return bad(res, 'Identifiant invalide')
    const now = Date.now()
    for (const [k, v] of linkCodes) if (v.exp < now || v.deviceId === deviceId) linkCodes.delete(k)
    let code
    do { code = String(crypto.randomInt(1000, 10000)) } while (linkCodes.has(code))
    linkCodes.set(code, { deviceId, exp: now + 15 * 60 * 1000 })
    res.json({ code })
  })

  r.post('/device/link', (req, res) => {
    const { code, deviceId } = req.body || {}
    if (!validDevice(deviceId)) return bad(res, 'Identifiant invalide')
    const src = linkCodes.get(String(code || '').trim())
    if (!src || src.exp < Date.now()) return res.status(410).json({ error: 'Code inconnu ou expiré' })
    const g = guestByDevice(db(), src.deviceId)
    if (!g) return refuse(res, 'Aucune commande trouvée sur l\'autre appareil — commande d\'abord depuis le navigateur')
    if (g.deviceId !== deviceId && !(g.altIds || []).includes(deviceId)) {
      mutate(() => {
        g.altIds = g.altIds || []
        if (g.altIds.length >= 4) g.altIds.shift()
        g.altIds.push(deviceId)
      })
    }
    linkCodes.delete(String(code).trim())
    res.json({ ok: true, guestName: g.name })
  })

  // ---- Invités (pense-bête) ----------------------------------------------
  r.post('/guests', requireStaff, (req, res) => {
    const { name, comment = '' } = req.body || {}
    if (!name?.trim()) return bad(res, 'Le prénom est requis')
    const g = mutate(s => {
      const it = { id: id(), name: name.trim(), comment: String(comment).trim(), drinks: [], adjust: 0, createdAt: Date.now(), deviceId: null, altIds: [] }
      s.guests.push(it)
      return it
    })
    res.json(g)
  })

  r.patch('/guests/:id', requireStaff, (req, res) => {
    const g = db().guests.find(x => x.id === req.params.id)
    if (!g) return notFound(res)
    const body = req.body || {}
    mutate(() => {
      if (body.name !== undefined && body.name.trim()) g.name = body.name.trim()
      if (body.comment !== undefined) g.comment = String(body.comment).trim()
      if (body.adjust !== undefined) g.adjust = Math.round(+body.adjust || 0)
    })
    res.json({ ...g, total: guestTotal(g) })
  })

  r.post('/guests/:id/serve', requireStaff, (req, res) => {
    const g = db().guests.find(x => x.id === req.params.id)
    if (!g) return notFound(res)
    const c = db().cocktails.find(x => x.id === req.body?.cocktailId)
    if (!c) return notFound(res, 'Cocktail introuvable')
    mutate(() => {
      g.drinks.push({ cocktailId: c.id, name: c.name, emoji: c.emoji, qty: 1, points: c.points, at: Date.now() })
    })
    res.json({ ...g, total: guestTotal(g) })
  })

  r.delete('/guests/:id/drinks/:index', requireStaff, (req, res) => {
    const g = db().guests.find(x => x.id === req.params.id)
    if (!g) return notFound(res)
    const idx = +req.params.index
    if (!(idx >= 0 && idx < g.drinks.length)) return notFound(res, 'Boisson introuvable')
    mutate(() => g.drinks.splice(idx, 1))
    res.json({ ...g, total: guestTotal(g) })
  })

  r.delete('/guests/:id', requireStaff, (req, res) => {
    mutate(s => { s.guests = s.guests.filter(x => x.id !== req.params.id) })
    res.json({ ok: true })
  })

  // ---- Réglages du service (barmans) ---------------------------------------
  r.patch('/settings/service', requireStaff, (req, res) => {
    const b = req.body || {}
    const num = (v, a, z) => clamp(+v, a, z)
    if (b.paypalEmail !== undefined && b.paypalEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.paypalEmail))) {
      return bad(res, 'Adresse PayPal invalide')
    }
    mutate(st => {
      const s = st.settings
      if (b.barmen !== undefined) s.barmen = Math.round(num(b.barmen, 1, 10))
      if (b.paceMinutes !== undefined) s.paceMinutes = +num(b.paceMinutes, 0.5, 15).toFixed(2)
      if (b.waitMargin !== undefined) s.waitMargin = Math.round(num(b.waitMargin, 0, 60))
      if (b.ordersOpen !== undefined) s.ordersOpen = !!b.ordersOpen
      if (b.pauseMinutes !== undefined) s.pauseUntil = +b.pauseMinutes > 0 ? Date.now() + num(b.pauseMinutes, 1, 120) * 60000 : null
      if (b.maxQueue !== undefined) s.maxQueue = Math.round(num(b.maxQueue, 1, 200))
      if (b.maxActivePerDevice !== undefined) s.maxActivePerDevice = Math.round(num(b.maxActivePerDevice, 1, 5))
      if (b.maxQty !== undefined) s.maxQty = Math.round(num(b.maxQty, 1, 5))
      if (b.donationAmount !== undefined) s.donationAmount = +num(b.donationAmount, 0.5, 100).toFixed(2)
      if (b.paypalEmail !== undefined) s.paypalEmail = String(b.paypalEmail).trim()
      if (b.requirePass !== undefined) s.requirePass = !!b.requirePass
      if (b.resetLearning) { s.learnedPace = null; s.learnedSamples = 0 }
    })
    res.json({ ok: true })
  })

  r.patch('/settings', requireAdmin, (req, res) => {
    const body = req.body || {}
    mutate(s => {
      if (body.partyName !== undefined && body.partyName.trim()) s.settings.partyName = body.partyName.trim()
      if (body.autoLink !== undefined) s.settings.autoLink = !!body.autoLink
    })
    res.json({ ok: true })
  })

  // ---- Borne invités (pilotée depuis l'iPad barman) -------------------------
  r.post('/kiosk/push', requireStaff, (req, res) => {
    const { type, text = '', seconds = 0, orderId } = req.body || {}
    if (type === 'message') {
      const t = String(text).trim().slice(0, 140)
      mutate(st => { st.settings.kioskMessage = t ? { text: t, until: +seconds > 0 ? Date.now() + +seconds * 1000 : null, at: Date.now() } : null })
      return res.json({ ok: true })
    }
    if (type === 'clear') {
      mutate(st => { st.settings.kioskMessage = null })
      kioskEvent({ type: 'clear' })
      return res.json({ ok: true })
    }
    if (type === 'qr' || type === 'call') {
      const o = db().orders.find(x => x.id === orderId)
      if (!o) return notFound(res, 'Commande introuvable')
      kioskEvent({ type, token: o.token, guestName: o.guestName, name: o.name, emoji: o.emoji, qty: o.qty })
      return res.json({ ok: true })
    }
    if (type === 'leaderboard') {
      kioskEvent({ type: 'leaderboard', seconds: clamp(+seconds || 20, 5, 120) })
      return res.json({ ok: true })
    }
    bad(res, 'Action inconnue')
  })

  // ---- Utilisateurs (admin) ----------------------------------------------
  r.get('/users', requireAdmin, (req, res) => {
    res.json(db().users.map(publicUser))
  })

  r.post('/users', requireAdmin, (req, res) => {
    const { name, role = 'barman', pin } = req.body || {}
    if (!name?.trim()) return bad(res, 'Le nom est requis')
    if (!/^\d{4,6}$/.test(String(pin || ''))) return bad(res, 'Le code PIN doit contenir 4 à 6 chiffres')
    if (!['admin', 'barman'].includes(role)) return bad(res, 'Rôle invalide')
    const u = mutate(s => {
      const it = { id: id(), name: name.trim(), role, pinHash: hashPin(pin), pinLen: String(pin).length, createdAt: Date.now() }
      s.users.push(it)
      return it
    })
    res.json(publicUser(u))
  })

  r.patch('/users/:id', requireAdmin, (req, res) => {
    const u = db().users.find(x => x.id === req.params.id)
    if (!u) return notFound(res)
    const body = req.body || {}
    const admins = db().users.filter(x => x.role === 'admin')
    if (body.role === 'barman' && u.role === 'admin' && admins.length <= 1) {
      return bad(res, 'Impossible : il faut au moins un administrateur')
    }
    if (body.pin !== undefined && !/^\d{4,6}$/.test(String(body.pin))) {
      return bad(res, 'Le code PIN doit contenir 4 à 6 chiffres')
    }
    mutate(() => {
      if (body.name !== undefined && body.name.trim()) u.name = body.name.trim()
      if (body.role !== undefined && ['admin', 'barman'].includes(body.role)) u.role = body.role
      if (body.pin !== undefined) { u.pinHash = hashPin(body.pin); u.pinLen = String(body.pin).length }
    })
    res.json(publicUser(u))
  })

  r.delete('/users/:id', requireAdmin, (req, res) => {
    const u = db().users.find(x => x.id === req.params.id)
    if (!u) return notFound(res)
    if (u.id === req.user.id) return bad(res, 'Impossible de supprimer son propre compte')
    if (u.role === 'admin' && db().users.filter(x => x.role === 'admin').length <= 1) {
      return bad(res, 'Impossible : il faut au moins un administrateur')
    }
    mutate(s => {
      s.users = s.users.filter(x => x.id !== req.params.id)
      for (const [token, sess] of Object.entries(s.sessions)) {
        if (sess.userId === req.params.id) delete s.sessions[token]
      }
    })
    res.json({ ok: true })
  })

  // ---- Liste de courses (admin) ---------------------------------------------
  // Partagée entre appareils : cocher sur un téléphone met à jour les autres.
  const shoppingChanged = res => {
    persist()
    io.to('staff').emit('shopping:changed')
    res.json(computeShopping(db()))
  }

  r.get('/shopping', requireAdmin, (req, res) => res.json(computeShopping(db())))

  r.patch('/shopping/settings', requireAdmin, (req, res) => {
    const b = req.body || {}
    const st = db().shopping.settings
    if (b.guests !== undefined) st.guests = Math.round(clamp(+b.guests || 1, 1, 1000))
    if (b.drinksPerGuest !== undefined) st.drinksPerGuest = clamp(Math.round((+b.drinksPerGuest || 0) * 2) / 2, 0, 15)
    if (b.margin !== undefined) st.margin = Math.round(clamp(+b.margin || 0, 0, 100))
    if (b.deductStock !== undefined) st.deductStock = !!b.deductStock
    shoppingChanged(res)
  })

  r.post('/shopping/line', requireAdmin, (req, res) => {
    const { key, checked, qty, reset } = req.body || {}
    if (!key || typeof key !== 'string' || key.length > 120) return bad(res, 'Ligne invalide')
    const sh = db().shopping
    if (checked !== undefined) { if (checked) sh.checked[key] = true; else delete sh.checked[key] }
    if (qty !== undefined) sh.overrides[key] = Math.round(clamp(+qty || 0, 0, 999))
    if (reset) delete sh.overrides[key]
    shoppingChanged(res)
  })

  r.post('/shopping/reset', requireAdmin, (req, res) => {
    const { checks = true, quantities = false } = req.body || {}
    const sh = db().shopping
    if (checks) sh.checked = {}
    if (quantities) sh.overrides = {}
    shoppingChanged(res)
  })

  // ---- Outils admin ---------------------------------------------------------
  r.get('/admin/export', requireAdmin, (req, res) => {
    const { sessions, ...rest } = db()
    res.setHeader('Content-Disposition', `attachment; filename=xoxo-party-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`)
    res.json({ ...rest, settings: { ...rest.settings, vapid: undefined } })
  })

  r.post('/admin/reset', requireAdmin, (req, res) => {
    const { orders = true, guests = true, restock = false, donations = false } = req.body || {}
    mutate(s => {
      if (orders) s.orders = []
      if (guests) { s.guests = []; s.pushSubs = {} }
      if (donations) s.donations = []
      if (restock) s.ingredients.forEach(i => { i.stock = i.initialStock })
    })
    res.json({ ok: true })
  })

  r.use((err, req, res, next) => {
    res.status(400).json({ error: err.message || 'Requête invalide' })
  })

  app.use('/api', r)
  return { broadcast, notify, kioskEvent }
}

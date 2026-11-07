import webpush from 'web-push'
import { db, persist } from './db.js'

// Notifications Web Push. Deux niveaux d'abonnement :
//  - order.subscriptions : le navigateur qui a scanné CE QR ;
//  - db().pushSubs[deviceId] : abonnement par appareil (l'app installée sur
//    iOS a un stockage séparé de Safari — les identités sont fusionnées via
//    les alias de fiche, et l'app reçoit les push des commandes scannées
//    dans Safari).

export function initPush(contact) {
  if (!db().settings.vapid) {
    db().settings.vapid = webpush.generateVAPIDKeys()
    persist()
  }
  const { publicKey, privateKey } = db().settings.vapid
  webpush.setVapidDetails(contact, publicKey, privateKey)
}

export function registerDeviceSub(deviceId, sub) {
  const store = db().pushSubs
  const list = store[deviceId] || []
  if (!list.some(s => s.endpoint === sub.endpoint)) {
    if (list.length >= 3) list.shift()
    list.push(sub)
    store[deviceId] = list
    persist()
  }
}

function findGuestByDevice(state, deviceId) {
  if (!deviceId) return null
  return state.guests.find(g => g.deviceId === deviceId || (g.altIds || []).includes(deviceId)) || null
}

// Toutes les souscriptions pertinentes pour une commande (dédupliquées).
function targetsForOrder(state, order) {
  const subs = [...(order.subscriptions || [])]
  const devices = new Set()
  if (order.deviceId) devices.add(order.deviceId)
  const g = findGuestByDevice(state, order.deviceId)
  if (g) {
    if (g.deviceId) devices.add(g.deviceId)
    for (const d of g.altIds || []) devices.add(d)
  }
  for (const d of devices) {
    for (const s of state.pushSubs[d] || []) subs.push(s)
  }
  const seen = new Set()
  return subs.filter(s => s?.endpoint && !seen.has(s.endpoint) && seen.add(s.endpoint))
}

export async function pushToOrder(order, payload) {
  const state = db()
  const targets = targetsForOrder(state, order)
  if (!targets.length) {
    console.log(`  🔔 push «${order.name}» : aucun abonnement (QR non scanné ou notifications non activées)`)
    return { sent: 0, failed: 0 }
  }
  const gone = new Set()
  let sent = 0
  await Promise.all(targets.map(async sub => {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
      sent++
    } catch (e) {
      if ([404, 410].includes(e.statusCode)) gone.add(sub.endpoint)
      else console.error(`  ⚠ push KO (${e.statusCode || e.message})`)
    }
  }))
  if (gone.size) {
    order.subscriptions = (order.subscriptions || []).filter(s => !gone.has(s.endpoint))
    for (const [d, list] of Object.entries(state.pushSubs)) {
      const kept = list.filter(s => !gone.has(s.endpoint))
      if (kept.length !== list.length) state.pushSubs[d] = kept
    }
    persist()
  }
  console.log(`  🔔 push «${order.name}» : ${sent}/${targets.length} envoyée(s)`)
  return { sent, failed: targets.length - sent }
}

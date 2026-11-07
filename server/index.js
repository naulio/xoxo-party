import express from 'express'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Server } from 'socket.io'
import qrcode from 'qrcode-terminal'
import { load, db, flushSync, ROOT, UPLOADS_DIR } from './db.js'
import { seed, migrate } from './seed.js'
import { authMw, userForToken } from './auth.js'
import { registerApi } from './api.js'
import { initPush } from './push.js'
import { publicState, staffState, trackPayload } from './derive.js'
import { computeQueue } from './queue.js'
import { pagesUrl, publishApiUrl, waitForPages, loadConfig } from './github.js'

const DEV = process.argv.includes('--dev')
const TUNNEL = process.argv.includes('--tunnel')
const PORT = +(process.env.PORT || 8787)

load(seed, migrate)
initPush(process.env.VAPID_SUBJECT || 'mailto:xoxo-party@users.noreply.github.com')

const app = express()
const server = http.createServer(app)
// Le site public est servi par GitHub Pages (autre origine) : CORS ouvert.
// Aucun cookie n'est utilisé (jeton Bearer), donc « * » est sans risque.
const io = new Server(server, { serveClient: false, cors: { origin: true } })

let publicUrl = null // URL https du tunnel Cloudflare quand le mode en ligne est actif
let pagesLive = false // GitHub Pages pointe bien sur ce serveur

function lanUrls() {
  const urls = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${PORT}`)
    }
  }
  return urls
}

const withSlash = u => (u.endsWith('/') ? u : u + '/')

const meta = () => {
  const urls = [`http://localhost:${PORT}`, ...lanUrls()]
  const pages = pagesUrl()
  // Adresse à mettre dans les QR codes : le lien fixe GitHub dès que le
  // tunnel tourne, sinon l'adresse locale (Wi-Fi de la soirée).
  const appUrl = withSlash(publicUrl && pages ? pages : publicUrl || urls[1] || urls[0])
  return {
    urls, publicUrl, tunnel: !!publicUrl, pagesUrl: pages, pagesLive, appUrl,
    best: appUrl, dev: DEV,
    kiosks: io.sockets.adapter.rooms.get('kiosk')?.size || 0,
  }
}

app.disable('x-powered-by')
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json({ limit: '2mb' }))
app.use(authMw)
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }))

const { broadcast } = registerApi(app, io, meta)

io.use((socket, next) => {
  socket.user = userForToken(socket.handshake.auth?.token)
  next()
})

io.on('connection', socket => {
  if (socket.user) socket.join('staff')
  socket.emit('public:state', publicState(db()))
  if (socket.user) socket.emit('staff:state', staffState(db(), meta()))
  // Suivi d'une commande : la page #/c/<token> rejoint sa room dédiée.
  socket.on('track', token => {
    const o = db().orders.find(x => x.token === token)
    if (!o) return socket.emit('order:update', { deleted: true, token })
    socket.join('track:' + token)
    socket.emit('order:update', trackPayload(db(), o))
  })
  // Borne invités (iPad fixe) : réservée à un appareil connecté en staff.
  socket.on('kiosk:join', () => {
    if (!socket.user) return
    socket.join('kiosk')
    broadcast()
  })
  socket.on('disconnecting', () => {
    if (socket.rooms.has('kiosk')) setTimeout(broadcast, 100)
  })
})

// Les estimations « dans ~X min » vieillissent avec le temps : tant qu'il y a
// des commandes en cours (ou une pause), on rediffuse toutes les 20 s.
setInterval(() => {
  const q = computeQueue(db())
  if (q.pendingCount || q.preparingCount || q.paused || db().settings.kioskMessage) broadcast()
}, 20000)

if (DEV) {
  const { createServer: createVite } = await import('vite')
  const vite = await createVite({
    root: ROOT,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { port: PORT + 1 } },
  })
  app.use(vite.middlewares)
} else {
  const dist = path.join(ROOT, 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('\n⚠  Le dossier "dist" est introuvable. Lance d\'abord :  npm run build\n')
    process.exit(1)
  }
  app.use(express.static(dist, { maxAge: '1h', index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    // Anciennes adresses (/bar, /c/<token>…) → routage par ancre (#/bar).
    if (req.path !== '/' && !path.extname(req.path)) return res.redirect(302, '/#' + req.originalUrl)
    res.sendFile(path.join(dist, 'index.html'))
  })
}

function printQr(url) {
  qrcode.generate(url, { small: true }, code => console.log(code.replace(/^/gm, '  ')))
}

// ---- Lien fixe GitHub Pages ----------------------------------------------
async function announceOnGithub(url) {
  const pages = pagesUrl()
  if (!pages) return
  pagesLive = false
  console.log('  🐙 Mise à jour du lien fixe GitHub…')
  const r = await publishApiUrl(url)
  if (r.error) {
    console.error(`  ⚠  Lien fixe non mis à jour : ${r.error}`)
    console.error(`     Le site reste joignable directement via ${url}`)
    return
  }
  console.log('  ⏳ GitHub Pages se redéploie (20-90 s)…')
  const ok = await waitForPages(url)
  if (url !== publicUrl) return // le tunnel a changé entre-temps
  pagesLive = ok
  broadcast()
  if (ok) {
    console.log(`\n  ✅ LIEN FIXE PRÊT — à imprimer, il ne change jamais :\n\n     ${pages}\n`)
    printQr(pages)
    console.log(`  🖥  Borne iPad      : ${pages}#/borne`)
    console.log(`  🏆 Écran donateurs : ${pages}#/ecran`)
    console.log(`  🍸 iPad barmans    : ${pages}#/bar\n`)
  } else {
    console.error('  ⚠  GitHub Pages tarde à se mettre à jour — les invités verront « connexion au bar » quelques instants.')
  }
}

// ---- Tunnel Internet auto-réparant --------------------------------------
// L'URL n'est annoncée qu'après vérification réelle depuis Internet, et le
// tunnel est relancé automatiquement s'il tombe (nouvelle URL republiée sur
// GitHub : le lien fixe suit tout seul).
const TUNNEL_MAX_STARTS = 4
let tunnelStarts = 0
let tunnelStopping = false
let currentTunnelChild = null
let cfBinPath = null

process.on('exit', () => {
  tunnelStopping = true
  try { currentTunnelChild?.kill() } catch { /* déjà terminé */ }
})

async function cloudflaredBin() {
  if (cfBinPath) return cfBinPath
  let bin = 'cloudflared'
  try {
    const cf = await import('cloudflared')
    const cfBin = cf.bin || cf.default?.bin
    const cfInstall = cf.install || cf.default?.install
    if (cfBin) {
      if (!fs.existsSync(cfBin) && cfInstall) {
        console.log('  ⏳ Premier lancement : téléchargement de cloudflared…')
        await cfInstall(cfBin)
      }
      bin = cfBin
    }
  } catch { /* paquet absent : on tente le binaire système */ }
  cfBinPath = bin
  return bin
}

// La propagation DNS d'une nouvelle URL trycloudflare prend 10 à 60 s :
// on sonde l'adresse publique jusqu'à ce qu'elle réponde vraiment.
async function checkPublicUrl(url, tries = 16) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${url}/api/ping`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return true
    } catch { /* pas encore joignable */ }
    await new Promise(r => setTimeout(r, 5000))
  }
  return false
}

async function startTunnel() {
  if (tunnelStopping) return
  tunnelStarts++
  if (tunnelStarts > TUNNEL_MAX_STARTS) {
    console.error(`
  ❌ Le tunnel n'arrive pas à se stabiliser après ${TUNNEL_MAX_STARTS} tentatives.
     - Vérifie la connexion Internet de ce PC
     - Certains réseaux (entreprise, école) bloquent les tunnels : essaie un partage de connexion 4G
     - L'application reste utilisable en Wi-Fi local : ${meta().urls[1] || meta().urls[0]}
`)
    return
  }
  console.log(`\n  🌐 Ouverture du tunnel Internet (Cloudflare)…${tunnelStarts > 1 ? ` (tentative ${tunnelStarts}/${TUNNEL_MAX_STARTS})` : ''}`)
  const bin = await cloudflaredBin()
  const child = spawn(bin, ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  currentTunnelChild = child
  let url = null

  const onData = async buf => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (!m || url) return
    url = m[0]
    console.log(`  🔗 Adresse du tunnel : ${url}`)
    console.log('  ⏳ Vérification de l\'accès depuis Internet (10-60 s, propagation DNS)…')
    const ok = await checkPublicUrl(url)
    if (child.exitCode !== null) return // le tunnel est déjà retombé, la relance est en cours
    if (ok) {
      tunnelStarts = 0
      publicUrl = url
      console.log('  ✅ Tunnel vérifié depuis Internet.')
      broadcast()
      if (pagesUrl()) {
        announceOnGithub(url)
      } else {
        console.log(`\n  ✅ EN LIGNE — accessible partout (4G/5G) :\n\n     ${publicUrl}\n`)
        printQr(publicUrl)
        console.log('  ℹ  Sans lien fixe GitHub configuré (xoxo.config.json), cette adresse change à chaque redémarrage.\n')
      }
    } else {
      console.error('  ⚠  Cette adresse ne répond pas depuis Internet — on retente avec un nouveau tunnel…')
      try { child.kill() } catch { /* déjà terminé */ }
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('error', () => {
    console.error('  ⚠  Impossible de lancer cloudflared. Réinstalle les dépendances (npm install) ou installe-le :')
    console.error('     winget install Cloudflare.cloudflared\n')
  })
  child.on('exit', () => {
    const wasOnline = !!publicUrl
    if (publicUrl) { publicUrl = null; pagesLive = false; broadcast() }
    if (tunnelStopping) return
    if (wasOnline) console.error('  ⚠  Le tunnel s\'est interrompu — relance automatique dans 3 s (le lien fixe suivra)…')
    setTimeout(startTunnel, 3000)
  })
}

server.listen(PORT, '0.0.0.0', () => {
  const urls = meta().urls
  const lan = urls[1]
  const cfg = loadConfig()
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   💋  X O X O   P A R T Y   —   Projet XX    ║
  ╚══════════════════════════════════════════════╝

  Soirée        : ${db().settings.partyName}
  Mode          : ${DEV ? 'développement (HMR)' : 'production'}${TUNNEL ? ' + tunnel Internet' : ''}
  Sur ce PC     : ${urls[0]}
  Sur le réseau : ${lan || '(aucune interface réseau détectée)'}
  Lien fixe     : ${cfg.pagesUrl || '(non configuré — voir README)'}

  🔑 Accès staff : bouton "Staff" sur la carte — PIN gérés dans Admin → Utilisateurs.
  🔔 Lien fixe + notifications push : mode en ligne (start-en-ligne.bat).
`)
  if (!TUNNEL && lan) {
    console.log('  Scanne pour ouvrir la carte sur un téléphone (même Wi-Fi) :\n')
    printQr(lan)
  }
  if (TUNNEL) startTunnel()
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠  Le port ${PORT} est déjà utilisé : une autre fenêtre XOXO tourne sûrement déjà.`)
    console.error('   Ferme-la (ou relance start-en-ligne.bat, qui nettoie les anciennes instances).\n')
    process.exit(1)
  }
  throw err
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { flushSync(); process.exit(0) })
}

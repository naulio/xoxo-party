import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT } from './db.js'

// Lien fixe GitHub Pages : le site (statique) vit sur https://<user>.github.io/<repo>/
// et retrouve le serveur grâce au fichier api.json de la branche gh-pages.
// À chaque nouvelle adresse de tunnel, le serveur met ce fichier à jour via
// l'API GitHub (jeton : variable GITHUB_TOKEN, sinon `gh auth token`).

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'xoxo.config.json'), 'utf8'))
  } catch {
    return {}
  }
}

export function pagesUrl() {
  const u = loadConfig().pagesUrl
  return u ? (u.endsWith('/') ? u : u + '/') : null
}

export function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  try {
    const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8', timeout: 15000, windowsHide: true })
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim()
  } catch { /* gh absent */ }
  return null
}

const ghHeaders = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'xoxo-party-server',
})

export async function publishApiUrl(apiUrl) {
  const cfg = loadConfig()
  if (!cfg.pagesRepo) return { skipped: true }
  const token = githubToken()
  if (!token) return { error: 'aucun jeton GitHub (lance `gh auth login` une fois)' }
  const branch = cfg.pagesBranch || 'gh-pages'
  const url = `https://api.github.com/repos/${cfg.pagesRepo}/contents/api.json`
  const headers = ghHeaders(token)
  try {
    let sha
    const cur = await fetch(`${url}?ref=${branch}`, { headers, signal: AbortSignal.timeout(15000) })
    if (cur.ok) sha = (await cur.json()).sha
    const content = Buffer.from(JSON.stringify({ api: apiUrl, updatedAt: new Date().toISOString() }, null, 2) + '\n').toString('base64')
    const put = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `api.json → ${apiUrl || 'hors ligne'}`, content, branch, ...(sha && { sha }) }),
      signal: AbortSignal.timeout(20000),
    })
    if (!put.ok) return { error: `GitHub a répondu ${put.status}` }
    return { ok: true }
  } catch (e) {
    return { error: e.message }
  }
}

// GitHub Pages met 20 à 90 s à redéployer : on attend que le site public
// serve bien la nouvelle adresse avant d'annoncer « prêt ».
export async function waitForPages(apiUrl, tries = 40) {
  const base = pagesUrl()
  if (!base) return false
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${base}api.json?t=${Date.now()}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
      if (r.ok && (await r.json()).api === apiUrl) return true
    } catch { /* pas encore déployé */ }
    await new Promise(res => setTimeout(res, 5000))
  }
  return false
}

// Publie le site sur GitHub Pages (branche gh-pages) — lien fixe de la soirée.
// Usage : npm run deploy   (nécessite `gh auth login` fait une fois)
//
// Le fichier api.json déjà en ligne (adresse du serveur du moment) est
// conservé : le site redéployé retrouve immédiatement le bar.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'xoxo.config.json'), 'utf8'))
const repo = cfg.pagesRepo
const branch = cfg.pagesBranch || 'gh-pages'
if (!repo) throw new Error('pagesRepo manquant dans xoxo.config.json')

// npm est un script .cmd sous Windows (shell requis) ; git et gh sont des
// exécutables : sans shell, les arguments (messages, espaces) restent intacts.
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: cmd === 'npm' && process.platform === 'win32', ...opts })
  if (r.status !== 0) throw new Error(`Échec : ${cmd} ${args[0]}`)
  return r
}
const out = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' }).stdout?.trim()

const token = process.env.GITHUB_TOKEN || out('gh', ['auth', 'token'])
if (!token) throw new Error('Pas de jeton GitHub : lance `gh auth login` une fois.')
const gh = async (method, url, body) => {
  const r = await fetch(`https://api.github.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'xoxo-party-deploy' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

console.log('\n  🏗  Construction du site (mode GitHub Pages)…')
run('npm', ['run', 'build:pages'], { cwd: ROOT })

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xoxo-pages-'))
fs.cpSync(path.join(ROOT, 'dist-pages'), tmp, { recursive: true })
fs.writeFileSync(path.join(tmp, '.nojekyll'), '')

// Conserver l'adresse du serveur actuellement publiée.
const cur = await gh('GET', `/repos/${repo}/contents/api.json?ref=${branch}`)
const apiJson = cur.status === 200
  ? Buffer.from(cur.json.content, 'base64').toString('utf8')
  : JSON.stringify({ api: null, updatedAt: new Date().toISOString() }, null, 2) + '\n'
fs.writeFileSync(path.join(tmp, 'api.json'), apiJson)

const me = (await gh('GET', '/user')).json
const name = me.login || 'xoxo-party'
const email = me.id ? `${me.id}+${me.login}@users.noreply.github.com` : 'xoxo-party@users.noreply.github.com'

console.log(`  🚀 Publication sur ${repo} (${branch})…`)
const git = args => run('git', ['-c', `user.name=${name}`, '-c', `user.email=${email}`, ...args], { cwd: tmp })
git(['init', '-q', '-b', branch])
git(['add', '-A'])
git(['commit', '-q', '-m', `Déploiement du site XOXO PARTY (${new Date().toISOString().slice(0, 16).replace('T', ' ')})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`])
git(['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '-q', '--force', `https://github.com/${repo}.git`, `${branch}:${branch}`])

// Active GitHub Pages sur la branche (sans effet si c'est déjà fait).
const pages = await gh('GET', `/repos/${repo}/pages`)
if (pages.status === 404) {
  const r = await gh('POST', `/repos/${repo}/pages`, { source: { branch, path: '/' } })
  console.log(r.status < 300 ? '  ✅ GitHub Pages activé.' : `  ⚠  Activation de Pages : ${r.status} ${r.json.message || ''}`)
}

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n  ✅ Site publié — en ligne d'ici 1 à 2 minutes :\n\n     ${cfg.pagesUrl}\n`)

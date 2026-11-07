import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = path.join(ROOT, 'data')
export const UPLOADS_DIR = path.join(ROOT, 'uploads')
const FILE = path.join(DATA_DIR, 'db.json')

export const id = () => crypto.randomBytes(6).toString('base64url')

let state = null
let timer = null

export function db() {
  return state
}

export function load(seedFn, migrateFn) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  if (fs.existsSync(FILE)) {
    state = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } else {
    state = seedFn()
  }
  migrateFn?.(state)
  persistNow()
  return state
}

export function persist() {
  clearTimeout(timer)
  timer = setTimeout(persistNow, 250)
}

function persistNow() {
  if (!state) return
  const tmp = FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1))
  fs.renameSync(tmp, FILE)
}

export function flushSync() {
  clearTimeout(timer)
  try { persistNow() } catch { /* disque indisponible : on garde l'état en mémoire */ }
}

process.on('exit', flushSync)

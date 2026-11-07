import crypto from 'node:crypto'
import { db, persist } from './db.js'

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex')
}

export function checkPin(pin, hash) {
  try {
    const [salt, h] = hash.split(':')
    const a = crypto.scryptSync(String(pin), salt, 32)
    const b = Buffer.from(h, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function createSession(userId) {
  const token = crypto.randomBytes(24).toString('base64url')
  db().sessions[token] = { userId, at: Date.now() }
  persist()
  return token
}

export function destroySession(token) {
  if (token && db().sessions[token]) {
    delete db().sessions[token]
    persist()
  }
}

export function userForToken(token) {
  const s = token && db().sessions[token]
  if (!s) return null
  return db().users.find(u => u.id === s.userId) || null
}

export function authMw(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  req.token = token
  req.user = userForToken(token)
  next()
}

export function requireStaff(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' })
  next()
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé aux administrateurs' })
  next()
}

export const publicUser = u => u && { id: u.id, name: u.name, role: u.role, pinLen: u.pinLen || 4 }

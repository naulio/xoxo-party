import crypto from 'node:crypto'

// « Passes » de commande : la borne affiche un QR (et un code à 4 chiffres)
// qui change toutes les minutes. Le scanner prouve qu'on est physiquement au
// bar — le site étant public, c'est ce qui empêche de commander de chez soi.
// Un pass de borne s'échange contre un pass personnel (lié au téléphone,
// valable 10 min, à usage unique) le temps de choisir son cocktail.
// Stockage en mémoire : un redémarrage du serveur invalide tout, c'est voulu.

const passes = new Map() // pass -> { exp, code, cocktailId, kioskId, deviceId, personal }
const codes = new Map()  // code -> pass

export const KIOSK_TTL = 4 * 60 * 1000
export const PERSONAL_TTL = 10 * 60 * 1000

function cleanup() {
  const now = Date.now()
  for (const [k, v] of passes) {
    if (v.exp < now) {
      passes.delete(k)
      if (v.code && codes.get(v.code) === k) codes.delete(v.code)
    }
  }
}

export function issuePass({ cocktailId = null, kioskId = null, deviceId = null, personal = false } = {}) {
  cleanup()
  const pass = crypto.randomBytes(12).toString('base64url')
  let code = null
  if (!personal) {
    do { code = String(crypto.randomInt(1000, 10000)) } while (codes.has(code))
    codes.set(code, pass)
  }
  const exp = Date.now() + (personal ? PERSONAL_TTL : KIOSK_TTL)
  passes.set(pass, { exp, code, cocktailId, kioskId, deviceId, personal })
  return { pass, code, exp, cocktailId }
}

export function checkPass(pass) {
  const p = pass && passes.get(pass)
  if (!p || p.exp < Date.now()) return null
  return p
}

export function passFromCode(code) {
  const pass = codes.get(String(code || '').trim())
  const p = pass && checkPass(pass)
  return p ? { pass, ...p } : null
}

export function consumePass(pass) {
  const p = passes.get(pass)
  if (p?.personal) passes.delete(pass)
}

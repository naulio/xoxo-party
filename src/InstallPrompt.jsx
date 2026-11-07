import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Share, SquarePlus, BellRing, X } from 'lucide-react'

/* Invitation « Ajouter à l'écran d'accueil », affichée une seule fois au
   premier scan :
   - iOS : indispensable pour recevoir les notifications push (Apple ne les
     autorise qu'aux web-apps installées) → guide pas-à-pas style iOS.
   - Android : les notifs marchent déjà dans Chrome ; on ne propose la pop-up
     (style Material) que si le navigateur offre l'installation native.
   Préviste possible via ?a2hs=ios ou ?a2hs=android. */

let deferredInstall = null
const bipListeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredInstall = e
    // L'événement arrive souvent APRÈS le montage de la page : on prévient
    // les composants à l'écoute pour afficher la pop-up dès qu'il est là.
    bipListeners.forEach(fn => fn())
  })
}

const SEEN_KEY = 'xoxo_a2hs_seen'
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isAndroid = /android/i.test(navigator.userAgent)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

export default function InstallPrompt({ active }) {
  const [show, setShow] = useState(null) // null | 'ios' | 'android'

  useEffect(() => {
    const force = new URLSearchParams(window.location.search).get('a2hs')
    if (force === 'ios' || force === 'android') {
      setShow(force)
      return
    }
    if (!active || isStandalone() || localStorage.getItem(SEEN_KEY)) return
    const tryAndroid = () => {
      if (isAndroid && deferredInstall && !localStorage.getItem(SEEN_KEY)) setShow('android')
    }
    const t = setTimeout(() => {
      if (isIOS) setShow('ios')
      else tryAndroid()
    }, 1100)
    bipListeners.add(tryAndroid)
    return () => { clearTimeout(t); bipListeners.delete(tryAndroid) }
  }, [active])

  const close = () => {
    localStorage.setItem(SEEN_KEY, '1')
    setShow(null)
  }

  const install = async () => {
    try {
      if (deferredInstall) {
        deferredInstall.prompt()
        await deferredInstall.userChoice
        deferredInstall = null
      }
    } catch { /* refusé ou indisponible */ }
    close()
  }

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          <motion.div className="backdrop" style={{ zIndex: 94 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <div className="a2hs-wrap" onClick={e => e.target === e.currentTarget && close()}>
            <motion.div
              className={`a2hs ${show}`}
              initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              {show === 'ios' ? (
                <>
                  <div className="grabber" style={{ margin: '10px auto 2px' }} />
                  <div className="row" style={{ padding: '10px 20px 0', gap: 12 }}>
                    <img src="./icon-192.png" alt="" width="46" height="46" style={{ borderRadius: 11 }} onError={e => { e.currentTarget.src = './icon.svg' }} />
                    <div className="grow">
                      <b style={{ fontSize: 16.5 }}>Ajoute XOXO à l'écran d'accueil</b>
                      <p className="small" style={{ color: 'rgba(235,235,245,.6)' }}>
                        Indispensable sur iPhone pour être prévenu quand ton cocktail est prêt — même téléphone verrouillé.
                      </p>
                    </div>
                    <button className="btn ghost icon sm" onClick={close} aria-label="Fermer"><X size={16} /></button>
                  </div>
                  <div className="a2hs-steps">
                    <div className="a2hs-step">
                      <span className="a2hs-ico"><Share size={17} /></span>
                      <span>Appuie sur <b>Partager</b> dans la barre de Safari</span>
                    </div>
                    <div className="a2hs-step">
                      <span className="a2hs-ico"><SquarePlus size={17} /></span>
                      <span>Choisis <b>« Sur l'écran d'accueil »</b></span>
                    </div>
                    <div className="a2hs-step">
                      <span className="a2hs-ico"><BellRing size={17} /></span>
                      <span>Rouvre depuis l'icône <b>XOXO</b> et active les notifications</span>
                    </div>
                  </div>
                  <div className="col" style={{ padding: '4px 20px calc(18px + env(safe-area-inset-bottom))', gap: 8 }}>
                    <button className="a2hs-ios-btn" onClick={close}>Compris !</button>
                    <button className="a2hs-ios-plain" onClick={close}>Plus tard</button>
                    <span className="tiny" style={{ color: 'rgba(235,235,245,.35)', textAlign: 'center' }}>Safari · iOS 16.4 ou plus récent</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="row" style={{ padding: '20px 22px 0', gap: 14 }}>
                    <img src="./icon-192.png" alt="" width="48" height="48" style={{ borderRadius: 24 }} onError={e => { e.currentTarget.src = './icon.svg' }} />
                    <div className="grow">
                      <b style={{ fontSize: 16.5 }}>Installer XOXO PARTY ?</b>
                      <p className="small" style={{ color: 'var(--text2)', marginTop: 2 }}>
                        Suivi de ta commande en un tap depuis l'écran d'accueil, et notifications encore plus fiables.
                      </p>
                    </div>
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end', padding: '16px 18px calc(16px + env(safe-area-inset-bottom))', gap: 6 }}>
                    <button className="a2hs-and-text" onClick={close}>Non merci</button>
                    <button className="a2hs-and-fill" onClick={install}>Installer</button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

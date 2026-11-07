import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, CameraOff } from 'lucide-react'
import jsQR from 'jsqr'
import { ScanPrompt } from './Order.jsx'

/* Scanner intégré : indispensable dans l'app installée sur iPhone (l'appareil
   photo du téléphone ouvrirait Safari, pas l'app). Lit le QR de la borne ou
   d'une commande, puis navigue sans quitter l'app. */

// Extrait la route interne (#/commander?p=…, #/c/<token>) d'un QR XOXO.
export function routeFromQr(text) {
  try {
    const u = new URL(text)
    const h = u.hash.replace(/^#/, '')
    if (h.startsWith('/commander') || h.startsWith('/c/')) return h
    // Anciennes adresses sans ancre (servies par le PC) : /c/<token>
    if (u.pathname.includes('/c/')) return u.pathname.slice(u.pathname.indexOf('/c/'))
  } catch { /* pas une URL */ }
  return null
}

export default function Scan() {
  const nav = useNavigate()
  const video = useRef(null)
  const canvas = useRef(null)
  const [state, setState] = useState('starting') // starting | scanning | denied | unsupported
  const [hint, setHint] = useState('')

  useEffect(() => {
    let stream = null
    let timer = null
    let stopped = false
    const stop = () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unsupported')
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return stop()
        const v = video.current
        v.srcObject = stream
        v.setAttribute('playsinline', '')
        await v.play()
        setState('scanning')
        const ctx = canvas.current.getContext('2d', { willReadFrequently: true })
        timer = setInterval(() => {
          if (!v.videoWidth) return
          const w = 480
          const h = Math.round((v.videoHeight / v.videoWidth) * w)
          canvas.current.width = w
          canvas.current.height = h
          ctx.drawImage(v, 0, 0, w, h)
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
          if (!code?.data) return
          const route = routeFromQr(code.data)
          if (route) {
            try { navigator.vibrate?.(60) } catch { /* non supporté */ }
            stop()
            nav(route, { replace: true })
          } else {
            setHint('Ce QR n\'est pas celui de la borne XOXO')
          }
        }, 220)
      } catch {
        setState('denied')
      }
    })()
    return stop
  }, [nav])

  return (
    <div className="order-page">
      <header className="pub-top">
        <Link to="/commander" className="btn ghost sm"><ChevronLeft size={16} /> Retour</Link>
        <span className="tiny muted">Scanner la borne</span>
      </header>

      {(state === 'starting' || state === 'scanning') && (
        <div className="scanner">
          <video ref={video} muted playsInline />
          <div className="scan-frame"><span /></div>
          <p className="scan-hint">{hint || (state === 'starting' ? 'Ouverture de la caméra…' : 'Vise le QR affiché sur la borne du bar')}</p>
        </div>
      )}
      {(state === 'denied' || state === 'unsupported') && (
        <div className="card pad row" style={{ gap: 12 }}>
          <CameraOff size={22} style={{ color: 'var(--orange)', flexShrink: 0 }} />
          <p className="small muted">
            {state === 'denied'
              ? 'Caméra refusée. Autorise-la dans les réglages du téléphone, ou entre le code à 4 chiffres affiché sous le QR de la borne.'
              : 'Ton navigateur ne permet pas le scan ici : entre le code à 4 chiffres affiché sous le QR de la borne.'}
          </p>
        </div>
      )}
      <canvas ref={canvas} hidden />

      <ScanPrompt noScan title="Pas de caméra sous la main ?" onPass={() => nav('/commander', { replace: true })} />
    </div>
  )
}

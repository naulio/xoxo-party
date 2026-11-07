import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Delete, ChevronLeft, Martini } from 'lucide-react'
import { useApp, login } from '../store.js'
import { apiUrl } from '../net.js'
import { cls } from '../ui.jsx'

export default function Login() {
  const nav = useNavigate()
  const { me, booted } = useApp()
  const [users, setUsers] = useState(null)
  const [sel, setSel] = useState(null)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/api/auth/logins')).then(r => r.json()).then(setUsers).catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    if (booted && me) nav(me.role === 'admin' ? '/admin' : '/bar', { replace: true })
  }, [booted, me, nav])

  const submit = async code => {
    if (busy) return
    setBusy(true)
    try {
      const user = await login(sel.id, code)
      nav(user.role === 'admin' ? '/admin' : '/bar', { replace: true })
    } catch {
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
    } finally {
      setBusy(false)
    }
  }

  const pinLen = sel?.pinLen || 4

  const press = d => {
    if (pin.length >= pinLen) return
    const next = pin + d
    setPin(next)
    if (next.length === pinLen) submit(next)
  }

  return (
    <div className="login-page">
      <div className={cls('login-card card glass fade-up', shake && 'shake')}>
        <div className="col center" style={{ alignItems: 'center', gap: 6 }}>
          <Martini size={26} style={{ color: 'var(--violet)' }} />
          <h2 className="grad-text" style={{ fontSize: 26 }}>XOXO PARTY</h2>
          <p className="muted small">{sel ? `Bonsoir ${sel.name} — ton code PIN` : 'Accès staff — qui es-tu ?'}</p>
        </div>

        {!sel ? (
          <>
            <div className="login-users">
              {users === null && [1, 2].map(i => <div key={i} className="skel" style={{ height: 108 }} />)}
              {users?.map(u => (
                <button key={u.id} className="login-user" onClick={() => { setSel(u); setPin('') }}>
                  <span className="avatar">{u.name[0]?.toUpperCase()}</span>
                  <span className="bold" style={{ fontSize: 14.5 }}>{u.name}</span>
                  <span className={cls('badge', u.role === 'admin' ? 'violet' : 'blue')} style={{ height: 22 }}>
                    {u.role === 'admin' ? 'Admin' : 'Barman'}
                  </span>
                </button>
              ))}
              {users?.length === 0 && <p className="muted small" style={{ gridColumn: '1/-1', textAlign: 'center' }}>Aucun compte trouvé.</p>}
            </div>
            <Link to="/" className="btn ghost sm"><ChevronLeft size={15} /> Retour à la carte</Link>
          </>
        ) : (
          <>
            <div className="pin-dots">
              {Array.from({ length: pinLen }, (_, i) => <span key={i} className={cls('pd', pin.length > i && 'on')} />)}
            </div>
            <div className="pinpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <button key={d} onClick={() => press(String(d))} disabled={busy}>{d}</button>
              ))}
              <button onClick={() => { setSel(null); setPin('') }} style={{ fontSize: 13, color: 'var(--text2)' }}>Retour</button>
              <button onClick={() => press('0')} disabled={busy}>0</button>
              <button onClick={() => setPin(pin.slice(0, -1))} aria-label="Effacer"><Delete size={20} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

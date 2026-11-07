import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './store.js'
import { Orbs, Splash, ToastHost } from './ui.jsx'
import Public from './pages/Public.jsx'
import Login from './pages/Login.jsx'
import Track from './pages/Track.jsx'
import Order from './pages/Order.jsx'
import Scan from './pages/Scan.jsx'
import Me from './pages/Me.jsx'
import Kiosk from './pages/Kiosk.jsx'
import Screen from './pages/Screen.jsx'
import Bar from './pages/bar/Bar.jsx'
import Admin from './pages/admin/Admin.jsx'

function Guard({ admin, children }) {
  const { me } = useApp()
  if (!me) return <Navigate to="/login" replace />
  if (admin && me.role !== 'admin') return <Navigate to="/bar" replace />
  return children
}

// Lien fixe actif mais serveur pas encore joignable (PC éteint, démarrage…).
function Waiting() {
  return (
    <div className="waiting-page">
      <div className="logo-mark grad-text" style={{ fontSize: 44 }}>XOXO</div>
      <h2 style={{ fontSize: 22 }}>Le bar se prépare…</h2>
      <p className="muted small" style={{ maxWidth: 320, textAlign: 'center' }}>
        Connexion au bar en cours. Cette page se rafraîchit toute seule dès que le comptoir ouvre 🍸
      </p>
      <span className="dot pulse" style={{ background: 'var(--violet)', width: 10, height: 10 }} />
    </div>
  )
}

export default function App() {
  const { booted, conn } = useApp()
  return (
    <HashRouter>
      <Orbs />
      <ToastHost />
      {!booted ? (
        conn === 'searching' ? <Waiting /> : <Splash />
      ) : (
        <Routes>
          <Route path="/" element={<Public />} />
          <Route path="/login" element={<Login />} />
          <Route path="/c/:token" element={<Track />} />
          <Route path="/commander" element={<Order />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/moi" element={<Me />} />
          <Route path="/ecran" element={<Screen />} />
          <Route path="/borne" element={<Guard><Kiosk /></Guard>} />
          <Route path="/bar/*" element={<Guard><Bar /></Guard>} />
          <Route path="/admin/*" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </HashRouter>
  )
}

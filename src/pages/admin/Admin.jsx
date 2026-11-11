import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom'
import { LayoutDashboard, Martini, Boxes, Users, Settings, LogOut, Eye, ClipboardList, ShoppingCart } from 'lucide-react'
import { logout } from '../../store.js'
import { ConnDot, cls } from '../../ui.jsx'
import Dashboard from './Dashboard.jsx'
import Cocktails from './Cocktails.jsx'
import Ingredients from './Ingredients.jsx'
import UsersPage from './Users.jsx'
import SettingsPage from './Settings.jsx'
import Courses from './Courses.jsx'

const LINKS = [
  { to: '/admin', end: true, label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/admin/cocktails', label: 'Cocktails', icon: Martini },
  { to: '/admin/ingredients', label: 'Ingrédients', icon: Boxes },
  { to: '/admin/courses', label: 'Courses', icon: ShoppingCart },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
  { to: '/admin/reglages', label: 'Réglages', icon: Settings },
]

export default function Admin() {
  return (
    <div className="admin-shell">
      <aside className="admin-side glass">
        <div className="brand">
          <div className="logo-mark grad-text">XOXO</div>
          <div className="tiny faint" style={{ marginTop: 2 }}>Administration</div>
        </div>
        {LINKS.map(l => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cls('side-link', isActive && 'active')}>
            <l.icon size={18} /> <span>{l.label}</span>
          </NavLink>
        ))}
        <div className="grow side-spacer" />
        <div className="side-extra col" style={{ gap: 4 }}>
          <Link to="/bar" className="side-link"><ClipboardList size={18} /> Ouvrir le bar</Link>
          <Link to="/" className="side-link"><Eye size={18} /> Carte invités</Link>
          <button className="side-link" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }} onClick={logout}>
            <LogOut size={18} /> Déconnexion
          </button>
          <div style={{ padding: '8px 12px 0' }}><ConnDot /></div>
        </div>
      </aside>
      <main className="admin-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="cocktails" element={<Cocktails />} />
          <Route path="ingredients" element={<Ingredients />} />
          <Route path="courses" element={<Courses />} />
          <Route path="utilisateurs" element={<UsersPage />} />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}

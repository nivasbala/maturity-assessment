import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import DarkModeToggle from './DarkModeToggle'

export default function NavBar() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await clearAuth()
    navigate('/login')
  }

  if (!user) return null

  const isAdmin = user.role === 'admin'

  return (
    <nav className="bg-[#1B2B4B] text-white w-56 min-h-screen flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <NavLink
          to="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="28" height="18" rx="2" stroke="#3B82F6" strokeWidth="1.8"/>
            <polyline points="6,14 10,14 12,8 16,20 19,10 22,14 26,14" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="13" y1="23" x2="19" y2="23" stroke="#3B82F6" strokeWidth="1.8"/>
            <line x1="16" y1="23" x2="16" y2="28" stroke="#3B82F6" strokeWidth="1.8"/>
            <line x1="11" y1="28" x2="21" y2="28" stroke="#3B82F6" strokeWidth="1.8"/>
          </svg>
          <span className="text-white font-semibold text-sm tracking-tight leading-tight">
            Observability<br />Maturity<br />Assessment
          </span>
        </NavLink>
      </div>

      {/* Nav items */}
      <div className="flex-1 px-3 py-4 space-y-0.5">
        {isAdmin ? (
          <>
            <NavLink to="/admin/users" className={sideNavLinkClass}>
              <IconUsers /> Users
            </NavLink>
            <NavLink to="/admin/pillars" className={sideNavLinkClass}>
              <IconPillars /> Pillars
            </NavLink>
            <NavLink to="/dashboard" className={sideNavLinkClass}>
              <IconAccounts /> Accounts
            </NavLink>
            <NavLink to="/admin/settings" className={sideNavLinkClass}>
              <IconSettings /> Settings
            </NavLink>
          </>
        ) : (
          <NavLink to="/dashboard" className={sideNavLinkClass}>
            <IconAccounts /> Accounts
          </NavLink>
        )}
      </div>

      {/* Footer: user info + dark mode + logout */}
      <div className="px-4 py-4 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 uppercase tracking-wider">Theme</span>
          <DarkModeToggle />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{user.name}</p>
          <p className="text-xs text-white/40 capitalize">{user.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand hover:text-blue-400 transition-colors"
        >
          ← Log out
        </button>
      </div>
    </nav>
  )
}

function sideNavLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full',
    isActive
      ? 'bg-white/15 text-white font-medium'
      : 'text-white/65 hover:text-white hover:bg-white/10',
  ].join(' ')
}

function IconUsers() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconPillars() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}

function IconAccounts() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

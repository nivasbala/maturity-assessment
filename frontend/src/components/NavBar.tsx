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
    <nav className="bg-[#1B2B4B] text-white h-14 flex items-center px-6 gap-6 shrink-0">
      <NavLink
        to="/"
        className="text-white font-semibold text-base tracking-tight hover:opacity-80"
      >
        Maturity Assessment
      </NavLink>

      <div className="flex items-center gap-1 flex-1">
        {isAdmin ? (
          <>
            <NavLink to="/admin/users" className={navLinkClass}>
              Users
            </NavLink>
            <NavLink to="/admin/pillars" className={navLinkClass}>
              Pillars
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              Accounts
            </NavLink>
            <NavLink to="/admin/settings" className={navLinkClass}>
              Settings
            </NavLink>
          </>
        ) : (
          <NavLink to="/dashboard" className={navLinkClass}>
            Accounts
          </NavLink>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <DarkModeToggle />
        <span className="text-white/60">{user.name}</span>
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded border border-white/30 text-white/80 hover:bg-white/10 transition-colors text-sm"
        >
          Log out
        </button>
      </div>
    </nav>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'px-3 py-1 rounded text-sm transition-colors',
    isActive
      ? 'bg-white/15 text-white font-medium'
      : 'text-white/70 hover:text-white hover:bg-white/10',
  ].join(' ')
}

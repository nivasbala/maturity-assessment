import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import FloatingThemeToggle from '../components/FloatingThemeToggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await login(email, password)
      setAuth(data.access_token, data.user)
      if (data.user.role === 'admin') {
        navigate('/admin/users')
      } else {
        navigate('/dashboard')
      }
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel — matches sidebar width and style */}
      <div className="w-56 shrink-0 bg-navy flex flex-col">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="2" y="5" width="28" height="18" rx="2" stroke="#5B8FD6" strokeWidth="1.8"/>
              <polyline points="6,14 10,14 12,8 16,20 19,10 22,14 26,14" stroke="#5B8FD6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="13" y1="23" x2="19" y2="23" stroke="#5B8FD6" strokeWidth="1.8"/>
              <line x1="16" y1="23" x2="16" y2="28" stroke="#5B8FD6" strokeWidth="1.8"/>
              <line x1="11" y1="28" x2="21" y2="28" stroke="#5B8FD6" strokeWidth="1.8"/>
            </svg>
            <span className="text-white font-semibold text-xs tracking-tight leading-tight">
              Observability Maturity<br />Assessment
            </span>
          </Link>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 page-shell flex items-center justify-center">
      <FloatingThemeToggle />
      <div className="glass-panel rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-navy dark:text-gray-100 mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Observability Maturity Assessment Platform</p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full bg-brand text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-shine"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

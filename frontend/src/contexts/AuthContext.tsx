import { createContext, useCallback, useContext, useState } from 'react'
import type { User } from '../types'
import { logout as apiLogout } from '../api/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  setAuth: () => {},
  clearAuth: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'))
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? (JSON.parse(stored) as User) : null
  })

  const setAuth = useCallback((t: string, u: User) => {
    localStorage.setItem('access_token', t)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
  }, [])

  const clearAuth = useCallback(async () => {
    await apiLogout()
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export default AuthContext

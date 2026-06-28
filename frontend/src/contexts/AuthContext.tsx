import { createContext, useContext } from 'react'

interface AuthContextType {
  token: string | null
}

const AuthContext = createContext<AuthContextType>({ token: null })

export const useAuth = () => useContext(AuthContext)

export default AuthContext

import api from './index'
import type { User } from '../types'

export const login = (email: string, password: string) =>
  api
    .post<{ access_token: string; refresh_token: string; user: User }>('/auth/login', { email, password })
    .then((r) => r.data)

export const logout = () => api.post('/auth/logout').catch(() => null)

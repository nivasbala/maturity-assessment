import api from './index'
import type {
  Account,
  Assessment,
  Paginated,
  Pillar,
  Question,
  User,
} from '../types'

// ── Users ────────────────────────────────────────────────────────────────────

export const getUsers = (page = 1, size = 25) =>
  api.get<Paginated<User>>('/admin/users', { params: { page, size } }).then((r) => r.data)

export const createUser = (data: { name: string; email: string; password: string }) =>
  api.post<User>('/admin/users', data).then((r) => r.data)

export const updateUser = (id: string, data: Partial<{ name: string; email: string; is_active: boolean }>) =>
  api.put<User>(`/admin/users/${id}`, data).then((r) => r.data)

export const deactivateUser = (id: string) =>
  api.delete<User>(`/admin/users/${id}`).then((r) => r.data)

// ── Pillars ──────────────────────────────────────────────────────────────────

export const getPillars = (page = 1, size = 25) =>
  api.get<Paginated<Pillar>>('/admin/pillars', { params: { page, size } }).then((r) => r.data)

export const createPillar = (data: {
  name: string
  description: string
  overall_weight: number
  display_order: number
  is_gated: boolean
  gate_question?: string | null
}) => api.post<Pillar>('/admin/pillars', data).then((r) => r.data)

export const updatePillar = (
  id: string,
  data: Partial<{
    name: string
    description: string
    overall_weight: number
    display_order: number
    is_active: boolean
    is_gated: boolean
    gate_question: string | null
  }>
) => api.put<Pillar>(`/admin/pillars/${id}`, data).then((r) => r.data)

export const deactivatePillar = (id: string) =>
  api.delete<Pillar>(`/admin/pillars/${id}`).then((r) => r.data)

// ── Questions ─────────────────────────────────────────────────────────────────

export const getQuestions = (pillarId: string, page = 1, size = 50) =>
  api
    .get<Paginated<Question>>(`/admin/pillars/${pillarId}/questions`, { params: { page, size } })
    .then((r) => r.data)

export const createQuestion = (
  pillarId: string,
  data: {
    text: string
    question_weight: number
    is_general: boolean
    is_active: boolean
    answer_options: { text: string; maturity_level: number }[]
    personas: { persona: string; persona_weight: number }[]
  }
) => api.post<Question>(`/admin/pillars/${pillarId}/questions`, data).then((r) => r.data)

export const updateQuestion = (id: string, data: Partial<Parameters<typeof createQuestion>[1]>) =>
  api.put<Question>(`/admin/questions/${id}`, data).then((r) => r.data)

export const deactivateQuestion = (id: string) =>
  api.delete<Question>(`/admin/questions/${id}`).then((r) => r.data)

// ── Read-only admin views ─────────────────────────────────────────────────────

export const getAdminAccounts = (page = 1, size = 25) =>
  api.get<Paginated<Account>>('/admin/accounts', { params: { page, size } }).then((r) => r.data)

export const getAdminAssessments = (page = 1, size = 25) =>
  api.get<Paginated<Assessment>>('/admin/assessments', { params: { page, size } }).then((r) => r.data)

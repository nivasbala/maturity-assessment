import api from './index'
import type {
  AccountDetail,
  AccountListItem,
  AggregateView,
  AssessmentCreated,
  AssessmentListItem,
  Paginated,
  Pillar,
  Report,
} from '../types'

// ── Accounts ──────────────────────────────────────────────────────────────────

export const getAccounts = (page = 1, size = 25) =>
  api.get<Paginated<AccountListItem>>('/accounts', { params: { page, size } }).then((r) => r.data)

export const createAccount = (data: {
  company_name: string
  company_website?: string | null
  suggested_pillars?: string[]
}) => api.post<AccountListItem>('/accounts', data).then((r) => r.data)

export const getAccountDetail = (id: string) =>
  api.get<AccountDetail>(`/accounts/${id}`).then((r) => r.data)

export const getAccountAggregate = (id: string) =>
  api.get<AggregateView>(`/accounts/${id}/aggregate`).then((r) => r.data)

export const getAccountAssessments = (accountId: string) =>
  api.get<AssessmentListItem[]>(`/accounts/${accountId}/assessments`).then((r) => r.data)

export const createAssessment = (accountId: string, pillarId: string) =>
  api
    .post<AssessmentCreated>(`/accounts/${accountId}/assessments`, { pillar_id: pillarId })
    .then((r) => r.data)

// ── Assessments ───────────────────────────────────────────────────────────────

export const getAssessmentReport = (assessmentId: string) =>
  api.get<Report>(`/assessments/${assessmentId}/report`).then((r) => r.data)

// ── Pillars (for suggested pillar picker) ─────────────────────────────────────

export const getActivePillars = () =>
  api.get<{ items: Pillar[] }>('/pillars', { params: { size: 50 } }).then((r) => r.data.items)

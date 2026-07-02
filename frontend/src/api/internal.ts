import api from './index'
import type {
  AccountDetail,
  AccountListItem,
  AggregateView,
  AssessmentAnswers,
  AssessmentCreated,
  AssessmentDetail,
  AssessmentListItem,
  Paginated,
  Pillar,
  Prospect,
  ProspectDetail,
  ProspectListItem,
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

export const deleteAccount = (id: string) =>
  api.delete(`/accounts/${id}`)

export const getAccountAggregate = (id: string) =>
  api.get<AggregateView>(`/accounts/${id}/aggregate`).then((r) => r.data)

export const getAccountAssessments = (accountId: string) =>
  api.get<AssessmentListItem[]>(`/accounts/${accountId}/assessments`).then((r) => r.data)

export const createAssessment = (accountId: string, pillarId: string) =>
  api
    .post<AssessmentCreated>(`/accounts/${accountId}/assessments`, { pillar_id: pillarId })
    .then((r) => r.data)

export const deleteAssessment = (accountId: string, assessmentId: string) =>
  api.delete(`/accounts/${accountId}/assessments/${assessmentId}`)

// ── Assessments ───────────────────────────────────────────────────────────────

export const getAssessmentDetail = (assessmentId: string) =>
  api.get<AssessmentDetail>(`/assessments/${assessmentId}`).then((r) => r.data)

export const getAssessmentAnswers = (assessmentId: string) =>
  api.get<AssessmentAnswers>(`/assessments/${assessmentId}/answers`).then((r) => r.data)

export const getAssessmentReport = (assessmentId: string) =>
  api.get<Report>(`/assessments/${assessmentId}/report`).then((r) => r.data)

// ── Pillars (for suggested pillar picker) ─────────────────────────────────────

export const getActivePillars = () =>
  api.get<{ items: Pillar[] }>('/pillars', { params: { size: 50 } }).then((r) => r.data.items)

// ── Prospects ─────────────────────────────────────────────────────────────────

export const listAllProspects = () =>
  api.get<ProspectListItem[]>('/accounts/prospects').then((r) => r.data)

export const listProspects = (accountId: string) =>
  api.get<Prospect[]>(`/accounts/${accountId}/prospects`).then((r) => r.data)

export const createProspect = (accountId: string, data: { email: string; name?: string | null }) =>
  api.post<Prospect>(`/accounts/${accountId}/prospects`, data).then((r) => r.data)

export const getProspectDetail = (accountId: string, prospectId: string) =>
  api.get<ProspectDetail>(`/accounts/${accountId}/prospects/${prospectId}`).then((r) => r.data)

export const deleteProspect = (accountId: string, prospectId: string) =>
  api.delete(`/accounts/${accountId}/prospects/${prospectId}`)

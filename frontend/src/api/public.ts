/**
 * Public prospect API — no auth required.
 * Session token (issued at /register) is passed via X-Session-Token header.
 */
import axios from 'axios'
import type {
  AssessmentInfo,
  ConfirmResearchResponse,
  ReportPublic,
  RegisterRequest,
  ResearchSummary,
  SelectPillarResponse,
} from '../types'

const api = axios.create({ baseURL: '/api/public' })

export const getAssessmentInfo = (token: string) =>
  api.get<AssessmentInfo>(`/assess/${token}`).then((r) => r.data)

export const registerProspect = (
  token: string,
  data: RegisterRequest,
) =>
  api
    .post<{ session_token: string }>(`/assess/${token}/register`, data)
    .then((r) => r.data)

export const getResearchSummary = (token: string, sessionToken: string) =>
  api
    .get<ResearchSummary>(`/assess/${token}/research-summary`, {
      headers: { 'X-Session-Token': sessionToken },
    })
    .then((r) => r.data)

export const confirmResearch = (
  token: string,
  sessionToken: string,
  assessmentId: string,
  additional_notes: string | null,
) =>
  api
    .post<ConfirmResearchResponse>(
      `/assess/${token}/confirm-research`,
      { assessment_id: assessmentId, additional_notes },
      { headers: { 'X-Session-Token': sessionToken } },
    )
    .then((r) => r.data)

export const saveResearchAdditionalNotes = (
  token: string,
  sessionToken: string,
  additional_notes: string | null,
) =>
  api
    .put<{ saved: boolean }>(
      `/assess/${token}/research-additional-notes`,
      { additional_notes },
      { headers: { 'X-Session-Token': sessionToken } },
    )
    .then((r) => r.data)

export const selectPillar = (
  token: string,
  sessionToken: string,
  pillarId: string,
) =>
  api
    .post<SelectPillarResponse>(
      `/assess/${token}/select-pillar`,
      { pillar_id: pillarId },
      { headers: { 'X-Session-Token': sessionToken } },
    )
    .then((r) => r.data)

export const submitAssessment = (
  token: string,
  sessionToken: string,
  assessmentId: string,
  answers: { question_id: string; answer_option_id: string }[],
) =>
  api
    .post<{ report_id: string }>(
      `/assess/${token}/submit`,
      { assessment_id: assessmentId, answers },
      { headers: { 'X-Session-Token': sessionToken } },
    )
    .then((r) => r.data)

export const getReport = (token: string, assessmentId: string) =>
  api.get<ReportPublic>(`/assess/${token}/report/${assessmentId}`).then((r) => r.data)

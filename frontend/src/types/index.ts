export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'internal_user'
  is_active: boolean
  created_at: string
}

export interface Pillar {
  id: string
  name: string
  description: string
  overall_weight: number
  display_order: number
  is_active: boolean
  is_gated: boolean
  gate_question: string | null
  question_count: number
  created_at: string
}

export interface SystemSetting {
  key: string
  value: string
  description: string | null
  updated_at: string
}

export interface AnswerOption {
  id: string
  text: string
  maturity_level: number
  display_order: number
}

export interface QuestionPersona {
  id: string
  persona: string
  persona_weight: number
}

export interface Question {
  id: string
  pillar_id: string
  text: string
  question_weight: number
  is_general: boolean
  display_order: number
  is_active: boolean
  context_tags: string[]
  answer_options: AnswerOption[]
  personas: QuestionPersona[]
}

export interface Account {
  id: string
  company_name: string
  company_website: string | null
  internal_user_id: string
  created_at: string
}

export interface Assessment {
  id: string
  account_id: string
  pillar_id: string
  short_url_token: string
  prospect_name: string | null
  prospect_email: string | null
  prospect_role: string | null
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  completed_at: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  size: number
}

// ── Prospect ──────────────────────────────────────────────────────────────────

export interface Prospect {
  id: string
  account_id: string
  email: string
  name: string | null
  short_url_token: string
  full_url: string
  created_at: string
}

export interface ProspectAssessmentRow {
  pillar_id: string
  pillar_name: string
  display_order: number
  assessment_id: string | null
  status: 'pending' | 'in_progress' | 'completed' | null
  pillar_score: number | null
  maturity_label: string | null
  completed_at: string | null
}

export interface ProspectDetail extends Prospect {
  assessments: ProspectAssessmentRow[]
}

// ── Internal / Account types ──────────────────────────────────────────────────

export interface AccountListItem {
  id: string
  company_name: string
  company_website: string | null
  internal_user_id: string
  suggested_pillars: string[]
  created_at: string
  pillars_sent: number
  pillars_completed: number
}

export interface PillarStatusRow {
  pillar_id: string
  pillar_name: string
  display_order: number
  is_gated: boolean
  is_active: boolean
  assessment_id: string | null
  status: 'pending' | 'in_progress' | 'completed' | null
  prospect_name: string | null
  prospect_email: string | null
  prospect_role: string | null
  pillar_score: number | null
  maturity_label: string | null
  short_url_token: string | null
}

export interface AccountDetail {
  id: string
  company_name: string
  company_website: string | null
  internal_user_id: string
  internal_user_name: string
  suggested_pillars: string[]
  created_at: string
  pillar_statuses: PillarStatusRow[]
}

export interface AssessmentCreated {
  assessment_id: string
  short_url_token: string
  full_url: string
}

export interface AssessmentListItem {
  id: string
  account_id: string
  pillar_id: string
  pillar_name: string
  short_url_token: string
  prospect_name: string | null
  prospect_email: string | null
  prospect_role: string | null
  status: 'pending' | 'in_progress' | 'completed'
  pillar_score: number | null
  maturity_label: string | null
  created_at: string
  completed_at: string | null
}

export interface AggregateScoreItem {
  pillar_id: string
  pillar_name: string
  pillar_score: number
  maturity_label: string
  prospect_name: string | null
  prospect_role: string | null
}

export interface AggregateView {
  account_id: string
  company_name: string
  completed_count: number
  scores: AggregateScoreItem[]
}

export interface AssessmentDetail {
  id: string
  account_id: string
  pillar_id: string
  pillar_name: string
  company_name: string
  short_url_token: string
  prospect_name: string | null
  prospect_email: string | null
  prospect_role: string | null
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  completed_at: string | null
}

export interface AnswerRow {
  question_text: string
  selected_option_text: string
  maturity_level: number
}

export interface AssessmentAnswers {
  assessment_id: string
  account_id: string
  pillar_id: string
  pillar_name: string
  company_name: string
  status: string
  prospect_name: string | null
  prospect_email: string | null
  prospect_role: string | null
  completed_at: string | null
  pillar_score: number | null
  maturity_label: string | null
  answers: AnswerRow[]
}

export interface Report {
  id: string
  assessment_id: string
  pillar_score: number
  maturity_level: number
  maturity_label: string
  executive_summary: string
  strengths: { title: string; description: string }[]
  gap_analysis: {
    gap: string
    current_state: string
    target_state: string
    impact: 'high' | 'medium' | 'low'
    effort: 'high' | 'medium' | 'low'
  }[]
  next_steps: {
    title: string
    description: string
    priority: 'quick_win' | 'strategic' | 'foundational'
    timeframe: string
  }[]
  pillar_breakdown: Record<string, unknown>
  research_data: {
    company_name: string
    industry: string
    company_size: string
    products_summary: string
    target_customers: string
    operational_scale: string[]
    builds_ai_products: boolean
    cloud_providers: string[]
    key_challenges: string[]
    business_outcomes: string[]
    data_confidence: string
    research_notes: string
  } | null
  created_at: string
}

// ── Prospect / Public flow types ──────────────────────────────────────────────

export interface AvailablePillar {
  id: string
  name: string
  description: string
  is_gated: boolean
  gate_question: string | null
}

export interface AssessmentInfo {
  company_name: string
  prospect_name: string | null
  prospect_email: string
  suggested_pillars: string[]
  available_pillars: AvailablePillar[]
}

export interface RegisterRequest {
  prospect_name: string
  prospect_email: string
  prospect_role: string
  p3_gate_answered_yes?: boolean | null
  p4_gate_answered_yes?: boolean | null
  infrastructure_location?: string | null
  tech_stack_description?: string | null
  current_tools?: string | null
  key_challenges_input?: string | null
}

export interface ResearchSummary {
  is_ready: boolean
  company_name: string
  industry: string
  company_size: string
  products_summary: string
  target_customers: string
  builds_ai_products: boolean
  cloud_providers: string[]
  key_challenges: string[]
  business_outcomes: string[]
  operational_scale: string[]
  data_confidence: 'high' | 'medium' | 'low'
  research_notes: string
}

export interface AnswerOptionPublic {
  id: string
  text: string
  display_order: number
}

export interface QuestionPublic {
  id: string
  text: string
  answer_options: AnswerOptionPublic[]
}

export interface SelectPillarResponse {
  assessment_id: string
  questions: QuestionPublic[]
}

export interface ReportPublic {
  id: string
  assessment_id: string
  pillar_score: number
  maturity_level: number
  maturity_label: string
  executive_summary: string
  strengths: { title: string; description: string }[]
  gap_analysis: {
    gap: string
    current_state: string
    target_state: string
    impact: 'high' | 'medium' | 'low'
    effort: 'high' | 'medium' | 'low'
  }[]
  next_steps: {
    title: string
    description: string
    priority: 'quick_win' | 'strategic' | 'foundational'
    timeframe: string
  }[]
  pillar_breakdown: Record<string, unknown>
  created_at: string
  company_name: string
  pillar_name: string
  prospect_name: string | null
  prospect_role: string | null
}

export const PERSONAS = [
  { value: 'cto_executive', label: 'CTO / C-Suite' },
  { value: 'vp_engineering', label: 'VP Engineering' },
  { value: 'ciso_vp_security', label: 'CISO / VP Security' },
  { value: 'sre_platform_engineer', label: 'SRE / Platform Engineer' },
  { value: 'devops_engineer', label: 'DevOps Engineer' },
  { value: 'ml_ai_engineer', label: 'ML / AI Engineer' },
  { value: 'security_engineer', label: 'Security Engineer' },
  { value: 'software_developer', label: 'Software Developer' },
] as const

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

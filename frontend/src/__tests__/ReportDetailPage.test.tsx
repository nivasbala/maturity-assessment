import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ReportDetailPage from '../pages/internal/ReportDetailPage'

/**
 * Tests focused on the back-navigation change:
 * - Default: navigates to /dashboard/accounts/:accountId with company name label
 * - With location.state.from: navigates to that path with fromLabel as label
 */

const mockNavigate = vi.fn()
let mockLocationState: { from?: string; fromLabel?: string } | null = null

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'assessment-123' }),
  useLocation: () => ({ state: mockLocationState, pathname: '/dashboard/assessments/assessment-123' }),
}))

vi.mock('../api/internal', () => ({
  getAssessmentAnswers: vi.fn(),
  getAssessmentReport: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../utils/reportColors', () => ({
  MATURITY_COLORS: {},
  IMPACT_COLORS: {},
  EFFORT_COLORS: {},
  LEVEL_COLORS: {},
  PRIORITY_LABELS: {},
  PRIORITY_COLORS: {},
}))

import { getAssessmentAnswers, getAssessmentReport } from '../api/internal'
import { useAuth } from '../contexts/AuthContext'

function makeAnswers(overrides = {}) {
  return {
    assessment_id: 'assessment-123',
    account_id: 'account-456',
    pillar_id: 'pillar-1',
    pillar_name: 'Full-Stack Observability',
    company_name: 'Acme Corp',
    status: 'completed',
    prospect_name: 'Jane Smith',
    prospect_email: 'jane@acme.com',
    prospect_role: 'SRE',
    completed_at: '2026-06-01T12:00:00Z',
    pillar_score: 3.2,
    maturity_label: 'Defined',
    answers: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLocationState = null

  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'u1', name: 'Alice', email: 'alice@co.com', role: 'internal_user', is_active: true },
    token: 'tok',
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  })

  vi.mocked(getAssessmentAnswers).mockResolvedValue(makeAnswers())
  vi.mocked(getAssessmentReport).mockResolvedValue(null as never)
})

describe('ReportDetailPage — back navigation', () => {
  it('back button navigates to account page by default (no location state)', async () => {
    mockLocationState = null

    render(<ReportDetailPage />)

    await waitFor(() => screen.getByText(/back to/i))

    fireEvent.click(screen.getByText(/back to/i))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/accounts/account-456')
  })

  it('back button label shows company_name by default', async () => {
    mockLocationState = null

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/back to acme corp/i)).toBeInTheDocument()
    })
  })

  it('back button uses location.state.from when provided', async () => {
    mockLocationState = { from: '/prospects/account-abc', fromLabel: 'Acme Corp' }

    render(<ReportDetailPage />)

    await waitFor(() => screen.getByText(/back to/i))

    fireEvent.click(screen.getByText(/back to/i))
    expect(mockNavigate).toHaveBeenCalledWith('/prospects/account-abc')
  })

  it('back button label uses fromLabel when provided', async () => {
    mockLocationState = { from: '/prospects/account-abc', fromLabel: 'Acme Corp' }

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/back to acme corp/i)).toBeInTheDocument()
    })
  })

  it('back button uses custom fromLabel even if different from company_name', async () => {
    vi.mocked(getAssessmentAnswers).mockResolvedValue(makeAnswers({ company_name: 'Different Name' }))
    mockLocationState = { from: '/prospects/account-abc', fromLabel: 'Custom Label' }

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/back to custom label/i)).toBeInTheDocument()
    })
  })

  it('falls back to company_name when fromLabel is absent', async () => {
    mockLocationState = { from: '/prospects/account-abc' }

    render(<ReportDetailPage />)

    await waitFor(() => {
      // fromLabel undefined → falls back to answers.company_name
      expect(screen.getByText(/back to acme corp/i)).toBeInTheDocument()
    })
  })

  it('shows loading state while data is fetching', () => {
    vi.mocked(getAssessmentAnswers).mockReturnValue(new Promise(() => {}))

    render(<ReportDetailPage />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

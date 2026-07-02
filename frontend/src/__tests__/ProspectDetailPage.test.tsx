import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ProspectDetailPage from '../pages/internal/ProspectDetailPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'account-abc' }),
}))

vi.mock('../api/internal', () => ({
  getAccountDetail: vi.fn(),
}))

// clipboard mock
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
})

import { getAccountDetail } from '../api/internal'

function makePillarStatus(overrides = {}) {
  return {
    pillar_id: 'pillar-1',
    pillar_name: 'Full-Stack Observability',
    display_order: 1,
    is_gated: false,
    is_active: true,
    assessment_id: null,
    status: null,
    prospect_name: null,
    prospect_email: null,
    prospect_role: null,
    pillar_score: null,
    maturity_label: null,
    short_url_token: null,
    ...overrides,
  }
}

function makeAccountDetail(overrides = {}) {
  return {
    id: 'account-abc',
    company_name: 'Acme Corp',
    company_website: 'https://acme.com',
    internal_user_id: 'user-1',
    internal_user_name: 'Alice',
    suggested_pillars: [],
    created_at: '2026-01-01T00:00:00Z',
    pillar_statuses: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProspectDetailPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getAccountDetail).mockReturnValue(new Promise(() => {}))
    render(<ProspectDetailPage />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    vi.mocked(getAccountDetail).mockRejectedValue(new Error('fail'))
    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load prospect/i)).toBeInTheDocument()
    })
  })

  it('renders company name in header', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(makeAccountDetail())
    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument()
    })
  })

  it('shows back button navigating to /prospects', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(makeAccountDetail())
    render(<ProspectDetailPage />)

    await waitFor(() => screen.getByText(/← Prospects/i))

    fireEvent.click(screen.getByText(/← Prospects/i))
    expect(mockNavigate).toHaveBeenCalledWith('/prospects')
  })

  it('shows empty state when no assessments sent', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        pillar_statuses: [
          makePillarStatus({ pillar_id: 'p1', status: null }),
          makePillarStatus({ pillar_id: 'p2', status: null }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/no assessments sent yet/i)).toBeInTheDocument()
    })
  })

  it('shows only sent assessments (filters out null-status rows)', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        pillar_statuses: [
          makePillarStatus({ pillar_id: 'p1', pillar_name: 'Pillar One', status: 'pending', short_url_token: 'tok11111' }),
          makePillarStatus({ pillar_id: 'p2', pillar_name: 'Pillar Two', status: 'completed', short_url_token: 'tok22222', assessment_id: 'a-2' }),
          makePillarStatus({ pillar_id: 'p3', pillar_name: 'Pillar Three', status: null }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Pillar One')).toBeInTheDocument()
      expect(screen.getByText('Pillar Two')).toBeInTheDocument()
      expect(screen.queryByText('Pillar Three')).not.toBeInTheDocument()
    })
  })

  it('renders prospect name and email in row', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        pillar_statuses: [
          makePillarStatus({
            status: 'pending',
            short_url_token: 'tok12345',
            prospect_name: 'Jane Smith',
            prospect_email: 'jane@company.com',
          }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('jane@company.com')).toBeInTheDocument()
    })
  })

  it('shows Copy button for rows with short_url_token', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        pillar_statuses: [
          makePillarStatus({ status: 'pending', short_url_token: 'AbCdEfGh' }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      expect(screen.getByText('/assess/AbCdEfGh')).toBeInTheDocument()
    })
  })

  it('Copy button writes URL to clipboard', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        pillar_statuses: [
          makePillarStatus({ status: 'pending', short_url_token: 'TkN12345' }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => screen.getByRole('button', { name: /copy/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/assess/TkN12345')
    )
  })

  it('shows View Report button only for completed assessments', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        pillar_statuses: [
          makePillarStatus({ pillar_id: 'p1', pillar_name: 'Pending Pillar', status: 'pending', short_url_token: 'tok11111' }),
          makePillarStatus({ pillar_id: 'p2', pillar_name: 'Done Pillar', status: 'completed', short_url_token: 'tok22222', assessment_id: 'assess-done' }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => {
      const viewReportButtons = screen.getAllByRole('button', { name: /view report/i })
      expect(viewReportButtons).toHaveLength(1)
    })
  })

  it('View Report navigates with location state including from and fromLabel', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({
        company_name: 'Acme Corp',
        pillar_statuses: [
          makePillarStatus({
            pillar_id: 'p1',
            status: 'completed',
            short_url_token: 'tok11111',
            assessment_id: 'assess-xyz',
          }),
        ],
      })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => screen.getByRole('button', { name: /view report/i }))
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))

    expect(mockNavigate).toHaveBeenCalledWith(
      '/dashboard/assessments/assess-xyz',
      {
        state: {
          from: '/prospects/account-abc',
          fromLabel: 'Acme Corp',
        },
      }
    )
  })

  it('shows company website as link when present', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({ company_website: 'https://acme.com' })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /acme\.com/i })).toBeInTheDocument()
    })
  })

  it('does not show website link when company_website is null', async () => {
    vi.mocked(getAccountDetail).mockResolvedValue(
      makeAccountDetail({ company_website: null })
    )

    render(<ProspectDetailPage />)

    await waitFor(() => screen.getByText('Acme Corp'))
    expect(screen.queryByRole('link', { name: /acme\.com/i })).not.toBeInTheDocument()
  })
})

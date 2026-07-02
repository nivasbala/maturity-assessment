import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ProspectsListPage from '../pages/internal/ProspectsListPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../api/internal', () => ({
  getAccounts: vi.fn(),
}))

import { getAccounts } from '../api/internal'

function makeAccount(id: string, name: string) {
  return {
    id,
    company_name: name,
    company_website: `https://${name.toLowerCase().replace(/\s/g, '')}.com`,
    internal_user_id: 'user-1',
    suggested_pillars: [],
    created_at: '2026-01-15T00:00:00Z',
    pillars_sent: 2,
    pillars_completed: 1,
  }
}

function makePageResult(items: ReturnType<typeof makeAccount>[], total: number) {
  return { items, total, page: 1, size: 25 }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProspectsListPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getAccounts).mockReturnValue(new Promise(() => {})) // never resolves
    render(<ProspectsListPage />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders account rows after fetch', async () => {
    vi.mocked(getAccounts).mockResolvedValue(
      makePageResult([makeAccount('a1', 'Alpha Corp'), makeAccount('a2', 'Beta Inc')], 2)
    )

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument()
      expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    })
  })

  it('shows total count in subtitle', async () => {
    vi.mocked(getAccounts).mockResolvedValue(
      makePageResult(
        [makeAccount('a1', 'Alpha'), makeAccount('a2', 'Beta'), makeAccount('a3', 'Gamma')],
        5
      )
    )

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByText(/5 prospects total/i)).toBeInTheDocument()
    })
  })

  it('uses singular "prospect" when total is 1', async () => {
    vi.mocked(getAccounts).mockResolvedValue(
      makePageResult([makeAccount('a1', 'Solo Co')], 1)
    )

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByText(/1 prospect total/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no accounts returned', async () => {
    vi.mocked(getAccounts).mockResolvedValue(makePageResult([], 0))

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByText(/no prospects yet/i)).toBeInTheDocument()
    })
  })

  it('shows error message on fetch failure', async () => {
    vi.mocked(getAccounts).mockRejectedValue(new Error('Network error'))

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load prospects/i)).toBeInTheDocument()
    })
  })

  it('navigates to prospect detail on row click', async () => {
    vi.mocked(getAccounts).mockResolvedValue(
      makePageResult([makeAccount('prospect-123', 'Click Me Co')], 1)
    )

    render(<ProspectsListPage />)

    await waitFor(() => screen.getByText('Click Me Co'))

    fireEvent.click(screen.getByText('Click Me Co').closest('tr')!)
    expect(mockNavigate).toHaveBeenCalledWith('/prospects/prospect-123')
  })

  it('does not navigate when clicking website link (stopPropagation)', async () => {
    const account = makeAccount('a1', 'Site Corp')
    vi.mocked(getAccounts).mockResolvedValue(makePageResult([account], 1))

    render(<ProspectsListPage />)

    await waitFor(() => screen.getByText('Site Corp'))

    fireEvent.click(screen.getByRole('link', { name: /sitecorp\.com/i }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows pagination when total exceeds page size', async () => {
    vi.mocked(getAccounts).mockResolvedValue({
      items: Array.from({ length: 25 }, (_, i) => makeAccount(`a${i}`, `Company ${i}`)),
      total: 50,
      page: 1,
      size: 25,
    })

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })
  })

  it('does not show pagination for a single page', async () => {
    vi.mocked(getAccounts).mockResolvedValue(
      makePageResult([makeAccount('a1', 'Only Co')], 10)
    )

    render(<ProspectsListPage />)

    await waitFor(() => screen.getByText('Only Co'))

    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('shows page info text when paginating', async () => {
    vi.mocked(getAccounts).mockResolvedValue({
      items: Array.from({ length: 25 }, (_, i) => makeAccount(`a${i}`, `Co ${i}`)),
      total: 50,
      page: 1,
      size: 25,
    })

    render(<ProspectsListPage />)

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
    })
  })

  it('calls getAccounts again when Next page is clicked', async () => {
    vi.mocked(getAccounts).mockResolvedValue({
      items: Array.from({ length: 25 }, (_, i) => makeAccount(`a${i}`, `Co ${i}`)),
      total: 50,
      page: 1,
      size: 25,
    })

    render(<ProspectsListPage />)

    await waitFor(() => screen.getByRole('button', { name: /next/i }))

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(vi.mocked(getAccounts)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(getAccounts)).toHaveBeenLastCalledWith(2, 25)
    })
  })
})

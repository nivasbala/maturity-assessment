/**
 * Tests for AccountsListPage.
 *
 * All API calls are mocked via vi.mock so no network or backend is required.
 * AuthContext is mocked to control the current user's role.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import AccountsListPage from '../pages/internal/AccountsListPage'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/internal', () => ({
  getAccounts: vi.fn(),
  createAccount: vi.fn(),
  getActivePillars: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { getAccounts, createAccount, getActivePillars } from '../api/internal'
import { useAuth } from '../contexts/AuthContext'

const mockGetAccounts = getAccounts as ReturnType<typeof vi.fn>
const mockCreateAccount = createAccount as ReturnType<typeof vi.fn>
const mockGetActivePillars = getActivePillars as ReturnType<typeof vi.fn>
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────────────────

const INTERNAL_USER = { id: 'u1', name: 'Alice', email: 'alice@co.com', role: 'internal_user' as const, is_active: true, created_at: '' }
const ADMIN_USER    = { id: 'u2', name: 'Admin',  email: 'admin@co.com', role: 'admin'          as const, is_active: true, created_at: '' }

const makeAccount = (overrides = {}) => ({
  id: 'acc-1',
  company_name: 'Acme Corp',
  company_website: 'https://acme.com',
  internal_user_id: 'u1',
  internal_user_name: 'Alice',
  suggested_pillars: [],
  created_at: '2026-01-01T00:00:00Z',
  pillars_sent: 2,
  pillars_completed: 1,
  ...overrides,
})

const emptyPage = { items: [], total: 0, page: 1, size: 25 }
const onePage = (accounts = [makeAccount()]) => ({ items: accounts, total: accounts.length, page: 1, size: 25 })

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountsListPage />
    </MemoryRouter>
  )
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AccountsListPage', () => {
  beforeEach(() => {
    mockGetActivePillars.mockResolvedValue([])
    mockUseAuth.mockReturnValue({ user: INTERNAL_USER })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── Loading & Error states ─────────────────────────────────────────────────

  it('shows a loading indicator while data is fetching', () => {
    // never resolves — keeps page in loading state
    mockGetAccounts.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/loading accounts/i)).toBeInTheDocument()
  })

  it('shows an error message when the API call fails', async () => {
    mockGetAccounts.mockRejectedValue(new Error('network error'))
    renderPage()
    await waitFor(() => expect(screen.getByText(/failed to load accounts/i)).toBeInTheDocument())
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows empty-state prompt when there are no accounts', async () => {
    mockGetAccounts.mockResolvedValue(emptyPage)
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument()
    )
  })

  // ── Table rendering ────────────────────────────────────────────────────────

  it('renders an account row with company name, pillars sent, and pillars completed', async () => {
    mockGetAccounts.mockResolvedValue(onePage())
    renderPage()

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument())
    expect(screen.getByText('2')).toBeInTheDocument()  // pillars_sent
    expect(screen.getByText('1')).toBeInTheDocument()  // pillars_completed
  })

  it('renders the website as a link', async () => {
    mockGetAccounts.mockResolvedValue(onePage())
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    const link = screen.getByRole('link', { name: /acme\.com/i })
    expect(link).toHaveAttribute('href', 'https://acme.com')
  })

  it('shows "—" for accounts with no website', async () => {
    mockGetAccounts.mockResolvedValue(onePage([makeAccount({ company_website: null })]))
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    // The em-dash cell should appear in the row
    const rows = screen.getAllByRole('row')
    expect(rows[1].textContent).toContain('—')
  })

  // ── Role-based column visibility ───────────────────────────────────────────

  it('does NOT show "Created By" column for internal users', async () => {
    mockGetAccounts.mockResolvedValue(onePage())
    mockUseAuth.mockReturnValue({ user: INTERNAL_USER })
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    expect(screen.queryByRole('columnheader', { name: /created by/i })).not.toBeInTheDocument()
  })

  it('shows "Created By" column with creator name for admin users', async () => {
    mockGetAccounts.mockResolvedValue(
      onePage([makeAccount({ internal_user_name: 'Alice' })])
    )
    mockUseAuth.mockReturnValue({ user: ADMIN_USER })
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    expect(screen.getByRole('columnheader', { name: /created by/i })).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows "—" in Created By cell when internal_user_name is empty', async () => {
    mockGetAccounts.mockResolvedValue(
      onePage([makeAccount({ internal_user_name: '' })])
    )
    mockUseAuth.mockReturnValue({ user: ADMIN_USER })
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    // The "Created By" column should exist but show an em-dash for empty name
    const rows = screen.getAllByRole('row')
    const dataRow = rows[1]
    const cells = within(dataRow).getAllByRole('cell')
    const createdByCell = cells[5] // 0:Company 1:Website 2:Pillars 3:Sent 4:Completed 5:CreatedBy
    expect(createdByCell.textContent).toBe('—')
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  it('navigates to account detail when a row is clicked', async () => {
    mockGetAccounts.mockResolvedValue(onePage([makeAccount({ id: 'acc-42' })]))
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    await user.click(screen.getByText('Acme Corp'))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/accounts/acc-42')
  })

  it('does not navigate when the website link is clicked (stopPropagation)', async () => {
    mockGetAccounts.mockResolvedValue(onePage())
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    await user.click(screen.getByRole('link', { name: /acme\.com/i }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // ── New Account modal ──────────────────────────────────────────────────────

  it('opens the New Account modal when the button is clicked', async () => {
    mockGetAccounts.mockResolvedValue(emptyPage)
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText(/no accounts yet/i))
    await user.click(screen.getByRole('button', { name: /new account/i }))
    expect(screen.getByRole('heading', { name: /new account/i })).toBeInTheDocument()
  })

  it('shows validation error when submitting without a company name', async () => {
    mockGetAccounts.mockResolvedValue(emptyPage)
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText(/no accounts yet/i))
    await user.click(screen.getByRole('button', { name: /new account/i }))
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
  })

  it('adds new account to the list after successful creation', async () => {
    mockGetAccounts.mockResolvedValue(emptyPage)
    const newAccount = makeAccount({ id: 'acc-new', company_name: 'NewCo' })
    mockCreateAccount.mockResolvedValue(newAccount)

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText(/no accounts yet/i))
    await user.click(screen.getByRole('button', { name: /new account/i }))
    await user.type(screen.getByPlaceholderText(/acme corp/i), 'NewCo')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText('NewCo')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: /new account/i })).not.toBeInTheDocument()
  })

  it('shows error message when account creation fails', async () => {
    mockGetAccounts.mockResolvedValue(emptyPage)
    mockCreateAccount.mockRejectedValue(new Error('server error'))

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText(/no accounts yet/i))
    await user.click(screen.getByRole('button', { name: /new account/i }))
    await user.type(screen.getByPlaceholderText(/acme corp/i), 'NewCo')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to create account/i)).toBeInTheDocument()
    )
  })

  // ── Pagination ─────────────────────────────────────────────────────────────

  it('does not show pagination controls when total <= page size', async () => {
    mockGetAccounts.mockResolvedValue(onePage())
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('renders pagination controls when total exceeds page size', async () => {
    // total=50, page=1, size=25 → Next button enabled, Previous disabled
    mockGetAccounts.mockResolvedValue({ items: [makeAccount()], total: 50, page: 1, size: 25 })
    renderPage()

    await waitFor(() => screen.getByText('Acme Corp'))
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
  })

  it('fetches page 2 when Next is clicked', async () => {
    const page1 = { items: [makeAccount({ id: 'a1', company_name: 'Page1Co' })], total: 50, page: 1, size: 25 }
    const page2 = { items: [makeAccount({ id: 'a2', company_name: 'Page2Co' })], total: 50, page: 2, size: 25 }
    mockGetAccounts.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText('Page1Co'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText('Page2Co')).toBeInTheDocument())
    expect(mockGetAccounts).toHaveBeenCalledTimes(2)
  })
})

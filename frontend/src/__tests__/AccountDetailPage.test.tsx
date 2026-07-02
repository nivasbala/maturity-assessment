/**
 * Tests for AccountDetailPage.
 *
 * Covers: prospect list rendering, create-prospect flow, copy URL, and
 * delete-account modal. All API calls and clipboard are mocked.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import AccountDetailPage from '../pages/internal/AccountDetailPage'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/internal', () => ({
  getAccountDetail: vi.fn(),
  listProspects: vi.fn(),
  createProspect: vi.fn(),
  deleteAccount: vi.fn(),
}))

import {
  getAccountDetail,
  listProspects,
  createProspect,
  deleteAccount,
} from '../api/internal'

const mockGetAccountDetail = getAccountDetail as ReturnType<typeof vi.fn>
const mockListProspects     = listProspects     as ReturnType<typeof vi.fn>
const mockCreateProspect    = createProspect    as ReturnType<typeof vi.fn>
const mockDeleteAccount     = deleteAccount     as ReturnType<typeof vi.fn>

// ── Clipboard mock ─────────────────────────────────────────────────────────────

const mockClipboardWrite = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockClipboardWrite },
  writable: true,
})

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ACCOUNT_ID = 'acc-123'

const makeAccountDetail = (overrides = {}) => ({
  id: ACCOUNT_ID,
  company_name: 'Detail Corp',
  company_website: 'https://detail.com',
  internal_user_id: 'u1',
  internal_user_name: 'Alice',
  suggested_pillars: [],
  created_at: '2026-01-01T00:00:00Z',
  pillar_statuses: [],
  ...overrides,
})

const makeProspect = (overrides = {}) => ({
  id: 'p1',
  account_id: ACCOUNT_ID,
  email: 'jane@prospect.com',
  name: 'Jane Smith',
  short_url_token: 'abc12345',
  full_url: 'http://localhost/assess/abc12345',
  created_at: '2026-01-02T00:00:00Z',
  ...overrides,
})

// Render inside a router with the account ID param set
function renderPage(accountId = ACCOUNT_ID) {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/accounts/${accountId}`]}>
      <Routes>
        <Route path="/dashboard/accounts/:id" element={<AccountDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AccountDetailPage', () => {
  beforeEach(() => {
    mockGetAccountDetail.mockResolvedValue(makeAccountDetail())
    mockListProspects.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── Loading & Error ────────────────────────────────────────────────────────

  it('shows loading indicator while data is fetching', () => {
    mockGetAccountDetail.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/loading account/i)).toBeInTheDocument()
  })

  it('shows error message when fetching account detail fails', async () => {
    mockGetAccountDetail.mockRejectedValue(new Error('network'))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/failed to load account/i)).toBeInTheDocument()
    )
  })

  // ── Account header ─────────────────────────────────────────────────────────

  it('renders the company name as the page heading', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Detail Corp' })).toBeInTheDocument()
    )
  })

  it('renders the website as an external link', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    const link = screen.getByRole('link', { name: /detail\.com/i })
    expect(link).toHaveAttribute('href', 'https://detail.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('does not render a website link when company_website is null', async () => {
    mockGetAccountDetail.mockResolvedValue(makeAccountDetail({ company_website: null }))
    renderPage()
    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    expect(screen.queryByRole('link', { name: /detail\.com/i })).not.toBeInTheDocument()
  })

  it('displays created-by and created-on metadata', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    expect(screen.getByText(/created by alice/i)).toBeInTheDocument()
  })

  it('renders back navigation link to Accounts list', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    expect(screen.getByRole('button', { name: /← accounts/i })).toBeInTheDocument()
  })

  it('navigates back to /dashboard when back button is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /← accounts/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  // ── Prospects list ─────────────────────────────────────────────────────────

  it('shows empty-state message when there are no prospects', async () => {
    mockListProspects.mockResolvedValue([])
    renderPage()
    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    expect(screen.getByText(/no prospects yet/i)).toBeInTheDocument()
  })

  it('renders a prospect row with email, name, and created date', async () => {
    mockListProspects.mockResolvedValue([makeProspect()])
    renderPage()

    await waitFor(() => screen.getByText('jane@prospect.com'))
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('1/2/2026')).toBeInTheDocument()
  })

  it('shows "—" for name when prospect has no name', async () => {
    mockListProspects.mockResolvedValue([makeProspect({ name: null })])
    renderPage()

    await waitFor(() => screen.getByText('jane@prospect.com'))
    const rows = screen.getAllByRole('row')
    const dataRow = rows[1]
    expect(within(dataRow).getByText('—')).toBeInTheDocument()
  })

  it('renders a "Copy URL" button for each prospect', async () => {
    mockListProspects.mockResolvedValue([makeProspect()])
    renderPage()
    await waitFor(() => screen.getByText('jane@prospect.com'))
    expect(screen.getByRole('button', { name: /copy url/i })).toBeInTheDocument()
  })

  it('copies the prospect full_url to clipboard when Copy URL is clicked', async () => {
    mockListProspects.mockResolvedValue([makeProspect()])
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText('jane@prospect.com'))
    await user.click(screen.getByRole('button', { name: /copy url/i }))
    expect(mockClipboardWrite).toHaveBeenCalledWith('http://localhost/assess/abc12345')
  })

  it('shows "✓ Copied" briefly after copying and then reverts', async () => {
    vi.useFakeTimers()
    mockListProspects.mockResolvedValue([makeProspect()])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    await waitFor(() => screen.getByText('jane@prospect.com'))
    await user.click(screen.getByRole('button', { name: /copy url/i }))
    expect(screen.getByRole('button', { name: /✓ copied/i })).toBeInTheDocument()

    vi.advanceTimersByTime(2100)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copy url/i })).toBeInTheDocument()
    )
    vi.useRealTimers()
  })

  // ── Create Prospect modal ──────────────────────────────────────────────────

  it('opens the Create Prospect modal when the button is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /\+ create prospect/i }))
    expect(screen.getByRole('heading', { name: /create prospect/i })).toBeInTheDocument()
  })

  it('requires an email — submit is disabled when email is empty', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /\+ create prospect/i }))
    const submitBtn = screen.getByRole('button', { name: /create prospect/i })
    expect(submitBtn).toBeDisabled()
  })

  it('shows the URL modal after a prospect is created successfully', async () => {
    const newProspect = makeProspect({ id: 'p-new', email: 'bob@co.com', name: 'Bob' })
    mockCreateProspect.mockResolvedValue(newProspect)

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /\+ create prospect/i }))
    await user.type(screen.getByPlaceholderText(/jane@company\.com/i), 'bob@co.com')
    await user.type(screen.getByPlaceholderText(/jane smith/i), 'Bob')

    const submitBtn = screen.getByRole('button', { name: /create prospect/i })
    await user.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /prospect created/i })).toBeInTheDocument()
    )
    expect(screen.getByText('http://localhost/assess/abc12345')).toBeInTheDocument()
  })

  it('adds the new prospect to the table after creation', async () => {
    mockCreateProspect.mockResolvedValue(makeProspect({ id: 'p-new', email: 'new@co.com', name: 'New Guy' }))

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /\+ create prospect/i }))
    await user.type(screen.getByPlaceholderText(/jane@company\.com/i), 'new@co.com')
    await user.click(screen.getByRole('button', { name: /create prospect/i }))

    // Close the URL modal
    await waitFor(() => screen.getByRole('heading', { name: /prospect created/i }))
    await user.click(screen.getByRole('button', { name: /done/i }))

    await waitFor(() => expect(screen.getByText('new@co.com')).toBeInTheDocument())
  })

  it('shows an error when prospect creation fails', async () => {
    mockCreateProspect.mockRejectedValue(new Error('server error'))

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /\+ create prospect/i }))
    await user.type(screen.getByPlaceholderText(/jane@company\.com/i), 'fail@co.com')
    await user.click(screen.getByRole('button', { name: /create prospect/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to create prospect/i)).toBeInTheDocument()
    )
  })

  // ── Delete Account modal ───────────────────────────────────────────────────

  it('opens the Delete Account confirmation modal on button click', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /delete account/i }))
    expect(screen.getByRole('heading', { name: /delete account/i })).toBeInTheDocument()
    expect(screen.getByText(/detail corp/i)).toBeInTheDocument()
  })

  it('dismisses the modal when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('heading', { name: /delete account/i })).not.toBeInTheDocument()
  })

  it('calls deleteAccount and navigates to /dashboard on confirm', async () => {
    mockDeleteAccount.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /delete account/i }))

    const confirmBtn = screen.getByRole('button', { name: /delete account/i, hidden: false })
    // There are two "Delete Account" buttons — the modal confirm is the second
    const buttons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(buttons[buttons.length - 1])

    await waitFor(() =>
      expect(mockDeleteAccount).toHaveBeenCalledWith(ACCOUNT_ID)
    )
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('shows an action error when deleteAccount API call fails', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('server error'))
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByRole('heading', { name: 'Detail Corp' }))
    await user.click(screen.getByRole('button', { name: /delete account/i }))
    const buttons = screen.getAllByRole('button', { name: /delete account/i })
    await user.click(buttons[buttons.length - 1])

    await waitFor(() =>
      expect(screen.getByText(/failed to delete account/i)).toBeInTheDocument()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

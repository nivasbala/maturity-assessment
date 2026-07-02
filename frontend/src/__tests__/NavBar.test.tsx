import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import NavBar from '../components/NavBar'

// NavLink renders as a plain anchor in tests
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  NavLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../components/DarkModeToggle', () => ({
  default: () => <button>Toggle</button>,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../contexts/AuthContext'

function makeUser(role: 'admin' | 'internal_user') {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role,
    is_active: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NavBar — Prospects link', () => {
  it('shows Prospects link for admin user', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('admin'),
      token: 'tok',
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })

    render(<NavBar />)
    const links = screen.getAllByRole('link', { name: /prospects/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('shows Prospects link for internal_user', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('internal_user'),
      token: 'tok',
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })

    render(<NavBar />)
    const links = screen.getAllByRole('link', { name: /prospects/i })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('Prospects link points to /prospects', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('admin'),
      token: 'tok',
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })

    render(<NavBar />)
    const prospectsLinks = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === '/prospects')
    expect(prospectsLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('admin sees Users, Pillars, Accounts, Prospects, Settings links', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('admin'),
      token: 'tok',
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })

    render(<NavBar />)
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /pillars/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /accounts/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /prospects/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('internal_user sees Accounts and Prospects but not Users, Pillars, Settings', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('internal_user'),
      token: 'tok',
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })

    render(<NavBar />)
    expect(screen.getByRole('link', { name: /accounts/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /prospects/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('link', { name: /^users$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^pillars$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^settings$/i })).not.toBeInTheDocument()
  })

  it('returns null when no user is logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      token: null,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })

    const { container } = render(<NavBar />)
    expect(container.firstChild).toBeNull()
  })
})

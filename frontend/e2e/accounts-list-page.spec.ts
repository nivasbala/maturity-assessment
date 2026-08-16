import { test, expect, type Page } from '@playwright/test'

const INTERNAL_USER = {
  id: 'u1',
  name: 'Jane Internal',
  email: 'internal@company.com',
  role: 'internal_user' as const,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

const ADMIN_USER = { ...INTERNAL_USER, id: 'u2', name: 'Ada Admin', email: 'admin@company.com', role: 'admin' as const }

const ACCOUNTS = [
  {
    id: 'acc-1',
    company_name: 'Acme Corp',
    company_website: 'https://acmecorp.com',
    internal_user_id: 'u1',
    internal_user_name: 'Jane Internal',
    suggested_pillars: ['p1', 'p2'],
    created_at: '2026-01-05T00:00:00Z',
    pillars_sent: 2,
    pillars_completed: 1,
  },
  {
    id: 'acc-2',
    company_name: 'Globex Inc',
    company_website: null,
    internal_user_id: 'u1',
    internal_user_name: 'Jane Internal',
    suggested_pillars: [],
    created_at: '2026-01-10T00:00:00Z',
    pillars_sent: 0,
    pillars_completed: 0,
  },
]

const PILLARS = [
  { id: 'p1', name: 'Full-Stack Observability', description: '', overall_weight: 1, display_order: 1, is_active: true, is_gated: false, gate_question: null, question_count: 12, created_at: '2026-01-01T00:00:00Z' },
  { id: 'p2', name: 'Security & DevSecOps', description: '', overall_weight: 1, display_order: 5, is_active: true, is_gated: false, gate_question: null, question_count: 12, created_at: '2026-01-01T00:00:00Z' },
]

async function seedAuth(page: Page, user: typeof INTERNAL_USER = INTERNAL_USER) {
  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user', JSON.stringify(u))
  }, user)
}

async function mockAccounts(page: Page, items: unknown[] = ACCOUNTS) {
  await page.route('**/api/accounts?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, total: items.length, page: 1, size: 25 }) })
  )
}

async function mockPillars(page: Page) {
  await page.route('**/api/pillars?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: PILLARS, total: PILLARS.length, page: 1, size: 50 }) })
  )
}

test.describe('AccountsListPage', () => {
  test('lists accounts with company, website, pillar counts, and no Created By column for internal users', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page)
    await mockPillars(page)

    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
    await expect(page.getByText('2 accounts')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Acme Corp' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'acmecorp.com' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Created By' })).toHaveCount(0)
  })

  test('shows a Created By column for admin users', async ({ page }) => {
    await seedAuth(page, ADMIN_USER)
    await mockAccounts(page)
    await mockPillars(page)

    await page.goto('/dashboard')
    await expect(page.getByRole('columnheader', { name: 'Created By' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Jane Internal' }).first()).toBeVisible()
  })

  test('clicking a row navigates to the account detail page', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page)
    await mockPillars(page)

    await page.goto('/dashboard')
    await page.getByRole('cell', { name: 'Acme Corp' }).click()
    await expect(page).toHaveURL('/dashboard/accounts/acc-1')
  })

  test('creating a new account adds it to the top of the list', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page)
    await mockPillars(page)
    await page.route('**/api/accounts', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'acc-3',
          company_name: 'Initech',
          company_website: null,
          internal_user_id: 'u1',
          suggested_pillars: [],
          created_at: '2026-01-15T00:00:00Z',
          pillars_sent: 0,
          pillars_completed: 0,
        }),
      })
    })

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'New Account' }).click()
    await page.getByPlaceholder('Acme Corp').fill('Initech')
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByRole('cell', { name: 'Initech' })).toBeVisible()
    await expect(page.getByText('3 accounts')).toBeVisible()
  })

  test('new account form requires a company name', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page)
    await mockPillars(page)

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'New Account' }).click()
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page.getByText('Company name is required')).toBeVisible()
  })

  test('deleting an account asks for confirmation and removes it from the list', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page)
    await mockPillars(page)
    await page.route('**/api/accounts/acc-2', (route) =>
      route.fulfill({ status: 204, contentType: 'application/json', body: '' })
    )

    await page.goto('/dashboard')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /Globex Inc/ }).getByTitle('Delete account').click()

    await expect(page.getByRole('cell', { name: 'Globex Inc' })).toHaveCount(0)
    await expect(page.getByText('1 account')).toBeVisible()
  })

  test('shows an empty state when there are no accounts', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page, [])
    await mockPillars(page)

    await page.goto('/dashboard')
    await expect(page.getByText('No accounts yet. Click "New Account" to get started.')).toBeVisible()
  })

  test('a failed accounts fetch shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await page.route('**/api/accounts?*', (route) => route.fulfill({ status: 500, body: '{}' }))
    await mockPillars(page)

    await page.goto('/dashboard')
    await expect(page.getByText('Failed to load accounts')).toBeVisible()
  })

  test('an unauthenticated request is redirected to /login', async ({ page }) => {
    // No auth seeded — access_token missing means every request 401s.
    await page.route('**/api/accounts?*', (route) => route.fulfill({ status: 401, body: '{}' }))
    await mockPillars(page)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockAccounts(page)
    await mockPillars(page)

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

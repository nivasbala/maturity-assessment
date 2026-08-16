import { test, expect, type Page } from '@playwright/test'

const PROSPECTS = [
  {
    id: 'pr-1',
    account_id: 'acc-1',
    email: 'jane@acme.com',
    name: 'Jane Smith',
    short_url_token: 'tok-1',
    full_url: 'http://localhost:5173/assess/tok-1',
    created_at: '2026-01-06T00:00:00Z',
    is_registered: true,
    registered_at: '2026-01-06T01:00:00Z',
    infrastructure_location: null,
    tech_stack_description: null,
    current_tools: null,
    key_challenges_input: null,
    company_name: 'Acme Corp',
    internal_user_name: 'Jane Internal',
  },
  {
    id: 'pr-2',
    account_id: 'acc-2',
    email: 'bob@globex.com',
    name: null,
    short_url_token: 'tok-2',
    full_url: 'http://localhost:5173/assess/tok-2',
    created_at: '2026-01-07T00:00:00Z',
    is_registered: false,
    registered_at: null,
    infrastructure_location: null,
    tech_stack_description: null,
    current_tools: null,
    key_challenges_input: null,
    company_name: 'Globex Inc',
    internal_user_name: 'Ada Admin',
  },
]

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u1', name: 'Jane Internal', email: 'internal@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-01T00:00:00Z' })
    )
  })
}

async function mockProspects(page: Page, items: unknown[] = PROSPECTS) {
  await page.route('**/api/accounts/all-prospects', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(items) })
  )
}

test.describe('ProspectsListPage', () => {
  test('lists all prospects across accounts with name, email, account, and creator', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page)

    await page.goto('/prospects')

    await expect(page.getByRole('heading', { name: 'Prospects' })).toBeVisible()
    await expect(page.getByText('Jane Smith')).toBeVisible()
    await expect(page.getByText('jane@acme.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Acme Corp' })).toBeVisible()
    await expect(page.getByText('bob@globex.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Globex Inc' })).toBeVisible()
    await expect(page.getByText('2 prospects')).toBeVisible()
  })

  test('search filters by name, email, or account', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page)
    await page.goto('/prospects')

    const search = page.getByPlaceholder('Search by name, email, or account…')
    await search.fill('globex')
    await expect(page.getByText('bob@globex.com')).toBeVisible()
    await expect(page.getByText('jane@acme.com')).toHaveCount(0)
    await expect(page.getByText('1 prospect matching "globex"')).toBeVisible()

    await search.fill('nonexistent-xyz')
    await expect(page.getByText('No prospects match your search.')).toBeVisible()
  })

  test('clicking a row navigates to the prospect detail page', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page)
    await page.goto('/prospects')

    await page.getByText('jane@acme.com').click()
    await expect(page).toHaveURL('/dashboard/accounts/acc-1/prospects/pr-1')
  })

  test('clicking the account name navigates to the account detail page without triggering the row click', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page)
    await page.goto('/prospects')

    await page.getByRole('button', { name: 'Globex Inc' }).click()
    await expect(page).toHaveURL('/dashboard/accounts/acc-2')
  })

  test('deleting a prospect asks for confirmation and removes it from the table', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page)
    await page.route('**/api/accounts/acc-2/prospects/pr-2', (route) =>
      route.fulfill({ status: 204, body: '' })
    )

    await page.goto('/prospects')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /bob@globex.com/ }).getByTitle('Delete prospect').click()

    await expect(page.getByText('bob@globex.com')).toHaveCount(0)
    await expect(page.getByText('jane@acme.com')).toBeVisible()
    await expect(page.getByText('1 prospect')).toBeVisible()
  })

  test('shows an empty state when there are no prospects', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page, [])
    await page.goto('/prospects')

    await expect(page.getByText('No prospects yet.')).toBeVisible()
  })

  test('a failed fetch shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await page.route('**/api/accounts/all-prospects', (route) => route.fulfill({ status: 500, body: '{}' }))

    await page.goto('/prospects')
    await expect(page.getByText('Failed to load prospects.')).toBeVisible()
  })

  test('an unauthenticated request is redirected to /login', async ({ page }) => {
    await page.route('**/api/accounts/all-prospects', (route) => route.fulfill({ status: 401, body: '{}' }))

    await page.goto('/prospects')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockProspects(page)
    await page.goto('/prospects')
    await expect(page.getByRole('heading', { name: 'Prospects' })).toBeVisible()

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

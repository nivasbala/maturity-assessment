import { test, expect, type Page } from '@playwright/test'

const ACCOUNT_ID = 'acc-1'

const ACCOUNT = {
  id: ACCOUNT_ID,
  company_name: 'Acme Corp',
  company_website: 'https://acmecorp.com',
  internal_user_id: 'u1',
  internal_user_name: 'Jane Internal',
  suggested_pillars: ['p1'],
  created_at: '2026-01-05T00:00:00Z',
  pillar_statuses: [],
}

const PROSPECTS = [
  {
    id: 'pr-1',
    account_id: ACCOUNT_ID,
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
  },
  {
    id: 'pr-2',
    account_id: ACCOUNT_ID,
    email: 'bob@acme.com',
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

async function mockAccountDetail(page: Page, account: unknown = ACCOUNT) {
  await page.route(`**/api/accounts/${ACCOUNT_ID}`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account) })
  })
}

async function mockProspects(page: Page, prospects: unknown[] = PROSPECTS) {
  await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prospects) })
  })
}

async function gotoAccount(page: Page) {
  await page.goto(`/dashboard/accounts/${ACCOUNT_ID}`)
  await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible()
}

test.describe('AccountDetailPage', () => {
  test('shows account header and lists prospects with status and creator', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)

    await gotoAccount(page)

    await expect(page.getByRole('link', { name: 'https://acmecorp.com' })).toBeVisible()
    await expect(page.getByText('Created by Jane Internal')).toBeVisible()

    await expect(page.getByRole('link', { name: 'jane@acme.com' })).toBeVisible()
    await expect(page.getByText('Registered', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'bob@acme.com' })).toBeVisible()
    await expect(page.getByText('Not registered')).toBeVisible()
  })

  test('back link returns to the accounts list', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)
    await page.route('**/api/accounts?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 25 }) })
    )
    await page.route('**/api/pillars?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }) })
    )

    await gotoAccount(page)
    await page.getByRole('button', { name: '← Accounts' }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('clicking a prospect email navigates to prospect detail', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)

    await gotoAccount(page)
    await page.getByRole('link', { name: 'jane@acme.com' }).click()
    await expect(page).toHaveURL(`/dashboard/accounts/${ACCOUNT_ID}/prospects/pr-1`)
  })

  test('creating a prospect shows the generated assessment link', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects`, (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pr-3',
          account_id: ACCOUNT_ID,
          email: 'newperson@acme.com',
          name: null,
          short_url_token: 'tok-3',
          full_url: 'http://localhost:5173/assess/tok-3',
          created_at: '2026-01-08T00:00:00Z',
          is_registered: false,
          registered_at: null,
          infrastructure_location: null,
          tech_stack_description: null,
          current_tools: null,
          key_challenges_input: null,
        }),
      })
    })

    await gotoAccount(page)
    await page.getByRole('button', { name: '+ Create Prospect' }).first().click()
    await page.getByPlaceholder('jane@company.com').fill('newperson@acme.com')
    await page.getByRole('button', { name: 'Create Prospect', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Prospect Created' })).toBeVisible()
    await expect(page.getByText('http://localhost:5173/assess/tok-3')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('link', { name: 'newperson@acme.com' })).toBeVisible()
  })

  test('create prospect requires an email', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)

    await gotoAccount(page)
    await page.getByRole('button', { name: '+ Create Prospect' }).first().click()
    await expect(page.getByRole('button', { name: 'Create Prospect', exact: true })).toBeDisabled()
  })

  test('deleting a prospect asks for confirmation and removes it from the table', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects/pr-2`, (route) =>
      route.fulfill({ status: 204, body: '' })
    )

    await gotoAccount(page)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /bob@acme.com/ }).getByTitle('Delete prospect').click()

    await expect(page.getByRole('link', { name: 'bob@acme.com' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'jane@acme.com' })).toBeVisible()
  })

  test('deleting the account navigates back to the accounts list', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACCOUNT) })
    })
    await page.route('**/api/accounts?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 25 }) })
    )
    await page.route('**/api/pillars?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }) })
    )

    await gotoAccount(page)
    await page.getByRole('button', { name: 'Delete Account' }).click()
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible()
    await page.getByRole('button', { name: 'Delete Account' }).last().click()

    await expect(page).toHaveURL('/dashboard')
  })

  test('shows an empty state when the account has no prospects', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page, [])

    await gotoAccount(page)
    await expect(page.getByText('No prospects yet for this account.')).toBeVisible()
  })

  test('a failed account fetch shows an error instead of the page', async ({ page }) => {
    await seedAuth(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, (route) => route.fulfill({ status: 500, body: '{}' }))
    await mockProspects(page)

    await page.goto(`/dashboard/accounts/${ACCOUNT_ID}`)
    await expect(page.getByText('Failed to load account')).toBeVisible()
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockAccountDetail(page)
    await mockProspects(page)

    await gotoAccount(page)
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

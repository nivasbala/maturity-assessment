import { test, expect, type Page, type Locator } from '@playwright/test'

const ME = { id: 'u1', name: 'Ada Admin', email: 'admin@company.com', role: 'admin' as const, is_active: true, created_at: '2026-01-01T00:00:00Z' }

const BASE_USERS = [
  { ...ME },
  { id: 'u2', name: 'Jane Internal', email: 'jane@company.com', role: 'internal_user' as const, is_active: true, created_at: '2026-01-02T00:00:00Z' },
  { id: 'u3', name: 'Bob Retired', email: 'bob@company.com', role: 'internal_user' as const, is_active: false, created_at: '2026-01-03T00:00:00Z' },
]


function fieldByLabel(page: Page, label: string): Locator {
  return page.locator(`xpath=//label[normalize-space(text())="${label}"]/following-sibling::input[1]`)
}

async function seedAuth(page: Page, user: unknown = ME) {
  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user', JSON.stringify(u))
  }, user)
}

/** Stateful mock of /api/admin/users so create/edit/deactivate round-trip realistically. */
async function mockUsersApi(page: Page, initial: typeof BASE_USERS = BASE_USERS) {
  const users = initial.map((u) => ({ ...u }))
  let nextId = 100

  await page.route('**/api/admin/users**', (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())

    if (method === 'GET' && url.pathname.endsWith('/admin/users')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: users, total: users.length, page: 1, size: 25 }) })
    }
    if (method === 'POST') {
      const data = req.postDataJSON()
      const created = { id: `u${nextId++}`, name: data.name, email: data.email, role: 'internal_user', is_active: true, created_at: '2026-01-15T00:00:00Z' }
      users.unshift(created)
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
    }
    return route.fallback()
  })

  await page.route('**/api/admin/users/*', (route) => {
    const req = route.request()
    const method = req.method()
    const id = req.url().split('/').pop()!
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) return route.fulfill({ status: 404, body: '{}' })

    if (method === 'PUT') {
      const data = req.postDataJSON()
      users[idx] = { ...users[idx], ...data }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users[idx]) })
    }
    if (method === 'DELETE') {
      users[idx] = { ...users[idx], is_active: false }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users[idx]) })
    }
    return route.fallback()
  })
}

async function gotoUsers(page: Page) {
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Internal Users' })).toBeVisible()
}

test.describe('UsersPage', () => {
  test('lists users with role and status badges, hiding Deactivate for self and inactive users', async ({ page }) => {
    await seedAuth(page)
    await mockUsersApi(page)
    await gotoUsers(page)

    await expect(page.getByRole('cell', { name: 'Ada Admin' })).toBeVisible()
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
    await expect(page.getByText('Internal User').first()).toBeVisible()
    await expect(page.getByText('Active').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Inactive' })).toBeVisible()

    // Self (Ada Admin) has no Deactivate button.
    await expect(page.getByRole('row', { name: /Ada Admin/ }).getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
    // Already-inactive user has no Deactivate button either.
    await expect(page.getByRole('row', { name: /Bob Retired/ }).getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
    // An active, non-self user does have one.
    await expect(page.getByRole('row', { name: /Jane Internal/ }).getByRole('button', { name: 'Deactivate' })).toBeVisible()
  })

  test('creating a new user requires all fields and adds it to the list', async ({ page }) => {
    await seedAuth(page)
    await mockUsersApi(page)
    await gotoUsers(page)

    await page.getByRole('button', { name: '+ New User' }).click()
    const create = page.getByRole('button', { name: 'Create User' })
    await expect(create).toBeDisabled()

    await fieldByLabel(page, 'Full Name').fill('New Hire')
    await fieldByLabel(page, 'Email').fill('newhire@company.com')
    await fieldByLabel(page, 'Password').fill('s3cret-pass')
    await expect(create).toBeEnabled()
    await create.click()

    await expect(page.getByRole('heading', { name: 'New Internal User' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'New Hire' })).toBeVisible()
    await expect(page.getByText('newhire@company.com')).toBeVisible()
  })

  test('editing a user updates their name and email', async ({ page }) => {
    await seedAuth(page)
    await mockUsersApi(page)
    await gotoUsers(page)

    await page.getByRole('row', { name: /Jane Internal/ }).getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible()

    await fieldByLabel(page, 'Full Name').fill('Jane Updated')
    await fieldByLabel(page, 'Email').fill('jane.updated@company.com')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.getByRole('heading', { name: 'Edit User' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'Jane Updated' })).toBeVisible()
    await expect(page.getByText('jane.updated@company.com')).toBeVisible()
  })

  test('deactivating a user asks for confirmation and flips their status', async ({ page }) => {
    await seedAuth(page)
    await mockUsersApi(page)
    await gotoUsers(page)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /Jane Internal/ }).getByRole('button', { name: 'Deactivate' }).click()

    await expect(page.getByRole('row', { name: /Jane Internal/ }).getByText('Inactive')).toBeVisible()
    await expect(page.getByRole('row', { name: /Jane Internal/ }).getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
  })

  test('shows an empty state when there are no users', async ({ page }) => {
    await seedAuth(page)
    await mockUsersApi(page, [])
    await gotoUsers(page)

    await expect(page.getByText('No users found.')).toBeVisible()
  })

  test('a failed fetch shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await page.route('**/api/admin/users**', (route) => route.fulfill({ status: 500, body: '{}' }))

    await page.goto('/admin/users')
    await expect(page.getByText('Failed to load users.')).toBeVisible()
  })

  test('a non-admin internal user is redirected to the dashboard', async ({ page }) => {
    await seedAuth(page, { id: 'u2', name: 'Jane Internal', email: 'jane@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-02T00:00:00Z' })
    await page.route('**/api/accounts?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 25 }) })
    )
    await page.route('**/api/pillars?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }) })
    )

    await page.goto('/admin/users')
    await expect(page).toHaveURL('/dashboard')
  })

  test('an unauthenticated visit is redirected to /login', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockUsersApi(page)
    await gotoUsers(page)

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

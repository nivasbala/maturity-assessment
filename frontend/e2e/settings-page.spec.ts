import { test, expect, type Page } from '@playwright/test'

const ME = { id: 'u1', name: 'Ada Admin', email: 'admin@company.com', role: 'admin' as const, is_active: true, created_at: '2026-01-01T00:00:00Z' }

const BASE_SETTINGS = [
  { key: 'question_count_min', value: '12', description: null, updated_at: '2026-01-01T00:00:00Z' },
  { key: 'question_count_max', value: '25', description: null, updated_at: '2026-01-01T00:00:00Z' },
]

async function seedAuth(page: Page, user: unknown = ME) {
  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user', JSON.stringify(u))
  }, user)
}

/** Stateful mock so saved edits round-trip realistically. */
async function mockSettingsApi(page: Page, initial: typeof BASE_SETTINGS = BASE_SETTINGS) {
  const settings = initial.map((s) => ({ ...s }))

  await page.route('**/api/admin/settings', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) })
  })

  await page.route('**/api/admin/settings/*', (route) => {
    const req = route.request()
    if (req.method() !== 'PUT') return route.fallback()
    const key = req.url().split('/').pop()!
    const idx = settings.findIndex((s) => s.key === key)
    if (idx === -1) return route.fulfill({ status: 404, body: '{}' })
    const data = req.postDataJSON()
    settings[idx] = { ...settings[idx], value: data.value, updated_at: '2026-01-16T00:00:00Z' }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings[idx]) })
  })
}

async function gotoSettings(page: Page) {
  await page.goto('/admin/settings')
  await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible()
}

test.describe('SettingsPage', () => {
  test('shows the question-count min and max settings with their current values', async ({ page }) => {
    await seedAuth(page)
    await mockSettingsApi(page)
    await gotoSettings(page)

    await expect(page.getByText('Min Questions Per Session')).toBeVisible()
    await expect(page.getByText('Hard floor — no pillar can be configured below this value.')).toBeVisible()
    await expect(page.getByText('12', { exact: true })).toBeVisible()

    await expect(page.getByText('Max Questions Per Session')).toBeVisible()
    await expect(page.getByText('Ceiling — no pillar can be configured above this value.')).toBeVisible()
    await expect(page.getByText('25', { exact: true })).toBeVisible()
  })

  test('editing the max value saves and updates the displayed value', async ({ page }) => {
    await seedAuth(page)
    await mockSettingsApi(page)
    await gotoSettings(page)

    const maxCard = page.locator('div.rounded-xl.border', { hasText: 'Max Questions Per Session' })
    await maxCard.getByRole('button', { name: 'Edit' }).click()

    const input = maxCard.locator('input[type="number"]')
    await input.fill('30')
    await maxCard.getByRole('button', { name: 'Save' }).click()

    await expect(maxCard.getByText('30', { exact: true })).toBeVisible()
    await expect(maxCard.getByRole('button', { name: 'Edit' })).toBeVisible()
  })

  test('the min value cannot be saved below the 12 hard floor', async ({ page }) => {
    await seedAuth(page)
    await mockSettingsApi(page)
    await gotoSettings(page)

    const minCard = page.locator('div.rounded-xl.border', { hasText: 'Min Questions Per Session' })
    await minCard.getByRole('button', { name: 'Edit' }).click()

    const input = minCard.locator('input[type="number"]')
    await input.fill('5')
    await expect(minCard.getByRole('button', { name: 'Save' })).toBeDisabled()

    await input.fill('12')
    await expect(minCard.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  test('Cancel discards the edit without saving', async ({ page }) => {
    await seedAuth(page)
    await mockSettingsApi(page)
    await gotoSettings(page)

    const maxCard = page.locator('div.rounded-xl.border', { hasText: 'Max Questions Per Session' })
    await maxCard.getByRole('button', { name: 'Edit' }).click()
    await maxCard.locator('input[type="number"]').fill('99')
    await maxCard.getByRole('button', { name: 'Cancel' }).click()

    await expect(maxCard.getByText('25', { exact: true })).toBeVisible()
    await expect(maxCard.getByText('99', { exact: true })).toHaveCount(0)
  })

  test('a failed save shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await page.route('**/api/admin/settings', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BASE_SETTINGS) })
    })
    await page.route('**/api/admin/settings/*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal error' }) })
    )

    await gotoSettings(page)
    const maxCard = page.locator('div.rounded-xl.border', { hasText: 'Max Questions Per Session' })
    await maxCard.getByRole('button', { name: 'Edit' }).click()
    await maxCard.locator('input[type="number"]').fill('30')
    await maxCard.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Internal error')).toBeVisible()
  })

  test('a failed fetch shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await page.route('**/api/admin/settings', (route) => route.fulfill({ status: 500, body: '{}' }))

    await page.goto('/admin/settings')
    await expect(page.getByText('Failed to load settings.')).toBeVisible()
  })

  test('a non-admin internal user is redirected to the dashboard', async ({ page }) => {
    await seedAuth(page, { id: 'u2', name: 'Jane Internal', email: 'jane@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-02T00:00:00Z' })
    await page.route('**/api/accounts?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 25 }) })
    )
    await page.route('**/api/pillars?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }) })
    )

    await page.goto('/admin/settings')
    await expect(page).toHaveURL('/dashboard')
  })

  test('an unauthenticated visit is redirected to /login', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockSettingsApi(page)
    await gotoSettings(page)

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

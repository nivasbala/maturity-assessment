import { test, expect, type Page, type Locator } from '@playwright/test'

const ME = { id: 'u1', name: 'Ada Admin', email: 'admin@company.com', role: 'admin' as const, is_active: true, created_at: '2026-01-01T00:00:00Z' }

const BASE_PILLARS = [
  { id: 'p1', name: 'Full-Stack Observability', description: 'Monitoring, logging, tracing.', overall_weight: 1.0, display_order: 1, is_active: true, is_gated: false, gate_question: null, question_count: 12, created_at: '2026-01-01T00:00:00Z' },
  { id: 'p3', name: 'AI Application Observability', description: 'Observability for AI-powered apps.', overall_weight: 1.0, display_order: 3, is_active: true, is_gated: true, gate_question: 'Do you build or run AI-powered applications?', question_count: 12, created_at: '2026-01-01T00:00:00Z' },
  { id: 'p4', name: 'ML & Foundation Model Operations', description: 'MLOps and foundation model lifecycle.', overall_weight: 1.0, display_order: 4, is_active: false, is_gated: true, gate_question: 'Do you train or fine-tune models?', question_count: 12, created_at: '2026-01-01T00:00:00Z' },
]

const SETTINGS = [
  { key: 'question_count_min', value: '12' },
  { key: 'question_count_max', value: '25' },
]

function fieldByLabel(page: Page, label: string): Locator {
  return page.locator(`xpath=//label[normalize-space(text())="${label}"]/following-sibling::*[self::input or self::textarea][1]`)
}

async function seedAuth(page: Page, user: unknown = ME) {
  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user', JSON.stringify(u))
  }, user)
}

async function mockSettings(page: Page, settings: unknown = SETTINGS) {
  await page.route('**/api/admin/settings', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) })
  })
}

/** Stateful mock of /api/admin/pillars so create/edit/toggle round-trip realistically. */
async function mockPillarsApi(page: Page, initial: typeof BASE_PILLARS = BASE_PILLARS) {
  const pillars = initial.map((p) => ({ ...p }))
  let nextId = 100

  await page.route('**/api/admin/pillars**', (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())

    if (method === 'GET' && url.pathname.endsWith('/admin/pillars')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: pillars, total: pillars.length, page: 1, size: 25 }) })
    }
    if (method === 'POST') {
      const data = req.postDataJSON()
      const created = { id: `p${nextId++}`, is_active: true, created_at: '2026-01-15T00:00:00Z', ...data }
      pillars.unshift(created)
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
    }
    return route.fallback()
  })

  await page.route('**/api/admin/pillars/*', (route) => {
    const req = route.request()
    const method = req.method()
    const id = req.url().split('/').pop()!
    const idx = pillars.findIndex((p) => p.id === id)
    if (idx === -1) return route.fulfill({ status: 404, body: '{}' })

    if (method === 'PUT') {
      const data = req.postDataJSON()
      pillars[idx] = { ...pillars[idx], ...data }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pillars[idx]) })
    }
    if (method === 'DELETE') {
      pillars[idx] = { ...pillars[idx], is_active: false }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pillars[idx]) })
    }
    return route.fallback()
  })
}

async function gotoPillars(page: Page) {
  await page.goto('/admin/pillars')
  await expect(page.getByRole('heading', { name: 'Pillars' })).toBeVisible()
}

test.describe('PillarsPage', () => {
  test('lists pillars with order, weight, gated badge, question count, and status', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    await expect(page.getByRole('cell', { name: /Full-Stack Observability/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Questions →' }).first()).toBeVisible()
    await expect(page.getByText('Gated').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Inactive' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Active' }).first()).toBeVisible()
  })

  test('the Questions link on a pillar navigates to its question bank', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    await page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('link', { name: 'Questions →' }).click()
    await expect(page).toHaveURL('/admin/pillars/p1/questions')
  })

  test('creating a new pillar requires name and description, and shows question-count bounds from settings', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    await page.getByRole('button', { name: '+ New Pillar' }).click()
    await expect(page.getByText('(min 12 — max 25)')).toBeVisible()

    const create = page.getByRole('button', { name: 'Create Pillar' })
    await expect(create).toBeDisabled()

    await fieldByLabel(page, 'Name').fill('Cost Optimization')
    await fieldByLabel(page, 'Description').fill('FinOps and cost-efficiency practices.')
    await expect(create).toBeEnabled()
    await create.click()

    await expect(page.getByRole('heading', { name: 'New Pillar' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: /Cost Optimization/ })).toBeVisible()
  })

  test('checking "Gated pillar" reveals the gate question field', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    await page.getByRole('button', { name: '+ New Pillar' }).click()
    await expect(page.getByText('Gate Question')).toHaveCount(0)
    await page.getByLabel('Gated pillar').check()
    await expect(page.getByText('Gate Question')).toBeVisible()
  })

  test('editing a pillar updates its name and description', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    await page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Pillar' })).toBeVisible()
    await expect(fieldByLabel(page, 'Name')).toHaveValue('Full-Stack Observability')

    await fieldByLabel(page, 'Name').fill('Full-Stack Observability & Monitoring')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.getByRole('heading', { name: 'Edit Pillar' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: /Full-Stack Observability & Monitoring/ })).toBeVisible()
  })

  test('deactivating an active pillar asks for confirmation and flips its status', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('button', { name: 'Deactivate' }).click()

    await expect(page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('cell', { name: 'Inactive' })).toBeVisible()
    await expect(page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('button', { name: 'Activate' })).toBeVisible()
  })

  test('activating an inactive (seeded) pillar flips its status back to active', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /ML & Foundation Model Operations/ }).getByRole('button', { name: 'Activate' }).click()

    await expect(page.getByRole('row', { name: /ML & Foundation Model Operations/ }).getByRole('cell', { name: 'Active' })).toBeVisible()
  })

  test('shows an empty state when there are no pillars', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page, [])
    await gotoPillars(page)

    await expect(page.getByText('No pillars found.')).toBeVisible()
  })

  test('a failed fetch shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await page.route('**/api/admin/pillars**', (route) => route.fulfill({ status: 500, body: '{}' }))

    await page.goto('/admin/pillars')
    await expect(page.getByText('Failed to load pillars.')).toBeVisible()
  })

  test('a non-admin internal user is redirected to the dashboard', async ({ page }) => {
    await seedAuth(page, { id: 'u2', name: 'Jane Internal', email: 'jane@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-02T00:00:00Z' })
    await page.route('**/api/accounts?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 25 }) })
    )
    await page.route('**/api/pillars?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }) })
    )

    await page.goto('/admin/pillars')
    await expect(page).toHaveURL('/dashboard')
  })

  test('an unauthenticated visit is redirected to /login', async ({ page }) => {
    await page.goto('/admin/pillars')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockSettings(page)
    await mockPillarsApi(page)
    await gotoPillars(page)

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

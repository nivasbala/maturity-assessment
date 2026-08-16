import { test, expect, type Page } from '@playwright/test'

const ME = { id: 'u1', name: 'Ada Admin', email: 'admin@company.com', role: 'admin' as const, is_active: true, created_at: '2026-01-01T00:00:00Z' }
const PILLAR_ID = 'p1'

const BASE_QUESTIONS = [
  {
    id: 'q1',
    pillar_id: PILLAR_ID,
    text: 'How do you currently monitor application performance?',
    question_weight: 1.5,
    is_general: false,
    display_order: 1,
    is_active: true,
    context_tags: ['kubernetes'],
    answer_options: [
      { id: 'q1-o1', text: 'We do not monitor performance', maturity_level: 1, display_order: 1 },
      { id: 'q1-o2', text: 'Basic dashboards, manually reviewed', maturity_level: 2, display_order: 2 },
      { id: 'q1-o3', text: 'Automated alerting on key metrics', maturity_level: 3, display_order: 3 },
      { id: 'q1-o4', text: 'Full APM with anomaly detection', maturity_level: 4, display_order: 4 },
    ],
    personas: [{ id: 'qp1', persona: 'sre_platform_engineer', persona_weight: 1.5 }],
  },
  {
    id: 'q2',
    pillar_id: PILLAR_ID,
    text: 'Does your organization have a documented incident response process?',
    question_weight: 1.0,
    is_general: true,
    display_order: 2,
    is_active: false,
    context_tags: [],
    answer_options: [
      { id: 'q2-o1', text: 'No process', maturity_level: 1, display_order: 1 },
      { id: 'q2-o2', text: 'Informal process', maturity_level: 2, display_order: 2 },
      { id: 'q2-o3', text: 'Documented, followed inconsistently', maturity_level: 3, display_order: 3 },
      { id: 'q2-o4', text: 'Documented and automated', maturity_level: 4, display_order: 4 },
    ],
    personas: [],
  },
]

async function seedAuth(page: Page, user: unknown = ME) {
  await page.addInitScript((u) => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem('user', JSON.stringify(u))
  }, user)
}

/** Stateful mock so create/edit/toggle round-trip realistically. */
async function mockQuestionsApi(page: Page, initial: typeof BASE_QUESTIONS = BASE_QUESTIONS) {
  const questions = initial.map((q) => ({ ...q }))
  let nextId = 100

  await page.route(`**/api/admin/pillars/${PILLAR_ID}/questions**`, (route) => {
    const req = route.request()
    const method = req.method()

    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: questions, total: questions.length, page: 1, size: 100 }) })
    }
    if (method === 'POST') {
      const data = req.postDataJSON()
      const created = {
        id: `q${nextId++}`,
        pillar_id: PILLAR_ID,
        display_order: questions.length + 1,
        ...data,
        answer_options: data.answer_options.map((o: { text: string; maturity_level: number }, i: number) => ({ id: `new-o${i}`, display_order: i + 1, ...o })),
        personas: (data.personas ?? []).map((p: { persona: string; persona_weight: number }, i: number) => ({ id: `new-p${i}`, ...p })),
      }
      questions.push(created)
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) })
    }
    return route.fallback()
  })

  await page.route('**/api/admin/questions/*', (route) => {
    const req = route.request()
    const method = req.method()
    const id = req.url().split('/').pop()!
    const idx = questions.findIndex((q) => q.id === id)
    if (idx === -1) return route.fulfill({ status: 404, body: '{}' })

    if (method === 'PUT') {
      const data = req.postDataJSON()
      questions[idx] = { ...questions[idx], ...data }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(questions[idx]) })
    }
    if (method === 'DELETE') {
      questions[idx] = { ...questions[idx], is_active: false }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(questions[idx]) })
    }
    return route.fallback()
  })
}

async function gotoQuestions(page: Page) {
  await page.goto(`/admin/pillars/${PILLAR_ID}/questions`)
  await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible()
}

test.describe('QuestionsPage', () => {
  test('lists questions with order badge, general/persona info, and weight', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await expect(page.getByText('How do you currently monitor application performance?')).toBeVisible()
    await expect(page.getByText('w: 1.5')).toBeVisible()
    await expect(page.getByText('1 persona')).toBeVisible()
    await expect(page.getByText('General')).toBeVisible()
    await expect(page.getByText('w: 1', { exact: true })).toBeVisible()
  })

  test('shows a placeholder in the form panel until a question is selected or created', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await expect(page.getByText('Select a question to edit, or click + New')).toBeVisible()
  })

  test('clicking a question opens the edit form pre-filled with its data', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByText('How do you currently monitor application performance?').click()
    await expect(page.getByRole('heading', { name: 'Edit Question' })).toBeVisible()
    await expect(page.locator('textarea').first()).toHaveValue('How do you currently monitor application performance?')
    await expect(page.getByText('Level 3 — Defined')).toBeVisible()
  })

  test('creating a new question requires text and all four answer options', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByRole('button', { name: '+ New' }).click()
    await expect(page.getByRole('heading', { name: 'New Question' })).toBeVisible()

    const save = page.getByRole('button', { name: 'Create Question' })
    await expect(save).toBeDisabled()

    const textareas = page.locator('textarea')
    await textareas.nth(0).fill('How do you test observability instrumentation changes?')
    await textareas.nth(1).fill('No testing of instrumentation changes')
    await textareas.nth(2).fill('Manual spot-checks before release')
    await textareas.nth(3).fill('Automated tests in CI')
    await textareas.nth(4).fill('Automated tests plus synthetic monitoring in production')
    await expect(save).toBeEnabled()
    await save.click()

    await expect(page.getByText('Select a question to edit, or click + New')).toBeVisible()
    await expect(page.getByText('How do you test observability instrumentation changes?')).toBeVisible()
  })

  test('unchecking "Show to all personas" reveals the personas grid', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByRole('button', { name: '+ New' }).click()
    await expect(page.getByText('Personas', { exact: true })).toBeVisible()

    await page.getByLabel('Show to all personas').check()
    await expect(page.getByText('Personas', { exact: true })).toHaveCount(0)

    await page.getByLabel('Show to all personas').uncheck()
    await expect(page.getByText('Personas', { exact: true })).toBeVisible()
    await expect(page.getByText('SRE / Platform Engineer')).toBeVisible()
  })

  test('adding and removing a context tag', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByRole('button', { name: '+ New' }).click()
    const tagInput = page.getByPlaceholder('e.g. kubernetes, aws (Enter to add)')
    await tagInput.fill('AWS Lambda')
    await tagInput.press('Enter')
    await expect(page.getByText('aws_lambda')).toBeVisible()

    await page.locator('span', { hasText: 'aws_lambda' }).getByRole('button').click()
    await expect(page.getByText('aws_lambda')).toHaveCount(0)
  })

  test('editing a question updates its text in the list', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByText('How do you currently monitor application performance?').click()
    await page.locator('textarea').first().fill('How do you monitor application performance today?')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.getByText('How do you monitor application performance today?')).toBeVisible()
  })

  test('deactivating a question from the edit form updates its status', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByText('How do you currently monitor application performance?').click()
    await page.getByRole('button', { name: 'Deactivate' }).click()

    await expect(page.getByText('Select a question to edit, or click + New')).toBeVisible()
    await page.getByText('How do you currently monitor application performance?').click()
    await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible()
  })

  test('Cancel closes the form without saving', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)

    await page.getByRole('button', { name: '+ New' }).click()
    await page.locator('textarea').first().fill('This question should not be saved')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Select a question to edit, or click + New')).toBeVisible()
    await expect(page.getByText('This question should not be saved')).toHaveCount(0)
  })

  test('shows an empty state when the pillar has no questions', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page, [])
    await gotoQuestions(page)

    await expect(page.getByText('No questions yet.')).toBeVisible()
  })

  test('a failed fetch shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await page.route(`**/api/admin/pillars/${PILLAR_ID}/questions**`, (route) => route.fulfill({ status: 500, body: '{}' }))

    await page.goto(`/admin/pillars/${PILLAR_ID}/questions`)
    await expect(page.getByText('Failed to load questions.')).toBeVisible()
  })

  test('a non-admin internal user is redirected to the dashboard', async ({ page }) => {
    await seedAuth(page, { id: 'u2', name: 'Jane Internal', email: 'jane@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-02T00:00:00Z' })
    await page.route('**/api/accounts?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 25 }) })
    )
    await page.route('**/api/pillars?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }) })
    )

    await page.goto(`/admin/pillars/${PILLAR_ID}/questions`)
    await expect(page).toHaveURL('/dashboard')
  })

  test('an unauthenticated visit is redirected to /login', async ({ page }) => {
    await page.goto(`/admin/pillars/${PILLAR_ID}/questions`)
    await expect(page).toHaveURL(/\/login$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockQuestionsApi(page)
    await gotoQuestions(page)
    await page.getByText('How do you currently monitor application performance?').click()

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

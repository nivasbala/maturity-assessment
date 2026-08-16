import { test, expect, type Page } from '@playwright/test'

const ACCOUNT_ID = 'acc-1'
const PROSPECT_ID = 'pr-1'

const PROSPECT = {
  id: PROSPECT_ID,
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
  assessments: [
    {
      pillar_id: 'p1',
      pillar_name: 'Full-Stack Observability',
      display_order: 1,
      assessment_id: 'as-1',
      status: 'completed',
      pillar_score: 3.25,
      maturity_label: 'Defined',
      completed_at: '2026-01-10T00:00:00Z',
    },
    {
      pillar_id: 'p2',
      pillar_name: 'AIOps & Intelligent Observability',
      display_order: 2,
      assessment_id: 'as-2',
      status: 'in_progress',
      pillar_score: null,
      maturity_label: null,
      completed_at: null,
    },
    {
      pillar_id: 'p5',
      pillar_name: 'Security & DevSecOps',
      display_order: 5,
      assessment_id: 'as-5',
      status: 'completed',
      pillar_score: 2.5,
      maturity_label: 'Developing',
      completed_at: '2026-01-11T00:00:00Z',
    },
    {
      pillar_id: 'p4',
      pillar_name: 'ML & Foundation Model Operations',
      display_order: 4,
      assessment_id: null,
      status: null,
      pillar_score: null,
      maturity_label: null,
      completed_at: null,
    },
  ],
}

const AGGREGATE = {
  prospect_id: PROSPECT_ID,
  prospect_name: 'Jane Smith',
  prospect_email: 'jane@acme.com',
  completed_count: 2,
  assessments: [
    { pillar_name: 'Full-Stack Observability', display_order: 1, pillar_score: 3.25, maturity_label: 'Defined', prospect_name: 'Jane Smith', prospect_email: 'jane@acme.com' },
    { pillar_name: 'Security & DevSecOps', display_order: 5, pillar_score: 2.5, maturity_label: 'Developing', prospect_name: 'Jane Smith', prospect_email: 'jane@acme.com' },
  ],
}

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'fake-token')
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u1', name: 'Jane Internal', email: 'internal@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-01T00:00:00Z' })
    )
  })
}

async function mockProspectDetail(page: Page, prospect: unknown = PROSPECT) {
  await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}`, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prospect) })
  })
}

async function gotoProspect(page: Page) {
  await page.goto(`/dashboard/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}`)
  await expect(page.getByRole('heading', { name: 'Jane Smith' })).toBeVisible()
}

test.describe('ProspectDetailPage', () => {
  test('shows prospect info and the per-pillar assessments table', async ({ page }) => {
    await seedAuth(page)
    await mockProspectDetail(page)
    await gotoProspect(page)

    await expect(page.getByText('jane@acme.com')).toBeVisible()
    await expect(page.getByText('http://localhost:5173/assess/tok-1')).toBeVisible()

    await expect(page.getByRole('cell', { name: 'Full-Stack Observability' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Completed' }).first()).toBeVisible()
    await expect(page.getByText('3.25')).toBeVisible()
    await expect(page.getByText('Defined')).toBeVisible()
    await expect(page.getByRole('link', { name: 'View Report' }).first()).toBeVisible()

    await expect(page.getByText('In Progress')).toBeVisible()
    await expect(page.getByText('Not started')).toBeVisible()
  })

  test('back button defaults to "Account" when arriving directly', async ({ page }) => {
    await seedAuth(page)
    await mockProspectDetail(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: ACCOUNT_ID, company_name: 'Acme Corp', company_website: null, internal_user_id: 'u1', internal_user_name: 'Jane Internal', suggested_pillars: [], created_at: '2026-01-01T00:00:00Z', pillar_statuses: [] }),
      })
    )
    await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )

    await gotoProspect(page)
    await page.getByRole('button', { name: '← Account' }).click()
    await expect(page).toHaveURL(`/dashboard/accounts/${ACCOUNT_ID}`)
  })

  test('back button reads "Prospects" when arriving from the prospects list', async ({ page }) => {
    await seedAuth(page)
    await page.route('**/api/accounts/all-prospects', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...PROSPECT, company_name: 'Acme Corp', internal_user_name: 'Jane Internal' }]),
      })
    )
    await mockProspectDetail(page)

    await page.goto('/prospects')
    await page.getByText('jane@acme.com').click()
    await expect(page).toHaveURL(`/dashboard/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}`)
    await expect(page.getByRole('button', { name: '← Prospects' })).toBeVisible()

    await page.getByRole('button', { name: '← Prospects' }).click()
    await expect(page).toHaveURL('/prospects')
  })

  test('resetting an assessment asks for confirmation and clears its status', async ({ page }) => {
    await seedAuth(page)
    await mockProspectDetail(page)
    await page.route('**/api/assessments/as-1/reset', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    )

    await gotoProspect(page)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('button', { name: 'Reset' }).click()

    await expect(page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('cell', { name: 'Pending' })).toBeVisible()
    await expect(page.getByRole('row', { name: /Full-Stack Observability/ }).getByRole('button', { name: 'Reset' })).toHaveCount(0)
  })

  test('Aggregate tab requires at least 2 completed assessments', async ({ page }) => {
    await seedAuth(page)
    // Only one completed assessment — below the 2-completed threshold for the aggregate view.
    await mockProspectDetail(page, {
      ...PROSPECT,
      assessments: [PROSPECT.assessments[0], PROSPECT.assessments[1], PROSPECT.assessments[3]],
    })

    await gotoProspect(page)
    await page.getByRole('button', { name: 'Aggregate View' }).click()
    await expect(page.getByText('Aggregate view requires at least 2 completed assessments for this prospect.')).toBeVisible()
  })

  test('Aggregate tab shows the radar chart and per-pillar table when enough assessments are completed', async ({ page }) => {
    await seedAuth(page)
    await mockProspectDetail(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}/aggregate`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AGGREGATE) })
    )

    await gotoProspect(page)
    await page.getByRole('button', { name: 'Aggregate View' }).click()

    await expect(page.getByText('Maturity across all 2 completed pillars for this prospect.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Security & DevSecOps' })).toBeVisible()
    await expect(page.getByText('2.50')).toBeVisible()
    await expect(page.getByText('Developing')).toBeVisible()
  })

  test('Aggregate tab shows a specific message on a 404', async ({ page }) => {
    await seedAuth(page)
    await mockProspectDetail(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}/aggregate`, (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    )

    await gotoProspect(page)
    await page.getByRole('button', { name: 'Aggregate View' }).click()
    await expect(page.getByText('Aggregate view requires at least 2 completed assessments.')).toBeVisible()
  })

  test('a failed prospect fetch shows an error instead of the page', async ({ page }) => {
    await seedAuth(page)
    await page.route(`**/api/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}`, (route) => route.fulfill({ status: 500, body: '{}' }))

    await page.goto(`/dashboard/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}`)
    await expect(page.getByText('Failed to load prospect')).toBeVisible()
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockProspectDetail(page)
    await gotoProspect(page)

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

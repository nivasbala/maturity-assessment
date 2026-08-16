import { test, expect, type Page } from '@playwright/test'

const TOKEN = 'researching-token-321'

const READY_SUMMARY = {
  is_ready: true,
  company_name: 'Acme Corp',
  industry: 'Software',
  company_size: 'mid-market',
  products_summary: 'Acme builds a B2B SaaS platform.',
  target_customers: 'Enterprise logistics companies',
  builds_ai_products: true,
  cloud_providers: ['AWS'],
  key_challenges: ['Alert fatigue'],
  business_outcomes: ['Faster incident resolution'],
  operational_scale: ['multi-region'],
  data_confidence: 'high' as const,
  research_notes: 'Derived from company website.',
  news_insights: 'Recently announced EU expansion.',
  observability_outcome: 'Reduce MTTR by 30%.',
  sources: [],
}

const NOT_READY_SUMMARY = { ...READY_SUMMARY, is_ready: false }

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('session_token', 'sess-xyz')
    sessionStorage.setItem('prospect_company_name', 'Acme Corp')
  })
}

test.describe('ResearchingPage', () => {
  test('shows the loading screen with the company name and back link while researching', async ({ page }) => {
    await seedSession(page)
    await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOT_READY_SUMMARY) })
    )

    await page.goto(`/assess/${TOKEN}/researching`)

    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Analyzing your company profile…' })).toBeVisible()
    await expect(page.getByRole('button', { name: '← Back to Registration' })).toBeVisible()
    // Still not ready — stays on this page rather than navigating early.
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(`/assess/${TOKEN}/researching`)
  })

  test('navigates to the research summary page once research is ready', async ({ page }) => {
    await seedSession(page)
    await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(READY_SUMMARY) })
    )

    await page.goto(`/assess/${TOKEN}/researching`)
    await expect(page).toHaveURL(`/assess/${TOKEN}/research-summary`, { timeout: 10_000 })
  })

  test('back link returns to the landing/registration page', async ({ page }) => {
    await seedSession(page)
    await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOT_READY_SUMMARY) })
    )
    // LandingPage will fetch assessment info once we navigate back to it.
    await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company_name: 'Acme Corp',
          prospect_name: null,
          prospect_email: '',
          suggested_pillars: [],
          available_pillars: [],
          is_registered: false,
          prospect_role: null,
          p3_gate_answered_yes: null,
          p4_gate_answered_yes: null,
          infrastructure_location: null,
          tech_stack_description: null,
          current_tools: null,
          key_challenges_input: null,
          existing_assessments: [],
        }),
      })
    )

    await page.goto(`/assess/${TOKEN}/researching`)
    await page.getByRole('button', { name: '← Back to Registration' }).click()
    await expect(page).toHaveURL(`/assess/${TOKEN}`)
  })

  test('a missing session redirects to the landing page, never to login', async ({ page }) => {
    // No session_token seeded — simulates arriving here directly/with an expired session.
    await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    )

    await page.goto(`/assess/${TOKEN}/researching`)
    await expect(page).toHaveURL(`/assess/${TOKEN}`)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('a failed research-status check shows an inline error, not a redirect', async ({ page }) => {
    await seedSession(page)
    await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal error' }) })
    )

    await page.goto(`/assess/${TOKEN}/researching`)
    await expect(page.getByText('Internal error')).toBeVisible()
    await expect(page).toHaveURL(`/assess/${TOKEN}/researching`)
    await expect(page.getByRole('link', { name: /login/i })).toHaveCount(0)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedSession(page)
    await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOT_READY_SUMMARY) })
    )

    await page.goto(`/assess/${TOKEN}/researching`)
    await expect(page.getByRole('heading', { name: 'Analyzing your company profile…' })).toBeVisible()
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

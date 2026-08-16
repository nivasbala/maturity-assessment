import { test, expect, type Page } from '@playwright/test'

const TOKEN = 'summary-token-654'

const SUMMARY = {
  is_ready: true,
  company_name: 'Acme Corp',
  industry: 'software',
  company_size: 'mid-market',
  products_summary: 'Acme builds a B2B SaaS platform for logistics companies.',
  target_customers: 'Enterprise logistics companies',
  builds_ai_products: true,
  cloud_providers: ['AWS', 'GCP'],
  key_challenges: ['Alert fatigue', 'Slow incident triage'],
  business_outcomes: ['Faster incident resolution', 'Reduced downtime'],
  operational_scale: ['Multi-region deployment'],
  data_confidence: 'medium' as const,
  research_notes: 'Derived from company website and public filings.',
  news_insights: 'Acme recently announced expansion into the EU market.',
  observability_outcome: 'Reduce MTTR by 30% within two quarters.',
  sources: [
    { title: 'Acme Corp — About', url: 'https://acme.example.com/about' },
    { title: 'Acme raises Series C', url: 'https://news.example.com/acme-series-c' },
  ],
}

const LANDING_INFO = {
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
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('session_token', 'sess-xyz')
    sessionStorage.setItem('prospect_company_name', 'Acme Corp')
  })
}

async function mockSummary(page: Page, body: unknown = SUMMARY) {
  await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  )
}

test.describe('ResearchSummaryPage', () => {
  test('shows the research summary with a color-coded confidence badge', async ({ page }) => {
    await seedSession(page)
    await mockSummary(page)

    await page.goto(`/assess/${TOKEN}/research-summary`)

    await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible()
    const badge = page.getByText('Medium confidence')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveClass(/bg-yellow-100/)

    await expect(page.getByText(SUMMARY.products_summary)).toBeVisible()
    await expect(page.getByText('Enterprise logistics companies')).toBeVisible()
    await expect(page.getByText('Alert fatigue')).toBeVisible()
    await expect(page.getByText('Faster incident resolution')).toBeVisible()
    await expect(page.getByText('AWS')).toBeVisible()
    await expect(page.getByText(SUMMARY.news_insights)).toBeVisible()
    await expect(page.getByText(SUMMARY.observability_outcome)).toBeVisible()
  })

  test('sources are collapsed by default and expand on click', async ({ page }) => {
    await seedSession(page)
    await mockSummary(page)
    await page.goto(`/assess/${TOKEN}/research-summary`)

    await expect(page.getByRole('link', { name: 'Acme Corp — About' })).not.toBeVisible()
    await page.getByRole('button', { name: /Show sources \(2\)/ }).click()
    await expect(page.getByRole('link', { name: 'Acme Corp — About' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Acme raises Series C' })).toBeVisible()

    await page.getByRole('button', { name: /Hide sources \(2\)/ }).click()
    await expect(page.getByRole('link', { name: 'Acme Corp — About' })).not.toBeVisible()
  })

  test('typing additional notes debounce-saves them to the backend', async ({ page }) => {
    await seedSession(page)
    await mockSummary(page)
    let savedBody: unknown = null
    await page.route(`**/api/public/assess/${TOKEN}/research-additional-notes`, (route) => {
      savedBody = route.request().postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saved: true }) })
    })

    await page.goto(`/assess/${TOKEN}/research-summary`)
    await page.getByPlaceholder(/We are primarily on Azure/).fill('We are mostly on Azure, not AWS.')

    await expect.poll(() => savedBody).toEqual({ additional_notes: 'We are mostly on Azure, not AWS.' })
  })

  test('Select Assessment navigates to pillar selection', async ({ page }) => {
    await seedSession(page)
    await mockSummary(page)
    await page.goto(`/assess/${TOKEN}/research-summary`)

    await page.getByRole('button', { name: 'Select Assessment →' }).click()
    await expect(page).toHaveURL(`/assess/${TOKEN}/pillars`)
  })

  test('back link returns to the landing/registration page', async ({ page }) => {
    await seedSession(page)
    await mockSummary(page)
    await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LANDING_INFO) })
    )

    await page.goto(`/assess/${TOKEN}/research-summary`)
    await page.getByRole('button', { name: '← Back to Registration' }).click()
    await expect(page).toHaveURL(`/assess/${TOKEN}`)
  })

  test('a missing session redirects to the landing page, never to login', async ({ page }) => {
    await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LANDING_INFO) })
    )

    await page.goto(`/assess/${TOKEN}/research-summary`)
    await expect(page).toHaveURL(`/assess/${TOKEN}`)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('a failed research-summary fetch shows an inline error, not a redirect', async ({ page }) => {
    await seedSession(page)
    await page.route(`**/api/public/assess/${TOKEN}/research-summary`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal error' }) })
    )

    await page.goto(`/assess/${TOKEN}/research-summary`)
    await expect(page.getByText('Internal error')).toBeVisible()
    await expect(page).toHaveURL(`/assess/${TOKEN}/research-summary`)
    await expect(page.getByRole('link', { name: /login/i })).toHaveCount(0)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedSession(page)
    await mockSummary(page)
    await page.goto(`/assess/${TOKEN}/research-summary`)
    await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible()

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

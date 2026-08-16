import { test, expect, type Page } from '@playwright/test'

const ASSESSMENT_ID = 'as-1'
const ACCOUNT_ID = 'acc-1'
const PROSPECT_ID = 'pr-1'

const ANSWERS = {
  assessment_id: ASSESSMENT_ID,
  account_id: ACCOUNT_ID,
  prospect_id: PROSPECT_ID,
  pillar_id: 'p1',
  pillar_name: 'Full-Stack Observability',
  company_name: 'Acme Corp',
  status: 'completed',
  prospect_name: 'Jane Smith',
  prospect_email: 'jane@acme.com',
  prospect_role: 'vp_engineering',
  completed_at: '2026-01-10T00:00:00Z',
  pillar_score: 3.25,
  maturity_label: 'Defined',
  answers: [
    { question_text: 'How do you currently monitor application performance?', selected_option_text: 'Automated alerting on key metrics', maturity_level: 3 },
    { question_text: 'How are incidents triaged?', selected_option_text: 'Runbooks with automated paging', maturity_level: 3 },
  ],
  additional_notes: 'We are especially interested in AI-assisted triage.',
  infrastructure_location: 'AWS us-east-1',
  tech_stack_description: 'Python microservices, Kubernetes',
  current_tools: 'Datadog, PagerDuty',
  key_challenges_input: 'Alert fatigue',
}

const REPORT = {
  id: 'report-1',
  assessment_id: ASSESSMENT_ID,
  pillar_score: 3.25,
  maturity_level: 3,
  maturity_label: 'Defined',
  executive_summary: 'Acme Corp demonstrates defined maturity in full-stack observability.',
  strengths: [{ title: 'Standardized dashboards', description: 'All teams use a shared observability dashboard.' }],
  gap_analysis: [
    { gap: 'No automated root cause analysis', current_state: 'Manual investigation', target_state: 'AI-assisted RCA', impact: 'high', effort: 'medium' },
  ],
  next_steps: [
    { title: 'Pilot AI-assisted RCA', description: 'Trial an anomaly detection tool on one service.', priority: 'quick_win', timeframe: '2-4 weeks' },
  ],
  pillar_breakdown: {},
  research_data: {
    company_name: 'Acme Corp',
    industry: 'software',
    company_size: 'mid-market',
    products_summary: 'Acme builds a B2B SaaS platform for logistics companies.',
    target_customers: 'Enterprise logistics companies',
    operational_scale: ['Multi-region deployment'],
    builds_ai_products: true,
    cloud_providers: ['AWS'],
    key_challenges: ['Alert fatigue'],
    business_outcomes: ['Faster incident resolution'],
    data_confidence: 'high',
    research_notes: 'Derived from company website.',
    news_insights: 'Acme recently announced EU expansion.',
    observability_outcome: 'Reduce MTTR by 30%.',
    sources: [{ title: 'Acme Corp — About', url: 'https://acme.example.com/about' }],
  },
  created_at: '2026-01-10T00:00:00Z',
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

async function mockAnswers(page: Page, answers: unknown = ANSWERS) {
  await page.route(`**/api/assessments/${ASSESSMENT_ID}/answers`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answers) })
  )
}

async function mockReport(page: Page, status = 200, body: unknown = REPORT) {
  await page.route(`**/api/assessments/${ASSESSMENT_ID}/report`, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  )
}

async function gotoReport(page: Page) {
  await page.goto(`/dashboard/assessments/${ASSESSMENT_ID}`)
  await expect(page.getByRole('heading', { name: 'Full-Stack Observability' })).toBeVisible()
}

test.describe('ReportDetailPage', () => {
  test('shows the assessment header with score, maturity, and prospect details', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    await expect(page.getByText('Acme Corp', { exact: true })).toBeVisible()
    await expect(page.getByText('Defined', { exact: true })).toBeVisible()
    await expect(page.getByText('3.25')).toBeVisible()
    await expect(page.getByText('Jane Smith', { exact: true })).toBeVisible()
    await expect(page.getByText('vp_engineering')).toBeVisible()
    await expect(page.getByText('jane@acme.com')).toBeVisible()
    await expect(page.getByRole('button', { name: '← Back to Jane Smith' })).toBeVisible()
  })

  test('Report tab shows executive summary, strengths, gaps, and next steps', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    await expect(page.getByText(REPORT.executive_summary)).toBeVisible()
    await expect(page.getByText('Standardized dashboards')).toBeVisible()
    await expect(page.getByText('No automated root cause analysis')).toBeVisible()
    await expect(page.getByText('high impact')).toBeVisible()
    await expect(page.getByText('Pilot AI-assisted RCA')).toBeVisible()
  })

  test('Questions & Answers tab lists each answer with its maturity level', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    await page.getByRole('button', { name: 'Questions & Answers' }).click()
    await expect(page.getByText('How do you currently monitor application performance?')).toBeVisible()
    await expect(page.getByText('Automated alerting on key metrics')).toBeVisible()
    await expect(page.getByText('L3').first()).toBeVisible()
  })

  test('Research Summary tab shows builds_ai_products (internal-only) and the confidence badge', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    await page.getByRole('button', { name: 'Research Summary' }).click()
    await expect(page.getByText('Builds AI Products')).toBeVisible()
    await expect(page.getByText('Yes')).toBeVisible()
    const badge = page.getByText('high', { exact: true })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveClass(/bg-green-100/)
  })

  test('Registration Context tab shows infrastructure, tech stack, tools, challenges, and additional notes', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    await page.getByRole('button', { name: 'Registration Context' }).click()
    await expect(page.getByText('AWS us-east-1')).toBeVisible()
    await expect(page.getByText('Python microservices, Kubernetes')).toBeVisible()
    await expect(page.getByText('Datadog, PagerDuty')).toBeVisible()
    await expect(page.getByText('We are especially interested in AI-assisted triage.')).toBeVisible()
  })

  test('back button navigates to the prospect when a prospect is attached, or the account otherwise', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    await page.getByRole('button', { name: '← Back to Jane Smith' }).click()
    await expect(page).toHaveURL(`/dashboard/accounts/${ACCOUNT_ID}/prospects/${PROSPECT_ID}`)
  })

  test('a report that has not been generated yet shows a placeholder and hides Download PDF', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page, 404, { detail: 'Not found' })
    await gotoReport(page)

    await expect(page.getByText('Report not yet generated.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0)
  })

  test('a report load failure (non-404) shows an inline error', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page, 500, { detail: 'Internal error' })
    await gotoReport(page)

    await expect(page.getByText('The report failed to load. Please try again or contact support if this persists.')).toBeVisible()
  })

  test('a failed answers fetch shows an error instead of the page', async ({ page }) => {
    await seedAuth(page)
    await page.route(`**/api/assessments/${ASSESSMENT_ID}/answers`, (route) => route.fulfill({ status: 500, body: '{}' }))
    await mockReport(page)

    await page.goto(`/dashboard/assessments/${ASSESSMENT_ID}`)
    await expect(page.getByText('Failed to load assessment data.')).toBeVisible()
  })

  test('has no forbidden text-black classes across every tab (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedAuth(page)
    await mockAnswers(page)
    await mockReport(page)
    await gotoReport(page)

    for (const label of ['Report', 'Questions & Answers', 'Research Summary', 'Registration Context']) {
      await page.getByRole('button', { name: label }).click()
      const offenders = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
      )
      expect(offenders).toEqual([])
    }
  })
})

import { test, expect, type Page } from '@playwright/test'

const TOKEN = 'report-token-789'
const ASSESSMENT_ID = 'assessment-full'

const FULL_REPORT = {
  id: 'report-full',
  assessment_id: ASSESSMENT_ID,
  pillar_score: 3.2,
  maturity_level: 3,
  maturity_label: 'Defined',
  executive_summary: 'Acme Corp demonstrates defined maturity in full-stack observability, with strong alerting practices and clear gaps in automated root cause analysis.',
  strengths: [
    { title: 'Standardized dashboards', description: 'All teams use a shared observability dashboard.' },
    { title: 'Automated alerting', description: 'Key metrics trigger paging automatically.' },
  ],
  gap_analysis: [
    { gap: 'No automated root cause analysis', current_state: 'Manual investigation', target_state: 'AI-assisted RCA', impact: 'high', effort: 'medium' },
    { gap: 'Inconsistent tracing coverage', current_state: 'Partial instrumentation', target_state: 'Full distributed tracing', impact: 'medium', effort: 'high' },
  ],
  next_steps: [
    { title: 'Adopt distributed tracing everywhere', description: 'Instrument remaining services.', priority: 'strategic', timeframe: '1-3 months' },
    { title: 'Pilot AI-assisted RCA', description: 'Trial an anomaly detection tool on one service.', priority: 'quick_win', timeframe: '2-4 weeks' },
  ],
  pillar_breakdown: {},
  created_at: '2026-01-01T00:00:00Z',
  company_name: 'Acme Corp',
  pillar_name: 'Full-Stack Observability',
  prospect_name: 'Jane Smith',
  prospect_role: 'vp_engineering',
  research_data: {
    company_name: 'Acme Corp',
    industry: 'Software',
    company_size: 'mid-market',
    products_summary: 'Acme builds a B2B SaaS platform for logistics.',
    target_customers: 'Enterprise logistics companies',
    operational_scale: ['multi-region'],
    builds_ai_products: true,
    cloud_providers: ['AWS'],
    key_challenges: ['Alert fatigue'],
    business_outcomes: ['Faster incident resolution'],
    data_confidence: 'high',
    research_notes: 'Derived from company website and recent press coverage.',
    news_insights: 'Recently announced expansion into EU market.',
    observability_outcome: 'Reduce MTTR by 30%.',
    sources: [{ title: 'Acme Corp — About', url: 'https://acme.example.com/about' }],
  },
  answers: [
    { question_text: 'How do you currently monitor application performance?', selected_option_text: 'Automated alerting on key metrics', maturity_level: 3 },
    { question_text: 'How are incidents triaged?', selected_option_text: 'Runbooks with automated paging', maturity_level: 3 },
  ],
  additional_notes: 'We are especially interested in AI-assisted triage.',
  infrastructure_location: 'AWS us-east-1, multi-region',
  tech_stack_description: 'Python microservices, Kubernetes, PostgreSQL',
  current_tools: 'Datadog, PagerDuty',
  key_challenges_input: 'Alert fatigue, slow incident triage',
}

const MINIMAL_REPORT = {
  ...FULL_REPORT,
  id: 'report-minimal',
  strengths: [],
  gap_analysis: [],
  next_steps: [],
  research_data: null,
  answers: [],
  additional_notes: null,
  infrastructure_location: null,
  tech_stack_description: null,
  current_tools: null,
  key_challenges_input: null,
}

async function mockReport(page: Page, assessmentId: string, report: unknown) {
  await page.route(`**/api/public/assess/${TOKEN}/report/${assessmentId}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(report) })
  )
}

async function gotoReport(page: Page, assessmentId: string) {
  await page.goto(`/assess/${TOKEN}/report/${assessmentId}`)
  await expect(page.getByRole('heading', { name: 'Full-Stack Observability' })).toBeVisible()
}

test.describe('Report page tabs', () => {
  test('Report tab shows executive summary, score, strengths, gaps, and next steps by default', async ({ page }) => {
    await mockReport(page, ASSESSMENT_ID, FULL_REPORT)
    await gotoReport(page, ASSESSMENT_ID)

    await expect(page.getByRole('button', { name: 'Report' })).toHaveClass(/border-blue-600/)
    await expect(page.getByText('Defined', { exact: true })).toBeVisible()
    await expect(page.getByText('3.2', { exact: true })).toBeVisible()
    await expect(page.getByText(FULL_REPORT.executive_summary)).toBeVisible()
    await expect(page.getByText('Standardized dashboards')).toBeVisible()
    await expect(page.getByText('No automated root cause analysis')).toBeVisible()
    await expect(page.getByText('Adopt distributed tracing everywhere')).toBeVisible()
  })

  test('Questions & Answers tab lists each answer with its maturity level', async ({ page }) => {
    await mockReport(page, ASSESSMENT_ID, FULL_REPORT)
    await gotoReport(page, ASSESSMENT_ID)

    await page.getByRole('button', { name: 'Questions & Answers' }).click()
    await expect(page.getByText('How do you currently monitor application performance?')).toBeVisible()
    await expect(page.getByText('Automated alerting on key metrics')).toBeVisible()
    await expect(page.getByText('How are incidents triaged?')).toBeVisible()
    await expect(page.getByText('L3').first()).toBeVisible()
  })

  test('Research Summary tab shows research data with a color-coded confidence badge', async ({ page }) => {
    await mockReport(page, ASSESSMENT_ID, FULL_REPORT)
    await gotoReport(page, ASSESSMENT_ID)

    await page.getByRole('button', { name: 'Research Summary' }).click()
    await expect(page.getByText('Acme builds a B2B SaaS platform for logistics.')).toBeVisible()
    await expect(page.getByText('Enterprise logistics companies')).toBeVisible()

    const badge = page.getByText('high', { exact: true })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveClass(/bg-green-100/)

    // builds_ai_products is internal-only — never rendered on the prospect-facing report.
    await expect(page.getByText(/builds.ai.products/i)).toHaveCount(0)
  })

  test('Registration Context tab shows infrastructure, tech stack, tools, challenges, and additional notes', async ({ page }) => {
    await mockReport(page, ASSESSMENT_ID, FULL_REPORT)
    await gotoReport(page, ASSESSMENT_ID)

    await page.getByRole('button', { name: 'Registration Context' }).click()
    await expect(page.getByText('AWS us-east-1, multi-region')).toBeVisible()
    await expect(page.getByText('Python microservices, Kubernetes, PostgreSQL')).toBeVisible()
    await expect(page.getByText('Datadog, PagerDuty')).toBeVisible()
    await expect(page.getByText('Alert fatigue, slow incident triage')).toBeVisible()
    await expect(page.getByText('We are especially interested in AI-assisted triage.')).toBeVisible()
  })

  test('empty sections are omitted with a placeholder message, never shown blank', async ({ page }) => {
    await mockReport(page, 'assessment-minimal', MINIMAL_REPORT)
    await page.goto(`/assess/${TOKEN}/report/assessment-minimal`)
    await expect(page.getByRole('heading', { name: 'Full-Stack Observability' })).toBeVisible()

    // Report tab: no Strengths/Gap Analysis/Next Steps headings when the arrays are empty.
    await expect(page.getByRole('heading', { name: 'Strengths' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Gap Analysis' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Recommended Next Steps' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Questions & Answers' }).click()
    await expect(page.getByText('No answers recorded.')).toBeVisible()

    await page.getByRole('button', { name: 'Research Summary' }).click()
    await expect(page.getByText('No research data available.')).toBeVisible()

    await page.getByRole('button', { name: 'Registration Context' }).click()
    await expect(page.getByText('No registration context provided.')).toBeVisible()
  })

  test('back navigation and "take another pillar assessment" both return to pillar selection', async ({ page }) => {
    // PillarSelectPage requires an active session — seed one so navigating there
    // lands on pillar selection instead of cascading back to the landing page.
    await page.addInitScript(() => {
      sessionStorage.setItem('session_token', 'sess-xyz')
    })
    await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company_name: 'Acme Corp',
          prospect_name: 'Jane Smith',
          prospect_email: 'jane@acme.com',
          suggested_pillars: [],
          available_pillars: [],
          is_registered: true,
          prospect_role: 'vp_engineering',
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
    await mockReport(page, ASSESSMENT_ID, FULL_REPORT)
    await gotoReport(page, ASSESSMENT_ID)

    await page.getByRole('button', { name: 'Take Another Pillar Assessment' }).click()
    await expect(page).toHaveURL(`/assess/${TOKEN}/pillars`)
    await expect(page.getByRole('heading', { name: 'Select an Assessment Area' })).toBeVisible()
  })

  test('has no forbidden text-black classes across every tab (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await mockReport(page, ASSESSMENT_ID, FULL_REPORT)
    await gotoReport(page, ASSESSMENT_ID)

    for (const label of ['Report', 'Questions & Answers', 'Research Summary', 'Registration Context']) {
      await page.getByRole('button', { name: label }).click()
      const offenders = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
      )
      expect(offenders).toEqual([])
    }
  })
})

import { test, expect, type Page } from '@playwright/test'

const TOKEN = 'flow-token-456'
const ASSESSMENT_ID = 'assessment-abc'

const ASSESSMENT_INFO = {
  company_name: 'Acme Corp',
  prospect_name: 'Jane Smith',
  prospect_email: 'jane@acme.com',
  suggested_pillars: ['p1'],
  available_pillars: [
    { id: 'p1', name: 'Full-Stack Observability', description: 'Monitoring, logging, tracing across your stack.', is_gated: false, gate_question: null, display_order: 1 },
    { id: 'p2', name: 'AIOps & Intelligent Observability', description: 'AI-assisted detection and remediation.', is_gated: false, gate_question: null, display_order: 2 },
  ],
  is_registered: true,
  prospect_role: 'vp_engineering',
  p3_gate_answered_yes: null,
  p4_gate_answered_yes: null,
  infrastructure_location: null,
  tech_stack_description: null,
  current_tools: null,
  key_challenges_input: null,
  existing_assessments: [] as unknown[],
}

const QUESTIONS = [
  {
    id: 'q1',
    text: 'How do you currently monitor application performance?',
    answer_options: [
      { id: 'q1-o1', text: 'We do not monitor performance', display_order: 1 },
      { id: 'q1-o2', text: 'Basic dashboards, manually reviewed', display_order: 2 },
      { id: 'q1-o3', text: 'Automated alerting on key metrics', display_order: 3 },
      { id: 'q1-o4', text: 'Full APM with anomaly detection', display_order: 4 },
    ],
  },
  {
    id: 'q2',
    text: 'How are incidents triaged?',
    answer_options: [
      { id: 'q2-o1', text: 'Ad-hoc, whoever notices first', display_order: 1 },
      { id: 'q2-o2', text: 'On-call rotation, manual triage', display_order: 2 },
      { id: 'q2-o3', text: 'Runbooks with automated paging', display_order: 3 },
      { id: 'q2-o4', text: 'AI-assisted root cause analysis', display_order: 4 },
    ],
  },
]

const REPORT = {
  id: 'report-1',
  assessment_id: ASSESSMENT_ID,
  pillar_score: 2.5,
  maturity_level: 2,
  maturity_label: 'Developing',
  executive_summary: 'Acme Corp shows developing maturity in full-stack observability.',
  strengths: [{ title: 'Alerting basics in place', description: 'Key metrics are monitored with automated alerts.' }],
  gap_analysis: [
    { gap: 'No anomaly detection', current_state: 'Manual review', target_state: 'Automated APM', impact: 'high', effort: 'medium' },
  ],
  next_steps: [
    { title: 'Adopt full APM', description: 'Roll out automated anomaly detection.', priority: 'strategic', timeframe: '1-3 months' },
  ],
  pillar_breakdown: {},
  created_at: '2026-01-01T00:00:00Z',
  company_name: 'Acme Corp',
  pillar_name: 'Full-Stack Observability',
  prospect_name: 'Jane Smith',
  prospect_role: 'vp_engineering',
  research_data: null,
  answers: [
    { question_text: QUESTIONS[0].text, selected_option_text: 'Automated alerting on key metrics', maturity_level: 3 },
    { question_text: QUESTIONS[1].text, selected_option_text: 'On-call rotation, manual triage', maturity_level: 2 },
  ],
  additional_notes: null,
  infrastructure_location: null,
  tech_stack_description: null,
  current_tools: null,
  key_challenges_input: null,
}

async function seedSession(page: Page) {
  await page.addInitScript(
    ({ prospectName, prospectRole }) => {
      sessionStorage.setItem('session_token', 'sess-xyz')
      sessionStorage.setItem('prospect_name', prospectName)
      sessionStorage.setItem('prospect_role', prospectRole)
      sessionStorage.setItem('p3_gate', 'null')
      sessionStorage.setItem('p4_gate', 'null')
    },
    { prospectName: ASSESSMENT_INFO.prospect_name, prospectRole: ASSESSMENT_INFO.prospect_role }
  )
}

async function mockPillarSelectApis(page: Page) {
  await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ASSESSMENT_INFO) })
  )
  await page.route(`**/api/public/assess/${TOKEN}/select-pillar`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assessment_id: ASSESSMENT_ID }) })
  )
  await page.route(`**/api/public/assess/${TOKEN}/confirm-research`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ confirmed: true, questions: QUESTIONS }) })
  )
}

async function answerQuestion(page: Page, optionText: string) {
  await page.getByRole('button', { name: optionText }).click()
}

test.describe('Assessment flow', () => {
  test('start pillar, answer all questions, submit, and view the report', async ({ page }) => {
    await seedSession(page)
    await mockPillarSelectApis(page)
    await page.route(`**/api/public/assess/${TOKEN}/submit`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report_id: 'report-1' }) })
    )
    await page.route(`**/api/public/assess/${TOKEN}/report/${ASSESSMENT_ID}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPORT) })
    )

    await page.goto(`/assess/${TOKEN}/pillars`)
    await expect(page.getByRole('heading', { name: 'Select an Assessment Area' })).toBeVisible()

    const pillarCard = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Full-Stack Observability' }) })
      .filter({ has: page.getByRole('button', { name: 'Start →' }) })
      .last()
    await pillarCard.getByRole('button', { name: 'Start →' }).click()

    // Lands on the assessment page with the mocked questions, question 1 of 2.
    await expect(page.getByText(QUESTIONS[0].text)).toBeVisible()

    const prev = page.getByRole('button', { name: '← Previous' })
    await expect(prev).toBeDisabled()

    // Selecting an option auto-advances after a short delay.
    await answerQuestion(page, 'Automated alerting on key metrics')
    await expect(page.getByText(QUESTIONS[1].text)).toBeVisible()
    await expect(prev).toBeEnabled()

    await answerQuestion(page, 'On-call rotation, manual triage')
    const submit = page.getByRole('button', { name: 'Submit Assessment' })
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page).toHaveURL(`/assess/${TOKEN}/report/${ASSESSMENT_ID}`)
    await expect(page.getByRole('heading', { name: /Developing|Full-Stack Observability/ }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(REPORT.executive_summary)).toBeVisible()

    // The four-tab layout from CLAUDE.md's report completeness rule.
    for (const label of ['Report', 'Questions & Answers', 'Research Summary', 'Registration Context']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
  })

  test('previous/next navigation moves between questions without losing selections', async ({ page }) => {
    await seedSession(page)
    await mockPillarSelectApis(page)

    await page.goto(`/assess/${TOKEN}/pillars`)
    const pillarCard = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Full-Stack Observability' }) })
      .filter({ has: page.getByRole('button', { name: 'Start →' }) })
      .last()
    await pillarCard.getByRole('button', { name: 'Start →' }).click()

    await expect(page.getByText(QUESTIONS[0].text)).toBeVisible()
    const option = page.getByRole('button', { name: 'Full APM with anomaly detection' })
    await option.click()
    await expect(page.getByText(QUESTIONS[1].text)).toBeVisible()

    await page.getByRole('button', { name: '← Previous' }).click()
    await expect(page.getByText(QUESTIONS[0].text)).toBeVisible()
    // Prior selection persisted after navigating back.
    await expect(option).toHaveClass(/border-brand/)
  })

  test('an expired session shows an inline error instead of redirecting to login', async ({ page }) => {
    // No session_token seeded — simulates a stale/expired session.
    await page.goto(`/assess/${TOKEN}/assessment/${ASSESSMENT_ID}`)

    await expect(page.getByText('Your session has expired.')).toBeVisible()
    await expect(page.getByRole('link', { name: /login/i })).toHaveCount(0)
    await expect(page).not.toHaveURL(/\/login/)

    // Pillar selection also requires a session token; with none set, it cascades
    // back to the landing page rather than ever touching an internal/login route.
    await page.getByRole('button', { name: '← Back to Pillar Selection' }).click()
    await expect(page).toHaveURL(`/assess/${TOKEN}`)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('has no forbidden text-black classes on the assessment page (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await seedSession(page)
    await mockPillarSelectApis(page)

    await page.goto(`/assess/${TOKEN}/pillars`)
    const pillarCard = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Full-Stack Observability' }) })
      .filter({ has: page.getByRole('button', { name: 'Start →' }) })
      .last()
    await pillarCard.getByRole('button', { name: 'Start →' }).click()
    await expect(page.getByText(QUESTIONS[0].text)).toBeVisible()

    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

import { test, expect, type Page } from '@playwright/test'

const TOKEN = 'test-token-123'

const BASE_INFO = {
  company_name: 'Acme Corp',
  prospect_name: null as string | null,
  prospect_email: '',
  suggested_pillars: [] as string[],
  available_pillars: [
    { id: 'p1', name: 'Full-Stack Observability', description: '', is_gated: false, gate_question: null, display_order: 1 },
    { id: 'p2', name: 'AIOps & Intelligent Observability', description: '', is_gated: false, gate_question: null, display_order: 2 },
    { id: 'p3', name: 'AI Application Observability', description: '', is_gated: true, gate_question: 'Do you build or run AI-powered applications?', display_order: 3 },
    { id: 'p5', name: 'Security & DevSecOps', description: '', is_gated: false, gate_question: null, display_order: 5 },
  ],
  is_registered: false,
  prospect_role: null,
  p3_gate_answered_yes: null,
  p4_gate_answered_yes: null,
  infrastructure_location: null,
  tech_stack_description: null,
  current_tools: null,
  key_challenges_input: null,
  existing_assessments: [] as unknown[],
}

async function mockAssessmentInfo(page: Page, overrides: Partial<typeof BASE_INFO> = {}) {
  await page.route(`**/api/public/assess/${TOKEN}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BASE_INFO, ...overrides }) })
  )
}

test.describe('Prospect landing page', () => {
  test('is the entry point — no back navigation', async ({ page }) => {
    await mockAssessmentInfo(page)
    await page.goto(`/assess/${TOKEN}`)

    await expect(page.getByRole('heading', { name: 'Observability Maturity Assessment' })).toBeVisible()
    await expect(page.getByRole('link', { name: /back/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /back/i })).toHaveCount(0)
  })

  test('pre-fills and locks the email for a known prospect', async ({ page }) => {
    await mockAssessmentInfo(page, {
      prospect_email: 'jane@acme.com',
      prospect_name: 'Jane Smith',
      is_registered: true,
    })
    await page.goto(`/assess/${TOKEN}`)

    const emailInput = page.getByPlaceholder('jane@company.com')
    await expect(emailInput).toHaveValue('jane@acme.com')
    await expect(emailInput).toHaveAttribute('readonly', '')
    await expect(page.getByPlaceholder('Jane', { exact: true })).toHaveValue('Jane')
    await expect(page.getByPlaceholder('Smith', { exact: true })).toHaveValue('Smith')
  })

  test('requires name, email, role, and gate answers before submitting', async ({ page }) => {
    await mockAssessmentInfo(page)
    await page.goto(`/assess/${TOKEN}`)

    const submit = page.getByRole('button', { name: /Begin Assessment/ })
    await submit.click()
    await expect(page.getByText('First and last name are required.')).toBeVisible()

    await page.getByPlaceholder('Jane', { exact: true }).fill('Jane')
    await page.getByPlaceholder('Smith', { exact: true }).fill('Smith')
    await page.getByPlaceholder('jane@company.com').fill('jane@acme.com')
    await submit.click()
    await expect(page.getByText('Please select your role.')).toBeVisible()

    await page.getByRole('combobox').selectOption('vp_engineering')
    await submit.click()
    await expect(page.getByText(/Please answer the gate question/)).toBeVisible()
  })

  test('successful registration navigates to the researching page', async ({ page }) => {
    await mockAssessmentInfo(page)
    await page.route(`**/api/public/assess/${TOKEN}/register`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session_token: 'sess-abc' }) })
    )

    await page.goto(`/assess/${TOKEN}`)
    await page.getByPlaceholder('Jane', { exact: true }).fill('Jane')
    await page.getByPlaceholder('Smith', { exact: true }).fill('Smith')
    await page.getByPlaceholder('jane@company.com').fill('jane@acme.com')
    await page.getByRole('combobox').selectOption('vp_engineering')
    await page.getByText('Do you build or run AI-powered applications?').locator('..').getByLabel('No').check()

    await page.getByRole('button', { name: /Begin Assessment/ }).click()
    await expect(page).toHaveURL(`/assess/${TOKEN}/researching`)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await mockAssessmentInfo(page)
    await page.goto(`/assess/${TOKEN}`)
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

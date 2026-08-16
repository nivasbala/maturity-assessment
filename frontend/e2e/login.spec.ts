import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('sign-in button is disabled until both fields are filled', async ({ page }) => {
    await page.goto('/login')

    const button = page.getByRole('button', { name: 'Sign in' })
    await expect(button).toBeDisabled()

    await page.getByPlaceholder('you@company.com').fill('internal@company.com')
    await expect(button).toBeDisabled()

    await page.locator('input[type="password"]').fill('wrong-password')
    await expect(button).toBeEnabled()
  })

  test('invalid credentials show an inline error, not a redirect', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid credentials' }) })
    )

    await page.goto('/login')
    await page.getByPlaceholder('you@company.com').fill('internal@company.com')
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('successful login as internal_user navigates to /dashboard', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-token',
          refresh_token: 'fake-refresh',
          user: { id: 'u1', name: 'Jane Internal', email: 'internal@company.com', role: 'internal_user', is_active: true, created_at: '2026-01-01T00:00:00Z' },
        }),
      })
    )
    // AccountsListPage renders at /dashboard — stub its data call so the page settles.
    await page.route('**/api/accounts**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )

    await page.goto('/login')
    await page.getByPlaceholder('you@company.com').fill('internal@company.com')
    await page.locator('input[type="password"]').fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await page.goto('/login')
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

import { test, expect } from '@playwright/test'

test.describe('Homepage explore tabs', () => {
  test('defaults to the first tab and shows its heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Five pillars. One clear picture.' })).not.toBeVisible()
  })

  test('clicking a tab pill swaps the visible section, and only one section is shown at a time', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /Five pillars/ }).click()
    await expect(page.getByRole('heading', { name: 'Five pillars. One clear picture.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'How it works' })).not.toBeVisible()

    await page.getByRole('button', { name: /Maturity levels/ }).click()
    await expect(page.getByRole('heading', { name: 'Four maturity levels' })).toBeVisible()

    await page.getByRole('button', { name: /What you get/ }).click()
    await expect(page.getByRole('heading', { name: "What you'll get" })).toBeVisible()
  })

  test('prev/next arrows step through tabs sequentially and disable at the ends', async ({ page }) => {
    await page.goto('/')

    const prev = page.getByRole('button', { name: 'Previous section' })
    const next = page.getByRole('button', { name: 'Next section' })

    await expect(prev).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()

    await next.click()
    await expect(page.getByRole('heading', { name: 'Five pillars. One clear picture.' })).toBeVisible()
    await expect(prev).toBeEnabled()

    await next.click()
    await next.click()
    await expect(page.getByRole('heading', { name: "What you'll get" })).toBeVisible()
    await expect(next).toBeDisabled()
  })

  test('has no forbidden text-black classes (CLAUDE.md dark-mode rule)', async ({ page }) => {
    await page.goto('/')
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="text-black"]')).map((el) => el.className)
    )
    expect(offenders).toEqual([])
  })
})

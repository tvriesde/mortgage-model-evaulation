import { test, expect, type Page } from '@playwright/test';

// Mocks the mortgage agent API so functional tests are deterministic.
async function mockAgent(page: Page, verdict: string, reason = 'mocked reason') {
  await page.route('**/api/mortgage/evaluate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ verdict, reason }),
    });
  });
}

async function fillIncome(
  page: Page,
  opts: { source?: string; income: string; property: string; loan: string },
) {
  if (opts.source) {
    await page.locator('label.chip', { hasText: new RegExp(opts.source, 'i') }).click();
  }
  await page.getByLabel(/gross annual income/i).fill(opts.income);
  await page.getByLabel(/price of the home/i).fill(opts.property);
  await page.getByLabel(/how much do you want to borrow/i).fill(opts.loan);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your first home starts here/i })).toBeVisible();
});

test('approved mortgage for a comfortable permanent-income request', async ({ page }) => {
  await mockAgent(page, 'approved', 'within limits');
  await fillIncome(page, { source: 'permanent', income: '50000', property: '250000', loan: '200000' });
  await page.getByRole('button', { name: /about you/i }).click();
  await page.getByLabel(/your age/i).fill('30');
  await page.getByRole('button', { name: /check my mortgage/i }).click();
  await expect(page.getByTestId('result-verdict')).toHaveText('approved');
});

test('declined mortgage when borrowing more than the home is worth', async ({ page }) => {
  await mockAgent(page, 'declined', 'LTV over 100%');
  await fillIncome(page, { source: 'permanent', income: '50000', property: '180000', loan: '200000' });
  await page.getByRole('button', { name: /about you/i }).click();
  await page.getByLabel(/your age/i).fill('30');
  await page.getByRole('button', { name: /check my mortgage/i }).click();
  await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'declined');
});

test('needs review for a temporary contract', async ({ page }) => {
  await mockAgent(page, 'needs_review', 'temporary contract');
  await fillIncome(page, { source: 'temporary', income: '50000', property: '250000', loan: '200000' });
  await page.getByRole('button', { name: /about you/i }).click();
  await page.getByLabel(/your age/i).fill('30');
  await page.getByRole('button', { name: /check my mortgage/i }).click();
  await expect(page.getByTestId('result-verdict')).toHaveText('needs review');
});

test('validation blocks progress when money fields are empty', async ({ page }) => {
  await page.getByRole('button', { name: /about you/i }).click();
  await expect(page.getByText(/enter your gross annual income/i)).toBeVisible();
  await expect(page.getByLabel(/your age/i)).toHaveCount(0);
});

test('the user can go back and change their answers', async ({ page }) => {
  await fillIncome(page, { source: 'permanent', income: '50000', property: '250000', loan: '200000' });
  await page.getByRole('button', { name: /about you/i }).click();
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.getByLabel(/gross annual income/i)).toHaveValue('50000');
});

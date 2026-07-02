import { test, expect } from '@playwright/test';

// Launch-gate smoke tests: the app spine must survive a deploy.
// Runs against the built app in `wrangler pages dev` with a fresh local D1,
// so the demo flow exercises the same code paths a first-time visitor hits.

test.beforeEach(async ({ page }) => {
	// The onboarding tour overlays the dashboard on first visit; skip it so
	// clicks land on the app, not the tour backdrop.
	await page.addInitScript(() => localStorage.setItem('keel_tour_v1', '1'));
});

test('landing page renders with demo and Google sign-in', async ({ page }) => {
	await page.goto('/auth');
	await expect(page.getByRole('heading', { name: /tracker for people who quit/i })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Try the live demo' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
});

test('legal and pricing pages respond', async ({ page }) => {
	for (const path of ['/legal/privacy', '/legal/terms', '/legal/refund', '/pricing']) {
		const res = await page.goto(path);
		expect(res?.status(), `${path} should return 200`).toBe(200);
	}
});

test('email signup issues a recovery code and signs in', async ({ page }) => {
	await page.goto('/auth');
	await page.getByRole('button', { name: 'Create an account' }).click();
	await page.getByLabel('Email').fill(`smoke+${Date.now()}@example.com`);
	await page.getByLabel('Password').fill('smoke-pass-123');
	await page.getByRole('button', { name: 'Create account' }).click();
	// The recovery code gate appears before any redirect (shown exactly once).
	await expect(page.getByText('Save your recovery code')).toBeVisible();
	await page.getByRole('button', { name: 'I saved it, continue' }).click();
	// New accounts land on first-run setup (/welcome); a session cookie is set.
	await page.waitForURL(/\/(welcome)?(\?.*)?$/, { timeout: 10_000 });
	expect((await page.context().cookies()).some((c) => c.name === 'keel_session')).toBe(true);
});

test('demo: dashboard loads, an expense can be added', async ({ page }) => {
	await page.goto('/auth');
	await page.getByRole('button', { name: 'Try the live demo' }).click();

	// Demo session starts and lands on the dashboard with a balance.
	await expect(page).toHaveURL('/');
	await expect(page.getByText('Safe to spend').first()).toBeVisible();

	// Add an expense through the real sheet (the single write path).
	await page.getByRole('button', { name: 'Add expense' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add entry' });
	await expect(sheet).toBeVisible();
	// Distinctive paise amount so the duplicate-check guard (same amount, same
	// day) never collides with seeded demo entries.
	await sheet.getByPlaceholder('0').fill('123.45');
	await sheet.getByPlaceholder('What was this for?').fill('Smoke test chai');
	const [postRes] = await Promise.all([
		page.waitForResponse(
			(r) => new URL(r.url()).pathname === '/api/transactions' && r.request().method() === 'POST'
		),
		sheet.locator('button[type="submit"]').click()
	]);
	expect(postRes.status(), await postRes.text()).toBe(201);

	// The entry lands in the ledger without a reload.
	await expect(page.getByText('Smoke test chai')).toBeVisible();
});

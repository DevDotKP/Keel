// High-fidelity Keel screenshots for marketing.
// Drives the local dev server (seeded preview user) with Playwright.
// Run:  node marketing/capture-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5180';
const OUT = 'marketing/assets/screenshots';
mkdirSync(OUT, { recursive: true });

// iPhone-class viewport at 3x for crisp retina PNGs.
const MOBILE = {
	viewport: { width: 402, height: 874 },
	deviceScaleFactor: 3,
	isMobile: true,
	hasTouch: true,
	colorScheme: 'dark',
	locale: 'en-IN',
	timezoneId: 'Asia/Kolkata'
};

const DESKTOP = {
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'dark',
	locale: 'en-IN',
	timezoneId: 'Asia/Kolkata'
};

// Keep screens clean: skip the first-run onboarding tour overlay.
const DISMISS_TOUR = `try { localStorage.setItem('keel_tour_v1','1'); } catch (e) {}`;

const PAGES = [
	['01-dashboard', '/', { full: true }],
	['02-insights', '/insights', { full: true }],
	['03-harbour', '/harbour', {}],
	['04-transactions', '/transactions', { full: true }],
	['05-categories', '/categories', {}],
	['06-obligations', '/obligations', {}],
	['07-portfolio', '/portfolio', { full: true }],
	['08-settings', '/settings', {}],
	['09-pricing', '/pricing', { full: true }]
];

// Dashboard shows a ~1.5s "Hey {name}." splash on load; wait it out for clean shots.
const WAIT = 1900;

async function shoot(ctx, prefix, path, opts) {
	const page = await ctx.newPage();
	await page.addInitScript(DISMISS_TOUR);
	await page.goto(BASE + path, { waitUntil: 'networkidle' });
	await page.waitForTimeout(WAIT); // let the greeting splash clear + charts settle
	await page.screenshot({ path: `${OUT}/${prefix}.png` });
	if (opts.full) await page.screenshot({ path: `${OUT}/${prefix}-full.png`, fullPage: true });
	await page.close();
	console.log(`captured ${prefix}  (${path})`);
}

const browser = await chromium.launch();

// ── Mobile pass ───────────────────────────────────────────────────────────────
const mobile = await browser.newContext(MOBILE);
for (const [prefix, path, opts] of PAGES) {
	try {
		await shoot(mobile, prefix, path, opts);
	} catch (e) {
		console.error(`FAILED ${prefix}: ${e.message}`);
	}
}

// Add-transaction sheet (amount-first) — open the FAB and show a real in-progress entry.
try {
	const page = await mobile.newPage();
	await page.addInitScript(DISMISS_TOUR);
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await page.waitForTimeout(WAIT); // let the greeting splash clear before opening the sheet
	await page.click('button[aria-label="Add expense"]');
	await page.waitForSelector('input[inputmode="decimal"]', { timeout: 5000 });
	await page.fill('input[inputmode="decimal"]', '420');
	try {
		await page.getByPlaceholder('What was this for?').fill('Swiggy dinner');
	} catch (e) {
		console.error(`  (description fill skipped: ${e.message})`);
	}
	await page.locator('input[inputmode="decimal"]').blur().catch(() => {});
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUT}/10-add-sheet.png` });
	await page.close();
	console.log('captured 10-add-sheet  (FAB open, filled)');
} catch (e) {
	console.error(`FAILED 10-add-sheet: ${e.message}`);
}
await mobile.close();

// ── Desktop pass (dashboard + insights, for web/landing use) ──────────────────
const desktop = await browser.newContext(DESKTOP);
for (const [prefix, path] of [['desktop-dashboard', '/'], ['desktop-insights', '/insights']]) {
	try {
		const page = await desktop.newPage();
		await page.addInitScript(DISMISS_TOUR);
		await page.goto(BASE + path, { waitUntil: 'networkidle' });
		await page.waitForTimeout(WAIT); // clear the greeting splash
		await page.screenshot({ path: `${OUT}/${prefix}.png` });
		await page.close();
		console.log(`captured ${prefix}  (${path})`);
	} catch (e) {
		console.error(`FAILED ${prefix}: ${e.message}`);
	}
}
await desktop.close();

await browser.close();
console.log('\nDone. Screenshots in ' + OUT);

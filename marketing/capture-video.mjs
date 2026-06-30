// Keel walkthrough video for marketing (portrait, dark navy, with a live voice demo).
// Web Speech can't run headlessly, so window.SpeechRecognition is mocked to emit a
// phrase; the app's REAL anchor engine parses it, prefills, and we auto-save.
// Output: webm.  Run:  node marketing/capture-video.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const BASE = process.env.BASE_URL ?? 'http://localhost:5180';
const OUT = 'marketing/assets/video';
mkdirSync(OUT, { recursive: true });
const SIZE = { width: 600, height: 1300 }; // portrait, social-friendly (higher res = crisper)

// Runs before page scripts: skip the tour, and install a fake speech engine that
// "speaks" the phrase ~1.1s after the mic is tapped, then ends.
const INIT = `
try { localStorage.setItem('keel_tour_v1','1'); } catch (e) {}
window.__DEMO_TRANSCRIPT__ = 'swiggy 200 rupees';
class FakeSR {
  start() {
    this._stopped = false;
    setTimeout(() => {
      if (this._stopped) return;
      const alt = { transcript: window.__DEMO_TRANSCRIPT__, confidence: 0.97 };
      const res = [alt]; res.isFinal = true;
      if (this.onresult) this.onresult({ results: [res] });
      setTimeout(() => this.stop(), 900);
    }, 1100);
  }
  stop() { if (this._stopped) return; this._stopped = true; if (this.onend) this.onend({}); }
  abort() { this.stop(); }
}
window.SpeechRecognition = FakeSR;
window.webkitSpeechRecognition = FakeSR;
`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: SIZE,
	recordVideo: { dir: OUT, size: SIZE },
	isMobile: true,
	hasTouch: true,
	colorScheme: 'dark',
	locale: 'en-IN',
	timezoneId: 'Asia/Kolkata'
});
await ctx.addInitScript(INIT);
const p = await ctx.newPage();
const pause = (ms) => p.waitForTimeout(ms);
async function scrollThrough(total, steps = 5, dwell = 550) {
	for (let i = 0; i < steps; i++) {
		await p.mouse.wheel(0, total / steps);
		await pause(dwell);
	}
}
async function nav(label, href) {
	try {
		await p.getByRole('link', { name: label, exact: false }).first().click({ timeout: 4000 });
	} catch {
		await p.goto(BASE + href, { waitUntil: 'networkidle' });
		return;
	}
	await p.waitForLoadState('networkidle');
}

// 1. Dashboard — greeting splash, then the calm hero number.
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await pause(3000);

// 2. Add an expense BY VOICE: tap mic, the engine speaks, the anchor parses,
//    fields fill, and it saves with no typing.
await p.click('button[aria-label="Add expense"]');
await p.waitForSelector('input[inputmode="decimal"]', { timeout: 5000 });
await pause(700);
await p.click('button[aria-label="Add by voice"]');
await pause(3200); // listening, then parse + prefill (200, Food & Dining, Swiggy order)
await p.getByRole('button', { name: 'Save', exact: true }).first().click().catch(() => {});
await pause(2400); // sheet closes, entry lands on the dashboard

// 3. Insights — budget, savings rate, category breakdown, drift trending down.
await nav('Insights', '/insights');
await pause(1600);
await scrollThrough(2300, 6, 560);
await pause(700);

// 4. Harbour — the periodic reckoning.
await nav('Harbour', '/harbour');
await pause(2300);
await scrollThrough(800, 3, 560);
await pause(800);

// 5. Portfolio — net worth + holdings.
await p.goto(BASE + '/portfolio', { waitUntil: 'networkidle' });
await pause(1800);
await scrollThrough(950, 4, 560);
await pause(700);

// 6. Transactions ledger.
await p.goto(BASE + '/transactions', { waitUntil: 'networkidle' });
await pause(1600);
await scrollThrough(950, 4, 560);
await pause(700);

// 7. Back to the calm dashboard.
await nav('Dashboard', '/');
await pause(2600);

const video = p.video();
await ctx.close();
await browser.close();
if (video) {
	const webm = `${OUT}/keel-walkthrough.webm`;
	const mp4 = `${OUT}/keel-walkthrough.mp4`;
	renameSync(await video.path(), webm);
	// Transcode to H.264 MP4: smaller, universally playable, no added softness.
	execFileSync(
		ffmpeg,
		['-i', webm, '-vf', `scale=${SIZE.width}:${SIZE.height}:flags=lanczos,fps=30`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', '-movflags', '+faststart', '-y', mp4],
		{ stdio: 'inherit' }
	);
	rmSync(webm, { force: true });
	console.log('Saved ' + mp4);
}

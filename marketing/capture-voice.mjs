// Keel voice-feature demo clip for marketing.
// Web Speech can't be driven headlessly, so we mock window.SpeechRecognition to
// emit a Hinglish-style phrase. The app's REAL anchor engine then parses it,
// prefills the sheet, and we auto-save. Output: webm.
// Run:  node marketing/capture-voice.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const BASE = process.env.BASE_URL ?? 'http://localhost:5180';
const OUT = 'marketing/assets/video';
const SHOTS = process.env.SHOT_DIR ?? OUT;
mkdirSync(OUT, { recursive: true });
const SIZE = { width: 600, height: 1300 }; // higher res = crisper

// Runs before page scripts: dismiss the tour and install a fake speech engine
// that "speaks" the phrase ~1.1s after the mic is tapped, then ends.
const INIT = `
try { localStorage.setItem('keel_tour_v1','1'); } catch (e) {}
window.__DEMO_TRANSCRIPT__ = 'swiggy 200 rupees';
class FakeSR {
  start() {
    this._stopped = false;
    setTimeout(() => {
      if (this._stopped) return;
      const alt = { transcript: window.__DEMO_TRANSCRIPT__, confidence: 0.97 };
      const res = [alt]; res.isFinal = true;        // res[0].transcript, res.isFinal
      const results = [res];                          // results[0] = res
      if (this.onresult) this.onresult({ results });
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

await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await pause(2600); // greeting splash clears

await p.click('button[aria-label="Add expense"]');
await p.waitForSelector('input[inputmode="decimal"]', { timeout: 5000 });
await pause(700);

// Tap the mic. The fake engine "speaks" swiggy 200 rupees.
await p.click('button[aria-label="Add by voice"]');
await pause(1300); // listening state on screen
await p.screenshot({ path: `${SHOTS}/voice-listening.png` });

await pause(1900); // capture resolves, anchor parses, fields prefill
await p.screenshot({ path: `${SHOTS}/voice-prefilled.png` });
await pause(800);

// Auto-save: the entry is added without typing.
await p.getByRole('button', { name: 'Save', exact: true }).first().click().catch(() => {});
await pause(2200); // sheet closes, entry lands on the dashboard
await p.screenshot({ path: `${SHOTS}/voice-added.png` });

const video = p.video();
await ctx.close();
await browser.close();
if (video) {
	const webm = `${OUT}/keel-voice-demo.webm`;
	const mp4 = `${OUT}/keel-voice-demo.mp4`;
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

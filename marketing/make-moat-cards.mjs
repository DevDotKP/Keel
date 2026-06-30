// Moat cards for Keel: the defensible differentiators, not just features.
// Screen-backed moats use a cream card; the privacy moat (no single screen) uses
// a bold navy statement card. Run:  node marketing/make-moat-cards.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const SHOTS = 'marketing/assets/screenshots';
const OUT = 'marketing/assets/moat-cards';
mkdirSync(OUT, { recursive: true });

const NAVY = '#0C2340';
const GOLD = '#E0A82E';
const CREAM = '#FAF7F1';
const MUTE = '#5E584E';
const MUTE_ON_NAVY = '#9AA7BA';

const dataUrl = (file) => `data:image/png;base64,${readFileSync(`${SHOTS}/${file}`).toString('base64')}`;

const CARDS = [
	{
		kind: 'shot',
		shot: '01-dashboard.png',
		headline: 'A missed entry never breaks your total',
		body: "Skip a day, a week, a whole trip. The gap becomes “uncategorized,” not a broken number you have to chase down."
	},
	{
		kind: 'shot',
		shot: '03-harbour.png',
		headline: 'A habit with no streak to break',
		body: 'Come to Harbour when you are ready. Miss one and your visit count just pauses. It never resets to zero.'
	},
	{
		kind: 'shot',
		shot: '10-add-sheet.png',
		headline: 'Voice that speaks Hinglish',
		body: "“Chai dus rupaye.” “Auto to office.” Speaking beats any form, so you log it before you forget."
	},
	{
		kind: 'text',
		headline: 'Private by default',
		body: 'No SMS reading. No email or bank scraping. Ever. You type or speak only what matters.',
		sub: "That is the line the low-effort apps can't cross: their whole model is reading your messages."
	}
];

const W = 1080;
const H = 1350;

const shotCard = (c) => `<div class="card bg-cream">
    <div class="word c-ink">Keel</div>
    <div class="rule"></div>
    <div class="headline c-ink">${c.headline}</div>
    <div class="body c-mute">${c.body}</div>
    <div class="stage"><img class="shot" src="${dataUrl(c.shot)}"/></div>
  </div>`;

const textCard = (c) => `<div class="card bg-navy">
    <div class="word c-cream">Keel</div>
    <div class="rule"></div>
    <div class="headline c-cream h-big">${c.headline}</div>
    <div class="body c-cream b-lead">${c.body}</div>
    <div class="sub c-muten">${c.sub}</div>
  </div>`;

const page = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; }
    .card { width: ${W}px; height: ${H}px; padding: 72px 72px 56px;
      display: flex; flex-direction: column; font-family: Georgia, 'Times New Roman', serif; }
    .bg-cream { background: ${CREAM}; }
    .bg-navy { background: ${NAVY}; }
    .c-ink { color: ${NAVY}; }
    .c-cream { color: ${CREAM}; }
    .c-mute { color: ${MUTE}; }
    .c-muten { color: ${MUTE_ON_NAVY}; }
    .word { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
    .rule { height: 4px; width: 56px; background: ${GOLD}; border-radius: 2px; margin: 28px 0 22px; }
    .headline { font-size: 60px; font-weight: 700; line-height: 1.04; letter-spacing: -0.02em; }
    .h-big { font-size: 72px; }
    .body { font-family: system-ui, -apple-system, sans-serif; font-size: 27px; line-height: 1.45; max-width: 860px; margin-top: 20px; }
    .b-lead { font-size: 32px; margin-top: 28px; }
    .sub { font-family: system-ui, -apple-system, sans-serif; font-size: 25px; line-height: 1.5; max-width: 860px; margin-top: 28px; }
    .stage { flex: 1; display: flex; align-items: center; justify-content: center; margin-top: 40px; }
    .shot { max-height: 790px; border-radius: 30px; box-shadow: 0 28px 64px rgba(12, 35, 64, 0.28); }
  </style></head><body>${c.kind === 'shot' ? shotCard(c) : textCard(c)}</body></html>`;

const b = await chromium.launch();
let i = 1;
for (const c of CARDS) {
	const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
	const p = await ctx.newPage();
	await p.setContent(page(c), { waitUntil: 'load' });
	await p.waitForTimeout(200);
	const slug = c.kind === 'shot' ? c.shot.replace(/^\d+-/, '').replace('.png', '') : 'private';
	await p.screenshot({ path: `${OUT}/${String(i).padStart(2, '0')}-${slug}.png` });
	await ctx.close();
	console.log('moat card:', slug);
	i++;
}
await b.close();
console.log('Done. Moat cards in ' + OUT);

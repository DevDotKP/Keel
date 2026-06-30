// Feature showcase cards for Keel. Each card pairs one app screen with a serif
// headline (the function) and a one-line benefit, on the brand palette. Clean and
// simple, meant for a carousel, landing section, or deck.
// Run:  node marketing/make-feature-cards.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const SHOTS = 'marketing/assets/screenshots';
const OUT = 'marketing/assets/feature-cards';
mkdirSync(OUT, { recursive: true });

const NAVY = '#0C2340';
const GOLD = '#E0A82E';
const CREAM = '#FAF7F1';
const MUTE = '#5E584E';

const dataUrl = (file) => `data:image/png;base64,${readFileSync(`${SHOTS}/${file}`).toString('base64')}`;

// Key functions, each tied to the screen that shows it best.
const FEATURES = [
	{
		shot: '01-dashboard.png',
		headline: "Know what's safe to spend",
		benefit: 'Rent and essentials come out first, so the big number is genuinely yours to spend this cycle.'
	},
	{
		shot: '10-add-sheet.png',
		headline: 'Log it in seconds, or just say it',
		benefit: "Amount first, one tap. Or speak it: “Swiggy 200 rupees.” Built for how India actually talks."
	},
	{
		shot: '03-harbour.png',
		headline: 'Fall behind without breaking anything',
		benefit: 'Miss a few entries and your totals still hold. You square up at Harbour, on your schedule.'
	},
	{
		shot: '02-insights.png',
		headline: 'See where it actually goes',
		benefit: 'Spending by category, income versus saved, and your picture getting clearer over time.'
	},
	{
		shot: '07-portfolio.png',
		headline: 'Net worth, beside your spending',
		benefit: 'Track investments by hand: private, and kept separate from day-to-day money.'
	}
];

const W = 1080;
const H = 1350;

function html(f) {
	return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; }
    .card { width: ${W}px; height: ${H}px; background: ${CREAM}; color: ${NAVY};
      padding: 72px 72px 56px; display: flex; flex-direction: column;
      font-family: Georgia, 'Times New Roman', serif; }
    .word { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
    .rule { height: 4px; width: 56px; background: ${GOLD}; border-radius: 2px; margin: 28px 0 22px; }
    .headline { font-size: 60px; font-weight: 700; line-height: 1.04; letter-spacing: -0.02em; }
    .benefit { font-family: system-ui, -apple-system, sans-serif; font-size: 27px;
      line-height: 1.45; color: ${MUTE}; margin-top: 20px; max-width: 820px; }
    .stage { flex: 1; display: flex; align-items: center; justify-content: center; margin-top: 40px; }
    .shot { max-height: 790px; border-radius: 30px;
      box-shadow: 0 28px 64px rgba(12, 35, 64, 0.28); }
  </style></head><body>
    <div class="card">
      <div class="word">Keel</div>
      <div class="rule"></div>
      <div class="headline">${f.headline}</div>
      <div class="benefit">${f.benefit}</div>
      <div class="stage"><img class="shot" src="${dataUrl(f.shot)}"/></div>
    </div>
  </body></html>`;
}

const b = await chromium.launch();
let i = 1;
for (const f of FEATURES) {
	const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
	const p = await ctx.newPage();
	await p.setContent(html(f), { waitUntil: 'load' });
	await p.waitForTimeout(200);
	const name = `${String(i).padStart(2, '0')}-${f.shot.replace(/^\d+-/, '').replace('.png', '')}.png`;
	await p.screenshot({ path: `${OUT}/${name}` });
	await ctx.close();
	console.log('card:', name);
	i++;
}
await b.close();
console.log('Done. Feature cards in ' + OUT);

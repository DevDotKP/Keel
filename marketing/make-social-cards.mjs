// Branded social cards for Keel (OG + Instagram). Pure typography + the keel mark
// on the brand palette. Run:  node marketing/make-social-cards.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const OUT = 'marketing/assets/social';
mkdirSync(OUT, { recursive: true });

// Inline the keel mark so the card renders with no external resolution.
const logoB64 = readFileSync('Assets/ChatGPT Image Jun 18, 2026, 08_23_34 PM.png').toString('base64');
const logoUrl = `data:image/png;base64,${logoB64}`;

const NAVY = '#0C2340';
const GOLD = '#E0A82E';
const CREAM = '#FAF7F1';
const MUTE = '#9AA7BA';

function html(s) {
	return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    html, body { width: ${s.w}px; height: ${s.h}px; }
    .card { width: ${s.w}px; height: ${s.h}px; background: ${NAVY}; color: ${CREAM};
      display: flex; flex-direction: column; justify-content: space-between;
      padding: ${s.pad}px; font-family: Georgia, 'Times New Roman', serif; }
    .top { display: flex; align-items: center; gap: ${Math.round(s.pad / 3)}px; }
    .mark { width: ${s.mark}px; height: ${s.mark}px; border-radius: ${Math.round(s.mark / 5)}px; }
    .word { font-size: ${s.word}px; font-weight: 700; letter-spacing: -0.01em; }
    .rule { height: 4px; width: ${s.mark}px; background: ${GOLD}; border-radius: 2px; margin-bottom: ${s.gap}px; }
    .tag { font-size: ${s.tag}px; font-weight: 700; line-height: 1.06; letter-spacing: -0.02em; }
    .sub { font-family: system-ui, -apple-system, sans-serif; font-size: ${s.sub}px;
      color: ${MUTE}; margin-top: ${s.gap}px; }
    .url { font-family: system-ui, -apple-system, sans-serif; font-size: ${s.url}px;
      font-weight: 700; color: ${GOLD}; }
  </style></head><body>
    <div class="card">
      <div class="top"><img class="mark" src="${logoUrl}"/><span class="word">Keel</span></div>
      <div>
        <div class="rule"></div>
        <div class="tag">The tracker for people<br/>who quit trackers.</div>
        <div class="sub">Miss an entry. Keep your total. Private, and voice-first for India.</div>
      </div>
      <div class="url">keel-aba.pages.dev</div>
    </div>
  </body></html>`;
}

const sizes = [
	{ name: 'og-1200x630', w: 1200, h: 630, pad: 64, mark: 84, word: 40, tag: 62, sub: 24, url: 26, gap: 18 },
	{ name: 'instagram-1080x1080', w: 1080, h: 1080, pad: 84, mark: 104, word: 52, tag: 88, sub: 30, url: 30, gap: 26 }
];

const b = await chromium.launch();
for (const s of sizes) {
	const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
	const p = await ctx.newPage();
	await p.setContent(html(s), { waitUntil: 'load' });
	await p.waitForTimeout(200);
	await p.screenshot({ path: `${OUT}/${s.name}.png` });
	await ctx.close();
	console.log('card:', s.name);
}
await b.close();
console.log('Done. Cards in ' + OUT);

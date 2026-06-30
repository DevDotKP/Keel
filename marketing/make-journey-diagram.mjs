// Keel user-journey diagram (the path a spend takes), with a Now/Before line.
// Horizontal step flow, on-brand. Run:  node marketing/make-journey-diagram.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'marketing/assets/journey';
mkdirSync(OUT, { recursive: true });

const NAVY = '#0C2340';
const GOLD = '#E0A82E';
const CREAM = '#FAF7F1';
const TILE = '#F1EEE9';
const LINE = '#D4CFC7';
const MUTE = '#7C756A';
const BORDER = '#E5E0D8';

const icons = {
	rupee: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>',
	mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/>',
	inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
	anchor: '<circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>',
	check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
};
const svg = (name) => `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;

const STEPS = [
	{ icon: 'rupee', label: 'You spend' },
	{ icon: 'mic', label: 'Log it, or say it' },
	{ icon: 'inbox', label: 'Miss a few' },
	{ icon: 'anchor', label: 'Come to Harbour', active: true },
	{ icon: 'check', label: 'Totals hold' }
];

const W = 2000;
const H = 600;

const step = (s, i) => `
  <div class="step">
    <div class="tile ${s.active ? 'on' : ''}">${svg(s.icon)}</div>
    <div class="label ${s.active ? 'lbl-on' : ''}">${s.label}</div>
  </div>
  ${i < STEPS.length - 1 ? '<div class="conn"></div>' : ''}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; background: ${CREAM};
    font-family: system-ui, -apple-system, sans-serif; }
  .card { margin: 40px; width: ${W - 80}px; height: ${H - 80}px; background: #fff;
    border: 1px solid ${BORDER}; border-radius: 28px; box-shadow: 0 20px 50px rgba(12,35,64,.08);
    padding: 64px 72px; display: flex; flex-direction: column; }
  .flow { display: flex; align-items: flex-start; }
  .step { display: flex; flex-direction: column; align-items: center; gap: 22px; width: 200px; }
  .tile { width: 104px; height: 104px; border-radius: 26px; background: ${TILE}; color: ${NAVY};
    display: flex; align-items: center; justify-content: center; }
  .tile.on { background: ${NAVY}; color: ${GOLD}; box-shadow: 0 12px 26px rgba(12,35,64,.28); }
  .label { font-size: 30px; font-weight: 600; color: ${NAVY}; text-align: center; }
  .lbl-on { font-weight: 800; }
  .conn { flex: 1; height: 2px; background: ${LINE}; margin-top: 52px; }
  .divider { height: 1px; background: ${BORDER}; margin: 56px 0 40px; }
  .now { font-size: 34px; color: ${NAVY}; font-weight: 600; }
  .now b { color: ${GOLD}; font-weight: 800; }
  .before { font-size: 30px; color: ${MUTE}; margin-top: 18px; }
  .before b { font-weight: 700; }
</style></head><body>
  <div class="card">
    <div class="flow">${STEPS.map(step).join('')}</div>
    <div class="divider"></div>
    <div class="now"><b>Now:</b> a missed entry waits as “uncategorized” and squares up at Harbour. Your total never breaks.</div>
    <div class="before"><b>Before:</b> a missed entry breaks the total. Guilt. You quit.</div>
  </div>
</body></html>`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.screenshot({ path: `${OUT}/journey.png` });
await b.close();
console.log('Done. ' + OUT + '/journey.png');

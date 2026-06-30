// Keel launch reel, built crisp. Each scene is rendered as a high-res still, then
// assembled into H.264 MP4 with crossfades (real ffmpeg via ffmpeg-static). Far
// sharper and smaller than a recorded WebM. Structured around the user journey.
// Run:  node marketing/make-launch-video.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const SHOTS = 'marketing/assets/screenshots';
const OUT = 'marketing/assets/video';
const FRAMES = `${OUT}/_frames`;
mkdirSync(FRAMES, { recursive: true });

const png = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const mark = png('static/icons/icon-512.png');
const dash = png(`${SHOTS}/01-dashboard.png`);
const harbour = png(`${SHOTS}/03-harbour.png`);
const add = png(`${SHOTS}/10-add-sheet.png`);

const NAVY = '#0C2340', GOLD = '#E0A82E', CREAM = '#FAF7F1', MUTE = '#9AA7BA', INKMUTE = '#5E584E', TILE = '#16294A';

const ic = {
	rupee: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>',
	mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/>',
	inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
	anchor: '<circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>'
};
const svg = (n, c) => `<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic[n]}</svg>`;

const base = `
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; }
  .scene { width: 1080px; height: 1920px; padding: 150px 96px; display: flex; flex-direction: column;
    font-family: Georgia, 'Times New Roman', serif; }
  .navy { background: ${NAVY}; color: ${CREAM}; }
  .cream { background: ${CREAM}; color: ${NAVY}; }
  .center { justify-content: center; }
  .mark { width: 150px; height: 150px; border-radius: 34px; }
  .word { font-size: 46px; font-weight: 700; margin-top: 32px; }
  .kicker { font-family: system-ui, sans-serif; font-size: 30px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${GOLD}; }
  .rule { height: 6px; width: 84px; background: ${GOLD}; border-radius: 3px; margin: 36px 0 32px; }
  .display { font-size: 108px; font-weight: 700; line-height: 1.0; letter-spacing: -0.02em; }
  .headline { font-size: 84px; font-weight: 700; line-height: 1.05; letter-spacing: -0.02em; }
  .lead { font-family: system-ui, sans-serif; font-size: 40px; line-height: 1.4; margin-top: 36px; }
  .dim { color: ${MUTE}; } .inkdim { color: ${INKMUTE}; }
  .url { font-family: system-ui, sans-serif; font-size: 42px; font-weight: 700; color: ${GOLD}; margin-top: 28px; }
  .stage { flex: 1; display: flex; align-items: center; justify-content: center; margin-top: 56px; }
  .phone { max-height: 1000px; border-radius: 38px; box-shadow: 0 40px 90px rgba(12,35,64,.32); }
  /* journey list */
  .steps { display: flex; flex-direction: column; gap: 30px; margin-top: 50px; }
  .row { display: flex; align-items: center; gap: 36px; }
  .tile { width: 96px; height: 96px; border-radius: 24px; background: ${TILE}; display: flex; align-items: center; justify-content: center; flex: none; }
  .tile.on { background: ${GOLD}; }
  .rowlabel { font-family: system-ui, sans-serif; font-size: 40px; font-weight: 600; }
`;

const wrap = (cls, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head><body><div class="scene ${cls}">${inner}</div></body></html>`;

const scenes = [
	wrap('navy center', `<img class="mark" src="${mark}"/><div class="word">Keel</div><div class="rule"></div><div class="display">The tracker<br/>for people who<br/>quit trackers.</div>`),
	wrap('navy', `<div class="kicker">How a spend flows</div><div class="rule"></div>
    <div class="steps">
      <div class="row"><div class="tile">${svg('rupee', GOLD)}</div><div class="rowlabel">You spend.</div></div>
      <div class="row"><div class="tile">${svg('mic', GOLD)}</div><div class="rowlabel">Log it, or just say it.</div></div>
      <div class="row"><div class="tile">${svg('inbox', GOLD)}</div><div class="rowlabel">Miss a few? Uncategorized.</div></div>
      <div class="row"><div class="tile on">${svg('anchor', NAVY)}</div><div class="rowlabel">Settle at Harbour. Totals hold.</div></div>
    </div>
    <div class="lead dim" style="margin-top:56px">Your total never breaks.</div>`),
	wrap('cream', `<div class="headline">Log it in seconds,<br/>or just say it.</div><div class="lead inkdim">“Swiggy 200 rupees.” Built for how India talks.</div><div class="stage"><img class="phone" src="${add}"/></div>`),
	wrap('cream', `<div class="headline">Miss a few?<br/>Nothing breaks.</div><div class="lead inkdim">A gap becomes “uncategorized,” not a broken number.</div><div class="stage"><img class="phone" src="${dash}"/></div>`),
	wrap('cream', `<div class="headline">Come to Harbour<br/>when you're ready.</div><div class="lead inkdim">Square up at your own pace. The count never resets.</div><div class="stage"><img class="phone" src="${harbour}"/></div>`),
	wrap('navy center', `<div class="kicker">The promise</div><div class="rule"></div><div class="headline">No SMS. No scraping.<br/>Ever.</div><div class="lead dim">You type or speak only what matters.</div>`),
	wrap('navy center', `<img class="mark" src="${mark}"/><div class="display" style="margin-top:40px">Try the<br/>live demo.</div><div class="url">keel-aba.pages.dev</div><div class="lead dim">No sign-up. Private. Voice-first for India.</div>`)
];

// Render each scene as a crisp 2x still.
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (let i = 0; i < scenes.length; i++) {
	await page.setContent(scenes[i], { waitUntil: 'load' });
	await page.waitForTimeout(150);
	await page.screenshot({ path: `${FRAMES}/${String(i).padStart(2, '0')}.png` });
}
await browser.close();
console.log(`rendered ${scenes.length} slides`);

// Assemble with crossfades into H.264 MP4.
const DUR = 4.5, T = 0.7;
const files = scenes.map((_, i) => `${FRAMES}/${String(i).padStart(2, '0')}.png`);
const inputs = files.flatMap((f) => ['-loop', '1', '-t', String(DUR), '-i', f]);
let filter = files.map((_, i) => `[${i}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v${i}]`).join(';');
let prev = 'v0';
for (let k = 1; k < files.length; k++) {
	const out = k === files.length - 1 ? 'vout' : `x${k}`;
	const offset = (k * (DUR - T)).toFixed(2);
	filter += `;[${prev}][v${k}]xfade=transition=fade:duration=${T}:offset=${offset}[${out}]`;
	prev = out;
}
const mp4 = `${OUT}/keel-launch.mp4`;
execFileSync(ffmpeg, [...inputs, '-filter_complex', filter, '-map', '[vout]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', '-y', mp4], { stdio: 'inherit' });
rmSync(FRAMES, { recursive: true, force: true });
if (existsSync(`${OUT}/keel-launch.webm`)) rmSync(`${OUT}/keel-launch.webm`);
console.log('Saved ' + mp4);

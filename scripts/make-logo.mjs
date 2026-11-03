// Export the ECHO logo (src/logo.js) as pixel-perfect SVGs, plus PNGs if
// Playwright is around:
//   public/logo.svg       the wordmark alone, transparent background
//   public/logo-card.svg  the wordmark and tagline on the screen colour
// Usage: node scripts/make-logo.mjs [palette name, default GREEN]
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { LOGO_W, LOGO_H, eachLogoPixel } from '../src/logo.js';
import { FONT, textWidth } from '../src/font.js';
import { PALETTES } from '../src/render.js';

const palName = (process.argv[2] || 'GREEN').toUpperCase();
const pal = (PALETTES.find((p) => p.name === palName) || PALETTES[0]).c;
const out = new URL('../public/', import.meta.url);

function svg(w, h, pixels, bg) {
  const rects = pixels.map(([x, y, s, c]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${pal[c]}"/>`).join('');
  const back = bg == null ? '' : `<rect width="${w}" height="${h}" fill="${pal[bg]}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 8}" height="${h * 8}" shape-rendering="crispEdges">${back}${rects}</svg>\n`;
}

// the wordmark alone
const mark = [];
eachLogoPixel((x, y, c) => mark.push([x, y, 1, c]));
const mw = LOGO_W + 6, mh = LOGO_H + 6;
writeFileSync(new URL('logo.svg', out), svg(mw, mh, mark));

// a card: wordmark at 2x, tagline below in the game's pixel font
const tag = 'A PUZZLE IN TIME';
const cw = 120, ch = 56, lx = Math.round((cw - (LOGO_W + 4) * 2) / 2);
const card = [];
eachLogoPixel((x, y, c) => card.push([lx + x * 2, 4 + y * 2, 2, c]));
let tx = Math.round((cw - textWidth(tag)) / 2);
for (const chr of tag) {
  const g = FONT[chr];
  g.rows.forEach((r, y) => [...r].forEach((p, x) => { if (p === '#') card.push([tx + x, 43 + y, 1, 2]); }));
  tx += g.w + 1;
}
writeFileSync(new URL('logo-card.svg', out), svg(cw, ch, card, 0));

// PNGs, rendered by the browser at 8x
try {
  const { chromium } = createRequire(import.meta.url)('playwright'); // NODE_PATH works here
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const name of ['logo', 'logo-card']) {
    await page.goto(new URL(`${name}.svg`, out).href);
    await page.locator('svg').screenshot({ path: new URL(`${name}.png`, out).pathname, omitBackground: true });
  }
  await browser.close();
} catch (e) {
  console.log('(skipped PNGs: ' + e.message.split('\n')[0] + ')');
}
console.log(`wrote public/logo.svg and public/logo-card.svg (${palName})`);

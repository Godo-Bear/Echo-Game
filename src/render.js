// The 160x144 "Game Boy" screen: palettes, cached sprites, text and fades.
import { buildArt } from './sprites.js';
import { FONT, LINE_H, textWidth, wrap } from './font.js';

export const W = 160, H = 144;

// Four shades each, lightest first.
export const PALETTES = [
  { name: 'GREEN', c: ['#e0f8d0', '#88c070', '#346856', '#081820'] },
  { name: 'POCKET', c: ['#c4cfa1', '#8b956d', '#4d533c', '#1f1f1f'] },
  { name: 'OCEAN', c: ['#e3f2fd', '#7fb2d9', '#3b5f8f', '#0f1a33'] },
  { name: 'BERRY', c: ['#f8e3e8', '#e08da5', '#8a3f6e', '#2b0f2e'] },
  { name: 'AMBER', c: ['#fff2c4', '#f7b346', '#a05a21', '#2e1408'] },
  { name: 'MONO', c: ['#ffffff', '#aaaaaa', '#555555', '#000000'] },
];

const ART = buildArt();

export class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingEnabled = false;
    this.cache = new Map();
    this.setPalette(0);
  }

  setPalette(i) {
    this.palIndex = ((i % PALETTES.length) + PALETTES.length) % PALETTES.length;
    this.pal = PALETTES[this.palIndex].c;
    this.rgb = this.pal.map((h) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16)));
    this.cache.clear();
  }

  // A sprite as a canvas, drawn in the current palette ('X' pixels in `tint`).
  img(name, tint = 3) {
    const key = name + '/' + tint;
    let c = this.cache.get(key);
    if (c) return c;
    const art = ART[name] || FONT[name]?.rows.map((r) => r.replace(/#/g, 'X'));
    const h = art.length, w = art[0].length;
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = art[y][x];
      if (ch === '.') continue;
      const rgb = this.rgb[ch === 'X' ? tint : +ch];
      const o = (y * w + x) * 4;
      id.data[o] = rgb[0]; id.data[o + 1] = rgb[1]; id.data[o + 2] = rgb[2]; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    this.cache.set(key, c);
    return c;
  }

  clear(c = 0) { this.rect(0, 0, W, H, c); }
  rect(x, y, w, h, c) { this.ctx.fillStyle = this.pal[c]; this.ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  frame(x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); }
  spr(name, x, y, tint) { this.ctx.drawImage(this.img(name, tint), Math.round(x), Math.round(y)); }

  // a box with a double border, like a Game Boy text window
  box(x, y, w, h) {
    this.rect(x, y, w, h, 0);
    this.frame(x, y, w, h, 3);
    this.frame(x + 2, y + 2, w - 4, h - 4, 3);
  }

  text(str, x, y, c = 3) {
    let cx = Math.round(x);
    for (const ch of String(str).toUpperCase()) {
      const g = FONT[ch] || FONT['?'];
      if (ch !== ' ') this.ctx.drawImage(this.img(FONT[ch] ? ch : '?', c), cx, Math.round(y));
      cx += g.w + 1;
    }
  }
  textC(str, y, c = 3, cx = W / 2) { this.text(str, cx - Math.floor(textWidth(str) / 2), y, c); }
  // wrapped and centred; returns the height used
  para(str, y, c = 3, max = W - 16) {
    const lines = wrap(str.toUpperCase(), max);
    lines.forEach((l, i) => this.textC(l, y + i * LINE_H, c));
    return lines.length * LINE_H;
  }
  // big blocky letters (each font pixel becomes s x s)
  big(str, x, y, s, c) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch] || FONT['?'];
      g.rows.forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') this.rect(cx + rx * s, y + ry * s, s, s, c); }));
      cx += (g.w + 1) * s;
    }
  }
  bigWidth(str, s) { return textWidth(str) * s; }

  // Game Boy style fade: shift every shade towards white (+) or black (-).
  fade(amount) {
    if (!amount) return;
    const id = this.ctx.getImageData(0, 0, W, H);
    const d = id.data;
    const look = new Map(this.rgb.map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));
    for (let o = 0; o < d.length; o += 4) {
      const i = look.get((d[o] << 16) | (d[o + 1] << 8) | d[o + 2]) ?? 3;
      const j = Math.max(0, Math.min(3, i - amount));
      const c = this.rgb[j];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
    }
    this.ctx.putImageData(id, 0, 0);
  }

  // The "rewind" wobble when you echo: each row slides sideways.
  wobble(t) {
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    src.getContext('2d').drawImage(this.canvas, 0, 0);
    this.clear(0);
    for (let y = 0; y < H; y++) {
      const off = Math.round(Math.sin(y * 0.25 + t * 30) * 6 * Math.sin(t * Math.PI));
      this.ctx.drawImage(src, 0, y, W, 1, off, y, W, 1);
    }
  }
}

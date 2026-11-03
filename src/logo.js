// The ECHO logo: chunky pixel letters (the O has eyes, like the hero) with
// two echoes trailing behind. Used on the title screen and by
// scripts/make-logo.mjs, which exports it as public/logo.svg and logo.png.

const LETTERS = {
  E: ['########', '########', '##......', '##......', '######..', '######..', '##......', '##......', '########', '########'],
  C: ['.#######', '########', '##......', '##......', '##......', '##......', '##......', '##......', '########', '.#######'],
  H: ['##....##', '##....##', '##....##', '##....##', '########', '########', '##....##', '##....##', '##....##', '##....##'],
  // the O peeks at you
  O: ['.########.', '##########', '##......##', '##......##', '##.e..e.##', '##.e..e.##', '##......##', '##......##', '##########', '.########.'],
};

// the word as one mask of rows ("#" = ink, "e" = eyes: front layer only)
export const LOGO = (() => {
  const rows = Array(10).fill('');
  [...'ECHO'].forEach((ch, i) => LETTERS[ch].forEach((r, y) => { rows[y] += (i ? '...' : '') + r; }));
  return rows;
})();
export const LOGO_W = LOGO[0].length, LOGO_H = LOGO.length;

// The layers to draw, back to front: [dx, dy, shade, dithered]. `spread`
// (0..1) is how far the echoes trail behind; the title screen breathes it.
export function logoLayers(spread = 1) {
  const d = (k) => Math.round(k * 2 * spread);
  return [[d(2), d(2), 1, true], [d(1), d(1), 2, false], [0, 0, 3, false]];
}

const ink = (x, y) => LOGO[y] && (LOGO[y][x] === '#' || LOGO[y][x] === 'e');

// Call plot(x, y, shade) for every logo pixel (in logo pixels; the front
// letters start at 1,1 because they get a 1px light outline that keeps the
// echoes from smudging them). The whole logo is LOGO_W + 6 by LOGO_H + 6.
export function eachLogoPixel(plot, spread = 1) {
  for (const [dx, dy, c, dither] of logoLayers(spread)) {
    if (c === 3) { // the outline
      for (let y = -1; y <= LOGO_H; y++) for (let x = -1; x <= LOGO_W; x++) {
        if (ink(x, y)) continue;
        let near = false;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) near ||= ink(x + u, y + v);
        if (near) plot(x + 1, y + 1, 0);
      }
    }
    LOGO.forEach((r, y) => [...r].forEach((p, x) => {
      if (p === 'e') { if (c === 3) plot(x + 1, y + 1, 3); return; }
      if (p === '#' && !(dither && (x + y) % 2)) plot(x + dx + 1, y + dy + 1, c);
    }));
  }
}

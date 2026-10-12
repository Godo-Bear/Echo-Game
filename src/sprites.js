// All the pixel art, as grids of palette shades:
// "0" lightest, "1" light, "2" dark, "3" darkest, "." see-through.
// Tiles are 16x16. Most tiles are drawn with small helper functions; the
// hero is hand-drawn.

const grid = (w, h, c = '.') => Array.from({ length: h }, () => Array(w).fill(c));
const rect = (g, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; };
const frame = (g, x0, y0, x1, y1, c) => { rect(g, x0, y0, x1, y0, c); rect(g, x0, y1, x1, y1, c); rect(g, x0, y0, x0, y1, c); rect(g, x1, y0, x1, y1, c); };
const stamp = (g, art, x0, y0, map = {}) => art.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') g[y0 + y][x0 + x] = map[c] ?? c; }));
const rows = (s) => s.split('|');
const fin = (g) => g.map((r) => r.join(''));
const rotate = (g) => g[0].map((_, x) => g.map((r) => r[x]).reverse()); // 90° clockwise

// The plate / door symbols: A = circle, B = triangle, C = diamond.
export const SYMBOLS = {
  a: rows('.###.|#####|#####|#####|.###.'),
  b: rows('..#..|..#..|.###.|.###.|#####'),
  c: rows('..#..|.###.|#####|.###.|..#..'),
};

function floor() {
  const g = grid(16, 16, '0');
  g[0][0] = '1';
  g[4][11] = '1'; g[10][4] = '1';
  return g;
}

function wall() {
  const g = grid(16, 16, '2');
  rect(g, 0, 7, 15, 7, '3'); rect(g, 0, 15, 15, 15, '3');
  rect(g, 0, 0, 15, 0, '1'); rect(g, 0, 8, 15, 8, '1');
  rect(g, 8, 0, 8, 6, '3'); rect(g, 4, 8, 4, 14, '3'); rect(g, 12, 8, 12, 14, '3');
  g[0][8] = '3'; g[8][4] = '3'; g[8][12] = '3';
  return g;
}

function voidTile() {
  const g = grid(16, 16, '3');
  for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 2 : 0); x < 16; x += 4) g[y][x] = '2';
  return g;
}

function crate() {
  const g = grid(16, 16);
  rect(g, 2, 15, 14, 15, '1'); // shadow
  rect(g, 1, 1, 14, 14, '3');
  rect(g, 2, 2, 13, 13, '2');
  rect(g, 3, 3, 12, 12, '1');
  for (let i = 0; i < 10; i++) { g[3 + i][3 + i] = '2'; g[3 + i][12 - i] = '2'; }
  rect(g, 3, 3, 12, 3, '0');
  rect(g, 1, 13, 14, 14, '3');
  return g;
}

function plate(ch, down) {
  const g = floor();
  if (!down) {
    rect(g, 2, 12, 12, 13, '2'); frame(g, 2, 3, 12, 13, '3'); rect(g, 2, 13, 12, 13, '3');
    rect(g, 3, 4, 11, 11, '1'); rect(g, 3, 4, 11, 4, '0');
    stamp(g, SYMBOLS[ch], 5, 6, { '#': '3' });
  } else {
    frame(g, 2, 5, 12, 13, '3'); rect(g, 3, 6, 11, 12, '2');
    stamp(g, SYMBOLS[ch], 5, 7, { '#': '1' });
  }
  return g;
}

function badge(g, ch, inv, x, y) {
  frame(g, x, y, x + 6, y + 6, inv ? '0' : '3');
  rect(g, x + 1, y + 1, x + 5, y + 5, inv ? '3' : '0');
  stamp(g, SYMBOLS[ch], x + 1, y + 1, { '#': inv ? '0' : '3' });
}

function doorClosed(ch, inv) {
  const g = grid(16, 16, '2');
  for (const y of [2, 5, 8, 11]) { rect(g, 1, y, 14, y, '1'); rect(g, 1, y + 1, 14, y + 1, '3'); }
  frame(g, 0, 0, 15, 15, '3');
  badge(g, ch, inv, 4, 4);
  return g;
}

// posts on the left/right (door in a vertical wall) or top/bottom
function doorOpen(ch, inv, sideways) {
  let g = floor();
  rect(g, 0, 0, 1, 15, '2'); rect(g, 14, 0, 15, 15, '2');
  rect(g, 1, 0, 1, 15, '3'); rect(g, 14, 0, 14, 15, '3');
  for (let y = 2; y < 16; y += 4) { g[y][0] = '1'; g[y][15] = '1'; }
  stamp(g, SYMBOLS[ch], 5, 5, { '#': inv ? '2' : '1' });
  if (sideways) g = rotate(g);
  return g;
}

function exitTile(glow) {
  const g = grid(16, 16, '3');
  rect(g, 1, 1, 14, 2, glow ? '0' : '1'); rect(g, 1, 3, 14, 3, '2');
  rect(g, 2, 4, 13, 5, '1'); rect(g, 2, 6, 13, 6, '3');
  rect(g, 3, 7, 12, 8, '2'); rect(g, 3, 9, 12, 9, '3');
  rect(g, 4, 10, 11, 11, '2');
  frame(g, 0, 0, 15, 15, '3');
  return g;
}

function emitter(dir) {
  let g = grid(16, 16, '2');
  frame(g, 0, 0, 15, 15, '3');
  for (const [x, y] of [[2, 2], [2, 13], [13, 2], [13, 13]]) g[y][x] = '1';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d <= 4.6) g[y][x] = '3';
    if (d <= 3.2) g[y][x] = '1';
    if (d <= 1.6) g[y][x] = '0';
  }
  rect(g, 12, 6, 15, 9, '3'); rect(g, 13, 7, 15, 8, '0');
  const turns = { R: 0, D: 1, L: 2, U: 3 }[dir];
  for (let i = 0; i < turns; i++) g = rotate(g);
  return g;
}

// ----- the hero -----
const HERO = rows(
  '................|......3333......|....33222233....|...3211222223...|...3220000223...|..322000000223..|..320000000023..|..320000000023..|' +
  '..322000000223..|...3220000223...|...3322222233...|..332222222233..|.32122222222123.|..322222222223..|...3223..3223...|...3333..3333...'
);
const BACK = HERO.map((r, y) => (y >= 4 && y <= 9 ? r.replace(/0/g, '2') : r));
function hero(face, step) {
  const g = (face === 'U' ? BACK : HERO).map((r) => [...r]);
  if (face !== 'U') {
    const eyes = face === 'R' ? [7, 10] : face === 'L' ? [5, 8] : [6, 9];
    for (const x of eyes) { g[6][x] = '3'; g[7][x] = '3'; }
  }
  if (step) { // other foot forward
    g[14] = [...'...3223...323...']; g[15] = [...'...3333...333...'];
  }
  return g;
}
// an echo: the hero, see-through (every other pixel) and lighter
function ghostOf(g) {
  return g.map((r, y) => r.map((c, x) => {
    if (c === '.') return '.';
    if (c === '3') return y >= 5 && y <= 8 && x > 3 && x < 12 ? '3' : '2';
    return (x + y) % 2 ? '1' : '.';
  }));
}
function inverted(g) { return g.map((r) => r.map((c) => ({ 0: '3', 1: '2', 2: '1', 3: '0' })[c] ?? c)); }

// ----- small icons -----
const ICONS = {
  echo: '..###..|.#####.|##.#.##|#######|#######|#######|#.#.#.#',
  echoUsed: '..###..|.#...#.|#..#..#|#.....#|#.....#|#.....#|#.#.#.#',
  lock: '.###.|#...#|#...#|#####|##.##|##.##|#####',
  tick: '......#|.....##|#...##.|##.##..|.###...|..#....',
  arrowR: '#..|##.|###|##.|#..',
  arrowL: '..#|.##|###|.##|..#',
  arrowU: '..#..|.###.|#####',
  arrowD: '#####|.###.|..#..',
  dot: '##|##',
  spark: '..#..|#.#.#|.###.|#.#.#|..#..',
  spark2: '#...#|..#..|.###.|..#..|#...#',
};

// Build every sprite as an array of strings.
export function buildArt() {
  const art = {};
  const put = (name, g) => { art[name] = fin(g); };
  put('floor', floor());
  put('wall', wall());
  put('void', voidTile());
  put('crate', crate());
  put('exit0', exitTile(false));
  put('exit1', exitTile(true));
  for (const ch of 'abc') {
    put(`plate_${ch}`, plate(ch, false));
    put(`plate_${ch}_down`, plate(ch, true));
    for (const inv of [false, true]) {
      const k = `${ch}${inv ? '_inv' : ''}`;
      put(`door_${k}`, doorClosed(ch, inv));
      put(`door_${k}_open`, doorOpen(ch, inv, false));
      put(`door_${k}_open_side`, doorOpen(ch, inv, true));
    }
  }
  for (const d of 'UDLR') put(`emitter_${d}`, emitter(d));
  for (const face of 'UDLR') for (const step of [0, 1]) {
    const g = hero(face, step);
    put(`hero_${face}${step}`, g);
    put(`ghost_${face}${step}`, ghostOf(g));
    put(`zap_${face}${step}`, inverted(g));
  }
  for (const [k, s] of Object.entries(ICONS)) art[k] = rows(s).map((r) => r.replace(/#/g, 'X'));
  return art;
}

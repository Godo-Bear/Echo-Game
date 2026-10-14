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

// a one-way arrow tile (drawn pointing right, then turned)
function oneway(dir) {
  let g = floor();
  frame(g, 1, 1, 14, 14, '1');
  stamp(g, rows('#...#..|##..##.|.##..##|##..##.|#...#..'), 4, 5, { '#': '2' });
  const turns = { R: 0, D: 1, L: 2, U: 3 }[dir];
  for (let i = 0; i < turns; i++) g = rotate(g);
  return g;
}

// conveyor belt (drawn running right, then turned); two frames so it moves
function belt(dir, f) {
  let g = grid(16, 16, '2');
  rect(g, 0, 0, 15, 1, '3'); rect(g, 0, 14, 15, 15, '3');
  for (let x0 = -8 + f * 4; x0 < 16; x0 += 8) {
    for (let i = 0; i < 5; i++) {
      for (const [x, y] of [[x0 + i, 3 + i], [x0 + i, 12 - i]]) if (x >= 0 && x < 16) g[y][x] = '1';
    }
  }
  const turns = { R: 0, D: 1, L: 2, U: 3 }[dir];
  for (let i = 0; i < turns; i++) g = rotate(g);
  return g;
}

function ice() {
  const g = grid(16, 16, '1');
  for (let i = 0; i < 16; i++) { if (i + 3 < 16) g[i][15 - i - 3 < 0 ? 0 : 12 - i < 0 ? 0 : 12 - i] = '0'; }
  for (const [x, y, n] of [[9, 2, 4], [2, 9, 3], [11, 10, 3]]) for (let i = 0; i < n; i++) g[y + i][x + n - i] = '0';
  g[0][0] = '2';
  return g;
}

function tele(ch, f) {
  const g = floor();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d <= 7) g[y][x] = '3';
    if (d <= 6) g[y][x] = f ? '1' : '2';
    if (d <= 4.6) g[y][x] = f ? '2' : '1';
    if (d <= 3.2) g[y][x] = '0';
  }
  stamp(g, SYMBOLS[{ x: 'a', y: 'b', z: 'c' }[ch]], 5, 5, { '#': '3' });
  return g;
}

function lever(ch, on) {
  const g = floor();
  rect(g, 3, 11, 12, 13, '3'); rect(g, 4, 11, 11, 11, '2');
  for (let i = 0; i < 6; i++) g[10 - i][on ? 8 + i : 7 - i] = '3';
  const kx = on ? 13 : 2;
  rect(g, kx - 1, 2, kx + 1, 4, '3'); g[2][kx - 1] = '1';
  stamp(g, SYMBOLS[ch], on ? 2 : 9, 3, { '#': '2' });
  return g;
}

// ghost gate: a crossed-out echo on a spooky dotted frame
function gate() {
  const g = floor();
  for (let i = 0; i < 16; i += 2) { g[0][i] = '2'; g[15][i + 1] = '2'; g[i + 1][0] = '2'; g[i][15] = '2'; }
  stamp(g, rows('..###..|.#####.|##.#.##|#######|#######|#######|#.#.#.#'), 4, 4, { '#': '1' });
  for (let i = 0; i < 10; i++) g[3 + i][3 + i] = '3';
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

// ----- the heroes -----
// Every hero shares the body (rows 10-15) and has its own head. Eyes are
// added per facing: `eyes` gives their x for down / left / right, on `eyeRows`.
const BODY = rows('...3322222233...|..332222222233..|.32122222222123.|..322222222223..|...3223..3223...|...3333..3333...');
const STEP = rows('...3223...323...|...3333...333...');
export const HEROES = {
  HOOD: { head: '................|......3333......|....33222233....|...3211222223...|...3220000223...|..322000000223..|..320000000023..|..320000000023..|..322000000223..|...3220000223...', eyeRows: [6, 7], eyes: { D: [6, 9], L: [5, 8], R: [7, 10] } },
  ROBOT: { head: '................|.......33.......|........3.......|...3333333333...|...3111111113...|...3100000013...|...3100000013...|...3100000013...|...3111111113...|...3333333333...', eyeRows: [6], eyes: { D: [6, 9], L: [5, 8], R: [7, 10] } },
  CAT: { head: '................|...33......33...|...323....323...|...3223333223...|..322222222223..|..322000000223..|..320000000023..|..320000000023..|..322001100223..|...3222222223...', eyeRows: [6, 7], eyes: { D: [6, 9], L: [5, 8], R: [7, 10] } },
  KNIGHT: { head: '.........33.....|........3113....|....33333333....|...3111111113...|..311111111113..|..312222222213..|..313000000313..|..312222222213..|..311111111113..|...3111111113...', eyeRows: [6], eyes: { D: [6, 9], L: [5, 8], R: [7, 10] } },
  FROG: { head: '................|..3333....3333..|.300003..300003.|.30000333300003.|.32222222222223.|.32222222222223.|.32233333333223.|..322222222223..|...3222222223...|....33333333....', eyeRows: [2, 3], eyes: { D: [3, 11], L: [2, 10], R: [4, 12] } },
};
function hero(name, face, step) {
  const h = HEROES[name] || HEROES.HOOD;
  let head = rows(h.head);
  if (face === 'U') head = head.map((r) => r.replace(/0/g, '2')); // the back of the head
  const g = [...head, ...BODY].map((r) => [...r]);
  if (face !== 'U') for (const x of h.eyes[face]) for (const y of h.eyeRows) g[y][x] = '3';
  if (step) { g[14] = [...STEP[0]]; g[15] = [...STEP[1]]; }
  return g;
}
// an echo: the hero, see-through (every other pixel) and lighter
function ghostOf(g) {
  const eyes = new Set();
  return g.map((r, y) => r.map((c, x) => {
    if (c === '.') return '.';
    if (c === '3') return y >= 2 && y <= 8 && x > 2 && x < 13 && g[y][x - 1] !== '.' && g[y][x + 1] !== '.' && g[y][x - 1] !== '3' ? '3' : '2';
    return (x + y) % 2 ? '1' : '.';
  }));
}
function inverted(g) { return g.map((r) => r.map((c) => ({ 0: '3', 1: '2', 2: '1', 3: '0' })[c] ?? c)); }

// The sprites for one hero (you, your echoes, and you getting zapped).
export function heroArt(name) {
  const art = {};
  for (const face of 'UDLR') for (const step of [0, 1]) {
    const g = hero(name, face, step);
    art[`hero_${face}${step}`] = fin(g);
    art[`ghost_${face}${step}`] = fin(ghostOf(g));
    art[`zap_${face}${step}`] = fin(inverted(g));
  }
  return art;
}

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
  for (const d of 'UDLR') {
    put(`emitter_${d}`, emitter(d)); put(`oneway_${d}`, oneway(d));
    put(`belt_${d}0`, belt(d, 0)); put(`belt_${d}1`, belt(d, 1));
  }
  put('ice', ice());
  put('gate', gate());
  for (const ch of 'xyz') { put(`tele_${ch}0`, tele(ch, 0)); put(`tele_${ch}1`, tele(ch, 1)); }
  for (const ch of 'abc') { put(`lever_${ch}0`, lever(ch, false)); put(`lever_${ch}1`, lever(ch, true)); }
  Object.assign(art, heroArt('HOOD'));
  for (const [k, s] of Object.entries(ICONS)) art[k] = rows(s).map((r) => r.replace(/#/g, 'X'));
  return art;
}

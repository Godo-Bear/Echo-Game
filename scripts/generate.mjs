// Room generator: builds random rooms from a recipe and keeps only those the
// exact search proves need every echo they give you (and take a while).
//   node scripts/generate.mjs <count> <recipe> [seed] [echoes]
// recipes: plates crates lasers belts ice tele lever gate oneway mix
// Prints JSON lines: { map, echoes, turns, solution }
import { parseLevel } from '../src/sim.js';
import { search } from '../src/search.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FEATURES = ['crates', 'lasers', 'belts', 'ice', 'tele', 'lever', 'gate', 'oneway'];

export function makeRoom(r, recipe) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const W = int(7, 10), H = int(5, 8);
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.')));
  const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const free = () => { for (let i = 0; i < 200; i++) { const x = int(1, W - 2), y = int(1, H - 2); if (g[y][x] === '.') return [x, y]; } return null; };
  const feats = recipe === 'mix' ? [...new Set([pick(FEATURES), pick(FEATURES)])] : recipe === 'plates' ? [] : [recipe];

  // a dividing wall with a door in it splits the room in two
  const vertical = W - 2 >= H - 2 ? r() < 0.75 : r() < 0.25;
  const doorCh = pick(['A', 'A', 'A', '1']);
  let cut;
  if (vertical) {
    const x = cut = int(2, W - 3);
    for (let y = 1; y < H - 1; y++) g[y][x] = '#';
    g[int(1, H - 2)][x] = feats.includes('gate') && r() < 0.4 ? '=' : doorCh;
  } else {
    const y = cut = int(2, H - 3);
    for (let x = 1; x < W - 1; x++) g[y][x] = '#';
    g[y][int(1, W - 2)] = doorCh;
  }
  // a few loose wall bits
  for (let i = int(0, 3); i > 0; i--) { const p = free(); if (p) g[p[1]][p[0]] = '#'; }

  const put = (c) => { const p = free(); if (p) g[p[1]][p[0]] = c; return p; };
  const usesLever = feats.includes('lever');
  // plates for the door (unless a lever works it)
  if (!usesLever || r() < 0.5) for (let i = int(1, 2); i > 0; i--) put('a');
  if (usesLever) put('f');
  if (r() < 0.3) { put('b'); put('B'); }
  if (feats.includes('crates')) for (let i = int(1, 2); i > 0; i--) put('o');
  if (feats.includes('lasers')) {
    // an emitter in the outer wall, aimed inwards
    for (let tries = 0; tries < 30; tries++) {
      const side = pick('LRUD');
      const x = side === 'L' ? 0 : side === 'R' ? W - 1 : int(1, W - 2);
      const y = side === 'U' ? 0 : side === 'D' ? H - 1 : int(1, H - 2);
      const dir = { L: '>', R: '<', U: 'v', D: '^' }[side];
      const [dx, dy] = { '>': [1, 0], '<': [-1, 0], 'v': [0, 1], '^': [0, -1] }[dir];
      if (g[y + dy]?.[x + dx] === '.') { g[y][x] = dir; break; }
    }
  }
  if (feats.includes('belts')) {
    const dir = pick(['→', '←', '↑', '↓']);
    const [dx, dy] = { '→': [1, 0], '←': [-1, 0], '↑': [0, -1], '↓': [0, 1] }[dir];
    let p = free();
    for (let i = int(2, 5); i > 0 && p && inside(p[0], p[1]) && g[p[1]][p[0]] === '.'; i--) { g[p[1]][p[0]] = dir; p = [p[0] + dx, p[1] + dy]; }
  }
  if (feats.includes('ice')) {
    const [x0, y0] = free() || [1, 1];
    for (let y = y0; y < y0 + int(1, 3); y++) for (let x = x0; x < x0 + int(2, 4); x++) if (inside(x, y) && g[y][x] === '.') g[y][x] = '~';
  }
  if (feats.includes('tele')) { put('x'); put('x'); }
  if (feats.includes('oneway')) for (let i = int(1, 2); i > 0; i--) put(pick('RLUD'));
  if (feats.includes('gate')) put('=');
  // start and exit on opposite sides of the divider
  const sideOf = (x, y) => ((vertical ? x : y) < cut ? 0 : 1);
  const p = put('P');
  let e = null;
  for (let i = 0; i < 50 && !e; i++) { const q = free(); if (q && sideOf(q[0], q[1]) !== sideOf(p[0], p[1])) e = q; }
  if (!e) e = free();
  if (!p || !e) return null;
  g[e[1]][e[0]] = 'E';
  return g.map((row) => row.join(''));
}

// Is this room good? Needs exactly `echoes`, takes at least `minTurns`.
export function judge(map, echoes, { minTurns = 10, limit = 400000, mustMatter = null } = {}) {
  let lv;
  try { lv = parseLevel({ name: 'gen', map }); } catch { return null; }
  if (echoes > 0) {
    const fewer = search(lv, echoes - 1, limit);
    if (!fewer || fewer.turns >= 0) return null;
  }
  const best = search(lv, echoes, limit);
  if (!best || best.turns < minTurns) return null;
  // the new tiles must matter: as plain floor, the room can't be done
  if (mustMatter) {
    const plain = map.map((row) => [...row].map((c) => (mustMatter.includes(c) ? '.' : c)).join(''));
    if (plain.join('') !== map.join('')) {
      let lv2; try { lv2 = parseLevel({ name: 'gen', map: plain }); } catch { lv2 = null; }
      if (lv2) { const r2 = search(lv2, echoes, limit); if (!r2 || r2.turns >= 0) return null; }
    }
  }
  return { map, echoes, turns: best.turns, solution: best.runs };
}

// which map characters make up each recipe's new tile
export const MATTER = { belts: '→←↑↓', ice: '~', tele: 'xyz', lever: 'fgh', gate: '=', oneway: 'RLUD', lasers: '><^v', crates: 'o', mix: '→←↑↓~xyzfgh=RLUD><^vo' };

if (import.meta.url === `file://${process.argv[1]}`) {
  const [count = 5, recipe = 'mix', seed = 1, echoes = 1] = process.argv.slice(2);
  const r = rng(Number(seed));
  let found = 0, tries = 0;
  while (found < Number(count) && tries < 20000) {
    tries++;
    const map = makeRoom(r, recipe);
    if (!map) continue;
    const res = judge(map, Number(echoes), { minTurns: Number(process.env.MIN || 12), mustMatter: MATTER[recipe] });
    if (res) { found++; console.log(JSON.stringify({ ...res, recipe, tries })); }
  }
  if (!found) console.error('nothing found');
}

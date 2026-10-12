// Echo's rules: a pure, step-by-step simulation with no drawing or timing.
// A room is always rebuilt from the level plus the moves made so far, so
// undo, echoes and the level checker (scripts/check-levels.mjs) all share
// this one file.
//
// Map legend
//   #  wall              .  floor            (space)  outside the room
//   P  start             E  exit (stairs)
//   a b c  pressure plates
//   A B C  doors: open while EVERY plate of their letter is pressed
//   1 2 3  reverse doors: CLOSED while every plate of a / b / c is pressed
//   o  crate (push it; it holds plates down and blocks lasers)
//   > < ^ v  laser emitters, firing that way
//   R L U D  one-way arrows: can only be stepped onto (or pushed onto) going
//            that way. Leaving them is free; lasers pass over them.
//
// Each turn: echoes move first (oldest first), then you. Doors use the state
// they had at the start of the turn, so what you see is what you get. A door
// can't close on anything standing in it. Lasers zap you but not your echoes;
// echoes and crates block the beam (sharing a square with an echo doesn't
// shield you: it has to be between you and the laser).

export const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const EMIT = { '>': 'R', '<': 'L', '^': 'U', 'v': 'D' };

export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const tiles = [];
  let start = null, exit = null;
  const crates = [], plates = [], doors = [], emitters = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] ?? ' ';
      let t = { k: 'floor' };
      if (c === '#') t = { k: 'wall' };
      else if (c === ' ') t = { k: 'void' };
      else if (c === 'P') start = { x, y };
      else if (c === 'E') { t = { k: 'exit' }; exit = { x, y }; }
      else if (c === 'o') crates.push({ x, y });
      else if ('abc'.includes(c)) { t = { k: 'plate', ch: c }; plates.push({ x, y, ch: c }); }
      else if ('ABC'.includes(c)) { t = { k: 'door', ch: c.toLowerCase(), inv: false, i: doors.length }; doors.push({ x, y, ch: c.toLowerCase(), inv: false }); }
      else if ('123'.includes(c)) { const ch = 'abc'['123'.indexOf(c)]; t = { k: 'door', ch, inv: true, i: doors.length }; doors.push({ x, y, ch, inv: true }); }
      else if ('RLUD'.includes(c)) t = { k: 'oneway', dir: c };
      else if (EMIT[c]) { t = { k: 'emitter', dir: EMIT[c] }; emitters.push({ x, y, dir: EMIT[c] }); }
      else if (c !== '.') throw new Error(`Unknown map character "${c}" in level "${def.name}"`);
      row.push(t);
    }
    tiles.push(row);
  }
  if (!start || !exit) throw new Error(`Level "${def.name}" needs a P and an E`);
  return { ...def, w, h, tiles, start, exit, crates, plates, doors, emitters };
}

export function tileAt(lv, x, y) {
  if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return { k: 'void' };
  return lv.tiles[y][x];
}

const solid = (t) => t.k === 'wall' || t.k === 'void' || t.k === 'emitter';
const crateIndex = (s, x, y) => s.crates.findIndex((c) => c.x === x && c.y === y);
const bodyAt = (s, x, y) => (s.player.x === x && s.player.y === y) || s.ghosts.some((g) => g.x === x && g.y === y);

// Can something walk (or be pushed) into this tile, ignoring crates and bodies?
// `dir` is the way you're moving (left out for laser beams).
function open(lv, s, x, y, dir) {
  const t = tileAt(lv, x, y);
  if (solid(t)) return false;
  if (dir && t.k === 'oneway' && t.dir !== dir) return false;
  if (t.k === 'door' && !s.doorOpen[t.i]) return false;
  return true;
}

// Try to move one body. Returns true if it moved (or waited).
function tryMove(lv, s, body, a) {
  if (a === 'W') return true;
  const [dx, dy] = DIRS[a];
  const x = body.x + dx, y = body.y + dy;
  if (!open(lv, s, x, y, a)) return false;
  const ci = crateIndex(s, x, y);
  if (ci >= 0) {
    const cx = x + dx, cy = y + dy;
    if (!open(lv, s, cx, cy, a) || crateIndex(s, cx, cy) >= 0 || bodyAt(s, cx, cy)) return false;
    s.crates[ci] = { x: cx, y: cy };
  }
  body.x = x; body.y = y;
  return true;
}

// Work out plates, doors and laser beams for a state (after everyone moved).
function settle(lv, s) {
  const occupied = (x, y) => bodyAt(s, x, y) || crateIndex(s, x, y) >= 0;
  const pressed = {};
  for (const ch of 'abc') {
    const ps = lv.plates.filter((p) => p.ch === ch);
    pressed[ch] = ps.length > 0 && ps.every((p) => occupied(p.x, p.y));
  }
  s.pressed = pressed;
  s.doorOpen = lv.doors.map((d) => (d.inv ? !pressed[d.ch] : pressed[d.ch]) || occupied(d.x, d.y));

  // Lasers
  s.beams = [];
  s.hits = [];
  s.zapped = false;
  for (const e of lv.emitters) {
    const [dx, dy] = DIRS[e.dir];
    let x = e.x + dx, y = e.y + dy;
    const axis = dx ? 'h' : 'v';
    for (;;) {
      if (!open(lv, s, x, y)) break;
      if (crateIndex(s, x, y) >= 0) { s.hits.push({ x, y, dir: e.dir, what: 'crate' }); break; }
      if (s.player.x === x && s.player.y === y) { s.hits.push({ x, y, dir: e.dir, what: 'player' }); s.zapped = true; break; }
      if (s.ghosts.some((g) => g.x === x && g.y === y)) { s.hits.push({ x, y, dir: e.dir, what: 'ghost' }); break; }
      s.beams.push({ x, y, axis });
      x += dx; y += dy;
    }
  }
  if (s.zapped) s.player.alive = false;
  s.won = s.player.alive && s.player.x === lv.exit.x && s.player.y === lv.exit.y;
  return s;
}

export function initialState(lv, ghostCount = 0) {
  const s = {
    tick: 0,
    player: { x: lv.start.x, y: lv.start.y, alive: true },
    ghosts: Array.from({ length: ghostCount }, () => ({ x: lv.start.x, y: lv.start.y, moved: false })),
    crates: lv.crates.map((c) => ({ ...c })),
    doorOpen: lv.doors.map(() => false),
  };
  return settle(lv, s);
}

function clone(s) {
  return {
    tick: s.tick,
    player: { ...s.player },
    ghosts: s.ghosts.map((g) => ({ ...g })),
    crates: s.crates.map((c) => ({ ...c })),
    doorOpen: s.doorOpen.slice(),
  };
}

// One turn. ghostActs[i] is what echo i does this turn ('U','D','L','R','W').
// Returns the next state, or null if your own move was blocked (a blocked
// move doesn't use up a turn) or the run is over (zapped / already out).
export function stepWith(lv, s, ghostActs, act) {
  if (!s.player.alive || s.won) return null;
  const n = clone(s);
  n.ghosts.forEach((g, i) => {
    const a = ghostActs[i] || 'W';
    g.moved = a !== 'W' && tryMove(lv, n, g, a);
  });
  if (!tryMove(lv, n, n.player, act) && act !== 'W') return null;
  n.tick = s.tick + 1;
  return settle(lv, n);
}

// One turn of a run, with echoes replaying their recorded runs.
export function step(lv, s, runs, act) {
  return stepWith(lv, s, runs.map((r) => r[s.tick] || 'W'), act);
}

// Replay a whole attempt: every echo's run plus the current moves.
// Returns every state from turn 0 to now.
export function simulate(lv, runs, moves) {
  let s = initialState(lv, runs.length);
  const states = [s];
  for (const a of moves) {
    const n = step(lv, s, runs, a);
    if (!n) break; // shouldn't happen: recorded moves were all legal
    s = n;
    states.push(s);
  }
  return states;
}

// What each echo will do on the next turn (for the little arrows).
export function nextGhostActs(runs, tick) {
  return runs.map((r) => (tick < r.length ? r[tick] : null));
}

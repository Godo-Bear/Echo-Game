// Level-design helper: given a level number and the echo runs, finds the
// shortest final run that reaches the exit (or says there isn't one).
//   node scripts/solve.mjs 4 LLLWWWDDDD
import { LEVELS } from '../src/levels.js';
import { parseLevel, initialState, step } from '../src/sim.js';

const [n, ...runArgs] = process.argv.slice(2);
const def = LEVELS[Number(n) - 1];
const lv = parseLevel(def);
const runs = runArgs.map((r) => r.split(''));
const longest = Math.max(0, ...runs.map((r) => r.length));
const ACTS = ['U', 'D', 'L', 'R', 'W'];

const key = (s) => [s.player.x, s.player.y, Math.min(s.tick, longest + 1), s.ghosts.map((g) => g.x + ',' + g.y).join(';'), s.crates.map((c) => c.x + ',' + c.y).sort().join(';'), JSON.stringify(s.toggles)].join('|');
let frontier = [{ s: initialState(lv, runs.length), path: '' }];
const seen = new Set([key(frontier[0].s)]);
while (frontier.length) {
  const next = [];
  for (const { s, path } of frontier) {
    for (const a of ACTS) {
      const ns = step(lv, s, runs, a);
      if (!ns || !ns.player.alive) continue;
      if (ns.won) { console.log(`${def.name}: ${path + a} (${path.length + 1} moves)`); process.exit(0); }
      const k = key(ns);
      if (seen.has(k)) continue;
      seen.add(k);
      next.push({ s: ns, path: path + a });
    }
  }
  frontier = next;
}
console.log(`${def.name}: no way out with those echo runs`);

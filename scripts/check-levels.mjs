// Checks every level in src/levels.js:
//  1. its written solution really reaches the exit (using the game's own rules),
//  2. it can't be solved with fewer echoes than it gives you.
// For (2) it plays every run at once, each in its own copy of the room: run 1
// alone, run 2 with run 1's echo replaying, and so on. Every run's moves must
// work in its own copy (like when you recorded it), so this finds exactly
// the solutions a player could find.
// Run with: npm run check:levels   (add a level number to check just that one;
// SHOW=1 prints any shortcut it finds)
import { LEVELS } from '../src/levels.js';
import { parseLevel, initialState, simulate, stepWith } from '../src/sim.js';

const ACTS = ['U', 'D', 'L', 'R', 'W'];
const only = process.argv[2] ? Number(process.argv[2]) : null;

const worldKey = (s) => s.player.alive
  ? s.player.x + ',' + s.player.y + '/' + s.ghosts.map((g) => g.x + ',' + g.y).join(';') + '/' + s.crates.map((c) => c.x + ',' + c.y).sort().join(';')
  : 'x';

// Fewest turns to win using `echoes` echoes, -1 if impossible, null if the
// search got too big to finish.
export function search(lv, echoes, limit = 3000000) {
  // worlds[j]: run j's copy of the room, with echoes 0..j-1 in it
  const start = Array.from({ length: echoes + 1 }, (_, j) => initialState(lv, j));
  const seen = new Set([start.map(worldKey).join('|')]);
  let frontier = [{ worlds: start, path: [] }];
  let combos = [[]];
  for (let i = 0; i < echoes; i++) combos = combos.flatMap((c) => ACTS.map((a) => [...c, a]));
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const { worlds, path } of frontier) {
      for (const rec of combos) {
        // the recording runs: each move must work in its own world
        const nw = [];
        let ok = true;
        for (let j = 0; j < echoes; j++) {
          const w = worlds[j];
          if (!w.player.alive || w.won) {
            if (rec[j] !== 'W') { ok = false; break; } // a finished run just waits
            nw.push(w);
            continue;
          }
          const n = stepWith(lv, w, rec.slice(0, j), rec[j]);
          if (!n) { ok = false; break; }
          nw.push(n);
        }
        if (!ok) continue;
        for (const a of ACTS) {
          const n = stepWith(lv, worlds[echoes], rec, a);
          if (!n || !n.player.alive) continue;
          if (n.won) {
            if (process.env.SHOW) console.log('   shortcut, per turn (runs then you): ' + [...path, rec.join('') + a].join(' '));
            return depth;
          }
          const all = [...nw, n];
          const k = all.map(worldKey).join('|');
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ worlds: all, path: [...path, rec.join('') + a] });
        }
      }
      if (seen.size > limit) return null;
    }
    frontier = next;
  }
  return -1;
}

let bad = 0;
LEVELS.forEach((def, i) => {
  if (only && only !== i + 1) return;
  const lv = parseLevel(def);
  const tag = `${String(i + 1).padStart(2)} ${def.name.padEnd(16)}`;
  const problems = [];
  if (!initialState(lv, 0).player.alive) problems.push('you start in a laser');
  const runs = def.solution.slice(0, -1).map((r) => r.split(''));
  if (runs.length > def.echoes) problems.push(`solution uses ${runs.length} echoes, level gives ${def.echoes}`);
  const last = def.solution[def.solution.length - 1].split('');
  // each echo run must have been playable when it was recorded
  runs.forEach((r, ri) => {
    const st = simulate(lv, runs.slice(0, ri), r);
    if (st.length - 1 !== r.length) problems.push(`echo run ${ri + 1} gets stuck at move ${st.length}`);
  });
  const st = simulate(lv, runs, last);
  const end = st[st.length - 1];
  if (st.length - 1 !== last.length) problems.push(`final run gets stuck at move ${st.length} (${last[st.length - 1]})`);
  else if (!end.won) problems.push(`final run ends at ${end.player.x},${end.player.y}${end.player.alive ? '' : ' (zapped)'} without reaching the exit`);
  let fewer = '';
  if (def.echoes > 0) {
    const d = search(lv, def.echoes - 1);
    if (d === null) fewer = `(search too big to check ${def.echoes - 1} echoes)`;
    else if (d >= 0) problems.push(`solvable with only ${def.echoes - 1} echo(es) in ${d} turns`);
    else fewer = `needs all ${def.echoes}`;
  }
  const turns = def.solution.reduce((n, r) => n + r.length, 0);
  if (problems.length) { bad++; console.log(`✗ ${tag} ${problems.join('; ')}`); }
  else console.log(`✓ ${tag} ${def.echoes} echo  ${turns} moves  ${fewer}`);
});
if (bad) { console.log(`\n${bad} level(s) have problems`); process.exit(1); }
console.log('\nAll levels OK');

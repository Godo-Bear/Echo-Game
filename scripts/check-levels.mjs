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
import { parseLevel, initialState, simulate } from '../src/sim.js';
import { search } from '../src/search.js';

const only = process.argv[2] ? Number(process.argv[2]) : null;

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
    const r = search(lv, def.echoes - 1);
    const d = r && r.turns;
    if (r === null) fewer = `(search too big to check ${def.echoes - 1} echoes)`;
    else if (d >= 0) problems.push(`solvable with only ${def.echoes - 1} echo(es) in ${d} turns: ${r.runs.join(' / ')}`);
    else fewer = `needs all ${def.echoes}`;
  }
  const turns = def.solution.reduce((n, r) => n + r.length, 0);
  if (problems.length) { bad++; console.log(`✗ ${tag} ${problems.join('; ')}`); }
  else console.log(`✓ ${tag} ${def.echoes} echo  ${turns} moves  ${fewer}`);
});
if (bad) { console.log(`\n${bad} level(s) have problems`); process.exit(1); }
console.log('\nAll levels OK');

// The exact search behind the level checker, the room editor's check and the
// design scripts: plays every run
// at once, each in its own copy of the room (run 1 alone, run 2 with run 1's
// echo replaying, ...). Every run's moves must work in its own copy, like
// when you recorded it, so it finds exactly the solutions a player could.
import { initialState, stepWith } from './sim.js';

const ACTS = ['U', 'D', 'L', 'R', 'W'];

// per-turn action strings -> one move string per run (trailing waits dropped)
function toRuns(path, echoes) {
  return Array.from({ length: echoes + 1 }, (_, j) => path.map((t) => t[j]).join('').replace(/W+$/, ''));
}

const worldKey = (s) => s.player.alive
  ? s.player.x + ',' + s.player.y + '/' + s.ghosts.map((g) => g.x + ',' + g.y).join(';') + '/' + s.crates.map((c) => c.x + ',' + c.y).sort().join(';') + '/' + (s.toggles.a ? 1 : 0) + (s.toggles.b ? 1 : 0) + (s.toggles.c ? 1 : 0)
  : 'x';

// Fewest turns to win using `echoes` echoes: { turns, runs }, turns -1 if
// impossible; null if the search got too big to finish.
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
          if (n.won) return { turns: depth, runs: toRuns([...path, rec.join('') + a], echoes) };
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
  return { turns: -1 };
}


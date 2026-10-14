// Runs the exact solver off the main thread, so checking a room made in the
// editor doesn't freeze the game.
import { parseLevel } from './sim.js';
import { search } from './search.js';

self.onmessage = (e) => {
  const { map, echoes } = e.data;
  try {
    const lv = parseLevel({ name: 'custom', map });
    const res = search(lv, echoes, 2500000);
    if (res === null) self.postMessage({ ok: false, why: 'TOO BIG TO CHECK' });
    else if (res.turns < 0) self.postMessage({ ok: false, why: echoes ? `NO WAY OUT WITH ${echoes} ECHO${echoes > 1 ? 'ES' : ''}` : 'NO WAY OUT' });
    else self.postMessage({ ok: true, turns: res.turns, solution: res.runs });
  } catch (err) {
    self.postMessage({ ok: false, why: 'ROOM IS BROKEN' });
  }
};

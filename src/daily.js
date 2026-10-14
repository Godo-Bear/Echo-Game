// The daily challenge: one room a day from the generated pool, the same
// for everyone on the same date, plus your streak.
import { DAILIES } from './dailies.js';
import { save, store } from './save.js';

const DAY = 86400000;
const EPOCH = Date.UTC(2026, 9, 1); // day 0 of the pool

// today's date as YYYY-MM-DD (your own local day)
export function today(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyDef(date = today()) {
  const [y, m, d] = date.split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
  const room = DAILIES[((n * 37) % DAILIES.length + DAILIES.length) % DAILIES.length];
  return {
    name: `DAILY #${n + 1}`,
    code: '',
    echoes: room.echoes,
    hint: `A NEW ROOM EVERY DAY. PAR IS ${room.turns} TURNS: THE FEWEST POSSIBLE.`,
    map: room.map,
    solution: room.solution,
    par: room.turns,
    date,
  };
}

// Call when today's daily is cleared. Returns { streak, first } .
export function dailyCleared(turns) {
  const d = save.daily;
  const date = today();
  const first = d.last !== date;
  if (first) {
    d.streak = d.last === today(-1) ? d.streak + 1 : 1;
    d.best = Math.max(d.best, d.streak);
    d.count++;
    d.last = date;
  }
  d.turns[date] = Math.min(d.turns[date] ?? Infinity, turns);
  store();
  return { streak: d.streak, first };
}

// the streak still counts if you cleared yesterday's or today's
export function currentStreak() {
  const d = save.daily;
  return d.last === today() || d.last === today(-1) ? d.streak : 0;
}

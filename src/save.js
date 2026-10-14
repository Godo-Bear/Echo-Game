// Progress and settings, kept in this browser (localStorage).
const KEY = 'echo-save-v1';
const DEFAULTS = {
  unlocked: 0, done: [], palette: 0, shell: 0, hero: 'HOOD', sound: true, music: true,
  trophies: [],
  stats: { echoes: 0, undos: 0, zaps: 0, bestWait: 0, parRooms: [], cleanRooms: [], made: 0, shared: 0, guestClears: 0 },
  daily: { last: '', streak: 0, best: 0, count: 0, turns: {} },
  editor: null, // the room you're building: { grid, echoes }
};

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* start fresh */ }
  const copy = structuredClone(DEFAULTS);
  return { ...copy, ...s, stats: { ...copy.stats, ...(s.stats || {}) }, daily: { ...copy.daily, ...(s.daily || {}) } };
}

export const save = load();

export function store() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode etc: progress just isn't kept */ }
}

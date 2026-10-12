// Progress and settings, kept in this browser (localStorage).
const KEY = 'echo-save-v1';
const DEFAULTS = { unlocked: 0, done: [], palette: 0, shell: 0, sound: true, music: true };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export const save = load();

export function store() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode etc: progress just isn't kept */ }
}

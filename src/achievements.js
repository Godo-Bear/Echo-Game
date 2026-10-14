// Trophies: little goals that keep score of what you've done, and unlock
// new screen colours and heroes (see `reward`).
import { save, store } from './save.js';
import { LEVELS, WORLDS } from './levels.js';

const worldDone = (w) => {
  const first = WORLDS[w].first, last = (WORLDS[w + 1]?.first ?? LEVELS.length) - 1;
  for (let i = first; i <= last; i++) if (!save.done[i]) return false;
  return true;
};
const st = () => save.stats;

export const TROPHIES = [
  { id: 'first_echo', name: 'FIRST ECHO', desc: 'MAKE YOUR FIRST ECHO', ok: () => st().echoes >= 1 },
  { id: 'world1', name: 'WOKEN UP', desc: 'CLEAR WORLD 1', ok: () => worldDone(0) },
  { id: 'world2', name: 'HEAVY LIFTER', desc: 'CLEAR WORLD 2', ok: () => worldDone(1), reward: { hero: 'ROBOT' } },
  { id: 'world3', name: 'LIGHT SHOW', desc: 'CLEAR WORLD 3', ok: () => worldDone(2), reward: { palette: 'VIRTUAL' } },
  { id: 'world6', name: 'ENCORE!', desc: 'CLEAR WORLD 6', ok: () => worldDone(5), reward: { hero: 'KNIGHT' } },
  { id: 'all_rooms', name: 'FREE!', desc: 'CLEAR EVERY ROOM', ok: () => LEVELS.every((_, i) => save.done[i]), reward: { palette: 'GOLD' } },
  { id: 'zapped', name: 'CRISPY', desc: 'GET ZAPPED 10 TIMES', ok: () => st().zaps >= 10, reward: { palette: 'SPOOKY' } },
  { id: 'undo', name: 'TAKE BACKS', desc: 'UNDO 100 MOVES', ok: () => st().undos >= 100 },
  { id: 'echo100', name: 'TIME LOOPER', desc: 'MAKE 100 ECHOES', ok: () => st().echoes >= 100, reward: { hero: 'FROG' } },
  { id: 'patient', name: 'PATIENCE', desc: 'WAIT 10 TURNS IN A ROW', ok: () => st().bestWait >= 10 },
  { id: 'par', name: 'SPEEDY', desc: 'CLEAR 10 ROOMS IN PAR TURNS OR LESS', ok: () => st().parRooms.length >= 10 },
  { id: 'nohint', name: 'NO PEEKING', desc: 'CLEAR 10 ROOMS WITHOUT SHOW ME', ok: () => st().cleanRooms.length >= 10 },
  { id: 'daily1', name: 'DAILY DOSE', desc: 'CLEAR A DAILY CHALLENGE', ok: () => save.daily.count >= 1, reward: { hero: 'CAT' } },
  { id: 'streak3', name: 'ON A ROLL', desc: 'CLEAR THE DAILY 3 DAYS IN A ROW', ok: () => save.daily.best >= 3, reward: { palette: 'NEON' } },
  { id: 'streak7', name: 'EVERY DAY', desc: 'CLEAR THE DAILY 7 DAYS IN A ROW', ok: () => save.daily.best >= 7 },
  { id: 'maker', name: 'ARCHITECT', desc: 'MAKE A ROOM THAT PASSES THE CHECK', ok: () => st().made >= 1, reward: { palette: 'CANDY' } },
  { id: 'share', name: 'SHOW-OFF', desc: 'SHARE A ROOM YOU MADE', ok: () => st().shared >= 1 },
  { id: 'guest', name: 'GUEST', desc: 'CLEAR A ROOM SOMEONE SHARED', ok: () => st().guestClears >= 1 },
  { id: 'style', name: 'MAKEOVER', desc: 'CHANGE THE SCREEN AND CONSOLE COLOURS', ok: () => save.palette !== 0 && save.shell !== 0 },
];

let onUnlock = () => {};
export function onTrophy(fn) { onUnlock = fn; }

export const has = (id) => save.trophies.includes(id);

// Look for newly earned trophies (call after anything that might earn one).
export function checkTrophies() {
  let changed = false;
  for (const t of TROPHIES) {
    if (has(t.id) || !t.ok()) continue;
    save.trophies.push(t.id);
    changed = true;
    onUnlock(t);
  }
  if (changed) store();
}

// Count something that happened. Events: echo, undo, zap, wait (run length),
// clear ({ key, par, turns, peeked }), made, shared, guest.
export function track(ev, data) {
  const s = st();
  if (ev === 'echo') s.echoes++;
  else if (ev === 'undo') s.undos++;
  else if (ev === 'zap') s.zaps++;
  else if (ev === 'wait') s.bestWait = Math.max(s.bestWait, data);
  else if (ev === 'clear') {
    if (data.par && data.turns <= data.par && !s.parRooms.includes(data.key)) s.parRooms.push(data.key);
    if (!data.peeked && !s.cleanRooms.includes(data.key)) s.cleanRooms.push(data.key);
  } else if (ev === 'made') s.made++;
  else if (ev === 'shared') s.shared++;
  else if (ev === 'guest') s.guestClears++;
  store();
  checkTrophies();
}

// Rewards: is this palette / hero unlocked?
export const unlockedBy = (kind, name) => TROPHIES.find((t) => t.reward?.[kind] === name);
export const isUnlocked = (kind, name) => { const t = unlockedBy(kind, name); return !t || has(t.id); };

// Echo: boots the screen, then runs whichever scene is showing: title,
// settings, room select, password, trophies, the daily challenge, the room
// editor, room intro cards, playing a room, SHOW ME demos and the ending.
//
// Rooms are played through a "spec": the room plus what happens around it
// (its label, par, what to save when it's cleared and where to go next), so
// story rooms, the daily challenge and rooms people make share one play scene.
import './style.css';
import { Screen, W, PALETTES } from './render.js';
import { LEVELS, WORLDS } from './levels.js';
import { Game } from './game.js';
import { initInput, onButton, updateInput } from './input.js';
import { sfx, playSong, setSound, setMusic, suspendAudio } from './audio.js';
import { save, store } from './save.js';
import { textWidth, wrap } from './font.js';
import { SHELLS, applyShell } from './shells.js';
import { HEROES } from './sprites.js';
import { TROPHIES, onTrophy, checkTrophies, track, has, isUnlocked } from './achievements.js';
import { dailyDef, dailyCleared, currentStreak } from './daily.js';
import { TOOLS, blankRoom, roomProblem, encodeRoom, decodeRoom, gridToMap, roomLink, ROOM_W, ROOM_H } from './roomcode.js';

const canvas = document.getElementById('screen');
const scr = new Screen(canvas);
const HERO_NAMES = Object.keys(HEROES);
if (!HERO_NAMES.includes(save.hero) || !isUnlocked('hero', save.hero)) save.hero = 'HOOD';
if (!isUnlocked('palette', PALETTES[save.palette]?.name)) save.palette = 0;
scr.setPalette(save.palette);
scr.setHero(save.hero);
applyShell(save.shell);
setSound(save.sound);
setMusic(save.music);

const worldOf = (i) => WORLDS.reduce((w, wd, k) => (i >= wd.first ? k : w), 0);
const blink = (t, rate = 2) => Math.floor(t * rate) % 2 === 0;
const pad2 = (n) => String(n).padStart(2, '0');
const CONFIRM = new Set(['a', 'start', 'wait', 'tap']);

let scene = null;
let trans = null; // { next, t }
function go(next) { if (!trans) trans = { next, t: 0 }; }

// ---------- trophy pop-ups (drawn over every scene) ----------
const popups = [];
onTrophy((t) => { popups.push({ t, time: 0 }); sfx.achieve(); });
function drawPopup(dt) {
  const p = popups[0];
  if (!p) return;
  p.time += dt;
  const slide = Math.min(1, p.time * 6, (3 - p.time) * 6);
  const y = Math.round(-26 + 28 * Math.max(0, slide));
  scr.box(6, y, W - 12, 25);
  scr.textC('TROPHY!', y + 4, 2);
  scr.textC(p.t.name, y + 14, 3);
  if (p.time > 3) popups.shift();
}

// ---------- settings (shared by the title and pause menus) ----------
// cycle a list, skipping anything still locked
function cycle(cur, list, d, ok) {
  let n = cur;
  for (let k = 0; k < list.length; k++) { n = (n + d + list.length) % list.length; if (ok(n)) return n; }
  return cur;
}
const lockedCount = (kind, names) => names.filter((n) => !isUnlocked(kind, n)).length;
function settingItems() {
  return {
    screen: { side: true, label: () => `SCREEN: ${PALETTES[save.palette].name}`, act: (d = 1) => { save.palette = cycle(save.palette, PALETTES, d, (n) => isUnlocked('palette', PALETTES[n].name)); scr.setPalette(save.palette); store(); checkTrophies(); } },
    shell: { side: true, label: () => `CONSOLE: ${SHELLS[save.shell].name}`, act: (d = 1) => { save.shell = (save.shell + d + SHELLS.length) % SHELLS.length; applyShell(save.shell); store(); checkTrophies(); } },
    hero: { side: true, label: () => `HERO: ${save.hero}`, act: (d = 1) => { const i = cycle(HERO_NAMES.indexOf(save.hero), HERO_NAMES, d, (n) => isUnlocked('hero', HERO_NAMES[n])); save.hero = HERO_NAMES[i]; scr.setHero(save.hero); store(); } },
    sound: { side: true, label: () => `SOUND: ${save.sound ? 'ON' : 'OFF'}`, act: () => { save.sound = !save.sound; setSound(save.sound); store(); } },
    music: { side: true, label: () => `MUSIC: ${save.music ? 'ON' : 'OFF'}`, act: () => { save.music = !save.music; setMusic(save.music); store(); } },
  };
}
const lockedNote = () => {
  const n = lockedCount('palette', PALETTES.map((p) => p.name)) + lockedCount('hero', HERO_NAMES);
  return n ? `${n} MORE TO UNLOCK WITH TROPHIES` : 'EVERYTHING UNLOCKED!';
};

// A simple vertical menu. items: [{ label: string | () => string, act(dir), side }]
function menu(items, opts = {}) {
  return {
    items, i: 0, top: 0, ...opts,
    input(btn) {
      if (btn === 'up' || btn === 'down') { this.i = (this.i + (btn === 'up' ? -1 : 1) + this.items.length) % this.items.length; sfx.move(); return true; }
      const it = this.items[this.i];
      if ((btn === 'left' || btn === 'right') && it.side) { it.act(btn === 'left' ? -1 : 1); sfx.move(); return true; }
      if (CONFIRM.has(btn)) { sfx.ok(); it.act(1); return true; }
      return false;
    },
    draw(x, y, gap = 11, c = 3) {
      this.items.forEach((it, k) => {
        const label = typeof it.label === 'function' ? it.label() : it.label;
        scr.text(label, x, y + k * gap, c);
        if (k === this.i) scr.text('→', x - 10, y + k * gap, c);
      });
    },
  };
}

function header(title) {
  scr.clear(0);
  scr.rect(0, 0, W, 16, 3);
  scr.textC(title, 5, 0);
}

// ---------- title ----------
function titleScene() {
  playSong('title');
  const started = save.unlocked > 0 || save.done.some(Boolean);
  const m = menu([
    { label: started ? 'CONTINUE' : 'START', act: () => go(introScene(storySpec(firstUnfinished()))) },
    { label: 'ROOMS', act: () => go(levelsScene(firstUnfinished())) },
    { label: 'DAILY CHALLENGE', act: () => go(introScene(dailySpec())) },
    { label: 'ROOM EDITOR', act: () => go(editorScene()) },
    { label: 'TROPHIES', act: () => go(trophiesScene()) },
    { label: 'PASSWORD', act: () => go(passwordScene()) },
    { label: 'SETTINGS', act: () => go(settingsScene(titleScene)) },
  ]);
  let t = 0;
  return {
    update(dt) { t += dt; },
    input(btn) { if (btn !== 'b') m.input(btn); },
    draw() {
      scr.clear(0);
      // the logo, with its echoes trailing behind
      const s = 3, lw = scr.bigWidth('ECHO', s), lx = Math.round((W - lw) / 2);
      for (let k = 3; k >= 1; k--) {
        const off = Math.round(k * 2 * (0.6 + 0.4 * Math.sin(t * 2)));
        scr.big('ECHO', lx + off, 8 + off, s, k === 1 ? 2 : 1);
      }
      scr.big('ECHO', lx, 8, s, 3);
      scr.textC('A PUZZLE IN TIME', 38, 2);
      m.draw(44, 52, 10);
      if (currentStreak()) scr.text(`${currentStreak()}♥`, 4, 2, 2);
      // a little parade along the bottom
      scr.rect(0, 138, W, 6, 3);
      const x = ((t * 22) % (W + 80)) - 20;
      const f = Math.floor(t * 6) % 2;
      scr.spr(`ghost_R${f}`, x - 44, 122);
      scr.spr(`ghost_R${1 - f}`, x - 22, 122);
      scr.spr(`hero_R${f}`, x, 122);
    },
  };
}

function firstUnfinished() {
  for (let i = 0; i <= Math.min(save.unlocked, LEVELS.length - 1); i++) if (!save.done[i]) return i;
  return Math.min(save.unlocked, LEVELS.length - 1);
}

// ---------- settings ----------
function settingsScene(back) {
  const s = settingItems();
  const m = menu([s.screen, s.shell, s.hero, s.sound, s.music, { label: 'BACK', act: () => go(back()) }]);
  let t = 0;
  return {
    update(dt) { t += dt; },
    input(btn) { if (btn === 'b' || btn === 'start') { sfx.back(); go(back()); } else m.input(btn); },
    draw() {
      header('SETTINGS');
      m.draw(30, 24, 12);
      // a little room in the chosen colours
      const y = 98;
      for (let x = 0; x < 5; x++) scr.spr(x === 0 || x === 4 ? 'wall' : x === 3 ? 'exit0' : 'floor', 40 + x * 16, y);
      scr.spr(`hero_R${Math.floor(t * 3) % 2}`, 72, y - 1);
      scr.spr('ghost_R0', 56, y - (Math.floor(t * 2) % 2));
      scr.frame(39, y - 1, 82, 18, 3);
      scr.textC(lockedNote(), 122, 2);
      scr.textC('← → TO CHANGE', 133, 2);
    },
  };
}

// ---------- room select (scrolls; one row of four rooms per world) ----------
function levelsScene(start = 0) {
  let i = start, t = 0, top = Math.max(0, worldOf(start) - 2);
  const unlocked = (k) => k <= save.unlocked;
  const ROW = 17, ROWS = 6;
  const cell = (k) => ({ x: 30 + (k % 4) * 32, y: 19 + (Math.floor(k / 4) - top) * ROW });
  return {
    update(dt) { t += dt; },
    input(btn) {
      const d = { left: -1, right: 1, up: -4, down: 4 }[btn];
      if (d) {
        const n = i + d;
        if (n >= 0 && n < LEVELS.length) { i = n; sfx.move(); }
        const r = Math.floor(i / 4);
        if (r < top) top = r;
        if (r >= top + ROWS) top = r - ROWS + 1;
        return;
      }
      if (btn === 'b') { sfx.back(); go(titleScene()); return; }
      if (CONFIRM.has(btn)) {
        if (unlocked(i)) { sfx.ok(); go(introScene(storySpec(i))); } else sfx.deny();
      }
    },
    draw() {
      header('CHOOSE A ROOM');
      LEVELS.forEach((_, k) => {
        const r = Math.floor(k / 4);
        if (r < top || r >= top + ROWS) return;
        const { x, y } = cell(k);
        if (k % 4 === 0) scr.text(String(r + 1), 14, y + 4, 2);
        if (save.done[k]) { scr.rect(x, y, 26, 14, 3); scr.textC(pad2(k + 1), y + 4, 0, x + 13); }
        else if (unlocked(k)) { scr.frame(x, y, 26, 14, 3); scr.textC(pad2(k + 1), y + 4, 3, x + 13); }
        else { scr.frame(x, y, 26, 14, 1); scr.spr('lock', x + 11, y + 4, 1); }
        if (k === i && blink(t, 3)) scr.frame(x - 2, y - 2, 30, 18, 3);
      });
      // scroll hints
      if (top > 0) scr.spr('arrowU', W - 10, 20, 2);
      if (top + ROWS < WORLDS.length) scr.spr('arrowD', W - 10, 114, 2);
      scr.rect(0, 122, W, 22, 3);
      const w = WORLDS[worldOf(i)];
      scr.textC(`WORLD ${worldOf(i) + 1}: ${w.name}`, 125, 1);
      scr.textC(unlocked(i) ? LEVELS[i].name : 'LOCKED', 134, 0);
    },
  };
}

// ---------- password ----------
function passwordScene() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const code = [0, 0, 0, 0];
  let slot = 0, t = 0, msg = '', msgT = 0;
  return {
    update(dt) { t += dt; if (msgT > 0) msgT -= dt; },
    input(btn) {
      if (btn === 'up' || btn === 'down') { code[slot] = (code[slot] + (btn === 'up' ? 1 : 25)) % 26; sfx.move(); }
      else if (btn === 'left' || btn === 'right') { slot = (slot + (btn === 'left' ? 3 : 1)) % 4; sfx.move(); }
      else if (btn === 'b') { sfx.back(); go(titleScene()); }
      else if (CONFIRM.has(btn)) {
        const word = code.map((c) => A[c]).join('');
        const k = LEVELS.findIndex((l) => l.code === word);
        if (k >= 0) { sfx.ok(); save.unlocked = Math.max(save.unlocked, k); store(); go(introScene(storySpec(k))); }
        else { sfx.deny(); msg = 'WRONG PASSWORD'; msgT = 1.5; }
      }
    },
    draw() {
      header('PASSWORD');
      scr.textC('EVERY ROOM YOU CLEAR', 26, 2);
      scr.textC('GIVES YOU ONE', 35, 2);
      for (let k = 0; k < 4; k++) {
        const x = 40 + k * 22, y = 54;
        scr.frame(x, y, 18, 22, 3);
        scr.big(A[code[k]], x + 4, y + 4, 2, 3);
        if (k === slot && blink(t, 3)) { scr.spr('arrowU', x + 7, y - 6, 3); scr.spr('arrowD', x + 7, y + 25, 3); }
      }
      if (msgT > 0) scr.textC(msg, 94, 3);
      scr.textC('↑↓ LETTER  ←→ MOVE', 112, 2);
      scr.textC('A OK   B BACK', 124, 2);
    },
  };
}

// ---------- trophies ----------
function trophiesScene() {
  let i = 0, top = 0, t = 0;
  const ROWS = 8;
  return {
    update(dt) { t += dt; },
    input(btn) {
      if (btn === 'up' || btn === 'down') {
        i = (i + (btn === 'up' ? -1 : 1) + TROPHIES.length) % TROPHIES.length; sfx.move();
        if (i < top) top = i;
        if (i >= top + ROWS) top = i - ROWS + 1;
      } else if (btn === 'b' || CONFIRM.has(btn)) { sfx.back(); go(titleScene()); }
    },
    draw() {
      header(`TROPHIES ${save.trophies.length}/${TROPHIES.length}`);
      TROPHIES.slice(top, top + ROWS).forEach((tr, k) => {
        const y = 20 + k * 11, got = has(tr.id);
        if (top + k === i) scr.rect(4, y - 2, W - 8, 11, 1);
        scr.spr(got ? 'tick' : 'lock', 8, y, got ? 3 : 2);
        scr.text(tr.name, 20, y, got ? 3 : 2);
        if (tr.reward) scr.text('★', W - 14, y, 2);
      });
      const tr = TROPHIES[i];
      scr.rect(0, 110, W, 34, 3);
      const lines = wrap(tr.desc, W - 8);
      lines.slice(0, 2).forEach((l, k) => scr.textC(l, 113 + k * 9, 0));
      if (tr.reward) scr.textC(`UNLOCKS ${tr.reward.hero ? 'HERO' : 'COLOURS'}: ${tr.reward.hero || tr.reward.palette}`, 133, 1);
    },
  };
}

// ---------- room specs ----------
function storySpec(i) {
  const def = LEVELS[i];
  return {
    def, tag: pad2(i + 1), key: 'L' + i,
    top: `WORLD ${worldOf(i) + 1}: ${WORLDS[worldOf(i)].name}`,
    sub: `ROOM ${i + 1} OF ${LEVELS.length}`,
    par: def.solution[def.solution.length - 1].length,
    cleared() {
      save.done[i] = true;
      save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
      store();
      return [i + 1 < LEVELS.length ? `NEXT PASSWORD: ${LEVELS[i + 1].code}` : 'THAT WAS THE LAST ONE!'];
    },
    next: () => (i + 1 < LEVELS.length ? introScene(storySpec(i + 1)) : endingScene()),
    exitLabel: 'ROOMS', exit: () => levelsScene(i),
    again: () => storySpec(i),
  };
}

function dailySpec() {
  const def = dailyDef();
  const best = save.daily.turns[def.date];
  return {
    def, tag: 'DY', key: 'D' + def.date,
    top: 'DAILY CHALLENGE',
    sub: best ? `TODAY'S BEST: ${best} TURNS` : `STREAK: ${currentStreak()} DAY${currentStreak() === 1 ? '' : 'S'}`,
    par: def.par,
    cleared(game) {
      const { streak } = dailyCleared(game.state.tick);
      checkTrophies();
      return [`STREAK: ${streak} DAY${streak === 1 ? '' : 'S'}!`, 'NEW ROOM TOMORROW'];
    },
    next: () => titleScene(),
    exitLabel: 'TITLE', exit: () => titleScene(),
    again: () => dailySpec(),
  };
}

// a room someone made: from the editor (test) or from a shared link
function customSpec(room, from, guest = false) {
  const def = { name: guest ? 'SHARED ROOM' : 'YOUR ROOM', code: '', echoes: room.echoes, map: gridToMap(room.grid), solution: room.solution || [], hint: guest ? 'SOMEONE MADE THIS ROOM AND SHARED IT. GOOD LUCK!' : 'TESTING YOUR ROOM. PRESS START AND PICK EDIT TO GO BACK.' };
  return {
    def, tag: guest ? 'SH' : 'ME', key: null,
    top: guest ? 'SHARED ROOM' : 'ROOM EDITOR', sub: 'MADE WITH ECHO',
    par: 0, noShowMe: !def.solution.length,
    cleared() { if (guest) track('guest'); return [guest ? 'NICE ONE!' : 'IT WORKS! NOW CHECK & SHARE IT']; },
    next: from, exitLabel: guest ? 'TITLE' : 'EDIT', exit: from,
    again: () => customSpec(room, from, guest),
  };
}

// ---------- room intro card ----------
function introScene(spec) {
  const def = spec.def;
  let t = 0;
  playSong('game');
  return {
    update(dt) { t += dt; },
    input(btn) {
      if (CONFIRM.has(btn) && t > 0.25) { sfx.ok(); go(playScene(spec)); }
      else if (btn === 'b') { sfx.back(); go(spec.exit()); }
    },
    draw() {
      header(spec.top);
      scr.textC(spec.sub, 24, 2);
      const s = scr.bigWidth(def.name, 2) <= W - 8 ? 2 : 1;
      scr.big(def.name, Math.round((W - scr.bigWidth(def.name, s)) / 2), 36, s, 3);
      scr.para(def.hint, 36 + 7 * s + 10, 3, W - 14);
      const n = def.echoes;
      const label = n ? 'ECHOES' : 'NO ECHOES';
      const lw = textWidth(label) + (n ? 4 + n * 9 : 0);
      const lx = Math.round((W - lw) / 2);
      scr.text(label, lx, 114, 2);
      for (let k = 0; k < n; k++) scr.spr('echo', lx + textWidth(label) + 4 + k * 9, 114, 3);
      if (blink(t)) scr.textC('PRESS A', 130, 3);
    },
  };
}

// ---------- playing a room ----------
// `tries` carries over when the room is restarted, so the SHOW ME hint
// unlocks after a few restarts (or after a while in the room); `peeked`
// remembers if you watched it (for the NO PEEKING trophy).
const HINT_TRIES = 3, HINT_TIME = 150;

function playScene(spec, tries = 0, peeked = false) {
  const game = new Game(spec.def, spec.tag);
  game.hintReady = !spec.noShowMe && tries >= HINT_TRIES;
  let paused = null;   // pause menu (or its settings page)
  let hint = false;    // showing the hint box
  let cleared = 0;     // time since the room was cleared
  let clearLines = [];
  let time = 0;
  const totalTries = () => tries + game.retries;
  const showMe = () => go(demoScene(spec, totalTries()));
  const pauseMenu = () => menu([
    { label: 'RESUME', act: () => { paused = null; } },
    { label: 'HINT', act: () => { hint = true; } },
    ...(game.hintReady ? [{ label: 'SHOW ME HOW', act: showMe }] : []),
    { label: 'RESTART ROOM', act: () => { paused = null; go(playScene(spec.again(), totalTries() + 1, peeked)); } },
    { label: spec.exitLabel, act: () => go(spec.exit()) },
    { label: 'SETTINGS', act: () => { paused = settingsMenu(); } },
    { label: 'TITLE', act: () => go(titleScene()) },
  ]);
  const settingsMenu = () => {
    const s = settingItems();
    return menu([s.screen, s.shell, s.hero, s.sound, s.music, { label: 'BACK', act: () => { paused = pauseMenu(); } }], { settings: true });
  };
  return {
    update(dt) {
      if (paused) return;
      game.update(dt);
      time += dt;
      if (!spec.noShowMe && !game.hintReady && !game.done && (totalTries() >= HINT_TRIES || time >= HINT_TIME)) {
        game.hintReady = true;
        game.toast('STUCK? TAP SHOW ME');
      }
      if (game.done) {
        if (!cleared) {
          clearLines = spec.cleared(game);
          if (spec.key) track('clear', { key: spec.key, par: spec.par, turns: game.state.tick, peeked });
          checkTrophies();
        }
        cleared += dt;
      }
    },
    input(btn, at) {
      if (hint) { hint = false; sfx.back(); return; }
      if (paused) {
        if (btn === 'start' || btn === 'b') {
          sfx.back();
          paused = paused.settings ? pauseMenu() : null;
          return;
        }
        paused.input(btn);
        return;
      }
      if (game.done) {
        if (CONFIRM.has(btn) && cleared > 0.4) { sfx.ok(); go(spec.next()); }
        return;
      }
      const tappedShowMe = btn === 'tap' && at && at.y < 17;
      if (btn === 'hint' || tappedShowMe) { if (game.hintReady) { sfx.ok(); showMe(); } return; }
      if (btn === 'start') { paused = pauseMenu(); sfx.ok(); return; }
      if (btn === 'tap') return;
      game.input(btn);
    },
    draw() {
      game.draw(scr);
      if (game.done) {
        scr.box(10, 30, 140, 88);
        scr.big('CLEAR!', Math.round((W - scr.bigWidth('CLEAR!', 2)) / 2), 38, 2, 3);
        scr.textC(`TURNS ${game.state.tick}${spec.par ? `   PAR ${spec.par}` : ''}`, 58, 3);
        if (spec.par && game.state.tick <= spec.par) scr.textC('★ PAR OR BETTER! ★', 69, 3);
        else scr.textC(`ECHOES USED: ${game.runs.length}`, 69, 2);
        clearLines.forEach((l, k) => scr.textC(l, 81 + k * 9, 2));
        if (blink(cleared)) scr.textC('PRESS A', 104, 3);
      }
      if (paused) {
        scr.box(14, 14, 132, 118);
        scr.textC(paused.settings ? 'SETTINGS' : 'PAUSED', 21, 3);
        paused.draw(paused.settings ? 28 : 38, 34, paused.settings ? 13 : 12);
      }
      if (hint) {
        scr.box(8, 30, 144, 84);
        scr.textC('HINT', 36, 2);
        scr.para(spec.def.hint, 48, 3, 132);
      }
    },
  };
}

// ---------- SHOW ME: the room plays itself ----------
function demoScene(spec, tries) {
  const def = spec.def;
  const game = new Game(def, spec.tag, true);
  const BTN = { U: 'up', D: 'down', L: 'left', R: 'right', W: 'wait' };
  // every move of every run, with an ECHO between runs
  const steps = [];
  def.solution.forEach((run, r) => {
    for (const c of run) steps.push({ btn: BTN[c], run: r });
    if (r < def.solution.length - 1) steps.push({ btn: 'a', run: r, pause: true });
  });
  let k = 0, wait = 0.8, t = 0;
  const back = () => { sfx.ok(); go(playScene(spec.again(), tries, true)); };
  return {
    update(dt) {
      t += dt;
      game.update(dt);
      if (game.busy || k >= steps.length) return;
      wait -= dt;
      if (wait > 0) return;
      const st = steps[k++];
      game.input(st.btn);
      wait = st.pause ? 0.9 : (steps[k]?.btn === 'a' ? 0.7 : 0.26);
    },
    input(btn) { if (CONFIRM.has(btn) || btn === 'b' || btn === 'hint') back(); },
    draw() {
      game.draw(scr);
      const run = Math.min(def.solution.length - 1, steps[Math.max(0, k - 1)]?.run ?? 0);
      const last = run === def.solution.length - 1;
      const label = def.solution.length === 1 ? 'WATCH HOW' : last ? 'NOW THE REAL RUN' : `RUN ${run + 1}: YOUR ECHO WILL COPY IT`;
      scr.rect(0, 16, W, 11, 0);
      scr.rect(0, 27, W, 1, 3);
      scr.textC(label, 18, 3);
      if (game.done) {
        scr.box(20, 46, 120, 52);
        scr.textC('YOUR TURN!', 56, 3);
        scr.textC('TRY IT YOURSELF', 68, 2);
        if (blink(t)) scr.textC('PRESS A', 82, 3);
      } else if (blink(t, 1)) scr.text('A: SKIP', 4, 134, 0);
    },
  };
}

// ---------- the room editor ----------
const TOOL_OF = Object.fromEntries(TOOLS.map((t, i) => [t[0], i]));
const ON_FLOOR = new Set(['P', 'o']); // drawn on top of a floor tile

function drawCell(c, px, py) {
  const tool = TOOLS[TOOL_OF[c] ?? 0];
  if (ON_FLOOR.has(c)) scr.spr('floor', px, py);
  scr.spr(tool[2], px, py);
}

function editorScene() {
  if (!save.editor) save.editor = { grid: blankRoom(), echoes: 1 };
  const ed = save.editor;
  let cx = 1, cy = 1, tool = 1, t = 0, msg = '', msgT = 0;
  let picker = null;    // the tile picker, when open: { i }
  let paused = null;    // the editor menu
  let checking = null;  // a running check: { worker, t }
  const say = (m) => { msg = m; msgT = 1.8; };
  const paint = (c = TOOLS[tool][0]) => {
    if (c === 'P' || c === 'E') ed.grid.forEach((row) => row.forEach((v, x) => { if (v === c) row[x] = '.'; }));
    ed.grid[cy][cx] = c;
    store();
  };
  const play = () => {
    const p = roomProblem(ed.grid);
    if (p) { sfx.deny(); say(p); return; }
    go(introScene(customSpec({ grid: ed.grid.map((r) => r.slice()), echoes: ed.echoes, solution: [] }, editorScene)));
  };
  const check = () => {
    const p = roomProblem(ed.grid);
    if (p) { sfx.deny(); say(p); return; }
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    checking = { worker, t: 0 };
    worker.onmessage = (e) => {
      worker.terminate();
      checking = null;
      if (!e.data.ok) { sfx.deny(); say(e.data.why); return; }
      sfx.win();
      track('made');
      go(shareScene({ grid: ed.grid.map((r) => r.slice()), echoes: ed.echoes, solution: e.data.solution }, e.data.turns));
    };
    worker.postMessage({ map: gridToMap(ed.grid), echoes: ed.echoes });
  };
  const load = () => {
    const text = window.prompt('Paste a room code or link:');
    const room = decodeRoom(text);
    if (!room) { if (text) { sfx.deny(); say('THAT CODE DIDN\'T WORK'); } return; }
    ed.grid = room.grid; ed.echoes = room.echoes; store(); sfx.ok(); say('ROOM LOADED');
  };
  const editMenu = () => menu([
    { label: 'KEEP BUILDING', act: () => { paused = null; } },
    { label: 'PLAY TEST', act: play },
    { label: 'CHECK & SHARE', act: () => { paused = null; check(); } },
    { label: () => `ECHOES: ${ed.echoes}`, side: true, act: (d = 1) => { ed.echoes = (ed.echoes + d + 4) % 4; store(); } },
    { label: 'LOAD A CODE', act: () => { paused = null; load(); } },
    { label: 'NEW ROOM', act: () => { ed.grid = blankRoom(); store(); paused = null; say('FRESH ROOM'); } },
    { label: 'EXIT', act: () => go(titleScene()) },
  ]);
  playSong('title');
  return {
    update(dt) { t += dt; if (msgT > 0) msgT -= dt; if (checking) checking.t += dt; },
    input(btn, at) {
      if (checking) { if (btn === 'b') { checking.worker.terminate(); checking = null; say('CHECK STOPPED'); } return; }
      if (paused) { if (btn === 'b' || btn === 'start') { paused = null; sfx.back(); } else paused.input(btn); return; }
      if (picker) {
        const d = { left: -1, right: 1, up: -8, down: 8 }[btn];
        if (d) { picker.i = Math.max(0, Math.min(TOOLS.length - 1, picker.i + d)); sfx.move(); return; }
        if (btn === 'tap' && at) {
          const k = Math.floor((at.x - 8) / 18) + Math.floor((at.y - 22) / 18) * 8;
          if (at.x >= 8 && k >= 0 && k < TOOLS.length) { tool = k; picker = null; sfx.ok(); }
          return;
        }
        if (CONFIRM.has(btn)) { tool = picker.i; picker = null; sfx.ok(); }
        else if (btn === 'b' || btn === 'select') { picker = null; sfx.back(); }
        return;
      }
      const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[btn];
      if (d) { cx = Math.max(0, Math.min(ROOM_W - 1, cx + d[0])); cy = Math.max(0, Math.min(ROOM_H - 1, cy + d[1])); return; }
      if (btn === 'tap' && at) {
        if (at.y < 16) { picker = { i: tool }; sfx.ok(); return; }
        cx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(at.x / 16)));
        cy = Math.max(0, Math.min(ROOM_H - 1, Math.floor((at.y - 16) / 16)));
        paint(); sfx.step(); return;
      }
      if (btn === 'a' || btn === 'wait') { paint(); sfx.step(); }
      else if (btn === 'b') { paint('.'); sfx.undo(); }
      else if (btn === 'select') { picker = { i: tool }; sfx.ok(); }
      else if (btn === 'start') { paused = editMenu(); sfx.ok(); }
    },
    draw() {
      scr.clear(3);
      for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) drawCell(ed.grid[y][x], x * 16, 16 + y * 16);
      if (blink(t, 3)) { scr.frame(cx * 16, 16 + cy * 16, 16, 16, 3); scr.frame(cx * 16 + 1, 17 + cy * 16, 14, 14, 0); }
      // top bar: the tile you're placing (tap it to choose another)
      scr.rect(0, 0, W, 16, 3);
      scr.rect(1, 0, 16, 16, 0);
      drawCell(TOOLS[tool][0], 1, 0);
      scr.text(TOOLS[tool][1], 21, 5, 0);
      for (let k = 0; k < ed.echoes; k++) scr.spr('echo', W - 10 - k * 9, 5, 0);
      if (msgT > 0) { const w = Math.min(W - 8, textWidth(msg) + 14); scr.box((W - w) / 2, 122, w, 17); scr.textC(msg, 127, 3); }
      if (picker) {
        scr.box(4, 18, W - 8, 112);
        TOOLS.forEach((tl, k) => {
          const x = 8 + (k % 8) * 18, y = 22 + Math.floor(k / 8) * 18;
          drawCell(tl[0], x, y);
          if (k === picker.i) { scr.frame(x - 1, y - 1, 18, 18, 3); }
        });
        scr.rect(6, 116, W - 12, 12, 3);
        scr.textC(TOOLS[picker.i][1], 119, 0);
      }
      if (paused) {
        scr.box(16, 20, 128, 100);
        scr.textC('ROOM EDITOR', 27, 3);
        paused.draw(36, 40, 11);
      }
      if (checking) {
        scr.box(16, 46, 128, 52);
        scr.textC('CHECKING YOUR ROOM' + '...'.slice(0, Math.floor(checking.t * 3) % 4), 56, 3);
        scr.textC('IS THERE A WAY OUT?', 68, 2);
        scr.textC('B TO STOP', 82, 2);
      }
    },
  };
}

function shareScene(room, turns) {
  const code = encodeRoom(room.grid, room.echoes, room.solution);
  const link = roomLink(code);
  let t = 0, msg = '';
  const copy = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'An Echo room', text: 'Can you get out of my Echo room?', url: link });
      else await navigator.clipboard.writeText(link);
      msg = 'LINK COPIED!';
    } catch {
      window.prompt('Copy this link:', link);
      msg = 'LINK READY';
    }
    track('shared');
  };
  return {
    update(dt) { t += dt; },
    input(btn) {
      if (btn === 'a' || btn === 'tap') { sfx.ok(); copy(); }
      else if (btn === 'select') { sfx.ok(); go(introScene(customSpec(room, () => shareScene(room, turns), true))); }
      else if (btn === 'b' || btn === 'start') { sfx.back(); go(editorScene()); }
    },
    draw() {
      header('IT WORKS!');
      scr.para(`THE CHECKER FOUND A WAY OUT IN ${turns} TURNS, SO YOUR ROOM IS FAIR.`, 24, 3, 144);
      // a little picture of the room
      for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
        const c = room.grid[y][x];
        scr.rect(40 + x * 8, 52 + y * 6, 8, 6, c === '#' ? 3 : c === ' ' ? 2 : c === '.' ? 0 : 1);
      }
      scr.frame(39, 51, 82, 50, 3);
      scr.textC(msg || 'A: SHARE A LINK', 108, 3);
      scr.textC('SELECT: PLAY IT', 120, 2);
      scr.textC('B: BACK TO EDITOR', 131, 2);
    },
  };
}

// a shared link opens straight into its room
function sharedRoomFromLink() {
  const code = new URLSearchParams(location.search).get('room');
  if (!code) return null;
  const room = decodeRoom(code);
  if (!room || roomProblem(room.grid)) return null;
  return room;
}

// ---------- the end ----------
function endingScene() {
  playSong('title');
  let t = 0;
  return {
    update(dt) { t += dt; },
    input(btn) { if (CONFIRM.has(btn) && t > 1) { sfx.ok(); go(titleScene()); } },
    draw() {
      scr.clear(0);
      scr.big('FREE!', Math.round((W - scr.bigWidth('FREE!', 3)) / 2), 14, 3, 3);
      scr.para('YOU AND YOUR ECHOES FOUND THE WAY OUT OF EVERY ROOM.', 44, 3, 140);
      scr.para('THANKS FOR PLAYING!', 76, 2);
      const f = Math.floor(t * 3) % 2;
      for (let k = 0; k < 5; k++) {
        const x = 24 + k * 24, y = 98 - (f === k % 2 ? 2 : 0);
        scr.spr(k === 2 ? `hero_D${f}` : `ghost_D${(k + f) % 2}`, x, y);
      }
      scr.rect(0, 116, W, 2, 3);
      if (t > 1 && blink(t)) scr.textC('PRESS A', 128, 3);
    },
  };
}

// ---------- main loop ----------
onButton((btn, at) => { if (!trans && scene) scene.input(btn, at); });
initInput(canvas);

const shared = sharedRoomFromLink();
scene = shared ? introScene(customSpec(shared, titleScene, true)) : titleScene();
checkTrophies();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  try { tick(dt); } catch (e) { console.error(e); }
}
function tick(dt) {
  updateInput(dt);
  let fadeAmt = 0;
  if (trans) {
    trans.t += dt;
    const T = 0.18;
    if (trans.t < T) fadeAmt = Math.ceil((trans.t / T) * 3);
    else {
      if (!trans.swapped) { scene = trans.next; trans.swapped = true; }
      fadeAmt = 3 - Math.floor(((trans.t - T) / T) * 3);
      if (trans.t >= 2 * T) { trans = null; fadeAmt = 0; }
    }
  }
  scene.update(dt);
  scene.draw();
  drawPopup(dt);
  scr.fade(Math.max(0, Math.min(3, fadeAmt)));
}
requestAnimationFrame(frame);

// keep the screen as big as it can be, in whole device pixels
function resize() {
  const area = document.getElementById('screen-area').getBoundingClientRect();
  const bezel = getComputedStyle(document.getElementById('bezel'));
  const label = document.getElementById('bezel-label');
  const padX = parseFloat(bezel.paddingLeft) + parseFloat(bezel.paddingRight);
  const padY = parseFloat(bezel.paddingTop) + parseFloat(bezel.paddingBottom) + (label.offsetHeight ? label.offsetHeight + 6 : 0);
  const dpr = window.devicePixelRatio || 1;
  let s = Math.min((area.width - padX) / W, (area.height - padY) / 144);
  s = Math.max(1 / dpr, Math.floor(s * dpr) / dpr);
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${144 * s}px`;
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.getElementById('screen-area'));
resize();

document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));

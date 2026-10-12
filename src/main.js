// Echo: boots the screen, then runs whichever scene is showing
// (title, options, room select, password, room intro, play, ending).
import './style.css';
import { Screen, W, H, PALETTES } from './render.js';
import { LEVELS, WORLDS } from './levels.js';
import { Game } from './game.js';
import { initInput, onButton, updateInput } from './input.js';
import { sfx, playSong, setSound, setMusic, suspendAudio } from './audio.js';
import { save, store } from './save.js';
import { textWidth } from './font.js';

const canvas = document.getElementById('screen');
const scr = new Screen(canvas);
scr.setPalette(save.palette);
setSound(save.sound);
setMusic(save.music);

const worldOf = (i) => WORLDS.reduce((w, wd, k) => (i >= wd.first ? k : w), 0);
const blink = (t, rate = 2) => Math.floor(t * rate) % 2 === 0;
const CONFIRM = new Set(['a', 'start', 'wait', 'tap']);

let scene = null;
let trans = null; // { next, t }

function go(next) { if (!trans) trans = { next, t: 0 }; }

// ---------- options (shared by the title and pause menus) ----------
function optionItems() {
  return [
    { label: () => `SOUND: ${save.sound ? 'ON' : 'OFF'}`, act: () => { save.sound = !save.sound; setSound(save.sound); store(); } },
    { label: () => `MUSIC: ${save.music ? 'ON' : 'OFF'}`, act: () => { save.music = !save.music; setMusic(save.music); store(); } },
    { label: () => `COLORS: ${PALETTES[save.palette].name}`, act: (d = 1) => { save.palette = (save.palette + d + PALETTES.length) % PALETTES.length; scr.setPalette(save.palette); store(); } },
  ];
}

// A simple vertical menu. items: [{ label: string | () => string, act(dir) }]
function menu(items, opts = {}) {
  return {
    items, i: 0, ...opts,
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

// ---------- title ----------
function titleScene() {
  playSong('title');
  const started = save.unlocked > 0 || save.done.some(Boolean);
  const m = menu([
    { label: started ? 'CONTINUE' : 'START', act: () => { const i = firstUnfinished(); go(introScene(i)); } },
    { label: 'ROOMS', act: () => go(levelsScene(firstUnfinished())) },
    { label: 'PASSWORD', act: () => go(passwordScene()) },
    { label: 'OPTIONS', act: () => go(optionsScene(titleScene)) },
  ]);
  let t = 0;
  return {
    update(dt) { t += dt; },
    input(btn) { if (btn !== 'b') m.input(btn); },
    draw() {
      scr.clear(0);
      // the logo, with its echoes trailing behind
      const s = 4, lw = scr.bigWidth('ECHO', s), lx = Math.round((W - lw) / 2);
      for (let k = 3; k >= 1; k--) {
        const off = Math.round(k * 3 * (0.6 + 0.4 * Math.sin(t * 2)));
        scr.big('ECHO', lx + off, 14 + off, s, k === 1 ? 2 : 1);
      }
      scr.big('ECHO', lx, 14, s, 3);
      scr.textC('A PUZZLE IN TIME', 52, 2);
      m.draw(58, 68);
      // a little parade along the bottom
      scr.rect(0, 136, W, 8, 3);
      const x = ((t * 22) % (W + 80)) - 20;
      const f = Math.floor(t * 6) % 2;
      scr.spr(`ghost_R${f}`, x - 44, 120);
      scr.spr(`ghost_R${1 - f}`, x - 22, 120);
      scr.spr(`hero_R${f}`, x, 120);
    },
  };
}

function firstUnfinished() {
  for (let i = 0; i <= Math.min(save.unlocked, LEVELS.length - 1); i++) if (!save.done[i]) return i;
  return Math.min(save.unlocked, LEVELS.length - 1);
}

// ---------- options ----------
function optionsScene(back) {
  const items = optionItems().map((it) => ({ ...it, side: true }));
  items.push({ label: 'BACK', act: () => go(back()) });
  const m = menu(items);
  return {
    update() {},
    input(btn) { if (btn === 'b' || btn === 'start') { sfx.back(); go(back()); } else m.input(btn); },
    draw() {
      scr.clear(0);
      scr.rect(0, 0, W, 16, 3);
      scr.textC('OPTIONS', 5, 0);
      m.draw(36, 34, 14);
      scr.textC('← → TO CHANGE', 112, 2);
      // palette preview
      PALETTES[save.palette].c.forEach((_, k) => scr.rect(56 + k * 12, 124, 12, 8, k));
      scr.frame(55, 123, 50, 10, 3);
    },
  };
}

// ---------- room select ----------
function levelsScene(start = 0) {
  let i = start, t = 0;
  const unlocked = (k) => k <= save.unlocked;
  const cell = (k) => ({ x: 30 + (k % 4) * 32, y: 22 + Math.floor(k / 4) * 25 });
  return {
    update(dt) { t += dt; },
    input(btn) {
      const d = { left: -1, right: 1, up: -4, down: 4 }[btn];
      if (d) { const n = i + d; if (n >= 0 && n < LEVELS.length) { i = n; sfx.move(); } return; }
      if (btn === 'b') { sfx.back(); go(titleScene()); return; }
      if (CONFIRM.has(btn)) {
        if (unlocked(i)) { sfx.ok(); go(introScene(i)); } else sfx.deny();
      }
    },
    draw() {
      scr.clear(0);
      scr.rect(0, 0, W, 16, 3);
      scr.textC('CHOOSE A ROOM', 5, 0);
      WORLDS.forEach((w, r) => scr.text(String(r + 1), 12, 22 + r * 25 + 6, 2));
      LEVELS.forEach((_, k) => {
        const { x, y } = cell(k);
        if (save.done[k]) { scr.rect(x, y, 26, 19, 3); scr.textC(String(k + 1).padStart(2, '0'), y + 6, 0, x + 13); }
        else if (unlocked(k)) { scr.frame(x, y, 26, 19, 3); scr.textC(String(k + 1).padStart(2, '0'), y + 6, 3, x + 13); }
        else { scr.frame(x, y, 26, 19, 1); scr.spr('lock', x + 10, y + 6, 1); }
        if (k === i && blink(t, 3)) { scr.frame(x - 2, y - 2, 30, 23, 3); }
      });
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
        if (k >= 0) { sfx.ok(); save.unlocked = Math.max(save.unlocked, k); store(); go(introScene(k)); }
        else { sfx.deny(); msg = 'WRONG PASSWORD'; msgT = 1.5; }
      }
    },
    draw() {
      scr.clear(0);
      scr.rect(0, 0, W, 16, 3);
      scr.textC('PASSWORD', 5, 0);
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

// ---------- room intro card ----------
function introScene(i) {
  const def = LEVELS[i];
  let t = 0;
  playSong('game');
  return {
    update(dt) { t += dt; },
    input(btn) {
      if (CONFIRM.has(btn) && t > 0.25) { sfx.ok(); go(playScene(i)); }
      else if (btn === 'b') { sfx.back(); go(levelsScene(i)); }
    },
    draw() {
      scr.clear(0);
      scr.rect(0, 0, W, 16, 3);
      scr.textC(`WORLD ${worldOf(i) + 1}: ${WORLDS[worldOf(i)].name}`, 5, 0);
      scr.textC(`ROOM ${i + 1} OF ${LEVELS.length}`, 24, 2);
      const s = scr.bigWidth(def.name, 2) <= W - 8 ? 2 : 1;
      scr.big(def.name, Math.round((W - scr.bigWidth(def.name, s)) / 2), 36, s, 3);
      const y = 36 + 7 * s + 10;
      scr.para(def.hint, y, 3, W - 14);
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
function playScene(i) {
  const game = new Game(LEVELS[i], i);
  let paused = null;   // pause menu
  let hint = false;    // showing the hint box
  let cleared = 0;     // time since the room was cleared
  const pauseMenu = () => {
    const items = [
      { label: 'RESUME', act: () => { paused = null; } },
      { label: 'HINT', act: () => { hint = true; } },
      { label: 'RESTART ROOM', act: () => { paused = null; go(playScene(i)); } },
      { label: 'ROOMS', act: () => go(levelsScene(i)) },
      ...optionItems().map((it) => ({ ...it, side: true })),
      { label: 'TITLE', act: () => go(titleScene()) },
    ];
    return menu(items);
  };
  return {
    update(dt) {
      if (paused) return;
      game.update(dt);
      if (game.done) {
        if (!cleared) {
          save.done[i] = true;
          save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
          store();
        }
        cleared += dt;
      }
    },
    input(btn) {
      if (hint) { hint = false; sfx.back(); return; }
      if (paused) {
        if (btn === 'start' || btn === 'b') { paused = null; sfx.back(); return; }
        paused.input(btn);
        return;
      }
      if (game.done) {
        if (CONFIRM.has(btn) && cleared > 0.4) {
          sfx.ok();
          go(i + 1 < LEVELS.length ? introScene(i + 1) : endingScene());
        }
        return;
      }
      if (btn === 'start') { paused = pauseMenu(); sfx.ok(); return; }
      if (btn === 'tap') return;
      game.input(btn);
    },
    draw() {
      game.draw(scr);
      if (game.done) {
        scr.box(14, 34, 132, 80);
        scr.big('CLEAR!', Math.round((W - scr.bigWidth('CLEAR!', 2)) / 2), 44, 2, 3);
        scr.textC(`TURNS ${game.state.tick}   ECHOES ${game.runs.length}`, 66, 3);
        if (i + 1 < LEVELS.length) scr.textC(`NEXT PASSWORD: ${LEVELS[i + 1].code}`, 80, 2);
        else scr.textC('THAT WAS THE LAST ONE!', 80, 2);
        if (blink(cleared)) scr.textC('PRESS A', 98, 3);
      }
      if (paused) {
        scr.box(20, 18, 120, 108);
        scr.textC('PAUSED', 25, 3);
        paused.draw(38, 38, 10);
      }
      if (hint) {
        scr.box(8, 30, 144, 84);
        scr.textC('HINT', 36, 2);
        scr.para(LEVELS[i].hint, 48, 3, 132);
      }
    },
  };
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
      // everyone takes a bow
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
onButton((btn) => { if (!trans && scene) scene.input(btn); });
initInput(canvas);

scene = titleScene();
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
  let s = Math.min((area.width - padX) / W, (area.height - padY) / H);
  s = Math.max(1 / dpr, Math.floor(s * dpr) / dpr);
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.getElementById('screen-area'));
resize();

document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));

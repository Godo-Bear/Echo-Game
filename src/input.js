// Input: keyboard, the on-screen console buttons and swipes on the screen
// all turn into the same button names:
//   up down left right wait (middle of the d-pad)  a  b  select  start
// Holding a direction, wait or B repeats it.
import { unlockAudio } from './audio.js';

const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'wait', Period: 'wait', Numpad5: 'wait',
  KeyE: 'a', KeyX: 'a', Enter: 'a', NumpadEnter: 'a',
  KeyZ: 'b', KeyU: 'b', Backspace: 'b',
  KeyR: 'select', ShiftLeft: 'select', ShiftRight: 'select',
  KeyH: 'hint', Slash: 'hint',
  Escape: 'start', KeyP: 'start', Tab: 'start',
};
const REPEATS = new Set(['up', 'down', 'left', 'right', 'wait', 'b']);
const DELAY = 0.26, RATE = 0.12;

let handler = () => {};
const held = new Map(); // button -> { source, t, next }

export function onButton(fn) { handler = fn; }

function press(btn, source) {
  unlockAudio();
  held.set(btn + source, { btn, t: 0, next: DELAY });
  if (navigator.vibrate && source !== 'key') navigator.vibrate(8);
  document.querySelectorAll(`[data-btn="${btn}"]`).forEach((el) => el.classList.add('held'));
  handler(btn);
}
function release(btn, source) {
  held.delete(btn + source);
  if (![...held.values()].some((h) => h.btn === btn)) {
    document.querySelectorAll(`[data-btn="${btn}"]`).forEach((el) => el.classList.remove('held'));
  }
}
export function releaseAll() { for (const h of [...held.values()]) release(h.btn, ''); held.clear(); document.querySelectorAll('.held').forEach((el) => el.classList.remove('held')); }

// call every frame
export function updateInput(dt) {
  for (const h of held.values()) {
    if (!REPEATS.has(h.btn)) continue;
    h.t += dt;
    if (h.t >= h.next) { h.next += RATE; handler(h.btn); }
  }
}

export function initInput(screenEl) {
  addEventListener('keydown', (e) => {
    const btn = KEYS[e.code];
    if (!btn) return;
    e.preventDefault();
    if (e.repeat) return; // we do our own repeat
    press(btn, 'key');
  });
  addEventListener('keyup', (e) => { const btn = KEYS[e.code]; if (btn) release(btn, 'key'); });
  addEventListener('blur', releaseAll);

  // round buttons and pills
  document.querySelectorAll('button[data-btn]').forEach((el) => {
    const btn = el.dataset.btn;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); press(btn, 'p' + e.pointerId); });
    const up = (e) => release(btn, 'p' + e.pointerId);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // the d-pad: one element, the direction comes from where the finger is
  const pad = document.getElementById('dpad');
  const padState = new Map(); // pointer -> current button
  const dirAt = (e) => {
    const r = pad.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    if (Math.abs(x) < 0.17 && Math.abs(y) < 0.17) return 'wait';
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
    return y > 0 ? 'down' : 'up';
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pad.setPointerCapture?.(e.pointerId);
    const b = dirAt(e);
    padState.set(e.pointerId, b);
    press(b, 'pad' + e.pointerId);
  });
  pad.addEventListener('pointermove', (e) => {
    if (!padState.has(e.pointerId)) return;
    const old = padState.get(e.pointerId);
    let b = dirAt(e);
    if (b === 'wait' && old !== 'wait') return; // sliding through the middle isn't a wait
    if (b !== old) {
      release(old, 'pad' + e.pointerId);
      padState.set(e.pointerId, b);
      press(b, 'pad' + e.pointerId);
    }
  });
  const padUp = (e) => {
    if (!padState.has(e.pointerId)) return;
    release(padState.get(e.pointerId), 'pad' + e.pointerId);
    padState.delete(e.pointerId);
  };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('lostpointercapture', padUp);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  // swipes (and taps) on the screen itself
  let sw = null;
  screenEl.addEventListener('pointerdown', (e) => { e.preventDefault(); unlockAudio(); sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  screenEl.addEventListener('pointerup', (e) => {
    if (!sw || sw.id !== e.pointerId) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    sw = null;
    const d = Math.hypot(dx, dy);
    if (d < 18) {
      // where on the 160x144 screen the tap was
      const r = screenEl.getBoundingClientRect();
      handler('tap', { x: ((e.clientX - r.left) / r.width) * screenEl.width, y: ((e.clientY - r.top) / r.height) * screenEl.height });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) handler(dx > 0 ? 'right' : 'left');
    else handler(dy > 0 ? 'down' : 'up');
  });
  screenEl.addEventListener('pointercancel', () => { sw = null; });
}

// One room being played: the moves so far, the echoes, undo, and drawing.
import { parseLevel, initialState, simulate, step, nextGhostActs, tileAt } from './sim.js';
import { sfx } from './audio.js';
import { W } from './render.js';

const TWEEN = 0.11;
const ARROW = { U: 'arrowU', D: 'arrowD', L: 'arrowL', R: 'arrowR' };

export class Game {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.lv = parseLevel(def);
    this.runs = [];   // finished runs, each replayed by an echo
    this.moves = [];  // this run so far
    this.ox = (10 - this.lv.w) * 8;
    this.oy = 16 + (8 - this.lv.h) * 8;
    this.toastText = ''; this.toastT = 0;
    this.time = 0;
    this.rewind = 0;       // >0 while the echo wobble plays
    this.exitT = -1;       // >=0 while walking down the stairs
    this.done = false;     // set when the room is finished
    this.shake = 0;
    this.retries = 0;      // restarts and zaps (unlocks the SHOW ME hint)
    this.hintReady = false;
    this.rebuild();
  }

  rebuild(animFrom = null) {
    const states = simulate(this.lv, this.runs, this.moves);
    this.state = states[states.length - 1];
    this.prev = animFrom || this.state;
    this.anim = animFrom ? 0 : TWEEN;
    this.facings = this.computeFacings();
  }

  // which way everyone is looking: the last direction they moved
  computeFacings() {
    const last = (moves, upto) => { for (let i = Math.min(upto, moves.length) - 1; i >= 0; i--) if (moves[i] !== 'W') return moves[i]; return 'D'; };
    return { player: last(this.moves, this.moves.length), ghosts: this.runs.map((r) => last(r, this.state.tick)) };
  }

  toast(t) { this.toastText = t; this.toastT = 1.6; }
  get busy() { return this.rewind > 0 || this.exitT >= 0; }
  get over() { return !this.state.player.alive; }

  finishAnim() { this.anim = TWEEN; }

  input(btn) {
    if (this.busy || this.done) return;
    this.finishAnim();
    const dirs = { up: 'U', down: 'D', left: 'L', right: 'R', wait: 'W' };
    if (dirs[btn]) return this.move(dirs[btn]);
    if (btn === 'a') return this.echo();
    if (btn === 'b') return this.undo();
    if (btn === 'select') return this.reset();
  }

  move(a) {
    if (this.over) { sfx.deny(); this.toast(this.def.echoes > this.runs.length ? 'B UNDO  A ECHO' : 'PRESS B TO UNDO'); return; }
    const before = this.state;
    const next = step(this.lv, before, this.runs, a);
    if (!next) { sfx.bump(); this.shake = 0.12; if (a !== 'W') this.facings.player = a; return; }
    this.moves.push(a);
    this.prev = before;
    this.state = next;
    this.anim = 0;
    this.facings = this.computeFacings();
    this.sounds(before, next, a);
    if (next.won) { this.exitT = 0; }
  }

  sounds(a, b, act) {
    if (b.zapped) { sfx.zap(); this.shake = 0.3; this.retries++; return; }
    const crateMoved = a.crates.some((c, i) => c.x !== b.crates[i].x || c.y !== b.crates[i].y);
    const opened = b.doorOpen.some((o, i) => o && !a.doorOpen[i]);
    const shut = b.doorOpen.some((o, i) => !o && a.doorOpen[i]);
    const plates = 'abc'.split('').some((ch) => a.pressed[ch] !== b.pressed[ch]);
    if (crateMoved) sfx.push();
    else if (act !== 'W') sfx.step();
    if (opened) sfx.doorOpen(); else if (shut) sfx.doorShut(); else if (plates) sfx.plate();
  }

  echo() {
    if (this.def.echoes === 0) { sfx.deny(); this.toast('NO ECHOES HERE'); return; }
    if (this.runs.length >= this.def.echoes) { sfx.deny(); this.toast('NO ECHOES LEFT'); return; }
    if (this.moves.length === 0) { sfx.deny(); this.toast('MOVE FIRST!'); return; }
    this.runs.push(this.moves);
    this.moves = [];
    this.rebuild();
    this.rewind = 0.5;
    sfx.echo();
    const left = this.def.echoes - this.runs.length;
    this.toast(`ECHO ${this.runs.length}!`);
    this.toastAfter = left === 0 ? 'NO ECHOES LEFT' : '';
  }

  undo() {
    if (this.moves.length) {
      const before = this.state;
      this.moves.pop();
      this.rebuild(before);
      sfx.undo();
    } else if (this.runs.length) {
      this.moves = this.runs.pop();
      this.rebuild();
      this.rewind = 0.35;
      sfx.undo();
      this.toast('ECHO TAKEN BACK');
    } else sfx.deny();
  }

  reset() {
    if (this.moves.length) { this.moves = []; this.rebuild(); sfx.back(); this.toast('RUN RESTARTED'); this.retries++; }
    else if (this.runs.length) { this.runs = []; this.rebuild(); sfx.back(); this.toast('ECHOES CLEARED'); this.retries++; }
    else sfx.deny();
  }

  update(dt) {
    this.time += dt;
    if (this.anim < TWEEN) this.anim = Math.min(TWEEN, this.anim + dt);
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0 && this.toastAfter) { this.toast(this.toastAfter); this.toastAfter = ''; } }
    if (this.rewind > 0) this.rewind = Math.max(0, this.rewind - dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.exitT >= 0 && this.anim >= TWEEN) {
      if (this.exitT === 0) sfx.win();
      this.exitT += dt;
      if (this.exitT > 0.9) { this.done = true; this.exitT = -1; }
    }
  }

  // ---------- drawing ----------
  pos(prev, cur) {
    const k = this.anim / TWEEN;
    const e = k * (2 - k);
    return { x: prev.x + (cur.x - prev.x) * e, y: prev.y + (cur.y - prev.y) * e };
  }
  sx(x) { return this.ox + x * 16; }
  sy(y) { return this.oy + y * 16; }

  draw(scr) {
    const { lv, state: s } = this;
    const shx = this.shake > 0 ? Math.round(Math.sin(this.time * 90) * 2) : 0;
    const ox = this.ox; this.ox += shx;
    scr.clear(3);
    // the dark outside, then the room on top
    for (let y = 1; y < 9; y++) for (let x = 0; x < 10; x++) scr.spr('void', x * 16, y * 16);
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      this.drawTile(scr, tileAt(lv, x, y), x, y, this.sx(x), this.sy(y));
    }
    // laser beams
    const flick = Math.floor(this.time * 12) % 2;
    for (const b of s.beams) {
      const px = this.sx(b.x), py = this.sy(b.y);
      if (b.axis === 'h') { scr.rect(px, py + 6, 16, 4, 3); scr.rect(px, py + 7 + flick, 16, 1, 0); }
      else { scr.rect(px + 6, py, 4, 16, 3); scr.rect(px + 7 + flick, py, 1, 16, 0); }
    }
    for (const h of s.hits) {
      const px = this.sx(h.x), py = this.sy(h.y);
      const reach = h.what === 'crate' ? 2 : 6;
      if (h.dir === 'R') scr.rect(px, py + 6, reach, 4, 3);
      if (h.dir === 'L') scr.rect(px + 16 - reach, py + 6, reach, 4, 3);
      if (h.dir === 'D') scr.rect(px + 6, py, 4, reach, 3);
      if (h.dir === 'U') scr.rect(px + 6, py + 16 - reach, 4, reach, 3);
    }
    // crates
    s.crates.forEach((c, i) => {
      const p = this.pos(this.prev.crates[i] || c, c);
      scr.spr('crate', this.sx(p.x), this.sy(p.y));
    });
    // echoes
    const nexts = nextGhostActs(this.runs, s.tick);
    s.ghosts.forEach((g, i) => {
      const pg = this.prev.ghosts.length === s.ghosts.length ? this.prev.ghosts[i] : g;
      const p = this.pos(pg, g);
      const moving = this.anim < TWEEN && (pg.x !== g.x || pg.y !== g.y);
      const bob = Math.floor(this.time * 2 + i) % 2;
      const px = this.sx(p.x), py = this.sy(p.y) - (moving ? 1 : bob);
      scr.spr(`ghost_${this.facings.ghosts[i] || 'D'}${moving ? (g.x + g.y) % 2 : 0}`, px, py);
      const n = nexts[i];
      if (n && n !== 'W' && Math.floor(this.time * 3) % 3 !== 0) {
        const at = { U: [6, -4], D: [6, 17], L: [-4, 6], R: [17, 6] }[n];
        scr.spr(ARROW[n], px + at[0], py + at[1], 3);
      }
    });
    // you
    const pl = this.pos(this.prev.player, s.player);
    const moving = this.anim < TWEEN && (this.prev.player.x !== s.player.x || this.prev.player.y !== s.player.y);
    let py = this.sy(pl.y) - (moving ? 1 : 0);
    const face = this.facings.player;
    const frame = moving ? (s.player.x + s.player.y) % 2 : 0;
    if (this.exitT >= 0 && this.anim >= TWEEN) {
      // walk down the stairs: draw only the part above the step edge
      const sink = Math.min(16, Math.floor(this.exitT * 26));
      const c = scr.img(`hero_D${Math.floor(this.exitT * 8) % 2}`);
      if (16 - sink > 0) scr.ctx.drawImage(c, 0, 0, 16, 16 - sink, Math.round(this.sx(pl.x)), Math.round(py + sink), 16, 16 - sink);
    } else if (!s.player.alive) {
      const fl = Math.floor(this.time * 8) % 2;
      scr.spr(`${fl ? 'zap' : 'hero'}_${face}0`, this.sx(pl.x), py);
      scr.spr(fl ? 'spark' : 'spark2', this.sx(pl.x) + 5, py - 3, fl ? 3 : 0);
    } else {
      scr.spr(`hero_${face}${frame}`, this.sx(pl.x), py);
    }
    this.ox = ox;
    this.drawHud(scr);
    if (this.done || this.exitT >= 0) { /* no messages over the clear screen */ }
    else if (this.toastT > 0) this.drawToast(scr, this.toastText);
    else if (this.over && this.anim >= TWEEN) this.drawToast(scr, this.def.echoes > this.runs.length ? 'ZAPPED! B UNDO  A ECHO' : 'ZAPPED! PRESS B TO UNDO');
    if (this.rewind > 0) scr.wobble(this.rewind);
  }

  drawTile(scr, t, x, y, px, py) {
    const s = this.state;
    if (t.k === 'void') return;
    if (t.k === 'wall') { scr.spr('wall', px, py); return; }
    if (t.k === 'emitter') { scr.spr(`emitter_${t.dir}`, px, py); return; }
    if (t.k === 'exit') { scr.spr(Math.floor(this.time * 2) % 2 ? 'exit1' : 'exit0', px, py); return; }
    if (t.k === 'plate') {
      const down = s.player.x === x && s.player.y === y || s.ghosts.some((g) => g.x === x && g.y === y) || s.crates.some((c) => c.x === x && c.y === y);
      scr.spr(`plate_${t.ch}${down ? '_down' : ''}`, px, py);
    } else if (t.k === 'door') {
      const k = `door_${t.ch}${t.inv ? '_inv' : ''}`;
      if (!s.doorOpen[t.i]) scr.spr(k, px, py);
      else {
        // posts follow the walls either side of the doorway
        const sideways = !(blocks(tileAt(this.lv, x - 1, y)) && blocks(tileAt(this.lv, x + 1, y)));
        scr.spr(`${k}_open${sideways ? '_side' : ''}`, px, py);
      }
    } else scr.spr('floor', px, py);
    // shadow under a wall
    if (blocks(tileAt(this.lv, x, y - 1)) && !(t.k === 'door' && !s.doorOpen[t.i])) scr.rect(px, py, 16, 2, 1);
  }

  drawHud(scr) {
    scr.rect(0, 0, W, 16, 3);
    scr.text(String(this.index + 1).padStart(2, '0'), 4, 5, 0);
    scr.text(this.def.name, 20, 5, 1);
    // echoes left
    const n = this.def.echoes;
    for (let i = 0; i < n; i++) scr.spr(i < n - this.runs.length ? 'echo' : 'echoUsed', W - 34 - i * 9, 5, i < n - this.runs.length ? 0 : 2);
    scr.text(String(Math.min(99, this.state.tick)).padStart(2, '0'), W - 15, 5, 0);
    // stuck? a blinking "?" says the SHOW ME hint is ready
    if (this.hintReady && Math.floor(this.time * 2) % 2) {
      const x = W - 46 - Math.max(0, n - 1) * 9;
      scr.rect(x - 2, 3, 9, 11, 0);
      scr.text('?', x, 5, 3);
    }
    if (!n) scr.rect(W - 34, 8, 6, 1, 2);
  }

  drawToast(scr, t) {
    const w = Math.min(W - 8, t.length * 6 + 14);
    const x = Math.round((W - w) / 2), y = 144 - 22;
    scr.box(x, y, w, 17);
    scr.textC(t, y + 5, 3);
  }
}

const blocks = (t) => t.k === 'wall' || t.k === 'void' || t.k === 'emitter';

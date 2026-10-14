// Chiptune sound: Game Boy style pulse waves, a triangle bass and noise,
// all made live with the Web Audio API (no sound files).
let ctx = null, master, sfxBus, musicBus;
let sfxOn = true, musicOn = true;
const waves = {};
let noiseBuf = null;

export function setSound(on) { sfxOn = on; }
export function setMusic(on) {
  musicOn = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.05);
}

// Browsers only allow sound after a tap or key press: call this on input.
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.32; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.16 : 0;
    // the music gets a soft echo, of course
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    musicBus.connect(master); musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    for (const duty of [0.125, 0.25, 0.5]) waves[duty] = pulseWave(duty);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingSong) { const s = pendingSong; pendingSong = null; playSong(s); }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function suspendAudio(yes) {
  if (!ctx) return;
  if (yes) ctx.suspend(); else ctx.resume();
}

function pulseWave(duty) {
  const n = 48, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
    im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
  }
  return ctx.createPeriodicWave(re, im);
}

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(n) {
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// one note: { f: Hz or [from, to], d: seconds, wave: 'p25' | 'tri' | ... }
function tone({ f, d = 0.08, wave = 0.25, vol = 0.5, t = 0, bus = sfxBus, attack = 0.004 }) {
  if (!ctx) return;
  const at = ctx.currentTime + t;
  const o = ctx.createOscillator();
  if (wave === 'tri') o.type = 'triangle';
  else if (wave === 'sine') o.type = 'sine';
  else o.setPeriodicWave(waves[wave]);
  const [f0, f1] = Array.isArray(f) ? f : [f, f];
  o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.setValueAtTime(vol, at + d * 0.7);
  g.gain.linearRampToValueAtTime(0, at + d);
  o.connect(g); g.connect(bus);
  o.start(at); o.stop(at + d + 0.02);
}

function noise({ d = 0.05, vol = 0.4, t = 0, bus = sfxBus, hi = 8000, lo = 0 }) {
  if (!ctx) return;
  const at = ctx.currentTime + t;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = hi;
  const fh = ctx.createBiquadFilter(); fh.type = 'highpass'; fh.frequency.value = lo;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + d);
  s.connect(fl); fl.connect(fh); fh.connect(g); g.connect(bus);
  s.start(at, Math.random() * 0.5); s.stop(at + d + 0.02);
}

const play = (fn) => () => { if (sfxOn && ctx) fn(); };
export const sfx = {
  step: play(() => tone({ f: 190, d: 0.03, wave: 0.125, vol: 0.25 })),
  bump: play(() => tone({ f: [120, 70], d: 0.07, wave: 0.5, vol: 0.4 })),
  push: play(() => { noise({ d: 0.09, vol: 0.35, hi: 1200 }); tone({ f: [140, 100], d: 0.08, wave: 0.5, vol: 0.3 }); }),
  plate: play(() => { tone({ f: 990, d: 0.025, wave: 0.25, vol: 0.3 }); tone({ f: 660, d: 0.03, wave: 0.25, vol: 0.3, t: 0.03 }); }),
  doorOpen: play(() => [330, 440, 550].forEach((f, i) => tone({ f, d: 0.04, wave: 0.5, vol: 0.25, t: i * 0.035 }))),
  doorShut: play(() => [550, 415, 330].forEach((f, i) => tone({ f, d: 0.04, wave: 0.5, vol: 0.25, t: i * 0.035 }))),
  echo: play(() => {
    ['C6', 'G5', 'E5', 'C5', 'G4', 'C4'].forEach((n, i) => tone({ f: freq(n), d: 0.07, wave: 0.25, vol: 0.35 - i * 0.04, t: i * 0.05 }));
    ['C6', 'G5', 'E5'].forEach((n, i) => tone({ f: freq(n), d: 0.07, wave: 0.125, vol: 0.12, t: 0.32 + i * 0.05 }));
  }),
  warp: play(() => { tone({ f: [300, 1600], d: 0.16, wave: 0.125, vol: 0.3 }); tone({ f: [1600, 400], d: 0.12, wave: 0.25, vol: 0.2, t: 0.12 }); }),
  lever: play(() => { tone({ f: 220, d: 0.03, wave: 0.5, vol: 0.35 }); tone({ f: 880, d: 0.05, wave: 0.25, vol: 0.3, t: 0.04 }); }),
  achieve: play(() => ['G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone({ f: freq(n), d: 0.08, wave: 0.25, vol: 0.3, t: i * 0.07 }))),
  undo: play(() => tone({ f: [520, 330], d: 0.06, wave: 0.25, vol: 0.3 })),
  zap: play(() => { tone({ f: [1400, 90], d: 0.35, wave: 0.5, vol: 0.35 }); noise({ d: 0.3, vol: 0.4 }); }),
  win: play(() => {
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone({ f: freq(n), d: 0.09, wave: 0.25, vol: 0.35, t: i * 0.09 }));
    tone({ f: freq('E6'), d: 0.4, wave: 0.125, vol: 0.3, t: 0.36 });
    tone({ f: freq('C4'), d: 0.5, wave: 'tri', vol: 0.5, t: 0.36 });
  }),
  move: play(() => tone({ f: 660, d: 0.025, wave: 0.5, vol: 0.2 })),
  ok: play(() => { tone({ f: 880, d: 0.04, wave: 0.25, vol: 0.3 }); tone({ f: 1320, d: 0.06, wave: 0.25, vol: 0.3, t: 0.04 }); }),
  back: play(() => { tone({ f: 660, d: 0.04, wave: 0.25, vol: 0.3 }); tone({ f: 440, d: 0.06, wave: 0.25, vol: 0.3, t: 0.04 }); }),
  deny: play(() => { tone({ f: 150, d: 0.06, wave: 0.5, vol: 0.4 }); tone({ f: 150, d: 0.06, wave: 0.5, vol: 0.4, t: 0.09 }); }),
};

// ----- music: one token per eighth note; "-" holds the note, "." rests -----
const bars = (s) => s.trim().split(/\s+/);
const SONGS = {
  title: {
    bpm: 92,
    tracks: [
      { wave: 0.125, vol: 0.35, notes: bars(`
        A4 E5 C5 E5 A4 E5 C5 E5  F4 C5 A4 C5 F4 C5 A4 C5  E4 C5 G4 C5 E4 C5 G4 C5  D4 B4 G4 B4 D4 B4 G4 B4
        A4 E5 C5 E5 A4 E5 C5 E5  F4 C5 A4 C5 F4 C5 A4 C5  E4 C5 G4 C5 E4 C5 G4 C5  D4 B4 G4 B4 D4 B4 G4 B4`) },
      { wave: 0.25, vol: 0.4, notes: bars(`
        .  .  .  .  .  .  .  .   .  .  .  .  .  .  .  .   .  .  .  .  .  .  .  .   .  .  .  .  .  .  .  .
        E5 -  -  -  D5 -  C5 -   C5 -  -  -  A4 -  -  -   G4 -  C5 -  E5 -  G5 -   D5 -  -  -  -  -  -  .`) },
      { wave: 'tri', vol: 0.6, notes: bars(`
        A2 -  -  -  -  -  -  -   F2 -  -  -  -  -  -  -   C3 -  -  -  -  -  -  -   G2 -  -  -  -  -  -  -
        A2 -  -  -  -  -  -  -   F2 -  -  -  -  -  -  -   C3 -  -  -  -  -  -  -   G2 -  -  -  -  -  -  -`) },
    ],
  },
  game: {
    bpm: 108,
    tracks: [
      { wave: 0.25, vol: 0.32, notes: bars(`
        E5 -  .  E5 D5 -  C5 -   A4 -  -  -  .  .  C5 D5  E5 -  .  E5 G5 -  E5 -   D5 -  -  -  .  .  .  .
        E5 -  .  E5 D5 -  C5 -   A4 -  -  -  .  C5 D5 E5  G5 -  E5 -  C5 -  E5 -   D5 -  B4 -  G4 -  .  .
        .  .  .  .  .  .  .  .   .  .  .  .  .  .  .  .   .  .  .  .  .  .  .  .   .  .  .  .  .  .  .  .`) },
      { wave: 0.125, vol: 0.18, notes: bars(`
        A4 C5 E5 C5 A4 C5 E5 C5  F4 A4 C5 A4 F4 A4 C5 A4  G4 C5 E5 C5 G4 C5 E5 C5  G4 B4 D5 B4 G4 B4 D5 B4
        A4 C5 E5 C5 A4 C5 E5 C5  F4 A4 C5 A4 F4 A4 C5 A4  G4 C5 E5 C5 G4 C5 E5 C5  G4 B4 D5 B4 G4 B4 D5 B4
        A4 C5 E5 C5 A4 C5 E5 C5  F4 A4 C5 A4 F4 A4 C5 A4  G4 C5 E5 C5 G4 C5 E5 C5  G4 B4 D5 B4 G4 B4 D5 B4`) },
      { wave: 'tri', vol: 0.6, notes: bars(`
        A2 .  A3 .  A2 .  A3 .   F2 .  F3 .  F2 .  F3 .   C3 .  C4 .  C3 .  C4 .   G2 .  G3 .  G2 .  G3 .
        A2 .  A3 .  A2 .  A3 .   F2 .  F3 .  F2 .  F3 .   C3 .  C4 .  C3 .  C4 .   G2 .  G3 .  G2 .  G3 .
        A2 .  A3 .  A2 .  A3 .   F2 .  F3 .  F2 .  F3 .   C3 .  C4 .  C3 .  C4 .   G2 .  G3 .  G2 .  G3 .`) },
      { drums: true, notes: bars(`
        k . x . k . x x  k . x . k . x x  k . x . k . x x  k . x . k x x x
        k . x . k . x x  k . x . k . x x  k . x . k . x x  k . x . k x x x
        k . x . . . x .  k . x . . . x .  k . x . . . x .  k . x . . x x x`) },
    ],
  },
};

let song = null, songName = null, stepI = 0, nextT = 0, timer = null, pendingSong = null;

export function playSong(name) {
  if (!ctx) { pendingSong = name; return; }
  if (songName === name) return;
  stopSong();
  if (!name) return;
  songName = name;
  song = SONGS[name];
  song.len = Math.max(...song.tracks.map((t) => t.notes.length));
  stepI = 0;
  nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}

export function stopSong() {
  if (timer) clearInterval(timer);
  timer = null; song = null; songName = null;
}

function schedule() {
  if (!song || !ctx) return;
  const stepDur = 60 / song.bpm / 2;
  while (nextT < ctx.currentTime + 0.15) {
    const t = nextT - ctx.currentTime;
    for (const tr of song.tracks) {
      const tok = tr.notes[stepI % tr.notes.length];
      if (tr.drums) {
        if (tok === 'k') tone({ f: [160, 45], d: 0.12, wave: 'sine', vol: 0.8, t, bus: musicBus });
        if (tok === 'x') noise({ d: 0.035, vol: 0.25, t, bus: musicBus, lo: 6000, hi: 12000 });
        continue;
      }
      if (tok === '.' || tok === '-') continue;
      let len = 1;
      while (tr.notes[(stepI + len) % tr.notes.length] === '-' && len < 16) len++;
      tone({ f: freq(tok), d: len * stepDur * 0.92, wave: tr.wave, vol: tr.vol, t, bus: musicBus, attack: 0.006 });
    }
    stepI = (stepI + 1) % song.len;
    nextT += stepDur;
  }
}

# Echo

A retro, Game Boy-style puzzle game for the browser.

Every room has a way out, but you can't reach it alone. Press **ECHO** and time
rewinds: a ghost of your last attempt replays every move you made, right
beside you. Echoes hold down plates, block lasers and do the jobs you can't do
at the same time as walking out the door.

**Play:** https://echo-game.jaydennarayan5.workers.dev

## How to play

| | Phone | Keyboard |
|---|---|---|
| Move | D-pad or swipe on the screen | Arrow keys / WASD |
| Wait one turn | Middle of the D-pad | Space |
| Echo (rewind, keep a ghost) | A | E |
| Undo (hold to rewind fast) | B | Z or Backspace |
| Restart this run / clear echoes | SELECT | R |
| Menu | START | Esc |
| Show me how (once unlocked) | tap **? SHOW ME** at the top of the screen | H |

- **Plates** open the door with the same symbol while something stands on them.
- **Numbered doors** do the opposite: they shut while their plate is held.
- **Crates** can be pushed; they hold plates down and block lasers.
- **Lasers** zap you, but not your echoes, and an echo in the way blocks the beam.
- **Arrow tiles** can only be stepped (or pushed) onto going the way they point.
- **Conveyor belts** carry you, echoes and crates one square at the end of every turn.
- **Ice**: you slide until something stops you (crates stop on echoes; you don't).
- **Warp pads** come in pairs: step on one, pop out of the other.
- **Levers** flip their doors every time something steps on them (crates too).
- **Ghost gates**: you and crates can pass, echoes can't.
- If there's nothing left to undo, **B** takes back your last echo.

Stuck? After 3 restarts (or a couple of minutes) in a room, the room name at
the top of the screen turns into a blinking **? SHOW ME** button: the room plays itself so you can watch
how it's done, then it's your turn.

**36 rooms in 9 worlds.** Clearing a room gives you a password for the next one
(NES style), and progress is saved in your browser.

- **Daily challenge**: a new room every day (the same for everyone), with a par
  (the fewest turns possible) and a streak counter.
- **Room editor**: build your own room, play-test it, then CHECK & SHARE: the
  game's own solver proves there's a way out before it gives you a link.
  Opening the link plays the room (SHOW ME works on it too).
- **Trophies**: 19 of them, from FIRST ECHO to EVERY DAY. Nine unlock things:
  new heroes (ROBOT, CAT, KNIGHT, FROG) and screen colours (VIRTUAL, SPOOKY,
  NEON, CANDY, GOLD).
- **Settings**: screen colours, console colours (7 shells), hero, sound, music.

## Making it

Plain JavaScript and a `<canvas>`, built with [Vite](https://vitejs.dev).
No images or sound files: the pixel art is drawn from text grids in
`src/sprites.js` and the chiptune music is made live with the Web Audio API.

```
npm install
npm run dev            # play locally
npm run build          # build to dist/
npm run check:levels   # prove every room can be solved, and needs all its echoes
node scripts/design.mjs 18   # find the fastest solution for a room (while designing)
node scripts/generate.mjs 5 ice   # generate rooms that need their echoes
node scripts/make-dailies.mjs 150 # grow the daily challenge pool (src/dailies.js)
```

- `src/sim.js`: the rules (pure, so undo, echoes and the checker share it)
- `src/levels.js`: the rooms, with a solution for each
- `src/game.js`: playing a room; `src/main.js`: the screens and menus
- `src/render.js`, `src/sprites.js`, `src/font.js`: the 160x144 screen
- `src/audio.js`: sound effects and music; `src/input.js`: buttons, keys, swipes
- `src/shells.js`: console colour themes
- `src/search.js`: the exact solver (used by the checker, the editor and the generator); `src/worker.js` runs it off the main thread
- `src/daily.js`, `src/dailies.js`: the daily challenge and its pool of generated rooms
- `src/roomcode.js`: editor tiles and share codes; `src/achievements.js`: trophies and unlocks

Deployed to Cloudflare Workers (static assets) on every push to `main`; see
`wrangler.jsonc`.

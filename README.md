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
| Show me how (once unlocked) | yellow **?** button | H |

- **Plates** open the door with the same symbol while something stands on them.
- **Numbered doors** do the opposite: they shut while their plate is held.
- **Crates** can be pushed; they hold plates down and block lasers.
- **Lasers** zap you, but not your echoes, and an echo in the way blocks the beam.
- If there's nothing left to undo, **B** takes back your last echo.

Stuck? After 3 restarts (or a couple of minutes) in a room, a yellow **? SHOW
ME** button pops out of the screen: the room plays itself so you can watch
how it's done, then it's your turn.

16 rooms in 4 worlds. Clearing a room gives you a password for the next one
(NES style), and progress is saved in your browser. In **Settings** you can
pick the screen colours (6 palettes) and the console's colours (7 shells).

## Making it

Plain JavaScript and a `<canvas>`, built with [Vite](https://vitejs.dev).
No images or sound files: the pixel art is drawn from text grids in
`src/sprites.js` and the chiptune music is made live with the Web Audio API.

```
npm install
npm run dev            # play locally
npm run build          # build to dist/
npm run check:levels   # prove every room can be solved, and needs all its echoes
```

- `src/sim.js`: the rules (pure, so undo, echoes and the checker share it)
- `src/levels.js`: the rooms, with a solution for each
- `src/game.js`: playing a room; `src/main.js`: the screens and menus
- `src/render.js`, `src/sprites.js`, `src/font.js`: the 160x144 screen
- `src/audio.js`: sound effects and music; `src/input.js`: buttons, keys, swipes
- `src/shells.js`: console colour themes

Deployed to Cloudflare Workers (static assets) on every push to `main`; see
`wrangler.jsonc`.

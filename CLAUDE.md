# Echo: notes for future work

A retro Game Boy-style puzzle game: Vite + plain JS on a 160x144 canvas.
The hook: pressing ECHO rewinds the room and a ghost replays your last run.

## Rules of thumb

- The game must work on phones (touch D-pad and buttons, portrait and
  landscape) and with a keyboard. `npx vite build` must pass.
- Keep the look retro: only the 4 palette shades ("0"-"3" in sprites), the
  pixel font in `src/font.js`, 16x16 tiles, rooms at most 10x8 tiles.
- Game rules live only in `src/sim.js` (pure functions). Don't put rules in
  the drawing code: undo, echoes and the level checker all replay `sim.js`.
- Every room in `src/levels.js` has a `solution` (one string per run, echo
  runs first). After adding or changing rooms run `npm run check:levels`:
  it replays the solution and proves the room can't be solved with fewer
  echoes than it gives you. `node scripts/solve.mjs <room> <echo runs...>`
  finds the shortest final run for given echo runs (handy when designing).
- Each new room should teach or combine ideas; keep the difficulty curve
  gentle and give each room a short hint (shown on its intro card).
- New rooms need a unique 4-letter `code` (password). The `solution` is
  also what the SHOW ME hint demo plays, so keep it short and clear.
- Console colours live in `src/shells.js`, screen palettes in `src/render.js`.
- Commit and push to `main` when done: Cloudflare (`wrangler.jsonc`) builds
  and deploys it to https://echo-game.jaydennarayan5.workers.dev

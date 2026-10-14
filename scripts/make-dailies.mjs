// Builds the daily challenge pool (src/dailies.js) with the room generator:
// every room is proven to need its echo(es). Takes a while; it saves as it
// goes and carries on from where it stopped:
//   node scripts/make-dailies.mjs 120
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { makeRoom, judge, rng } from './generate.mjs';

const want = Number(process.argv[2] || 120);
const out = new URL('../src/dailies.js', import.meta.url);
const recipes = ['plates', 'crates', 'lasers', 'belts', 'ice', 'tele', 'lever', 'gate', 'oneway', 'mix', 'mix', 'crates', 'lasers'];
let pool = [];
if (existsSync(out)) pool = JSON.parse(readFileSync(out, 'utf8').replace(/^[^[]*/, '').replace(/;\s*$/, ''));
const r = rng(20261012 + pool.length * 7919);
const write = () => writeFileSync(out,
  '// Daily challenge rooms, made by scripts/make-dailies.mjs (each one proven\n' +
  '// to need its echoes). One a day, the same for everyone: see src/daily.js.\n' +
  'export const DAILIES = [\n' + pool.map((d) => '  ' + JSON.stringify(d)).join(',\n') + '\n];\n');
while (pool.length < want) {
  const recipe = recipes[pool.length % recipes.length];
  const echoes = pool.length % 7 === 6 ? 2 : 1;
  for (let tries = 0; tries < 5000; tries++) {
    const map = makeRoom(r, recipe);
    if (!map) continue;
    const res = judge(map, echoes, { minTurns: echoes === 2 ? 10 : 12, limit: 300000 });
    if (res) { pool.push({ ...res, recipe }); write(); console.log(pool.length, recipe, echoes, res.turns); break; }
  }
}

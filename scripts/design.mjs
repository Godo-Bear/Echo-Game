// Level-design helper: finds the fastest solution for a room with a given
// number of echoes (default: what the room gives you).
//   node scripts/design.mjs 18 [echoes]
import { LEVELS } from '../src/levels.js';
import { parseLevel } from '../src/sim.js';
import { search } from '../src/search.js';

const def = LEVELS[Number(process.argv[2]) - 1];
const k = process.argv[3] !== undefined ? Number(process.argv[3]) : def.echoes;
const r = search(parseLevel(def), k);
if (r === null) console.log(`${def.name}: search too big`);
else if (r.turns < 0) console.log(`${def.name}: impossible with ${k} echo(es)`);
else console.log(`${def.name}: ${r.turns} turns with ${k} echo(es): solution: ${JSON.stringify(r.runs)}`);

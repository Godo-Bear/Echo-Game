// The room editor's tiles, and share codes for rooms people make.
// A code is the room (10x8 squares, one letter each), how many echoes it
// gives, and the solution the checker found (so SHOW ME works on it too):
//   R1 <echoes> <80 letters> . <run> - <run> ...
export const ROOM_W = 10, ROOM_H = 8;

// [map character, name in the editor, sprite to show]
export const TOOLS = [
  ['.', 'FLOOR', 'floor'], ['#', 'WALL', 'wall'], [' ', 'EMPTY', 'void'],
  ['P', 'START', 'hero_D0'], ['E', 'EXIT', 'exit0'], ['o', 'CRATE', 'crate'],
  ['a', 'PLATE A', 'plate_a'], ['b', 'PLATE B', 'plate_b'], ['c', 'PLATE C', 'plate_c'],
  ['A', 'DOOR A', 'door_a'], ['B', 'DOOR B', 'door_b'], ['C', 'DOOR C', 'door_c'],
  ['1', 'REVERSE DOOR A', 'door_a_inv'], ['2', 'REVERSE DOOR B', 'door_b_inv'], ['3', 'REVERSE DOOR C', 'door_c_inv'],
  ['>', 'LASER RIGHT', 'emitter_R'], ['<', 'LASER LEFT', 'emitter_L'], ['^', 'LASER UP', 'emitter_U'], ['v', 'LASER DOWN', 'emitter_D'],
  ['R', 'ARROW RIGHT', 'oneway_R'], ['L', 'ARROW LEFT', 'oneway_L'], ['U', 'ARROW UP', 'oneway_U'], ['D', 'ARROW DOWN', 'oneway_D'],
  ['→', 'BELT RIGHT', 'belt_R0'], ['←', 'BELT LEFT', 'belt_L0'], ['↑', 'BELT UP', 'belt_U0'], ['↓', 'BELT DOWN', 'belt_D0'],
  ['~', 'ICE', 'ice'], ['x', 'WARP PAD A', 'tele_x0'], ['y', 'WARP PAD B', 'tele_y0'], ['z', 'WARP PAD C', 'tele_z0'],
  ['f', 'LEVER A', 'lever_a0'], ['g', 'LEVER B', 'lever_b0'], ['h', 'LEVER C', 'lever_c0'], ['=', 'GHOST GATE', 'gate'],
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CHARS = TOOLS.map((t) => t[0]);

export function blankRoom() {
  return Array.from({ length: ROOM_H }, (_, y) => Array.from({ length: ROOM_W }, (_, x) => {
    if (x === 0 || y === 0 || x === ROOM_W - 1 || y === ROOM_H - 1) return '#';
    if (x === 1 && y === 1) return 'P';
    if (x === ROOM_W - 2 && y === ROOM_H - 2) return 'E';
    return '.';
  }));
}

// Problems that stop a room from being played, or '' if it's fine.
export function roomProblem(grid) {
  const all = grid.flat();
  const count = (c) => all.filter((x) => x === c).length;
  if (count('P') !== 1) return 'NEEDS ONE START';
  if (count('E') !== 1) return 'NEEDS ONE EXIT';
  for (const c of 'xyz') if (count(c) !== 0 && count(c) !== 2) return 'WARP PADS COME IN PAIRS';
  return '';
}

export function encodeRoom(grid, echoes, solution = []) {
  const body = grid.flat().map((c) => LETTERS[Math.max(0, CHARS.indexOf(c))]).join('');
  return `R1${echoes}${body}.${solution.join('-')}`;
}

export function decodeRoom(code) {
  const m = /R1([0-3])([A-Za-z0-9]{80})(?:\.([UDLRW-]*))?/.exec(code || '');
  if (!m) return null;
  const letters = [...m[2]];
  if (letters.some((l) => LETTERS.indexOf(l) >= CHARS.length)) return null;
  const grid = Array.from({ length: ROOM_H }, (_, y) => letters.slice(y * ROOM_W, (y + 1) * ROOM_W).map((l) => CHARS[LETTERS.indexOf(l)]));
  return { grid, echoes: Number(m[1]), solution: m[3] ? m[3].split('-') : [] };
}

export const gridToMap = (grid) => grid.map((row) => row.join(''));

// a link that opens the room straight away
export function roomLink(code) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

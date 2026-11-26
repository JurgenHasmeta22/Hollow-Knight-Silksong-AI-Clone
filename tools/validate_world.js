'use strict';

// Static checks for the room definitions (no browser needed): node tools/validate_world.js [areaId ...]
//
//   * no two rooms overlap on the shared world grid
//   * every open tile on a room edge meets an open tile of a neighbouring room (no dead doorways, no misaligned ones)
//   * every placed object stands on something and is not buried in rock
//   * every placed enemy / object / exit can be reached on foot from the room's first doorway, using a deliberately
//     cautious jump model (the hero's real numbers from BW.PHYS, with safety margins)
//
// The reachability model is a simplification (it ignores enemies, moving platforms and lifts), so a warning is a
// prompt to look at the room, not proof it is broken. Rooms whose ents carry `skipReach: true` are not walked.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// the world files only need the BW namespace; load them in index.html order
const FILES = [
    'src/core/core.js',
    'src/world/world.js',
    'src/world/rooms.js',
    'src/world/fortress.js',
    'src/world/hushed.js',
];

const ctx = { console };

ctx.window = ctx;
vm.createContext(ctx);

for (const f of FILES) {
    const file = path.join(ROOT, f);

    if (!fs.existsSync(file)) continue;

    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: f });
}

const BW = ctx.BW;
const T = BW.T;
const P = BW.PHYS;
const only = process.argv.slice(2);
const rooms = BW.ROOM_LIST.filter((r) => !only.length || only.includes(r.area) || only.includes(r.id));

let errors = 0,
    warnings = 0;

const err = (r, m) => {
    errors++;
    console.log(`  ERROR ${r.id}: ${m}`);
};

const warn = (r, m) => {
    warnings++;
    console.log(`  warn  ${r.id}: ${m}`);
};

// ---------------------------------------------------------------- overlaps
for (const a of BW.ROOM_LIST)
    for (const b of BW.ROOM_LIST) {
        if (a.id >= b.id) continue;

        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
            console.log(`  ERROR ${a.id} overlaps ${b.id}`), errors++;
    }

// ---------------------------------------------------------------- helpers
const cell = (r, x, y) => (x < 0 || y < 0 || x >= r.w || y >= r.h ? '#' : r.grid[y][x]);
const solid = (r, x, y) => {
    const c = cell(r, x, y);

    return c === '#' || c === 'B';
};
// gates and breakables are treated as passable: the validator checks the world with everything unlocked
const open = (c) => c === '.' || c === '=' || c === 'G';

// ---------------------------------------------------------------- edges
for (const r of rooms) {
    const sides = [
        { name: 'W', cells: Array.from({ length: r.h }, (_, y) => [0, y, r.x - 1, r.y + y]) },
        { name: 'E', cells: Array.from({ length: r.h }, (_, y) => [r.w - 1, y, r.x + r.w, r.y + y]) },
        { name: 'N', cells: Array.from({ length: r.w }, (_, x) => [x, 0, r.x + x, r.y - 1]) },
        { name: 'S', cells: Array.from({ length: r.w }, (_, x) => [x, r.h - 1, r.x + x, r.y + r.h]) },
    ];

    for (const s of sides) {
        const bad = [];

        for (const [lx, ly, wx, wy] of s.cells) {
            if (!open(cell(r, lx, ly))) continue;

            const n = BW.ROOM_LIST.find((o) => o !== r && wx >= o.x && wx < o.x + o.w && wy >= o.y && wy < o.y + o.h);

            if (!n || !open(cell(n, wx - n.x, wy - n.y))) bad.push(s.name === 'W' || s.name === 'E' ? ly : lx);
        }

        if (bad.length)
            warn(r, `${s.name} edge: ${bad.length} open tile(s) lead nowhere (${bad[0]}..${bad[bad.length - 1]})`);
    }
}

// ---------------------------------------------------------------- reachability
// standing cell: free for a 2-tile tall body, with something to stand on underneath (and not thorns)
function stands(r, x, y) {
    if (solid(r, x, y) || solid(r, x, y - 1)) return false;
    if (cell(r, x, y) === '^' || cell(r, x, y - 1) === '^') return false;

    const g = cell(r, x, y + 1);

    return g === '#' || g === 'B' || g === '=';
}

const free = (r, x, y) => !solid(r, x, y) && !solid(r, x, y - 1);

// Jump model, in tiles (hero: jump 4.4 tiles held, about 6 tiles of travel on the level, an air dash adds about 4).
// The world as shipped is checked with those numbers minus a small margin; the Hushed Gallery is held to a stricter
// one so it never asks for a perfect jump.
const MODELS = {
    normal: { up: 4, reach: 5.8, dash: 4 },
    strict: { up: 3.5, reach: 5, dash: 3 },
};

let M = MODELS.normal;

function canJump(r, a, b, dash) {
    const dy = a.y - b.y; // > 0 = target is higher
    const dx = Math.abs(b.x - a.x);

    if (dy > M.up) return false;

    const reach = dy >= 0 ? M.reach - 0.5 * dy : M.reach + 1.2 * Math.sqrt(-dy);

    if (dx > reach + (dash ? M.dash : 0)) return false;

    // the arc must be clear: sample it with the body's two cells
    const apex = Math.min(M.up + 0.2, Math.max(dy, 0) + 1.2);
    const n = Math.max(6, Math.ceil(dx * 3));

    for (let i = 1; i < n; i++) {
        const u = i / n;
        const x = a.x + (b.x - a.x) * u;
        const y = a.y - (b.y < a.y ? 0 : 0) + (b.y - a.y) * u - apex * 4 * u * (1 - u);

        if (!free(r, Math.round(x), Math.round(y))) return false;
    }

    return true;
}

function reach(r, starts) {
    const key = (x, y) => y * r.w + x;
    const seen = new Set();
    const queue = [];

    for (const s of starts) {
        seen.add(key(s.x, s.y));
        queue.push(s);
    }

    for (let qi = 0; qi < queue.length; qi++) {
        const a = queue[qi];
        const next = [];

        // walking and stepping off ledges
        for (const d of [-1, 1]) {
            const x = a.x + d;

            if (stands(r, x, a.y)) next.push({ x, y: a.y });
            else if (!solid(r, x, a.y) && !solid(r, x, a.y - 1)) {
                // step up a half-tile-ish block (stepUp 12px is less than a tile: only flat walking and drops)
                let y = a.y;

                while (y < r.h - 1 && free(r, x, y) && !stands(r, x, y) && cell(r, x, y + 1) !== '^') y++;

                if (stands(r, x, y)) next.push({ x, y });
            }
        }

        // jumps (with or without the air dash) to any standing cell nearby
        for (let dx = -10; dx <= 10; dx++)
            for (let dy = -Math.ceil(M.up) - 14; dy <= Math.floor(M.up); dy++) {
                const b = { x: a.x + dx, y: a.y - dy };

                if (b.x < 0 || b.y < 0 || b.x >= r.w || b.y >= r.h || !stands(r, b.x, b.y)) continue;
                if (seen.has(key(b.x, b.y))) continue;
                if (canJump(r, a, b, true)) next.push(b);
            }

        for (const b of next) {
            const k = key(b.x, b.y);

            if (!seen.has(k)) {
                seen.add(k);
                queue.push(b);
            }
        }
    }

    return { has: (x, y) => seen.has(key(x, y)), size: seen.size };
}

// SHOW=<room id> node tools/validate_world.js : the room as text. # rock, = ledge, ^ thorns, G gate, B breakable,
// o a cell the hero can stand on, letters mark placements (L lantern, S sign, e enemy, b boss, p pickup/cache, o
// other object), and a trailing X marks a placement that is not reachable.
function show(r, rc) {
    const mark = {};

    for (const e of r.ents) {
        const ch =
            { lantern: 'L', sign: 'S', pickup: 'p', cache: 'p', glint: 'p', hint: 'h' }[e.type] ||
            (BW.BOSS_TYPES && BW.BOSS_TYPES[e.type] ? 'b' : ENEMY_LIKE.has(e.type) ? 'e' : 'o');

        mark[e.x + ',' + Math.floor(e.y)] = ch;
    }

    const lines = [];

    for (let y = 0; y < r.h; y++) {
        let s = String(y).padStart(3) + ' ';

        for (let x = 0; x < r.w; x++) {
            const m = mark[x + ',' + y];
            const c = cell(r, x, y);

            s += m || (c === '.' && rc.has(x, y) ? 'o' : c === '.' ? ' ' : c);
        }

        lines.push(s);
    }

    console.log(`--- ${r.id} ${r.name} (${r.w}x${r.h}, world ${r.x},${r.y}) reachable standing cells: ${rc.size}`);
    console.log('    ' + Array.from({ length: r.w }, (_, x) => (x % 10 === 0 ? String((x / 10) % 10) : ' ')).join(''));
    console.log(lines.join('\n'));
}

const ENEMY_LIKE = new Set([
    'crawler',
    'flyer',
    'sentinel',
    'spitter',
    'hopper',
    'hushling',
    'drifter',
    'stilt',
    'reacher',
    'brute',
]);

const GROUND_ENTS = new Set([
    'lantern',
    'sign',
    'crawler',
    'sentinel',
    'spitter',
    'hopper',
    'npc',
    'shrine',
    'door',
    'exitdoor',
    'toll',
    'cache',
    'warden',
    'mourner',
    'hushling',
    'stilt',
    'brute',
    'keyaltar',
    'lastdoor',
    'hushgate',
    'spawn',
]);

function nearStand(r, rc, x, y, rad) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (rc.has(x + dx, y + dy)) return true;

    return false;
}

for (const r of rooms) {
    // doorways: open edge tiles; start from the first standing cell near one
    const doors = [];

    for (let y = 0; y < r.h; y++) {
        if (open(cell(r, 0, y))) doors.push({ x: 0, y, side: 'W' });
        if (open(cell(r, r.w - 1, y))) doors.push({ x: r.w - 1, y, side: 'E' });
    }

    for (let x = 0; x < r.w; x++) {
        if (open(cell(r, x, 0))) doors.push({ x, y: 0, side: 'N' });
        if (open(cell(r, x, r.h - 1))) doors.push({ x, y: r.h - 1, side: 'S' });
    }

    if (r.ents.some((e) => e.skipReach)) continue;

    // start: a standing cell within 3 tiles of the first doorway (the spawn point counts as one)
    const spawn = r.ents.find((e) => e.type === 'spawn');
    const first = spawn
        ? { x: spawn.x, y: spawn.y }
        : ['W', 'E', 'N', 'S'].map((side) => doors.find((d) => d.side === side)).find(Boolean);

    M = r.area === 'hushed' ? MODELS.strict : MODELS.normal;

    if (!first) {
        warn(r, 'no doorway and no spawn: walled in');
        continue;
    }

    const starts = [];

    for (let dy = -2; dy <= 24; dy++)
        for (let dx = -3; dx <= 3; dx++) {
            const x = first.x + dx,
                y = first.y + dy;

            if (stands(r, x, y)) starts.push({ x, y });
        }

    if (!starts.length) {
        warn(r, `nothing to stand on near the first doorway (${first.x},${first.y})`);
        continue;
    }

    const rc = reach(r, [
        starts.sort(
            (a, b) =>
                Math.abs(a.x - first.x) + Math.abs(a.y - first.y) - (Math.abs(b.x - first.x) + Math.abs(b.y - first.y)),
        )[0],
    ]);

    if (process.env.SHOW === r.id) show(r, rc);

    for (const e of r.ents) {
        if (e.type === 'spawn' || e.hang) continue;

        if (GROUND_ENTS.has(e.type)) {
            if (cell(r, e.x, e.y + 1) !== '#' && cell(r, e.x, e.y + 1) !== '=' && cell(r, e.x, e.y + 1) !== 'B')
                warn(r, `${e.type} at ${e.x},${e.y} has no floor under it (${cell(r, e.x, e.y + 1)})`);

            if (solid(r, e.x, e.y) && e.type !== 'door') err(r, `${e.type} at ${e.x},${e.y} is buried in rock`);

            if (!nearStand(r, rc, e.x, e.y, 1)) warn(r, `${e.type} at ${e.x},${e.y} is not reachable on foot`);
        } else if (e.type === 'flyer' || e.type === 'pickup' || e.type === 'glint' || e.type === 'drifter') {
            if (solid(r, e.x, e.y)) err(r, `${e.type} at ${e.x},${e.y} is buried in rock`);

            if (e.type !== 'flyer' && e.type !== 'drifter' && !nearStand(r, rc, e.x, e.y, 3))
                warn(r, `${e.type} at ${e.x},${e.y} is not reachable on foot`);
        }
    }

    // every doorway should be walkable from the first one
    const seenDoor = new Set();

    for (const d of doors) {
        const id = d.side + ':' + (d.side === 'W' || d.side === 'E' ? Math.floor(d.y / 6) : Math.floor(d.x / 6));

        if (seenDoor.has(id)) continue;

        seenDoor.add(id);

        const ok =
            d.side === 'N' || d.side === 'S'
                ? nearStand(r, rc, d.x, d.y, 4) || d.side === 'N'
                : nearStand(r, rc, d.x, d.y, 3);

        if (!ok && d !== first)
            warn(r, `doorway ${d.side} at ${d.x},${d.y} is not reachable from ${first.x},${first.y}`);
    }
}

console.log(`${rooms.length} room(s) checked: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);

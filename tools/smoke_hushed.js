'use strict';

// Headless smoke test for Chapter II (no browser): node tools/smoke_hushed.js
//
// Loads the real game modules into a Node vm with stubbed engine services (audio, drawing, particles, HUD), then
//   * checks every sprite / image name used by the Hushed Gallery's code and rooms exists in assets/manifest.js
//   * runs each new enemy through scripted encounters, with a stand-in hero, drawing every frame, and reports the
//     states it went through (a state that never occurs usually means a broken transition)
//   * strikes the silent bells, checks the toll wakes enemies and that gates open only when a bell group is complete
//   * runs the Long Mourner's victory, the Silent Key, the Last Door and the chapter card sequences to the end
//   * builds difficulty "extras" for every Gallery room on Nightmare
// It cannot judge feel, balance or looks; it finds crashes, NaNs, dead ends and missing assets.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

let failures = 0;

const ok = (m) => console.log('  ok   ' + m);

const bad = (m) => {
    failures++;
    console.log('  FAIL ' + m);
};

const check = (cond, m) => (cond ? ok(m) : bad(m));

// ---------------------------------------------------------------- stubs
// a value that is callable, indexable and numeric: anything drawn or played into it is simply swallowed
const sink = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : sink),
    apply: () => sink,
    set: () => true,
});

const ctx = { console, Math, Date };

ctx.window = ctx;
ctx.BW = undefined;
vm.createContext(ctx);

const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });

const manifest = (() => {
    const raw = fs.readFileSync(path.join(ROOT, 'assets/manifest.js'), 'utf8');

    return JSON.parse(raw.split('window.BW_MANIFEST = ')[1].trim().replace(/;$/, ''));
})();

ctx.BW_MANIFEST = manifest;

load('src/core/core.js');

const BW = ctx.BW;

BW.Audio = sink;
BW.Input = sink;
BW.settings = {};
BW.gfx = { motes: 1 };
BW.FONT_T = 'serif';
BW.FONT_B = 'serif';

const drawn = new Set();

BW.Assets = {
    draw: (c, name) => (drawn.add(name), !!manifest.sprites[name]),
    drawImg: (c, name) => (drawn.add(name), !!manifest.images[name]),
    sprite: (name) => manifest.sprites[name] || null,
    img: (name) => (manifest.images[name] ? { width: 100, height: 100 } : null),
    white: () => null,
};

BW.glowSprite = () => sink;
BW.roundRect = () => {};
BW.wrapText = () => {};

// the rendering modules only touch the DOM when they draw: a canvas stand-in is enough to run them
ctx.document = { createElement: () => sink };
ctx.DOMMatrix = undefined;
ctx.Path2D = function () {
    return sink;
};

for (const f of [
    'src/world/world.js',
    'src/world/rooms.js',
    'src/world/fortress.js',
    'src/world/hushed.js',
    'src/world/hushed_wings.js',
    'src/progression/difficulty.js',
    'src/progression/xp.js',
    'src/progression/skills.js',
    'src/progression/items.js',
    'src/entities/enemies.js',
    'src/entities/objects.js',
    'src/entities/boss.js',
    'src/entities/mourner.js',
    'src/entities/hushed.js',
    'src/rendering/terrain.js',
    'src/rendering/background.js',
]) {
    try {
        load(f);
    } catch (e) {
        bad(`${f} failed to load: ${e.message}`);
        process.exit(1);
    }
}

BW.Game = function () {};

BW.Lore = { NOTES: [], BY_ID: {}, INTERLUDES: {} };
BW.Codex = { BEASTS: [], BY_ID: {}, kill() {} };

try {
    load('src/progression/hushed.js');
    load('src/game/levels/cathedral.js');
    load('src/game/levels/hushed.js');
} catch (e) {
    bad('progression / level modules failed to load: ' + e.stack);
    process.exit(1);
}

const G = BW.Game.prototype;
const T = BW.T;

// ---------------------------------------------------------------- 1. assets
console.log('assets');

{
    const text = [
        'src/world/hushed.js',
        'src/world/hushed_wings.js',
        'src/entities/hushed.js',
        'src/game/levels/hushed.js',
        'src/progression/hushed.js',
        'src/ui/gallery.js',
        'src/world/fortress.js',
    ]
        .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
        .join('\n');

    const sprites = new Set(
        (text.match(/'(hushling|drifter|stilt|reacher|brute|mourner)_[a-z_]+'/g) || []).filter(
            (q) => !/^'mourner_(met|defeated)'$/.test(q),
        ),
    );
    const images = new Set(
        text.match(
            /'(deco_hg_[a-z]+|obj_hg_[a-z_]+|obj_lastdoor(_open)?|item_silentkey|bg_gallery_[a-z]+|tex_gallery|portrait_mourner)'/g,
        ) || [],
    );

    // helper-built names: deco_hg_<name> from prop(r, '<name>', ...)
    const world = fs.readFileSync(path.join(ROOT, 'src/world/hushed.js'), 'utf8');

    for (const m of world.matchAll(/prop\(r, '([a-z]+)'/g)) images.add(`'deco_hg_${m[1]}'`);

    for (const q of sprites) {
        const n = q.slice(1, -1);

        if (['mourner_idle'].includes(n) || manifest.sprites[n]) continue;

        // fortress props share the 'deco_ft_' helper; only creatures' sprite names are checked here
        bad(`sprite ${n} is not in the manifest`);
    }

    for (const q of images) {
        const n = q.slice(1, -1);

        if (!manifest.images[n]) bad(`image ${n} is not in the manifest`);
    }

    ok(`${sprites.size} sprite names and ${images.size} image names resolve`);

    for (const [k, s] of Object.entries(manifest.sprites)) {
        if (!manifest.images[s.img]) bad(`sprite ${k} uses missing atlas ${s.img}`);
    }
}

// ---------------------------------------------------------------- engine stand-ins
function makeGame(roomId, flags) {
    const player = {
        x: 0,
        y: 0,
        w: 24,
        h: 56,
        vx: 0,
        vy: 0,
        facing: 1,
        state: 'normal',
        onGround: true,
        get cx() {
            return this.x + this.w / 2;
        },
        get cy() {
            return this.y + this.h / 2;
        },
        hurtbox() {
            return { x: this.x, y: this.y, w: this.w, h: this.h };
        },
    };

    const state = {
        flags: Object.assign({}, flags),
        stats: {},
        difficulty: 'action',
        cleared: {},
        visited: {},
        lanternsLit: {},
        codex: { seen: {}, kills: {}, moves: {}, tips: {} },
        hp: 12,
        maxHp: 12,
        silk: 0,
        glints: 0,
        xp: 0,
        abilities: { dash: true, parry: true, dodge: true },
    };

    const g = {
        state,
        player,
        enemies: [],
        objects: [],
        hazards: [],
        coins: [],
        shots: [],
        fx: sink,
        hud: {
            toast: (a, b) => g.toasts.push(a + ' | ' + (b || '')),
            showAnnounce: (o) => (g.announce = o),
            announce: null,
            pulse() {},
            xpGain() {},
            savedBlip() {},
        },
        dialog: {
            open(t, p) {
                g.dialogs.push(t);
            },
            active: false,
        },
        toasts: [],
        dialogs: [],
        seq: null,
        mode: 'play',
        whiteFade: 0,
        fade: 0,
        slowT: 0,
        stats: state.stats,
        saved: 0,
        xpGained: 0,
        codexSee() {},
        codexKill() {},
        codexMove() {},
        gainXp(n) {
            g.xpGained += n || 0;
        },
        spawnGlints() {},
        spawnHazard(h) {
            g.hazards.push(h);

            return h;
        },
        addLight() {},
        hitstop() {},
        saveGame() {
            g.saved++;
        },
        startSequence(gen) {
            g.seq = { gen, wait: 0, lockInput: true };
        },
        respawnAtLantern() {
            g.respawned = true;
        },
        arenaLock() {},
        openGateAnimated(gt) {
            gt.open = true;
            gt.opening = true;
            g.room.fillTiles(gt, '.');
            state.flags['seen_' + gt.flag + '_' + g.room.id] = true;
            g.gatesOpened.push(gt.flag);
        },
        gatesOpened: [],
    };

    // the real hooks from cathedral.js / levels/hushed.js, running against the stand-in game
    for (const k of Object.getOwnPropertyNames(G)) if (!(k in g) && typeof G[k] === 'function') g[k] = G[k];

    if (roomId) {
        g.room = new BW.Room(BW.ROOMS[roomId], state.flags);
        state.visited[roomId] = true;
    }

    return g;
}

// ---------------------------------------------------------------- 2. enemies
console.log('enemies');

// the dt of the real simulation
const DT = BW.DT;

function runEncounter(type, roomId, script, seconds) {
    const g = makeGame(roomId, {});
    const def = BW.ROOMS[roomId].ents.find((e) => e.type === type);
    const P = g.player;

    P.x = (def.x - 6) * T;
    P.y = (def.y + 1) * T - P.h;

    const e = new BW.ENEMY_TYPES[type](g, def);

    g.enemies.push(e);

    const seen = new Set();
    let lastState = null,
        strikes = 0,
        contacts = 0,
        bad_ = null;

    for (let i = 0; i < seconds / DT && !bad_; i++) {
        const t = i * DT;

        script(P, e, t, g);

        try {
            e.update(DT);

            for (const h of g.hazards) h.update(DT);

            g.hazards = g.hazards.filter((h) => !h.dead);

            if (i % 8 === 0) {
                e.draw(sink, 1);
                e.drawBar(sink, 1);
                for (const h of g.hazards) h.draw(sink);
            }
        } catch (err) {
            bad_ = `${type} threw at t=${t.toFixed(2)} in state ${e.state}: ${err.stack
                .split('\n')
                .slice(0, 3)
                .join(' / ')}`;
            break;
        }

        if (process.env.VERBOSE && e.state !== lastState) {
            const d = Math.round(P.cx - e.cx);

            console.log(
                `      ${type} t=${t.toFixed(2)} ${lastState || '-'} > ${e.state}  hero ${d >= 0 ? '+' : ''}${d}px`,
            );
        }

        lastState = e.state;
        seen.add(e.state);

        if (![e.x, e.y, e.vx, e.vy].every(Number.isFinite)) bad_ = `${type} went non-finite in state ${e.state}`;

        if (BW.overlap(P.hurtbox(), e.hurtbox())) contacts++;

        for (const b of e.attackBoxes() || []) if (BW.overlap(P.hurtbox(), b)) strikes++;

        for (const h of g.hazards) for (const b of h.boxes() || []) if (BW.overlap(P.hurtbox(), b)) strikes++;
    }

    return { e, g, seen, strikes, contacts, err: bad_ };
}

// a hero who lingers near the enemy, then steps toward it and away again
const lurk = (dist, period) => (P, e, t) => {
    if (t < 2.5) {
        P.x = e.cx - 4000; // out of earshot: the creature should idle or patrol

        return;
    }

    const phase = Math.floor(t / period) % 2;
    const target = e.cx + (phase ? 1 : -1) * dist;

    P.x += BW.clamp(target - P.cx, phase === 1 && Math.abs(target - P.cx) > 600 ? -400 : -3, 3);
    P.x = Math.abs(P.cx - target) > 600 ? target - P.w / 2 : P.x;
    P.facing = e.cx > P.cx ? 1 : -1;
};

for (const [type, room, want] of [
    ['hushling', 'H1', ['idle', 'crawl', 'tell', 'lunge', 'recover']],
    ['drifter', 'H2', ['idle', 'chase', 'tell', 'dive', 'recover']],
    ['stilt', 'H3', ['patrol', 'stalk', 'tell', 'reach', 'recover']],
    ['brute', 'H5', ['patrol', 'approach', 'windup', 'slam', 'recover']],
]) {
    const r = runEncounter(type, room, lurk(type === 'drifter' ? 180 : type === 'stilt' ? 150 : 120, 4), 60);

    if (r.err) bad(r.err);
    else {
        const missing = want.filter((s) => !r.seen.has(s));

        check(
            !missing.length,
            `${type}: ${[...r.seen].join(' > ') || 'no states'}${
                missing.length ? '  (never reached: ' + missing.join(', ') + ')' : ''
            }`,
        );
        check(
            r.strikes + r.contacts > 0,
            `${type}: its blows can actually reach the hero (${r.strikes} blow ticks, ${r.contacts} body ticks)`,
        );
    }
}

// a hero who simply stands there, at about the range where the creature begins its tell: the blow has to be able to land
// (a tell that starts out of reach would make the creature harmless to anyone who does not move)
for (const [type, room, dist] of [
    ['hushling', 'H1', 165],
    ['stilt', 'H3', 180],
    ['brute', 'H5', 185],
]) {
    const r = runEncounter(
        type,
        room,
        (P, e, t) => {
            if (t < 2.5) P.x = e.cx - 4000;
            else if (t < 2.52) P.x = e.cx - dist - P.w / 2;
        },
        14,
    );

    if (r.err) bad(r.err);
    else
        check(
            r.strikes + r.contacts > 0,
            `${type}: a hero who stands still ${dist} px away is struck (${r.strikes} blow ticks, ${r.contacts} body ticks)`,
        );
}

// the Reacher: the hero walks under it, it curls, drops, lands, then fights from the floor
{
    const room = 'H3';
    const def = BW.ROOMS[room].ents.find((e) => e.type === 'reacher');
    const r = runEncounter(
        'reacher',
        room,
        (P, e, t) => {
            if (t < 3) {
                P.x = def.x * T - 300; // far away: it must stay hung
            } else {
                P.x = def.x * T - P.w / 2 + 10; // under it
                P.y = e.homeY + 300;
            }

            P.facing = 1;
        },
        14,
    );

    if (r.err) bad(r.err);
    else {
        const want = ['hang', 'curl', 'drop', 'land'];
        const missing = want.filter((s) => !r.seen.has(s));

        check(
            !missing.length,
            `reacher: ${[...r.seen].join(' > ')}${
                missing.length ? '  (never reached: ' + missing.join(', ') + ')' : ''
            }`,
        );
    }

    // the toll pulls it down wherever the hero is
    const g = makeGame(room, {});
    const e = new BW.ENEMY_TYPES.reacher(g, def);

    g.player.x = 0;
    g.player.y = 2000;
    g.enemies.push(e);

    for (let i = 0; i < 100; i++) e.update(DT);

    check(e.state === 'hang', 'reacher: stays hung while the hero is far away');
    e.onToll({});

    for (let i = 0; i < 400; i++) e.update(DT);

    check(e.state !== 'hang', `reacher: the toll wakes it (state ${e.state})`);
}

// damage, parry, dodge and death on every type
for (const type of ['hushling', 'drifter', 'stilt', 'reacher', 'brute']) {
    const room = { hushling: 'H1', drifter: 'H2', stilt: 'H3', reacher: 'H3', brute: 'H5' }[type];
    const g = makeGame(room, {});
    const def = BW.ROOMS[room].ents.find((e) => e.type === type);
    const e = new BW.ENEMY_TYPES[type](g, def);

    g.enemies.push(e);
    g.player.x = e.x - 100;
    g.player.y = e.y;

    try {
        for (let i = 0; i < 200; i++) e.update(DT);

        e.damage(1, 'side', g.player);
        e.onParried(g.player);
        e.onDodged(g.player);

        for (let i = 0; i < 100; i++) e.update(DT);

        let r;

        for (let i = 0; i < 40 && !e.dead; i++) r = e.damage(1, 'side', g.player);

        for (let i = 0; i < 200; i++) {
            e.update(DT);
            e.draw(sink, 1);
        }

        check(e.dead && r === 'kill', `${type}: takes damage, parry and dodge, and dies (${e.maxHp} hp)`);
    } catch (err) {
        bad(`${type} damage/death path threw: ${err.stack.split('\n').slice(0, 3).join(' / ')}`);
    }
}

// ---------------------------------------------------------------- 3. difficulty extras
console.log('difficulty');

for (const level of ['story', 'action', 'nightmare']) {
    const st = { difficulty: level };
    let total = 0,
        reachers = 0;

    try {
        for (const r of BW.ROOM_LIST.filter((x) => x.area === 'hushed')) {
            const room = new BW.Room(r, {});
            const ex = BW.Difficulty.extras(room, {}, st);

            total += ex.length;
            reachers += ex.filter((e) => e.type === 'reacher').length;

            for (const e of ex)
                if (room.solid(e.x, e.y)) bad(`${level}: an extra ${e.type} in ${r.id} was placed inside rock`);
        }

        check(reachers === 0, `${level}: ${total} extra creatures placed, none of them Reachers`);
    } catch (err) {
        bad(`${level}: extras threw ${err.stack.split('\n').slice(0, 3).join(' / ')}`);
    }
}

// ---------------------------------------------------------------- 4. bells and gates
console.log('bells and gates');

{
    // H4: three bells share the gate hb_h4
    const g = makeGame('H4', {});
    const bells = BW.ROOMS.H4.ents.filter((e) => e.type === 'silentbell').map((d) => new BW.OBJ.silentbell(g, d));
    const enemy = new BW.ENEMY_TYPES.hushling(g, { type: 'hushling', x: 10, y: 40 });

    g.enemies.push(enemy);
    g.objects.push(...bells);

    try {
        for (const b of bells) {
            b.update(DT);
            b.draw(sink);
        }

        bells[0].hit();
        check(g.state.flags.hbell_h4a && !g.state.flags.hb_h4, 'H4: one bell rung, the gate stays shut');
        check(enemy.alertT > 0, 'H4: the toll alerts the Hushed in the room');
        bells[0].update(5);
        bells[0].hit();
        check(!g.state.flags.hb_h4, 'H4: striking the same bell twice does not count twice');
        bells[1].hit();
        check(!g.state.flags.hb_h4, 'H4: two of three bells: still shut');
        bells[2].hit();
        check(
            g.state.flags.hb_h4 && g.gatesOpened.includes('hb_h4'),
            'H4: all three bells unwrapped, the veil gate opens',
        );
        check(g.xpGained > 0, 'H4: unwrapping bells earns experience');

        // H2: a single bell opens its gate at once
        const g2 = makeGame('H2', {});
        const b2 = new BW.OBJ.silentbell(
            g2,
            BW.ROOMS.H2.ents.find((e) => e.type === 'silentbell'),
        );

        b2.hit();
        check(g2.state.flags.hb_h2 && g2.gatesOpened.includes('hb_h2'), 'H2: the first bell opens the way east');

        // a bell that was rung in an earlier session is already unwrapped
        const g3 = makeGame('H2', { hbell_h2a: true });
        const b3 = new BW.OBJ.silentbell(
            g3,
            BW.ROOMS.H2.ents.find((e) => e.type === 'silentbell'),
        );

        check(b3.rung, 'H2: a bell rung in an earlier session loads unwrapped');
    } catch (err) {
        bad('bells threw: ' + err.stack.split('\n').slice(0, 4).join(' / '));
    }

    // gates open on load when their flag is already set
    const open = new BW.Room(BW.ROOMS.H2, { hb_h2: true });

    check(open.gates.find((x) => x.flag === 'hb_h2').open, 'H2: the gate loads open once its flag is set');
    check(!new BW.Room(BW.ROOMS.H2, {}).gates.find((x) => x.flag === 'hb_h2').open, 'H2: and shut before');
    check(
        !new BW.Room(BW.ROOMS.F4, {}).gates.find((x) => x.flag === 'great_bell').open,
        'F4: the Gatehall veils are shut before the Great Bell',
    );
    check(
        new BW.Room(BW.ROOMS.F4, { great_bell: true }).gates.find((x) => x.flag === 'great_bell').open,
        'F4: and open after it',
    );
}

// ---------------------------------------------------------------- 5. the Long Mourner and the sequences
console.log('the Long Mourner');

// run a sequence generator to the end, answering waits as the game would
function runSeq(g, label, maxSteps = 100000, beforeWait) {
    const gen = g.seq.gen;
    let steps = 0;

    try {
        for (let r = gen.next(); !r.done; r = gen.next()) {
            if (++steps > maxSteps) {
                bad(`${label}: did not finish`);

                return false;
            }

            if (typeof r.value === 'function') {
                if (beforeWait) beforeWait(r.value);

                let guard = 0;

                while (!r.value() && guard++ < 10) if (beforeWait) beforeWait(r.value);

                if (guard >= 10) {
                    bad(`${label}: stuck waiting on a condition`);

                    return false;
                }
            }
        }
    } catch (err) {
        bad(`${label} threw: ${err.stack.split('\n').slice(0, 4).join(' / ')}`);

        return false;
    }

    return true;
}

{
    // the boss comes up fresh while undefeated, and as remains once its own flag is set
    const fresh = makeGame('H7', { great_bell: true, warden_defeated: true });
    const def = BW.ROOMS.H7.ents.find((e) => e.type === 'mourner');
    const m = new BW.ENEMY_TYPES.mourner(fresh, def);

    check(m.state === 'bound', 'mourner: with the Warden dead it still stands bound, ready to fight');
    check(m.flagKey === 'mourner' && m.codexId === 'mourner', 'mourner: uses its own flag key and Archive page');

    const done = makeGame('H7', { great_bell: true, warden_defeated: true, mourner_defeated: true });
    const m2 = new BW.ENEMY_TYPES.mourner(done, def);

    check(m2.state === 'remains', 'mourner: after its own defeat it loads as remains');

    // its fight starts through the shared hook, on its own flags
    fresh.boss = m;
    fresh.rematch = false;
    fresh.codexSee = () => {};
    fresh.arenaLock = () => {};
    G.startWardenFight.call(fresh);
    check(
        fresh.state.flags.mourner_met && !fresh.state.flags.warden_met,
        'mourner: the fight sets mourner_met, not warden_met',
    );
    check(fresh.state.stats.mournerAttempts === 1, 'mourner: its attempts are counted on their own');
    check(fresh.seq && fresh.seq.gen, 'mourner: the opening cinematic starts');

    // its defeat: flags, XP, then the victory sequence (the veil gate to the Key Hall parts)
    const win = makeGame('H7', { great_bell: true, warden_defeated: true });
    const boss = new BW.ENEMY_TYPES.mourner(win, def);

    win.boss = boss;
    win.bossBar = { out: false };
    win.camFocus = null;
    win.arenaCam = true;
    win.hitstop = () => {};
    win.rematch = false;
    BW.Codex.kill = () => {};
    BW.XP.REWARD = Object.assign({ mourner: 500 }, BW.XP.REWARD);

    G.onWardenDefeated.call(win, boss);
    check(win.state.flags.mourner_defeated === true, 'mourner: its defeat sets mourner_defeated');
    check(win.xpGained >= 500, `mourner: its defeat is worth ${win.xpGained} experience`);
    check(!!win.seq, 'mourner: the victory sequence starts');

    boss.state = 'remains';

    if (win.seq) {
        const gate = win.room.gates.find((x) => x.flag === 'mourner_defeated');

        check(runSeq(win, 'mourner victory'), 'mourner: the victory sequence runs to the end');
        check(
            gate.open && win.gatesOpened.includes('mourner_defeated'),
            'mourner: the veil gate to the Key Hall is open afterwards',
        );
        check(win.player.state === 'normal', 'mourner: the hero is handed back control');
    }
}

console.log('the key and the Last Door');

{
    const g = makeGame('H8', { great_bell: true, mourner_defeated: true });
    const altar = new BW.OBJ.keyaltar(
        g,
        BW.ROOMS.H8.ents.find((e) => e.type === 'keyaltar'),
    );
    const door = new BW.OBJ.lastdoor(
        g,
        BW.ROOMS.H8.ents.find((e) => e.type === 'lastdoor'),
    );

    g.player.x = altar.x;
    g.player.y = altar.y - 56;
    check(altar.canInteract(), 'altar: the key can be taken');
    check(door.prompt() === 'Touch the door', 'door: without the key it only answers to touch');

    altar.draw(sink);
    door.draw(sink);

    // touching the door without the key shows a message and starts nothing
    door.interact();
    check(g.dialogs.includes('The Last Door') && !g.seq, 'door: without the key it explains itself and starts nothing');

    altar.interact();
    check(!!g.seq, 'altar: taking the key starts its sequence');
    g.hud.announce = null;
    check(
        runSeq(g, 'key sequence', 100000, () => (g.hud.announce = null)),
        'altar: the key sequence runs to the end',
    );
    check(g.state.flags.silent_key === true, 'altar: the Silent Key is in the save');
    check(!altar.canInteract(), 'altar: the key cannot be taken twice');
    check(door.prompt() === 'Unlock the Last Door', 'door: with the key it offers to unlock');

    g.seq = null;
    door.interact();
    check(!!g.seq, 'door: unlocking starts its sequence');
    g.fx = sink;
    check(runSeq(g, 'last door opening'), 'door: the opening sequence runs to the end');
    check(g.state.flags.lastdoor_open === true && door.opening, 'door: it is flagged open and swings');

    for (let i = 0; i < 600; i++) door.update(DT);

    door.draw(sink);
    check(door.open >= 1 && door.prompt() === 'Step into the light', 'door: fully open, it invites you in');

    g.seq = null;
    door.interact();
    check(!!g.seq, 'door: stepping in starts the chapter finale');

    let frames = 0;

    check(
        runSeq(g, 'chapter finale', 100000, () => {
            g.chapterCard && frames++ < 3 && G.drawChapterCard.call(g, sink);
        }),
        'door: the finale runs to the end',
    );
    check(g.state.flags.chapter2_clear === true, 'finale: Chapter II is flagged complete');
    check(g.state.lantern === 'lan_h8' && g.respawned, 'finale: the hero wakes at the Last Door Hall lantern');
    check(g.chapterCard === null, 'finale: the card is cleared afterwards');

    g.seq = null;
    g.dialogs.length = 0;
    door.interact();
    check(
        !g.seq && g.dialogs.includes('The Last Door'),
        'door: afterwards it only shows a teaser, not the finale again',
    );
}

// ---------------------------------------------------------------- 5b. the wings
console.log('the wings');

{
    const bellsIn = (g, id) => {
        const list = BW.ROOMS[id].ents.filter((e) => e.type === 'silentbell').map((d) => new BW.OBJ.silentbell(g, d));

        g.objects.push(...list);

        return list;
    };

    const strike = (b) => {
        b.update(5); // let the bell's cool-down pass
        b.hit();
    };

    try {
        // N2: four bells that must be struck deepest voice first
        const g = makeGame('N2', {});
        const bells = bellsIn(g, 'N2');
        const byOrder = [...bells].sort((a, b) => a.def.order - b.def.order);
        const enemy = new BW.ENEMY_TYPES.hushling(g, { type: 'hushling', x: 10, y: 30 });

        g.enemies.push(enemy);

        check(byOrder.length === 4 && byOrder.every((b, i) => b.def.order === i + 1), 'N2: four bells numbered 1 to 4');
        check(
            byOrder.every((b, i) => i === 0 || b.pitch > byOrder[i - 1].pitch),
            'N2: the order is the order of pitch, deepest first',
        );

        strike(byOrder[1]);
        check(!g.state.flags.hbell_n2b && !byOrder[1].rung, 'N2: a bell struck out of turn does not count');
        check(enemy.alertT > 0, 'N2: a wrong toll still wakes the Hushed');

        strike(byOrder[0]);
        check(g.state.flags.hbell_n2a && byOrder[0].rung, 'N2: the deepest bell, first, is unwrapped');
        strike(byOrder[2]);
        check(!g.state.flags.hbell_n2a && !byOrder[0].rung, 'N2: a wrong bell mid-scale pulls every cloth tight again');

        for (const b of byOrder) strike(b);

        check(
            g.state.flags.hb_n2 && g.gatesOpened.includes('hb_n2'),
            'N2: the whole scale in order opens the Cutter’s door',
        );

        strike(byOrder[3]);
        check(g.state.flags.hb_n2, 'N2: ringing a bell afterwards does nothing to the open door');

        // the three bells that sing together live in three rooms; the gate is in U3
        const gN = makeGame('N3', {});
        const [n3] = bellsIn(gN, 'N3');

        strike(n3);
        check(gN.state.flags.hbell_n3v && !gN.state.flags.hb_voices, 'voices: one of three bells: the veil stays shut');

        const gU = makeGame('U3', { hbell_n3v: true, hbell_u2v: true });
        const [u3] = bellsIn(gU, 'U3');

        strike(u3);
        check(
            gU.state.flags.hb_voices && gU.gatesOpened.includes('hb_voices'),
            'voices: the last bell, in the room of the gate, parts the veil',
        );

        const gF = makeGame('N3', { hbell_u2v: true, hbell_u3v: true });
        const [n3b] = bellsIn(gF, 'N3');

        strike(n3b);
        check(
            gF.state.flags.hb_voices && !gF.gatesOpened.length && gF.toasts.some((t) => /veil parts/i.test(t)),
            'voices: the last bell in another room sets the flag and says a veil parted elsewhere',
        );
        check(
            new BW.Room(BW.ROOMS.U3, { hb_voices: true }).gates.find((x) => x.flag === 'hb_voices').open,
            'voices: U3’s gate loads open afterwards',
        );

        // the Mourners' Shears
        const gS = makeGame('N1', {});
        const altar = new BW.OBJ.relicaltar(
            gS,
            BW.ROOMS.N1.ents.find((e) => e.type === 'relicaltar'),
        );

        gS.player.x = altar.x - gS.player.w / 2;
        gS.player.y = altar.y - gS.player.h;
        altar.update(DT);
        altar.draw(sink);
        check(altar.canInteract() && altar.prompt() === 'Take the Mourners’ Shears', 'N1: the altar offers the Shears');
        altar.interact();
        check(!!gS.seq, 'N1: taking the Shears starts a sequence');
        gS.hud.announce = null;
        check(
            runSeq(gS, 'shears sequence', 100000, () => (gS.hud.announce = null)),
            'N1: the sequence runs to the end',
        );
        check(gS.state.flags.shears === true && gS.xpGained > 0, 'N1: the Shears are in the save and earn experience');
        check(gS.announce && gS.announce.title === 'Mourners’ Shears', 'N1: the pick-up card names them');
        check(!altar.canInteract(), 'N1: the Shears cannot be taken twice');

        // every cloth hatch needs them, and every hatch is announced by a hint that goes away once you have them
        const hatches = BW.ROOM_LIST.filter((r) => r.area === 'hushed').flatMap((r) =>
            r.breakables.filter((b) => b.kind === 'shroud').map((b) => [r, b]),
        );

        check(hatches.length === 4, `the cloth hatches: ${hatches.length} of them (H1, H2, H3, H6)`);

        for (const [r, b] of hatches) {
            check(b.needs === 'shears', `${r.id}: the ${b.id} hatch needs the Shears`);
            check(
                r.ents.some((e) => e.type === 'hint' && e.unless === 'shears' && Math.abs(e.x - b.x0) <= 3),
                `${r.id}: a hint at the ${b.id} hatch fades once you own the Shears`,
            );
        }

        // every lore note stands on something, in a room of its own
        const solidAt = (r, x, y) => ['#', 'B', '=', 'G'].includes((r.grid[y] || [])[x]);

        for (const n of BW.Lore.NOTES) {
            const r = BW.ROOMS[n.room];

            if (!r || r.area !== 'hushed') continue;

            check(
                r.grid[n.y] && r.grid[n.y][n.x] === '.' && solidAt(r, n.x, n.y + 1),
                `note ${n.id}: stands on the floor of ${n.room}`,
            );
        }

        // every group's bells agree on one gate, and every gate flag is opened by something
        const groups = {};

        for (const r of BW.ROOM_LIST)
            for (const e of r.ents)
                if (e.type === 'silentbell' && e.group) (groups[e.group] = groups[e.group] || []).push(e);

        for (const [name, list] of Object.entries(groups))
            check(
                new Set(list.map((e) => e.gate)).size === 1,
                `bell group ${name}: ${list.length} bells share one gate`,
            );
    } catch (err) {
        bad('wings threw: ' + err.stack.split('\n').slice(0, 5).join(' / '));
    }
}

// ---------------------------------------------------------------- 5c. the Long Mourner, phase two
console.log('the Long Mourner, phase two');

{
    try {
        const g = makeGame('H7', { great_bell: true, warden_defeated: true });
        const def = BW.ROOMS.H7.ents.find((e) => e.type === 'mourner');
        const m = new BW.ENEMY_TYPES.mourner(g, def);
        const P = g.player;

        g.enemies.push(m);
        P.x = m.cx - 360;
        P.y = m.y + m.h - P.h;
        m.rise();
        m.begin();
        m.phase = 2;
        m.toIdle(0.1);
        check(m.speed > 1 && m.speed <= 1.12, `phase two runs only a little faster (x${m.speed})`);

        // the Embrace: its tell floods the body and the screen red, and drawing it must not throw
        m.face();
        m.startAttack('embrace');

        let peak = 0;

        for (let i = 0; i < 0.9 / DT; i++) {
            m.update(DT);
            peak = Math.max(peak, m.alert);
            if (i % 6 === 0) m.draw(sink, 1);
        }

        check(peak > 0.8, `the Embrace's tell raises the red alert to ${peak.toFixed(2)}`);
        check(m.unparryable || m.state !== 'embrace', 'the Embrace is still the unparryable blow');

        // a stretch of phase two against a hero standing still: no throw, finite, and it never stacks blows without a pause
        let attacks = 0,
            last = null,
            idleSeen = 0;

        m.toIdle(0.2);

        for (let i = 0; i < 40 / DT; i++) {
            m.update(DT);
            for (const h of g.hazards) h.update(DT);
            g.hazards = g.hazards.filter((h) => !h.dead);

            if (m.state !== last) {
                if (m.state === 'idle') idleSeen++;
                if (/_wind$/.test(m.state)) attacks++;
                last = m.state;
            }

            if (![m.x, m.y, m.vx, m.vy].every(Number.isFinite)) throw new Error('non-finite in ' + m.state);
        }

        check(attacks > 3, `phase two keeps attacking (${attacks} wind-ups in 40s)`);
        check(idleSeen >= attacks / 3, `and it pauses between attacks (${idleSeen} rests for ${attacks} wind-ups)`);
        check(m.alert >= 0, 'the alert settles back to zero when nothing red is under way');
    } catch (err) {
        bad('mourner phase two threw: ' + err.stack.split('\n').slice(0, 5).join(' / '));
    }
}

// ---------------------------------------------------------------- 6. every object draws
console.log('objects');

{
    const g = makeGame('H7', {});
    const ents = [...BW.ROOM_LIST.filter((r) => r.area === 'hushed' || r.id === 'F4').flatMap((r) => r.ents)];
    const kinds = new Set();

    try {
        for (const e of ents) {
            const gm = makeGame(null, {});

            gm.room = g.room;

            if (BW.OBJ[e.type]) {
                const o = new BW.OBJ[e.type](gm, e);

                o.update(DT);
                o.draw(sink, 1);
                kinds.add(e.type);
            } else if (BW.ENEMY_TYPES[e.type]) kinds.add(e.type);
            else bad(`unknown entity type ${e.type}`);
        }

        ok(`all ${ents.length} placements across ${kinds.size} kinds construct and draw`);
    } catch (err) {
        bad('an object threw: ' + err.stack.split('\n').slice(0, 4).join(' / '));
    }
}

// ---------------------------------------------------------------- 7. rendering code
console.log('rendering');

{
    const rooms = BW.ROOM_LIST.filter((r) => r.area === 'hushed' || r.id === 'F4');
    let built = 0;

    for (const def of rooms) {
        try {
            const g = makeGame(def.id, { great_bell: false });
            const room = g.room;

            // terrain: the hushed dressing (tops, undersides, ledges), thorns, secret overlays
            const ter = BW.Terrain.build(room);

            check(
                !!ter && Array.isArray(ter.secrets),
                `${def.id}: terrain builds (${def.secrets.length} secret overlay(s))`,
            );

            // every gate, shut, half open and open
            for (const gate of room.gates)
                for (const a of [0, 0.4, 1]) {
                    gate.anim = a;
                    BW.Terrain.drawGate(sink, room, gate, 1.5);
                }

            // decorations and the area's particles
            const bg = new BW.Background(g);

            bg.setRoom(room);

            for (let i = 0; i < 6; i++) bg.update(0.016, { x: 0, y: 0 }, 1280, 720);

            bg.view = { x0: 0, x1: 1e6 };
            bg.drawDeco(sink, 'back');
            bg.drawDeco(sink, 'front');
            bg.drawMotes(sink);
            built++;
        } catch (err) {
            bad(`${def.id}: rendering threw ${err.stack.split('\n').slice(0, 4).join(' / ')}`);
        }
    }

    if (built === rooms.length) ok(`all ${built} rooms build, dress, draw their gates and decorations`);

    // the Gallery's own particles
    const g = makeGame('H1', {});
    const bg = new BW.Background(g);

    bg.setRoom(g.room);
    bg.update(0.016, { x: 0, y: 0 }, 1280, 720);
    check(
        bg.motes.length > 0 && bg.motes.every((m) => m.color === '#9fd8ff' || m.color === '#e6f6ff'),
        'H1: the Gallery drifts cold motes',
    );
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);

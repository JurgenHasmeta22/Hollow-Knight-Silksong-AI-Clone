'use strict';

// Node-only check: dying in a boss arena must hand the game back, no browser: node tools/smoke_death.js
//
// Runs the real Game (every script from index.html) with a stubbed canvas, audio and input. It loads a boss test save,
// walks into each boss arena, lets the fight start, kills the hero (in each phase) and runs the death sequence to its
// end. Failures: a throw, a sequence that never finishes, or the hero not back at a lantern.
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

const sink = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : sink),
    apply: () => sink,
    set: () => true,
});

const canvas = { getContext: () => sink, width: 1280, height: 720, style: {}, addEventListener() {}, focus() {} };
const ctx = { console, Math, Date, performance: { now: () => 0 }, setTimeout, clearTimeout };

ctx.window = ctx;
ctx.document = {
    createElement: () => ({ getContext: () => sink, width: 0, height: 0, style: {} }),
    getElementById: () => null,
    addEventListener() {},
    documentElement: sink,
    fonts: undefined,
};
ctx.localStorage = (() => {
    const m = {};

    return {
        getItem: (k) => (k in m ? m[k] : null),
        setItem: (k, v) => (m[k] = String(v)),
        removeItem: (k) => delete m[k],
    };
})();
ctx.addEventListener = () => {};
for (const k of ['Path2D', 'DOMMatrix', 'Image', 'OffscreenCanvas', 'AudioContext', 'FontFace'])
    ctx[k] = function () {
        return sink;
    };
ctx.createImageBitmap = () => Promise.resolve(sink);
ctx.requestAnimationFrame = () => 0;
ctx.devicePixelRatio = 1;
ctx.innerWidth = 1280;
ctx.innerHeight = 720;
ctx.navigator = { getGamepads: () => [] };
ctx.BW = undefined;
vm.createContext(ctx);

const manifest = JSON.parse(
    fs
        .readFileSync(path.join(ROOT, 'assets/manifest.js'), 'utf8')
        .split('window.BW_MANIFEST = ')[1]
        .trim()
        .replace(/;$/, ''),
);

ctx.BW_MANIFEST = manifest;

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);

const flag = () => new Proxy({}, { get: (t, k) => t[k] || false, set: (t, k, v) => ((t[k] = v), true) });

for (const f of scripts) {
    if (/^assets\/(manifest|audio\/sfx)/.test(f) || f.startsWith('src/core/main')) continue;

    try {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    } catch (e) {
        bad(`${f} failed to load: ${e.stack.split('\n').slice(0, 3).join(' / ')}`);
        process.exit(1);
    }

    if (f === 'src/audio/audio.js') ctx.BW.Audio = sink;

    if (f === 'src/input/input.js') {
        ctx.BW.Input = Object.assign(new Proxy({}, { get: (t, k) => (k in t ? t[k] : sink) }), {
            pressed: flag(),
            down: flag(),
            consume(k) {
                this.pressed[k] = false;
            },
            poll() {},
            label: () => 'X',
            device: 'kb',
            ACTIONS: [],
            onAnyKey() {},
        });
    }
}

const BW = ctx.BW;

BW.Assets = {
    draw: (c, name) => !!manifest.sprites[name],
    drawImg: () => true,
    sprite: (name) => manifest.sprites[name] || null,
    img: (name) => (manifest.images[name] ? { width: 100, height: 100 } : null),
    tinted: () => null,
    white: () => null,
};
BW.Audio = sink;
BW.glowSprite = () => sink;
BW.settings = {};

const T = BW.T;
const DT = 1 / 120;

let g;

try {
    g = new BW.Game(canvas);
} catch (e) {
    bad('the Game cannot be built: ' + e.stack.split('\n').slice(0, 4).join(' / '));
    process.exit(1);
}

g.mode = 'play';

// runs the game for `sec` seconds, or until `until()` is true. Returns true (finished / waited out), false (until never
// became true), or null after a throw
function run(sec, label, until) {
    try {
        for (let i = 0; i < sec / DT; i++) {
            g.tick(DT);

            // the real frame drawing too: a throw while drawing freezes the game just like one while updating
            if (i % 4 === 0) g.render(0.5);

            if (until && until()) return true;
        }
    } catch (e) {
        bad(`${label} threw: ${e.stack.split('\n').slice(0, 5).join(' / ')}`);

        return null;
    }

    return !until;
}

const ARENAS = [
    { name: 'the Warden', save: 'warden', room: 'C1', kind: 'warden' },
    { name: 'the Long Mourner', save: 'mourner', room: 'H7', kind: 'mourner' },
];

for (const A of ARENAS) {
    console.log(A.name);

    for (const phase of [1, 2]) {
        const tag = `${A.name}, phase ${phase}`;

        BW.TestSaves.load(g, A.save);
        g.mode = 'play';

        const def = BW.ROOMS[A.room];
        const sp = def.ents.find((e) => e.type === 'spawn' || e.type === 'lantern') || { x: 4, y: def.h - 4 };

        g.loadRoom(A.room, { x: (sp.x + 3) * T, y: (sp.y + 1) * T - g.player.h }, { silent: true });
        g.player.state = 'normal';
        g.state.hp = g.state.maxHp;

        if (run(2, tag + ': walking in') === null) continue;

        const find = () => g.boss || g.enemies.find((e) => /warden|mourner/.test(e.kind || e.type || ''));

        // step across the room to set off the arena trigger, wherever it is
        for (
            let x = 4;
            x < def.w - 4 && !g.seq && !(find() && find().state !== 'bound' && find().state !== 'remains');
            x += 6
        ) {
            g.player.x = x * T;
            g.player.vx = 0;

            if (run(0.4, tag + ': crossing the room') === null) break;
        }

        if (g.seq && run(25, tag + ': intro cinematic', () => !g.seq) !== true) {
            bad(tag + ': the intro cinematic never ended');
            continue;
        }

        const boss = find();

        if (!boss) {
            bad(tag + ': the boss never appeared');
            continue;
        }

        check(true, tag + ': the fight began (boss state ' + boss.state + ')');

        if (phase === 2 && boss.hp != null && boss.maxHp) boss.hp = Math.max(1, boss.maxHp * 0.3);

        if (run(1.5, tag + ': fighting') === null) continue;

        const p = g.player;

        p.invulnT = 0;
        p.skillInv = 0;
        p.state = p.state === 'dead' ? p.state : 'normal';
        g.state.hp = 1;
        p.hurt(99, (boss.cx || p.cx) - 40, {});

        if (run(0.3, tag + ': dying') === null) continue;

        check(p.state === 'dead' || !!g.seq || !!g.deathCard, tag + ': the hero dies');

        // the death card waits for a button after 2.6 s: press confirm now and then
        let released = false;

        for (let k = 0; k < 140 && !released; k++) {
            BW.Input.pressed.confirm = k % 10 > 4;

            if (run(0.5, tag + ': death sequence') === null) break;

            released = g.seq === null && !g.deathCard && g.player.state !== 'dead';
        }

        BW.Input.pressed.confirm = false;

        check(released, tag + ': the death sequence finishes');
        check(g.mode === 'play', tag + ': back in play mode (' + g.mode + ')');
        check(g.player.state !== 'dead', tag + ': the hero is alive again (' + g.player.state + ')');
        check(g.state.hp > 0, tag + ': hp restored');
        check(g.fade < 0.05, tag + ': the screen is not black (fade ' + g.fade + ')');
        check(!g.bossBar && !g.arenaCam && !g.camFocus, tag + ': boss bar, arena camera and focus are cleared');
        check(run(3, tag + ': afterwards') === true, tag + ': the game keeps running afterwards');
    }
}

// ---------------------------------------------------------------- a natural death: the boss itself kills a button-mashing hero
console.log('a real fight');

const MASH = {
    stand: [],
    attack: ['attack'],
    dash: ['dash', 'attack'],
    wild: ['attack', 'dash', 'jump', 'skill', 'lance', 'parry', 'transform'],
};

for (const A of ARENAS) {
    for (const [style, keys] of Object.entries(MASH)) {
        for (const phase of [1, 2]) {
            const tag = `${A.name}, ${style}, phase ${phase}`;

            BW.TestSaves.load(g, A.save);
            g.mode = 'play';
            g.state.flags.test_save = false;

            const def = BW.ROOMS[A.room];
            const sp = def.ents.find((e) => e.type === 'spawn' || e.type === 'lantern') || { x: 4, y: def.h - 4 };

            g.loadRoom(A.room, { x: (sp.x + 3) * T, y: (sp.y + 1) * T - g.player.h }, { silent: true });
            g.player.state = 'normal';

            const find = () => g.boss || g.enemies.find((e) => /warden|mourner/.test(e.kind || e.type || ''));

            for (
                let x = 4;
                x < def.w - 4 && !g.seq && !(find() && find().state !== 'bound' && find().state !== 'remains');
                x += 6
            ) {
                g.player.x = x * T;
                g.player.vx = 0;

                if (run(0.4, tag + ': crossing') === null) break;
            }

            if (g.seq) run(25, tag + ': intro', () => !g.seq);

            const boss = find();

            if (!boss) {
                bad(tag + ': no boss');
                continue;
            }

            if (phase === 2 && boss.hp != null && boss.maxHp) boss.hp = Math.max(1, boss.maxHp * 0.3);

            let t = 0;
            let dead = false;
            let threw = false;

            while (t < 240 && !dead) {
                // a new button every 1/4 s
                for (const k of keys) BW.Input.pressed[k] = Math.random() < 0.3;

                BW.Input.down.right = Math.random() < 0.5;
                BW.Input.down.left = !BW.Input.down.right && Math.random() < 0.5;
                BW.Input.down.attack = keys.includes('attack') && Math.random() < 0.5;

                if (run(0.25, tag + ': fighting') === null) {
                    threw = true;
                    break;
                }

                t += 0.25;

                // keep the hero in the fight if it survived long: weaken the boss none, but hurt the hero on a timer
                if (g.player.state === 'dead' || g.seq || g.deathCard) dead = true;
                if (!dead && t > 60 && t % 20 < 0.3) g.state.hp = Math.min(g.state.hp, 1);
            }

            for (const k of Object.keys(MASH.wild)) BW.Input.pressed[MASH.wild[k]] = false;

            BW.Input.down.attack = BW.Input.down.left = BW.Input.down.right = false;

            if (threw) continue;

            if (!dead) {
                check(true, tag + ': the hero survived four minutes (no death to check)');
                continue;
            }

            let released = false;

            for (let k = 0; k < 140 && !released; k++) {
                BW.Input.pressed.confirm = k % 10 > 4;

                if (run(0.5, tag + ': death sequence') === null) break;

                released = g.seq === null && !g.deathCard && g.player.state !== 'dead';
            }

            BW.Input.pressed.confirm = false;
            check(released, tag + ': died after ' + t.toFixed(0) + ' s and the death sequence finished');
            check(
                run(3, tag + ': afterwards') === true && g.mode === 'play',
                tag + ': the game keeps running afterwards',
            );
        }
    }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall death checks passed');
process.exit(failures ? 1 : 0);

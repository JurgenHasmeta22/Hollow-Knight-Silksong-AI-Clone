'use strict';

// Node-only checks of the gourd, quick items, skill tree, Odo's shop and the new poses on the real Game, no browser:
// node tools/smoke_systems.js
//
// Runs the real Game (every script from index.html) with a stubbed canvas, audio and input.
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

const hold = (keys, sec, label) => {
    for (const k of keys) BW.Input.down[k] = true;

    const r = run(sec, label);

    for (const k of keys) BW.Input.down[k] = false;

    return r;
};

const tap = (k, label) => {
    BW.Input.pressed[k] = true;
    BW.Input.down[k] = true;

    const r = run(DT, label); // one tick: a real key press is "pressed" for a single frame

    BW.Input.pressed[k] = false;
    BW.Input.down[k] = false;
    run(0.05, label);

    return r;
};

// ---------------------------------------------------------------- a fresh journey
console.log('a fresh journey');

g.newGame('action');
g.mode = 'play';
g.seq = null;
g.player.state = 'normal';
run(3, 'settling');

const st = g.state;
const p = g.player;

check(BW.Gourd.left(st) === 3 && BW.Gourd.max(st) === 3, 'the gourd starts with three draughts');
check(BW.Items.count(st, 'charge') === 3 && st.quick === 'charge', 'the satchel starts stocked, Toll Charge selected');
check(BW.Skills.points(st).free === 0, 'no skill points at level 1');

// skills are locked until learned
st.silk = st.silkMax;
tap('lance', 'lance');
check(!p.skill && st.silk === st.silkMax, 'the Energy Barrage does nothing before it is learned');
tap('skill', 'skill');
check(!p.skill, 'the Whirlwind Dash does nothing before it is learned');

// ---------------------------------------------------------------- the gourd
console.log('the gourd');

p.onGround = true;
st.hp = st.maxHp - 3;
BW.Input.pressed.heal = true;
hold(['heal'], DT, 'pressing heal');
BW.Input.pressed.heal = false;
hold(['heal'], 0.3, 'drinking');
check(p.state === 'heal', 'holding the gourd button starts a draught');
hold(['heal'], 0.6, 'drinking');
check(
    st.hp === st.maxHp - 1 && BW.Gourd.left(st) === 2,
    `one draught mends two bells (hp ${st.hp}/${st.maxHp}, ${BW.Gourd.left(st)} left)`,
);

st.hp = st.maxHp;

const before = BW.Gourd.left(st);

tap('heal', 'drink at full health');
run(0.8, 'full health');
check(BW.Gourd.left(st) === before, 'a full-health hero does not waste a draught');

st.hp = 1;
st.gourd = 0;
tap('heal', 'drink when empty');
run(0.5, 'empty');
check(p.state !== 'heal' && st.hp === 1, 'an empty gourd does nothing');

g.respawnAtLantern(true);
check(BW.Gourd.left(g.state) === 3, 'waking at a lantern fills the gourd again');

// ---------------------------------------------------------------- the skill tree
console.log('the skill tree');

{
    const s2 = g.state;

    s2.xp = BW.XP.total(4);
    check(BW.Skills.points(s2).free === 3, 'level 4 has earned three points');
    check(
        BW.Skills.status(s2, 'edge') === 'open' && BW.Skills.status(s2, 'flow') === 'locked',
        'edge is open, flow is locked behind it',
    );
    check(BW.Skills.learn(g, 'edge') && BW.Skills.has(s2, 'edge'), 'learning Whetted Edge works');
    check(!BW.Skills.learn(g, 'dashslash'), 'a node behind an unlearned one cannot be learned');
    check(BW.Skills.learn(g, 'flow'), 'Flowing Strikes follows');
    check(BW.Skills.points(s2).free === 1, 'points are spent');
    check(
        BW.Skills.learn(g, 'dashslash') && !BW.Skills.learn(g, 'void'),
        'the last point buys Dash Slash, Void Slash (2) is out of reach',
    );
    check(Math.abs(BW.XP.power(s2) - (1 + BW.XP.BONUS * 3) * 1.12) < 1e-9, 'Whetted Edge adds 12% to every blow');

    // a learned unlock opens the move
    s2.skills.barrage = true;
    s2.silk = s2.silkMax;
    g.player.state = 'normal';
    g.player.cd = {};
    tap('lance', 'lance');
    check(!!p.skill && p.skill.name === 'barrage', 'once learned, the Energy Barrage fires');
    run(1, 'barrage');
}

// ---------------------------------------------------------------- the quick items
console.log('the quick items');

{
    const s3 = g.state;

    BW.Items.unlockAll(s3);
    g.player.state = 'normal';
    g.player.skill = null;

    for (const id of BW.Items.ORDER) {
        s3.quick = id;
        g.player.skill = null;
        g.player.cd = {};

        const n = BW.Items.count(s3, id);

        run(0.2, 'before ' + id);
        tap('item', 'using ' + id);
        run(0.4, 'using ' + id);
        check(
            BW.Items.count(s3, id) === n - 1,
            `${BW.Items.DEFS[id].name} is spent when used (${n} -> ${BW.Items.count(s3, id)})`,
        );
    }

    check(g.player.rageT > 0, 'the Rage Draught is burning');

    s3.quick = 'charge';
    BW.Input.pressed.itemNext = true;
    run(DT, 'cycling');
    BW.Input.pressed.itemNext = false;
    check(s3.quick === 'shards', 'T moves to the next item');

    s3.quick = 'veil';
    s3.items.veil = 0;
    g.player.skill = null;
    tap('item', 'empty item');
    check(BW.Items.count(s3, 'veil') === 0, 'an item you have none of does nothing');

    s3.items.charge = BW.Items.cap(s3, 'charge');
    check(BW.Items.add(s3, 'charge', 3) === 0, 'the satchel does not hold more than its cap');
    check(BW.Items.drop(s3, () => 0.01) !== undefined, 'a lucky foe can drop an item');
}

// ---------------------------------------------------------------- Odo's shop
console.log("Odo's shop");

{
    const s4 = g.state;

    s4.glints = 500;
    s4.items.charge = 0;
    g.odoShop();
    check(
        g.dialog.active && g.dialog.choices.length === BW.Items.ORDER.length + 1,
        'the shop lists every item and Leave',
    );
    g.dialog.close(g.dialog.choices[0]);
    check(
        BW.Items.count(s4, 'charge') === 1 && s4.glints === 500 - BW.Items.DEFS.charge.price,
        'buying takes the glints and fills the satchel',
    );
    g.dialog.close('Leave');
    g.dialog.active = false;
}

// ---------------------------------------------------------------- the skills screen and the HUD, drawn
console.log('the skills screen');

{
    g.menu.push('skills', { sel: 0 });
    check(run(0.5, 'skills screen') === true, 'the Skills screen opens and draws');

    for (const k of ['right', 'down', 'down', 'left', 'up', 'confirm', 'right', 'right', 'down']) {
        BW.Input.pressed[k] = true;
        run(0.3, 'skills ' + k);
        BW.Input.pressed[k] = false;
    }

    check(true, 'every direction and confirm work on the Skills screen');
    BW.Input.pressed.back = true;
    run(0.4, 'closing skills');
    BW.Input.pressed.back = false;
    g.menu.closeAll();
}

// ---------------------------------------------------------------- saving
console.log('saving');

{
    const out = BW.Save.migrate(JSON.parse(JSON.stringify(g.persist())));

    check(out.gourd === g.state.gourd && out.quick === g.state.quick, 'the gourd and the selected item survive a save');
    check(JSON.stringify(out.items) === JSON.stringify(g.state.items), 'the satchel survives a save');
    check(JSON.stringify(out.skills) === JSON.stringify(g.state.skills), 'the learned skills survive a save');

    const old = BW.Save.migrate({ game: 'uncalled', maxHp: 5 });

    check(
        old.gourd === 3 && old.items.charge === 3 && old.skills && !Object.keys(old.skills).length,
        'a save without them gets the starting gourd, satchel and no skills',
    );
}

// ---------------------------------------------------------------- the poses
console.log('the poses');

{
    BW.TestSaves.load(g, 'skills');
    g.mode = 'play';
    run(1, 'test save');

    const P2 = g.player;
    const seen = new Set();

    P2.state = 'normal';
    P2.onGround = true;

    const probe = (label, f) => {
        f();

        try {
            const pose = P2.formPose(P2.poseNow());

            seen.add(pose);
            g.render(0.5);

            if (!BW.Assets.sprite('ronin_' + pose)) bad(label + ': pose ' + pose + ' has no sprite');
        } catch (e) {
            bad(label + ' threw: ' + e.stack.split('\n').slice(0, 3).join(' / '));
        }
    };

    probe('idle', () => P2.pickAnim());
    probe('landing, soft', () => {
        P2.landT = 0.2;
        P2.landHard = false;
        P2.pickAnim();
    });
    probe('landing, hard', () => {
        P2.landT = 0.2;
        P2.landHard = true;
        P2.pickAnim();
    });
    probe('perfect parry', () => {
        P2.deflectT = 0.2;
        P2.pickAnim();
    });
    probe('dodge', () => {
        P2.deflectT = 0;
        P2.dodgeAnimT = 0.2;
        P2.pickAnim();
    });

    for (const id of BW.Items.ORDER)
        probe('item ' + id, () => {
            P2.dodgeAnimT = 0;
            P2.itemAnimT = 0.3;
            P2.itemKind = id;
            P2.pickAnim();
        });

    probe('heavy hit', () => {
        P2.itemAnimT = 0;
        P2.lockT = 0.5;
        P2.pickAnim();
    });
    probe('wounded', () => {
        P2.lockT = 0;
        g.state.hp = 1;
        P2.pickAnim();
    });

    // every pose the sheet holds is drawn somewhere now
    const text = fs.readFileSync(path.join(ROOT, 'src/entities/ronin.js'), 'utf8');
    const unused = Object.keys(manifest.sprites)
        .filter((k) => k.startsWith('ronin_'))
        .map((k) => k.slice(6))
        .filter((n) => !text.includes("'" + n + "'"));

    check(
        unused.length === 0,
        'every Ronin pose is used by some move' + (unused.length ? ' (unused: ' + unused.join(', ') + ')' : ''),
    );
    check(seen.size >= 9, seen.size + ' different poses reached by the new states');
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall systems checks passed');
process.exit(failures ? 1 : 0);

'use strict';

// Node-only checks for the Faceless Ronin (no browser): node tools/smoke_ronin.js
//
// The real player and Ronin code run against a stand-in game on a flat test room, driven by scripted input. Checks:
//   * the atlas and every pose the Ronin can ask for exist in the manifest, inside the atlas image
//   * the combo, the charged Void Slash, the Barrage, the Whirlwind Dash and the dash-slash do their damage and spend silk
//   * the Shade gauge fills, the transformation runs to its end, and the form's skills (double jump, Clone Dash, Clash,
//     Phantom Grab, Ground Eruption, Ground Pound, Illusion Burst, the Giant Spectral Summon, detransformation) work
//   * being hurt, dying and sequences cancel a skill; every skill can be drawn
//   * the new controls, the saved character and the character screen's data exist
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

const manifest = JSON.parse(
    fs
        .readFileSync(path.join(ROOT, 'assets/manifest.js'), 'utf8')
        .split('window.BW_MANIFEST = ')[1]
        .trim()
        .replace(/;$/, ''),
);

ctx.BW_MANIFEST = manifest;
load('src/core/core.js');

const BW = ctx.BW;

BW.Audio = sink;
BW.Input = sink;
BW.settings = {};
BW.gfx = { motes: 1 };
BW.FONT_T = 'serif';
BW.FONT_B = 'serif';
BW.glowSprite = () => sink;
BW.roundRect = () => {};
BW.Assets = {
    draw: (c, name) => !!manifest.sprites[name],
    drawImg: () => true,
    sprite: (name) => manifest.sprites[name] || null,
    img: () => null,
};

for (const f of [
    'src/world/world.js',
    'src/world/rooms.js',
    'src/progression/difficulty.js',
    'src/progression/rewards.js',
    'src/progression/skills.js',
    'src/progression/items.js',
    'src/entities/ronin.js',
    'src/game/game.js',
]) {
    try {
        load(f);
    } catch (e) {
        bad(`${f} failed to load: ${e.stack.split('\n').slice(0, 3).join(' / ')}`);
        process.exit(1);
    }
}

const T = BW.T,
    DT = BW.DT,
    G = BW.Game.prototype;

BW.defineRoom({ id: 'TST', area: 'mosslit', name: 'Test', x: 0, y: 0, w: 90, h: 20 }, (r) => {
    r.air(1, 1, 88, 16); // the floor is row 17: the hero stands on row 16
});

const FLOOR = 17 * T;

// ---------------------------------------------------------------- the stand-in game
class Dummy {
    constructor(x, o = {}) {
        this.x = x;
        this.w = 40;
        this.h = 60;
        this.y = FLOOR - this.h - (o.air || 0);
        this.dead = false;
        this.kind = 'dummy';
        this.dmg = 0;
        this.hits = 0;
        this.stun = 0;
        this.vx = 0;
    }
    get cx() {
        return this.x + this.w / 2;
    }
    get cy() {
        return this.y + this.h / 2;
    }
    hurtbox() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
    damage(n) {
        if (this.dead) return null;

        this.dmg += n;
        this.hits++;

        return 'hit';
    }
}

function makeGame(flags = {}) {
    const state = {
        flags: Object.assign({}, flags),
        stats: {},
        difficulty: 'action',
        hp: 9,
        maxHp: 9,
        silk: 9,
        silkMax: 9,
        glints: 0,
        xp: 0,
        shade: 0,
        character: 'ronin',
        abilities: { dash: true, parry: true, dodge: true },
        codex: { seen: {}, kills: {}, moves: {}, tips: {} },
        gourd: 3,
        quick: 'charge',
    };

    BW.Skills.unlockAll(state);
    BW.Items.unlockAll(state);
    state.gourd = 3;

    const g = {
        state,
        enemies: [],
        objects: [],
        hazards: [],
        coins: [],
        shots: [],
        lances: [],
        fx: sink,
        stats: state.stats,
        time: 0,
        slowT: 0,
        seq: null,
        godMode: false,
        hud: { pulse() {}, deny: (k) => g.denied.push(k), toast() {}, announce: null },
        denied: [],
        taught: [],
        hazardHits: 0,
        room: null,
        teach: (id) => g.taught.push(id),
        hitstop() {},
        addLight() {},
        saveGame() {},
        earnGlints() {},
        onHazard() {
            g.hazardHits++;
        },
        onPlayerDeath() {},
        spawnLance() {},
    };

    g.room = new BW.Room(BW.ROOMS.TST, state.flags);

    // the real attack resolution from game.js, against this stand-in
    g.resolvePlayerAttack = G.resolvePlayerAttack;

    const p = new BW.Ronin(g);

    g.player = p;
    p.reset(10 * T, FLOOR - p.h);
    p.facing = 1;

    return g;
}

const ACTIONS = BW.Input.ACTIONS || [
    'left',
    'right',
    'up',
    'down',
    'jump',
    'attack',
    'dash',
    'lance',
    'skill',
    'transform',
    'heal',
    'parry',
    'interact',
];

// one fixed step with the given held actions and the actions pressed this step
function step(g, down = [], pressed = []) {
    const inp = { down: {}, pressed: {}, released: {}, consume: (a) => (inp.pressed[a] = false) };

    for (const a of ACTIONS) {
        inp.down[a] = false;
        inp.pressed[a] = false;
    }

    for (const a of down) inp.down[a] = true;
    for (const a of pressed) {
        inp.pressed[a] = true;
        inp.down[a] = true;
    }

    g.time += DT;
    g.player.update(DT, inp);

    for (const l of g.lances) l.update(DT);

    g.lances = g.lances.filter((l) => !l.dead);

    for (const e of g.enemies) if (e.stun > 0) e.stun -= DT;
}

const run = (g, seconds, down = []) => {
    for (let i = 0; i < seconds / DT; i++) step(g, down);
};

// the hero settled on the floor with a dummy `dx` px ahead
function arena(dx = 90, o = {}) {
    const g = makeGame();
    const p = g.player;

    run(g, 0.2);

    const d = new Dummy(p.cx + dx, o);

    g.enemies.push(d);

    return { g, p, d };
}

// ---------------------------------------------------------------- 1. art and manifest
console.log('art');

{
    const poses = Object.keys(manifest.sprites).filter((k) => k.startsWith('ronin_'));
    const atlas = manifest.images.atlas_ronin;

    check(poses.length >= 55, `${poses.length} Ronin poses are in the manifest`);
    check(atlas && fs.existsSync(path.join(ROOT, atlas)), 'the atlas image exists: ' + atlas);

    const bounds = (() => {
        let w = 0,
            h = 0;

        for (const k of poses) {
            const f = manifest.sprites[k].frames[0];

            w = Math.max(w, f[0] + f[2]);
            h = Math.max(h, f[1] + f[3]);
        }

        return [w, h];
    })();

    check(bounds[0] <= 3072 && bounds[1] <= 2000, `every pose lies inside the atlas (${bounds.join(' x ')})`);

    let bad_ = 0;

    for (const k of poses) {
        const s = manifest.sprites[k],
            f = s.frames[0];

        // the anchor must be inside the frame, in the lower half (the feet), and the frame must have a size
        if (!(f[2] > 8 && f[3] > 8 && f[4] >= 0 && f[4] <= f[2] && f[5] > f[3] * 0.4 && f[5] <= f[3] + 1)) bad_++;
    }

    check(bad_ === 0, 'every pose has a size and an anchor on its feet');

    // every pose the Ronin code can ask for exists
    const text = fs.readFileSync(path.join(ROOT, 'src/entities/ronin.js'), 'utf8');
    const used = new Set();

    for (const m of text.matchAll(/'([a-z_0-9]+)'/g)) if (manifest.sprites['ronin_' + m[1]]) used.add(m[1]);

    for (const m of text.matchAll(/SPR\('([a-z_0-9]+)'\)/g)) used.add(m[1]);

    const missing = [...used].filter((n) => !manifest.sprites['ronin_' + n]);

    check(
        !missing.length,
        `${used.size} poses named in ronin.js all exist${missing.length ? ': missing ' + missing : ''}`,
    );

    // and every pose in the code is one the importer makes
    const R = BW.RoninFx;

    for (const [name, def] of Object.entries(R.SKILLS)) {
        const s = { t: 0, name, phase: 'dive' },
            seen = new Set();
        const g = makeGame();

        for (let t = 0; t < 3; t += 0.05) {
            s.t = t;
            seen.add(def.pose(g.player, s));
        }

        const gone = [...seen].filter((n) => !manifest.sprites['ronin_' + n]);

        check(!gone.length, `skill ${name}: poses ${[...seen].join(', ')}`);
    }

    for (const c of R.COMBO)
        for (const n of c.poses) if (!manifest.sprites['ronin_' + n]) bad('combo pose missing ' + n);
}

// ---------------------------------------------------------------- 2. controls, save, characters
console.log('controls and save');

{
    const input = fs.readFileSync(path.join(ROOT, 'src/input/input.js'), 'utf8');

    check(/'skill'/.test(input) && /'transform'/.test(input), 'the skill and transform actions exist');
    check(
        /KeyU: \['skill'\]/.test(input) && /KeyO: \['transform'\]/.test(input),
        'U is the skill key and O the transform key',
    );
    check(BW.CHARACTERS.ronin && BW.CHARACTERS.ronin.sprite === 'ronin_idle_a', 'the Ronin is the one hero listed');
    check(!!manifest.sprites[BW.CHARACTERS.ronin.sprite], 'the Ronin preview pose exists');
}

// ---------------------------------------------------------------- 3. moving
console.log('moving');

{
    const g = makeGame();
    const p = g.player;

    run(g, 0.3);
    check(p.onGround, 'the Ronin stands on the floor');
    check(p.anim === 'idle' && ['idle_a', 'stand_d'].includes(p.poseNow()), 'idle plays the standing poses');

    const x0 = p.x;

    run(g, 0.5, ['right']);
    check(p.x > x0 + 120, `running moves it (${Math.round(p.x - x0)} px in 0.5 s)`);
    check(p.anim === 'run' && ['run1', 'run2', 'run3'].includes(p.poseNow()), 'running plays the run cycle');

    step(g, [], ['jump']);
    run(g, 0.05);
    check(!p.onGround && p.vy < 0, 'it jumps');
    check(p.anim === 'jump' && p.poseNow() === 'jump', 'and shows the jump pose');
    run(g, 0.9);
    check(p.onGround, 'and lands again');
}

// ---------------------------------------------------------------- 4. the combo
console.log('the combo');

{
    const { g, p, d } = arena(80);

    check(p.state === 'normal', 'normal state');

    step(g, [], ['attack']);
    check(p.attackT > 0 && p.comboN === 0 && p.atk === BW.RoninFx.COMBO[0], 'the first press starts hit one');

    let hit1 = 0;

    for (let i = 0; i < 0.4 / DT; i++) {
        step(g);

        if (!hit1 && d.hits) hit1 = i;
    }

    check(d.hits === 1, `hit one lands once (${d.hits})`);
    check(g.state.shade > 0, `the Shade gauge fills with a hit (${g.state.shade})`);

    // chain: hit two and hit three inside the combo window
    d.hits = 0;
    d.dmg = 0;
    step(g, [], ['attack']);
    check(p.comboN === 1, 'the next press inside the window is hit two');
    run(g, p.atkDur + 0.02);
    step(g, [], ['attack']);
    check(p.comboN === 2 && p.atk.shock, 'and then the finisher');
    run(g, 0.5);
    check(d.dmg > 2, `the combo's two later hits hurt more (${d.dmg.toFixed(2)})`);

    // a pause resets the combo
    run(g, 1);
    step(g, [], ['attack']);
    check(p.comboN === 0, 'after a pause the combo starts again');

    // an up strike and an air down strike
    run(g, 0.6);
    step(g, ['up'], ['attack']);
    check(p.attackDir === 'up' && p.poseNow() === 'swordup', 'up strikes with the raised sword');
    run(g, 0.5);
}

{
    const { g, p, d } = arena(60);

    step(g, [], ['jump']);
    run(g, 0.3, ['jump']);
    step(g, ['down'], ['attack']);
    check(p.attackDir === 'down' && p.poseNow() === 'pound', 'a down strike in the air stabs');
}

// ---------------------------------------------------------------- 5. normal-form skills
console.log('normal-form skills');

{
    // the Barrage
    const { g, p, d } = arena(300);

    g.state.silk = 9;
    step(g, [], ['lance']);
    check(p.skill && p.skill.name === 'barrage' && g.state.silk === 6, 'the Barrage spends three silk');
    run(g, 0.3);
    check(g.lances.length >= 1 && g.lances[0].constructor.name === 'Crescent', 'it throws a crescent');
    run(g, 0.6);
    check(d.hits >= 1 && d.dmg >= 2, `the crescent cuts the dummy (${d.dmg.toFixed(2)})`);
    check(g.state.silk === 6, 'and a skill does not hand silk back');

    // no silk, no Barrage
    g.state.silk = 1;
    run(g, 0.7);
    step(g, [], ['lance']);
    check(!p.skill && g.denied.includes('silk'), 'without silk the Barrage is denied');
}

{
    // the Whirlwind Dash
    const { g, p, d } = arena(150);

    step(g, [], ['skill']);
    check(p.skill && p.skill.name === 'whirl' && g.state.silk === 7, 'the Whirlwind spends two silk');

    const x0 = p.x;

    run(g, 0.7);
    check(p.x > x0 + 120, `it carries the hero forward (${Math.round(p.x - x0)} px)`);
    check(d.hits >= 1, `and cuts the dummy as it passes (${d.hits} hit)`);
    check(!p.skill, 'and ends');
}

{
    // the charged Void Slash
    const { g, p, d } = arena(150);

    g.state.silk = 9;

    step(g, [], ['attack']);
    run(g, 0.3, ['attack']);
    for (let i = 0; i < 0.8 / DT; i++) step(g, ['attack']);

    check(p.skill && p.skill.name === 'charge', 'holding the strike button charges');
    run(g, 0.5, ['attack']);
    check(p.skill && p.skill.full, 'and the charge comes full');

    step(g); // release
    check(
        p.skill && p.skill.name === 'void' && g.state.silk === 5,
        'releasing a full charge starts the Void Slash (four silk)',
    );
    d.dmg = 0;
    run(g, 0.9);
    check(d.dmg >= 5, `which hits hard (${d.dmg.toFixed(2)})`);
}

{
    // releasing early costs nothing
    const { g, p } = arena(150);

    g.state.silk = 9;
    step(g, [], ['attack']);
    run(g, 0.45, ['attack']);
    for (let i = 0; i < 0.3 / DT && !(p.skill && p.skill.name === 'charge'); i++) step(g, ['attack']);

    check(p.skill && p.skill.name === 'charge', 'charging begins');
    step(g);
    check(!p.skill && g.state.silk === 9, 'releasing early cancels it and keeps the silk');
}

{
    // the dash-slash
    const { g, p, d } = arena(170);

    step(g, [], ['dash']);
    check(p.dashT > 0, 'the dash starts');
    step(g, [], ['attack']);
    check(p.skill && p.skill.name === 'dashslash', 'a strike in the middle of the dash is the dash-slash');
    run(g, 0.5);
    check(d.hits >= 1, 'and it cuts');
}

// ---------------------------------------------------------------- 6. the form
console.log('the second form');

{
    const { g, p, d } = arena(900);

    check(g.state.shade === 0, 'the gauge starts empty');

    step(g, [], ['transform']);
    check(!p.skill && g.denied.includes('shade'), 'with the Shade empty, transform is denied');

    g.state.shade = 99;
    p.addShade(3);
    check(g.state.shade === 100 && g.taught.includes('shade'), 'the gauge tops out and teaches the key');

    step(g, [], ['transform']);
    check(
        p.skill && p.skill.name === 'transform' && g.state.shade === 0,
        'full, transform starts and empties the gauge',
    );
    check(p.skillInv > 2, 'and the hero cannot be hurt while changing');

    const poses = new Set();

    for (let i = 0; i < 3.2 / DT; i++) {
        step(g);

        if (p.skill) poses.add(p.poseNow());
    }

    check(
        ['focus', 'aura', 'float', 'absorb', 'unleash', 'transformed'].every((n) => poses.has(n)),
        `it runs the six poses (${[...poses].join(', ')})`,
    );
    check(p.form && p.formT > 18 && p.formT <= p.formMax(), `the form is on (${p.formT.toFixed(1)} s)`);
    check(!p.skill, 'and the hero is free again');
    check(p.speedMul > 1.1, 'faster while transformed');
    check(p.poseNow() === 'transformed', 'standing, it shows the transformed stance');

    // the form's blows are heavier
    const e = new Dummy(p.cx + 80);

    g.enemies = [e];
    step(g, [], ['attack']);
    run(g, 0.4);

    const heavy = e.dmg;

    check(heavy > 1.2, `a form blow hits harder (${heavy.toFixed(2)} against 1.00 in the normal form)`);
    check(g.state.shade === 0, 'and the gauge stays empty while transformed');

    const fm = p.formT;

    p.onHitEnemy(e, 'hit');
    check(p.formT > fm, 'every hit adds a little time to the form');
}

{
    // the fourth hit
    const { g, p } = arena(500);

    p.beginForm();
    g.state.silk = 9;

    const seen = [];

    for (let i = 0; i < 4; i++) {
        step(g, [], ['attack']);
        seen.push(p.comboN);
        run(g, p.atkDur + 0.02);
    }

    check(seen.join() === '0,1,2,3', `the form's combo has four hits (${seen})`);
}

{
    // Flame Ascent: a second jump in the air
    const g = makeGame();
    const p = g.player;

    run(g, 0.3);
    p.beginForm();
    step(g, [], ['jump']);
    run(g, 0.25);

    const vy0 = p.vy;

    step(g, [], ['jump']);
    check(p.vy < vy0 - 300 && p.ascentT > 0 && p.poseNow() === 'form_jump', 'a second jump in the air rises in the transformed jump pose');

    step(g, [], ['jump']);
    check(p.airJumps === 0, 'there is only the one');
    run(g, 1.2);
    check(p.onGround && p.airJumps === 1, 'and it comes back on landing');
}

{
    // normal form has no double jump
    const g = makeGame();
    const p = g.player;

    run(g, 0.3);
    step(g, [], ['jump']);
    run(g, 0.25);

    const vy0 = p.vy;

    step(g, [], ['jump']);
    check(p.vy >= vy0, 'without the form there is no second jump');
}

{
    // Phantom Clone Dash
    const { g, p, d } = arena(260);

    p.beginForm();
    step(g, [], ['dash']);
    check(p.skill && p.skill.name === 'clonedash', 'the dash is the Phantom Clone Dash');
    check(p.skillInv > 0.3, 'it cannot be hurt during it');

    const x0 = p.x;

    run(g, 0.5);
    check(p.x - x0 > 250, `it covers ground (${Math.round(p.x - x0)} px)`);
    check(d.hits >= 1, 'and cuts what it passes');
    check(p.cd.clone > 0, 'then it needs a moment');

    // Clashing Shadow Slash in the middle of a dash
    const b = arena(200);

    b.p.beginForm();
    step(b.g, [], ['dash']);
    step(b.g, [], ['attack']);
    check(
        (b.p.skill && b.p.skill.name === 'clonedash') || b.p.skill.name === 'clash',
        'a strike in a dash is the Clashing Shadow Slash (or the dash itself, while cloning)',
    );
}

{
    // Clash on its own: dash is the normal Silk Dash only when not transformed, so test it from the Silk Dash's window
    const { g, p, d } = arena(180);

    p.beginForm();
    p.dashWin = 0.15;
    step(g, [], ['attack']);
    check(p.skill && p.skill.name === 'clash', 'inside the dash window a strike is the Clashing Shadow Slash');
    run(g, 0.7);
    check(d.hits >= 2, `it cuts twice (${d.hits} hits)`);
}

{
    // Phantom Grab
    const { g, p, d } = arena(250);

    p.beginForm();
    step(g, ['up'], ['skill']);
    check(p.skill && p.skill.name === 'grab', 'skill and up is the Phantom Grab');

    const x0 = d.x;

    run(g, 0.7);
    check(
        d.x < x0 - 80 && d.hits >= 1 && d.stun > 0,
        `the dummy is dragged in front of the hero (${Math.round(x0 - d.x)} px) and stunned`,
    );

    // nothing in range: it whiffs
    const w = arena(900);

    w.p.beginForm();
    step(w.g, ['up'], ['skill']);
    run(w.g, 0.8);
    check(w.d.hits === 0 && !w.p.skill, 'with nothing in reach it just whiffs');
}

{
    // Ground Eruption
    const { g, p, d } = arena(210);

    p.beginForm();
    step(g, ['down'], ['skill']);
    check(p.skill && p.skill.name === 'erupt', 'skill and down on the ground is the Ground Eruption');
    run(g, 0.4);
    check(g.lances.filter((l) => l.constructor.name === 'Spike').length >= 3, 'spikes burst from the floor in a row');
    run(g, 0.9);
    check(d.hits >= 1, `and the dummy in the row is cut (${d.hits})`);
}

{
    // Ground Pound
    const { g, p, d } = arena(10);

    p.beginForm();
    step(g, [], ['jump']);
    run(g, 0.35, ['jump']);
    step(g, ['down'], ['skill']);
    check(p.skill && p.skill.name === 'pound', 'skill and down in the air is the Ground Pound');

    for (let i = 0; i < 1.5 / DT && p.skill; i++) step(g);

    check(!p.skill && p.onGround && d.hits >= 1, `it plunges, lands and shakes the floor (${d.hits} hit)`);
    check(d.dmg > 2, `hard (${d.dmg.toFixed(2)})`);
}

{
    // Illusion Burst answers a Shadow Step
    const { g, p, d } = arena(120);

    p.beginForm();
    p.perfectDodge(p.cx + 60, {});
    check(p.skill && p.skill.name === 'illusion', 'in the form, a Shadow Step answers with the Illusion Burst');
    run(g, 0.7);
    check(d.hits >= 1 && d.stun > 0, 'it cuts and staggers what is near');

    // in the normal form a Shadow Step is just a Shadow Step, and it fills the gauge
    const n = arena(120);

    n.p.perfectDodge(n.p.cx + 60, {});
    check(!n.p.skill && n.g.state.shade >= 20, `without the form it fills the Shade (${n.g.state.shade})`);

    const m = arena(120);

    m.p.deflect(m.p.cx + 60, {});
    check(m.g.state.shade >= 16, `and so does a parry (${m.g.state.shade})`);
}

{
    // the ultimate
    const { g, p, d } = arena(420);

    p.beginForm();
    step(g, [], ['transform']);
    check(p.skill && p.skill.name === 'ult', 'transform again, in the form, is the Giant Spectral Summon');

    for (let i = 0; i < 2.5 / DT; i++) step(g);

    check(d.dmg >= 8 && d.hits >= 1, `the star lands on the foe it chose (${d.dmg.toFixed(2)})`);
    check(!p.form && !p.skill, 'and it spends the form');
}

{
    // a form about to end cannot call the ultimate; the form ends on its own
    const { g, p } = arena(420);

    p.beginForm();
    p.formT = 2;
    step(g, [], ['transform']);
    check(!p.skill, 'with the form nearly spent there is no ultimate');
    run(g, 2.2);
    check(p.skill && p.skill.name === 'detransform', 'and it falls away into the return');
    run(g, 1);
    check(!p.form && !p.skill && p.poseNow() !== 'transformed', 'the hero is back to the normal form');
}

// ---------------------------------------------------------------- 7. interruptions
console.log('interruptions');

{
    const { g, p } = arena(500);

    g.state.silk = 9;
    step(g, [], ['skill']);
    p.skillInv = 0;
    check(p.hurt(1, p.cx + 40) === true && !p.skill && g.state.hp < 9, 'being hurt ends a skill');

    const f = arena(500);

    f.p.beginForm();
    f.p.formT = 20;
    f.p.hurt(1, f.p.cx + 40);
    check(f.p.formT <= 17, `and costs the form time (${f.p.formT.toFixed(1)} s left)`);

    const s = arena(500);

    s.p.startSkill('transform');
    check(s.p.skillInv > 2 && s.p.hurt(1, s.p.cx + 40) === false, 'a skill that guards the hero turns a blow away');

    const d = arena(500);

    d.p.beginForm();
    d.p.die();
    check(!d.p.form && d.p.state === 'dead', 'dying ends the form');
    run(d.g, 1.5);
    check(['crumple', 'crawl', 'dead'].includes(d.p.poseNow()), 'and plays the fall');

    const q = arena(500);

    q.g.state.silk = 9;
    step(q.g, [], ['skill']);
    q.p.state = 'cutscene';
    step(q.g);
    check(!q.p.skill, 'a sequence takes the hero over a skill');
}

// ---------------------------------------------------------------- 8. drawing
console.log('drawing');

{
    const g = makeGame();
    const p = g.player;
    let drawn = 0;

    run(g, 0.3);

    const all = [
        'transform',
        'detransform',
        'whirl',
        'barrage',
        'charge',
        'void',
        'dashslash',
        'clash',
        'clonedash',
        'grab',
        'erupt',
        'pound',
        'illusion',
        'ult',
    ];

    try {
        for (const name of all) {
            p.beginForm();
            p.startSkill(name);

            for (let i = 0; i < 0.9 / DT; i++) {
                step(g, name === 'charge' ? ['attack'] : []);

                if (i % 5 === 0) {
                    p.draw(sink, 1);
                    p.drawGauge(sink, 10, 150, 1);

                    for (const l of g.lances) l.draw(sink);

                    drawn++;
                }
            }

            p.skill = null;
        }

        p.endForm();
        ok(`all ${all.length} skills drew ${drawn} frames`);

        for (const s of [{ dead: 1 }, { rest: 1 }, { heal: 1 }]) {
            p.state = s.dead ? 'dead' : s.rest ? 'rest' : 'heal';
            p.deathT = 1;
            p.pickAnim();
            p.draw(sink, 1);
        }

        ok('death, rest and heal draw');
    } catch (err) {
        bad('drawing threw: ' + err.stack.split('\n').slice(0, 4).join(' / '));
    }

    // a missing atlas draws nothing, and does not throw
    const saved = BW.Assets.sprite;

    BW.Assets.sprite = () => null;

    try {
        p.state = 'normal';
        p.pickAnim();
        p.draw(sink, 1);
        ok('without the atlas the hero is still drawn');
    } catch (err) {
        bad('fallback drawing threw: ' + err.stack.split('\n').slice(0, 3).join(' / '));
    }

    BW.Assets.sprite = saved;
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall Ronin checks passed');
process.exit(failures ? 1 : 0);

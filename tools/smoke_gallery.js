'use strict';

// Node-only check of the Gallery (pause menu), no browser: node tools/smoke_gallery.js
//
// Loads the real menu and Gallery code with stubbed drawing, audio and input, then opens the Gallery on a fresh save, on a
// save that has seen everything, and on a finished one, and runs its update and draw for every tab and every entry.
// Any throw (the thing that would crash the game) is a failure.
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

const ctx = { console, Math, Date, performance: { now: () => 0 } };

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
BW.Input = new Proxy({ label: () => 'X', pressed: {}, down: {} }, { get: (t, k) => (k in t ? t[k] : sink) });
BW.settings = {};
BW.gfx = { motes: 1 };
BW.FONT_T = 'serif';
BW.FONT_B = 'serif';
BW.glowSprite = () => sink;
BW.Glyphs = sink;
BW.Game = class {};
BW.roundRect = BW.roundRect || (() => {});
BW.wrapText = BW.wrapText || (() => {});
BW.OBJ = {};
BW.ObjBase = class {};
BW.Assets = {
    draw: (c, name) => !!manifest.sprites[name],
    drawImg: () => true,
    sprite: (name) => manifest.sprites[name] || null,
    img: (name) => (manifest.images[name] ? { width: 100, height: 100 } : null),
};
ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

for (const f of [
    'src/save/save.js',
    'src/world/world.js',
    'src/world/rooms.js',
    'src/world/fortress.js',
    'src/world/hushed.js',
    'src/world/hushed_wings.js',
    'src/progression/difficulty.js',
    'src/progression/xp.js',
    'src/progression/codex.js',
    'src/progression/lore.js',
    'src/progression/hushed.js',
    'src/ui/menus.js',
    'src/ui/gallery.js',
]) {
    try {
        load(f);
    } catch (e) {
        bad(`${f} failed to load: ${e.stack.split('\n').slice(0, 3).join(' / ')}`);
        process.exit(1);
    }
}

const M = BW.Menu.prototype;
const states = {};

{
    const base = () => Object.assign(BW.Save.defaults(), { hp: 5, silk: 0 });

    states.fresh = base();

    const seen = base();

    seen.abilities = { parry: true, dash: true, dodge: true };
    seen.visited = {};

    for (const r of BW.ROOM_LIST) seen.visited[r.id] = true;

    seen.codex = { seen: {}, tips: {}, kills: {} };

    for (const b of BW.Codex.BEASTS) seen.codex.seen[b.id] = true;

    seen.flags = {
        odo_met: true,
        ending_seen: true,
        bell1: true,
        bell2: true,
        great_bell: true,
        warden_defeated: true,
        mourner_defeated: true,
    };

    for (const n of BW.Lore.NOTES) seen.flags['note_' + n.id] = true;

    states.everything = seen;
}

for (const [name, st] of Object.entries(states)) {
    console.log(name);

    const data = { tab: 0, i: [0, 0, 0] };

    // the Gallery only borrows a few things from the menu: a plain stand-in with the real Gallery methods
    const menu = {
        game: { state: st, startReplay() {} },
        screen: { name: 'gallery', data },
        t: 1,
        pop() {},
        galleryUpdate: M.galleryUpdate,
        galleryDraw: M.galleryDraw,
        galleryMusic: M.galleryMusic,
    };

    const inp = { pressed: {}, down: {} };
    let drawn = 0;

    try {
        for (let tab = 0; tab < 3; tab++) {
            data.tab = tab;
            data.lists = null;

            const n = (() => {
                menu.galleryUpdate(0.016, inp);

                return data.lists[tab].length;
            })();

            for (let i = 0; i < n; i++) {
                data.i[tab] = i;
                data.ft = 1;
                menu.galleryUpdate(0.016, inp);
                menu.galleryDraw(sink);
                drawn++;
            }
        }

        // confirming every memory just asks the game to replay it
        data.tab = 2;
        inp.pressed.confirm = true;

        for (let i = 0; i < data.lists[2].length; i++) {
            data.i[2] = i;
            menu.galleryUpdate(0.016, inp);
        }

        ok(`${drawn} gallery pages updated and drawn without a throw`);
    } catch (e) {
        bad(`the Gallery throws: ${e.stack.split('\n').slice(0, 4).join(' / ')}`);
    }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall gallery checks passed');
process.exit(failures ? 1 : 0);

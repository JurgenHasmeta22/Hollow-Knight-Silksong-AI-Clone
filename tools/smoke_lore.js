'use strict';

// Node-only checks for the story (THE UNCALLED), no browser: node tools/smoke_lore.js
//
//   * the lore notes (the world's and the Hushed Gallery's) are complete and each stands in a real room
//   * the chapter slides and the region interludes are there
//   * the dark soundtrack: the loops exist, are registered, and the opening, Belfry and ending play them
//     while the calm Hollow and Spindleworks tracks stay
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

const ctx = { console, Math, Date };

ctx.window = ctx;
ctx.BW = undefined;
vm.createContext(ctx);

const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });

load('src/core/core.js');

const BW = ctx.BW;

BW.Audio = {};
BW.Codex = { BEASTS: [], BY_ID: {} };
BW.OBJ = {};
BW.ObjBase = class {};
BW.T = 32;

load('src/progression/lore.js');
load('src/progression/hushed.js');

const L = BW.Lore;

console.log('notes');
check(L.NOTES.length === 34, `${L.NOTES.length} lore notes in the world`);
check(new Set(L.NOTES.map((n) => n.id)).size === L.NOTES.length, 'every note id is unique');

for (const n of L.NOTES) {
    if (!n.title || !n.hint || !n.from || !n.text || !n.text.length || n.text.some((t) => !t) || !n.room)
        bad('note ' + n.id + ' is incomplete');
}

check(true, 'every note has a title, a hint, a voice, text and a room');
check(L.BY_ID.name.text.join(' ').includes('Orrin Vael'), "the Warden's name note tells the tale");
check(
    L.BY_ID.last.when === 'warden_defeated' && L.BY_ID.mournerlast.when === 'mourner_defeated',
    'notes keep the flag that unlocks them',
);

console.log('chapters');
check(L.INTRO.length === 5 && L.INTRO.every((s) => s.title && s.lines.length), 'five chapter slides');
check(
    ['spindle', 'belfry', 'hushed'].every((k) => L.INTERLUDES[k] && L.INTERLUDES[k].lines.length),
    'three region interludes',
);

const game = fs.readFileSync(path.join(ROOT, 'src/game/game.js'), 'utf8');

check(!game.includes('BW.Lore.odo'), 'Odo talk is written out in the game, with no overlay');

console.log('soundtrack');

const music = (() => {
    const c = {};

    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/audio/music.js'), 'utf8'), { window: c });

    return c.BW_MUSIC;
})();

const audio = fs.readFileSync(path.join(ROOT, 'src/audio/audio.js'), 'utf8'),
    dark = /const DARK = \{([^}]*)\}/.exec(audio)[1];

for (const [, from, to] of dark.matchAll(/(\w+):\s*'(\w+)'/g)) {
    const m = music[to],
        file = m && path.join(ROOT, m.src);

    check(!!music[from], `${from} is a track the game already plays`);
    check(m && fs.existsSync(file), `${to} is registered and its file exists`);

    if (m && fs.existsSync(file)) {
        const b = fs.readFileSync(file),
            secs = (b.length - 44) / 2 / b.readUInt32LE(24);

        check(b.toString('ascii', 0, 4) === 'RIFF' && secs > 30, `${to} is a ${secs.toFixed(0)} s loop`);
    }
}

check(
    ['mus_mosslit', 'mus_spindle'].every((k) => music[k] && !dark.includes(k)),
    'the calm Hollow and Spindleworks tracks stay',
);

check(
    music.mus_dark_intro && fs.existsSync(path.join(ROOT, music.mus_dark_intro.src)),
    'the start of a new game has its own track (mus_dark_intro)',
);
check(game.includes("playMusic('mus_dark_intro'"), 'and the intro sequence plays it');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

check(!/bellweaver/i.test(html), 'the loading screen and page no longer say Bellweaver');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall lore checks passed');
process.exit(failures ? 1 : 0);

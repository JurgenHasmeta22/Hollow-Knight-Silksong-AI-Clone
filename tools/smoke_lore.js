'use strict';

// Node-only checks for the Faceless Ronin's story (VEILED KNELL), no browser: node tools/smoke_lore.js
//
//   * every lore note (the world's and the Hushed Gallery's) has a rewritten Ronin version, and nothing else is overridden
//   * Lore.set('ronin') swaps the chapters, interludes and notes, and Lore.set('weaver') restores the original text exactly
//   * every key of Odo's talk is used by Game.talkToOdo, and every line he has is wired
//   * the title, the epilogue and the dark soundtrack (the loops exist, are registered and the theme points at them)
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
const themes = [];

BW.Audio = { setTheme: (h) => themes.push(h) };
BW.Codex = { BEASTS: [], BY_ID: {} };
BW.OBJ = {};
BW.ObjBase = class {};
BW.T = 32;

load('src/progression/lore.js');
load('src/progression/hushed.js');

const L = BW.Lore;
const snap = () => JSON.stringify({ i: L.INTRO, n: L.INTERLUDES, o: L.NOTES });
const original = snap();

load('src/progression/lore_ronin.js');

const R = BW.RoninLore;

console.log('notes');
check(L.NOTES.length >= 34, `${L.NOTES.length} lore notes in the world`);

const missing = L.NOTES.filter((n) => !R.NOTES[n.id]).map((n) => n.id),
    stray = Object.keys(R.NOTES).filter((id) => !L.BY_ID[id]);

check(
    !missing.length,
    'every note has a Ronin version' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''),
);
check(
    !stray.length,
    'no Ronin note without a place in the world' + (stray.length ? ' (' + stray.join(', ') + ')' : ''),
);

console.log('swapping');
L.set('ronin');
check(L.hero === 'ronin' && themes[themes.length - 1] === 'ronin', 'the Ronin sets the story and the soundtrack theme');
check(L.INTRO.length === 5 && L.INTRO[0].title === R.INTRO[0].title, "five chapter slides, the Ronin's");
check(L.INTERLUDES.spindle.title === R.INTERLUDES.spindle.title, "the Spindleworks interlude is the Ronin's");
check(L.INTERLUDES.hushed.title === R.INTERLUDES.hushed.title, "the Hushed Gallery interlude is the Ronin's");
check(L.BY_ID.name.text.join(' ').includes('Orrin Vael'), "the Warden's name note is rewritten");
check(
    L.BY_ID.last.when === 'warden_defeated' && L.BY_ID.mournerlast.when === 'mourner_defeated',
    'notes keep the flag that unlocks them',
);
check(L.BY_ID.ledger.room === 'M1' && L.BY_ID.ledger.x === 16, 'notes keep their place in the world');
check(BW.TITLE.name === 'VEILED KNELL', 'the title is VEILED KNELL');

for (const n of L.NOTES) {
    if (!n.title || !n.hint || !n.from || !n.text || !n.text.length || n.text.some((t) => !t))
        bad('note ' + n.id + ' is incomplete');
}

check(true, 'every note has a title, a hint, a voice and text');

const ronin = snap();

L.set('weaver');
check(snap() === original, "the Bellweaver's text comes back exactly as it was written");
check(
    BW.TITLE.name === 'BELLWEAVER' && themes[themes.length - 1] === 'weaver',
    'and so do the title and the soundtrack',
);
L.set('ronin');
check(snap() === ronin, 'switching back to the Ronin is repeatable');
L.set('weaver');

console.log('Odo');

const game = fs.readFileSync(path.join(ROOT, 'src/game/game.js'), 'utf8'),
    used = [...game.matchAll(/BW\.Lore\.odo\(\s*st,\s*'(\w+)'/g)].map((m) => m[1]),
    have = Object.keys(R.ODO);

check(
    used.length === have.length && used.every((k) => have.includes(k)),
    `${used.length} lines wired, ${have.length} written`,
);
check(L.odo({ character: 'ronin' }, 'met_a', 'orig') === R.ODO.met_a, "a Ronin save hears the Ronin's Odo");
check(L.odo({ character: 'weaver' }, 'met_a', 'orig') === 'orig', 'a Bellweaver save hears the original');
check(L.odo({ character: 'ronin' }, 'nope', 'orig') === 'orig', 'an unknown key falls back to the original');

console.log('ending');
check(
    L.epilogue({ character: 'ronin' }).length === 4 && !L.epilogue({ character: 'weaver' }),
    'the Ronin has its own epilogue, the Bellweaver keeps the original',
);

console.log('soundtrack');

const music = (() => {
    const c = {};

    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/audio/music.js'), 'utf8'), { window: c });

    return c.BW_MUSIC;
})();

const audio = fs.readFileSync(path.join(ROOT, 'src/audio/audio.js'), 'utf8'),
    theme = /THEME_RONIN = \{([^}]*)\}/.exec(audio)[1];

for (const [, from, to] of theme.matchAll(/(\w+):\s*'(\w+)'/g)) {
    const m = music[to],
        file = m && path.join(ROOT, m.src);

    check(!!music[from], `${from} is a track the game already plays`);
    check(m && fs.existsSync(file), `${to} is registered and its file exists`);

    if (m && fs.existsSync(file)) {
        const b = fs.readFileSync(file),
            riff = b.toString('ascii', 0, 4) === 'RIFF',
            rate = b.readUInt32LE(24),
            secs = (b.length - 44) / 2 / rate;

        check(riff && secs > 30, `${to} is a ${secs.toFixed(0)} s loop`);
    }
}

check(
    ['mus_mosslit', 'mus_spindle'].every((k) => music[k] && !theme.includes(k)),
    "the calm Hollow and Spindleworks tracks stay in the Ronin's journey",
);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall lore checks passed');
process.exit(failures ? 1 : 0);

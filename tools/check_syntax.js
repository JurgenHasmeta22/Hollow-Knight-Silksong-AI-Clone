'use strict';

// Compiles every game script without running it: node tools/check_syntax.js
// A stray quote in one file stops that whole file loading in the browser (a crash on the screen it belongs to), and the
// other smoke tests only load the files they need, so run this after every edit.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const dirs = ['src', 'assets/audio', 'tools'];
let bad = 0;
let n = 0;

function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);

        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js') && fs.statSync(p).size < 3e6) {
            n++;

            try {
                new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p });
            } catch (err) {
                bad++;
                console.log('  FAIL ' + path.relative(ROOT, p) + ': ' + err.message);
            }
        }
    }
}

for (const d of dirs) walk(path.join(ROOT, d));

console.log(bad ? `\n${bad} file(s) do not compile` : `all ${n} scripts compile`);
process.exit(bad ? 1 : 0);

'use strict';

// Difficulty presets. The choice lives in the save (state.difficulty) and scales:
//   density  - how many enemies a room holds (1 = as placed in the room; extras are added around them)
//   hp       - enemy health          dmg   - bells lost to a standard enemy hit (see WEIGHTS: heavier blows multiply it)
//   bossHp   - how much the Warden's health bar asks of you (higher = tougher). Plain strikes barely dent it on the
//              harder settings; staggering it (poise) is how the fight is meant to be won.
//   poise    - multiplier on the poise a parry or Shadow Step builds in the Warden (higher = easier)
//   hitPoise - multiplier on the poise plain strikes build (lower = parries and Shadow Steps matter more)
//   bossDmg  - extra weight on the Warden's blows (on top of dmg)
//   dodge    - seconds added to the Shadow Step window (a dash right as a blow lands)
//   reach    - how close (px) a committed strike must be to you for that dash to slip it
//   trap     - damage from thorns and swinging bells (0 = they only push you back to safe ground)
//   speed    - how fast ordinary enemies move and act (the Warden is unaffected)
//   mend     - how long a Mend takes to channel (multiplier)
//   parry    - seconds the parry window stays open (shorter = harder)
//   lock     - cannot be changed later from Options (also gives the menu its blood-red look)
(function (BW) {
    const LEVELS = {
        story: {
            id: 'story',
            name: 'Story',
            desc: 'Most hits take a quarter bell. Thorns and swinging bells never hurt. Enemies are a little frailer. Made for the tale.',
            density: 1,
            hp: 0.75,
            dmg: 0.25,
            bossHp: 0.75,
            poise: 1.2,
            hitPoise: 1,
            bossDmg: 1,
            trap: 0,
            speed: 1,
            mend: 1,
            parry: 0.36,
            dodge: 0.2,
            reach: 160,
        },
        action: {
            id: 'action',
            name: 'Action',
            desc: 'The intended challenge: rooms are a little busier. Most hits take half a bell; heavy blows take more.       The Warden is a hardy foe that barely notices plain strikes: build its poise with parries and Shadow Steps, and a staggered Warden takes huge damage.',
            density: 1.25,
            hp: 1,
            dmg: 0.5,
            bossHp: 2.1,
            poise: 1,
            hitPoise: 0.6,
            bossDmg: 1.25,
            trap: 1,
            speed: 1,
            mend: 1,
            parry: 0.32,
            dodge: 0.18,
            reach: 135,
        },
        nightmare: {
            id: 'nightmare',
            name: 'Nightmare',
            lock: true,
            desc: 'Packed rooms and tougher, faster enemies. Every hit takes a full bell and heavy blows take more.       The Warden is enormously tough and hits harder: only staggering it through poise will bring it down. Mending is slow and parries are tight. It can never be changed once chosen.',
            density: 3,
            hp: 1.75,
            dmg: 1,
            bossHp: 3.6,
            poise: 0.9,
            hitPoise: 0.3,
            bossDmg: 1.25,
            trap: 2,
            speed: 1.2,
            mend: 1.4,
            parry: 0.2,
            dodge: 0.08,
            reach: 90,
        },
    };

    const ORDER = ['story', 'action', 'nightmare'];
    const DEFAULT = 'action';

    // Ground enemies: height in tiles. Flyers hover in free air. Hanging spitters and the Warden are never duplicated.
    const GROUND_H = { crawler: 1, spitter: 1, hopper: 2, sentinel: 2 };

    // How hard each kind of blow lands, as a multiple of the difficulty's base hit (dmg). Slow, telegraphed
    // attacks you can read and parry hit harder than the cheap ones. "during" lists the states that count as the
    // creature's committed strike; any other contact is the lighter "body" weight. Pale variants strike harder.
    const WEIGHTS = {
        crawler: { body: 1, strike: 1, during: ['lunge'] },
        flyer: { body: 0.5, strike: 1, during: ['dive'] },
        sentinel: { body: 1, strike: 2, during: ['thrust'] },
        hopper: { body: 1, strike: 1.5, during: ['leap'] },
        spitter: { body: 0.5, strike: 1, during: [] }, // its strike is the silk glob (see glob)
        glob: 1,
        warden: {
            body: 1,
            sweep: 1,
            slam: 1.5,
            leap_land: 1.5,
            charge: 1.5,
            shockwave: 1,
            peal: 1,
            rain: 1,
            debris: 0.5,
            eruption: 1,
            rim: 1,
            orb: 1,
        },
    };

    const Difficulty = {
        LEVELS,
        ORDER,
        DEFAULT,
        WEIGHTS,

        // Weight of the blow an enemy is dealing right now (the Warden overrides this on the instance)
        weightOf(e) {
            if (e.hitWeight) return e.hitWeight();

            const W = WEIGHTS[e.kind];

            if (!W) return 1;
            if (W.during.indexOf(e.state) < 0) return W.body;

            return Math.min(2, W.strike + (e.variant === 'pale' ? 0.5 : 0));
        },
        // Bells lost to a blow of the given weight, in quarter-bell steps (never less than a quarter)
        hit(state, weight) {
            return Math.max(0.25, Math.round(weight * this.get(state).dmg * 4) / 4);
        },
        // The same for display: what a creature's committed strike costs on this save's difficulty
        strikeCost(state, kind) {
            const W = WEIGHTS[kind];

            return this.hit(state, W ? W.strike : 1);
        },
        fmtBells(n) {
            return n === 0.25
                ? '\u00BC bell'
                : n === 0.5
                  ? '\u00BD bell'
                  : n === 0.75
                    ? '\u00BE bell'
                    : n === 1
                      ? '1 bell'
                      : (n % 1 === 0.5 ? Math.floor(n) + '\u00BD' : String(n)) + ' bells';
        },
        get(state) {
            return LEVELS[state && state.difficulty] || LEVELS[DEFAULT];
        },
        valid(id) {
            return !!LEVELS[id];
        },

        scaleHp(game, hp) {
            return Math.max(1, Math.round(hp * this.get(game.state).hp));
        },

        // Extra enemy placements for a room. Deterministic per room + difficulty, so cleared-enemy keys stay stable.
        extras(room, flags, state) {
            const D = this.get(state),
                want = D.density - 1;

            const def = room.def;

            if (want <= 0 || def.ents.some((e) => BW.BOSS_TYPES[e.type])) return [];

            const rng = BW.seeded(BW.hashStr(def.id + ':' + D.id));
            const taken = [];
            const keepAway = []; // lanterns and the spawn point stay calm

            for (const e of def.ents) {
                if (BW.ENEMY_TYPES[e.type]) taken.push(e);
                else if (e.type === 'lantern' || e.type === 'spawn') keepAway.push(e);
            }

            const out = [];

            def.ents.forEach((e) => {
                if (!BW.ENEMY_TYPES[e.type] || e.hang || (e.when && !flags[e.when]) || (e.unless && flags[e.unless]))
                    return;

                let n = Math.floor(want) + (rng() < want - Math.floor(want) ? 1 : 0);

                if (n <= 0) return;

                const spots = this.spots(room, e, taken, keepAway);

                while (n-- > 0 && spots.length) {
                    const s = spots.splice(Math.floor(rng() * spots.length), 1)[0];

                    const clone = Object.assign({}, e, {
                        x: s.x,
                        y: s.y,
                        facing: rng() < 0.5 ? -1 : 1,
                        extra: out.length + 1,
                    });

                    out.push(clone);
                    taken.push(clone);

                    for (let i = spots.length - 1; i >= 0; i--)
                        if (Math.hypot(spots[i].x - s.x, spots[i].y - s.y) < 4) spots.splice(i, 1);
                }
            });

            return out;
        },

        // Free standing (or hovering) tiles within reach of an original placement.
        spots(room, e, taken, keepAway) {
            const R = 14,
                flyer = e.type === 'flyer',
                hT = GROUND_H[e.type] || 1;

            const out = [];
            const free = (x, y) => room.raw(x, y) === '.';

            for (let y = Math.max(4, e.y - 8); y <= Math.min(room.h - 5, e.y + 8); y++) {
                for (let x = Math.max(4, e.x - R); x <= Math.min(room.w - 5, e.x + R); x++) {
                    if (Math.hypot(x - e.x, y - e.y) > R || Math.hypot(x - e.x, y - e.y) < 4) continue;

                    let ok = true;

                    for (let dx = -1; dx <= 1 && ok; dx++) {
                        if (flyer) {
                            for (let dy = -1; dy <= 1; dy++)
                                if (!free(x + dx, y + dy)) {
                                    ok = false;
                                    break;
                                }
                        } else {
                            for (let dy = 0; dy < hT; dy++)
                                if (!free(x + dx, y - dy)) {
                                    ok = false;
                                    break;
                                }

                            const g = room.raw(x + dx, y + 1);

                            if (g !== '#' && g !== '=') ok = false;
                        }
                    }

                    if (!ok) continue;
                    if (taken.some((o) => Math.hypot(o.x - x, o.y - y) < 4)) continue;
                    if (keepAway.some((o) => Math.hypot(o.x - x, o.y - y) < 8)) continue;

                    out.push({ x, y });
                }
            }

            return out;
        },
    };

    BW.Difficulty = Difficulty;
})(window.BW);

'use strict';

// The Healing Gourd and the quick items, in the spirit of Sekiro's gourd and prosthetic tools.
//
//   Gourd    three draughts at the start (more with Deep Gourd), each mends two bells (three with Sweet Gourd). It fills
//            again at every lantern and when you wake after a death. state.gourd is the draughts left.
//   Items    four tools carried in the satchel (state.items: id -> count) with one selected (state.quick). R uses the
//            selected one (hold it to cycle, or press T); Odo sells more for glints, and fallen foes drop them now and then.
(function (BW) {
    const S = () => BW.Skills;

    const GOURD = {
        base: 3,
        heal: 2,
        max(st) {
            return this.base + S().mod(st, 'gourdMax');
        },
        potency(st) {
            return this.heal + S().mod(st, 'gourdHeal');
        },
        left(st) {
            return Math.min(st.gourd == null ? this.max(st) : st.gourd, this.max(st));
        },
        refill(st) {
            st.gourd = this.max(st);
        },
        // one draught: returns the bells mended (0 when empty or already whole)
        drink(st) {
            if (this.left(st) <= 0 || st.hp >= st.maxHp) return 0;

            st.gourd = this.left(st) - 1;

            const before = st.hp;

            st.hp = Math.min(st.maxHp, st.hp + this.potency(st));

            return st.hp - before;
        },
    };

    // use(g, p): what it does. A tool that cannot do anything useful right now returns false and is not spent.
    const DEFS = {
        charge: {
            id: 'charge',
            name: 'Toll Charge',
            desc: 'A hand-cast bell charge. It bursts, stuns every foe near you and chips whatever stands in it.',
            price: 60,
            max: 6,
            start: 3,
            use(g, p) {
                const r = 250;

                g.fx.ring(p.cx, p.cy, 10, r * 1.2, 0.5, '#ffd98a', 6);
                g.fx.ring(p.cx, p.cy, 6, r * 0.7, 0.35, '#ffffff', 3);
                g.fx.flash('#ffe9b0', 0.18);
                g.fx.shake(8, 0.3);
                BW.Audio.play('bellfar', { pitch: 196, vol: 0.9, minGap: 0 });
                BW.Audio.play('combohit', { vol: 0.7, rate: 1.3, minGap: 0 });

                const box = { x: p.cx - r, y: p.cy - r * 0.7, w: r * 2, h: r * 1.2 };

                p.strikeAt(box, 0.9, new Set(), 'side');

                for (const e of g.enemies) {
                    if (e.dead || Math.hypot(e.cx - p.cx, e.cy - p.cy) > r * 1.2) continue;

                    if (!(BW.BOSS_TYPES && BW.BOSS_TYPES[e.kind])) {
                        e.stun = Math.max(e.stun || 0, 1.8);
                        e.frozenT = Math.max(e.frozenT || 0, 0.8);
                    }
                }

                return true;
            },
        },
        shards: {
            id: 'shards',
            name: 'Shard Fan',
            desc: 'Throw a fan of three bell shards. They pass through everything they cut.',
            price: 40,
            max: 10,
            start: 5,
            use(g, p) {
                const f = p.facing;

                for (const a of [-0.14, 0, 0.14])
                    g.lances.push(
                        new BW.RoninFx.Crescent(
                            g,
                            p.cx + f * 30,
                            p.cy - 10,
                            Math.cos(a) * f * 1050,
                            Math.sin(a) * 1050,
                            {
                                size: 0.55,
                                mul: 0.75,
                                life: 0.7,
                            },
                        ),
                    );

                p.vx = -f * 90;
                BW.Audio.play('bladedual', { vol: 0.6, rate: 1.5, minGap: 0 });
                g.fx.burst(p.cx + f * 34, p.cy - 10, 8, {
                    color: ['#cfe0ff', '#ffffff'],
                    kind: 'spark',
                    speed: 300,
                    life: 0.25,
                });

                return true;
            },
        },
        veil: {
            id: 'veil',
            name: 'Ash Veil',
            desc: 'A burst of ash: nothing can touch you for a moment.',
            price: 80,
            max: 4,
            start: 2,
            use(g, p) {
                p.skillInv = Math.max(p.skillInv, 1.5);
                p.veilT = 1.5;
                BW.Audio.play('shrine', { vol: 0.55, rate: 1.5, minGap: 0 });
                g.fx.ring(p.cx, p.cy, 8, 120, 0.4, '#9a9aa8', 5);
                g.fx.burst(p.cx, p.cy, 26, {
                    color: ['#2a2a34', '#5a5a68', '#9a9aa8'],
                    kind: 'glow',
                    speed: 220,
                    life: 0.9,
                    size: 10,
                });

                return true;
            },
        },
        draught: {
            id: 'draught',
            name: 'Rage Draught',
            desc: 'A bitter draught: every blow hits 25% harder for twenty seconds.',
            price: 120,
            max: 3,
            start: 1,
            use(g, p) {
                if (p.rageT > 0) return false;

                p.rageT = 20;
                BW.Audio.play('heal_start', { vol: 0.8, rate: 0.7, minGap: 0 });
                g.fx.ring(p.cx, p.cy, 10, 110, 0.5, '#ff5a4a', 4);
                g.fx.burst(p.cx, p.cy, 18, {
                    color: ['#ff5a4a', '#ffb25a'],
                    kind: 'glow',
                    speed: 200,
                    life: 0.7,
                    add: true,
                    size: 8,
                });

                return true;
            },
        },
    };

    const ORDER = ['charge', 'shards', 'veil', 'draught'];

    const Items = {
        DEFS,
        ORDER,
        GOURD,
        cap(st, id) {
            return DEFS[id].max + S().mod(st, 'satchel');
        },
        count(st, id) {
            return (st.items && st.items[id]) | 0;
        },
        add(st, id, n = 1) {
            st.items = st.items || {};

            const had = this.count(st, id);

            st.items[id] = Math.min(this.cap(st, id), had + n);

            return st.items[id] - had;
        },
        // the starting satchel
        starter() {
            const o = {};

            for (const id of ORDER) o[id] = DEFS[id].start;

            return o;
        },
        // the next carried item after the selected one (items you hold none of are skipped, if any other is held)
        cycle(st) {
            const i = ORDER.indexOf(st.quick),
                have = ORDER.filter((id) => this.count(st, id) > 0);

            const pool = have.length ? have : ORDER;

            for (let k = 1; k <= ORDER.length; k++) {
                const id = ORDER[(i + k + ORDER.length) % ORDER.length];

                if (pool.includes(id)) return id;
            }

            return st.quick;
        },
        // use the selected item; returns true when it was spent
        use(g, p) {
            const st = g.state,
                id = st.quick,
                d = DEFS[id];

            if (!d || this.count(st, id) <= 0) return false;
            if (!d.use(g, p)) return false;

            st.items[id]--;
            g.hud.pulse('item');

            return true;
        },
        // a fallen foe may drop something small
        drop(st, rng = Math.random) {
            if (rng() > 0.1) return null;

            const id = ORDER[Math.floor(rng() * ORDER.length)];

            return this.add(st, id, 1) ? id : null;
        },
        unlockAll(st) {
            st.items = {};

            for (const id of ORDER) st.items[id] = this.cap(st, id);

            st.quick = st.quick || ORDER[0];
            GOURD.refill(st);
        },
    };

    BW.Items = Items;
    BW.Gourd = GOURD;
})(window.BW);

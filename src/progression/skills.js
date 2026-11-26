'use strict';

// The skill tree. Three branches (Blade, Shade, Resolve) of learnable skills and passives, paid for with skill points.
// Points come from rising a level and from the great foes; what is learned lives in state.skills (id -> true).
//
//   BW.Skills.has(st, id)      is it learned?
//   BW.Skills.mod(st, key)     the sum of one passive's bonuses over everything learned
//   BW.Skills.points(st)       {earned, spent, free}
//   BW.Skills.learn(g, id)     learn a node (spends points; returns true)
//   BW.Skills.unlockAll(st)    for the test saves
(function (BW) {
    // at: [column, row] on the tree screen. `unlock` names a move the Ronin only has once the node is learned;
    // `fx` is a passive bonus (see mod).
    const NODES = [
        // ---- Blade: the sword
        {
            id: 'edge',
            branch: 'blade',
            at: [0, 0],
            name: 'Whetted Edge',
            desc: 'Every blow hits 12% harder.',
            cost: 1,
            fx: { dmg: 0.12 },
        },
        {
            id: 'flow',
            branch: 'blade',
            at: [0, 1],
            req: 'edge',
            name: 'Flowing Strikes',
            desc: 'The combo window opens 0.15 s longer, so chains are easier to keep alive.',
            cost: 1,
            fx: { combo: 0.15 },
        },
        {
            id: 'dashslash',
            branch: 'blade',
            at: [0, 2],
            req: 'flow',
            name: 'Dash Slash',
            desc: 'Strike in the middle of a dash for a lunging cut (a Clashing Shadow Slash once transformed).',
            cost: 1,
            unlock: 'dashslash',
        },
        {
            id: 'void',
            branch: 'blade',
            at: [0, 3],
            req: 'edge',
            name: 'Void Slash',
            desc: 'Hold the strike button, release when the aura closes: a huge arc and a wave that carries on.',
            cost: 2,
            unlock: 'void',
        },
        {
            id: 'barrage',
            branch: 'blade',
            at: [0, 4],
            req: 'flow',
            name: 'Energy Barrage',
            desc: 'Throw a black crescent from the blade (five in a fan while transformed).',
            cost: 2,
            unlock: 'barrage',
        },

        // ---- Shade: the burning form
        {
            id: 'whirl',
            branch: 'shade',
            at: [1, 0],
            name: 'Whirlwind Dash',
            desc: 'A spinning run that cuts everything it passes.',
            cost: 1,
            unlock: 'whirl',
        },
        {
            id: 'quicken',
            branch: 'shade',
            at: [1, 1],
            name: 'Quickening',
            desc: 'The Shade gauge fills 30% faster.',
            cost: 1,
            fx: { shadeGain: 0.3 },
        },
        {
            id: 'linger',
            branch: 'shade',
            at: [1, 2],
            req: 'quicken',
            name: 'Lingering Shade',
            desc: 'The transformation lasts 6 seconds longer.',
            cost: 2,
            fx: { formTime: 6 },
        },
        {
            id: 'burn',
            branch: 'shade',
            at: [1, 3],
            req: 'linger',
            name: 'Burning Shade',
            desc: 'Transformed blows hit 15% harder.',
            cost: 2,
            fx: { formDmg: 0.15 },
        },
        {
            id: 'giant',
            branch: 'shade',
            at: [1, 4],
            req: 'burn',
            name: 'Giant Spectral Summon',
            desc: 'Call the ultimate while transformed: a spectral giant and a falling star. It spends the form.',
            cost: 2,
            unlock: 'ult',
        },

        // ---- Resolve: the gourd, the guard and the satchel
        {
            id: 'gourd1',
            branch: 'resolve',
            at: [2, 0],
            name: 'Deep Gourd',
            desc: 'The Healing Gourd holds one more draught (4).',
            cost: 1,
            fx: { gourdMax: 1 },
        },
        {
            id: 'gourd2',
            branch: 'resolve',
            at: [2, 1],
            req: 'gourd1',
            name: 'Sweet Gourd',
            desc: 'Each draught mends three bells instead of two.',
            cost: 2,
            fx: { gourdHeal: 1 },
        },
        {
            id: 'guard',
            branch: 'resolve',
            at: [2, 2],
            name: 'Steady Guard',
            desc: 'The parry window is 25% wider.',
            cost: 1,
            fx: { parry: 0.25 },
        },
        {
            id: 'satchel',
            branch: 'resolve',
            at: [2, 3],
            name: 'Deep Satchel',
            desc: 'Carry two more of every quick item.',
            cost: 1,
            fx: { satchel: 2 },
        },
        {
            id: 'iron',
            branch: 'resolve',
            at: [2, 4],
            req: 'guard',
            name: 'Iron Resolve',
            desc: 'One more bell of health, for good.',
            cost: 2,
            fx: {},
        },
    ];

    const BY_ID = {};

    for (const n of NODES) BY_ID[n.id] = n;

    const BRANCHES = [
        { id: 'blade', name: 'Blade', col: 0, color: '#cfe0ff' },
        { id: 'shade', name: 'Shade', col: 1, color: '#ff8a7a' },
        { id: 'resolve', name: 'Resolve', col: 2, color: '#ffd98a' },
    ];

    const Skills = {
        NODES,
        BY_ID,
        BRANCHES,
        has(st, id) {
            return !!(st && st.skills && st.skills[id]);
        },
        mod(st, key) {
            let sum = 0;

            for (const n of NODES) if (n.fx && n.fx[key] && this.has(st, n.id)) sum += n.fx[key];

            return sum;
        },
        // a move gated behind a node: true when the node that unlocks it is learned
        unlocked(st, move) {
            for (const n of NODES) if (n.unlock === move) return this.has(st, n.id);

            return true;
        },
        points(st) {
            const f = (st && st.flags) || {};
            const earned =
                Math.max(0, BW.XP.level(st && st.xp) - 1) + (f.warden_defeated ? 2 : 0) + (f.mourner_defeated ? 2 : 0);

            let spent = 0;

            for (const n of NODES) if (this.has(st, n.id)) spent += n.cost;

            return { earned, spent, free: Math.max(0, earned - spent) };
        },
        // 'learned' | 'open' (can be bought now) | 'afford' (open, but too few points) | 'locked' (a requirement is missing)
        status(st, id) {
            const n = BY_ID[id];

            if (this.has(st, id)) return 'learned';
            if (n.req && !this.has(st, n.req)) return 'locked';

            return this.points(st).free >= n.cost ? 'open' : 'afford';
        },
        learn(g, id) {
            const st = g.state,
                n = BY_ID[id];

            if (!n || this.status(st, id) !== 'open') return false;

            st.skills = st.skills || {};
            st.skills[id] = true;

            if (id === 'iron') {
                st.maxHp = Math.min(12, st.maxHp + 1);
                st.hp = Math.min(st.maxHp, st.hp + 1);
            }

            BW.Audio.play('shrine', { vol: 0.5, minGap: 0 });
            g.saveGame();

            return true;
        },
        unlockAll(st) {
            st.skills = {};

            for (const n of NODES) st.skills[n.id] = true;
        },
    };

    BW.Skills = Skills;
})(window.BW);

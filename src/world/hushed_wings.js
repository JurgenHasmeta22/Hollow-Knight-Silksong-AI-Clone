'use strict';

// The Hushed Gallery's wings: ten more rooms that hang off the spine in src/world/hushed.js and ask you to come back.
//
//   The Cloister (north, above the aisle)       N3 The Unrung Choir -> N2 The Bellwrights' Walk -> N1 The Cutter's Loft
//     Reached by the column of light above the Candlelit Aisle (H5), so only after the Muffled Belfry's three bells.
//     N2 is the ordered-bells puzzle (deepest voice first). N1 holds the Mourners' Shears and drops back to H2, H3 and H4.
//   The Underveil (south, under the Mask Crypt)  U1 The Ossuary Stair -> U2 Hall of Folded Cloth -> U3 The Pallbearers' Rest
//                                                 -> U4 The Reliquary of Bells
//     Entered through a hatch of thick mourning cloth in H3 that only the Shears can cut. Three bells (one in the Cloister,
//     two here) sing together to part the veil into the Reliquary.
//   The Cells (three small chambers)             K1 under H1, K2 under H2, K3 under H6, each behind another cloth hatch.
//
// Standing rows are `floor - 1`. Every climb is built in hops of at most three rows, so none of it needs the dash.
(function (BW) {
    const R = BW.defineRoom;
    const { prop, veil, candles, pillar, window_ } = BW.HG;
    const AREA = 'hushed';

    // veils from the ceiling, pillars, windows and candles along a hall (`stand` is the walking row)
    const dress = (r, o) => {
        for (let x = o.x0; x <= o.x1; x += o.gap || 5) veil(r, x, o.ceil, 380 + ((x * 7) % 5) * 30, { alpha: 0.9 });

        for (const x of o.pillars || []) pillar(r, x, o.stand + 1, o.size || 440);

        for (const x of o.windows || []) window_(r, x, o.stand - 8, 300);

        for (const x of o.candles || []) candles(r, x, o.stand + 1, 92);

        for (const x of o.statues || []) prop(r, 'statue', x, o.stand + 1, 230, x % 2 ? { flip: true } : undefined);

        for (const x of o.masks || []) prop(r, 'masks', x, o.stand - 12, 120, { alpha: 0.85 });

        for (const x of o.piles || []) prop(r, 'maskpile', x, o.stand + 1, 80, { alpha: 0.8 });
    };

    // ================================================================ THE CLOISTER
    // ---------------------------------------------------------------- N3 The Unrung Choir
    // The column of light from the aisle ends in the middle of the floor. West: the way on. East: a climb to a Lifethread.
    R({ id: 'N3', area: AREA, name: 'The Unrung Choir', x: 714, y: 8, w: 60, h: 36 }, (r) => {
        r.air(0, 27, 1, 30); // west -> N2
        r.air(2, 6, 57, 30); // the choir
        r.air(34, 32, 43, 35); // the column of light from the Candlelit Aisle below (H5)
        r.plat(34, 43, 31);
        r.plat(34, 38, 34);

        // the east wall climb: a Lifethread at the top
        r.plat(46, 49, 28);
        r.plat(51, 54, 25);
        r.plat(46, 49, 22);
        r.plat(51, 54, 19);
        r.plat(46, 49, 16);
        r.plat(51, 54, 13);
        r.plat(46, 49, 10);

        // the west ledge: one of the three bells that sing together
        r.plat(10, 13, 28);
        r.plat(15, 19, 25);

        r.ent('lantern', 8, 30, { id: 'lan_n3' });
        r.ent('silentbell', 17, 24, { id: 'n3v', gate: 'hb_voices', group: 'voices', pitch: 110 });
        r.ent('pickup', 47, 9, { kind: 'lifethread', id: 'life_n3' });

        r.ent('stilt', 24, 30);
        r.ent('hushling', 30, 30);
        r.ent('hushling', 52, 30);
        r.ent('drifter', 41, 14);
        r.ent('drifter', 22, 12);
        r.ent('glint', 12, 27, { id: 'g_n3a', n: 6 });
        r.ent('glint', 53, 24, { id: 'g_n3b', n: 6 });
        r.ent('glint', 56, 30, { id: 'g_n3c', n: 5 });

        r.ent('hint', 14, 30, {
            act: 'attack',
            text: 'A bell sits on the ledge above. Two more sing in the Underveil below.',
            range: 5,
            when: 'shears',
        });

        r.ent('sign', 5, 30, {
            title: 'The Unrung Choir',
            text: [
                'A hall built for a hundred voices, and not one of them was ever allowed to sing.',
                'Three bells were tuned to answer each other across the Gallery: one here, two in the cellars far below. Unwrap all three and a veil that has never parted will part.',
            ],
        });

        dress(r, {
            x0: 4,
            x1: 56,
            ceil: 6,
            stand: 30,
            pillars: [14, 29, 57],
            windows: [24, 50],
            candles: [6, 20, 32],
            statues: [3, 55],
            masks: [38],
        });
        r.light(38, 18, 10, '#cfeaff', { a: 0.3 });
        r.light(38, 30, 7, '#9fd8ff', { a: 0.35 });
    });

    // ---------------------------------------------------------------- N2 The Bellwrights' Walk
    // The ordered-bells puzzle: four bells, four voices, and the right order is the order of their pitch.
    R({ id: 'N2', area: AREA, name: 'The Bellwrights’ Walk', x: 654, y: 8, w: 60, h: 36 }, (r) => {
        r.air(0, 27, 0, 30); // west -> N1, behind the veil gate
        r.air(1, 6, 58, 30); // the walk
        r.air(59, 27, 59, 30); // east <- N3
        r.gate(1, 27, 2, 30, 'hb_n2', { kind: 'veil' });

        // a pit with thorns, crossed on stepping stones
        r.air(28, 31, 40, 34);
        r.thorns(28, 40, 35);
        r.plat(30, 31, 30);
        r.plat(34, 35, 30);
        r.plat(38, 39, 30);

        // a gap in the floor above H4's shaft: a way back down to the Belfry's lantern
        r.air(46, 31, 48, 35);

        // west cluster, mid-west cluster, east cluster
        r.plat(4, 7, 28);
        r.plat(9, 13, 25);
        r.plat(17, 20, 28);
        r.plat(22, 26, 25);
        r.plat(50, 53, 28);
        r.plat(45, 49, 25);
        r.plat(50, 53, 22);
        r.plat(45, 49, 19);

        // the four bells: order 1 is the deepest voice, order 4 the brightest. They are spread to be found, not read off.
        r.ent('silentbell', 56, 30, { id: 'n2a', gate: 'hb_n2', group: 'n2', order: 1, pitch: 98 });
        r.ent('silentbell', 11, 24, { id: 'n2b', gate: 'hb_n2', group: 'n2', order: 2, pitch: 123.5 });
        r.ent('silentbell', 47, 18, { id: 'n2c', gate: 'hb_n2', group: 'n2', order: 3, pitch: 146.8 });
        r.ent('silentbell', 24, 24, { id: 'n2d', gate: 'hb_n2', group: 'n2', order: 4, pitch: 196 });

        r.ent('hushling', 14, 30);
        r.ent('hushling', 44, 30);
        r.ent('stilt', 52, 30);
        r.ent('drifter', 36, 14);
        r.ent('drifter', 16, 11);
        r.ent('glint', 10, 27, { id: 'g_n2a', n: 5 });
        r.ent('glint', 32, 29, { id: 'g_n2b', n: 4 });
        r.ent('glint', 50, 21, { id: 'g_n2c', n: 6 });

        r.ent('hint', 8, 30, {
            act: 'attack',
            text: 'Four bells. Ring them deepest voice first. A wrong toll pulls every cloth tight.',
            range: 7,
        });

        r.ent('sign', 5, 30, {
            title: 'The Bellwrights’ Rule',
            text: [
                'FOUR BELLS, FOUR VOICES. THE CLOTH REMEMBERS THE SCALE.',
                'Ring them from the deepest to the highest. Strike one out of turn and the cloth pulls tight on all four, and every Hushed in the walk will hear it.',
                'The veil at the west end is the Cutter’s door, and it opens only to a whole scale.',
            ],
        });

        dress(r, {
            x0: 4,
            x1: 56,
            ceil: 6,
            stand: 30,
            pillars: [9, 26, 43, 57],
            windows: [20, 36],
            candles: [14, 40],
            statues: [3],
            piles: [6, 53],
        });
        r.light(38, 18, 10, '#cfeaff', { a: 0.28 });
    });

    // ---------------------------------------------------------------- N1 The Cutter's Loft
    // The Mourners' Shears on their altar. Two gaps in the floor drop back to H2 and H3.
    R({ id: 'N1', area: AREA, name: 'The Cutter’s Loft', x: 594, y: 8, w: 60, h: 36 }, (r) => {
        r.air(59, 27, 59, 30); // east <- N2
        r.air(1, 6, 58, 30); // the loft
        r.air(6, 31, 9, 35); // a drop to the Hall of Hanging Veils (H2)
        r.air(40, 31, 43, 35); // a drop to the Mask Crypt (H3)

        // the loft climb to a cache
        r.plat(46, 49, 28);
        r.plat(51, 54, 25);
        r.plat(46, 49, 22);
        r.plat(51, 54, 19);
        r.plat(46, 49, 16);

        r.ent('lantern', 54, 30, { id: 'lan_n1' });
        r.ent('relicaltar', 22, 30, { relic: 'shears' });
        r.ent('cache', 47, 15, { id: 'gc_n1', n: 45 });

        r.ent('brute', 31, 30);
        r.ent('hushling', 14, 30);
        r.ent('hushling', 48, 30);
        r.ent('drifter', 34, 13);
        r.ent('drifter', 12, 10);
        r.ent('glint', 25, 29, { id: 'g_n1a', n: 6 });
        r.ent('glint', 50, 24, { id: 'g_n1b', n: 5 });

        r.ent('sign', 16, 30, {
            title: 'The Cutter’s Bench',
            text: [
                'Here the veils were cut to length and the cloth that bound the Gallery’s doors was hemmed.',
                'The shears were left on the altar when the last cutter went quiet. They are still sharp.',
            ],
        });

        r.ent('sign', 38, 30, {
            title: 'Two Gaps',
            text: [
                'The floor is open here on purpose. The cutters dropped their offcuts through to the halls below.',
                'West: down to the Hall of Hanging Veils. Here: down to the Mask Crypt.',
            ],
            small: true,
        });

        dress(r, {
            x0: 4,
            x1: 56,
            ceil: 6,
            stand: 30,
            pillars: [3, 20, 34, 57],
            windows: [12, 28],
            candles: [18, 26, 52],
            statues: [11],
            piles: [29, 45],
        });
        r.light(22, 22, 8, '#9fd8ff', { a: 0.4 });
    });

    // ================================================================ THE UNDERVEIL
    // ---------------------------------------------------------------- U1 The Ossuary Stair
    // Drop through the cut hatch in the Mask Crypt and climb back out in hops of three: the stair is the way home.
    R({ id: 'U1', area: AREA, name: 'The Ossuary Stair', x: 622, y: 88, w: 52, h: 40 }, (r) => {
        r.air(2, 3, 49, 35); // the stair hall
        r.air(33, 0, 36, 2); // up -> the hatch in the Mask Crypt (H3)
        r.plat(33, 36, 0);
        r.air(50, 32, 51, 35); // east -> U2

        // the ladder: five wide, three rows apart, left and right
        const L = [28, 32],
            Rt = [34, 38];

        const rungs = [
            [3, L],
            [6, Rt],
            [9, L],
            [12, Rt],
            [15, L],
            [18, Rt],
            [21, L],
            [24, Rt],
            [27, L],
            [30, Rt],
            [33, L],
        ];

        for (const [row, [x0, x1]] of rungs) r.plat(x0, x1, row);

        // beams to hang the Reachers from
        r.solid(2, 14, 16, 14);
        r.solid(40, 20, 49, 20);

        r.ent('lantern', 46, 35, { id: 'lan_u1' });
        r.ent('reacher', 10, 14, { hang: 1 });
        r.ent('reacher', 44, 20, { hang: 1 });
        r.ent('stilt', 14, 35);
        r.ent('hushling', 24, 35);
        r.ent('hushling', 40, 35);
        r.ent('drifter', 26, 20);
        r.ent('glint', 6, 34, { id: 'g_u1a', n: 6 });
        r.ent('glint', 41, 23, { id: 'g_u1b', n: 5 });
        r.ent('cache', 4, 35, { id: 'gc_u1', n: 40 });

        r.ent('sign', 42, 35, {
            title: 'Ossuary Stair',
            text: [
                'The mourners carried their dead down here by hand, one step at a time, so that none would be dropped.',
                'The stair is narrow. It was never meant to be climbed by anyone still living.',
            ],
        });

        dress(r, {
            x0: 4,
            x1: 48,
            ceil: 3,
            stand: 35,
            pillars: [3, 25, 47],
            windows: [14],
            candles: [8, 30, 44],
            piles: [18, 36],
            masks: [20],
        });
        r.light(35, 14, 10, '#9fd8ff', { a: 0.25 });
    });

    // ---------------------------------------------------------------- U2 Hall of Folded Cloth
    // A shuttle across a pit of thorns, and the second of the three bells that sing together beyond it.
    R({ id: 'U2', area: AREA, name: 'Hall of Folded Cloth', x: 674, y: 92, w: 64, h: 36 }, (r) => {
        r.air(0, 28, 0, 31); // west <- U1
        r.air(1, 4, 62, 31); // the hall
        r.air(63, 28, 63, 31); // east -> U3

        // a pit with thorns, crossed on a black shuttle
        r.air(24, 32, 39, 34);
        r.thorns(24, 39, 35);
        r.ent('mover', 24, 32, { id: 'u2_mover', w: 4, ax: 24, bx: 36, ay: 32, by: 32, speed: 100 });

        // a high ledge over the pit, reached from the far side
        r.plat(44, 47, 29);
        r.plat(49, 53, 26);
        r.plat(44, 47, 23);

        r.ent('silentbell', 55, 31, { id: 'u2v', gate: 'hb_voices', group: 'voices', pitch: 130.8 });
        r.ent('cache', 45, 22, { id: 'gc_u2', n: 40 });

        r.ent('hushling', 10, 31);
        r.ent('hushling', 18, 31);
        r.ent('stilt', 46, 31);
        r.ent('drifter', 30, 14);
        r.ent('drifter', 52, 12);
        r.ent('glint', 8, 30, { id: 'g_u2a', n: 5 });
        r.ent('glint', 60, 30, { id: 'g_u2b', n: 5 });
        r.ent('glint', 50, 25, { id: 'g_u2c', n: 4 });

        r.ent('hint', 20, 31, {
            act: 'none',
            text: 'Ride the shuttle across the thorns',
            range: 5,
        });

        r.ent('sign', 5, 31, {
            title: 'Folded Cloth',
            text: [
                'Every veil in the Gallery was folded here when it was taken down to be washed, and none of them was ever hung again.',
                'A bell hangs on the far side of the pit. It was tuned to a voice that is not in this hall.',
            ],
        });

        dress(r, {
            x0: 4,
            x1: 60,
            ceil: 4,
            stand: 31,
            pillars: [12, 41, 59],
            windows: [20, 50],
            candles: [8, 56],
            piles: [3, 14, 58],
            masks: [30],
        });
        r.light(32, 18, 10, '#9fd8ff', { a: 0.22 });
    });

    // ---------------------------------------------------------------- U3 The Pallbearers' Rest
    // Two Shade Brutes, a lantern, the third bell, and the veil gate that waits on all three.
    R({ id: 'U3', area: AREA, name: 'The Pallbearers’ Rest', x: 738, y: 92, w: 60, h: 36 }, (r) => {
        r.air(0, 28, 0, 31); // west <- U2
        r.air(1, 4, 58, 31); // the rest
        r.air(59, 28, 59, 31); // east -> U4, behind the veil gate
        r.gate(57, 28, 58, 31, 'hb_voices', { kind: 'veil' });

        // the west ledge with the bell, and a loft with a cache
        r.plat(10, 13, 29);
        r.plat(15, 19, 26);
        r.plat(30, 33, 29);
        r.plat(35, 38, 26);
        r.plat(30, 33, 23);
        r.plat(35, 38, 20);

        r.ent('lantern', 6, 31, { id: 'lan_u3' });
        r.ent('silentbell', 17, 25, { id: 'u3v', gate: 'hb_voices', group: 'voices', pitch: 164.8 });
        r.ent('cache', 36, 19, { id: 'gc_u3', n: 45 });

        r.ent('brute', 27, 31);
        r.ent('brute', 45, 31);
        r.ent('hushling', 22, 31);
        r.ent('hushling', 40, 31);
        r.ent('hushling', 52, 31);
        r.ent('drifter', 30, 12);
        r.ent('glint', 12, 28, { id: 'g_u3a', n: 5 });
        r.ent('glint', 31, 22, { id: 'g_u3b', n: 6 });
        r.ent('glint', 54, 30, { id: 'g_u3c', n: 5 });

        r.ent('hint', 50, 31, {
            act: 'attack',
            text: 'Three bells sing together. When the last is unwrapped, this veil will part.',
            range: 6,
        });

        r.ent('sign', 9, 31, {
            title: 'The Pallbearers’ Rest',
            text: [
                'Where the bearers set the weight down, for a breath, before they were told to pick it up again.',
                'The veil to the east was hung by the last of them. It parts for a chord, not a note.',
            ],
        });

        dress(r, {
            x0: 4,
            x1: 56,
            ceil: 4,
            stand: 31,
            pillars: [3, 24, 47, 56],
            windows: [14, 40],
            candles: [8, 34, 50],
            statues: [5, 53],
            piles: [20, 44],
        });
        r.light(30, 18, 10, '#9fd8ff', { a: 0.26 });
    });

    // ---------------------------------------------------------------- U4 The Reliquary of Bells
    // The end of the Underveil: a Lifethread on a dais among bells nobody wrapped.
    R({ id: 'U4', area: AREA, name: 'The Reliquary of Bells', x: 798, y: 92, w: 52, h: 36 }, (r) => {
        r.air(0, 28, 0, 31); // west <- U3
        r.air(1, 4, 50, 31); // the reliquary
        r.solid(34, 30, 37, 31); // two steps up to the dais
        r.solid(38, 28, 46, 31);

        r.ent('lantern', 8, 31, { id: 'lan_u4' });
        r.ent('pickup', 42, 27, { kind: 'lifethread', id: 'life_u4' });
        r.ent('cache', 14, 31, { id: 'gc_u4', n: 50 });

        r.ent('hushling', 22, 31);
        r.ent('hushling', 28, 31);
        r.ent('glint', 18, 30, { id: 'g_u4a', n: 6 });
        r.ent('glint', 30, 29, { id: 'g_u4b', n: 6 });
        r.ent('glint', 47, 30, { id: 'g_u4c', n: 6 });

        r.ent('sign', 11, 31, {
            title: 'Reliquary of Bells',
            text: [
                'Every bell the Gallery ever cast and could not bear to melt down hangs here, with its clapper still in.',
                'They have been waiting a very long time to be asked.',
            ],
        });

        // a row of bells nobody wrapped
        for (const x of [18, 24, 30, 36, 44]) prop(r, 'bell', x, 6, 200, { layer: 'back', alpha: 0.95 });

        dress(r, {
            x0: 4,
            x1: 48,
            ceil: 4,
            stand: 31,
            pillars: [3, 49],
            windows: [14, 40],
            candles: [6, 26, 40],
            statues: [48],
        });
        r.light(42, 24, 9, '#cfeaff', { a: 0.45 });
        r.light(24, 14, 10, '#9fd8ff', { a: 0.25 });
    });

    // ================================================================ THE CELLS
    // Each cell is a shaft down from a cloth hatch in the spine, a room 13 rows deep, and a zig-zag of ledges back up.
    // `sx` is the left column of the shaft in the cell's own tiles.
    const cell = (id, name, x, sx, build) => {
        R({ id, area: AREA, name, x, y: 78, w: 32, h: 13 }, (r) => {
            r.air(1, 2, 30, 11); // the cell
            r.air(sx, 0, sx + 3, 1); // up -> the hatch
            r.plat(sx, sx + 3, 0);
            r.plat(sx - 6, sx - 2, 3);
            r.plat(sx, sx + 4, 6);
            r.plat(sx + 4, sx + 8, 9);
            build(r);
        });
    };

    cell('K1', 'The Veil-maker’s Cell', 520, 18, (r) => {
        r.ent('cache', 5, 11, { id: 'gc_k1', n: 50 });
        r.ent('hushling', 12, 11);
        r.ent('glint', 27, 10, { id: 'g_k1a', n: 6 });
        r.ent('glint', 9, 10, { id: 'g_k1b', n: 5 });

        r.ent('sign', 29, 11, {
            title: 'The Veil-maker’s Cell',
            text: [
                'He worked here alone, hemming black gauze by candlelight, and was not asked what it was for.',
                'The hatch over his head was sewn shut from above, so that nobody would disturb him. Nobody did.',
            ],
            small: true,
        });

        veil(r, 6, 2, 260, { alpha: 0.85 });
        veil(r, 14, 2, 260, { alpha: 0.85 });
        prop(r, 'candles', 9, 12, 80);
        r.light(9, 9, 5, '#9fd8ff', { a: 0.35 });
        r.light(24, 8, 6, '#9fd8ff', { a: 0.22 });
    });

    cell('K2', 'The Cloth Vault', 560, 12, (r) => {
        // the Silk Spool sits in a nook sealed with plain stone: break the wall (no cloth, no Shears needed)
        r.solid(24, 2, 30, 8);
        r.breakable(24, 9, 25, 11, 'k2_wall');
        r.secret(26, 9, 30, 11, 'k2_nook');

        r.ent('pickup', 28, 11, { kind: 'spool', id: 'spool_k2' });
        r.ent('hushling', 6, 11);
        r.ent('hushling', 19, 11);
        r.ent('glint', 4, 10, { id: 'g_k2a', n: 5 });
        r.ent('glint', 29, 10, { id: 'g_k2b', n: 6 });

        r.ent('hint', 21, 11, { act: 'attack', text: 'The stone ahead is hollow. Strike it.', range: 4 });

        r.ent('sign', 20, 11, {
            title: 'The Cloth Vault',
            text: [
                'Spare veils, folded in tens and tied with silver thread, for the day a veil should tear.',
                'None ever tore. The mourners kept the spares anyway, the way one keeps a good coat for a funeral.',
            ],
            small: true,
        });

        veil(r, 8, 2, 260, { alpha: 0.85 });
        veil(r, 20, 2, 260, { alpha: 0.85 });
        prop(r, 'maskpile', 3, 12, 70, { alpha: 0.8 });
        r.light(28, 10, 5, '#cfe9ff', { a: 0.0, secret: 'k2_nook' });
    });

    cell('K3', 'The Bier Cellar', 780, 8, (r) => {
        r.ent('lantern', 24, 11, { id: 'lan_k3' });
        r.ent('cache', 16, 11, { id: 'gc_k3', n: 45 });
        r.ent('hushling', 20, 11);
        r.ent('glint', 28, 10, { id: 'g_k3a', n: 6 });

        r.ent('sign', 27, 11, {
            title: 'Under the Bier',
            text: [
                'The hollow in the bier above reaches all the way down to here, as though something went through it, once, in a hurry.',
                'It left nothing behind but a lantern, lit by someone who meant to stay.',
            ],
            small: true,
        });

        veil(r, 12, 2, 260, { alpha: 0.85 });
        veil(r, 22, 2, 260, { alpha: 0.85 });
        prop(r, 'candles', 20, 12, 80);
        r.light(24, 9, 6, '#9fd8ff', { a: 0.45 });
    });

    // ================================================================ THE SCORE
    // Three pieces for the Gallery. The Bier Chamber and the arena's vestibule stay silent: that is the quiet before the
    // Long Mourner, and its own two pieces take over when the fight starts.
    const SCORE = {
        H1: 'mus_hushed1',
        H2: 'mus_hushed1',
        H3: 'mus_hushed1',
        H4: 'mus_hushed1',
        H5: 'mus_hushed2',
        H6: null,
        H7: null,
        H8: 'mus_hushed2',
        N1: 'mus_hushed2',
        N2: 'mus_hushed2',
        N3: 'mus_hushed2',
        U1: 'mus_hushed3',
        U2: 'mus_hushed3',
        U3: 'mus_hushed3',
        U4: 'mus_hushed3',
        K1: 'mus_hushed3',
        K2: 'mus_hushed3',
        K3: 'mus_hushed3',
    };

    for (const id of Object.keys(SCORE)) BW.ROOMS[id].music = SCORE[id];
})(window.BW);

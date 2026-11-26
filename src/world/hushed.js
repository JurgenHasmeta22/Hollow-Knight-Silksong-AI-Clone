'use strict';

// Chapter II: The Hushed Gallery. A funeral gallery where every bell has had its clapper cut out and wrapped in black
// cloth, kept silent by the Long Mourner. It lies east of the Ashen Ramparts and stays shut until the Great Bell has
// rung (the toll parts the veils at the end of the Rampart Gatehall).
//
//   F4  Rampart Gatehall       the veil gate (opens with the Great Bell)
//   H1  Veilgate Threshold     lantern, first Hushlings
//   H2  Hall of Hanging Veils  a pit to cross, drifters, and the first silent bell: strike it to open the way east
//   H3  The Mask Crypt         a descent among stilt-legged mourners and ceiling-hung Reachers (secret: Lifethread)
//   H4  The Muffled Belfry     a tall climb with three silent bells that must all be unwrapped
//   H5  The Candlelit Aisle    the gauntlet: Shade Brutes and packs (secret: Silk Spool), lantern
//   H6  The Bier Chamber       the quiet before: lore, a bier, kneeling statues
//   H7  The Hush Arena         the Long Mourner (vestibule with a lantern, then the sealed arena)
//   H8  The Last Door Hall     the Silent Key on its altar and the Last Door
//
// The wings (src/world/hushed_wings.js) hang off this spine and ask you to come back for them:
//   N1-N3  the Cloister       above the aisle: climb out of H5, ring the Bellwrights' bells in order, take the Mourners' Shears
//   U1-U4  the Underveil      under the Mask Crypt: a hatch of thick mourning cloth (needs the Shears), bells that sing together
//   K1-K3  the Cells          three small chambers under H1, H2 and H6, behind more cloth hatches (also the Shears)
//
// Room x/y are world tile positions; neighbours line up by adjacency exactly like the rest of the world.
// Standing rows: rooms are carved so the walking row is `floor - 1` where `floor` is the first solid row.
(function (BW) {
    BW.AREAS.hushed = {
        id: 'hushed',
        name: 'The Hushed Gallery',
        music: null, // the gallery is silent: no music, no ambience, only footsteps and the bells you wake
        amb: null,
        tex: 'tex_gallery',
        dress: 'hushed',
        sky: '#05080c',
        fog: '#17232d',
        ink: '#05080b',
        deep: '#020406',
        rim: '#9fd8ff',
        moss: '#6a8fa3',
        light: '#cfeaff',
        glow: '#9fd8ff',
        darkness: 0.5,
        particles: 'hush',
        roomLights: true, // the room's r.light() calls are drawn here (see Game.render)
        bg: ['bg_gallery_far', 'bg_gallery_mid'],
        mapColor: '#6f9bb5',
    };

    const R = BW.defineRoom;

    // ---- decoration helpers (x in tiles; `floor` is the first solid row under the prop; size = drawn height in px)
    const prop = (r, name, x, floor, size, extra) =>
        r.deco('deco_hg_' + name, x, floor, Object.assign({ size, layer: 'back' }, extra || {}));

    // a veil hangs from `top` (the tile row of the ceiling's underside) and sways a little
    const veil = (r, x, top, size, extra) =>
        r.deco('deco_hg_veil', x, top, Object.assign({ size, layer: 'back', hang: true, sway: 0.018 }, extra || {}));

    const candles = (r, x, floor, size) => {
        prop(r, 'candles', x, floor, size || 96);
        r.light(x, floor - 1.5, 5, '#9fd8ff', { a: 0.42 });
    };

    const pillar = (r, x, floor, size, extra) => prop(r, 'pillar', x, floor, size || 400, extra);

    // a window of cold light on the wall
    const window_ = (r, x, bottom, size) => {
        prop(r, 'window', x, bottom, size || 340, { alpha: 0.85 });
        r.light(x, bottom - size / 80, 7, '#cfeaff', { a: 0.32 });
    };

    BW.HG = { prop, veil, candles, pillar, window_ };

    // ================================================================ H1 Veilgate Threshold
    R({ id: 'H1', area: 'hushed', name: 'Veilgate Threshold', x: 514, y: 44, w: 44, h: 34 }, (r) => {
        r.air(0, 21, 5, 24); // west <- F4 (the Rampart Gatehall)
        r.air(6, 7, 41, 24); // the first hall
        r.air(42, 21, 43, 24); // east -> H2
        r.solid(33, 23, 37, 24); // a plinth
        r.plat(12, 16, 22);
        r.plat(19, 23, 19);
        r.plat(26, 30, 22);

        // a hatch in the floor under thick mourning cloth: cut it with the Mourners' Shears, drop into the Veil-maker's Cell
        r.breakable(24, 25, 27, 26, 'h1_shroud', { kind: 'shroud', needs: 'shears', hp: 2 });
        r.air(24, 27, 27, 33);
        r.plat(24, 27, 31);
        r.plat(24, 27, 28);

        r.ent('lantern', 9, 24, { id: 'lan_h1' });

        r.ent('sign', 7, 24, {
            title: 'Veilgate Plaque',
            text: [
                'THE HUSHED GALLERY',
                'The mourners hung the veils and cut the clappers, so that nothing in these halls would ever ring again.',
                'Walk softly. They hear everything.',
            ],
        });

        r.ent('hint', 25, 24, {
            act: 'none',
            text: 'Black cloth is stitched over a hatch. Something sharp could cut it.',
            range: 4,
            unless: 'shears',
        });

        r.ent('hushling', 21, 24);
        r.ent('hushling', 31, 24);
        r.ent('glint', 21, 18, { id: 'g_h1a', n: 5 });
        r.ent('glint', 28, 21, { id: 'g_h1b', n: 4 });

        for (const x of [9, 15, 22, 29, 38]) veil(r, x, 7, 380 + (x % 3) * 40);

        pillar(r, 12, 25, 420);
        pillar(r, 26, 25, 420);
        pillar(r, 41, 25, 420, { alpha: 0.7 });
        prop(r, 'statue', 35, 23, 210);
        window_(r, 19, 16, 300);
        window_(r, 33, 16, 300);
        candles(r, 15, 25);
        prop(r, 'maskpile', 3, 22, 70, { alpha: 0.7 });
        r.light(9, 22, 6, '#9fd8ff', { a: 0.3 });
    });

    // ================================================================ H2 Hall of Hanging Veils
    R({ id: 'H2', area: 'hushed', name: 'Hall of Hanging Veils', x: 558, y: 44, w: 64, h: 34 }, (r) => {
        r.air(0, 21, 3, 24); // west <- H1
        r.air(4, 6, 57, 24); // the hall
        r.air(58, 21, 63, 24); // east -> H3, behind the veil gate
        r.air(22, 25, 31, 30); // a pit under the middle of the floor
        r.thorns(22, 31, 31);
        r.plat(24, 25, 23); // stepping stones over the pit
        r.plat(28, 29, 23);
        r.plat(8, 12, 22);
        r.plat(40, 44, 22);
        r.gate(60, 21, 61, 24, 'hb_h2', { kind: 'veil' }); // parts when the bell is struck
        r.air(42, 0, 45, 5); // a drop from the Cloister above (N1), a way back down for the Shears
        r.breakable(14, 25, 17, 26, 'h2_shroud', { kind: 'shroud', needs: 'shears', hp: 2 }); // -> the Cloth Vault
        r.air(14, 27, 17, 33);
        r.plat(14, 17, 31);
        r.plat(14, 17, 28);

        r.ent('hint', 15, 24, {
            act: 'none',
            text: 'Black cloth is stitched over a hatch. Something sharp could cut it.',
            range: 4,
            unless: 'shears',
        });

        r.ent('hushling', 12, 24);
        r.ent('hushling', 36, 24);
        r.ent('hushling', 52, 24);
        r.ent('drifter', 17, 13);
        r.ent('drifter', 45, 11);
        r.ent('silentbell', 48, 24, { id: 'h2a', gate: 'hb_h2' });
        r.ent('glint', 10, 21, { id: 'g_h2a', n: 6 });
        r.ent('glint', 42, 21, { id: 'g_h2b', n: 5 });

        r.ent('hint', 43, 24, {
            act: 'attack',
            text: 'Strike the bell to unwrap it. Every Hushed in the hall will hear.',
            range: 5,
        });

        r.ent('sign', 6, 24, {
            title: 'Cloth Notice',
            text: [
                'ALL BELLS ARE TO BE MUFFLED.',
                'Whoever unbinds a clapper, for any reason, answers for what comes to the sound.',
            ],
        });

        for (let x = 6; x <= 57; x += 5) veil(r, x, 6, 420 + ((x * 7) % 5) * 30);

        for (const x of [14, 40, 56]) veil(r, x, 6, 500, { layer: 'front', alpha: 0.35 });

        pillar(r, 18, 25, 430);
        pillar(r, 39, 25, 430);
        pillar(r, 55, 25, 430, { alpha: 0.7 });
        prop(r, 'masks', 11, 17, 120);
        prop(r, 'masks', 33, 17, 120);
        window_(r, 28, 16, 300);
        window_(r, 50, 16, 280);
        candles(r, 44, 25);
        candles(r, 52, 25);
        prop(r, 'maskpile', 5, 25, 70, { alpha: 0.75 });
    });

    // ================================================================ H3 The Mask Crypt
    R({ id: 'H3', area: 'hushed', name: 'The Mask Crypt', x: 622, y: 44, w: 52, h: 44 }, (r) => {
        r.air(0, 21, 3, 24); // west <- H2
        r.air(4, 4, 50, 40); // the crypt
        r.air(51, 37, 51, 40); // east -> H4
        r.solid(0, 25, 9, 43); // the entry shelf
        r.air(1, 36, 9, 40); // a hollow under the shelf
        r.plat(11, 14, 27);
        r.plat(16, 19, 30);
        r.plat(21, 26, 33);
        r.plat(28, 31, 36);
        r.solid(20, 27, 30, 27); // a beam over the stair: Reachers hang under beams
        r.solid(36, 30, 44, 30);
        r.secret(1, 36, 6, 40, 'h3_nook');
        r.air(12, 0, 15, 3); // a drop from the Cloister above (N1)
        r.breakable(33, 41, 36, 42, 'h3_shroud', { kind: 'shroud', needs: 'shears', hp: 2 }); // -> the Underveil (U1)
        r.air(33, 43, 36, 43);

        r.ent('pickup', 3, 40, { kind: 'lifethread', id: 'life_h3' });
        r.ent('hint', 34, 40, {
            act: 'none',
            text: 'A hatch of black cloth lies in the floor. Something sharp could cut it.',
            range: 4,
            unless: 'shears',
        });

        r.ent('stilt', 18, 40);
        r.ent('stilt', 40, 40);
        r.ent('reacher', 25, 27, { hang: 1 });
        r.ent('reacher', 40, 30, { hang: 1 });
        r.ent('hushling', 46, 40);
        r.ent('glint', 29, 35, { id: 'g_h3a', n: 6 });

        r.ent('sign', 6, 24, {
            title: 'Crypt Stair',
            text: [
                'Below lie the masks of the mourned.',
                'One mask for every face the Gallery was not allowed to keep.',
            ],
        });

        for (const x of [8, 20, 34, 48]) veil(r, x, 4, 420, { alpha: 0.9 });

        pillar(r, 8, 25, 380);
        prop(r, 'maskpile', 14, 41, 90);
        prop(r, 'maskpile', 34, 41, 100);
        prop(r, 'maskpile', 47, 41, 80, { alpha: 0.85 });
        prop(r, 'statue', 24, 41, 230);
        prop(r, 'statue', 42, 41, 230, { flip: true });
        candles(r, 30, 41, 90);
        candles(r, 4, 41, 90);
        prop(r, 'masks', 22, 20, 130, { alpha: 0.8 });
        window_(r, 45, 14, 300);
    });

    // ================================================================ H4 The Muffled Belfry
    R({ id: 'H4', area: 'hushed', name: 'The Muffled Belfry', x: 674, y: 44, w: 40, h: 48 }, (r) => {
        r.air(0, 37, 3, 40); // west <- H3
        r.air(4, 2, 35, 40); // the shaft
        r.air(36, 4, 39, 7); // east -> H5, behind the veil gate
        r.solid(32, 8, 39, 8); // the tunnel floor, continuing the top ledge
        r.air(26, 0, 28, 1); // a drop from the Cloister above (N2): a way back to the Belfry's lantern
        r.gate(37, 4, 38, 7, 'hb_h4', { kind: 'veil' }); // parts when all three bells are unwrapped

        // a zig-zag climb: every hop is 3 rows up and at most 3 tiles across, so no jump needs the dash
        r.plat(8, 12, 38);
        r.plat(15, 19, 35);
        r.plat(22, 26, 32);
        r.plat(29, 33, 29);
        r.plat(24, 28, 26);
        r.plat(17, 21, 23);
        r.plat(10, 14, 20);
        r.plat(4, 8, 17);
        r.plat(10, 14, 14);
        r.plat(17, 21, 11);
        r.plat(26, 31, 8);

        r.ent('silentbell', 32, 28, { id: 'h4a', gate: 'hb_h4', group: 'h4' });
        r.ent('silentbell', 10, 19, { id: 'h4b', gate: 'hb_h4', group: 'h4' });
        r.ent('silentbell', 29, 7, { id: 'h4c', gate: 'hb_h4', group: 'h4' });
        r.ent('lantern', 6, 40, { id: 'lan_h4' });
        r.ent('reacher', 17, 35, { hang: 1 });
        r.ent('reacher', 19, 23, { hang: 1 });
        r.ent('drifter', 24, 20);
        r.ent('drifter', 14, 9);
        r.ent('glint', 6, 16, { id: 'g_h4a', n: 6 });
        r.ent('glint', 20, 10, { id: 'g_h4b', n: 6 });

        r.ent('hint', 24, 40, {
            act: 'attack',
            text: 'Three bells. Unwrap them all and the veil above will part.',
            range: 6,
        });

        r.ent('sign', 4, 40, {
            title: 'Keeper of the Cloth',
            text: [
                'I bound the three bells of the shaft with my own hands, tight as a shroud.',
                'If you mean to ring them: climb. And know that every Hushed below will turn its blank face up to you.',
            ],
        });

        for (const x of [6, 16, 26, 33]) veil(r, x, 2, 460, { alpha: 0.85 });

        for (const y of [12, 26]) veil(r, 34, y, 300, { alpha: 0.6, flip: true });

        pillar(r, 4, 41, 360, { alpha: 0.75 });
        window_(r, 34, 22, 300);
        window_(r, 6, 33, 300);
        candles(r, 20, 36, 80);
        candles(r, 12, 21, 80);
        r.light(20, 14, 9, '#9fd8ff', { a: 0.22 });
    });

    // ================================================================ H5 The Candlelit Aisle
    R({ id: 'H5', area: 'hushed', name: 'The Candlelit Aisle', x: 714, y: 44, w: 60, h: 30 }, (r) => {
        r.air(0, 4, 5, 7); // west <- H4
        r.air(6, 3, 58, 24); // the aisle
        r.air(59, 21, 59, 24); // east -> H6
        r.solid(0, 8, 8, 29); // the entry shelf: drop off its edge, or climb back up the ledges
        r.plat(10, 13, 22);
        r.plat(14, 17, 19);
        r.plat(11, 14, 16);
        r.plat(14, 17, 13);
        r.plat(10, 13, 10);
        r.plat(32, 36, 22);
        r.plat(39, 43, 19);
        r.plat(50, 53, 22);
        r.air(34, 0, 43, 2); // a column of pale light falls into the aisle: the way up to the Cloister (N3)
        r.plat(34, 38, 16);
        r.plat(39, 43, 13);
        r.plat(34, 38, 10);
        r.plat(39, 43, 7);
        r.plat(34, 38, 4);
        r.plat(39, 43, 1);
        r.plat(54, 57, 19); // up to the nook
        r.plat(50, 53, 16);
        r.solid(54, 14, 58, 14); // the nook's floor
        r.air(54, 9, 58, 13);
        r.secret(54, 9, 58, 13, 'h5_nook');

        r.ent('pickup', 56, 13, { kind: 'spool', id: 'spool_h5' });
        r.ent('lantern', 22, 24, { id: 'lan_h5' });
        r.ent('brute', 36, 24);
        r.ent('brute', 49, 24);
        r.ent('hushling', 28, 24);
        r.ent('hushling', 42, 24);
        r.ent('hushling', 55, 24);
        r.ent('drifter', 34, 10);
        r.ent('glint', 34, 21, { id: 'g_h5a', n: 6 });
        r.ent('glint', 41, 18, { id: 'g_h5b', n: 6 });
        r.ent('cache', 52, 15, { id: 'gc_h5', n: 40 });

        r.ent('sign', 20, 24, {
            title: 'The Aisle of Candles',
            text: [
                'A candle for each of the mourned, and the mourners have never let one go out.',
                'The heavy ones guard the flames. Do not be where they strike.',
            ],
        });

        for (let x = 14; x <= 56; x += 6) veil(r, x, 3, 380 + ((x * 3) % 4) * 30, { alpha: 0.9 });

        for (const x of [24, 31, 38, 45, 52]) candles(r, x, 25, 100);

        pillar(r, 28, 25, 420);
        pillar(r, 46, 25, 420);
        prop(r, 'masks', 30, 17, 120);
        prop(r, 'masks', 47, 17, 120);
        prop(r, 'statue', 57, 25, 240, { flip: true });
        window_(r, 40, 15, 300);
    });

    // ================================================================ H6 The Bier Chamber
    R({ id: 'H6', area: 'hushed', name: 'The Bier Chamber', x: 774, y: 44, w: 44, h: 34 }, (r) => {
        r.air(0, 21, 3, 24); // west <- H5
        r.air(4, 7, 39, 24); // the chamber
        r.air(40, 21, 43, 24); // east -> H7
        r.plat(8, 12, 22);
        r.plat(30, 35, 22);
        r.breakable(14, 25, 17, 26, 'h6_shroud', { kind: 'shroud', needs: 'shears', hp: 2 }); // -> the Bier Cellar
        r.air(14, 27, 17, 33);
        r.plat(14, 17, 31);
        r.plat(14, 17, 28);

        r.ent('hint', 15, 24, {
            act: 'none',
            text: 'Black cloth is stitched over a hatch. Something sharp could cut it.',
            range: 4,
            unless: 'shears',
        });

        r.ent('sign', 7, 24, {
            title: 'Bier of the First Mourner',
            text: [
                'A funeral bed of black stone, veiled to the floor.',
                'The hollow in its middle is too large for any body that was ever carried here.',
                'Whatever lay in it got up on its own.',
            ],
        });

        r.ent('sign', 36, 24, {
            title: 'The Vow, Carved',
            text: [
                'AS LONG AS THE DEAD ARE UNQUIET, NOTHING IN THESE HALLS SHALL RING.',
                'Below it, in a later hand: “It never learned that the dead had gone quiet long ago.”',
            ],
        });

        r.ent('glint', 10, 21, { id: 'g_h6a', n: 5 });

        for (let x = 6; x <= 38; x += 4) veil(r, x, 7, 400 + ((x * 5) % 4) * 35, { alpha: 0.9 });

        prop(r, 'statue', 12, 25, 250);
        prop(r, 'statue', 17, 25, 230);
        prop(r, 'statue', 27, 25, 230, { flip: true });
        prop(r, 'statue', 32, 25, 250, { flip: true });
        r.deco('obj_hg_bier', 22, 25, { size: 130, layer: 'back', alpha: 0.95 });
        r.light(22, 23, 7, '#9fd8ff', { a: 0.45 });
        prop(r, 'masks', 9, 18, 120);
        prop(r, 'masks', 35, 18, 120);
        pillar(r, 5, 25, 420);
        pillar(r, 39, 25, 420);
        candles(r, 19, 25, 90);
        candles(r, 25, 25, 90);
        window_(r, 22, 14, 330);
    });

    // ================================================================ H7 The Hush Arena (the Long Mourner)
    // A vestibule with a lantern, a veil gate that falls when the fight starts, then the arena. The floor row is 25.
    R(
        {
            id: 'H7',
            area: 'hushed',
            name: 'The Hush Arena',
            x: 818,
            y: 44,
            w: 52,
            h: 34,
            zoom: 0.9,
            arena: { x0: 12, x1: 49, floor: 25 },
        },
        (r) => {
            r.air(0, 21, 0, 24); // west <- H6
            r.air(1, 16, 11, 24); // vestibule
            r.air(12, 3, 49, 24); // arena
            r.air(50, 21, 51, 24); // east -> H8, behind the veil gate
            r.gate(10, 16, 11, 24, 'arena_sealed', { kind: 'hush', invert: true, fixed: true });
            r.gate(50, 21, 51, 24, 'mourner_defeated', { kind: 'veil' });

            r.ent('lantern', 5, 24, { id: 'lan_h7' });
            r.ent('hushgate', 11, 24, {});

            r.ent('sign', 3, 24, {
                title: 'The Hush Gate',
                text: [
                    'The boss of the Gallery, they called it: the one the mourners could not carry out.',
                    'Rest at the lantern first. The gate will not open again until one of you is silent.',
                ],
            });

            r.ent('mourner', 40, 24, { facing: -1 });
            r.trigger(14, 3, 49, 24, 'warden');

            for (const x of [2, 7]) veil(r, x, 16, 280, { alpha: 0.9 });

            veil(r, 14, 3, 640, { alpha: 0.8 });
            veil(r, 26, 3, 700, { alpha: 0.75 });
            veil(r, 38, 3, 640, { alpha: 0.8 });
            veil(r, 47, 3, 600, { alpha: 0.8 });
            pillar(r, 18, 25, 520, { alpha: 0.85 });
            pillar(r, 33, 25, 520, { alpha: 0.85 });
            pillar(r, 46, 25, 520, { alpha: 0.85 });
            r.deco('obj_hg_bier', 22, 25, { size: 150, layer: 'back', alpha: 0.9 });
            prop(r, 'statue', 15, 25, 260);
            prop(r, 'masks', 27, 14, 150, { alpha: 0.7 });
            prop(r, 'masks', 40, 14, 150, { alpha: 0.7 });
            window_(r, 30, 17, 420);
            r.light(24, 17, 12, '#9fd8ff', { a: 0.25 });
            candles(r, 4, 25, 90);
            candles(r, 8, 25, 90);
        },
    );

    // ================================================================ H8 The Last Door Hall
    R({ id: 'H8', area: 'hushed', name: 'The Last Door Hall', x: 870, y: 44, w: 48, h: 34 }, (r) => {
        r.air(0, 21, 3, 24); // west <- H7
        r.air(4, 6, 45, 24); // the hall
        r.plat(26, 29, 22);

        r.ent('lantern', 7, 24, { id: 'lan_h8' });
        r.ent('keyaltar', 17, 24, {});
        r.ent('lastdoor', 37, 24, {});

        r.ent('sign', 11, 24, {
            title: 'The Key Altar',
            text: [
                'The dish is shaped like the mouth of a small bell.',
                'Whatever the Mourner guarded was set down here once, a long time ago, by someone who meant to come back.',
            ],
        });

        r.ent('sign', 30, 24, {
            title: 'Beside the Last Door',
            text: [
                'THE LAST DOOR. IT OPENS FOR ONE KEY AND ONE SOUND.',
                'The keyhole is the shape of a blank mask’s oval. The bolts are little bells without clappers.',
            ],
        });

        r.ent('glint', 27, 21, { id: 'g_h8a', n: 8 });

        for (let x = 6; x <= 44; x += 5) veil(r, x, 6, 420 + ((x * 3) % 4) * 30, { alpha: 0.9 });

        pillar(r, 14, 25, 440);
        pillar(r, 22, 25, 440);
        pillar(r, 44, 25, 440, { alpha: 0.8 });
        prop(r, 'statue', 25, 25, 240);
        prop(r, 'masks', 20, 17, 130);
        candles(r, 12, 25, 96);
        candles(r, 32, 25, 96);
        window_(r, 10, 15, 320);
        r.light(17, 21, 6, '#9fd8ff', { a: 0.4 });
    });
})(window.BW);

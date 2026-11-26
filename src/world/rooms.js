'use strict';

// World content: areas and rooms. Room x/y are positions on the shared world tile grid, so adjacent
// rooms line up exactly and the map can draw everything in place. Interiors are carved out of solid rock.
(function (BW) {
    BW.AREAS = {
        mosslit: {
            id: 'mosslit',
            name: 'Mosslit Hollow',
            music: 'mus_mosslit',
            amb: 'amb_mosslit',
            tex: 'tex_mosslit',
            sky: '#06171a',
            fog: '#0f3a3c',
            ink: '#041012',
            deep: '#020909',
            rim: '#a8f7dc',
            moss: '#3fae86',
            light: '#7fe9d2',
            glow: '#5ff2c8',
            darkness: 0.38,
            particles: 'spores',
            bg: ['bg_mosslit_far', 'bg_mosslit_mid'],
            mapColor: '#3f8f80',
        },
        spindle: {
            id: 'spindle',
            name: 'The Spindleworks',
            music: 'mus_spindle',
            amb: 'amb_spindle',
            tex: 'tex_spindle',
            sky: '#120f1c',
            fog: '#2b2340',
            ink: '#0b0812',
            deep: '#05040a',
            rim: '#f2d3a6',
            moss: '#b98d5a',
            light: '#ffcf8a',
            glow: '#ffb767',
            darkness: 0.34,
            particles: 'dust',
            bg: ['bg_spindle_far', 'bg_spindle_mid'],
            mapColor: '#9a7a5a',
        },
        belfry: {
            id: 'belfry',
            name: 'The Silent Belfry',
            music: 'mus_belfry',
            amb: 'amb_belfry',
            tex: 'tex_belfry',
            sky: '#0d1426',
            fog: '#3b4a6b',
            ink: '#0a0e18',
            deep: '#05070d',
            rim: '#f4f1ea',
            moss: '#c9c2b0',
            light: '#dfe8ff',
            glow: '#cfe0ff',
            darkness: 0.3,
            particles: 'motes',
            bg: ['bg_belfry_far', 'bg_belfry_mid'],
            mapColor: '#b9b6c8',
        },
        // Stage 2: the sealed cathedral and its warden. Music starts with the fight; dressed like the Belfry.
        cathedral: {
            id: 'cathedral',
            name: 'Cathedral of the Last Toll',
            music: null,
            amb: 'amb_belfry',
            dress: 'belfry',
            tex: 'tex_belfry',
            sky: '#0a0f1f',
            fog: '#363a58',
            ink: '#090b14',
            deep: '#04050b',
            rim: '#f6efe0',
            moss: '#cfc6b2',
            light: '#ffe6bd',
            glow: '#ffd59a',
            darkness: 0.3,
            particles: 'motes',
            bg: ['bg_cathedral_far', 'bg_belfry_mid'],
            mapColor: '#c8b38c',
        },
    };

    const R = BW.defineRoom;

    // ============================ MOSSLIT HOLLOW ============================
    R({ id: 'M1', area: 'mosslit', name: 'Fallen Light', x: 8, y: 138, w: 48, h: 20 }, (r) => {
        r.air(2, 4, 46, 16);
        r.air(4, 1, 9, 3);
        r.air(18, 3, 30, 3);
        r.air(22, 2, 27, 2);
        r.air(36, 3, 42, 3);
        r.air(47, 13, 47, 16); // east -> M2
        r.air(10, 17, 13, 18);
        r.air(27, 17, 30, 18); // two shallow dips
        r.solid(15, 14, 18, 16); // a ledge to leap onto
        r.plat(21, 25, 12);
        r.gate(40, 17, 41, 17, 'bell1', { kind: 'hatch' }); // opened from below by the first toll-loom
        r.air(40, 18, 41, 19);
        r.ent('spawn', 6, 2);
        r.ent('lantern', 36, 16, { id: 'lan_m1' });

        r.ent('sign', 3, 16, {
            title: 'Weathered Tablet',
            text: [
                'When the great bells fell silent, the threads that bound the Hollow began to unravel.',
                'Weaver, if you read this — mend what we could not.',
            ],
        });

        r.ent('sign', 42, 16, {
            title: 'Sealed Hatch',
            text: ['An iron hatch, bolted shut from below.', 'Faint bell-cords vanish into the dark beneath it.'],
            small: true,
        });

        r.ent('glint', 23, 11, { id: 'g_m1a', n: 4 });
        r.ent('hint', 7, 15, { act: 'move', text: 'Move' });
        r.ent('hint', 12, 14, { act: 'jump', text: 'Jump' });
        r.ent('hint', 17, 11, { act: 'jump', text: 'Hold to jump higher' });
        r.ent('hint', 33, 15, { act: 'interact', text: 'Rest at lanterns to heal and save', range: 4 });
        r.deco('lightshaft', 6.5, 1, { w: 5, h: 17, alpha: 0.55 });
        r.light(6.5, 3, 7, '#bff7e6', { a: 0.35 });
    });

    R({ id: 'M2', area: 'mosslit', name: 'Glowmoss Path', x: 56, y: 126, w: 64, h: 30 }, (r) => {
        r.air(0, 25, 8, 28); // west <- M1
        r.air(9, 6, 46, 26);
        r.air(47, 8, 62, 17);
        r.air(63, 14, 63, 17); // east -> M3
        r.air(3, 8, 8, 12); // high alcove
        r.solid(20, 6, 26, 7);
        r.solid(31, 6, 34, 6);
        r.solid(12, 6, 15, 6);
        r.thorns(20, 23, 27); // first thorns
        r.plat(14, 17, 24);
        r.plat(9, 12, 21);
        r.plat(14, 17, 18);
        r.plat(9, 12, 15);
        r.plat(35, 38, 24);
        r.plat(40, 43, 21);
        r.ent('crawler', 15, 26);
        r.ent('crawler', 30, 26);
        r.ent('crawler', 41, 26);
        r.ent('cache', 5, 12, { id: 'gc_m2', n: 22 });
        r.ent('glint', 55, 17, { id: 'g_m2a', n: 4 });
        r.ent('hint', 11, 26, { act: 'attack', text: 'Strike', range: 6 });
        r.ent('hint', 19, 25, { act: 'none', text: 'Thorns wound — leap over them', range: 4 });
        r.ent('hint', 33, 26, { act: 'parry', text: 'Parry: press as a blow lands', range: 5, needs: 'parry' });
        r.light(5, 11, 4, '#7ff2d0', { a: 0.4 });
    });

    R({ id: 'M3', area: 'mosslit', name: 'Lantern Grotto', x: 120, y: 118, w: 40, h: 42 }, (r) => {
        r.air(2, 3, 37, 37);
        r.air(18, 0, 20, 0);
        r.air(15, 1, 23, 2);
        r.plat(17, 21, 3); // up -> S1
        r.air(0, 22, 1, 25);
        r.solid(2, 26, 11, 28); // west ledge <- M2
        r.air(38, 14, 39, 17);
        r.solid(27, 18, 37, 19); // east -> M4
        r.air(28, 38, 30, 41); // down -> M5
        r.plat(14, 17, 23);
        r.plat(20, 23, 20);
        r.plat(22, 25, 15);
        r.plat(14, 17, 12);
        r.plat(20, 23, 9);
        r.plat(13, 16, 6);
        r.plat(14, 17, 35);
        r.plat(20, 23, 32);
        r.plat(13, 16, 29);
        r.ent('lantern', 6, 25, { id: 'lan_m3' });

        r.ent('sign', 24, 37, {
            title: 'Grotto Marker',
            text: [
                'LANTERN GROTTO',
                'Above: the Spindleworks, where the weavers kept their looms.',
                'Below: the deep roots. East: the Sundered Span.',
            ],
        });

        r.deco('statue_moth', 33, 38, { scale: 1.0, layer: 'back', alpha: 0.85 });
        r.light(6, 23, 6, '#ffd59a', { a: 0.25 });
    });

    R({ id: 'M4', area: 'mosslit', name: 'The Sundered Span', x: 160, y: 124, w: 64, h: 28 }, (r) => {
        r.air(1, 2, 62, 11);
        r.air(33, 12, 62, 12);
        r.air(0, 8, 0, 11); // west <- M3
        r.air(63, 9, 63, 12); // east -> M8
        r.air(12, 0, 14, 1); // drop from the shrine above
        r.air(25, 12, 32, 25);
        r.air(23, 13, 24, 25); // the chasm (8 tiles at the top)
        r.thorns(23, 32, 26);

        r.ent('sign', 20, 11, {
            title: 'Broken Span',
            text: [
                'THE SUNDERED SPAN',
                'It fell with the first silence.',
                'Only those who learned the Swift Stitch could cross it now.',
            ],
        });

        r.ent('crawler', 44, 12);
        r.ent('sentinel', 56, 12);
        r.ent('glint', 38, 12, { id: 'g_m4a', n: 6 });
        r.deco('cords', 48, 0, { h: 12, layer: 'back' });
        r.light(29, 22, 9, '#5ff2c8', { a: 0.25 });
    });

    R({ id: 'M5', area: 'mosslit', name: 'Rootfall', x: 124, y: 160, w: 32, h: 44 }, (r) => {
        r.air(2, 1, 26, 39);
        r.air(24, 0, 26, 0); // up -> M3
        r.air(0, 36, 1, 39); // west -> M6
        r.solid(19, 4, 26, 5);
        r.plat(15, 18, 7);
        r.plat(9, 13, 10);
        r.plat(16, 20, 13);
        r.plat(10, 14, 16);
        r.plat(3, 7, 19);
        r.plat(9, 13, 22);
        r.solid(17, 25, 26, 26);
        r.breakable(27, 21, 27, 24, 'm5_wall');
        r.air(28, 21, 30, 24);
        r.secret(28, 21, 30, 24, 'm5_nook');
        r.plat(11, 15, 28);
        r.plat(5, 9, 31);
        r.plat(13, 17, 34);
        r.plat(20, 24, 37);
        r.ent('pickup', 29, 24, { kind: 'lifethread', id: 'lt_m5' });
        r.ent('flyer', 12, 9);
        r.ent('flyer', 6, 26);
        r.ent('flyer', 21, 31);
        r.ent('glint', 5, 18, { id: 'g_m5a', n: 4 });
        r.ent('glint', 22, 36, { id: 'g_m5b', n: 4 });
        r.light(29, 23, 3, '#7ff2d0', { a: 0.0, secret: 'm5_nook' });
    });

    R({ id: 'M6', area: 'mosslit', name: 'Thornwood', x: 60, y: 176, w: 64, h: 28 }, (r) => {
        r.air(1, 6, 62, 23);
        r.air(63, 20, 63, 23); // east <- M5
        r.air(0, 15, 1, 18); // west -> M7
        r.solid(1, 19, 15, 23);
        r.solid(16, 21, 18, 23);
        r.solid(19, 22, 30, 23);
        r.thorns(31, 43, 23);
        r.solid(44, 22, 47, 23);
        r.plat(34, 36, 20);
        r.plat(39, 41, 20);
        r.thorns(9, 11, 18);
        r.solid(14, 6, 19, 8);
        r.solid(36, 6, 40, 7);
        r.solid(50, 6, 56, 9);
        r.ent('hopper', 55, 23);
        r.ent('crawler', 24, 21);
        r.ent('hopper', 14, 18);
        r.ent('glint', 35, 19, { id: 'g_m6a', n: 5 });
        r.ent('glint', 3, 18, { id: 'g_m6b', n: 5 });
    });

    R({ id: 'M7', area: 'mosslit', name: 'Toll-Loom of the Hollow', x: 16, y: 158, w: 44, h: 46 }, (r) => {
        r.air(2, 2, 41, 40);
        r.air(32, 0, 33, 1); // hatch up -> M1
        r.air(42, 33, 43, 36); // east <- M6
        r.solid(34, 37, 41, 40);
        r.solid(30, 39, 33, 40);
        r.ent('lift', 31, 37, { id: 'm7_lift', w: 3, top: 4, bottom: 37, flag: 'bell1' });
        r.ent('toll', 12, 40, { bell: 1 });
        r.ent('sentinel', 22, 40);

        r.ent('sign', 5, 40, {
            title: 'Toll-Loom',
            text: [
                'THE TOLL-LOOM OF THE HOLLOW',
                'Its cord once rang the lowest bell of the Belfry far above.',
                'The threads hang slack. They could be woven again.',
            ],
        });

        r.deco('cords', 12, 0, { h: 30, layer: 'back' });
        r.deco('cords', 32.5, 0, { h: 4, layer: 'back', thin: true });
        r.light(12, 34, 9, '#9ff5dc', { a: 0.25 });
    });

    R({ id: 'M8', area: 'mosslit', name: 'Drowned Chapel', x: 224, y: 118, w: 38, h: 38 }, (r) => {
        r.air(1, 3, 36, 32);
        r.air(0, 15, 0, 18); // west <- M4
        r.air(37, 29, 37, 32); // east -> S6 (lift)
        r.solid(1, 19, 9, 32);
        r.solid(10, 22, 12, 32);
        r.solid(13, 25, 15, 32);
        r.solid(16, 28, 18, 32);
        r.solid(19, 31, 21, 32);
        r.solid(30, 10, 36, 11); // high ledge (dash)
        r.plat(11, 14, 16);
        r.plat(18, 22, 13);
        r.ent('toll', 29, 32, { bell: 2 });
        r.ent('pickup', 34, 9, { kind: 'lifethread', id: 'lt_m8' });
        r.ent('spitter', 23, 3, { hang: 4 });
        r.ent('hopper', 25, 32);
        r.ent('crawler', 34, 32);
        r.deco('water', 19, 31, { w: 18, h: 2 });
        r.light(29, 26, 9, '#9ff5dc', { a: 0.25 });
    });

    // ============================ THE SPINDLEWORKS ============================
    R({ id: 'S1', area: 'spindle', name: 'Spindle Shaft', x: 124, y: 72, w: 32, h: 46 }, (r) => {
        r.air(2, 1, 29, 42);
        r.air(14, 43, 16, 45); // down -> M3
        r.plat(22, 26, 40);
        r.air(30, 7, 31, 10);
        r.solid(26, 11, 29, 13); // east -> S2
        r.plat(21, 25, 38);
        r.plat(13, 17, 35);
        r.plat(4, 8, 32);
        r.plat(10, 14, 29);
        r.solid(19, 26, 29, 27);
        r.plat(12, 16, 23);
        r.plat(4, 8, 20);
        r.ent('mover', 9, 17, { id: 's1_mover', w: 4, ax: 9, bx: 20, ay: 17, by: 17, speed: 95 });
        r.plat(25, 29, 17);
        r.plat(20, 24, 14);
        r.ent('spitter', 27, 25);
        r.ent('flyer', 14, 7);
        r.ent('glint', 6, 31, { id: 'g_s1a', n: 4 });
        r.ent('glint', 27, 16, { id: 'g_s1b', n: 5 });
        r.ent('hint', 7, 19, { act: 'none', text: 'Ride the shuttle', range: 4 });
        r.deco('threads', 6, 0, { h: 20, layer: 'back' });
        r.deco('threads', 24, 0, { h: 14, layer: 'back' });
    });

    R({ id: 'S2', area: 'spindle', name: 'Weavers’ Hall', x: 156, y: 72, w: 34, h: 28 }, (r) => {
        r.air(1, 3, 32, 19);
        r.air(0, 7, 0, 10);
        r.solid(1, 11, 9, 19); // west <- S1
        r.solid(10, 14, 12, 19);
        r.solid(13, 17, 15, 19);
        r.air(33, 16, 33, 19); // east -> S3
        r.ent('lantern', 19, 19, { id: 'lan_s2' });
        r.ent('shrine', 31, 19, { ability: 'parry' });
        r.ent('npc', 26, 19, { who: 'odo' });

        r.ent('sign', 5, 10, {
            title: 'Guild Notice',
            text: ['HALL OF THE WEAVERS’ CONCORD', 'Mind the shuttles. Mend what frays. Ring at dusk.'],
        });

        r.deco('loom', 8, 20, { layer: 'back' });
        r.deco('spools', 23, 20, { layer: 'back' });
        r.light(19, 16, 7, '#ffcf8a', { a: 0.3 });
        r.light(27, 15, 5, '#ffcf8a', { a: 0.2 });
    });

    R({ id: 'S3', area: 'spindle', name: 'Loom Gallery', x: 190, y: 72, w: 34, h: 28 }, (r) => {
        r.air(1, 1, 32, 25);
        r.air(0, 16, 0, 19);
        r.solid(1, 20, 8, 25); // west <- S2
        r.air(10, 26, 12, 27); // down -> S4
        r.air(27, 0, 29, 0); // up -> S5
        r.solid(26, 14, 32, 15);
        r.plat(9, 12, 23);
        r.plat(21, 24, 23);
        r.plat(15, 18, 20);
        r.plat(21, 24, 17);
        r.plat(21, 24, 11);
        r.plat(26, 30, 8);
        r.plat(21, 24, 5);
        r.plat(26, 30, 3);
        r.ent('sentinel', 19, 25);
        r.ent('spitter', 30, 13);
        r.ent('flyer', 13, 8);
        r.ent('glint', 31, 7, { id: 'g_s3a', n: 5 });
        r.deco('loom', 16, 26, { layer: 'back', scale: 1.2 });
        r.deco('threads', 4, 0, { h: 18, layer: 'back' });
    });

    R({ id: 'S4', area: 'spindle', name: 'Shrine of the Swift Stitch', x: 166, y: 100, w: 40, h: 24 }, (r) => {
        r.air(1, 1, 38, 16);
        r.air(34, 0, 36, 0); // up <- S3
        r.air(6, 17, 8, 23); // drop -> M4
        r.air(12, 17, 19, 21);
        r.solid(18, 20, 19, 21); // practice gap (8 wide, safe)
        r.plat(30, 33, 14);
        r.plat(35, 38, 11);
        r.plat(30, 33, 8);
        r.plat(35, 38, 5);
        r.plat(33, 37, 3);
        r.ent('shrine', 25, 16, { ability: 'dash' });

        r.ent('sign', 3, 16, {
            title: 'Chute',
            text: ['A weaver’s chute, dropping to the Sundered Span below.'],
            small: true,
        });

        r.ent('hint', 21, 15, { act: 'dash', text: 'Dash across', range: 5, needs: 'dash' });
        r.light(25, 12, 8, '#ffe2b0', { a: 0.35 });
    });

    R({ id: 'S5', area: 'spindle', name: 'Belfry Gatehouse', x: 214, y: 44, w: 48, h: 28 }, (r) => {
        r.air(1, 2, 45, 23);
        r.air(3, 24, 5, 27); // down -> S3
        r.air(46, 20, 47, 23);
        r.gate(46, 20, 47, 23, 'bell2', { kind: 'bars' }); // east -> S6 (lift)
        r.gate(22, 0, 24, 1, 'belfry_open', { kind: 'seal' }); // up -> B1
        r.plat(16, 19, 21);
        r.plat(21, 25, 18);
        r.plat(16, 19, 15);
        r.plat(21, 25, 12);
        r.plat(16, 19, 9);
        r.plat(21, 25, 6);
        r.plat(22, 24, 4);
        r.solid(1, 14, 6, 15); // a ledge only a dash can reach
        r.ent('pickup', 3, 13, { kind: 'spool', id: 'spool_s5' });
        r.ent('seal', 23, 1, {});

        r.ent('sign', 10, 23, {
            title: 'The Belfry Seal',
            text: [
                'THE BELFRY SEAL',
                'Two toll-looms bind it: one in the deep Hollow, one beyond the Sundered Span.',
                'When both sing, the way above will open.',
            ],
        });

        r.ent('flyer', 33, 14);
        r.light(23, 3, 6, '#e7d6ff', { a: 0.25 });
    });

    R({ id: 'S6', area: 'spindle', name: 'Cord Lift', x: 262, y: 44, w: 32, h: 112 }, (r) => {
        r.air(3, 2, 28, 109);
        r.air(0, 20, 2, 23); // west -> S5 (top station)
        r.air(0, 103, 2, 106); // west <- M8 (bottom station)
        r.air(29, 20, 31, 23);
        r.solid(9, 24, 31, 24); // east -> F1 (Ashen Ramparts), off the top station

        r.ent('sign', 26, 23, {
            title: 'Rampart Door',
            text: ['A way out of the shaft: a barbican door, hung open.', 'Torchlight flickers beyond.'],
            small: true,
        });

        r.ent('lift', 3, 107, { id: 's6_lift', w: 4, top: 24, bottom: 107, flag: 'bell2', speed: 520 });
        r.deco('cords', 5, 0, { h: 107, layer: 'back' });
        r.deco('gears', 18, 30, { layer: 'back' });
        r.deco('gears', 22, 70, { layer: 'back', scale: 0.8 });

        r.ent('sign', 1, 106, {
            title: 'Cord Lift',
            text: ['THE CORD LIFT', 'Driven by the second toll-loom. Its cords hang slack while the loom is silent.'],
            small: true,
        });
    });

    // ============================ THE SILENT BELFRY ============================
    R({ id: 'B1', area: 'belfry', name: 'Belfry Steps', x: 214, y: 8, w: 48, h: 36, zoom: 0.94 }, (r) => {
        r.air(1, 1, 46, 31);
        r.air(22, 32, 24, 35); // up from S5
        r.air(0, 7, 0, 10);
        r.solid(1, 11, 9, 12); // west -> B2
        r.solid(2, 29, 8, 31);
        r.solid(12, 26, 18, 27);
        r.solid(3, 23, 9, 24);
        r.solid(13, 20, 19, 21);
        r.solid(3, 17, 9, 18);
        r.solid(13, 14, 19, 15);
        r.solid(32, 29, 36, 31);
        r.solid(40, 26, 46, 31);

        r.ent('sign', 38, 31, {
            title: 'Overlook',
            text: [
                'From here the bell-keepers watched the city sleep.',
                'Every dusk the Belfry answered the looms below. Now nothing rings at all.',
            ],
        });

        r.ent('cache', 43, 25, { id: 'gc_b1', n: 30 });
        r.ent('flyer', 16, 8, { variant: 'pale' });
        r.ent('flyer', 32, 16, { variant: 'pale' });
        r.ent('hopper', 28, 31, { variant: 'pale' });
        r.deco('bellbig', 30, 2, { layer: 'back', scale: 1.0, swing: 0.03 });
        r.trigger(1, 1, 46, 31, 'reveal', { once: 'reveal_b1' });
    });

    R({ id: 'B2', area: 'belfry', name: 'Hall of Silent Bells', x: 150, y: 4, w: 64, h: 30 }, (r) => {
        r.air(1, 2, 62, 26);
        r.solid(50, 15, 62, 26);
        r.air(63, 11, 63, 14); // east <- B1
        r.solid(41, 16, 44, 26);
        r.solid(28, 16, 32, 26);
        r.solid(18, 15, 22, 26);
        r.solid(1, 20, 10, 26);
        r.air(0, 16, 0, 19); // west -> B3
        r.thorns(11, 17, 26);
        r.thorns(23, 27, 26);
        r.thorns(33, 40, 26);
        r.thorns(45, 49, 26);
        r.plat(11, 14, 17);
        r.ent('pendulum', 36.5, 2, { len: 11.5, amp: 0.85, period: 3.4, phase: 0 });
        r.ent('pendulum', 25, 2, { len: 10.5, amp: 0.8, period: 3.0, phase: 1.3 });
        r.ent('sentinel', 56, 14, { variant: 'pale' });
        r.ent('flyer', 36, 7, { variant: 'pale' });
        r.ent('flyer', 14, 8, { variant: 'pale' });
        r.ent('glint', 30, 15, { id: 'g_b2a', n: 6 });
        r.ent('hint', 46, 15, { act: 'dash', text: 'Jump, then dash', range: 5, needs: 'dash' });
    });

    R({ id: 'B3', area: 'belfry', name: 'Cathedral Antechamber', x: 102, y: 0, w: 48, h: 30, zoom: 1.0 }, (r) => {
        r.air(1, 4, 46, 23);
        r.air(47, 20, 47, 23); // east <- B2
        r.solid(1, 21, 8, 23);
        r.ent('lantern', 15, 23, { id: 'lan_b3' });
        r.ent('shrine', 43, 23, { ability: 'dodge' });
        r.ent('hint', 38, 23, { act: 'dash', text: 'Dash as a blow lands: Shadow Step', range: 5, needs: 'dodge' });
        r.ent('door', 3, 20, {});

        r.ent('sign', 25, 23, {
            title: 'Keeper’s Tablet',
            text: [
                'THE CATHEDRAL OF THE LAST TOLL',
                'Here the keepers laid down their mallets.',
                'The great doors have not opened since the silence.',
            ],
        });

        r.ent('sign', 36, 23, {
            title: 'Scratched Plea',
            text: ['Someone carved this in a hurry:', '“The bells did not break. They were stilled.”'],
        });

        r.deco('statue_keeper', 12, 24, { layer: 'back', scale: 1.0 });
        r.deco('statue_keeper', 31, 24, { layer: 'back', scale: 1.0, flip: true });
        r.deco('window', 22, 4, { layer: 'back' });
        r.deco('window', 40, 4, { layer: 'back' });
        r.trigger(1, 4, 20, 23, 'objective', { once: 'reached_cathedral' });
        r.light(15, 20, 6, '#ffd59a', { a: 0.25 });
    });

    // ============================ THE CATHEDRAL (Stage 2) ============================
    // Entered through the great doors of B3. East: a short vestibule where a cracked bell rolls its toll
    // along the floor (practice for the Warden's Peal). West: the arena under the Great Bell.
    R(
        {
            id: 'C1',
            area: 'cathedral',
            name: 'Cathedral of the Last Toll',
            x: 42,
            y: 4,
            w: 60,
            h: 26,
            zoom: 0.9,
            arena: { x0: 1, x1: 40, floor: 21 },
        },
        (r) => {
            r.air(1, 2, 58, 20);
            r.solid(41, 2, 58, 11); // vestibule ceiling and the wall above the portcullis
            r.gate(41, 12, 42, 20, 'arena_sealed', { kind: 'bars', invert: true, fixed: true });
            r.ent('exitdoor', 56, 20, {});
            r.ent('tollwave', 44, 20, {});

            r.ent('hint', 47, 16, {
                act: 'dash',
                text: 'Run at the toll, jump, then dash across',
                range: 5,
                needs: 'dash',
                unless: 'warden_met',
            });

            r.ent('sign', 53, 20, {
                title: 'Warden’s Vow',
                text: [
                    'Carved deep into the stone, in a keeper’s hand:',
                    '“I will hold the clapper, and the Great Bell shall never ring again.”',
                    'Beneath it, scratched much later: “When it tolls, the floor itself sings. Leap — and stitch across.”',
                ],
            });

            r.ent('warden', 10, 20, { facing: 1 });
            r.ent('greatbell', 20, 2, {});
            r.trigger(1, 2, 37, 20, 'warden');
            r.deco('window', 8, 3, { layer: 'back', scale: 1.1 });
            r.deco('window', 33, 3, { layer: 'back', scale: 1.1 });
            r.deco('statue_keeper', 2.6, 21, { layer: 'back', scale: 1.15 });
            r.deco('statue_keeper', 38.4, 21, { layer: 'back', scale: 1.15, flip: true });
            r.deco('deco_bf_banner', 14, 8, { layer: 'back', scale: 1.5, alpha: 0.75 });
            r.deco('deco_bf_banner', 27, 8, { layer: 'back', scale: 1.5, alpha: 0.75, flip: true });
            r.deco('statue_keeper', 47, 21, { layer: 'back', scale: 0.85 });
            r.light(8, 8, 7, '#cfe0ff', { a: 0.22 });
            r.light(33, 8, 7, '#cfe0ff', { a: 0.22 });
            r.light(54, 18, 4, '#ffd59a', { a: 0.3 });
        },
    );
})(window.BW);

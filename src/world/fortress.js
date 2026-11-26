'use strict';

// The Ashen Ramparts, dressed with the fortress art: a side branch off the Cord Lift's top station (S6 -> F1) whose last
// room, the Rampart Gatehall, is the way on to the Hushed Gallery (hushed.js).
(function (BW) {
    BW.AREAS.fortress = {
        id: 'fortress',
        name: 'The Ashen Ramparts',
        music: 'mus_belfry',
        amb: 'amb_belfry',
        dress: 'belfry',
        tex: 'tex_fortress',
        sky: '#0b1018',
        fog: '#33415c',
        ink: '#080b12',
        deep: '#04060b',
        rim: '#d9d2c4',
        moss: '#7d8a5a',
        light: '#ffc98a',
        glow: '#ffb35c',
        darkness: 0.3,
        particles: 'motes',
        bg: ['bg_fortress_far', 'bg_fortress_mid'],
        mapColor: '#9a5f55',
    };

    const R = BW.defineRoom;
    const DUSK = ['bg_fortress_dusk', 'bg_fortress_mid'];

    // ground-standing prop helper: x in tiles, floor row in tiles, size = drawn height in px
    const prop = (r, name, x, floor, size, extra) =>
        r.deco('deco_ft_' + name, x, floor, Object.assign({ size, layer: 'back' }, extra || {}));

    const brazier = (r, x, floor) => {
        prop(r, 'brazier', x, floor, 150);
        r.light(x, floor - 3, 6, '#ffb35c', { a: 0.45 });
    };

    R({ id: 'F1', area: 'fortress', name: 'Ashen Barbican', x: 294, y: 44, w: 56, h: 30 }, (r) => {
        r.air(0, 20, 6, 23); // west <- S6 (tunnel on a ledge)
        r.air(7, 3, 54, 26);
        r.air(55, 22, 55, 26); // east -> F2
        r.plat(14, 19, 24);
        r.plat(22, 27, 21);
        r.plat(33, 38, 24);
        r.solid(41, 24, 46, 26);
        r.thorns(30, 32, 27);
        r.ent('lantern', 11, 26, { id: 'lan_f1' });

        r.ent('sign', 4, 23, {
            title: 'Barbican Plaque',
            text: ['THE ASHEN BARBICAN', 'The garrison kept the Belfry road. Their banners outlived them.'],
        });

        r.ent('crawler', 20, 26);
        r.ent('sentinel', 36, 26);
        r.ent('crawler', 51, 26);
        r.ent('flyer', 27, 9);
        r.ent('glint', 24, 20, { id: 'g_f1a', n: 5 });
        prop(r, 'banner', 9, 27, 360);
        prop(r, 'banner', 40, 27, 360, { flip: true });
        brazier(r, 15, 27);
        brazier(r, 31, 27);
        prop(r, 'arch', 22, 27, 320, { alpha: 0.75 });
        prop(r, 'barricade', 49, 27, 110, { layer: 'front' });
        prop(r, 'shield', 44, 24, 100);
        prop(r, 'chains', 26, 8, 190);
    });

    R({ id: 'F2', area: 'fortress', name: 'Siege Gallery', x: 350, y: 44, w: 64, h: 34 }, (r) => {
        r.air(0, 22, 0, 26); // west <- F1
        r.air(1, 3, 62, 30);
        r.air(63, 24, 63, 30); // east -> F3
        r.solid(1, 27, 8, 30); // entry shelf
        r.solid(44, 28, 50, 30); // step up to the east gate
        r.thorns(9, 24, 31);
        r.thorns(36, 40, 31);
        r.plat(10, 13, 25);
        r.plat(15, 18, 22);
        r.plat(20, 23, 25);
        r.plat(52, 56, 25);
        r.plat(57, 61, 22);
        r.ent('spitter', 6, 26);
        r.ent('sentinel', 30, 30);
        r.ent('crawler', 42, 30);
        r.ent('hopper', 58, 30);
        r.ent('flyer', 36, 12);
        r.ent('flyer', 18, 12);
        r.ent('cache', 59, 21, { id: 'gc_f2', n: 35 });

        r.ent('sign', 4, 26, {
            title: 'Siege Gallery',
            text: [
                'Spear racks and barricades line the walls.',
                'Mind the pits: the garrison dug them for the besiegers, and never filled them in.',
            ],
        });

        prop(r, 'spears', 7, 27, 220);
        prop(r, 'barricade', 28, 31, 110);
        prop(r, 'barricade', 46, 28, 100, { layer: 'front' });
        prop(r, 'gargoyle', 33, 31, 170);
        prop(r, 'banner', 62, 31, 380);
        brazier(r, 3, 27);
        brazier(r, 27, 31);
        brazier(r, 54, 31);
        prop(r, 'chains', 33, 9, 220);
        prop(r, 'chains', 14, 9, 180);
        r.light(33, 18, 7, '#ffb35c', { a: 0.2 });
    });

    R({ id: 'F3', area: 'fortress', name: 'Gilded Terrace', x: 414, y: 44, w: 48, h: 34, bg: DUSK }, (r) => {
        r.air(0, 24, 0, 30); // west <- F2
        r.air(1, 4, 46, 30);
        r.air(47, 21, 47, 24); // east -> F4 (the throne vestibule)
        r.solid(30, 28, 46, 30);
        r.solid(34, 25, 46, 27);
        r.plat(8, 13, 28);
        r.plat(16, 21, 25);
        r.plat(24, 29, 28);
        r.ent('lantern', 6, 30, { id: 'lan_f3' });

        r.ent('sign', 3, 30, {
            title: 'Gilded Terrace',
            text: [
                'Sunset still lingers on this terrace.',
                'East, past the portal, a throne room waits. Rest at the lantern first.',
            ],
        });

        r.ent('crawler', 22, 30);
        r.ent('cache', 44, 24, { id: 'gc_f3', n: 60 });
        r.deco('deco_ft_portal', 39, 25, { size: 440, layer: 'back' });
        r.light(39, 20, 8, '#cfe0ff', { a: 0.35 });
        prop(r, 'banner', 2, 31, 380);
        prop(r, 'gargoyle', 28, 31, 170);
        brazier(r, 11, 31);
        brazier(r, 20, 31);
    });

    // The Rampart Gatehall: the way on to the Hushed Gallery (src/world/hushed.js). Black veils hang across the east tunnel
    // and will not part until the Great Bell has rung (flag great_bell). The floor row is 25, level with F3's terrace.
    R({ id: 'F4', area: 'fortress', name: 'Rampart Gatehall', x: 462, y: 44, w: 52, h: 34 }, (r) => {
        r.air(0, 21, 0, 24); // west <- F3
        r.air(1, 6, 41, 24); // the gatehall
        r.air(42, 21, 51, 24); // tunnel east -> H1 (the Hushed Gallery)
        r.gate(46, 21, 47, 24, 'great_bell', { kind: 'veil' }); // parts for the Great Bell's toll
        r.plat(10, 14, 22);
        r.plat(24, 28, 19);
        r.plat(31, 35, 22);

        r.ent('lantern', 6, 24, { id: 'lan_f4' });
        r.ent('sentinel', 22, 24);
        r.ent('flyer', 18, 12);
        r.ent('glint', 26, 18, { id: 'g_f4a', n: 6 });

        r.ent('sign', 3, 24, {
            title: 'Gatehall Plaque',
            text: [
                'THE RAMPART GATEHALL',
                'The garrison never went east of this hall. They said the road beyond was a funeral, and that nobody had come back from it who could still be spoken to.',
            ],
        });

        r.ent('sign', 40, 24, {
            title: 'The Black Veils',
            text: [
                'Black veils hang across the east tunnel, still as a held breath. They do not stir for the wind or the needle.',
                'They are tied with silver thread, and they are listening. Only a toll from the Great Bell itself would part them.',
            ],
        });

        prop(r, 'banner', 2, 25, 300);
        prop(r, 'banner', 9, 25, 300, { flip: true });
        prop(r, 'arch', 22, 25, 400, { alpha: 0.6 });
        prop(r, 'banner', 36, 25, 360, { flip: true });
        prop(r, 'gargoyle', 28, 25, 180);
        prop(r, 'spears', 14, 25, 200);
        brazier(r, 4, 25);
        brazier(r, 8, 25);
        brazier(r, 18, 25);
        brazier(r, 32, 25);
        prop(r, 'chains', 22, 7, 220);

        // the Gallery's veils creep out under the tunnel roof, with a cold glow beyond them
        for (const x of [43, 45, 47, 49])
            r.deco('deco_hg_veil', x, 21, { size: 150, hang: true, sway: 0.02, layer: 'back' });

        r.light(48, 22, 6, '#9fd8ff', { a: 0.3 });
    });
})(window.BW);

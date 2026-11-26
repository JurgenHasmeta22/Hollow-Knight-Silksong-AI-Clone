'use strict';

// Chapter II's Archive pages, lore notes and region interlude: the Hushed Gallery and everything in it. These extend the
// tables in codex.js and lore.js (which load first) so the older files stay untouched.
(function (BW) {
    // ================================================================ bestiary
    const BEASTS = [
        {
            id: 'hushling',
            name: 'Hushling',
            epithet: 'Small, quick and quiet',
            habitat: 'The Hushed Gallery',
            sprite: 'hushling_crawl',
            frame: 0,
            hp: 3,
            glints: 2,
            parry: true,
            hint: 'Something small and black crouches among the first veils.',
            lore: [
                'The children of the mourners, or what the Gallery made of them. They were taught that a loud child brings the Keepers, and they learned the lesson all the way down to the bone.',
                'Their masks are as blank as their elders’. They have no faces to cry with, and they do not need them.',
            ],
            habits: 'Crouches and listens, then creeps toward you on all fours. Close in, it coils with a cold glimmer under its mask and pounces in an arc. It lands flat and dazed.',
            notes: 'Back off the pounce and strike it while it lies on its belly, or parry it for a double-damage opening. A struck silent bell sends every Hushling in the room running at you.',
        },
        {
            id: 'drifter',
            name: 'Shroud Drifter',
            epithet: 'A funeral cloth with nobody inside',
            habitat: 'The Hushed Gallery',
            sprite: 'drifter_drift',
            frame: 0,
            hp: 3,
            glints: 3,
            parry: true,
            hint: 'A shroud drifts under the high ceilings, with no body to carry it.',
            lore: [
                'The cloths that were hung over the dead, and never taken down. They kept the shape of their mourners long after the mourners were gone.',
                'Long arms hang beneath them, far longer than any body could need. They were never meant for walking.',
            ],
            habits: 'Drifts slowly above you, keeping to one side. When it is near it crosses its arms over its mask and hangs still, then dives in a straight line with both arms held out like spears, and tumbles away dazed.',
            notes: 'The tell is long. Wait for the arms to cross, then dash or step aside from the line of the dive. It is frail and falls to a few strikes while it spins.',
        },
        {
            id: 'stilt',
            name: 'Stilt Mourner',
            epithet: 'Patience on long legs',
            habitat: 'The Hushed Gallery',
            sprite: 'stilt_idle',
            frame: 0,
            hp: 6,
            glints: 4,
            parry: true,
            hint: 'Something tall paces the crypt below, very slowly.',
            lore: [
                'The tallest of the Gallery’s mourners, so that they could lay a hand on the veils at the top of the vault. They are patient to a fault.',
                'They never hurry. They only arrive.',
            ],
            habits: 'Paces a stretch of floor and turns slowly. Once it has found you it stalks closer, then leans away with one arm drawn far behind it and lunges, its arm and body crossing half the room. It stands open for a moment afterwards.',
            notes: 'It reaches farther than it looks. Stay outside its leaning distance, or step in just as the arm is drawn back and strike from the side. A parry on the lunge leaves it open for a long time.',
        },
        {
            id: 'reacher',
            name: 'Gallows Reacher',
            epithet: 'It hangs where you will walk',
            habitat: 'The Hushed Gallery',
            sprite: 'reacher_hang',
            frame: 0,
            hp: 5,
            glints: 3,
            parry: true,
            hint: 'Look up. Something grips the stone above the path.',
            lore: [
                'Some of the mourners could not bear to stand over their dead, and so they hung over them instead, gripping the vault with arms grown long on the habit.',
                'They are not hiding. They are waiting, which to the Hushed is the same thing as being kind.',
            ],
            habits: 'Hangs from the underside of the stone, still as a coat on a hook. When you pass beneath it, it curls up tight and trembles, then drops straight down. It lands folded and dazed, then fights low and fast from the floor.',
            notes: 'Do not stand under it when it trembles. Step out from beneath it and strike while it is folded up on the floor. A struck silent bell pulls every Reacher in the room off the ceiling at once.',
        },
        {
            id: 'brute',
            name: 'Shade Brute',
            epithet: 'The weight that was never put down',
            habitat: 'The Hushed Gallery',
            sprite: 'brute_idle',
            frame: 0,
            hp: 9,
            glints: 6,
            parry: true,
            hint: 'Something enormous guards the candles at the end of the aisle.',
            lore: [
                'The pallbearers. They carried the dead into the Gallery and were told to wait; no one told them they could put the weight down.',
                'They guard the candles now. They will let nothing near the flames, because the flames are the last thing they were asked to keep.',
            ],
            habits: 'Knuckle-walks slowly and does not stop for a blow. Close in, it raises both fists high with a cold glimmer and slams them into the floor, sending a low wave along the stone in both directions.',
            notes: 'Its fists are slow. Dash clear of the slam or parry it, jump the wave, then strike while its fists are buried. Do not stand in front of it.',
        },
        {
            id: 'mourner',
            name: 'The Long Mourner',
            epithet: 'Keeper of the Final Silence',
            habitat: 'The Hushed Gallery',
            sprite: 'mourner_idle',
            frame: 0,
            portrait: 'portrait_mourner',
            boss: true,
            parry: true,
            hint: 'Something huddled and blank waits at the far end of the Gallery.',
            lore: [
                'The first of the mourners, who sat a hundred nights with one body and could not be made to leave. The Keepers hung the first veil to give her quiet, and she took it as an order.',
                'She has been keeping the Gallery silent ever since. Every Hushed in it is her doing, and not one of them was ever told that the dead went quiet long ago.',
            ],
            habits: 'Its moves come from a shuffled bag. Its reach is long, its needles rise where you stand and its veils are thrown like nets. Below half health it grows faster, climbs the walls and ceiling, and learns to hold you.',
            notes: 'Learn each tell and answer it: parry the melee blows, jump the low waves and watch the floor for the marked needles. The Mourning Embrace cannot be parried. Shadow Step it or get clear.',
            moves: [
                [
                    'reach',
                    'Long Reach',
                    'It draws one long arm far back and shoots it across the arena. Stay out of its reach or parry the blow.',
                ],
                [
                    'needles',
                    'Needle Garden',
                    'It plants a needle and a row of them marches out. Each is marked on the floor a moment before it rises: step into a gap.',
                ],
                [
                    'veil',
                    'Veil Net',
                    'It throws a heavy black veil along the floor like a net. Find the gap or jump it.',
                ],
                ['rush', 'Scuttle Rush', 'It drops low on all fours and races across the arena. Jump or dash past.'],
                ['darts', 'Thread Darts', 'It flings aimed black darts from its veil, one after another. Keep moving.'],
                [
                    'stalk',
                    'Stalking Needles',
                    'It plants a needle and a trail follows you across the floor. Keep changing direction.',
                ],
                [
                    'hush',
                    'Silent Wail',
                    'Phase two. The music dies and low waves of silence roll out along the floor. Jump them, and then jump the echo.',
                ],
                [
                    'drop',
                    'Ceiling Drop',
                    'Phase two. It climbs the wall, follows you along the ceiling and then falls straight down where you stand.',
                ],
                [
                    'crawl',
                    'Overhead Crawl',
                    'Phase two. It races along the ceiling dropping marked needles, then falls. Watch above you.',
                ],
                [
                    'dance',
                    'Scuttle Dance',
                    'Phase two. It scuttles back and forth across the arena in several fast runs. Do not stop.',
                ],
                [
                    'pounce',
                    'Pounce',
                    'Phase two. It leaps at you in an arc and lands with a shockwave. Move out from under it.',
                ],
                [
                    'embrace',
                    'Mourning Embrace',
                    'Phase two. Its palms glow red and it lunges to hold you. It cannot be parried: Shadow Step it or get clear.',
                ],
            ],
        },
    ];

    for (const b of BEASTS) {
        BW.Codex.BEASTS.push(b);
        BW.Codex.BY_ID[b.id] = b;
    }

    // ================================================================ lore notes (x, y = the tile you stand on)
    const NOTES = [
        {
            id: 'veilmaker',
            room: 'H1',
            x: 5,
            y: 24,
            title: 'Veil-maker’s Tag',
            hint: 'Tied to a hook just inside the Gallery.',
            text: [
                'Black gauze, twelve ells, hemmed with silver thread. For the Gallery, by order of the Keepers.',
                'They did not say what the veils were for. They said only: “hang them so that nothing carries.”',
                'I have hung eight hundred. I have not once heard the Gallery answer.',
            ],
            from: 'the veil-maker',
        },
        {
            id: 'clothledger',
            room: 'H2',
            x: 9,
            y: 24,
            title: 'Cloth Ledger',
            hint: 'Left on the floor of the Hall of Hanging Veils.',
            text: [
                'Bells muffled this month: nineteen. Clappers cut: nineteen. Clappers kept, in case: none.',
                'The cutters ask why. The Keepers say the dead have asked for quiet.',
                'I asked the dead. They did not say anything, which I took for agreement.',
            ],
            from: 'a bell-muffler’s ledger',
        },
        {
            id: 'maskcarver',
            room: 'H3',
            x: 9,
            y: 24,
            title: 'Mask-carver’s Confession',
            hint: 'At the top of the stair into the Mask Crypt.',
            text: [
                'I carve the masks without faces because I was asked to. A face is something the dead can be recognised by, and recognition is a kind of calling.',
                'Eight hundred masks, and not one has had a single line cut into it.',
                'Some nights I think the masks are not for the dead. Some nights I think the dead are carving us.',
            ],
            from: 'the mask-carver',
        },
        {
            id: 'unbound',
            room: 'H4',
            x: 14,
            y: 40,
            title: 'Unbound Cloth',
            hint: 'On the floor at the foot of the Muffled Belfry.',
            text: [
                'Three bells in the shaft, three bindings. One slipped, once, in the dark.',
                'It did not ring. It only breathed, a long iron breath, and every veil in the shaft turned toward it.',
                'We tied it again before anything arrived. Something always arrives.',
            ],
            from: 'a scrap of binding cloth',
        },
        {
            id: 'candlekeeper',
            room: 'H5',
            x: 26,
            y: 24,
            title: 'The Candle-keeper’s Rule',
            hint: 'Between the candles of the Candlelit Aisle.',
            text: [
                'A candle for every name on the wall. Light them at dusk, never snuff them, never speak while you light.',
                'The heavy ones guard the flame at the end of the aisle. They are the ones who carried the dead here, and they never put the weight down.',
                'They are not cruel. They are tired, and they have forgotten how to be anything but heavy.',
            ],
            from: 'the candle-keeper',
        },
        {
            id: 'firstmourner',
            room: 'H6',
            x: 15,
            y: 24,
            title: 'The First Mourner',
            hint: 'Cut into the stone beside the bier.',
            text: [
                'Before the Gallery there was one mourner, who sat with a single body for a hundred nights and would not let it be carried out.',
                'When the Keepers came she asked them for quiet. Quiet for the dead, quiet for her. They hung the first veil to give it to her.',
                'It was kind. It was always kind. That is the whole of the tragedy.',
            ],
            from: 'a carving on the bier',
        },
        {
            id: 'mournerlast',
            room: 'H7',
            x: 45,
            y: 24,
            when: 'mourner_defeated',
            title: 'Last Words of the Long Mourner',
            hint: 'Something is left behind by the Long Mourner.',
            text: [
                'I kept them quiet. I kept them quiet. I kept them quiet.',
                'The dead never asked for it. I asked it for myself, and gave it their name.',
                'Ring them, Weaver. Softly, one by one. Let the Gallery learn that it may have a voice.',
            ],
            from: 'the Long Mourner',
        },
        {
            id: 'altarscratch',
            room: 'H8',
            x: 24,
            y: 24,
            title: 'Beside the Altar',
            hint: 'Scratched into the floor of the Last Door Hall.',
            text: [
                'The Silent Key was set down here by the one who locked the Last Door, and she meant to come back for it.',
                'The door was never the thing to fear. It was only the last room of the house.',
                'Some doors are not locked to keep things in. They are locked to keep a house from remembering.',
            ],
            from: 'scratched into the altar’s base',
        },
    ];

    for (const n of NOTES) {
        BW.Lore.NOTES.push(n);
        BW.Lore.BY_ID[n.id] = n;
    }

    // ================================================================ region interlude: shown the first time you walk in
    BW.Lore.INTERLUDES.hushed = {
        id: 'hushed',
        kicker: 'The Hushed Gallery',
        title: 'Where Nothing May Ring',
        art: 'bg_gallery_realm',
        lines: [
            'The mourners hung their veils so that nothing in these halls would ever carry again.',
            'Every bell has had its clapper cut out and wrapped in black cloth, and everything that lives here is listening.',
        ],
    };
})(window.BW);

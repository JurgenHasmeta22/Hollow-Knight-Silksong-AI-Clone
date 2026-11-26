'use strict';

// THE UNCALLED: the Faceless Ronin's story. The same city, rooms, creatures and bosses as the Bellweaver's journey, told
// as a much darker tale. Only words change: the chapter slides, the region interludes, every lore note, Odo's talk, the
// title and the epilogue. The Bellweaver's text stays as written in lore.js / hushed.js and is restored whenever that
// hero is on the field.
//
//   BW.Lore.set('ronin' | 'weaver')   swaps the story in place (called from Game.setCharacter)
//   BW.Lore.epilogue(state)           the ending's lines for the hero of that save
//   BW.Lore.odo(state, key, fallback) one of Odo's lines
//
// The story, in one breath: nobody in the Hollow is born with eyes. Every child is veiled at its first toll and sees by
// the echo of a bell. The Weavers' Guild spins the cord of every bell from the hair and breath of the bound, and a bell
// that has a face pressed into its mouth sees truest. House Vael cast the Great Bell; on the hundredth dusk, when the Guild
// meant to toll it and tune the whole city to one mind, they refused. The Guild killed the House in a night and pressed
// their faces into the bronze. Orrin Vael, the eldest, gave the Guild their names to live, then heard his family in the
// metal and bound the clapper with his own body so the Long Toll would never ring. The youngest Vael, the House's sword,
// woke among the dead with his face cut away, and so the bells cannot find him. He wears a blank mask from the Mask Crypt
// and climbs the city to the Great Bell.
(function (BW) {
    const L = BW.Lore;

    if (!L) return;

    // ================================================================ title
    const TITLES = {
        weaver: { name: 'BELLWEAVER', tag: 'a thread through the silent bells', doc: 'Bellweaver' },
        ronin: { name: 'THE UNCALLED', tag: 'a face the bells cannot call', doc: 'The Uncalled' },
    };

    // ================================================================ the opening chapters
    const INTRO = [
        {
            kicker: 'I',
            title: 'The City That Sees by Sound',
            art: 'bg_belfry_far',
            lines: [
                'No one in the Hollow was ever born with eyes. They were born with a bell.',
                'Every child is veiled at the first toll, and sees through the echo for the rest of its life: the walls, the roads, the faces of those it loves, all drawn in sound.',
            ],
        },
        {
            kicker: 'II',
            title: 'The Weavers’ Concord',
            art: 'bg_spindle_far',
            lines: [
                'The Bellweavers tended the looms, and the looms spun the cord that hung every bell. Every bell answered to a thread, and every thread to a hand.',
                'Nobody was ever told what the cord was spun from. Nobody was permitted to ask.',
            ],
        },
        {
            kicker: 'III',
            title: 'The Hundredth Dusk',
            art: 'bg_cathedral_far',
            lines: [
                'On the hundredth dusk the Concord would ring the Great Bell and tune every mind in the city to a single note. The House of Vael, who had cast the bell, refused to finish it.',
                'By dawn the House was dead, and their faces hung in the bronze. The bell was never rung. Orrin Vael, the eldest, sealed its clapper with his own hands, and no one has been told why.',
            ],
        },
        {
            kicker: 'IV',
            title: 'The Heap Below',
            art: 'bg_mosslit_far',
            lines: [
                'The dead were thrown down the Fallen Light with their faces cut away, and the deep places took whatever the Concord did not.',
                'Things began to wander there that had no right to walk. Nobody climbed the Belfry to ask why. Nobody left alive had a face to climb with.',
            ],
        },
        {
            kicker: 'V',
            title: 'The Faceless',
            art: 'title_art',
            lines: [
                'One of the dead woke. It had no face, and so the bells could not find it.',
                'Take up the blades. Walk the city to the Great Bell. Cut every cord between here and the top.',
            ],
        },
    ];

    // ================================================================ region interludes
    const INTERLUDES = {
        spindle: {
            kicker: 'The Spindleworks',
            title: 'Where the Cords Were Spun',
            lines: [
                'Here the Concord spun the cord for every bell in the city.',
                'The looms still hum, softly, in many voices, as if every thread remembers having been someone.',
            ],
        },
        belfry: {
            kicker: 'The Silent Belfry',
            title: 'Mouths Open, Clappers Bound',
            lines: [
                'The great bells hang with their mouths open to the sky, and every mouth is lined with a face.',
                'Not one has rung since the Last Toll. Every clapper is a person, and every one has been tied with the same careful knot.',
            ],
        },
        hushed: {
            kicker: 'The Hushed Gallery',
            title: 'Where the Dead May Not Be Called',
            lines: [
                'The Keepers hung their veils so that no bell could ever find the dead and ring them.',
                'Every clapper here is cut out and wrapped in black cloth, and everything that lives here is listening for its own name.',
            ],
        },
    };

    // ================================================================ the lore notes (same ids, rooms and places as the originals)
    const NOTES = {
        ledger: {
            title: 'Lamplighter’s Ledger',
            text: [
                'Lanterns lit this dusk: forty. Faces counted on the heap below the ledge: I stopped at sixty.',
                'They throw the dead down the Fallen Light at the tenth toll. The lamps will not stay lit above them. I think the lamps are ashamed.',
                'I will keep walking the route. Somebody should keep a light for them.',
            ],
        },
        rhyme: {
            title: 'Moss-gatherer’s Rhyme',
            text: [
                'Hush the bell and hush the town,',
                'tie the veil and tie it down.',
                'Count nine tolls and count them true. The tenth one has a face for you.',
            ],
            from: 'a children’s rhyme, stitched into a hood',
        },
        letter: {
            title: 'Apprentice’s Letter',
            text: [
                'Master, I carried the third cord up to the Spindleworks as you asked. The foreman says it is warm. He says it is the wrong kind of warm: it has a pulse.',
                'He says there is a name woven into every fathom, and that if you hold it to your ear it says it back.',
                'Please come down before the dusk toll. The grotto lantern is the last one that still lights for me.',
            ],
        },
        span: {
            title: 'Spanwright’s Warning',
            text: [
                'The Span did not fall. They cut it, the night the Vael were taken, so that nobody could run for the Belfry. I was standing on it.',
                'If you are reading this, you crossed. Do not trust a stone that hums. The Concord set listening-stones in every span, and a stone that hums is a stone that is reporting you.',
                'Build it for the swift, not for a walking pace. Nothing in this city is allowed to walk away any more.',
            ],
        },
        roots: {
            title: 'Root-keeper’s Tally',
            text: [
                'Day 1. The roots are warm and humming one low note.',
                'Day 9. The note has become a voice. It is saying a name, over and over.',
                'Day 14. It is not one name. It is all of them. I am going up, and I am not going back for my tools.',
            ],
        },
        thorns: {
            title: 'Thornwood Survey',
            text: [
                'The thorns were planted over the old drain to hold down whatever fell. Nobody ever told them to stop.',
                'They have grown over every path, and over every bone that still wears a scrap of veil.',
                'Survey note: this is what obedience grows into when the order outlives the one who gave it.',
            ],
        },
        verse: {
            title: 'Loom-singer’s Verse',
            text: [
                'Pull the cord and the bell will see,',
                'loose the cord and the dark is free.',
                'The loom does not ring the bell. The loom only keeps the tongue from speaking. Do not look for the tongue.',
            ],
        },
        hymn: {
            title: 'Drowned Chapel Hymn',
            text: [
                'The water rose the night the Vael went down the shaft, and the chapel bells rang under it. Nobody above heard. They had no clappers; they rang with the dead.',
                'We sang the last hymn waist-deep, and faces drifted by like lanterns.',
                'If you can read this, you wear the blank. Good. Only the faceless can walk through them in peace.',
            ],
        },
        foreman: {
            title: 'Shaft Foreman’s Log',
            text: [
                'The cord lift has stopped twice this week. The second toll-loom is starving: cord needs a tongue, and the Keepers have stopped sending them.',
                'I sent a runner east to the Sundered Span to ask for more. She has not come back. I think she has been added to the cord.',
                'If the Belfry Seal closes for good, nothing will ever be called again. Whoever you are: wake both looms. What they spin next will not be cord.',
            ],
        },
        gallery: {
            title: 'Gallery Inscription',
            text: [
                'The Gallery was built so that one weaver could stand at the centre and hear every loom, and every tongue, at once.',
                'On the last night, the weaver at the centre heard a voice beneath all the others: patient, and enormous. It was not a loom.',
                'She said it was the Great Bell, and that it was counting the faces.',
            ],
        },
        pilgrim: {
            title: 'Pilgrim’s Scrap',
            text: [
                'I came to the Shrine to learn the Swift Stitch. It teaches: a blade that cannot be found cannot be broken.',
                'The Warden at the top of the city is said to be the fastest of us all, and he does not move at all.',
                'The ones with faces fear him. I think it is because he remembers them.',
            ],
        },
        lift: {
            title: 'Liftkeeper’s Note',
            text: [
                'The lift is run by the second toll-loom. When the loom sings the lift climbs, and the shaft hums a fifth beneath the Great Bell.',
                'I rode it up once, in the old days. At the top every bell was shining, and every bell had a face in its mouth.',
                'I told myself it was a trick of the lamps. I wish I could say I remembered the sound.',
            ],
        },
        prayer: {
            title: 'Bell-keeper’s Prayer',
            text: [
                'Keep the mallet, keep the cord, keep the hour.',
                'Ring when the Concord asks, hush when it answers. Never ask whose face is in the bronze.',
                'And if the day comes when the Great Bell must be silenced for the city’s sake: let the one who stills it be the one who sold the house that cast it.',
            ],
        },
        oath: {
            title: 'The Mallet Oath',
            text: [
                'Every keeper swore it in this hall. “I will hold the bell, and the bell will hold the city.” Then they were shown what the bell was made of, and the oath was the only part they were allowed to keep.',
                'Nobody asked what becomes of a keeper who must hold on forever.',
                'There is a keeper in the Cathedral who took the oath at the price of his brothers. Pity him, if you can. Do not hesitate.',
            ],
        },
        name: {
            title: 'The Warden’s Name',
            text: [
                'His name was Orrin Vael, Keeper of the Last Toll, eldest of the House that cast the Great Bell.',
                'On the hundredth dusk he learned the long toll would not mend the Hollow: it would tune every living mind to the Concord’s one note. His House refused to cast it. He gave the Concord their names for his own life, and by dawn the House was dead.',
                'He has held the Great Bell silent ever since. He tells himself it is penance. It is only a longer way of dying.',
            ],
        },
        last: {
            title: 'Last Words of the Warden',
            text: [
                'Little brother. A face I could not read, and I should have known it was you by that alone.',
                'I held it too long. I forgot whom I was holding it against. Toll it, or break it: I never could tell which was the mercy.',
                'Tell the dead I kept the oath. Tell them I was never forgiven. Tell them I am tired.',
            ],
            from: 'Orrin Vael',
        },

        // ---- the Hushed Gallery
        veilmaker: {
            title: 'Veil-maker’s Tag',
            text: [
                'Black gauze, twelve ells, hemmed with silver thread. For the Gallery, by order of the Keepers.',
                'They said: hang them so that nothing carries. I asked what could be carried. They said: the names of the dead, and their faces.',
                'I have hung eight hundred. I have not once felt the Gallery lean toward me.',
            ],
        },
        clothledger: {
            title: 'Cloth Ledger',
            text: [
                'Bells muffled this month: nineteen. Clappers cut: nineteen. Tongues freed: none.',
                'The cutters ask what a bell does without its tongue. The Keepers say it keeps the dead from being rung.',
                'I asked the dead. They did not answer, which I chose to take for agreement.',
            ],
        },
        maskcarver: {
            title: 'Mask-carver’s Confession',
            text: [
                'I carve masks without faces because the Keepers asked it. A face is how a bell finds a name, and a name is how a bell rings the dead.',
                'Eight hundred masks, and not one has had a single line cut into it.',
                'Some nights I think they are not for the dead at all. I think they are for whoever the dead send to collect what was taken.',
            ],
        },
        unbound: {
            title: 'Unbound Cloth',
            text: [
                'Three bells in the shaft, three bindings. One slipped, once, in the dark.',
                'It did not ring. It breathed: a long iron breath, and every veil in the shaft turned toward it as if it had been called by name.',
                'We tied it again before anything arrived. Something always arrives.',
            ],
        },
        candlekeeper: {
            title: 'The Candle-keeper’s Rule',
            text: [
                'A candle for every name on the wall. Light it at dusk, never snuff it, never say the name aloud.',
                'The heavy ones guard the flame at the end of the aisle. They carried the dead here from the Fallen Light and have never put the weight down.',
                'They are not cruel. They are only the last ones still obeying.',
            ],
        },
        firstmourner: {
            title: 'The First Mourner',
            text: [
                'Before the Gallery there was one mourner, who sat with a single body for a hundred nights and would not let it be carried out.',
                'The Keepers did not stop her. They hung the first veil, and called it a kindness.',
                'It was always a kindness. That is how it begins, and that is how it is allowed to go on.',
            ],
        },
        mournerlast: {
            title: 'Last Words of the Long Mourner',
            text: [
                'I kept them quiet. I kept them quiet. I kept them quiet.',
                'They never asked for it. I asked it for myself, and gave it their names.',
                'You wear the blank, so you are neither one of them nor one of us. Ring them, Faceless. Once each, and softly. Let them be called by their own names, and then let them go.',
            ],
        },
        altarscratch: {
            title: 'Beside the Altar',
            text: [
                'The Silent Key was set down here by the one who locked the Last Door, and she meant to come back for it.',
                'The door was never the thing to fear. It is only the last room of the house: the room where the faces are kept.',
                'Some doors are locked to keep things in. This one was locked to keep a house from remembering.',
            ],
        },
        choirmaster: {
            title: 'The Choirmaster’s Score',
            text: [
                'A hundred voices, a hundred names, and one line of music for all of them: a rest, held for as long as the Gallery stands.',
                'They were singers once. Now they are held notes, and I conduct them every night. They have never once come in early.',
            ],
        },
        bellwright: {
            title: 'The Bellwright’s Tuning',
            text: [
                'Deepest, then lower-middle, then higher-middle, then the bright one: that was the scale I was given to cast.',
                'I asked to hear it once, whole, before the clappers were wrapped. They said it is the one thing nobody may hear, because it is the sound the faces make when they are all called at once.',
            ],
        },
        cutterslast: {
            title: 'The Last Cutter',
            text: [
                'I cut every veil in the Gallery, and every hatch cloth, and every cloth that bound a door. My shears are on the altar for whoever is brave enough to need them.',
                'Under each scrap I sewed there is a face somebody wanted kept from the bells. I hope they were right to hide them.',
            ],
        },
        stairkeeper: {
            title: 'The Stair-keeper’s Count',
            text: [
                'Thirty-three steps down, and thirty-three back up. I counted them every day for forty years and they never changed.',
                'Many came down. None came up. I stopped counting those. It was the last thing in the Gallery that kept its word.',
            ],
        },
        folderslist: {
            title: 'The Folder’s List',
            text: [
                'Six thousand veils folded and sorted by height. The ones that were still warm I carried to the far side of the pit, where the thorns are.',
                'A shuttle takes them across. It has never been asked to carry anything back.',
            ],
        },
        bearerslay: {
            title: 'The Bearers’ Lay',
            text: [
                'We carried them down, and down, and down, and we were promised that someone would come to take them from us.',
                'Three voices, struck in any order, will tell the veil to part. We never found anyone who knew all three, and in time we stopped listening for the first.',
            ],
        },
        reliquarist: {
            title: 'The Reliquarist’s Inventory',
            text: [
                'Item: one hundred and four bells, cast between the first mourning and the last. Item: one hundred and four clappers, not one of them cut. Item: one hundred and four faces, pressed into the bronze, none returned.',
                'Item: a thread of life, left on the dais for the one who asks properly.',
            ],
        },
        veilmakercell: {
            title: 'The Veil-maker’s Letter',
            text: [
                'I asked the Keepers what the veils were for, and they said: so that nothing carries. I asked what could be carried. They said: everything that matters.',
                'I have thought about it every night in this cell. I do not think they were talking about sound. I think they meant the faces.',
            ],
        },
        vaultclerk: {
            title: 'The Vault Clerk’s Ledger',
            text: [
                'Spares in stock: all of them. Spares ever issued: none. Spares I am permitted to unwrap for a visitor: none, unless the visitor asks for the one in the corner.',
                'The one in the corner is a spool of silk wound from the hair of the House of Vael. I did not wind it. I only stored it, and nobody ever asked.',
            ],
        },
        biercellar: {
            title: 'Beneath the Bier',
            text: [
                'The First Mourner did not climb out of the bier. She went down.',
                'She sat in this cellar for a very long time, with a lantern, listening to the Gallery being kept quiet over her head.',
                'I think she meant to say a name, once. I think the quiet got there first.',
            ],
        },
    };

    // ================================================================ Odo, the lamplighter: the same stages as the original talk
    const ODO = {
        met_a: 'Oh. A face I cannot hear. You are the blank one, aren’t you? Don’t mind me: Odo sees nothing at all, and has made his peace with it. I keep these lamps lit for whoever still walks the dark.',
        met_b: 'The Belfry has been sealed since the Last Toll. Two old toll-looms hold its seal. Wake them both and the way up should open, though what they spin when they wake is not mine to say.',
        met_c: 'One loom hangs in the deep roots below the Hollow. The other lies past the Sundered Span… and nobody has crossed that since the night they cut it.',
        parry: 'Before you go further, touch the shrine at the far end of this hall. They called it the Answering Toll: it teaches you to turn a blow aside. Not everything that bears down on you deserves to be met head-on.',
        dash: 'There is a shrine past the Loom Gallery where the Concord’s swords learned their swiftest stitch. Down through the gallery floor, if memory serves. They taught it to be unfindable. You are halfway there already.',
        bell2: 'That stitch of yours! With it you could cross the Sundered Span, east of the Lantern Grotto. The second loom waits beyond. Mind the stones. They listen.',
        bell1: 'The first loom is still slack. Follow the roots down from the Lantern Grotto, then west through the thorns. They have a taste for anything that still breathes.',
        looms: 'Both looms are awake. I felt it in my teeth. The seal above the Gatehouse should be open. Go up, and may they never find your face.',
        clear: 'You went through the Last Door? Every lamp I own turned toward the east at once. I think the quiet you left behind is the good kind. The kind where the dead have finished being called.',
        key: 'A key with no voice… The Last Door is at the end of that hall, they say. Whatever is kept behind it, you are the first who can open it without being called by it.',
        mourner_done:
            'Did you feel that? The whole Gallery let out a breath it had been holding for a thousand dusks. Look for an altar.',
        mourner_met:
            'Still on your feet? Good. The Long Mourner is only a mourner. She will weep, and what she weeps for will try to hold you. Rest at the lantern outside her door.',
        hushed: 'The Hushed Gallery… my grandmother’s grandmother hung those veils. Ring the bells in there if you must, but expect company. The silent ones hear everything, and nothing in there has ever been allowed to say a name.',
        gb_a: 'That sound… the Great Bell. I never thought I would hear it again. Every lamp in the Hollow is burning brighter, and every bell is telling a name. Thank you, whoever you are.',
        gb_b: 'And there is something else. The black veils at the end of the Ashen Ramparts, east of the Cord Lift: I saw them move from the lift. Veils do not move. They are listening for you.',
        warden_done:
            'The air feels lighter. Whatever guarded the cathedral is gone, isn’t it? Then the Great Bell is waiting for you, and you know what it is made of.',
        cathedral_open:
            'I heard the great doors groan open, all the way down here. Something keeps the Great Bell silent, and it is not a monster. Rest at the lantern before you meet it. It will know you by your sword.',
        dreams: 'You have seen the great doors, then. Strange… lately I hear a bell in my dreams. Just one. Very slow. It sounds like someone saying a name they are not allowed to finish.',
    };

    // ================================================================ the ending
    const EPILOGUE = [
        'The Faceless one rang the Great Bell, once, and the Belfry answered.',
        'Every bell in the Hollow tolled for the face pressed into its mouth, and for one breath, every face had a voice.',
        'Then the clappers fell still, the cords went slack, and the dead were no longer called.',
        'The city is blind again. Truly, mercifully blind. And above the bronze, a brother’s grave is quiet.',
    ];

    // ================================================================ swapping the story
    // the originals, taken once from the finished lore (Bellweaver) text, so set('weaver') can put them back
    const base = {
        intro: INTRO.length && L.INTRO.slice(),
        inter: {},
        notes: {},
    };

    for (const k in INTERLUDES) if (L.INTERLUDES[k]) base.inter[k] = Object.assign({}, L.INTERLUDES[k]);

    for (const n of L.NOTES) base.notes[n.id] = { title: n.title, hint: n.hint, text: n.text, from: n.from };

    L.hero = 'weaver';

    L.set = function (id) {
        const R = id === 'ronin';

        L.hero = R ? 'ronin' : 'weaver';
        L.INTRO.splice(0, L.INTRO.length, ...(R ? INTRO : base.intro));

        for (const k in INTERLUDES) {
            if (!L.INTERLUDES[k]) continue;

            Object.assign(L.INTERLUDES[k], base.inter[k], R ? INTERLUDES[k] : null);
        }

        for (const n of L.NOTES) Object.assign(n, base.notes[n.id], R ? NOTES[n.id] : null);

        BW.TITLE = Object.assign({}, TITLES[L.hero]);
        BW.Audio.setTheme(L.hero);

        try {
            document.title = BW.TITLE.doc;
        } catch (e) {
            /* no document (node checks) */
        }
    };

    L.epilogue = function (st) {
        return st && st.character === 'ronin' ? EPILOGUE : null;
    };

    // one of Odo's lines in the hero's own telling (or `fallback`, the original, when it is the Bellweaver's journey)
    L.odo = function (st, key, fallback) {
        return st && st.character === 'ronin' && ODO[key] ? ODO[key] : fallback;
    };

    // the Faceless Ronin is the only hero: his story, title and soundtrack are in place from the first frame
    L.set('ronin');

    BW.RoninLore = { TITLES, INTRO, INTERLUDES, NOTES, ODO, EPILOGUE };
})(window.BW);

'use strict';

// Archive data (Field Guide tab). Control tips and mechanics are always readable (a few unlock with abilities); the
// bestiary fills in as creatures are met in the world. Progress lives in state.codex and is saved with the game.
(function (BW) {
    const L = (a) => BW.Input.label(a);

    // body: a list of paragraphs. D is the difficulty preset of the save being viewed.
    const TIPS = [
        {
            id: 'move',
            cat: 'Basics',
            title: 'Moving & Jumping',
            keys: [
                ['Move', 'move'],
                ['Jump', 'jump'],
            ],
            body: () => [
                `Run with ${L('move')}. Hold ${L('jump')} to leap higher, and let go early for a short hop.`,
                `Thin platforms can be dropped through with ${L('down')} + ${L('jump')}.`,
            ],
        },
        {
            id: 'strike',
            cat: 'Combat',
            title: 'Blade Strike',
            keys: [
                ['Strike', 'attack'],
                ['Aim up', 'up'],
                ['Aim down', 'down'],
            ],
            body: () => [
                `Press ${L('attack')} to strike. Hold ${L('up')} to strike upward, or ${L('down')} while airborne to strike downward.`,
                'A downward strike bounces you off foes and thorns, and lets you dash again in mid-air.',
                'Every blow that lands gathers a thread of silk.',
            ],
        },
        {
            id: 'mend',
            cat: 'Combat',
            title: 'The Healing Gourd',
            keys: [['Drink', 'heal']],
            body: () => [
                `Hold ${L('heal')} to drink from the Healing Gourd and mend two bells. You start with three draughts; they fill again at every lantern and when you wake after a fall.`,
                'Drinking needs solid ground, leaves you still and exposed, and a hit interrupts it. Wait for an opening, such as just after an enemy has attacked. Deep Gourd and Sweet Gourd in the Skills menu add a draught and a bell.',
            ],
        },
        {
            id: 'guard',
            cat: 'Combat',
            title: 'Guard & Posture',
            keys: [['Guard (hold)', 'parry']],
            body: () => [
                `Under the health bar is your posture bar. Hold ${L('parry')} after the parry window to raise the guard: blows from the front drain posture instead of health.`,
                'Holding the guard drains posture by itself, and every blocked blow drains more. Empty, and the guard breaks: you reel, and every blow hurts half as much again until it returns. A clean parry gives some back.',
                'Blows from behind, traps and attacks with the red tell cannot be blocked.',
            ],
        },
        {
            id: 'items',
            cat: 'Combat',
            title: 'Quick Items',
            keys: [
                ['Use', 'item'],
                ['Next item', 'itemNext'],
            ],
            body: () => [
                `Press ${L('item')} to use the selected quick item; hold it, or press ${L('itemNext')}, to change item. The slot sits beside the gourd at the bottom left.`,
                'Toll Charge stuns everything near you. Shard Fan throws three bell shards. Ash Veil makes you untouchable for a moment. Rage Draught makes every blow hit harder for twenty seconds.',
                'Odo sells more for glints, and fallen foes drop them now and then.',
            ],
        },
        {
            id: 'skilltree',
            cat: 'Combat',
            title: 'Skills',
            keys: [],
            body: () => [
                'Pause (or rest at a lantern) and open Skills. Every skill is paid for in glints.',
                'Three branches: Blade (the sword and its special strikes), Shade (the burning form) and Resolve (the gourd, the guard and the satchel). The Void Slash, Energy Barrage, Whirlwind Dash, Dash Slash and the Giant Spectral Summon are learned there.',
            ],
        },
        {
            id: 'parry',
            cat: 'Combat',
            title: 'Parry',
            needs: 'parry',
            keys: [['Parry', 'parry']],
            body: (D) => [
                `Press ${L('parry')} just before a blow lands. A clean parry takes no damage, grants a thread of silk, throws the attacker back and leaves it dazed for about a second.`,
                'A dazed foe takes double damage, so strike back at once. Lunges, dives and pike thrusts are the easiest to read.',
                `Miss the timing and you are left open for a moment, so don't mash it. On ${D.name} the window is ${D.parry.toFixed(2)} seconds.`,
                'Thorns, swinging bells, shockwaves, the Peal, falling debris and silk spears cannot be parried. Jump or dash those instead.',
            ],
        },
        {
            id: 'dash',
            cat: 'Abilities',
            title: 'Silk Dash',
            needs: 'dash',
            keys: [['Dash', 'dash']],
            body: () => [
                `Press ${L('dash')} to dash on the ground or in mid-air. You get one air dash per jump; it returns when you land or strike downward.`,
                'Dashing never costs silk. Jump, then dash, to cross wide gaps and to clear the Warden’s Peal.',
            ],
        },
        {
            id: 'dodge',
            cat: 'Abilities',
            title: 'Shadow Step',
            needs: 'dodge',
            keys: [['Dash', 'dash']],
            body: (D) => [
                `Press ${L('dash')} the moment a lunge, dive, thrust or Warden strike is launched at you and is close. You can dash toward it or away: if the blow is within reach, you slip it cleanly, time slows, a shadow of you is left behind, you take no damage and gain a thread of silk.`,
                'The attacker is frozen for over a second. Strike now: your blows come faster and a frozen foe takes extra damage, so chain a combo.',
                `Dashing during a wind-up, or when the foe is out of reach, is just a dash. On ${D.name} the window is about ${(D.dodge + 0.165).toFixed(2)} seconds and the blow must be within ${D.reach} pixels. It works on lunges, dives, thrusts and the Warden’s sweep, slam, leap and charge.`,
                'Thorns, swinging bells, shockwaves, the Peal, falling debris and silk spears cannot be slipped this way.',
            ],
        },
        {
            id: 'lance',
            cat: 'Abilities',
            title: 'Silk Lance',
            keys: [['Lance', 'lance']],
            body: () => [
                `Spend three silk with ${L('lance')} to throw a lance of silk.`,
                'It ignores the guard of a Pike Sentinel, which turns aside ordinary strikes from the front.',
            ],
        },
        {
            id: 'lanterns',
            cat: 'Exploration',
            title: 'Lanterns & Resting',
            keys: [['Rest', 'interact']],
            body: () => [
                `Press ${L('interact')} beside a lantern to rest. Resting restores every bell and saves your progress, but the creatures you have defeated return.`,
                'If you fall, you wake at the last lantern you rested at, with your silk spent.',
            ],
        },
        {
            id: 'travel',
            cat: 'Exploration',
            title: 'Lantern Menu',
            keys: [['Lantern', 'interact']],
            body: () => [
                `While resting at a lantern, press ${L('interact')} again to open its menu. Travel lists every lantern you have kindled, and takes you to one at once.`,
                'Travelling restores your health and saves, so it is a quick way back to a hard fight.',
                'Once the Warden has fallen, the same menu offers Boss Rematch, and Save Game writes the current moment into a manual slot.',
            ],
        },
        {
            id: 'saving',
            cat: 'Exploration',
            title: 'Saving & Loading',
            keys: [],
            body: () => [
                'The game saves by itself whenever you rest, travel or fall. Choose Save Game from the pause or lantern menu to keep a moment in one of five manual slots.',
                'Load Game, from the title or pause menu, lists the slots and the autosave. A slot remembers its own difficulty, so a Nightmare slot stays Nightmare.',
                'To clear a slot, highlight it and press the heal button.',
            ],
        },
        {
            id: 'notes',
            cat: 'Exploration',
            title: 'Lore Notes',
            keys: [['Read', 'interact']],
            body: () => [
                `Scraps of paper, carved stones and cloth lie scattered through the world. Press ${L('interact')} beside one to read it.`,
                'Every note you read is kept under the Lore tab of the Archive (pause menu), and the map marks where each one lies once you have seen the room.',
            ],
        },
        {
            id: 'rematch',
            cat: 'Combat',
            title: 'Boss Rematch',
            keys: [],
            body: () => [
                'After the Warden has fallen you can face it again from any lantern: rest, press interact, and choose Boss Rematch.',
                'A rematch gives no glints and no rewards, and nothing in your story save changes. Only your best time is recorded.',
            ],
        },
        {
            id: 'hazards',
            cat: 'Exploration',
            title: 'Thorns & Swinging Bells',
            keys: [],
            body: (D) => [
                'Thorns and swinging bells wound you and set you back on safe ground. They cannot be parried: leap thorns and time your run past the bells.',
                D.trap === 0
                    ? 'On Story they never hurt you at all, they only set you back.'
                    : `On ${D.name} each one costs ${BW.Difficulty.fmtBells(D.trap)}.`,
            ],
        },
        {
            id: 'bars',
            cat: 'Combat',
            title: 'Health Bars',
            keys: [],
            body: () => [
                'A bar appears over a creature when you come close or strike it. The pale trail shows the damage you have just dealt.',
                'The Warden has its own larger bar along the bottom of the screen for the whole fight. Under it sits a thinner, segmented bar: its poise, or guard. Strikes fill it a little, a perfect parry or Shadow Step fills it a lot, and it drains away again if you stop pressing. When it is full the Warden is staggered, and the bar then empties as the stagger runs out.',
                'The diamond on the poise bar sits at the 60% mark and lights up once you have built enough poise for a parry plus a Shadow Step to break its guard. Poise is a posture bar, not a second life. Only the Warden has one. Ordinary creatures are dazed or frozen by a parry or a Shadow Step instead. You have a posture bar of your own, under your health: see Guard & Posture.',
            ],
        },
        {
            id: 'boss',
            cat: 'Combat',
            title: 'Fighting the Warden',
            keys: [
                ['Parry', 'parry'],
                ['Dash', 'dash'],
            ],
            body: () => [
                'Its attacks come from a shuffled bag, so none repeats straight away. Each one opens with a tell: a glint of the clapper, a crouch or a roar. Learn them from the Warden entry in the Bestiary.',
                'Below half health it enters a second phase: it is faster, its pauses are shorter and it adds the Thread Rain.',
                'After most attacks it is left open for a moment. Strike then, and Mend only while it is recovering.',
                `A perfect parry (${L('parry')}) or a Shadow Step (${L('dash')}) cuts its blow short with a burst of light and builds a big part of its poise. Plain strikes build very little (almost nothing on Nightmare), so parries and Shadow Steps are the way to fill the bar. It only drains after a few quiet seconds.`,
                'This is how the Warden is meant to be beaten. On Action and especially Nightmare its health is huge, so plain strikes barely dent it. It takes about three or four clean parries and Shadow Steps to fill the poise bar and stagger it: stunned for over three seconds and every blow lands for roughly three times the damage. Land a parry AND a Shadow Step within about six seconds of each other, with the poise at least 60% up, and its guard breaks: a longer stun and about four times the damage. Running away or trading blows will not win this fight; weave parries and Shadow Steps together, then punish.',
                'The Peal, the shockwaves, falling debris and silk spears cannot be parried or slipped: jump or dash them instead. Its charge stops short if you dodge it, or if it hits the wall.',
                'Winning earns a great many glints. A rematch from any lantern gives none.',
            ],
        },
        {
            id: 'xp',
            cat: 'Combat',
            title: 'Glints',
            keys: [],
            body: () => [
                'Glints, the yellow stones, are the only currency: there is no experience and there are no levels. Creatures drop them, stones and caches break into them, and lore notes, hidden nooks, toll-looms, shrines and bells are worth a handful. Lanterns give none, and neither do boss rematches. The great foes are worth a great deal.',
                'Spend them in the Skills screen (Pause or the lantern menu) to learn the special moves and passives, and with Odo, who sells quick items and Lifethreads.',
                'Found things are earned once. Creatures return when you rest at a lantern.',
            ],
        },
        {
            id: 'difficulty',
            cat: 'Options',
            title: 'Difficulty',
            keys: [],
            body: (D) => [
                `You are playing on ${D.name}.`,
                'Story: most hits take a quarter bell and thorns never hurt. Action: the intended challenge, with more foes in every room and most hits taking half a bell. Nightmare: packed rooms, tougher and faster foes, a full bell per hit and a tight parry window.',
                'Slow, telegraphed blows (a Sentinel’s pike, the Warden’s slam) hit harder than quick ones on every difficulty.',
                'Story and Action can be switched in Options. Nightmare can never be changed once chosen.',
            ],
        },
        {
            id: 'map',
            cat: 'Exploration',
            title: 'Map & Journal',
            keys: [
                ['Map', 'map'],
                ['Pause', 'pause'],
            ],
            body: () => [
                `Press ${L('map')} to open the map. It fills in as you explore and marks lanterns, toll-looms and shrines you have found.`,
                'The pause menu keeps a journal of your current goal and your progress.',
            ],
        },
    ];

    // The creatures. frame/sprite draw the portrait; hint is shown while locked. dmg is in bells before difficulty.
    const BEASTS = [
        {
            id: 'crawler',
            name: 'Moss Crawler',
            epithet: 'Patrol-beast of the Hollow',
            habitat: 'Mosslit Hollow, the Belfry',
            sprite: 'crawler_walk',
            frame: 0,
            hp: 3,
            glints: 2,
            parry: true,
            hint: 'Common on the mossy paths where you first learn to fight.',
            lore: [
                'Once the beetles that hauled moss to the lanterns of the Hollow, Crawlers kept walking their routes long after the bells fell silent.',
                'The thread that told them when to stop has frayed. Now they patrol the same stretch of ground, and whatever steps into it is a stranger.',
            ],
            habits: 'Walks a fixed stretch and turns at ledges. When it spots you it rears up, its eyes glowing, then lunges in a straight line and is left open as it recovers.',
            notes: 'Step back from the lunge and strike while it recovers, or parry the lunge for a dazed, double-damage opening.',
        },
        {
            id: 'flyer',
            name: 'Lantern-moth',
            epithet: 'Drawn to every flame',
            habitat: 'Mosslit Hollow, the Spindleworks, the Belfry',
            sprite: 'flyer_fly',
            frame: 1,
            hp: 2,
            glints: 2,
            parry: true,
            hint: 'Wings stir in the dark shafts below the Lantern Grotto.',
            lore: [
                'Moths bred by the lamplighters to circle the lamp-posts and keep the dark at bay. Their eyes still burn, though there is no flame left to tend.',
                'They remember only that something bright must be circled, and then struck.',
            ],
            habits: 'Roosts in the air near its home and gives chase when it sees you. It hovers near you, draws back with a glow in its eyes, then dives in a straight line.',
            notes: 'The dive is a straight line, so sidestep or dash through it. Strike while it recovers, or parry the dive for a free hit.',
        },
        {
            id: 'sentinel',
            name: 'Pike Sentinel',
            epithet: 'Still keeping its post',
            habitat: 'Mosslit Hollow, the Spindleworks, the Belfry',
            sprite: 'sentinel_walk',
            frame: 0,
            hp: 6,
            glints: 5,
            parry: true,
            hint: 'Armoured guards hold the broken span and the halls beyond.',
            lore: [
                'Guild guards in shields of bell-bronze, set to hold the ways to the Belfry. The guild is long gone, but nobody relieved them of their orders.',
                'They stand with a patience that has outlasted names, and they are slow to turn.',
            ],
            habits: 'Its shield turns aside needle strikes from the front. It turns slowly, and a long pike thrust follows a visible wind-up, after which it stands open for a moment.',
            notes: 'Strike from behind as it turns, or after the thrust. Downward strikes and the Silk Lance ignore the shield. A well-timed parry staggers it.',
        },
        {
            id: 'spitter',
            name: 'Glow Spitter',
            epithet: 'Patient and luminous',
            habitat: 'Drowned Chapel, the Spindleworks',
            sprite: 'spitter_idle',
            frame: 0,
            hp: 3,
            glints: 3,
            parry: false,
            hint: 'Something glows wetly in the drowned places, waiting.',
            lore: [
                'A swollen silk-gland that clings to ceilings and ledges. It feeds on the glow of passing spirits, and fires it back as light that burns.',
                'Some say the Spitters were once the lamps themselves.',
            ],
            habits: 'Does not move. It swells while it takes aim, then spits a glob of glowing silk at where you stand, and starts again.',
            notes: 'Keep moving once it swells, and break its line of sight. It is frail up close, so a couple of strikes finish it.',
        },
        {
            id: 'hopper',
            name: 'Cave-cricket',
            epithet: 'Springing from the shadows',
            habitat: 'Thornwood, the Drowned Chapel, the Belfry',
            sprite: 'hopper_idle',
            frame: 0,
            hp: 4,
            glints: 3,
            parry: true,
            hint: 'Something springs from the shadows of the Thornwood.',
            lore: [
                'The oldest dwellers of the deep roots. They hunted by feeling the ground shake, and still do, but it is footsteps they feel now, not the tolling of bells.',
                'They leap at where you stand, and trust the rest to luck.',
            ],
            habits: 'Crouches low, then leaps in an arc toward you. It lands dazed and wobbling, with stars around its head.',
            notes: 'Move away from the landing spot, then strike while it is dizzy. Jumping over its leap works too.',
        },
        {
            id: 'warden',
            name: 'The Bellbound Warden',
            epithet: 'Keeper of the Last Toll',
            habitat: 'Cathedral of the Last Toll',
            sprite: 'warden_idle',
            frame: 0,
            boss: true,
            parry: true,
            hint: 'Something sits bound beyond the great doors.',
            lore: [
                'Keeper of the Cathedral of the Last Toll, bound by silk to the Great Bell so it could never ring unattended. When the bells fell silent, its vow turned inward.',
                'Now it guards the silence itself. It will not strike first, but it will not let the Great Bell be rethreaded.',
            ],
            habits: 'Attacks come from a shuffled bag, so none repeats at once, and each opens with a glint of the clapper or a roar. Below half health the fight changes: it is faster and adds the Thread Rain, the Resonance Volley and the Vault Collapse.',
            notes: 'Strike in its recovery windows and Mend only while it is recovering. Plain strikes barely hurt it on Action and Nightmare: perfect parries and Shadow Steps fill its poise bar, and a staggered Warden takes about triple damage. Land BOTH in quick succession to break its guard for a longer, deadlier stun.',
            moves: [
                [
                    'sweep',
                    'Clapper Sweep',
                    'The clapper is drawn back with a glint, then swept low across the floor. Back out of its reach, or parry the strike.',
                ],
                [
                    'slam',
                    'Toll Slam',
                    'The clapper rises overhead and crashes down, sending a shockwave along the ground. Jump the wave. A parry cuts the slam short.',
                ],
                [
                    'leap',
                    'Bellfall Leap',
                    'It crouches, springs high and lands in a stomp that hits everything beneath. Run clear of the landing spot.',
                ],
                [
                    'charge',
                    'Bellbound Charge',
                    'Head down, it barrels across the arena. Jump or dash past: if it hits the wall it is stunned and open.',
                ],
                [
                    'peal',
                    'The Peal',
                    'It tolls a ringing wave along the floor, too wide to run through. Jump and Silk Dash together to clear it. It cannot be parried.',
                ],
                [
                    'cascade',
                    'Tolling Tremor',
                    'It slams the floor and a chain of eruptions marches toward you, each one cracking and glowing a moment before it bursts. Step into a gap, or stay close to it. They cannot be parried.',
                ],
                [
                    'hurl',
                    'Rimcutter',
                    'It tears a spinning ring of resonance loose and flings it along the floor on a silk cord, then hauls it back. Jump the throw. In its second phase the ring returns high, so keep your feet on the ground. It cannot be parried.',
                ],
                [
                    'rain',
                    'Thread Rain',
                    'In its second phase, silk spears fall in columns from above, each marked on the floor first. Find the gaps. They cannot be parried.',
                ],
                [
                    'volley',
                    'Resonance Volley',
                    'In its second phase it roars and a fan of glowing orbs gathers over its head. Each draws a thin line to where you stand, then streaks along it. Keep moving, or dash through. They cannot be parried.',
                ],
                [
                    'collapse',
                    'Vault Collapse',
                    'In its second phase it roars and the cathedral ceiling starts to come down, every other stone aimed where you are running. Each is shadowed on the floor first. Keep moving. It cannot be parried.',
                ],
            ],
        },
    ];

    const BY_ID = {};

    for (const b of BEASTS) BY_ID[b.id] = b;

    // Short lessons shown once, in play, at the right moment (also listed in the guide)
    const LESSONS = {
        parry: { title: 'Tip: Parry', sub: () => `Press ${L('parry')} just before a blow lands` },
        riposte: { title: 'Perfect parry', sub: () => 'The foe is dazed. Strike now for double damage' },
        shade: { title: 'The Shade is full', sub: () => `Press ${L('transform')} to unleash your second form` },
        dodge: { title: 'Shadow Step', sub: () => 'The foe is frozen. Strike now and chain a combo' },
    };

    const blank = () => ({ seen: {}, kills: {}, moves: {}, tips: {} });

    const Codex = {
        TIPS,
        BEASTS,
        BY_ID,
        LESSONS,
        data(st) {
            return st.codex || (st.codex = blank());
        },
        // each returns true the first time the thing is discovered
        see(st, id) {
            const c = this.data(st);

            if (!BY_ID[id] || c.seen[id]) return false;

            c.seen[id] = true;

            return true;
        },
        kill(st, id) {
            const c = this.data(st);

            if (!BY_ID[id]) return;

            c.seen[id] = true;
            c.kills[id] = (c.kills[id] || 0) + 1;
        },
        move(st, id, mv) {
            const c = this.data(st),
                k = id + ':' + mv;

            if (c.moves[k]) return false;

            c.moves[k] = true;

            return true;
        },
        found(st) {
            const c = this.data(st);

            return BEASTS.filter((b) => c.seen[b.id]).length;
        },
        tipOpen(st, t) {
            return !t.needs || !!st.abilities[t.needs];
        },

        // fill in sensible values for saves made before the guide existed
        upgrade(d) {
            const o = d.codex || {};

            const c = (d.codex = {
                seen: Object.assign({}, o.seen),
                kills: Object.assign({}, o.kills),
                moves: Object.assign({}, o.moves),
                tips: Object.assign({}, o.tips),
            });

            for (const key of Object.keys(d.cleared || {})) {
                const id = key.split(':')[1];

                if (BY_ID[id] && id !== 'warden') {
                    c.seen[id] = true;
                    c.kills[id] = Math.max(c.kills[id] || 0, 1);
                }
            }

            const f = d.flags || {};

            if (f.warden_met) c.seen.warden = true;

            if (f.warden_defeated) {
                c.seen.warden = true;
                c.kills.warden = Math.max(c.kills.warden || 0, 1);
            }
        },
    };

    BW.Codex = Codex;
})(window.BW);

'use strict';

// Ready-made saves for testing: everything discovered and unlocked, resting at the antechamber lantern
// outside the Warden's arena. Loaded from Save Data → Test Saves.
(function (BW) {
    const LIST = [
        {
            id: 'warden',
            name: 'Before the Warden',
            diff: 'action',
            desc: 'Everything unlocked, resting at the cathedral antechamber lantern. The Warden is waiting. 12 bells, 18 silk.',
        },
        {
            id: 'warden_nm',
            name: 'Before the Warden \u2014 Nightmare',
            diff: 'nightmare',
            desc: 'The same save on Nightmare: one bell per hit, denser rooms, tougher foes.',
        },
        {
            id: 'defeated',
            name: 'Warden Defeated',
            diff: 'action',
            desc: 'The Warden has fallen but the Great Bell is not yet rung. Boss Rematch is unlocked at every lantern.',
        },
        {
            id: 'cleared',
            name: 'Great Bell Rung',
            diff: 'action',
            desc: 'The whole story finished: ending seen, every lore note found, rematches unlocked.',
        },
        {
            id: 'fortress',
            name: 'Ashen Ramparts (art test)',
            diff: 'action',
            desc: 'Warden defeated, resting at the Ashen Barbican lantern. Tests the new fortress art area east of the Cord Lift.',
        },
        {
            id: 'gallery',
            name: 'The Hushed Gallery (start)',
            diff: 'action',
            desc: 'The Great Bell has rung. Resting at the Rampart Gatehall lantern, where the black veils have parted. The whole Gallery is unexplored.',
        },
        {
            id: 'gallery_boss',
            name: 'Before the Long Mourner',
            diff: 'action',
            desc: 'The Gallery crossed and its bells unwrapped. Resting at the lantern outside the Hush Arena. The Long Mourner is waiting.',
        },
        {
            id: 'ronin_gallery',
            name: 'Faceless Ronin: the Gallery',
            diff: 'action',
            desc: 'The Hushed Gallery save, played as the Faceless Ronin with the Shade full: press the transform key to try the second form and all its skills.',
        },
        {
            id: 'ronin_boss',
            name: 'Faceless Ronin: the Long Mourner',
            diff: 'action',
            desc: 'The boss-fight save as the Faceless Ronin, Shade full. Transform and fight the Long Mourner.',
        },
    ];

    const HUSHED_BEASTS = ['hushling', 'drifter', 'stilt', 'reacher', 'brute', 'mourner'];

    function build(id) {
        // the Ronin saves are the Gallery saves with the other hero and a full Shade
        if (id === 'ronin_gallery' || id === 'ronin_boss') {
            const r = build(id === 'ronin_boss' ? 'gallery_boss' : 'gallery');

            r.shade = 100;

            return r;
        }

        const meta = LIST.find((e) => e.id === id) || LIST[0];
        const d = BW.Save.defaults();

        d.difficulty = meta.diff;
        d.maxHp = 12;
        d.silkMax = 18;
        d.glints = 999;
        d.xp = BW.XP.total(id === 'warden' || id === 'warden_nm' ? 8 : BW.XP.MAX);
        d.abilities = { dash: true, parry: true, dodge: true };

        const f = (d.flags = {
            odo_met: true,
            odo_sold: true,
            bell1: true,
            bell2: true,
            belfry_open: true,
            reached_cathedral: true,
            cathedral_open: true,
            warden_met: id === 'warden' || id === 'warden_nm' ? false : true,
        });

        const gallery = id === 'gallery' || id === 'gallery_boss';

        // the Gallery saves keep the Gallery itself fresh: its secrets, pickups and notes are still to be found
        const before = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'];

        for (const r of BW.ROOM_LIST) {
            const fresh = gallery && r.area === 'hushed';
            const seen = !fresh || (id === 'gallery_boss' && before.includes(r.id));

            if (seen) d.visited[r.id] = true;

            if (fresh) {
                for (const e of r.ents) {
                    if (
                        e.type === 'lantern' &&
                        id === 'gallery_boss' &&
                        (e.id === 'lan_h1' || e.id === 'lan_h5' || e.id === 'lan_h7')
                    )
                        d.lanternsLit[e.id] = true;

                    if (e.type === 'silentbell' && id === 'gallery_boss' && before.includes(r.id))
                        f['hbell_' + e.id] = true;
                }

                continue;
            }

            for (const s of r.secrets) f['sec_' + s.id] = true;
            for (const b of r.breakables) f['brk_' + b.id] = true;

            for (const e of r.ents) {
                if (e.type === 'lantern') d.lanternsLit[e.id] = true;
                if ((e.type === 'pickup' || e.type === 'cache' || e.type === 'glint') && e.id) f['pk_' + e.id] = true;
            }
        }

        if (id === 'gallery_boss') {
            f.hb_h2 = true;
            f.hb_h4 = true;
        }

        if (id !== 'warden' && id !== 'warden_nm') {
            f.warden_met = true;
            f.warden_defeated = true;
        }

        if (id === 'cleared' || gallery) {
            f.great_bell = true;
            f.ending_seen = true;
        }

        for (const n of BW.Lore.NOTES) {
            const hushedNote = BW.ROOMS[n.room] && BW.ROOMS[n.room].area === 'hushed';

            if ((!n.when || f[n.when]) && !(gallery && hushedNote)) f['note_' + n.id] = true;
        }

        f.lore_spindle = true;
        f.lore_belfry = true;
        d.lantern = 'lan_b3';
        d.lanternRoom = 'B3';
        d.lastRoom = 'B3';

        // where each save wakes up
        const rest = { fortress: ['lan_f1', 'F1'], gallery: ['lan_f4', 'F4'], gallery_boss: ['lan_h7', 'H7'] }[id];

        if (rest) {
            d.lantern = rest[0];
            d.lanternRoom = rest[1];
            d.lastRoom = rest[1];
            d.lanternsLit = Object.assign({}, d.lanternsLit, { [rest[0]]: true });
        }

        d.stats = { playTime: 14400, deaths: 17, wardenAttempts: id === 'warden' || id === 'warden_nm' ? 0 : 6 };

        if (f.ending_seen) {
            d.stats.clears = 1;
            d.stats.clearTime = 14400;
        }

        const c = d.codex;

        for (const b of BW.Codex.BEASTS) {
            c.seen[b.id] = true;

            if (b.id !== 'warden') c.kills[b.id] = 12;

            for (const m of b.moves || []) c.moves[b.id + ':' + m[0]] = true;
        }

        if (f.warden_defeated) c.kills.warden = 1;
        else delete c.seen.warden;

        // the Gallery's creatures: not met in the Gallery saves (the boss-fight one has crossed the Gallery), and the Long
        // Mourner is only ever "met" by fighting it
        for (const hid of HUSHED_BEASTS) {
            const skip = hid === 'mourner' ? !f.mourner_defeated : id === 'gallery';

            if (skip) {
                delete c.seen[hid];
                delete c.kills[hid];

                for (const k of Object.keys(c.moves)) if (k.startsWith(hid + ':')) delete c.moves[k];
            }
        }

        for (const t of Object.keys(BW.Codex.LESSONS)) c.tips[t] = true;

        d.createdAt = new Date().toISOString();

        return d;
    }

    BW.TestSaves = {
        LIST,
        build,
        load(g, id) {
            BW.Save.adopt(build(id));
            g.continueGame();
        },
    };
})(window.BW);

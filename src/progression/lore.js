'use strict';

// Story content: the opening chapters, short interludes the first time you reach a region, and the lore notes
// scattered through the world. Collected notes are kept in state.flags ('note_<id>') so they save with the game.
(function (BW) {
    const T = BW.T;

    // Chapter slides: kicker is a numeral, art is an image from the manifest.
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
                'The Weavers tended the looms, and the looms spun the cord that hung every bell. Every bell answered to a thread, and every thread to a hand.',
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

    // Shown once, the first time a region is entered by walking in.
    const INTERLUDES = {
        spindle: {
            id: 'spindle',
            kicker: 'The Spindleworks',
            title: 'Where the Cords Were Spun',
            art: 'bg_spindle_far',
            lines: [
                'Here the Concord spun the cord for every bell in the city.',
                'The looms still hum, softly, in many voices, as if every thread remembers having been someone.',
            ],
        },
        belfry: {
            id: 'belfry',
            kicker: 'The Silent Belfry',
            title: 'Mouths Open, Clappers Bound',
            art: 'bg_belfry_far',
            lines: [
                'The great bells hang with their mouths open to the sky, and every mouth is lined with a face.',
                'Not one has rung since the Last Toll. Every clapper is a person, and every one has been tied with the same careful knot.',
            ],
        },
    };

    // x, y are tile coordinates of the standing spot in the room. text is a list of paragraphs.
    const NOTES = [
        {
            id: 'ledger',
            room: 'M1',
            x: 16,
            y: 13,
            title: 'Lamplighter’s Ledger',
            hint: 'A page left on a ledge near where you fell.',
            text: [
                'Lanterns lit this dusk: forty. Faces counted on the heap below the ledge: I stopped at sixty.',
                'They throw the dead down the Fallen Light at the tenth toll. The lamps will not stay lit above them. I think the lamps are ashamed.',
                'I will keep walking the route. Somebody should keep a light for them.',
            ],
            from: 'Odo, Lamplighter',
        },
        {
            id: 'rhyme',
            room: 'M2',
            x: 2,
            y: 28,
            title: 'Moss-gatherer’s Rhyme',
            hint: 'Something is tucked into a far corner of the Glowmoss Path.',
            text: [
                'Hush the bell and hush the town,',
                'tie the veil and tie it down.',
                'Count nine tolls and count them true. The tenth one has a face for you.',
            ],
            from: 'a children’s rhyme, stitched into a hood',
        },
        {
            id: 'letter',
            room: 'M3',
            x: 21,
            y: 8,
            title: 'Apprentice’s Letter',
            hint: 'High above the Lantern Grotto.',
            text: [
                'Master, I carried the third cord up to the Spindleworks as you asked. The foreman says it is warm. He says it is the wrong kind of warm: it has a pulse.',
                'He says there is a name woven into every fathom, and that if you hold it to your ear it says it back.',
                'Please come down before the dusk toll. The grotto lantern is the last one that still lights for me.',
            ],
            from: 'an apprentice, unsigned',
        },
        {
            id: 'span',
            room: 'M4',
            x: 59,
            y: 12,
            title: 'Spanwright’s Warning',
            hint: 'At the far end of the broken Span.',
            text: [
                'The Span did not fall. They cut it, the night the Vael were taken, so that nobody could run for the Belfry. I was standing on it.',
                'If you are reading this, you crossed. Do not trust a stone that hums. The Concord set listening-stones in every span, and a stone that hums is a stone that is reporting you.',
                'Build it for the swift, not for a walking pace. Nothing in this city is allowed to walk away any more.',
            ],
            from: 'a spanwright',
        },
        {
            id: 'roots',
            room: 'M5',
            x: 2,
            y: 39,
            title: 'Root-keeper’s Tally',
            hint: 'Far down at the bottom of Rootfall.',
            text: [
                'Day 1. The roots are warm and humming one low note.',
                'Day 9. The note has become a voice. It is saying a name, over and over.',
                'Day 14. It is not one name. It is all of them. I am going up, and I am not going back for my tools.',
            ],
            from: 'a root-keeper',
        },
        {
            id: 'thorns',
            room: 'M6',
            x: 60,
            y: 23,
            title: 'Thornwood Survey',
            hint: 'At the dry end of the Thornwood.',
            text: [
                'The thorns were planted over the old drain to hold down whatever fell. Nobody ever told them to stop.',
                'They have grown over every path, and over every bone that still wears a scrap of veil.',
                'Survey note: this is what obedience grows into when the order outlives the one who gave it.',
            ],
            from: 'Guild surveyor, Eighth Season',
        },
        {
            id: 'verse',
            room: 'M7',
            x: 40,
            y: 36,
            title: 'Loom-singer’s Verse',
            hint: 'In the deep chamber of the first toll-loom.',
            text: [
                'Pull the cord and the bell will see,',
                'loose the cord and the dark is free.',
                'The loom does not ring the bell. The loom only keeps the tongue from speaking. Do not look for the tongue.',
            ],
            from: 'a loom-singer’s chant',
        },
        {
            id: 'hymn',
            room: 'M8',
            x: 19,
            y: 12,
            title: 'Drowned Chapel Hymn',
            hint: 'A hymn-sheet in the Drowned Chapel, away from the water.',
            text: [
                'The water rose the night the Vael went down the shaft, and the chapel bells rang under it. Nobody above heard. They had no clappers; they rang with the dead.',
                'We sang the last hymn waist-deep, and faces drifted by like lanterns.',
                'If you can read this, you wear the blank. Good. Only the faceless can walk through them in peace.',
            ],
            from: 'the chapel choir',
        },
        {
            id: 'foreman',
            room: 'S1',
            x: 3,
            y: 42,
            title: 'Shaft Foreman’s Log',
            hint: 'At the bottom of the Spindle Shaft.',
            text: [
                'The cord lift has stopped twice this week. The second toll-loom is starving: cord needs a tongue, and the Keepers have stopped sending them.',
                'I sent a runner east to the Sundered Span to ask for more. She has not come back. I think she has been added to the cord.',
                'If the Belfry Seal closes for good, nothing will ever be called again. Whoever you are: wake both looms. What they spin next will not be cord.',
            ],
            from: 'the Shaft Foreman',
        },
        {
            id: 'gallery',
            room: 'S3',
            x: 31,
            y: 25,
            title: 'Gallery Inscription',
            hint: 'On the floor of the Loom Gallery.',
            text: [
                'The Gallery was built so that one weaver could stand at the centre and hear every loom, and every tongue, at once.',
                'On the last night, the weaver at the centre heard a voice beneath all the others: patient, and enormous. It was not a loom.',
                'She said it was the Great Bell, and that it was counting the faces.',
            ],
            from: 'carved beneath a loom',
        },
        {
            id: 'pilgrim',
            room: 'S4',
            x: 31,
            y: 7,
            title: 'Pilgrim’s Scrap',
            hint: 'High above the Shrine of the Swift Stitch.',
            text: [
                'I came to the Shrine to learn the Swift Stitch. It teaches: a blade that cannot be found cannot be broken.',
                'The Warden at the top of the city is said to be the fastest of us all, and he does not move at all.',
                'The ones with faces fear him. I think it is because he remembers them.',
            ],
            from: 'a pilgrim',
        },
        {
            id: 'lift',
            room: 'S6',
            x: 24,
            y: 109,
            title: 'Liftkeeper’s Note',
            hint: 'At the bottom of the Cord Lift.',
            text: [
                'The lift is run by the second toll-loom. When the loom sings the lift climbs, and the shaft hums a fifth beneath the Great Bell.',
                'I rode it up once, in the old days. At the top every bell was shining, and every bell had a face in its mouth.',
                'I told myself it was a trick of the lamps. I wish I could say I remembered the sound.',
            ],
            from: 'the Liftkeeper',
        },
        {
            id: 'prayer',
            room: 'B1',
            x: 2,
            y: 10,
            title: 'Bell-keeper’s Prayer',
            hint: 'At the high edge of the Belfry Steps.',
            text: [
                'Keep the mallet, keep the cord, keep the hour.',
                'Ring when the Concord asks, hush when it answers. Never ask whose face is in the bronze.',
                'And if the day comes when the Great Bell must be silenced for the city’s sake: let the one who stills it be the one who sold the house that cast it.',
            ],
            from: 'the Keepers’ prayer',
        },
        {
            id: 'oath',
            room: 'B2',
            x: 2,
            y: 19,
            title: 'The Mallet Oath',
            hint: 'In a quiet corner of the Hall of Silent Bells.',
            text: [
                'Every keeper swore it in this hall. “I will hold the bell, and the bell will hold the city.” Then they were shown what the bell was made of, and the oath was the only part they were allowed to keep.',
                'Nobody asked what becomes of a keeper who must hold on forever.',
                'There is a keeper in the Cathedral who took the oath at the price of his brothers. Pity him, if you can. Do not hesitate.',
            ],
            from: 'on the inside of a bell',
        },
        {
            id: 'name',
            room: 'B3',
            x: 45,
            y: 23,
            title: 'The Warden’s Name',
            hint: 'At the far end of the Cathedral Antechamber.',
            text: [
                'His name was Orrin Vael, Keeper of the Last Toll, eldest of the House that cast the Great Bell.',
                'On the hundredth dusk he learned the long toll would not mend the Hollow: it would tune every living mind to the Concord’s one note. His House refused to cast it. He gave the Concord their names for his own life, and by dawn the House was dead.',
                'He has held the Great Bell silent ever since. He tells himself it is penance. It is only a longer way of dying.',
            ],
            from: 'a keeper’s scratched record',
        },
        {
            id: 'last',
            room: 'C1',
            x: 49,
            y: 20,
            when: 'warden_defeated',
            title: 'Last Words of the Warden',
            hint: 'Something is left behind by the Warden.',
            text: [
                'Little brother. A face I could not read, and I should have known it was you by that alone.',
                'I held it too long. I forgot whom I was holding it against. Toll it, or break it: I never could tell which was the mercy.',
                'Tell the dead I kept the oath. Tell them I was never forgiven. Tell them I am tired.',
            ],
            from: 'Orrin Vael',
        },
    ];

    const BY_ID = {};

    for (const n of NOTES) BY_ID[n.id] = n;

    const Lore = {
        INTRO,
        INTERLUDES,
        NOTES,
        BY_ID,
        has(st, id) {
            return !!(st && st.flags && st.flags['note_' + id]);
        },
        count(st) {
            let c = 0;

            for (const n of NOTES) if (this.has(st, n.id)) c++;

            return c;
        },
        roomName(n) {
            const r = BW.ROOMS[n.room];

            return r ? r.name : n.room;
        },
        areaName(n) {
            const r = BW.ROOMS[n.room];

            return r ? BW.AREAS[r.area].name : '';
        },
        // collect a note; returns true the first time
        collect(g, id) {
            const f = g.state.flags;

            if (f['note_' + id]) return false;

            f['note_' + id] = true;
            g.hud.toast('Lore note found', `${BY_ID[id].title}  \u00b7  ${this.count(g.state)} / ${NOTES.length}`, 3.4);
            BW.Audio.play('glint', { vol: 0.7, minGap: 0 });
            g.earnGlints(BW.Rewards.note);
            g.saveGame();

            return true;
        },

        // First visit to a region: a short chapter slide.
        interlude(g, areaId) {
            const it = INTERLUDES[areaId],
                f = g.state.flags;

            if (!it || f['lore_' + it.id] || g.seq || g.mode !== 'play') return;

            f['lore_' + it.id] = true;

            g.startSequence(
                (function* () {
                    g.seq.hideHud = true;

                    const p = g.player;

                    p.state = 'cutscene';
                    p.vx = 0;
                    yield 0.5;
                    yield* Lore.play(g, [Object.assign({ chapter: true }, it)]);
                    g.seq.hideHud = false;
                    p.state = 'normal';
                    g.saveGame();
                })(),
            );
        },

        // Plays chapter slides as a sequence step: yield* Lore.play(g, slides)
        *play(g, slides) {
            const I = BW.Input,
                sl = (g.loreSlide = {
                    a: 0,
                    t: 0,
                    art: null,
                    prev: null,
                    mix: 1,
                    chars: 0,
                    total: 0,
                    slide: null,
                    ta: 0,
                    i: 0,
                    n: slides.length,
                    lines: null,
                });

            for (let f = 0; f < 36; f++) {
                sl.a = f / 36;
                sl.t += 1 / 60;
                yield 1 / 60;
            }

            sl.a = 1;

            let skip = false;

            for (let i = 0; i < slides.length && !skip; i++) {
                const s = slides[i];

                sl.prev = sl.art;
                sl.art = s.art;
                sl.mix = sl.prev ? 0 : 1;
                sl.slide = s;
                sl.i = i;
                sl.chars = 0;
                sl.lines = null;
                sl.ta = 0;
                sl.total = s.lines.join('').length + s.lines.length * 12;

                let hold = 0;

                for (;;) {
                    yield 1 / 60;
                    sl.t += 1 / 60;
                    sl.mix = Math.min(1, sl.mix + 1 / 60 / 1.1);
                    sl.ta = Math.min(1, sl.ta + 1 / 60 / 0.5);

                    if (I.pressed.pause || I.pressed.back) {
                        skip = true;
                        break;
                    }

                    const go = I.pressed.confirm || I.pressed.jump || I.pressed.attack;

                    if (sl.chars < sl.total) {
                        sl.chars += 48 / 60;

                        if (go && sl.t > 0.3) sl.chars = sl.total;
                    } else {
                        hold += 1 / 60;

                        if (go || hold > 5) break;
                    }
                }

                if (!skip) {
                    for (let f = 0; f < 24; f++) {
                        sl.ta = 1 - f / 24;
                        yield 1 / 60;
                        sl.t += 1 / 60;
                    }
                }
            }

            for (let f = 36; f >= 0; f--) {
                sl.a = f / 36;
                sl.ta = Math.min(sl.ta, sl.a);
                sl.t += 1 / 60;
                yield 1 / 60;
            }

            g.loreSlide = null;
        },

        drawSlide(ctx, sl) {
            const VW = BW.VW,
                VH = BW.VH,
                cx = VW / 2,
                s = sl.slide,
                t = sl.t;

            ctx.save();
            ctx.globalAlpha = sl.a;
            ctx.fillStyle = '#040508';
            ctx.fillRect(0, 0, VW, VH);

            const art = (name, a) => {
                const img = name && BW.Assets.img(name);

                if (!img || a <= 0) return;

                const k = Math.max(VW / img.width, VH / img.height) * (1.08 + 0.05 * Math.min(1, t / 14));

                const w = img.width * k,
                    h = img.height * k;

                ctx.save();
                ctx.globalAlpha *= a * 0.62;

                ctx.drawImage(
                    img,
                    (VW - w) / 2 - Math.sin(t * 0.08) * 14,
                    (VH - h) / 2 - 10 + Math.cos(t * 0.06) * 8,
                    w,
                    h,
                );

                ctx.restore();
            };

            if (sl.prev && sl.mix < 1) art(sl.prev, 1 - sl.mix);

            art(sl.art, sl.mix);

            const vg = ctx.createRadialGradient(cx, VH * 0.45, VH * 0.2, cx, VH * 0.5, VH * 0.95);

            vg.addColorStop(0, 'rgba(0,0,0,0.25)');
            vg.addColorStop(1, 'rgba(0,0,0,0.92)');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, VW, VH);

            const bar = ctx.createLinearGradient(0, VH * 0.5, 0, VH);

            bar.addColorStop(0, 'rgba(0,0,0,0)');
            bar.addColorStop(1, 'rgba(0,0,0,0.75)');
            ctx.fillStyle = bar;
            ctx.fillRect(0, VH * 0.5, VW, VH * 0.5);
            // drifting silk motes
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < 34; i++) {
                const x = ((i * 151.7 + t * (6 + (i % 5) * 2)) % (VW + 40)) - 20,
                    y = VH - ((i * 83.3 + t * (9 + (i % 7) * 2)) % (VH + 40)) + 20;

                ctx.fillStyle = `rgba(255,232,190,${0.12 + (i % 3) * 0.07})`;
                ctx.beginPath();
                ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            if (!s) {
                ctx.restore();

                return;
            }

            ctx.globalAlpha = sl.a * sl.ta;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const top = s.chapter ? VH * 0.3 : VH * 0.24;

            // numeral in a ring
            if (!s.chapter) {
                ctx.strokeStyle = 'rgba(232,201,138,0.65)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, top - 62, 30, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(232,201,138,0.25)';
                ctx.beginPath();
                ctx.arc(cx, top - 62, 37, 0, Math.PI * 2);
                ctx.stroke();
                ctx.font = `600 26px ${BW.FONT_T}`;
                ctx.fillStyle = '#e8c98a';
                ctx.fillText(s.kicker, cx, top - 61);
            } else {
                ctx.font = `600 20px ${BW.FONT_T}`;
                ctx.fillStyle = '#e8c98a';

                if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '8px';

                ctx.fillText(s.kicker.toUpperCase(), cx + 4, top - 50);

                if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
            }

            ctx.save();
            ctx.font = `600 58px ${BW.FONT_T}`;
            ctx.fillStyle = '#f7ecd6';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 20;

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';

            ctx.fillText(s.title, cx, top + 10);
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = 'rgba(240,226,196,0.6)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx - 190, top + 56);
            ctx.lineTo(cx - 14, top + 56);
            ctx.moveTo(cx + 14, top + 56);
            ctx.lineTo(cx + 190, top + 56);
            ctx.stroke();
            ctx.fillStyle = '#efe0c0';
            ctx.translate(cx, top + 56);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-4, -4, 8, 8);
            ctx.restore();

            // typewriter body: wrap once, then reveal by character
            ctx.font = `italic 500 31px ${BW.FONT_B}`;

            if (!sl.lines) {
                sl.lines = [];

                for (const para of s.lines) {
                    const words = para.split(' ');
                    let line = '';

                    for (const w of words) {
                        const test = line ? line + ' ' + w : w;

                        if (line && ctx.measureText(test).width > 880) {
                            sl.lines.push(line);
                            line = w;
                        } else line = test;
                    }

                    sl.lines.push(line);
                    sl.lines.push('');
                }

                sl.lines.pop();
            }

            ctx.fillStyle = '#efe4cc';
            ctx.shadowColor = 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = 14;

            let left = Math.floor(sl.chars),
                y = top + 118;

            for (const l of sl.lines) {
                if (l === '') {
                    y += 20;
                    left -= 12;
                    continue;
                }

                if (left > 0) ctx.fillText(l.slice(0, left), cx, y);

                left -= l.length;
                y += 42;
            }

            ctx.shadowBlur = 0;

            // progress pips and prompt
            if (sl.n > 1) {
                for (let i = 0; i < sl.n; i++) {
                    ctx.fillStyle = i === sl.i ? '#e8c98a' : 'rgba(232,201,138,0.28)';
                    ctx.beginPath();
                    ctx.arc(cx + (i - (sl.n - 1) / 2) * 22, VH - 92, i === sl.i ? 4.5 : 3.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.font = `500 19px ${BW.FONT_B}`;
            ctx.fillStyle = `rgba(230,220,200,${0.45 + 0.2 * Math.sin(t * 3)})`;
            ctx.fillText(`${BW.Input.label('confirm')}  continue      ${BW.Input.label('pause')}  skip`, cx, VH - 52);
            ctx.restore();
        },
    };

    // ---------------------------------------------------------------- the note object
    const OBJ = BW.OBJ;

    OBJ.note = class LoreNote extends BW.ObjBase {
        constructor(g, d) {
            super(g, d);
            this.y = (d.y + 1) * T;
            this.range = 52;
        }
        get got() {
            return Lore.has(this.game.state, this.def.id);
        }
        canInteract() {
            return this.near(52) && this.game.player.onGround;
        }
        prompt() {
            return this.got ? 'Read again' : 'Read note';
        }
        interact() {
            const n = BY_ID[this.def.id];

            if (!n) return;

            const first = Lore.collect(this.game, n.id);

            BW.Audio.play('ui_ok', { vol: 0.5 });
            this.game.dialog.open(n.title, n.text.concat(['\u2014 ' + n.from]), { kind: 'sign' });

            if (first)
                this.game.fx.burst(this.x, this.y - 18, 14, {
                    color: ['#ffe6a6', '#ffffff'],
                    speed: 150,
                    life: 0.6,
                    add: true,
                    kind: 'glow',
                    size: 6,
                });
        }
        draw(ctx) {
            const x = this.x,
                y = this.y;

            // ease the unread -> read look in real time (the sim is paused while the note is open), so nothing snaps
            const now = performance.now(),
                dtr = this.lastDraw ? Math.min(0.05, (now - this.lastDraw) / 1000) : 0;

            this.lastDraw = now;

            if (this.gotK == null) this.gotK = this.got ? 1 : 0;

            const target = this.got ? 1 : 0;

            this.gotK += Math.max(-1, Math.min(1, target - this.gotK)) * Math.min(1, dtr * 5);

            if (Math.abs(target - this.gotK) < 0.004) this.gotK = target;

            const k = this.gotK,
                un = 1 - k,
                b = Math.sin(this.t * 2.2) * 2.5 * un;

            if (un > 0.01) {
                const a = un * (0.45 + 0.15 * Math.sin(this.t * 3));

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = Math.min(1, a / 0.45);
                ctx.drawImage(BW.glowSprite('#ffe096'), x - 50, y - 68, 100, 100);
                ctx.restore();
                this.game.addLight(x, y - 18, 70, '#ffe0a0', 0.3 * un);
            }

            ctx.save();
            ctx.translate(x, y - 16 + b);
            ctx.rotate(-0.12);
            // rolled parchment with a ribbon
            ctx.fillStyle = mix('#e9d9b2', '#8a8068', k);
            BW.roundRect(ctx, -16, -8, 32, 16, 8);
            ctx.fill();
            ctx.strokeStyle = mix('#503719', '#000000', k, 0.75, 0.45);
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(-14, 0, 4, 8, 0, 0, Math.PI * 2);
            ctx.fillStyle = mix('#cdb98a', '#6f664f', k);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = mix('#b32a3a', '#5a3a3a', k);
            ctx.fillRect(-2, -9, 5, 18);
            ctx.restore();
        }
    };

    function mix(a, b, k, aa = 1, ab = 1) {
        const pa = parseInt(a.slice(1), 16),
            pb = parseInt(b.slice(1), 16);

        const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);

        return `rgba(${ch(16)},${ch(8)},${ch(0)},${aa * (1 - k) + ab * k})`;
    }

    BW.Lore = Lore;
})(window.BW);

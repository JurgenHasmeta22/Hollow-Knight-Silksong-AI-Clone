'use strict';
// Gallery (pause menu): realms and artwork you have unlocked, full portraits of creatures and folk you have met, and
// story memories that can be watched again. Everything here is read-only: the save and the world are never touched.
(function (BW) {
    const M = BW.Menu.prototype,
        G = BW.Game.prototype;
    const GOLD = '#e8c98a',
        CREAM = '#f2e6cc';
    const TABS = ['Realms', 'Creatures', 'Memories'];

    const flag = (st, k) => !!(st.flags && st.flags[k]);
    const L = () => BW.Lore;

    function areaRooms(st, id) {
        let seen = 0,
            all = 0;
        for (const r of BW.ROOM_LIST)
            if (r.area === id) {
                all++;
                if (st.visited && st.visited[r.id]) seen++;
            }
        return [seen, all];
    }

    // ------------------------------------------------------------------ content
    function realms(st) {
        const area = (id, name, sub, far, mid, music, text, hint) => ({
            id,
            name,
            sub,
            far,
            mid,
            music,
            text,
            hint,
            rooms: areaRooms(st, id),
            open: areaRooms(st, id)[0] > 0,
        });
        return [
            area(
                'mosslit',
                'Mosslit Hollow',
                'Where the lanterns first fell dark',
                'bg_mosslit_far',
                'bg_mosslit_mid',
                'mus_mosslit',
                'Glowing moss and tangled roots, where the last lamplighter still walks his route. The deep places crept upward from here first.',
                'Where your journey begins.',
            ),
            area(
                'spindle',
                'The Spindleworks',
                'Where the cords were spun',
                'bg_spindle_far',
                'bg_spindle_mid',
                'mus_spindle',
                'Looms, lifts and spools of cord. The guild spun the rope of every bell in the city here, and the machines still hum as if waiting for a hand.',
                'Travel east and climb.',
            ),
            area(
                'belfry',
                'The Silent Belfry',
                'Mouths open, clappers bound',
                'bg_belfry_far',
                'bg_belfry_mid',
                'mus_belfry',
                'Great bells hang in their frames with their mouths open to the sky. Not one has rung since the Last Toll, and every clapper is tied with the same careful knot.',
                'Break the Belfry Seal.',
            ),
            area(
                'cathedral',
                'Cathedral of the Last Toll',
                'Where the Great Bell hangs',
                'bg_cathedral_far',
                'bg_belfry_mid',
                'mus_belfry',
                'The heart of the Belfry. The Great Bell waits here, held in silence by the keeper who swore to hold it.',
                'Open the great doors.',
            ),
            {
                id: 'title',
                name: 'The Last Bellweaver',
                sub: 'The needle, the thread and the silent city',
                far: 'title_art',
                mid: null,
                music: 'mus_title',
                open: true,
                text: 'You are the last who remembers how to rethread a toll-loom. Take up the needle. Kindle the lanterns. Wake the bells.',
            },
            {
                id: 'dawn',
                name: 'The Bell Rings Again',
                sub: 'Dawn over the Hollow',
                far: 'end_dawn',
                mid: null,
                music: 'mus_ending',
                open: flag(st, 'ending_seen'),
                text: 'The Great Bell spoke, and the Belfry answered. Down through the looms and the roots, every silent bell rang out once more.',
                hint: 'Rethread the Great Bell.',
            },
        ];
    }

    const BG = {
        crawler: 'bg_mosslit_far',
        flyer: 'bg_mosslit_far',
        sentinel: 'bg_spindle_far',
        spitter: 'bg_spindle_far',
        hopper: 'bg_belfry_far',
        warden: 'bg_cathedral_far',
        odo: 'bg_mosslit_far',
        hero: 'bg_belfry_far',
    };

    function creatures(st) {
        const c = BW.Codex.data(st);
        const list = BW.Codex.BEASTS.map((b) => ({
            id: b.id,
            name: b.name,
            sub: b.epithet,
            where: b.habitat,
            sprite: b.sprite,
            text: b.lore,
            hint: b.hint,
            open: !!c.seen[b.id],
            stat: c.kills[b.id] ? `Defeated  ${c.kills[b.id]}` : 'Not yet defeated',
        }));
        list.push({
            id: 'odo',
            name: 'Odo, the Lamplighter',
            sub: 'Still walking his route',
            where: 'Mosslit Hollow',
            sprite: 'odo_idle',
            open: flag(st, 'odo_met'),
            hint: 'A lantern still burns somewhere on the Glowmoss Path.',
            text: [
                'A lamplighter of the old city who never stopped walking his route, though almost every lantern has gone dark.',
                'He keeps what light he can, and sells what thread he has to anyone willing to keep walking.',
            ],
        });
        list.push({
            id: 'hero',
            name: 'The Last Bellweaver',
            sub: 'The one who remembers the knot',
            where: 'Wherever the bells once reached',
            sprite: 'hero_idle',
            open: true,
            text: [
                'A weaver of the old guild, the last who remembers how to rethread a toll-loom.',
                'Needle for a blade, silk for a lifeline: every blow gathers thread, and every thread is a chance to mend.',
            ],
        });
        for (const e of list) e.bg = BG[e.id];
        return list;
    }

    // split paragraphs into slides small enough to read comfortably
    function chunk(kicker, title, art, paras) {
        const out = [];
        let cur = [],
            n = 0;
        for (const p of paras) {
            if (cur.length && n + p.length > 330) {
                out.push(cur);
                cur = [];
                n = 0;
            }
            cur.push(p);
            n += p.length;
        }
        if (cur.length) out.push(cur);
        return out.map((lines) => ({ chapter: true, kicker, title, art, lines }));
    }

    function memories(st) {
        const f = (k) => flag(st, k),
            ab = st.abilities || {},
            lore = L();
        const shrine = [];
        if (ab.dash)
            shrine.push(
                ...chunk('Learned the Swift Stitch', 'Silk Dash', 'bg_spindle_far', [
                    'Dash on the ground or in mid-air. One air dash per jump; it returns when you land or strike downward.',
                    'Dashing never costs silk.',
                ]),
            );
        if (ab.parry)
            shrine.push(
                ...chunk('Learned the Answering Toll', 'Parry', 'bg_spindle_far', [
                    'Meet a blow just as it lands to turn it aside.',
                    'A clean parry costs you nothing, breaks the foe\u2019s rhythm and opens it to a counter.',
                ]),
            );
        if (ab.dodge)
            shrine.push(
                ...chunk('Learned the Unwoven Step', 'Shadow Step', 'bg_spindle_far', [
                    'Dash through a blow just as it is about to land and slip it entirely.',
                    'A shadow of you remains, and the foe is frozen for a moment. Strike it while it is stunned.',
                ]),
            );
        const looms = [];
        if (f('bell1'))
            looms.push(
                ...chunk('The First Toll-Loom', 'A Thread Rewoven', 'bg_spindle_far', [
                    'The first loom sang, and far above a hatch unbolted and a lift stirred.',
                ]),
            );
        if (f('bell2'))
            looms.push(
                ...chunk('The Second Toll-Loom', 'The Cord Lift Wakes', 'bg_spindle_far', [
                    'The second loom sang, and the Cord Lift woke, rising toward the Belfry.',
                ]),
            );
        if (f('belfry_open'))
            looms.push(
                ...chunk('The Belfry Seal', 'The Way Opens', 'bg_belfry_far', [
                    'Both looms rang and the Belfry Seal broke. The path to the silent bells lay open.',
                ]),
            );
        const warden = chunk('Cathedral of the Last Toll', 'The Great Doors', 'bg_cathedral_far', [
            'Beyond the Belfry, the Cathedral waits where the Great Bell hangs.',
            'Something sits bound to it by silk, and has not moved in a very long time.',
        ]).concat(
            chunk('The Bellbound Warden', 'Keeper of the Last Toll', 'bg_cathedral_far', BW.Codex.BY_ID.warden.lore),
        );
        if (lore.has(st, 'name'))
            warden.push(...chunk('A keeper\u2019s record', 'Orrin Vael', 'bg_cathedral_far', lore.BY_ID.name.text));
        const vow = chunk('The Last Toll', 'The Vow Is Broken', 'bg_cathedral_far', [
            'The Warden fell, and its silk hung slack from the Great Bell.',
            'Only one thing remained: to rethread it.',
        ]);
        if (lore.has(st, 'last'))
            vow.push(...chunk('Orrin Vael', 'Last Words', 'bg_cathedral_far', lore.BY_ID.last.text));
        const interlude = (id) => [Object.assign({ chapter: true }, lore.INTERLUDES[id])];

        return [
            {
                id: 'prologue',
                name: 'The City of Bells',
                sub: 'Prologue',
                art: 'bg_belfry_far',
                music: 'mus_title',
                open: true,
                slides: lore.INTRO,
                text: 'How the Great Bell fell silent, and the Hollow began to fray.',
            },
            {
                id: 'spindle',
                name: 'Where the Cords Were Spun',
                sub: 'The Spindleworks',
                art: 'bg_spindle_far',
                music: 'mus_spindle',
                open: f('lore_spindle'),
                slides: interlude('spindle'),
                hint: 'Enter the Spindleworks.',
                text: 'The guild that spun the cord for every bell in the city.',
            },
            {
                id: 'belfry',
                name: 'Mouths Open, Clappers Bound',
                sub: 'The Silent Belfry',
                art: 'bg_belfry_far',
                music: 'mus_belfry',
                open: f('lore_belfry'),
                slides: interlude('belfry'),
                hint: 'Reach the Silent Belfry.',
                text: 'The great bells, hanging silent in their frames.',
            },
            {
                id: 'shrines',
                name: 'The Three Stitches',
                sub: 'Shrines of the Spindleworks',
                art: 'bg_spindle_far',
                music: 'mus_spindle',
                open: shrine.length > 0,
                slides: shrine,
                hint: 'Learn a stitch at a shrine.',
                text: 'The Swift Stitch, the Answering Toll and the Unwoven Step.',
            },
            {
                id: 'looms',
                name: 'The Toll-Looms',
                sub: 'The Belfry Seal',
                art: 'bg_spindle_far',
                music: 'mus_spindle',
                open: looms.length > 0,
                slides: looms,
                hint: 'Rethread a toll-loom.',
                text: 'Two looms, two songs, and the seal that kept the Belfry closed.',
            },
            {
                id: 'warden',
                name: 'The Keeper of the Last Toll',
                sub: 'Cathedral of the Last Toll',
                art: 'bg_cathedral_far',
                music: 'mus_belfry',
                open: f('warden_met'),
                slides: warden,
                hint: 'Reach the Cathedral and face what sits bound there.',
                text: 'The one who swore to hold the bell, and held it too long.',
            },
            {
                id: 'vow',
                name: 'The Vow Broken',
                sub: 'After the Warden',
                art: 'bg_cathedral_far',
                music: 'mus_belfry',
                open: f('warden_defeated'),
                slides: vow,
                hint: 'Defeat the Bellbound Warden.',
                text: 'What was left when the silence ended.',
            },
            {
                id: 'ending',
                name: 'The Great Bell Rings',
                sub: 'Epilogue and credits',
                art: 'end_dawn',
                music: 'mus_ending',
                open: f('ending_seen'),
                ending: true,
                hint: 'Rethread the Great Bell.',
                text: 'The final toll, the epilogue and the credits.',
            },
        ];
    }

    function lists(d, st) {
        return d.lists || (d.lists = [realms(st), creatures(st), memories(st)]);
    }

    // ------------------------------------------------------------------ replay (game side)
    G.startReplay = function (mem) {
        this.replayMusic = BW.Audio.musicName;
        if (mem.music) BW.Audio.playMusic(mem.music, 1.5);
        if (mem.ending) {
            this.replayEnding();
            return;
        }
        this.mode = 'replay';
        this.replay = { gen: BW.Lore.play(this, mem.slides), wait: 0 };
    };

    G.updateReplay = function (dt) {
        const r = this.replay;
        if (!r) {
            this.endReplay();
            return;
        }
        if (r.wait > 0) {
            r.wait -= dt;
            if (r.wait > 0) return;
        }
        const s = r.gen.next();
        if (s.done) {
            this.endReplay();
            return;
        }
        r.wait = typeof s.value === 'number' ? s.value : 0;
    };

    G.endReplay = function () {
        this.replay = null;
        this.ending = null;
        this.loreSlide = null;
        this.whiteFade = 0;
        this.mode = 'play';
        BW.Audio.playMusic(this.replayMusic || null, 1.5);
    };

    // ------------------------------------------------------------------ input
    M.galleryMusic = function (d) {
        const e = lists(d, this.game.state)[d.tab][d.i[d.tab]];
        const want = d.tab === 0 && e.open && e.music ? e.music : d.music0;
        BW.Audio.playMusic(want || null, 1.5);
    };

    M.galleryUpdate = function (dt, inp) {
        const s = this.screen,
            d = s.data,
            st = this.game.state;
        if (d.music0 === undefined) {
            d.music0 = BW.Audio.musicName;
            d.ft = 0;
            d.t = 0;
            this.galleryMusic(d);
        }
        d.t += dt;
        d.ft = Math.min(1, d.ft + dt * 3);
        const list = lists(d, st)[d.tab],
            n = list.length;
        const changed = () => {
            d.ft = 0;
            BW.Audio.play('ui_move');
            this.galleryMusic(d);
        };

        if (inp.pressed.left || inp.pressed.right) {
            d.tab = (d.tab + (inp.pressed.right ? 1 : TABS.length - 1)) % TABS.length;
            changed();
            return;
        }
        const step = (k) => {
            d.i[d.tab] = (d.i[d.tab] + k + n) % n;
            changed();
        };
        if (inp.pressed.up) step(-1);
        if (inp.pressed.down) step(1);
        if (inp.down.up || inp.down.down) {
            d.rep = (d.rep || 0) + dt;
            if (d.rep > 0.4) {
                d.rep = 0.3;
                step(inp.down.up ? -1 : 1);
            }
        } else d.rep = 0;

        const e = list[d.i[d.tab]];
        if (d.tab === 2 && inp.pressed.confirm && this.t > 0.1) {
            if (e.open) {
                BW.Audio.play('ui_ok');
                this.game.startReplay(e);
            } else BW.Audio.play('ui_back');
            return;
        }
        if ((inp.pressed.back || inp.pressed.pause) && this.t > 0.1) {
            BW.Audio.play('ui_back');
            BW.Audio.playMusic(d.music0 || null, 1.5);
            this.pop();
        }
    };

    // ------------------------------------------------------------------ drawing
    function wrap(ctx, text, maxW) {
        const out = [];
        let line = '';
        for (const w of String(text).split(' ')) {
            const t = line ? line + ' ' + w : w;
            if (line && ctx.measureText(t).width > maxW) {
                out.push(line);
                line = w;
            } else line = t;
        }
        out.push(line);
        return out;
    }

    // paragraphs of left-aligned text; returns the next free y
    function paras(ctx, list, x, y, maxW, lh, gap) {
        for (const p of list) {
            for (const l of wrap(ctx, p, maxW)) {
                ctx.fillText(l, x, y);
                y += lh;
            }
            y += gap;
        }
        return y;
    }

    function cover(ctx, name, t, zoom, alpha, w = BW.VW, h = BW.VH, ox = 0, oy = 0) {
        const img = name && BW.Assets.img(name);
        if (!img) return;
        const k = Math.max(w / img.width, h / img.height) * zoom,
            iw = img.width * k,
            ih = img.height * k;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.drawImage(
            img,
            ox + (w - iw) / 2 + Math.sin(t * 0.12) * 18,
            oy + (h - ih) / 2 + Math.cos(t * 0.09) * 10,
            iw,
            ih,
        );
        ctx.restore();
    }

    // the near layer, tiled like the in-game backdrop
    function midLayer(ctx, name, t, alpha) {
        const img = name && BW.Assets.img(name);
        if (!img) return;
        const s = (BW.VH * 1.05) / img.height,
            w = img.width * s,
            h = img.height * s;
        let x = (BW.VW - w) / 2 + Math.sin(t * 0.2) * 30,
            n = 0;
        while (x > 0) {
            x -= w;
            n++;
        }
        ctx.save();
        ctx.globalAlpha *= alpha;
        for (let xx = x; xx < BW.VW; xx += w, n++) {
            if (n % 2 === 0) ctx.drawImage(img, xx, BW.VH - h, w, h);
            else {
                ctx.save();
                ctx.translate(xx + w, BW.VH - h);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, w, h);
                ctx.restore();
            }
        }
        ctx.restore();
    }

    function shade(ctx, y0, y1, a0, a1) {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, `rgba(3,4,8,${a0})`);
        g.addColorStop(1, `rgba(3,4,8,${a1})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.min(y0, y1), BW.VW, Math.abs(y1 - y0));
    }

    function heading(ctx, e, x, y, locked) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 50px ${BW.FONT_T}`;
        ctx.fillStyle = locked ? 'rgba(200,190,170,0.55)' : CREAM;
        ctx.fillText(locked ? '???' : e.name, x, y);
        ctx.font = `italic 500 24px ${BW.FONT_B}`;
        ctx.fillStyle = locked ? 'rgba(232,201,138,0.4)' : GOLD;
        ctx.fillText(locked ? 'Not yet discovered' : e.sub, x, y + 36);
    }

    function drawRealm(ctx, e, a, t) {
        const VW = BW.VW,
            VH = BW.VH;
        ctx.save();
        ctx.globalAlpha = a;
        cover(ctx, e.far, t, 1.1, e.open ? 1 : 0.1);
        if (e.open && e.mid) midLayer(ctx, e.mid, t, 0.85);
        shade(ctx, VH * 0.45, VH, 0, 0.9);
        shade(ctx, 0, 150, 0.75, 0);
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 14;
        heading(ctx, e, 70, VH - 190, !e.open);
        ctx.font = `500 23px ${BW.FONT_B}`;
        ctx.fillStyle = '#e8dcc2';
        if (e.open) {
            const y = paras(ctx, [e.text], 70, VH - 118, 760, 31, 0);
            if (e.rooms && e.rooms[1]) {
                ctx.font = `500 18px ${BW.FONT_B}`;
                ctx.fillStyle = 'rgba(232,201,138,0.8)';
                ctx.fillText(`Rooms discovered  ${e.rooms[0]} / ${e.rooms[1]}`, 70, Math.max(y, VH - 118) + 6);
            }
        } else {
            ctx.fillStyle = 'rgba(225,214,192,0.6)';
            ctx.fillText(e.hint || 'Not yet visited.', 70, VH - 118);
        }
        ctx.restore();
    }

    function drawCreature(ctx, e, a, t) {
        const VW = BW.VW,
            VH = BW.VH;
        ctx.save();
        ctx.globalAlpha = a;
        cover(ctx, e.bg, t, 1.1, 0.6);
        ctx.fillStyle = 'rgba(4,5,8,0.5)';
        ctx.fillRect(0, 0, VW, VH);
        const floor = VH * 0.8,
            cx = 340;
        const gl = ctx.createRadialGradient(cx, floor - 120, 20, cx, floor - 120, 340);
        gl.addColorStop(0, 'rgba(232,201,138,0.18)');
        gl.addColorStop(1, 'rgba(232,201,138,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(0, 0, VW * 0.6, VH);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(cx, floor + 6, 190, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        const sp = BW.Assets.sprite(e.sprite);
        if (sp && sp.frames.length) {
            let mw = 0,
                mh = 0;
            for (const f of sp.frames) {
                mw = Math.max(mw, f[2]);
                mh = Math.max(mh, f[3]);
            }
            const k = Math.min(520 / mw, 420 / mh, 2.2),
                f0 = sp.frames[0];
            const ax = f0[4] != null ? f0[4] : sp.ax || 0,
                ay = f0[5] != null ? f0[5] : sp.ay || 0;
            const hover = e.id === 'flyer' ? 30 + Math.sin(t * 2) * 12 : 0;
            const fi = sp.frames.length > 1 ? Math.floor(t * (sp.fps || 6)) : 0;
            ctx.save();
            if (!e.open) {
                ctx.filter = 'brightness(0)';
                ctx.globalAlpha *= 0.55;
            }
            BW.Assets.draw(ctx, e.sprite, fi, cx + (ax - f0[2] / 2) * k, floor - (f0[3] - ay) * k - hover, {
                scale: k / sp.scale,
                rim: e.open ? 0.5 : 0,
            });
            ctx.restore();
        }
        // text panel
        const px = 700,
            py = 100,
            pw = 530,
            ph = 520;
        ctx.fillStyle = 'rgba(10,12,18,0.74)';
        BW.roundRect(ctx, px, py, pw, ph, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(236,222,190,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 38px ${BW.FONT_T}`;
        ctx.fillStyle = e.open ? CREAM : 'rgba(200,190,170,0.55)';
        ctx.fillText(e.open ? e.name : '???', px + 32, py + 64);
        ctx.font = `italic 500 22px ${BW.FONT_B}`;
        ctx.fillStyle = e.open ? GOLD : 'rgba(232,201,138,0.4)';
        ctx.fillText(e.open ? e.sub : 'Not yet encountered', px + 32, py + 98);
        if (e.open) {
            ctx.font = `500 17px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.65)';
            ctx.fillText('Found in: ' + e.where, px + 32, py + 128);
            ctx.strokeStyle = 'rgba(232,201,138,0.3)';
            ctx.beginPath();
            ctx.moveTo(px + 32, py + 150);
            ctx.lineTo(px + pw - 32, py + 150);
            ctx.stroke();
            ctx.font = `500 22px ${BW.FONT_B}`;
            ctx.fillStyle = '#e6dac0';
            const y = paras(ctx, e.text, px + 32, py + 190, pw - 64, 30, 12);
            if (e.stat) {
                ctx.font = `600 18px ${BW.FONT_B}`;
                ctx.fillStyle = 'rgba(232,201,138,0.85)';
                ctx.fillText(e.stat.toUpperCase(), px + 32, Math.min(y + 8, py + ph - 28));
            }
        } else {
            ctx.font = `italic 500 22px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.6)';
            paras(ctx, [e.hint || 'Not yet met.'], px + 32, py + 150, pw - 64, 30, 0);
        }
        ctx.restore();
    }

    function drawMemories(ctx, list, d, a, t) {
        const VW = BW.VW,
            VH = BW.VH,
            sel = d.i[2],
            cur = list[sel];
        ctx.save();
        ctx.globalAlpha = a;
        cover(ctx, cur.open ? cur.art : null, t, 1.1, 0.35);
        ctx.restore();
        ctx.fillStyle = 'rgba(4,5,8,0.7)';
        ctx.fillRect(0, 0, VW, VH);
        // list
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        list.forEach((m, i) => {
            const y = 170 + i * 56,
                on = i === sel;
            ctx.font = `${on ? 600 : 500} 27px ${BW.FONT_B}`;
            ctx.fillStyle = !m.open ? 'rgba(200,190,170,0.35)' : on ? '#fff1d0' : 'rgba(225,214,192,0.72)';
            ctx.fillText(m.open ? m.name : '???', 96, y);
            if (on) {
                ctx.save();
                ctx.translate(64, y);
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = GOLD;
                ctx.fillRect(-5, -5, 10, 10);
                ctx.restore();
            }
        });
        // preview card
        const x = 540,
            y = 130,
            w = 690,
            h = 320;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#05060a';
        BW.roundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.save();
        BW.roundRect(ctx, x, y, w, h, 12);
        ctx.clip();
        cover(ctx, cur.open ? cur.art : null, t, 1.1, 0.95, w, h, x, y);
        shade(ctx, y + h * 0.4, y + h, 0, 0.75);
        ctx.restore();
        ctx.strokeStyle = 'rgba(236,222,190,0.35)';
        ctx.lineWidth = 1.2;
        BW.roundRect(ctx, x, y, w, h, 12);
        ctx.stroke();
        if (cur.open) {
            const pulse = 0.85 + 0.15 * Math.sin(t * 3),
                cx = x + w / 2,
                cy = y + h / 2 - 10;
            ctx.fillStyle = 'rgba(6,7,10,0.55)';
            ctx.beginPath();
            ctx.arc(cx, cy, 38, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(240,226,196,${pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = `rgba(255,241,208,${pulse})`;
            ctx.beginPath();
            ctx.moveTo(cx - 10, cy - 17);
            ctx.lineTo(cx + 18, cy);
            ctx.lineTo(cx - 10, cy + 17);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.font = `600 80px ${BW.FONT_T}`;
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(200,190,170,0.35)';
            ctx.fillText('?', x + w / 2, y + h / 2);
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 38px ${BW.FONT_T}`;
        ctx.fillStyle = cur.open ? CREAM : 'rgba(200,190,170,0.55)';
        ctx.fillText(cur.open ? cur.name : '???', x, y + h + 56);
        ctx.font = `italic 500 22px ${BW.FONT_B}`;
        ctx.fillStyle = cur.open ? GOLD : 'rgba(232,201,138,0.4)';
        ctx.fillText(cur.open ? cur.sub : 'Not yet unlocked', x, y + h + 90);
        ctx.font = `500 22px ${BW.FONT_B}`;
        ctx.fillStyle = cur.open ? '#e0d4ba' : 'rgba(225,214,192,0.6)';
        paras(ctx, [cur.open ? cur.text : cur.hint || ''], x, y + h + 130, w, 30, 0);
        ctx.restore();
    }

    M.galleryDraw = function (ctx) {
        const d = this.screen.data,
            st = this.game.state,
            VW = BW.VW,
            VH = BW.VH;
        const all = lists(d, st),
            list = all[d.tab],
            i = d.i[d.tab],
            a = Math.min(1, (d.ft == null ? 1 : d.ft) * 1.2),
            t = d.t || 0;
        ctx.save();
        ctx.fillStyle = '#04050a';
        ctx.fillRect(0, 0, VW, VH);
        if (d.tab === 0) drawRealm(ctx, list[i], a, t);
        else if (d.tab === 1) drawCreature(ctx, list[i], a, t);
        else drawMemories(ctx, list, d, a, t);

        // header: title, tabs, progress
        shade(ctx, 0, 110, 0.7, 0);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = `600 22px ${BW.FONT_T}`;
        ctx.fillStyle = GOLD;
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '6px';
        ctx.fillText('GALLERY', 48, 48);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.textAlign = 'center';
        ctx.font = `600 26px ${BW.FONT_B}`;
        TABS.forEach((name, k) => {
            const x = VW / 2 + (k - 1) * 190,
                on = k === d.tab;
            ctx.fillStyle = on ? '#fff1d0' : 'rgba(225,214,192,0.5)';
            ctx.fillText(name, x, 48);
            if (on) {
                const w = ctx.measureText(name).width / 2 + 10;
                ctx.fillStyle = GOLD;
                ctx.fillRect(x - w, 68, w * 2, 2);
            }
        });
        ctx.textAlign = 'right';
        ctx.font = `500 18px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(225,214,192,0.7)';
        ctx.fillText(`${list.filter((e) => e.open).length} / ${list.length} unlocked`, VW - 48, 48);

        // position pips (the list itself is on screen in Memories)
        if (d.tab !== 2) {
            for (let k = 0; k < list.length; k++) {
                const on = k === i;
                ctx.fillStyle = on ? GOLD : list[k].open ? 'rgba(232,201,138,0.45)' : 'rgba(232,201,138,0.18)';
                ctx.beginPath();
                ctx.arc(VW - 34, VH / 2 + (k - (list.length - 1) / 2) * 22, on ? 5 : 3.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // footer hint
        shade(ctx, VH - 60, VH, 0, 0.7);
        ctx.textAlign = 'center';
        ctx.font = `500 18px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(230,220,200,0.65)';
        const I = BW.Input;
        ctx.fillText(
            `Left / Right  category      Up / Down  browse${d.tab === 2 ? `      ${I.label('confirm')}  watch` : ''}      ${I.label('back')}  close`,
            VW / 2,
            VH - 26,
        );
        ctx.restore();
    };
})(window.BW);

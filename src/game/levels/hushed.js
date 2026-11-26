'use strict';

// Chapter II: what happens in the Hushed Gallery beyond what the rooms and creatures do on their own.
//   * the silent bells: striking one tolls, wakes every Hushed in the room and parts the veil gate it is tied to
//   * the Long Mourner's real victory (flags mourner_met / mourner_defeated, XP, the east veil gate)
//   * the Silent Key on its altar, and the Last Door it opens
//   * the chapter-complete card
(function (BW) {
    const T = BW.T;

    const G = BW.Game.prototype;

    const skipPressed = () => BW.Input.pressed.jump || BW.Input.pressed.attack || BW.Input.pressed.confirm;

    // ================================================================ silent bells
    // Every silent bell definition in the world that belongs to a group (a group may span rooms: its gate can be anywhere)
    const bellsOf = (group) => {
        const out = [];

        for (const r of BW.ROOM_LIST)
            for (const e of r.ents) if (e.type === 'silentbell' && e.group === group) out.push(e);

        return out;
    };

    // Called by a bell when the needle (or a lance) strikes it. The first strike unwraps it; every strike tolls.
    // A group with `order` set must be struck in that order: a bell struck out of turn winds the whole set up again.
    G.hushToll = function (bell) {
        const st = this.state,
            f = st.flags,
            room = this.room,
            def = bell.def,
            first = !f[bell.flag],
            group = def.group ? bellsOf(def.group) : [def];

        if (first && def.order && def.gate && !f[def.gate]) {
            const rung = group.filter((e) => f['hbell_' + e.id]).length;

            if (def.order !== rung + 1) {
                this.hushWrong(bell, group);

                return;
            }
        }

        f[bell.flag] = true;

        if (first) bell.unwrap();

        BW.Audio.play('bell', { pitch: bell.pitch, vol: 1, minGap: 0 });
        BW.Audio.play('bellfar', { pitch: bell.pitch / 2, vol: 0.9, minGap: 0 });
        this.fx.shake(6, 0.45);
        this.fx.flash('#cfeaff', 0.12);

        for (let i = 0; i < 3; i++)
            this.fx.ring(bell.x, bell.y - 90, 20, 360 + i * 160, 0.9 + i * 0.2, '#9fd8ff', 4 - i);

        // every Hushed that can hear it comes to the sound
        for (const e of this.enemies) if (!e.dead && e.onToll) e.onToll(bell);

        // the veil gate this bell (or its group of bells) is tied to
        if (def.gate) {
            const done = group.filter((e) => f['hbell_' + e.id]).length;

            if (done === group.length) {
                if (!f[def.gate]) {
                    f[def.gate] = true;

                    const here = room.gates.filter((gt) => gt.flag === def.gate && !gt.open);

                    for (const gt of here) this.openGateAnimated(gt);

                    if (here.length)
                        this.hud.toast('The veil parts', 'The way on is open. Something heard the bell.', 3.4);
                    else
                        this.hud.toast(
                            'A veil parts',
                            'Somewhere in the Gallery a way has opened. Something heard the bell.',
                            3.8,
                        );
                }
            } else if (first) this.hud.toast(`Bell unwrapped (${done}/${group.length})`, 'The Hushed have heard it', 3);
        }

        if (first) this.gainXp(BW.XP.REWARD.bell || 20);

        this.saveGame();
    };

    // A bell struck out of order: a dull, wrong toll, the cloth pulls tight on every bell of its set, and the Hushed hear it.
    G.hushWrong = function (bell, group) {
        const f = this.state.flags;

        for (const e of group) delete f['hbell_' + e.id];

        for (const o of this.objects)
            if (o.type === 'silentbell' && o.def.group === bell.def.group && o.rung) o.rewrap();

        BW.Audio.play('bell', { pitch: bell.pitch / 4, vol: 0.9, minGap: 0 });
        BW.Audio.play('bellfar', { pitch: 41.2, vol: 1, minGap: 0 });
        this.fx.shake(5, 0.35);
        this.fx.flash('#05080c', 0.18);
        this.fx.ring(bell.x, bell.y - 90, 20, 240, 0.7, '#3a4f5e', 5);

        for (const e of this.enemies) if (!e.dead && e.onToll) e.onToll(bell);

        this.saveGame();
    };

    // ================================================================ keepsakes on altars (the Mourners' Shears)
    G.takeRelic = function (altar) {
        this.startSequence(relicSequence(this, altar));
    };

    function* relicSequence(g, altar) {
        const p = g.player,
            st = g.state,
            R = BW.HUSH_RELICS[altar.def.relic];

        p.state = 'cutscene';
        p.vx = 0;
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        p.facing = altar.x > p.cx ? 1 : -1;
        g.camFocus = { x: altar.x, y: altar.y - 110 };
        yield 0.5;

        BW.Audio.play('shrine', { vol: 0.9 });
        BW.Audio.play('bellfar', { pitch: 146.8, vol: 0.9, minGap: 0 });
        g.fx.ring(altar.x, altar.y - 118, 10, 220, 0.9, '#9fd8ff', 4);

        g.fx.burst(altar.x, altar.y - 118, 34, {
            color: ['#9fd8ff', '#e6f6ff', '#ffffff'],
            kind: 'glow',
            speed: 240,
            life: 1.1,
            add: true,
            size: 9,
        });

        st.flags[altar.def.relic] = true;
        g.gainXp(BW.XP.REWARD.relic || 100);
        g.saveGame();
        yield 0.6;

        g.letterboxTarget = 0;
        g.camFocus = null;
        g.seq.hideHud = false;
        p.state = 'normal';

        g.hud.showAnnounce({
            kicker: 'Obtained',
            title: R.name,
            lines: R.lines,
            icon: (ctx, x, y, t) => R.icon(ctx, x, y + Math.sin(t * 2) * 4, 1.1),
        });

        yield () => !g.hud.announce;
    }

    // ================================================================ the Long Mourner's victory
    G.onMournerDefeated = function (b) {
        const st = this.state;

        st.flags.mourner_defeated = true;
        st.stats.mournerWinTime = st.stats.mournerWinTime || st.stats.playTime;
        BW.Codex.kill(st, 'mourner');
        this.gainXp(BW.XP.REWARD.mourner);
        this.saveGame();

        // a trade of final blows: the victory counts, the player wakes at a lantern and finds the way open
        if (this.player.state === 'dead') return;

        this.startSequence(mournerVictory(this, b));
    };

    function* mournerVictory(g, b) {
        const p = g.player;

        g.hitstop(0.3);
        g.slowT = 1.4;
        g.fx.flash('#e6f6ff', 0.8);
        g.fx.shake(10, 0.6);
        BW.Audio.playMusic(null, 2.5);
        g.seq.hideHud = true;
        g.letterboxTarget = 1;
        p.state = 'cutscene';
        p.vx = 0;
        p.dashT = 0;
        p.attackT = 0;
        g.camFocus = { x: b.cx, y: b.y + 70 };
        yield () => b.state === 'remains';
        g.hazards = [];

        if (g.bossBar) g.bossBar.out = true;

        yield 0.8;

        // a few words, then the veil to the east lets go
        const say = function* (text, hold) {
            const s = (g.seqText = { text, a: 0, y: 0.8, size: 31, color: '#cfe6ff' });

            for (let i = 0; i < 48; i++) {
                s.a = i / 48;
                yield 1 / 60;
            }

            yield hold;

            for (let i = 0; i < 36; i++) {
                s.a = 1 - i / 36;
                yield 1 / 60;
            }

            g.seqText = null;
        };

        yield* say('It never learned that the dead had gone quiet long ago.', 2.2);
        yield* say('Now, at last, so has it.', 1.8);

        const gt = g.room.gates.find((x) => x.flag === 'mourner_defeated' && !x.open);

        if (gt) {
            g.camFocus = { x: ((gt.x0 + gt.x1 + 1) / 2) * T - 120, y: ((gt.y0 + gt.y1 + 1) / 2) * T - 100 };
            yield 0.8;
            g.openGateAnimated(gt);
            BW.Audio.play('bellfar', { pitch: 146.8, vol: 0.9, minGap: 0 });
            yield 1.8;
        }

        g.arenaLock(false);
        g.arenaCam = false;
        g.camFocus = null;
        g.letterboxTarget = 0;
        g.seq.hideHud = false;
        p.state = 'normal';
        BW.Audio.playMusic(null, 1);
        g.hud.toast('The Long Mourner is still', 'The veil to the east has parted. Something waits on an altar.', 4.5);
    }

    // ================================================================ the Silent Key
    function keyIcon(ctx, x, y, t) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const g = ctx.createRadialGradient(x, y, 0, x, y, 90);

        g.addColorStop(0, 'rgba(159,216,255,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 90, y - 90, 180, 180);
        ctx.restore();
        BW.Assets.drawImg(ctx, 'item_silentkey', x, y + Math.sin(t * 2) * 4, { w: 40, h: 150, ay: 0.5 });
    }

    G.takeSilentKey = function (altar) {
        this.startSequence(keySequence(this, altar));
    };

    function* keySequence(g, altar) {
        const p = g.player,
            st = g.state;

        p.state = 'cutscene';
        p.vx = 0;
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        p.facing = altar.x > p.cx ? 1 : -1;
        g.camFocus = { x: altar.x, y: altar.y - 110 };
        yield 0.5;

        BW.Audio.play('shrine', { vol: 0.9 });
        BW.Audio.play('bellfar', { pitch: 130.8, vol: 0.9, minGap: 0 });
        g.fx.ring(altar.x, altar.y - 118, 10, 220, 0.9, '#9fd8ff', 4);

        g.fx.burst(altar.x, altar.y - 118, 34, {
            color: ['#9fd8ff', '#e6f6ff', '#ffffff'],
            kind: 'glow',
            speed: 240,
            life: 1.1,
            add: true,
            size: 9,
        });

        st.flags.silent_key = true;
        g.gainXp(BW.XP.REWARD.key || 120);
        g.saveGame();
        yield 0.6;

        g.letterboxTarget = 0;
        g.camFocus = null;
        g.seq.hideHud = false;
        p.state = 'normal';

        g.hud.showAnnounce({
            kicker: 'Obtained',
            title: 'The Silent Key',
            lines: [
                'A key with a blank porcelain bow and a bit like a bell without a clapper.',
                'It opens the Last Door, at the far end of this hall.',
            ],
            icon: keyIcon,
        });

        yield () => !g.hud.announce;
    }

    // ================================================================ the Last Door
    G.openLastDoor = function (door) {
        this.startSequence(lastDoorOpen(this, door));
    };

    function* lastDoorOpen(g, door) {
        const p = g.player,
            st = g.state;

        p.state = 'cutscene';
        p.vx = 0;
        p.facing = door.x > p.cx ? 1 : -1;
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        g.camFocus = { x: door.x - 40, y: door.y - 170 };
        BW.Audio.duckMusic(0.2, 8);
        yield 0.6;

        // the key's thread runs from you to the keyhole
        for (let i = 0; i < 100; i++) {
            if (i % 2 === 0)
                g.fx.thread(p.cx, p.cy - 10, door.x + BW.rand(-8, 8), door.y - 150 + BW.rand(-10, 10), 0.4, '#9fd8ff');

            if (i % 8 === 0) BW.Audio.play('text', { vol: 0.8, minGap: 0 });

            yield 1 / 60;
        }

        BW.Audio.play('bell', { pitch: 98, vol: 1, minGap: 0 });
        g.fx.ring(door.x, door.y - 150, 20, 420, 1.2, '#cfeaff', 4);
        yield 0.9;

        st.flags.lastdoor_open = true;
        g.saveGame();
        door.opening = true;
        BW.Audio.play('doors');
        g.fx.shake(6, 3);
        g.fx.flash('#e6f6ff', 0.4);

        for (let i = 0; i < 150; i++) {
            if (i % 3 === 0)
                g.fx.spawn({
                    x: door.x + BW.rand(-30, 30),
                    y: door.y - BW.rand(60, 260),
                    vx: BW.rand(-60, 60),
                    vy: BW.rand(-30, 10),
                    life: 1.6,
                    size: BW.rand(2, 4.5),
                    color: BW.pick(['#9fd8ff', '#e6f6ff', '#ffffff']),
                    kind: 'glow',
                    add: true,
                    drag: 0.6,
                });

            yield 1 / 60;
        }

        yield 1.0;
        g.camFocus = null;
        g.letterboxTarget = 0;
        g.seq.hideHud = false;
        p.state = 'normal';
        g.hud.toast('The Last Door stands open', 'A cold light pours out. Step into it when you are ready.', 4.5);
    }

    G.enterLastDoor = function (door) {
        if (this.state.flags.chapter2_clear) {
            this.dialog.open(
                'The Last Door',
                [
                    'Beyond the open door a pale light climbs a stair that has not been walked in a very long time.',
                    'Whatever waits at the top is not ready for you yet. Perhaps neither are you.',
                ],
                { kind: 'sign' },
            );

            return;
        }

        this.startSequence(chapterEnd(this, door));
    };

    function* chapterEnd(g, door) {
        const p = g.player,
            st = g.state;

        p.state = 'cutscene';
        p.vx = 0;
        p.facing = door.x > p.cx ? 1 : -1;
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        g.camFocus = { x: door.x - 40, y: door.y - 170 };

        // the light takes everything
        for (const f of [196, 246.9, 329.6])
            for (let i = 0; i < 30; i++) {
                if (i === 0) BW.Audio.play('bellfar', { pitch: f, vol: 0.9, minGap: 0 });

                g.whiteFade = Math.min(1, g.whiteFade + 1 / 90);
                yield 1 / 60;
            }

        g.whiteFade = 1;
        st.flags.chapter2_clear = true;
        st.stats.chapter2Time = st.stats.chapter2Time || st.stats.playTime;
        g.saveGame();

        // wake beside the last lantern, in the hall with the open door
        st.lantern = 'lan_h8';
        st.lanternRoom = 'H8';
        st.lanternsLit.lan_h8 = true;

        const c = (g.chapterCard = {
            a: 0,
            t: 0,
            time: st.stats.chapter2Time || 0,
            attempts: st.stats.mournerAttempts || 1,
        });

        for (let i = 0; i <= 50; i++) {
            c.a = i / 50;
            c.t += 1 / 60;
            g.whiteFade = Math.max(0, 1 - i / 50);
            yield 1 / 60;
        }

        BW.Audio.play('bellfar', { pitch: 130.8, vol: 0.9, minGap: 0 });

        while (c.t < 11) {
            c.t += 1 / 60;
            yield 1 / 60;

            if (c.t > 3 && skipPressed()) break;
        }

        g.fade = 0;

        for (let i = 0; i <= 36; i++) {
            g.fade = i / 36;
            yield 1 / 60;
        }

        g.chapterCard = null;
        g.whiteFade = 0;
        g.letterboxTarget = 0;
        g.camFocus = null;
        st.hp = st.maxHp;
        st.silk = 0;
        g.respawnAtLantern(true);
        g.saveGame();
        g.seq.hideHud = false;
        g.fade = 0;
        g.hud.toast('The Hushed Gallery is quiet', 'The Last Door stands open behind you.', 4.5);
    }

    G.drawChapterCard = function (ctx) {
        const c = this.chapterCard,
            cx = BW.VW / 2;

        const fmt = (s) => {
            const m = Math.floor(s / 60);

            return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
        };

        ctx.save();
        ctx.globalAlpha = c.a;
        ctx.fillStyle = '#04070a';
        ctx.fillRect(0, 0, BW.VW, BW.VH);

        const art = BW.Assets.img('bg_gallery_realm');

        if (art) {
            const s = Math.max(BW.VW / art.width, BW.VH / art.height);

            ctx.globalAlpha = c.a * 0.55;
            ctx.drawImage(
                art,
                (BW.VW - art.width * s) / 2,
                (BW.VH - art.height * s) / 2,
                art.width * s,
                art.height * s,
            );
        }

        ctx.globalAlpha = c.a;

        const vg = ctx.createRadialGradient(cx, BW.VH / 2, BW.VH * 0.2, cx, BW.VH / 2, BW.VH * 0.95);

        vg.addColorStop(0, 'rgba(2,6,10,0.35)');
        vg.addColorStop(1, 'rgba(2,4,6,0.92)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, BW.VW, BW.VH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#9fd8ff';
        ctx.font = `600 26px ${BW.FONT_T}`;

        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '10px';

        ctx.fillText('CHAPTER II', cx, BW.VH * 0.3);
        ctx.font = `600 64px ${BW.FONT_T}`;
        ctx.fillStyle = '#e8f3fb';
        ctx.fillText('THE HUSHED GALLERY', cx, BW.VH * 0.4);
        ctx.font = `600 24px ${BW.FONT_T}`;
        ctx.fillStyle = '#9fd8ff';
        ctx.fillText('C O M P L E T E', cx, BW.VH * 0.49);

        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.shadowBlur = 0;
        ctx.font = `italic 500 30px ${BW.FONT_B}`;
        ctx.fillStyle = '#c9dbe8';
        ctx.fillText('The Gallery is quiet at last, and the quiet was only a door.', cx, BW.VH * 0.6);
        ctx.font = `italic 500 24px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(201,219,232,0.7)';
        ctx.fillText('Beyond it, a cold light climbs a stair. Something there is still unspun.', cx, BW.VH * 0.67);
        ctx.font = `500 20px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(201,219,232,0.6)';
        ctx.fillText(
            `Time ${fmt(c.time)}   ·   The Long Mourner: ${c.attempts} ${c.attempts === 1 ? 'attempt' : 'attempts'}`,
            cx,
            BW.VH * 0.76,
        );

        if (c.t > 3) {
            ctx.globalAlpha = c.a * (0.5 + 0.3 * Math.sin(c.t * 3));
            ctx.font = `500 18px ${BW.FONT_B}`;
            ctx.fillText('press any button', cx, BW.VH * 0.9);
        }

        ctx.restore();
    };
})(window.BW);

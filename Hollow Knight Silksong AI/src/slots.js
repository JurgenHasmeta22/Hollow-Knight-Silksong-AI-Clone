'use strict';
// Menu screens for manual saves (slot cards), the lantern menu, the Warden rematch briefing and the test saves.
(function (BW) {
    const M = BW.Menu.prototype;
    const Save = BW.Save;
    const orn = BW.menuOrnament,
        needle = BW.menuNeedle;

    function when(iso) {
        if (!iso) return '';

        const d = new Date(iso);

        if (isNaN(d)) return '';
        
        return (
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
            '  ' +
            d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        );
    }

    // ================================================================ slot cards
    M.slotRefresh = function (s) {
        const c = { '-1': Save.summary(Save.readRaw()) };
        
        for (let i = 0; i < Save.SLOTS; i++) c[i] = Save.summary(Save.readSlot(i));
        
        s.data.cache = c;
    };

    M.slotItems = function () {
        const g = this.game,
            s = this.screen,
            mode = s.data.mode;

        if (!s.data.cache) this.slotRefresh(s);
        
        const c = s.data.cache,
            out = [];

        const loadWith = (run) => {
            if (g.mode === 'play')
                this.push('confirm', {
                    title: 'LOAD GAME',
                    q: 'Load this save? Progress since your last rest or manual save will be lost.',
                    yes: () => {
                        this.closeAll();
                        run();
                    },
                });

            else {
                this.closeAll();
                run();
            }
        };
        if (mode === 'load')
            out.push({
                slot: -1,
                label: 'Autosave',
                sum: c[-1],
                disabled: !c[-1],
                act: () => loadWith(() => g.continueGame()),
            });

        for (let i = 0; i < Save.SLOTS; i++) {
            out.push({
                slot: i,
                label: 'Slot ' + (i + 1),
                sum: c[i],
                disabled: mode === 'load' && !c[i],
                act: () => {
                    if (mode === 'load') loadWith(() => g.loadSlot(i));
                    
                    else if (c[i])
                        this.push('confirm', {
                            title: 'OVERWRITE SAVE',
                            q: `Overwrite slot ${i + 1}? The older save will be replaced.`,
                            yes: () => this.slotWrite(i),
                        });

                    else this.slotWrite(i);
                },
            });
        }

        out.push({ label: 'Back', act: () => this.pop() });
        return out;
    };

    M.slotWrite = function (i) {
        const ok = this.game.saveToSlot(i);
        
        this.flash(ok ? `Saved to slot ${i + 1}.` : 'Could not write the save (storage full or blocked).');
        
        if (this.screen && this.screen.name === 'slots') this.slotRefresh(this.screen);
    };

    // delete a filled slot with the Mend key (Q / LT)
    M.slotsKeys = function (inp, items) {
        if (!inp.pressed.heal) return false;

        const it = items[this.sel];

        if (!it || it.slot == null || it.slot < 0 || !it.sum) return false;
        
        inp.consume('heal');
        
        BW.Audio.play('ui_ok');
        
        this.push('confirm', {
            title: 'DELETE SAVE',
            q: `Delete slot ${it.slot + 1} permanently?`,
            yes: () => {
                Save.eraseSlot(it.slot);
                this.flash(`Slot ${it.slot + 1} deleted.`);
                if (this.screen && this.screen.name === 'slots') this.slotRefresh(this.screen);
            },
        });

        return true;
    };

    M.drawSlots = function (ctx) {
        const s = this.screen,
            mode = s.data.mode,
            items = this.items(),
            W = BW.VW,
            cx = W / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 38px ${BW.FONT_T}`;
        ctx.fillStyle = '#f2e6cc';
        ctx.fillText(mode === 'save' ? 'SAVE GAME' : 'LOAD GAME', cx, 58);
        
        orn(ctx, cx, 90, 150);
        const x = 150,
            w = W - 300,
            h = 74,
            gap = 8,
            y0 = 118;

        let backY = 0;

        items.forEach((it, i) => {
            if (it.slot == null) {
                backY = y0 + i * (h + gap) + 24;
                return;
            }

            const y = y0 + i * (h + gap),
                on = i === this.sel,
                sum = it.sum,
                dim = it.disabled;

            ctx.save();
            ctx.fillStyle = on ? 'rgba(34,30,24,0.92)' : 'rgba(14,16,22,0.78)';
            
            BW.roundRect(ctx, x, y, w, h, 10);
            
            ctx.fill();
            ctx.lineWidth = on ? 2 : 1;
            ctx.strokeStyle = on ? 'rgba(240,206,140,0.9)' : 'rgba(236,222,190,0.2)';
            ctx.stroke();
            
            if (sum) {
                ctx.fillStyle = sum.areaColor;
                ctx.globalAlpha = on ? 0.9 : 0.55;

                BW.roundRect(ctx, x, y, 7, h, 4);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // badge
            const bx = x + 50,
                by = y + h / 2;

            ctx.strokeStyle = on ? '#e8c98a' : 'rgba(232,201,138,0.45)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(bx, by, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = `600 ${it.slot < 0 ? 17 : 24}px ${BW.FONT_T}`;
            ctx.fillStyle = dim ? 'rgba(232,201,138,0.3)' : '#e8c98a';
            ctx.textAlign = 'center';
            ctx.fillText(it.slot < 0 ? 'AUTO' : String(it.slot + 1), bx, by + 1);
            ctx.textAlign = 'left';
            
            if (!sum) {
                ctx.font = `italic 500 25px ${BW.FONT_B}`;
                ctx.fillStyle = on ? 'rgba(230,220,200,0.75)' : 'rgba(200,190,170,0.4)';
                ctx.fillText(mode === 'save' ? 'Empty \u2014 save here' : 'Empty', x + 96, by);
            } else {
                const nm = sum.difficulty === 'nightmare';
                ctx.font = `600 27px ${BW.FONT_B}`;
                ctx.fillStyle = on ? '#fff1d0' : '#e8dcc2';
                ctx.fillText(sum.place, x + 96, y + 26);
                ctx.font = `500 19px ${BW.FONT_B}`;
                ctx.fillStyle = 'rgba(205,190,160,0.85)';
                
                const diffName = BW.Difficulty.LEVELS[sum.difficulty] ? BW.Difficulty.LEVELS[sum.difficulty].name : '';
                ctx.fillText(sum.area, x + 96, y + 53);
                
                const aw = ctx.measureText(sum.area).width;
                ctx.fillStyle = nm ? '#ff5a68' : '#e8c98a';
                ctx.fillText('\u00b7  ' + diffName, x + 96 + aw + 10, y + 53);
                
                if (sum.ending || sum.warden) {
                    const dw = ctx.measureText('\u00b7  ' + diffName).width;
                    ctx.fillStyle = '#ffd98a';
                    
                    ctx.fillText(
                        sum.ending ? '\u2726 Bell rung' : '\u2726 Warden fallen',
                        x + 96 + aw + 10 + dw + 14,
                        y + 53,
                    );
                }

                // stats column
                ctx.textAlign = 'right';
                ctx.font = `500 21px ${BW.FONT_B}`;
                ctx.fillStyle = '#efe6d2';
                ctx.fillText(BW.fmtTime(sum.time), x + w - 24, y + 22);
                ctx.font = `500 17px ${BW.FONT_B}`;
                ctx.fillStyle = 'rgba(205,190,160,0.8)';
                ctx.fillText(when(sum.saved), x + w - 24, y + 52);
                
                const col = (label, val, rx) => {
                    ctx.textAlign = 'center';
                    ctx.font = `500 16px ${BW.FONT_B}`;
                    ctx.fillStyle = 'rgba(205,190,160,0.6)';
                    ctx.fillText(label, rx, y + 20);
                    ctx.font = `600 22px ${BW.FONT_B}`;
                    ctx.fillStyle = '#efe6d2';
                    ctx.fillText(val, rx, y + 48);
                };

                col('BELLS', String(sum.hearts), x + w - 450);
                col('GLINTS', String(sum.glints), x + w - 375);
                col('NOTES', `${sum.notes}/${sum.notesTotal}`, x + w - 300);
                col('DEATHS', String(sum.deaths), x + w - 225);
                
                // map progress strip
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(x + 96, y + h - 9, w - 96 - 480, 3);
                ctx.fillStyle = on ? '#e8c98a' : 'rgba(232,201,138,0.55)';
                ctx.fillRect(x + 96, y + h - 9, ((w - 96 - 480) * sum.pct) / 100, 3);
            }

            ctx.restore();

            if (on) {
                needle(ctx, x - 22, y + h / 2, 1, this.t);
                needle(ctx, x + w + 22, y + h / 2, -1, this.t);
            }
        });

        // back row
        const bi = items.length - 1,
            on = this.sel === bi;

        ctx.textAlign = 'center';
        ctx.font = `${on ? 600 : 500} 30px ${BW.FONT_B}`;
        ctx.fillStyle = on ? '#fff1d0' : 'rgba(225,214,192,0.75)';
        ctx.fillText('Back', cx, backY + 12);
        
        if (on) {
            needle(ctx, cx - 76, backY + 12, 1, this.t);
            needle(ctx, cx + 76, backY + 12, -1, this.t);
        }

        ctx.font = `italic 500 18px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(225,214,192,0.55)';

        const sel = items[this.sel];
        const hint =
            mode === 'save'
                ? 'Manual saves keep a full copy of your progress. You resume at your last lantern.'
                : 'Loading resumes at the lantern you last rested at.';
        
        ctx.fillText(
            hint + (sel && sel.slot >= 0 && sel.sum ? `   ${BW.Input.label('heal')}  delete` : ''),
            cx,
            BW.VH - 30,
        );

        ctx.restore();
    };

    // ================================================================ lantern menu
    M.lanternItems = function () {
        const g = this.game,
            can = g.canRematch();

        return [
            {
                label: 'Travel to a Lantern',
                desc: g.canTravel()
                    ? 'Walk the thread to any lantern you have already kindled. Health is restored.'
                    : 'Kindle more lanterns to travel between them.',
                disabled: !g.canTravel(),
                act: () => g.openTravel(),
            },
            {
                label: 'Save Game',
                desc: 'Write your progress to one of five manual slots.',
                act: () => this.push('slots', { mode: 'save' }),
            },
            {
                label: 'Boss Rematch',
                desc: can
                    ? 'Face the Bellbound Warden again. Nothing is earned, nothing is lost.'
                    : 'Defeat the Bellbound Warden to unlock rematches.',
                disabled: !can,
                act: () => this.push('rematch'),
            },
            { label: 'Stand Up', act: () => this.pop() },
        ];
    };

    M.drawLantern = function (ctx) {
        const g = this.game,
            cx = BW.VW / 2,
            t = this.t,
            px = cx - 330,
            py = 96,
            pw = 660,
            ph = 520;

        ctx.save();
        ctx.fillStyle = 'rgba(14,16,22,0.78)';

        BW.roundRect(ctx, px, py, pw, ph, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(236,222,190,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(236,222,190,0.12)';
        ctx.lineWidth = 1;

        BW.roundRect(ctx, px + 8, py + 8, pw - 16, ph - 16, 11);
        ctx.stroke();
        
        const gl = ctx.createRadialGradient(cx, py + 90, 6, cx, py + 90, 190);
        gl.addColorStop(0, `rgba(255,205,120,${0.4 + 0.06 * Math.sin(t * 4)})`);
        gl.addColorStop(1, 'rgba(255,205,120,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gl;
        ctx.fillRect(px, py, pw, 260);
        ctx.globalCompositeOperation = 'source-over';
        
        BW.Assets.drawImg(ctx, 'obj_lantern_lit', cx, py + 132, { w: 66, h: 112, ay: 1 });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 36px ${BW.FONT_T}`;
        ctx.fillStyle = '#f2e6cc';
        ctx.fillText('LANTERN', cx, py + 172);
        
        const room = g.room && g.room.def;
        ctx.font = `italic 500 21px ${BW.FONT_B}`;
        ctx.fillStyle = '#cbbd9f';
        ctx.fillText(room ? `${room.name} \u2014 ${BW.AREAS[room.area].name}` : '', cx, py + 204);
        orn(ctx, cx, py + 226, 140);
        
        ctx.restore();
        
        this.drawList(ctx, '', py + 270, cx, 54);
        
        const it = this.items()[this.sel];
        
        if (it && it.desc) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `italic 500 21px ${BW.FONT_B}`;
            ctx.fillStyle = '#cbbd9f';
            BW.wrapText(ctx, it.desc, cx, py + ph - 48, pw - 120, 26);
            ctx.restore();
        }
    };

    // ================================================================ Warden rematch briefing
    M.rematchItems = function () {
        const g = this.game;

        return [
            {
                label: 'Begin Rematch',
                tint: '#e8b45a',
                act: () => {
                    this.closeAll();
                    g.startRematch();
                },
            },
            { label: 'Not yet', act: () => this.pop() },
        ];
    };

    M.drawRematch = function (ctx) {
        const g = this.game,
            st = g.state,
            W = BW.VW,
            H = BW.VH,
            cx = W / 2,
            t = this.t;

        ctx.save();
        
        const em = ctx.createRadialGradient(cx, H * 0.95, 40, cx, H * 0.95, H * 0.9);
        em.addColorStop(0, `rgba(255,120,40,${0.22 + 0.05 * Math.sin(t * 3)})`);
        em.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = em;
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 22px ${BW.FONT_T}`;
        ctx.fillStyle = '#e8c98a';
        
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '8px';
        ctx.fillText('BOSS REMATCH', cx + 4, 70);
        ctx.font = `600 56px ${BW.FONT_T}`;
        ctx.fillStyle = '#f7ecd6';
        ctx.shadowColor = 'rgba(255,150,60,0.5)';
        ctx.shadowBlur = 24;
        
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
        ctx.fillText('THE BELLBOUND WARDEN', cx, 128);
        ctx.shadowBlur = 0;
        
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.font = `italic 500 26px ${BW.FONT_B}`;
        ctx.fillStyle = '#d9cbb0';
        ctx.fillText('Keeper of the Last Toll', cx, 176);
        
        orn(ctx, cx, 206, 200);
        // record card
        const w = 760,
            x = cx - w / 2,
            y = 240,
            h = 112;

        ctx.fillStyle = 'rgba(14,16,22,0.8)';
        
        BW.roundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(236,222,190,0.28)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const stats = st.stats || {};
        const cols = [
            ['BEST TIME', stats.rematchBest ? BW.fmtTime(stats.rematchBest) : '\u2014'],
            ['REMATCHES WON', String(stats.rematchWins || 0)],
            ['FIRST ATTEMPTS', String(stats.wardenAttempts || 0)],
            ['DIFFICULTY', BW.Difficulty.get(st).name],
        ];

        cols.forEach((c, i) => {
            const rx = x + (w * (i + 0.5)) / cols.length;
            ctx.font = `500 16px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(205,190,160,0.65)';
            ctx.fillText(c[0], rx, y + 32);
            ctx.font = `600 30px ${BW.FONT_B}`;
            ctx.fillStyle = '#fff1d0';
            ctx.fillText(c[1], rx, y + 72);
        });

        // rules
        const rules = [
            ['\u2726', 'No glints, lifethreads or Archive entries are earned.'],
            ['\u2726', 'Dying costs nothing: you wake at the lantern you left from.'],
            ['\u2726', 'Your story progress and the Great Bell are left untouched.'],
            ['\u2726', 'The Warden fights at your current difficulty.'],
        ];

        ctx.textAlign = 'left';
        ctx.font = `500 24px ${BW.FONT_B}`;
        rules.forEach((r, i) => {
            ctx.fillStyle = '#e8c98a';
            ctx.fillText(r[0], cx - 360, 392 + i * 40);
            ctx.fillStyle = '#efe6d2';
            ctx.fillText(r[1], cx - 330, 392 + i * 40);
        });

        ctx.restore();
        this.drawList(ctx, '', 590);
    };

    // ================================================================ test saves
    M.testSaveItems = function () {
        const g = this.game;
        const list = BW.TestSaves ? BW.TestSaves.LIST : [];

        return [
            ...list.map((e) => ({
                label: e.name,
                desc: e.desc,
                act: () =>
                    this.push('confirm', {
                        title: 'LOAD TEST SAVE',
                        q: 'This replaces your autosave with a ready-made one. Manual slots are not touched.',
                        yes: () => {
                            this.closeAll();
                            BW.TestSaves.load(g, e.id);
                        },
                    }),
            })),
            { label: 'Back', act: () => this.pop() },
        ];
    };

    M.drawBottomDesc = function (ctx) {
        const it = this.items()[this.sel];

        if (!it || !it.desc) return;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `italic 500 23px ${BW.FONT_B}`;
        ctx.fillStyle = '#cbbd9f';
        
        BW.wrapText(ctx, it.desc, BW.VW / 2, BW.VH - 120, BW.VW * 0.6, 30);
        ctx.restore();
    };
})(window.BW);

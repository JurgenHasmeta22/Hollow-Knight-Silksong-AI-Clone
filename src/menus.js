'use strict';

// Title screen, pause menu, options, controls, save import/export, confirmations and the world map.
(function (BW) {
    const T = BW.T;

    class Menu {
        constructor(game) {
            this.game = game;
            this.stack = [];
            this.sel = 0;
            this.t = 0;
            this.msg = '';
            this.msgT = 0;
            this.repeatT = 0;
            this.mapCanvas = {};
            this.mapPan = { x: 0, y: 0 };
        }
        get screen() {
            return this.stack[this.stack.length - 1] || null;
        }
        get open() {
            return this.stack.length > 0;
        }
        push(name, data) {
            this.stack.push({ name, data: data || {} });
            this.sel = this.firstEnabled();
            this.t = 0;
            this.mapPan = { x: 0, y: 0 };
            this.mapZoom = 0;
        }
        pop() {
            this.stack.pop();
            this.sel = 0;
            this.t = 0;

            if (this.screen && this.screen.lastSel != null) this.sel = this.screen.lastSel;
        }
        closeAll() {
            this.stack = [];
        }
        flash(m) {
            this.msg = m;
            this.msgT = 3.5;
        }
        firstEnabled() {
            const it = this.items();

            for (let i = 0; i < it.length; i++) if (!it[i].disabled) return i;

            return 0;
        }

        // Controller icon style (Auto follows the connected pad)
        padItem() {
            const O = BW.Glyphs.ORDER,
                st = BW.settings;

            return {
                label: 'Controller Icons',
                type: 'choice',
                get: () => BW.Glyphs.styleName(),
                set: (d) => {
                    st.pad = O[(O.indexOf(st.pad || 'auto') + d + O.length) % O.length];
                    this.game.applySettings();
                },
            };
        }

        // A left/right choice backed by one settings key; `after` can replace the default step handler.
        cycle(label, key, order, names, after) {
            const g = this.game,
                st = BW.settings;

            const cur = () => {
                const v = st[key];

                return order.indexOf(v) >= 0 || key === 'quality' ? v : order[0];
            };

            return {
                label,
                type: 'choice',
                get: () => names[cur()] || String(cur()),
                set:
                    after ||
                    ((d) => {
                        const i = Math.max(0, order.indexOf(cur()));

                        st[key] = order[(i + d + order.length) % order.length];

                        if (key === 'res') g.autoCap = null;

                        g.applySettings();
                    }),
            };
        }

        items() {
            const g = this.game,
                s = this.screen;

            if (!s) return [];

            const st = BW.settings;

            switch (s.name) {
                case 'title': {
                    const has = BW.Save.exists();

                    return [
                        { label: 'Continue', act: () => g.continueGame(), disabled: !has },
                        { label: 'Load Game', act: () => this.push('slots', { mode: 'load' }) },
                        {
                            label: 'New Game',
                            act: () =>
                                has
                                    ? this.push('confirm', {
                                          title: 'NEW JOURNEY',
                                          q: 'Start a new journey? Your autosave will be overwritten (manual save slots are kept).',
                                          yes: () => this.push('difficulty'),
                                      })
                                    : this.push('difficulty'),
                        },
                        { label: 'Options', act: () => this.push('options') },
                        { label: 'Controls', act: () => this.push('controls') },
                        { label: 'Save Data', act: () => this.push('savedata') },
                        ...(this.titleCleared() ? [{ label: 'Credits', act: () => g.titleCredits() }] : []),
                    ];
                }
                case 'pause':
                    return [
                        { label: 'Resume', act: () => this.closeAll() },
                        { label: 'Map', act: () => this.push('map') },
                        { label: 'Archive', act: () => this.push('guide', { tab: 0, page: 0, scroll: 0 }) },
                        { label: 'Gallery', act: () => this.push('gallery', { tab: 0, i: [0, 0, 0] }) },
                        { label: 'Options', act: () => this.push('options') },
                        { label: 'Save Game', act: () => this.push('slots', { mode: 'save' }) },
                        { label: 'Load Game', act: () => this.push('slots', { mode: 'load' }) },
                        {
                            label: 'Return to Last Lantern',
                            act: () =>
                                this.push('confirm', {
                                    q: 'Return to the last lantern you rested at?',
                                    yes: () => {
                                        this.closeAll();
                                        g.returnToLantern();
                                    },
                                }),
                        },
                        {
                            label: 'Save & Quit to Title',
                            act: () => {
                                g.saveGame();
                                this.closeAll();
                                g.toTitle();
                            },
                        },
                    ];
                case 'difficulty':
                    return [
                        ...BW.Difficulty.ORDER.map((id) => ({
                            id,
                            label: BW.Difficulty.LEVELS[id].name,
                            desc: BW.Difficulty.LEVELS[id].desc,
                            tint: BW.Difficulty.LEVELS[id].lock ? '#d4283a' : null,
                            act: () => {
                                if (BW.Difficulty.LEVELS[id].lock) {
                                    this.push('warn', { id });
                                    this.sel = 1;
                                } else {
                                    this.closeAll();
                                    g.newGame(id);
                                }
                            },
                        })),
                        { label: 'Back', act: () => this.pop() },
                    ];
                case 'warn':
                    return [
                        {
                            label: 'Descend into Nightmare',
                            tint: '#d4283a',
                            act: () => {
                                this.closeAll();
                                g.newGame(s.data.id);
                            },
                        },
                        { label: 'Turn back', act: () => this.pop() },
                    ];
                case 'options':
                    return [
                        { label: 'Audio', act: () => this.push('opt_audio') },
                        { label: 'Graphics', act: () => this.push('opt_graphics') },
                        { label: 'Gameplay', act: () => this.push('opt_game') },
                        { label: 'Controls', act: () => this.push('controls') },
                        { label: 'Back', act: () => this.pop() },
                    ];
                case 'opt_audio':
                    return [
                        {
                            label: 'Master Volume',
                            type: 'slider',
                            get: () => st.master,
                            set: (v) => {
                                st.master = v;
                                g.applySettings();
                            },
                        },
                        {
                            label: 'Music',
                            type: 'slider',
                            get: () => st.music,
                            set: (v) => {
                                st.music = v;
                                g.applySettings();
                            },
                        },
                        {
                            label: 'Sound Effects',
                            type: 'slider',
                            get: () => st.sfx,
                            set: (v) => {
                                st.sfx = v;
                                g.applySettings();
                                BW.Audio.play('swing');
                            },
                        },
                        {
                            label: 'Ambience',
                            type: 'slider',
                            get: () => st.ambience,
                            set: (v) => {
                                st.ambience = v;
                                g.applySettings();
                            },
                        },
                        {
                            label: 'Interface Sounds',
                            type: 'slider',
                            get: () => st.ui,
                            set: (v) => {
                                st.ui = v;
                                g.applySettings();
                                BW.Audio.play('ui_move');
                            },
                        },
                        {
                            label: 'Mute When Unfocused',
                            type: 'toggle',
                            get: () => st.muteBlur !== false,
                            set: (v) => {
                                st.muteBlur = v;
                                g.applySettings();
                            },
                        },
                        { label: 'Back', act: () => this.pop() },
                    ];
                case 'opt_graphics':
                    return [
                        this.cycle(
                            'Quality',
                            'quality',
                            ['low', 'medium', 'high'],
                            { low: 'Low', medium: 'Medium', high: 'High', custom: 'Custom' },
                            (d) => {
                                const o = ['low', 'medium', 'high'],
                                    i = o.indexOf(st.quality);

                                BW.Gfx.usePreset(st, o[i < 0 ? (d > 0 ? 2 : 0) : (i + d + o.length) % o.length]);
                                g.autoCap = null;
                                g.applySettings();
                            },
                        ),
                        this.cycle('Resolution', 'res', ['auto', '1080', '900', '720'], {
                            auto: 'Auto',
                            1080: '1080p',
                            900: '900p',
                            720: '720p',
                        }),
                        this.cycle('Lighting', 'lighting', ['full', 'simple', 'off'], {
                            full: 'Full',
                            simple: 'Simple',
                            off: 'Off',
                        }),
                        this.cycle('Particles', 'particles', ['high', 'medium', 'low'], {
                            high: 'High',
                            medium: 'Medium',
                            low: 'Low',
                        }),
                        this.cycle('Ambient Effects', 'ambient', ['on', 'reduced', 'off'], {
                            on: 'On',
                            reduced: 'Reduced',
                            off: 'Off',
                        }),
                        this.cycle('Backdrop Detail', 'backdrop', ['high', 'low'], { high: 'High', low: 'Low' }),
                        this.cycle('Frame Limit', 'fpsCap', [0, 30, 60], { 0: 'Off', 30: '30', 60: '60' }),
                        this.cycle('FPS Counter', 'fpsCounter', ['off', 'fps', 'full'], {
                            off: 'Off',
                            fps: 'FPS',
                            full: 'Detailed',
                        }),
                        {
                            label: 'Fullscreen',
                            type: 'toggle',
                            get: () => !!document.fullscreenElement,
                            set: () => g.toggleFullscreen(),
                        },
                        { label: 'Back', act: () => this.pop() },
                    ];
                case 'opt_game':
                    return [
                        {
                            label: 'Screen Shake',
                            type: 'toggle',
                            get: () => st.shake,
                            set: (v) => {
                                st.shake = v;
                                g.applySettings();
                            },
                        },
                        {
                            label: 'Control Hints',
                            type: 'toggle',
                            get: () => st.hints,
                            set: (v) => {
                                st.hints = v;
                                g.applySettings();
                            },
                        },
                        this.padItem(),
                        ...(g.mode === 'play' && g.state
                            ? [
                                  {
                                      label: 'Difficulty',
                                      type: 'choice',
                                      get: () =>
                                          BW.Difficulty.get(g.state).name +
                                          (BW.Difficulty.get(g.state).lock ? ' (locked)' : ''),
                                      set: (d) => {
                                          const cur = BW.Difficulty.get(g.state);

                                          if (cur.lock) {
                                              this.flash('Nightmare cannot be changed once chosen.');

                                              return;
                                          }

                                          const o = BW.Difficulty.ORDER.filter((id) => !BW.Difficulty.LEVELS[id].lock),
                                              i = o.indexOf(cur.id);

                                          g.state.difficulty = o[(i + d + o.length) % o.length];
                                          g.saveGame();
                                          this.flash('Enemy changes take effect in the next room you enter.');
                                      },
                                  },
                              ]
                            : []),
                        { label: 'Back', act: () => this.pop() },
                    ];
                case 'controls':
                    return [this.padItem(), { label: 'Back', act: () => this.pop() }];
                case 'savedata':
                    return [
                        { label: 'Test Saves (last boss, all unlocked)', act: () => this.push('testsaves') },
                        {
                            label: 'Export Save (download + copy)',
                            act: () => {
                                const ok = BW.Save.exportDownload();

                                this.flash(
                                    ok
                                        ? 'Save exported as bellweaver-save.json (also copied to clipboard).'
                                        : 'There is no save to export yet.',
                                );
                            },
                        },
                        {
                            label: 'Import Save File',
                            act: () =>
                                BW.Save.importFromFile((r) => {
                                    this.flash(r.msg);

                                    if (r.ok) g.onSaveImported();
                                }),
                        },
                        {
                            label: 'Paste Save Text',
                            act: () => {
                                const txt = window.prompt('Paste the contents of a bellweaver-save.json file:');

                                if (txt) {
                                    const r = BW.Save.importText(txt);

                                    this.flash(r.msg);

                                    if (r.ok) g.onSaveImported();
                                }
                            },
                        },
                        {
                            label: 'Delete Save',
                            act: () =>
                                this.push('confirm', {
                                    q: 'Delete your saved progress permanently?',
                                    yes: () => {
                                        BW.Save.erase();
                                        this.pop();
                                        this.flash('Save deleted.');
                                    },
                                }),
                            disabled: !BW.Save.exists(),
                        },
                        { label: 'Back', act: () => this.pop() },
                    ];
                case 'confirm':
                    return [
                        {
                            label: 'Yes',
                            act: () => {
                                const y = s.data.yes;

                                this.pop();
                                y();
                            },
                        },
                        { label: 'No', act: () => this.pop() },
                    ];
                case 'map':
                    return [];
                case 'guide':
                    return this.guideItems();
                case 'slots':
                    return this.slotItems();
                case 'lantern':
                    return this.lanternItems();
                case 'rematch':
                    return this.rematchItems();
                case 'testsaves':
                    return this.testSaveItems();
                case 'travel':
                    return [
                        ...g.litLanterns().map((l) => {
                            const here = l.id === g.state.lantern;

                            return {
                                label: `${l.name} \u2014 ${l.area}${here ? '  (here)' : ''}`,
                                disabled: here,
                                act: () => {
                                    this.closeAll();
                                    g.travelTo(l.roomId, l.id);
                                },
                            };
                        }),
                        { label: 'Stay', act: () => this.pop() },
                    ];
                default:
                    return [];
            }
        }

        update(dt, inp) {
            this.t += dt;
            this.msgT = Math.max(0, this.msgT - dt);

            const s = this.screen;

            if (!s) return;

            if (s.name === 'map') {
                this.mapUpdate(dt, inp);

                return;
            }

            if (s.name === 'gallery') {
                this.galleryUpdate(dt, inp);

                return;
            }

            if (s.name === 'pause' && inp.pressed.map && this.t > 0.1) {
                BW.Audio.play('ui_ok');
                this.push('map');

                return;
            }

            const items = this.items();

            if (s.name === 'guide') this.guideNav(inp);
            if (s.name === 'slots' && this.slotsKeys(inp, items)) return;

            const move = (d) => {
                if (!items.length) return;

                let i = this.sel;

                for (let k = 0; k < items.length; k++) {
                    i = (i + d + items.length) % items.length;

                    if (!items[i].disabled) break;
                }

                if (i !== this.sel) {
                    this.sel = i;
                    BW.Audio.play('ui_move');
                }
            };

            if (inp.pressed.up) move(-1);
            if (inp.pressed.down) move(1);

            // held repeat
            if (inp.down.up || inp.down.down) {
                this.repeatT += dt;

                if (this.repeatT > 0.38) {
                    this.repeatT = 0.3;
                    move(inp.down.up ? -1 : 1);
                }
            } else this.repeatT = 0;

            const it = items[this.sel];

            if (it && it.type === 'slider') {
                if (inp.pressed.left) {
                    it.set(Math.max(0, Math.round((it.get() - 0.1) * 10) / 10));
                    BW.Audio.play('ui_move');
                }

                if (inp.pressed.right) {
                    it.set(Math.min(1, Math.round((it.get() + 0.1) * 10) / 10));
                    BW.Audio.play('ui_move');
                }
            }

            if (it && it.type === 'toggle' && (inp.pressed.left || inp.pressed.right)) {
                it.set(!it.get());
                BW.Audio.play('ui_move');
            }

            if (it && it.type === 'choice' && (inp.pressed.left || inp.pressed.right)) {
                it.set(inp.pressed.left ? -1 : 1);
                BW.Audio.play('ui_move');
            }

            if (inp.pressed.confirm && it && !it.disabled) {
                if (it.type === 'toggle') {
                    it.set(!it.get());
                    BW.Audio.play('ui_ok');
                } else if (it.type === 'choice') {
                    it.set(1);
                    BW.Audio.play('ui_ok');
                } else if (it.act) {
                    BW.Audio.play('ui_ok');
                    s.lastSel = this.sel;
                    it.act();
                }
            }

            if (inp.pressed.back && this.t > 0.1) {
                if (s.name === 'title') return;

                BW.Audio.play('ui_back');

                if (s.name === 'pause') this.closeAll();
                else this.pop();
            }

            if (inp.pressed.pause && s.name === 'pause' && this.t > 0.1) {
                this.closeAll();
            }
        }

        // ------------------------------------------------------------ drawing
        draw(ctx) {
            const s = this.screen;

            if (!s) return;
            if (s.name === 'title') return this.drawTitleMenu(ctx);
            if (s.name === 'map') return this.drawMap(ctx);
            if (s.name === 'gallery') return this.galleryDraw(ctx);

            ctx.save();
            ctx.fillStyle = 'rgba(3,4,8,0.78)';
            ctx.fillRect(0, 0, BW.VW, BW.VH);
            ctx.restore();

            if (s.name === 'pause') this.drawPause(ctx);
            else if (s.name === 'controls') this.drawControls(ctx);
            else if (s.name === 'warn') this.drawWarn(ctx);
            else if (s.name === 'confirm') this.drawConfirm(ctx);
            else if (s.name === 'guide') this.drawGuide(ctx);
            else if (s.name === 'slots') this.drawSlots(ctx);
            else if (s.name === 'lantern') this.drawLantern(ctx);
            else if (s.name === 'rematch') this.drawRematch(ctx);
            else if (s.name.startsWith('opt_'))
                this.drawList(
                    ctx,
                    { opt_audio: 'AUDIO', opt_graphics: 'GRAPHICS', opt_game: 'GAMEPLAY' }[s.name] || 'OPTIONS',
                    BW.VH * 0.29,
                    BW.VW / 2,
                    46,
                );
            else
                this.drawList(
                    ctx,
                    s.name === 'options'
                        ? 'OPTIONS'
                        : s.name === 'savedata'
                          ? 'SAVE DATA'
                          : s.name === 'testsaves'
                            ? 'TEST SAVES'
                            : s.name === 'difficulty'
                              ? 'CHOOSE DIFFICULTY'
                              : s.name === 'travel'
                                ? 'TRAVEL BETWEEN LANTERNS'
                                : '',
                    BW.VH * 0.32,
                );

            if (s.name === 'testsaves') this.drawBottomDesc(ctx);

            if (s.name === 'difficulty') {
                this.drawDesc(ctx);

                const it = this.items()[this.sel];

                if (it && it.tint) this.drawDreadVignette(ctx, 0.35);
            }

            this.drawMsg(ctx);
        }

        drawMsg(ctx) {
            if (this.msgT <= 0) return;

            ctx.save();
            ctx.globalAlpha = Math.min(1, this.msgT * 2);
            ctx.textAlign = 'center';
            ctx.font = `500 22px ${BW.FONT_B}`;
            ctx.fillStyle = '#ffe1a0';
            ctx.fillText(this.msg, BW.VW / 2, BW.VH - 60);
            ctx.restore();
        }

        drawDreadVignette(ctx, k) {
            const pulse = k * (0.75 + 0.25 * Math.sin(this.t * 3));
            const g = ctx.createRadialGradient(BW.VW / 2, BW.VH / 2, BW.VH * 0.25, BW.VW / 2, BW.VH / 2, BW.VH * 0.95);

            g.addColorStop(0, 'rgba(120,0,10,0)');
            g.addColorStop(1, `rgba(140,8,20,${pulse})`);
            ctx.save();
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, BW.VW, BW.VH);
            ctx.restore();
        }

        drawWarn(ctx) {
            ctx.save();
            ctx.fillStyle = 'rgba(30,0,6,0.7)';
            ctx.fillRect(0, 0, BW.VW, BW.VH);
            ctx.restore();
            this.drawDreadVignette(ctx, 0.6);
            drawNightmareIcon(ctx, BW.VW / 2, BW.VH * 0.17, 52, this.t);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const flick = 0.85 + 0.15 * Math.sin(this.t * 9) * Math.sin(this.t * 2.3);

            ctx.font = `600 54px ${BW.FONT_T}`;
            ctx.fillStyle = `rgba(214,40,58,${flick})`;

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '8px';

            ctx.fillText('NIGHTMARE', BW.VW / 2, BW.VH * 0.34);

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

            ornament(ctx, BW.VW / 2, BW.VH * 0.34 + 44, 200);
            ctx.font = `italic 500 28px ${BW.FONT_B}`;
            ctx.fillStyle = '#e6c9c4';

            BW.wrapText(
                ctx,
                'Rooms overrun. Foes faster, tougher, and twice as cruel. Mending takes far longer.',
                BW.VW / 2,
                BW.VH * 0.48,
                BW.VW * 0.6,
                36,
            );

            ctx.font = `600 30px ${BW.FONT_B}`;
            ctx.fillStyle = '#ff6b78';

            BW.wrapText(
                ctx,
                'Once chosen, this journey can never be lowered to another difficulty.',
                BW.VW / 2,
                BW.VH * 0.62,
                BW.VW * 0.6,
                36,
            );

            ctx.restore();
            this.drawList(ctx, '', BW.VH * 0.78);
        }

        drawDesc(ctx) {
            const it = this.items()[this.sel];

            if (!it || !it.desc) return;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `italic 500 24px ${BW.FONT_B}`;
            ctx.fillStyle = '#cbbd9f';
            BW.wrapText(ctx, it.desc, BW.VW / 2, BW.VH * 0.32 + 4 * 50 + 30, BW.VW * 0.6, 30);
            ctx.restore();
        }

        drawList(ctx, heading, y0, x0 = BW.VW / 2, step = 50) {
            const items = this.items();

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (heading) {
                ctx.font = `600 40px ${BW.FONT_T}`;
                ctx.fillStyle = '#f2e6cc';
                ctx.fillText(heading, x0, y0 - 80);
                ornament(ctx, x0, y0 - 46, 160);
            }

            items.forEach((it, i) => {
                const y = y0 + i * step,
                    on = i === this.sel;

                ctx.font = `${on ? 600 : 500} 30px ${BW.FONT_B}`;

                ctx.fillStyle = it.disabled
                    ? 'rgba(200,190,170,0.3)'
                    : it.tint
                      ? on
                          ? '#ff5a68'
                          : it.tint
                      : on
                        ? '#fff1d0'
                        : 'rgba(225,214,192,0.75)';

                let label = it.label;

                if (it.type === 'slider') label = `${it.label}   ${bar(it.get())}`;
                if (it.type === 'toggle') label = `${it.label}   ${it.get() ? 'On' : 'Off'}`;
                if (it.type === 'choice') label = `${it.label}   \u2039 ${it.get()} \u203A`;

                ctx.fillText(label, x0, y);

                if (on && !it.disabled) {
                    const w = ctx.measureText(label).width / 2 + 26;

                    drawNeedleMark(ctx, x0 - w, y, 1, this.t);
                    drawNeedleMark(ctx, x0 + w, y, -1, this.t);
                }
            });

            ctx.restore();
        }

        drawPause(ctx) {
            const g = this.game,
                st = g.state;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `600 44px ${BW.FONT_T}`;
            ctx.fillStyle = '#f2e6cc';
            ctx.fillText('PAUSED', BW.VW * 0.3, 150);
            ornament(ctx, BW.VW * 0.3, 186, 150);
            ctx.restore();
            this.drawList(ctx, '', 225, BW.VW * 0.3, 44);

            // journal panel
            const x = BW.VW * 0.56,
                y = 120,
                w = BW.VW * 0.38;

            ctx.save();
            ctx.fillStyle = 'rgba(14,16,22,0.7)';
            BW.roundRect(ctx, x, y, w, 545, 12);
            ctx.fill();
            ctx.strokeStyle = 'rgba(236,222,190,0.25)';
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `600 22px ${BW.FONT_T}`;
            ctx.fillStyle = '#e8c98a';
            ctx.fillText('JOURNAL', x + 26, y + 22);
            ctx.font = `500 24px ${BW.FONT_B}`;
            ctx.fillStyle = '#efe6d2';

            const room = g.room ? g.room.def : null;
            let yy = y + 64;

            ctx.fillStyle = '#cbbd9f';
            ctx.font = `italic 500 21px ${BW.FONT_B}`;
            ctx.fillText(room ? `${room.name} — ${BW.AREAS[room.area].name}` : '', x + 26, yy);
            yy += 40;
            ctx.font = `500 23px ${BW.FONT_B}`;
            ctx.fillStyle = '#efe6d2';
            BW.wrapText(ctx, g.objectiveText(), x + 26, yy, w - 52, 29);
            yy += 120;

            const bells = (st.flags.bell1 ? 1 : 0) + (st.flags.bell2 ? 1 : 0);

            const rows = [
                ['Difficulty', BW.Difficulty.get(st).name],
                ['Toll-looms rethreaded', `${bells} / 2`],
                ['Abilities learned', `${['dash', 'parry', 'dodge'].filter((a) => st.abilities[a]).length} / 3`],
                ['Health bells', `${st.maxHp}`],
                ['Silk capacity', `${st.silkMax}`],
                [
                    'Level',
                    (() => {
                        const x = BW.XP.progress(st.xp | 0);

                        return x.max ? `${x.level} (max)` : `${x.level}  \u00b7  ${x.into} / ${x.span} XP`;
                    })(),
                ],
                ['Glints', `${st.glints}`],
                ['Rooms discovered', `${BW.ROOM_LIST.filter((r) => st.visited[r.id]).length} / ${BW.ROOM_LIST.length}`],
                ['Lore notes', `${BW.Lore.count(st)} / ${BW.Lore.NOTES.length}`],
                ['Time', fmtTime(st.stats.playTime)],
            ];

            for (const [k, v] of rows) {
                ctx.fillStyle = 'rgba(225,214,192,0.75)';
                ctx.fillText(k, x + 26, yy);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#fff1d0';
                ctx.fillText(v, x + w - 26, yy);
                ctx.textAlign = 'left';
                yy += 31;
            }

            ctx.restore();
        }

        drawControls(ctx) {
            const G = BW.Glyphs,
                H = 22;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `600 38px ${BW.FONT_T}`;
            ctx.fillStyle = '#f2e6cc';
            ctx.fillText('CONTROLS', BW.VW / 2, 56);
            ornament(ctx, BW.VW / 2, 88, 150);

            // [action, keyboard keys ('~' marks plain text), gamepad buttons (canonical tokens or plain text)]
            const rows = [
                ['Move', ['A', 'D', '~or', '\u2190', '\u2192'], ['LS', '/', 'DL', 'DR']],
                ['Aim attack up / down', ['W', 'S', '~or', '\u2191', '\u2193'], ['LS', '/', 'DU', 'DD']],
                ['Jump (hold for height)', ['Space'], ['S']],
                ['Needle strike', ['J'], ['W']],
                ['Down strike (in air), bounces', ['S', '~+', 'J'], ['DD', '+', 'W']],
                ['Silk Dash (once learned)', ['K', '~or', 'Shift'], ['E', '/', 'RT']],
                ['Shadow Step (once learned)', ['K', '~or', 'Shift'], ['E', '/', 'RT']],
                ['Parry (once learned)', ['I'], ['LB']],
                ['Silk Lance (3 silk)', ['L'], ['N']],
                ['Mend: hold to heal 1 (3 silk)', ['~Hold', 'Q'], ['Hold', 'LT']],
                ['Interact / talk / rest / travel', ['E', '~or', '\u2191'], ['DU']],
                ['Drop through ledge', ['S', '~+', 'Space'], ['DD', '+', 'S']],
                ['Map', ['M', '~or', 'Tab'], ['SELECT']],
                ['Pause', ['Esc'], ['START']],
            ];

            const x0 = 120,
                xk = 520,
                xp = 830,
                y0 = 122;

            ctx.font = `600 20px ${BW.FONT_T}`;
            ctx.fillStyle = '#e8c98a';
            ctx.textAlign = 'left';
            ctx.fillText('ACTION', x0, y0);
            ctx.fillText('KEYBOARD', xk, y0);
            ctx.fillText(`GAMEPAD \u00B7 ${G.styleName().toUpperCase()}`, xp, y0);
            ctx.strokeStyle = 'rgba(232,201,138,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0, y0 + 16);
            ctx.lineTo(BW.VW - x0, y0 + 16);
            ctx.stroke();

            rows.forEach((r, i) => {
                const y = y0 + 42 + i * 32;

                if (i % 2 === 0) {
                    ctx.fillStyle = 'rgba(232,201,138,0.05)';
                    ctx.fillRect(x0 - 12, y - 16, BW.VW - 2 * x0 + 24, 32);
                }

                ctx.font = `500 22px ${BW.FONT_B}`;
                ctx.fillStyle = 'rgba(232,225,205,0.9)';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(r[0], x0, y);

                let kx = xk;

                for (const k of r[1]) {
                    if (k[0] === '~') {
                        ctx.font = `600 19px ${BW.FONT_B}`;
                        ctx.fillStyle = 'rgba(240,230,210,0.75)';
                        ctx.textAlign = 'left';
                        ctx.fillText(k.slice(1), kx, y + 1);
                        kx += ctx.measureText(k.slice(1)).width + 8;
                    } else kx += G.drawKeycap(ctx, k, kx, y, H) + 6;
                }

                G.drawSeq(ctx, r[2], xp, y, H);
            });

            ctx.font = `italic 500 19px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.6)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillText(
                (BW.Input.padConnected ? 'Gamepad connected. ' : 'Connect a gamepad at any time. ') +
                    'Pick Xbox, PlayStation, Switch or Generic icons below, or leave it on Auto.',
                BW.VW / 2,
                BW.VH - 112,
            );

            ctx.restore();
            this.drawList(ctx, '', BW.VH - 80);
        }

        drawConfirm(ctx) {
            const s = this.screen,
                cx = BW.VW / 2,
                w = 760,
                h = 340,
                x = cx - w / 2,
                y = BW.VH * 0.5 - h / 2 - 10;

            ctx.save();
            ctx.fillStyle = 'rgba(14,16,22,0.82)';
            BW.roundRect(ctx, x, y, w, h, 14);
            ctx.fill();
            ctx.strokeStyle = 'rgba(236,222,190,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(236,222,190,0.12)';
            BW.roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 10);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `600 30px ${BW.FONT_T}`;
            ctx.fillStyle = '#e8c98a';
            ctx.fillText(s.data.title || 'ARE YOU SURE?', cx, y + 52);
            ornament(ctx, cx, y + 86, 140);
            ctx.font = `500 28px ${BW.FONT_B}`;
            ctx.fillStyle = '#f2e6cc';
            BW.wrapText(ctx, s.data.q, cx, y + 138, w - 150, 36);
            ctx.restore();
            this.drawList(ctx, '', y + h - 112);
        }

        // completion mark for the title screen (save read at most once a second)
        titleCleared() {
            const now = this.game.titleT;

            if (this.clrAt == null || Math.abs(now - this.clrAt) > 1) {
                const d = BW.Save.readRaw();

                this.clr = !!(d && d.flags && d.flags.ending_seen);
                this.clrAt = now;
            }

            return this.clr;
        }

        drawTitleMenu(ctx) {
            const g = this.game;
            const tt = g.titleT;

            g.drawTitleBackdrop(ctx, tt);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const a = Math.min(1, Math.max(0, tt - 0.6) / 1.4);

            ctx.globalAlpha = a;
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 24;
            ctx.font = `600 104px ${BW.FONT_T}`;
            ctx.fillStyle = '#f7ecd6';
            spaced(ctx, 'BELLWEAVER', BW.VW / 2, 190, 10);
            ctx.shadowBlur = 0;
            ctx.font = `italic 500 30px ${BW.FONT_B}`;
            ctx.fillStyle = '#e1d2b2';
            ctx.fillText('a thread through the silent bells', BW.VW / 2, 262);
            ornament(ctx, BW.VW / 2, 300, 210);

            if (this.titleCleared()) {
                ctx.font = `italic 500 22px ${BW.FONT_B}`;
                ctx.fillStyle = '#e8c98a';
                ctx.fillText('✦  The Great Bell rings again  ✦', BW.VW / 2, 338);
            }

            ctx.restore();

            if (!g.started) {
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = `500 28px ${BW.FONT_B}`;
                ctx.fillStyle = `rgba(240,230,210,${Math.min(1, Math.max(0, tt - 1.8)) * (0.5 + Math.sin(tt * 2.5) * 0.35)})`;
                ctx.fillText('Press any key or button', BW.VW / 2, BW.VH * 0.66);
                ctx.restore();
            } else {
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.fillRect(BW.VW / 2 - 220, 345, 440, this.titleCleared() ? 362 : 345);
                ctx.restore();
                this.drawList(ctx, '', 372);
            }

            ctx.save();
            ctx.font = `500 17px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(230,220,200,0.5)';
            ctx.textAlign = 'right';
            ctx.fillText(`v${BW.VERSION} Alpha`, BW.VW - 24, BW.VH - 22);
            ctx.restore();
            this.drawMsg(ctx);
        }

        // The world map lives in map.js
    }

    function bar(v) {
        const n = Math.round(v * 10);

        return '■'.repeat(n) + '□'.repeat(10 - n);
    }

    function fmtTime(s) {
        s = Math.floor(s || 0);

        const h = Math.floor(s / 3600),
            m = Math.floor((s % 3600) / 60),
            ss = s % 60;

        return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0');
    }

    function ornament(ctx, x, y, w) {
        ctx.save();
        ctx.strokeStyle = 'rgba(240,226,196,0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.lineTo(x - 12, y);
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();
        ctx.fillStyle = '#efe0c0';
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
    }

    function drawNeedleMark(ctx, x, y, dir, t) {
        ctx.save();
        ctx.translate(x + Math.sin(t * 5) * 3 * dir, y);
        ctx.strokeStyle = '#efe2c6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-dir * 18, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-dir * 22, 0, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function spaced(ctx, text, x, y, sp) {
        const w = ctx.measureText(text).width + sp * (text.length - 1);
        let cx = x - w / 2;

        ctx.textAlign = 'left';

        for (const ch of text) {
            ctx.fillText(ch, cx, y);
            cx += ctx.measureText(ch).width + sp;
        }

        ctx.textAlign = 'center';
    }

    // Nightmare emblem: a cracked, hollow-eyed bell inside a ring of thorns
    function drawNightmareIcon(ctx, x, y, r, t, a = 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha *= a;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const gl = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);

        gl.addColorStop(0, `rgba(210,24,44,${0.5 + 0.12 * Math.sin(t * 3)})`);
        gl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
        ctx.restore();
        ctx.save();
        ctx.rotate(t * 0.15);
        ctx.fillStyle = '#9a1628';

        for (let i = 0; i < 14; i++) {
            ctx.rotate((Math.PI * 2) / 14);
            ctx.beginPath();
            ctx.moveTo(-r * 0.09, -r * 1.05);
            ctx.lineTo(0, -r * 1.4);
            ctx.lineTo(r * 0.09, -r * 1.05);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
        ctx.strokeStyle = '#c21d34';
        ctx.lineWidth = r * 0.06;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.78);
        ctx.bezierCurveTo(r * 0.5, -r * 0.78, r * 0.5, -r * 0.25, r * 0.62, r * 0.3);
        ctx.lineTo(r * 0.8, r * 0.52);
        ctx.quadraticCurveTo(0, r * 0.68, -r * 0.8, r * 0.52);
        ctx.lineTo(-r * 0.62, r * 0.3);
        ctx.bezierCurveTo(-r * 0.5, -r * 0.25, -r * 0.5, -r * 0.78, 0, -r * 0.78);
        ctx.closePath();

        const bg = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.6);

        bg.addColorStop(0, '#4a0d18');
        bg.addColorStop(1, '#10030a');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = '#e0364b';
        ctx.lineWidth = r * 0.05;
        ctx.stroke();
        ctx.strokeStyle = '#ff5566';
        ctx.lineWidth = r * 0.035;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.05, -r * 0.78);
        ctx.lineTo(-r * 0.08, -r * 0.5);
        ctx.lineTo(r * 0.1, -r * 0.3);
        ctx.lineTo(-r * 0.04, -r * 0.1);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,60,80,${0.8 + 0.2 * Math.sin(t * 5)})`;

        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(s * r * 0.1, r * 0.08);
            ctx.lineTo(s * r * 0.34, r * 0.02);
            ctx.lineTo(s * r * 0.26, r * 0.2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.fillStyle = '#d4283a';
        ctx.beginPath();
        ctx.arc(0, r * 0.74, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c21d34';
        ctx.lineWidth = r * 0.05;
        ctx.beginPath();
        ctx.arc(0, -r * 0.86, r * 0.09, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    BW.Menu = Menu;
    BW.fmtTime = fmtTime;
    BW.menuOrnament = ornament;
    BW.menuNeedle = drawNeedleMark;
    BW.drawNightmareIcon = drawNightmareIcon;
})(window.BW);

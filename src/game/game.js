'use strict';

// Game: modes, the fixed-step loop, rooms and transitions, camera, combat resolution, checkpoints,
// scripted sequences, saving and a small test API used by the automated play-tests.
(function (BW) {
    const T = BW.T,
        P = BW.PHYS;

    class Game {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.mode = 'boot';
            this.started = false;
            this.state = null;
            this.room = null;
            this.terrain = null;
            this.player = new BW.Player(this);
            this.enemies = [];
            this.objects = [];
            this.coins = [];
            this.shots = [];
            this.lances = [];
            this.fx = new BW.FX();
            this.bg = new BW.Background(this);
            this.hud = new BW.Hud(this);
            this.dialog = new BW.Dialog(this);
            this.menu = new BW.Menu(this);
            this.cam = { x: 0, y: 0, px: 0, py: 0 };
            this.look = 0;
            this.lookT = 0;
            this.lookV = 0;
            this.time = 0;
            this.freezeT = 0;
            this.slowT = 0;
            this.transition = null;
            this.seq = null;
            this.exitCooldown = 0;
            this.lights = [];
            this.lightN = 0;
            this.plight = { x: 0, y: 0, r: 230, color: '#ffe7c4', a: 0.75 };
            this.stats = {};
            this.hudAlpha = 1;
            this.letterbox = 0;
            this.pixelScale = 1;
            this.godMode = false;
            this.lastArea = null;
            this.fade = 0; // global black fade 0..1
            this.titleT = 0;
            // Stage 2: boss hazards, boss bar / title card, ending
            this.hazards = [];
            this.boss = null;
            this.bossBar = null;
            this.bossTitle = null;
            this.arenaCam = false;
            this.pealHint = 0;
            this.whiteFade = 0;
            this.ending = null;
            this.dawn = 0;
        }

        // ================================================================ boot / modes
        async boot(test) {
            BW.settings = BW.Save.loadSettings();
            BW.Input.init();
            this.applySettings();
            this.resize();
            window.addEventListener('resize', () => this.resize());

            const loadEl = document.getElementById('loading-bar');

            const fontP = document.fonts
                ? Promise.all([
                      document.fonts.load(`600 40px ${BW.FONT_T}`),
                      document.fonts.load(`500 20px ${BW.FONT_B}`),
                      document.fonts.load(`italic 500 20px ${BW.FONT_B}`),
                  ]).catch(() => {})
                : Promise.resolve();

            await Promise.all([
                BW.Assets.loadAll((p) => {
                    if (loadEl) loadEl.style.width = (p * 100).toFixed(0) + '%';
                }),
                fontP,
            ]);

            for (const k in window.BW_MUSIC || {}) {
                const m = window.BW_MUSIC[k];

                BW.Audio.registerTrack(k, m.src, m.gain || 1, m.xfade || 2.5);
            }

            const ld = document.getElementById('loading');

            if (ld) ld.style.display = 'none';

            this.mode = 'title';
            this.menu.push('title');

            const unlock = () => {
                BW.Audio.init();

                if (!this.started && this.mode === 'title') {
                    this.started = true;
                    this.titleArm = true;
                    BW.Audio.playMusic('mus_title', 3);
                }
            };

            this.wakeTitle = unlock;
            window.addEventListener('pointerdown', unlock);
            BW.Input.onAnyKey(unlock);
            this.canvas.addEventListener('pointerdown', () => this.canvas.focus());

            if (test) {
                this.testMode = true;

                return;
            }

            let last = performance.now(),
                acc = 0,
                lastDraw = 0;

            const frame = (now) => {
                // optional frame-rate limit; slots keep the average on target even when the display runs faster
                const cap = BW.gfx.fpsCap,
                    interval = cap ? 1000 / cap : 0;

                if (interval && now - lastDraw < interval - 1.5) {
                    requestAnimationFrame(frame);

                    return;
                }

                if (interval) lastDraw = now - lastDraw > interval * 2 ? now : lastDraw + interval;

                const raw = now - last;

                last = now;

                let dt = raw / 1000;

                if (dt > 0.1) dt = 0.1;

                acc += dt;

                let steps = 0;

                while (acc >= BW.DT && steps < 12) {
                    this.tick(BW.DT);
                    acc -= BW.DT;
                    steps++;
                }

                if (steps >= 12) acc = 0;

                this.watchPerformance(dt);
                this.trackFps(raw);
                // when the world did not advance (dialog, menu, hit-stop) draw its final state, not an in-between one
                this.render(this.simAdvanced ? acc / BW.DT : 1);

                if (BW.settings.fpsCounter !== 'off') {
                    this.ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
                    this.drawFps(this.ctx);
                }

                requestAnimationFrame(frame);
            };

            document.addEventListener('visibilitychange', () => {
                last = performance.now();
                this.syncFocus();
            });

            window.addEventListener('blur', () => this.syncFocus());
            window.addEventListener('focus', () => this.syncFocus());
            requestAnimationFrame(frame);
        }

        // Frame statistics for the FPS counter: updated twice a second.
        trackFps(ms) {
            const f = this.fpsStat || (this.fpsStat = { fps: 0, ms: 0, worst: 0, n: 0, sum: 0, max: 0 });

            f.n++;
            f.sum += ms;

            if (ms > f.max) f.max = ms;

            if (f.sum >= 500) {
                f.fps = Math.round((f.n * 1000) / f.sum);
                f.ms = f.sum / f.n;
                f.worst = f.max;
                f.n = 0;
                f.sum = 0;
                f.max = 0;
            }
        }
        syncFocus() {
            BW.Audio.setMuted(BW.settings.muteBlur !== false && (document.hidden || !document.hasFocus()));
        }

        resize() {
            const ww = window.innerWidth,
                wh = window.innerHeight;

            let w = ww,
                h = (ww * 9) / 16;

            if (h > wh) {
                h = wh;
                w = (wh * 16) / 9;
            }

            this.canvas.style.width = Math.floor(w) + 'px';
            this.canvas.style.height = Math.floor(h) + 'px';

            const dpr = window.devicePixelRatio || 1;
            let bw = Math.round(w * dpr);

            bw = Math.min(bw, this.resCap());

            const bh = Math.round((bw * 9) / 16);

            this.canvas.width = bw;
            this.canvas.height = bh;
            this.pixelScale = bw / BW.VW;
            this.applySmoothing();
        }

        // Backing-store width cap: the Resolution option, or automatic (steps down if frames run long).
        resCap() {
            const r = BW.settings && BW.settings.res;

            if (r === '1080') return 1920;
            if (r === '900') return 1600;
            if (r === '720') return 1280;

            return this.autoCap || 1920;
        }
        watchPerformance(dt) {
            if (
                !BW.settings ||
                BW.gfx.fpsCap ||
                (BW.settings.res && BW.settings.res !== 'auto') ||
                this.mode !== 'play' ||
                document.hidden ||
                this.transition ||
                this.menu.open
            ) {
                this.perfN = 0;

                return;
            }

            const d = this.perfBuf || (this.perfBuf = new Float32Array(240));

            if (this.slowWindows == null) this.slowWindows = 0;

            d[this.perfN || 0] = dt;
            this.perfN = (this.perfN || 0) + 1;

            if (this.perfN < 240) return;

            this.perfN = 0;

            const med = d.slice().sort()[120];
            const cap = this.autoCap || 1920;

            // Two slow windows in a row, so a one-off hitch (room load, tab switch) doesn't permanently cost resolution.
            if (med > 1 / 57 && cap > 1280) {
                if (++this.slowWindows < 2) return;

                this.slowWindows = 0;
                this.autoCap = cap > 1600 ? 1600 : 1280;
                this.resize();
                BW.note('auto resolution -> ' + this.autoCap);
            } else this.slowWindows = 0;
        }

        applySettings() {
            const s = BW.settings;

            BW.Audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience, ui: s.ui });
            s.quality = BW.Gfx.detect(s);
            BW.Gfx.apply(s);

            if (this.ctx) {
                this.applySmoothing();

                if (this.appliedRes !== s.res) {
                    this.appliedRes = s.res;
                    this.resize();
                }
            }

            if (BW.Audio.muted && s.muteBlur === false) BW.Audio.setMuted(false);
            if (this.bg) this.bg.gfxChanged();
            if (this.fx) this.fx.trim();

            BW.Save.saveSettings(s);
        }

        applySmoothing() {
            this.ctx.imageSmoothingEnabled = true;

            if (this.ctx.imageSmoothingQuality) this.ctx.imageSmoothingQuality = BW.gfx.smooth;
        }

        toggleFullscreen() {
            try {
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen();
            } catch (e) {
                /* not allowed */
            }
        }

        // ================================================================ game start / save
        newGame(difficulty) {
            BW.Save.erase();

            const d = BW.Save.defaults();

            d.difficulty = BW.Difficulty.valid(difficulty) ? difficulty : BW.Difficulty.DEFAULT;
            this.state = Object.assign(d, { hp: d.maxHp, silk: 0 });
            this.stats = {};
            BW.Save.write(this.persist());
            this.mode = 'play';
            this.menu.closeAll();

            const sp = BW.ROOMS.M1.ents.find((e) => e.type === 'spawn');

            this.loadRoom('M1', { x: (sp.x + 0.5) * T - P.w / 2, y: (sp.y + 1) * T - P.h });
            this.player.vy = 200;
            this.player.state = 'cutscene';
            this.startSequence(introSequence(this));
        }

        continueGame() {
            const d = BW.Save.load();

            if (!d) {
                this.menu.flash('No save found.');

                return;
            }

            this.clearOverlays();
            this.state = Object.assign(d, { hp: d.maxHp, silk: 0 });
            this.stats = {};
            this.mode = 'play';
            this.menu.closeAll();
            this.respawnAtLantern(true);
            BW.Audio.playMusic(this.room.area.music, 2.5);
        }

        // everything that belongs to a running session and must not leak into a loaded or restarted one
        clearOverlays() {
            this.endRematch();
            this.seq = null;
            this.seqCard = null;
            this.chapterCard = null;
            this.deathCard = null;
            this.loreSlide = null;
            this.seqText = null;
            this.rematchCard = null;
            this.transition = null;
            this.dialog.active = false;
            this.hud.announce = null;
            this.ending = null;
            this.whiteFade = 0;
            this.bossBar = null;
            this.bossTitle = null;
            this.boss = null;
            this.hazards = [];
            this.arenaCam = false;
            this.camFocus = null;
            this.letterboxTarget = 0;
            this.lastArea = null;
        }

        // ---- manual save slots
        saveToSlot(i) {
            if (!this.state) return false;

            const ok = BW.Save.writeSlot(i, this.persist());

            if (ok) {
                this.hud.savedBlip();
                BW.Audio.play('save', { vol: 0.8 });
            }

            return ok;
        }
        loadSlot(i) {
            const d = BW.Save.readSlot(i);

            if (!d) {
                this.menu.flash('That slot is empty.');

                return;
            }

            BW.Save.adopt(d);
            this.continueGame();
        }

        // ---- lantern menu (travel, save, boss rematch)
        openLanternMenu() {
            BW.Audio.play('ui_ok');
            this.menu.push('lantern');
        }
        // the Warden can be fought again once beaten; nothing is earned and the story save is left alone
        canRematch() {
            return !!(this.state && this.state.flags.warden_defeated && !this.rematch);
        }
        endRematch() {
            const st = this.state;

            if (st && st.flagsReal) {
                st.flags = st.flagsReal;
                delete st.flagsReal;
            }

            this.rematch = false;
            this.fortressTest = false;
        }

        onSaveImported() {
            /* title menu shows Continue again */
        }

        persist() {
            const s = this.state;

            return {
                game: 'bellweaver',
                version: BW.Save.SAVE_VERSION,
                createdAt: s.createdAt,
                lantern: s.lantern,
                lanternRoom: s.lanternRoom,
                maxHp: s.maxHp,
                difficulty: s.difficulty,
                silkMax: s.silkMax,
                glints: s.glints,
                xp: s.xp | 0,
                abilities: s.abilities,
                flags: s.flagsReal || s.flags,
                visited: s.visited,
                lanternsLit: s.lanternsLit,
                cleared: s.cleared,
                stats: s.stats,
                codex: s.codex,
                lastRoom: this.room ? this.room.id : s.lastRoom,
            };
        }
        saveGame() {
            if (this.state) {
                BW.Save.write(this.persist());
            }
        }

        // ---- field guide discoveries and one-time lessons
        codexSee(kind) {
            if (!this.state || !BW.Codex.see(this.state, kind)) return;

            this.hud.toast('Archive updated', BW.ENEMY_NAMES[kind] + ' discovered', 3.2);
            BW.Audio.play('glint', { vol: 0.5, minGap: 0 });
        }
        codexKill(kind) {
            if (!this.state) return;

            const first = !(this.state.codex && this.state.codex.kills[kind]);

            BW.Codex.kill(this.state, kind);

            if (first) this.hud.toast('Archive updated', "Hunter's notes on " + BW.ENEMY_NAMES[kind], 3.2);
        }
        codexMove(boss, move) {
            // recorded silently: a boss's moves are never named on screen mid-fight
            if (this.state) BW.Codex.move(this.state, boss, move);
        }
        teach(id) {
            const L = BW.Codex.LESSONS[id],
                c = this.state && BW.Codex.data(this.state);

            if (!L || !c || c.tips[id] || BW.settings.hints === false) return;

            c.tips[id] = true;
            this.hud.toast(L.title, L.sub(), 3.4);
        }

        toTitle() {
            this.mode = 'title';
            this.room = null;
            this.clearOverlays();
            this.menu.closeAll();
            this.menu.push('title');
            BW.Audio.playMusic('mus_title', 2);
            BW.Audio.playAmbience(null, 1);
        }

        objectiveText() {
            const f = this.state.flags;
            const bells = (f.bell1 ? 1 : 0) + (f.bell2 ? 1 : 0);

            // chapter II: after the Great Bell, the Hushed Gallery east of the Ashen Ramparts
            if (f.ending_seen) {
                const v = this.state.visited;

                if (f.chapter2_clear)
                    return 'The Hushed Gallery is quiet and its Last Door stands open. Beyond it, something is still unspun.';

                if (f.lastdoor_open) return 'The Last Door stands open at the end of the Hushed Gallery. Step into the light.';

                if (f.silent_key) return 'You hold the Silent Key. Carry it to the Last Door at the far end of the Last Door Hall.';

                if (f.mourner_defeated)
                    return 'The Long Mourner is still. Take the Silent Key from the altar in the hall east of the arena.';

                if (f.mourner_met)
                    return 'The Long Mourner waits in the Hush Arena. Rest at the lantern outside it, then face it again.';

                if (v.H1)
                    return 'Strike the silent bells to part the veils and push east through the Hushed Gallery. Whatever keeps it silent waits at the far end.';

                return 'The Great Bell rings again, and its toll has parted the black veils at the end of the Ashen Ramparts, east of the Cord Lift. Something keeps the Hushed Gallery silent.';
            }

            if (f.warden_defeated) return 'The Warden has fallen. Rethread the Great Bell beneath the cathedral vault.';

            if (f.warden_met)
                return 'The Bellbound Warden guards the Great Bell. Rest at the antechamber lantern, then face it again.';

            if (f.reached_cathedral && !f.cathedral_open && !this.state.abilities.dodge)
                return 'The great doors will not answer yet. Touch the shrine in this antechamber to learn the last of the weavers\u2019 lessons.';

            if (f.cathedral_open) return 'The great doors stand open. Enter the Cathedral of the Last Toll.';
            if (f.reached_cathedral) return 'You reached the Cathedral of the Last Toll. Open its great doors.';

            if (bells === 2)
                return 'Both toll-looms sing. The Belfry Seal above the Gatehouse is open — climb into the Silent Belfry.';

            if (bells === 1)
                return `One toll-loom rethreaded (1/2). Find the other loom to break the Belfry Seal.${this.state.abilities.dash ? '' : ' A wide gap may need a swifter stitch.'}`;

            return 'Rethread the two toll-looms that bind the Belfry Seal (0/2).';
        }

        // ================================================================ rooms
        loadRoom(id, place, opts = {}) {
            const def = BW.ROOMS[id];
            const flags = this.state.flags;
            const room = new BW.Room(def, flags);

            // gates that opened while we were elsewhere animate open the first time we see them
            for (const g of room.gates) {
                if (g.fixed) continue; // e.g. the arena portcullis: open by default, worked by the fight

                if (g.open && !flags['seen_' + g.flag + '_' + def.id]) {
                    g.open = false;
                    g.anim = 0;
                    room.fillTiles(g, 'G');
                    g.pendingOpen = 0.9;
                }
            }

            this.room = room;
            BW.Terrain.release(this.terrain);
            this.terrain = BW.Terrain.build(room);

            const ter = this.terrain;

            // swap the canvases for GPU-friendly bitmaps once ready, freeing the canvas; drop the result if the room was left meanwhile
            const adopt = (src, set) =>
                BW.toBitmap(src, (bm) => {
                    if (ter.released) {
                        if (bm.close) bm.close();

                        return;
                    }

                    set(bm);
                    src.width = 0;
                    src.height = 0;
                });

            adopt(ter.canvas, (bm) => {
                ter.canvas = bm;
            });

            for (const s of ter.secrets)
                adopt(s.canvas, (bm) => {
                    s.canvas = bm;
                });

            this.objects = [];
            this.enemies = [];
            this.coins = [];
            this.shots = [];
            this.lances = [];
            this.hazards = [];
            this.boss = null;
            this.bossBar = null;
            this.bossTitle = null;
            this.arenaCam = false;
            this.pealHint = 0;
            this.camFocus = null;
            this.fx.reset();

            for (const e of def.ents) {
                if ((e.when && !flags[e.when]) || (e.unless && flags[e.unless])) continue;

                if (BW.ENEMY_TYPES[e.type]) {
                    const key = BW.enemyPersistKey(id, e);

                    if (key && this.state.cleared && this.state.cleared[key]) continue;

                    this.enemies.push(new BW.ENEMY_TYPES[e.type](this, e));
                } else if (BW.OBJ[e.type]) {
                    const o = new BW.OBJ[e.type](this, e);

                    if (!o.dead) this.objects.push(o);
                }
            }

            for (const n of BW.Lore.NOTES) {
                if (n.room !== id || (n.when && !flags[n.when])) continue;

                this.objects.push(new BW.OBJ.note(this, { type: 'note', id: n.id, x: n.x, y: n.y }));
            }

            for (const e of BW.Difficulty.extras(room, flags, this.state)) {
                const key = BW.enemyPersistKey(id, e);

                if (key && this.state.cleared && this.state.cleared[key]) continue;

                this.enemies.push(new BW.ENEMY_TYPES[e.type](this, e));
            }

            for (const s of this.terrain.secrets) if (flags['sec_' + s.id]) s.a = 0;

            this.bg.setRoom(room);

            const p = this.player;

            p.x = place.x;
            p.y = place.y;
            p.px = p.x;
            p.py = p.y;
            p.platform = null;

            // a gate we are entering through opens instantly instead of animating shut in our face
            for (const g of room.gates) {
                if (g.pendingOpen == null) continue;

                const gx = ((g.x0 + g.x1 + 1) / 2) * T,
                    gy = ((g.y0 + g.y1 + 1) / 2) * T;

                if (Math.abs(p.cx - gx) < 4 * T && Math.abs(p.cy - gy) < 5 * T) {
                    g.pendingOpen = null;
                    g.open = true;
                    g.anim = 1;
                    room.fillTiles(g, '.');
                    flags['seen_' + g.flag + '_' + def.id] = true;
                }
            }

            this.state.visited[id] = true;
            this.state.lastRoom = id;
            this.exitCooldown = 0.2;
            this.firedTriggers = {};
            this.hazardBusy = false;

            // area change: music + title card
            const area = room.area;

            if (this.lastArea !== area.id) {
                BW.Audio.playMusic(area.music, 2.5);
                BW.Audio.playAmbience(area.amb, 2.5);

                if (this.lastArea && !opts.silent) {
                    this.hud.areaTitle(area.name, '');
                    BW.Lore.interlude(this, area.id);
                }

                this.lastArea = area.id;
            }

            this.onEnterRoom(room);
            this.updateCamera(0, true);
            BW.note('room ' + id);
        }

        respawnAtLantern(sit) {
            this.endRematch();

            const st = this.state;

            st.cleared = {};

            let roomId = st.lanternRoom,
                lid = st.lantern;

            if (!roomId || !BW.ROOMS[roomId]) {
                roomId = 'M1';
                lid = 'lan_m1';
            }

            const def = BW.ROOMS[roomId];

            const le =
                def.ents.find((e) => e.type === 'lantern' && e.id === lid) ||
                def.ents.find((e) => e.type === 'lantern');

            const p = this.player;

            p.reset(0, 0);
            this.lastArea = null;
            this.loadRoom(roomId, { x: (le.x + 0.5) * T - P.w / 2 - 34, y: (le.y + 1) * T - P.h }, { silent: true });
            p.facing = 1;
            p.onGround = true;

            if (sit) p.state = 'rest';

            p.safeX = p.x;
            p.safeY = p.y;
            p.safeRoom = roomId;
        }

        returnToLantern() {
            this.startTransition(() => {
                this.state.hp = this.state.maxHp;
                this.respawnAtLantern(true);
                this.saveGame();
            });
        }

        startTransition(mid, outT = 0.35, inT = 0.4) {
            this.transition = { t: 0, outT, inT, mid, phase: 'out' };
        }

        checkExits() {
            if (this.exitCooldown > 0 || this.transition) return;

            const p = this.player,
                r = this.room,
                d = r.def;

            if (p.state === 'dead') return;

            let dir = null;

            if (p.cx < 0) dir = 'W';
            else if (p.cx > r.pw) dir = 'E';
            else if (p.cy > r.ph && p.vy >= 0) dir = 'S';
            else if (p.y < 0 && p.vy < 0) dir = 'N';

            if (!dir) return;

            const wx = d.x + p.cx / T,
                wy = d.y + p.cy / T;

            let qx = wx,
                qy = wy;

            if (dir === 'W') qx = d.x - 0.5;
            if (dir === 'E') qx = d.x + d.w + 0.5;
            if (dir === 'N') qy = d.y - 0.5;
            if (dir === 'S') qy = d.y + d.h + 0.5;

            const next = BW.roomAtWorld(qx, qy, d.id);

            if (!next) {
                // no room there: keep the player inside
                if (dir === 'W') p.x = 2;
                else if (dir === 'E') p.x = r.pw - p.w - 2;
                else if (dir === 'N') {
                    p.y = 0;
                    p.vy = 0;
                } else {
                    p.y = r.ph - p.h;
                    p.vy = 0;
                }

                return;
            }

            const worldPx = { x: d.x * T + p.x, y: d.y * T + p.y };

            const vx = p.vx,
                vy = p.vy;

            this.saveGame();

            this.transition = {
                t: 0,
                outT: 0.16,
                inT: 0.22,
                phase: 'out',
                dir,
                mid: () => {
                    let nx = worldPx.x - next.x * T,
                        ny = worldPx.y - next.y * T;

                    if (dir === 'W') nx = next.w * T - P.w / 2 - 14;
                    if (dir === 'E') nx = -P.w / 2 + 14;
                    if (dir === 'N') ny = next.h * T - P.h - 1;
                    if (dir === 'S') ny = -P.h * 0.6;

                    this.loadRoom(next.id, { x: nx, y: ny });
                    p.vx = vx;
                    p.vy = vy;

                    if (dir === 'N') {
                        p.vy = -P.enterUpBoost;
                        p.jumpHeld = false;
                    }

                    if (dir === 'S') p.vy = Math.max(vy, 200);

                    p.onGround = false;
                    this.exitCooldown = 0.3;
                },
            };
        }

        // ================================================================ main tick
        tick(dt) {
            const inp = BW.Input;

            this.simAdvanced = false;
            inp.poll();
            // music fades don't need 120 Hz updates
            this.audioDt = (this.audioDt || 0) + dt;

            if (this.audioDt >= 1 / 30) {
                BW.Audio.update(this.audioDt);
                this.audioDt = 0;
            }

            this.hud.update(dt);

            if (this.mode === 'title') {
                this.titleT += dt;

                // The press that wakes the title screen must not also activate the first menu item
                if (
                    !this.started &&
                    this.wakeTitle &&
                    inp.device === 'pad' &&
                    BW.Input.ACTIONS.some((a) => inp.pressed[a])
                )
                    this.wakeTitle();

                if (this.started) {
                    if (this.titleArm) this.titleArm = false;
                    else this.menu.update(dt, inp);
                }

                return;
            }

            if (this.mode === 'ending') {
                if (this.ending) this.ending.update(dt, inp);

                return;
            }

            if (this.mode === 'replay') {
                this.updateReplay(dt);

                return;
            }

            if (this.mode !== 'play') return;

            this.time += dt;

            if (this.state) this.state.stats.playTime = (this.state.stats.playTime || 0) + dt;

            // menus
            if (this.menu.open) {
                if (this.player.state === 'rest') this.player.restT = 0;

                this.menu.update(dt, inp);

                return;
            }

            if (!this.seq && !this.dialog.active && !this.hud.announce && !this.transition) {
                if (inp.pressed.pause) {
                    this.menu.push('pause');
                    BW.Audio.play('ui_ok');

                    return;
                }

                if (inp.pressed.map) {
                    this.menu.push('map');
                    BW.Audio.play('ui_ok');

                    return;
                }
            }

            // announcement overlay
            if (this.hud.announce) {
                const an = this.hud.announce;

                if (an.closing) {
                    an.closeT += dt;

                    if (an.closeT > 0.4) {
                        this.hud.announce = null;

                        if (an.onClose) an.onClose();
                    }
                } else if (
                    an.t > 1.0 &&
                    (inp.pressed.confirm || inp.pressed.jump || inp.pressed.attack || inp.pressed.interact)
                ) {
                    an.closing = true;
                    an.closeT = 0;
                    inp.consume('jump');
                    inp.consume('attack');
                    BW.Audio.play('ui_ok');
                }

                this.fx.update(dt);

                return;
            }

            if (this.dialog.active) {
                this.dialog.update(dt, inp);
                this.fx.update(dt);
                this.bg.update(dt, this.cam, this.viewW(), this.viewH());

                return;
            }

            // transitions
            if (this.transition) {
                const tr = this.transition;

                tr.t += dt;

                if (tr.phase === 'out') {
                    this.fade = Math.min(1, tr.t / tr.outT);

                    if (tr.t >= tr.outT) {
                        tr.mid();
                        tr.phase = 'in';
                        tr.t = 0;
                    }

                    return;
                }

                this.fade = Math.max(0, 1 - tr.t / tr.inT);

                if (tr.t >= tr.inT) {
                    this.transition = null;
                    this.fade = 0;
                }
            }

            if (this.freezeT > 0) {
                this.freezeT -= dt;

                return;
            }

            let wdt = dt;

            if (this.slowT > 0) {
                this.slowT -= dt;
                wdt = dt * 0.35;
            }

            this.simAdvanced = true;

            if (this.seq) this.updateSequence(wdt, inp);

            this.updateWorld(wdt, inp);
        }

        zoom() {
            return (this.room && this.room.def.zoom) || BW.DEFAULT_ZOOM;
        }
        viewW() {
            return BW.VW / this.zoom();
        }
        viewH() {
            return BW.VH / this.zoom();
        }

        updateWorld(dt, inp) {
            const p = this.player,
                room = this.room;

            this.exitCooldown = Math.max(0, this.exitCooldown - dt);

            for (const o of this.objects) if (o.isPlatform) o.update(dt);

            const pin = this.seq && this.seq.lockInput ? BW.NULL_INPUT : inp;

            p.update(dt, pin);

            for (const e of this.enemies) e.update(dt);

            BW.prune(this.enemies, (e) => !(e.dead && e.dying <= 0));

            for (const o of this.objects) if (!o.isPlatform) o.update(dt);

            BW.prune(this.objects, (o) => !o.dead);

            for (const c of this.coins) c.update(dt);

            BW.prune(this.coins, (c) => !c.dead);

            for (const s of this.shots) s.update(dt);

            BW.prune(this.shots, (s) => !s.dead);

            for (const l of this.lances) l.update(dt);

            BW.prune(this.lances, (l) => !l.dead);

            for (const h of this.hazards) h.update(dt);

            BW.prune(this.hazards, (h) => !h.dead);

            // gates / breakables animation
            for (const g of room.gates) {
                if (g.pendingOpen != null) {
                    g.pendingOpen -= dt;

                    if (g.pendingOpen <= 0) {
                        g.pendingOpen = null;
                        this.openGateAnimated(g);
                    }
                }

                if (g.opening) {
                    g.anim = Math.min(1, g.anim + dt / (g.kind === 'seal' ? 2.2 : 1.1));

                    if (g.anim >= 1) g.opening = false;
                }

                if (g.closing) {
                    g.anim = Math.max(0, g.anim - dt / 0.4);

                    if (g.anim <= 0) g.closing = false;
                }
            }

            for (const b of room.breakables) b.shake = Math.max(0, b.shake - dt);

            // Shadow Step: a dash pressed while a committed strike is within reach slips it, even if the dash carries you out of its path
            if (
                p.dodgeWinT > 0 &&
                p.dodgeT <= 0 &&
                p.invulnT <= 0 &&
                p.guardT <= 0 &&
                p.state !== 'dead' &&
                p.state !== 'cutscene' &&
                !this.godMode
            ) {
                const hb = p.hurtbox(),
                    R = BW.Difficulty.get(this.state).reach;

                const zone = { x: hb.x - R, y: hb.y - R * 0.6, w: hb.w + R * 2, h: hb.h + R * 1.2 };

                for (const e of this.enemies) {
                    if (e.dead || !e.harmful || e.parried > 0 || !e.isStriking()) continue;

                    const boxes = [e.hurtbox()].concat(e.attackBoxes() || []);

                    if (boxes.some((b) => BW.overlap(zone, b))) {
                        p.perfectDodge(e.cx, { src: e, strike: true });
                        break;
                    }
                }
            }

            // contact damage
            if (p.state !== 'dead' && p.invulnT <= 0) {
                const hb = p.hurtbox();

                for (const e of this.enemies) {
                    if (e.dead || !e.harmful || e.parried > 0) continue;

                    const w = BW.Difficulty.weightOf(e),
                        strike = e.isStriking();

                    if (BW.overlap(hb, e.hurtbox())) {
                        p.hurt(w, e.cx, { src: e, strike, cause: BW.enemyName(e) });
                        break;
                    }

                    const ab = e.attackBoxes();

                    if (ab)
                        for (const b of ab)
                            if (BW.overlap(hb, b)) {
                                p.hurt(w, e.cx, { src: e, strike: true, cause: BW.enemyName(e) });
                                break;
                            }
                }
            }

            // boss hazards (shockwaves, the peal, silk spears, debris)
            if (p.state !== 'dead' && p.invulnT <= 0 && this.hazards.length) {
                const hb = p.hurtbox();

                outer: for (const h of this.hazards) {
                    const bs = h.boxes();

                    if (!bs) continue;

                    for (const b of bs)
                        if (BW.overlap(hb, b)) {
                            p.hurt((h.dmg || 1) * BW.Difficulty.get(this.state).bossDmg, h.hitX(p), {
                                noParry: true,
                                cause: h.cause || (this.boss && this.boss.bossName) || BW.ENEMY_NAMES.warden,
                            });

                            break outer;
                        }
                }
            }

            // secrets reveal
            for (const s of this.terrain.secrets) {
                if (s.a > 0 && (BW.overlap(p.hurtbox(), s.rect) || s.revealing)) {
                    if (!s.revealing) {
                        s.revealing = true;
                        this.state.flags['sec_' + s.id] = true;
                        BW.Audio.play('pickup', { rate: 0.6, vol: 0.6 });
                        this.gainXp(BW.XP.REWARD.secret);
                    }

                    s.a = Math.max(0, s.a - dt * 1.5);
                }
            }

            // interactions
            this.interactTarget = null;

            if (!this.seq && p.state === 'normal' && p.attackT <= 0 && p.dashT <= 0) {
                let best = null,
                    bd = 1e9;

                for (const o of this.objects) {
                    if (!o.canInteract || !o.canInteract()) continue;

                    const d = Math.abs(o.x - p.cx);

                    if (d < bd) {
                        bd = d;
                        best = o;
                    }
                }

                this.interactTarget = best;

                if (best && (inp.pressed.interact || (inp.pressed.up && p.onGround && !inp.down.attack))) {
                    inp.consume('up');
                    best.interact();
                }
            }

            // triggers
            for (const tr of room.def.triggers) {
                const r = { x: tr.x0 * T, y: tr.y0 * T, w: (tr.x1 - tr.x0 + 1) * T, h: (tr.y1 - tr.y0 + 1) * T };

                if (!BW.overlap(p.hurtbox(), r)) continue;
                if (tr.once && this.state.flags[tr.once]) continue;
                if (this.firedTriggers[tr.action]) continue;

                this.firedTriggers[tr.action] = true;
                this.fireTrigger(tr);
            }

            this.cathedralTick(dt);
            this.fx.update(dt);
            this.bg.update(dt, this.cam, this.viewW(), this.viewH());
            this.checkExits();
            this.updateCamera(dt, false);

            // look up / down while standing still
            const still = p.onGround && Math.abs(p.vx) < 5 && p.state === 'normal' && !this.seq;

            if (still && (inp.down.up || inp.down.down) && !inp.down.attack) {
                this.lookT += dt;
            } else this.lookT = 0;

            this.lookV = BW.damp(this.lookV, this.lookT > 0.45 ? (inp.down.up ? -1 : 1) : 0, 5, dt);
        }

        updateCamera(dt, snap) {
            const p = this.player,
                r = this.room;

            const vw = this.viewW(),
                vh = this.viewH();

            this.cam.px = this.cam.x;
            this.cam.py = this.cam.y;

            const lookTarget = p.facing * 100 + BW.clamp(p.vx * 0.1, -60, 60);

            this.look = snap ? lookTarget : BW.damp(this.look, lookTarget, 2.5, dt);

            let tx = p.cx + this.look - vw / 2;
            let ty = p.cy - vh * 0.55 + this.lookV * 200;

            if (!p.onGround && p.vy > 450) ty += 150 * BW.clamp((p.vy - 450) / 400, 0, 1);

            if (this.camFocus) {
                tx = this.camFocus.x - vw / 2;
                ty = this.camFocus.y - vh / 2;
            } else if (this.arenaCam && r.def.arena) {
                const a = r.def.arena;

                ty = a.floor * T + 110 - vh;
                tx = BW.clamp(tx, 0, Math.max(0, (a.x1 + 3) * T - vw));
            }

            tx = r.pw <= vw ? (r.pw - vw) / 2 : BW.clamp(tx, 0, r.pw - vw);
            ty = r.ph <= vh ? (r.ph - vh) / 2 : BW.clamp(ty, 0, r.ph - vh);

            if (snap) {
                this.cam.x = tx;
                this.cam.y = ty;
                this.cam.px = tx;
                this.cam.py = ty;
                this.camVy = 0;

                return;
            }

            this.cam.x = BW.damp(this.cam.x, tx, 6.5, dt);

            const fast = (!p.onGround && p.vy > 500) || Math.abs(ty - this.cam.y) > vh * 0.35;

            this.cam.y = BW.damp(this.cam.y, ty, fast ? 9 : 5, dt);
        }

        // ================================================================ combat
        hitstop(t) {
            this.freezeT = Math.max(this.freezeT, t);
        }

        resolvePlayerAttack(box, dir, hits) {
            const res = { hitEnemy: false, blocked: false, hitSolidThing: false };

            const p = this.player,
                st = this.state;

            for (const e of this.enemies) {
                if (e.dead || hits.has(e)) continue;
                if (!BW.overlap(box, e.hurtbox())) continue;

                hits.add(e);

                const r = e.damage(BW.XP.power(st), dir, p);

                if (r === 'blocked') {
                    res.blocked = true;
                    this.hitstop(0.05);
                    continue;
                }

                if (!r) continue;

                res.hitEnemy = true;
                st.silk = Math.min(st.silkMax, st.silk + 1);
                this.hud.pulse('silk');
                this.hitstop(r === 'kill' ? 0.08 : 0.05);
                this.fx.shake(r === 'kill' ? 5 : 3, 0.12);

                const cx = BW.clamp(p.cx + (dir === 'side' ? p.facing * 40 : 0), e.x, e.x + e.w),
                    cy = BW.clamp(dir === 'up' ? p.y - 20 : dir === 'down' ? p.y + p.h + 20 : p.cy, e.y, e.y + e.h);

                this.fx.burst(cx, cy, 10, {
                    color: ['#ffffff', '#fff1c8', '#ffb35a'],
                    kind: 'spark',
                    speed: 420,
                    life: 0.22,
                    size: 3,
                });

                this.fx.burst(cx, cy, 4, {
                    color: ['#ffe9c0'],
                    kind: 'glow',
                    speed: 80,
                    life: 0.25,
                    size: 14,
                    add: true,
                });

                BW.Audio.play('hit', { vary: 0.1 });
            }

            for (const s of this.shots) {
                if (s.dead) continue;

                if (BW.overlap(box, { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 })) {
                    s.pop();
                    res.hitSolidThing = true;
                    this.hitstop(0.03);
                }
            }

            for (const h of this.hazards)
                if (h.cut && h.cut(box)) {
                    res.hitSolidThing = true;
                    this.hitstop(0.03);
                    BW.Audio.play('clink', { vol: 0.5, rate: 1.3 });
                }

            for (const o of this.objects) {
                if (!o.strikable || o.dead || hits.has(o)) continue;

                if (BW.overlap(box, o.hurtbox())) {
                    hits.add(o);
                    o.hit();
                    res.hitSolidThing = true;
                    this.hitstop(0.04);
                }
            }

            for (const b of this.room.breakables) {
                if (b.broken || hits.has(b)) continue;

                const r = { x: b.x0 * T, y: b.y0 * T, w: (b.x1 - b.x0 + 1) * T, h: (b.y1 - b.y0 + 1) * T };

                if (!BW.overlap(box, r)) continue;

                hits.add(b);

                // thick mourning cloth: only the Mourners' Shears will cut it
                if (b.needs && !this.state.flags[b.needs]) {
                    b.shake = 0.2;
                    res.hitSolidThing = true;
                    BW.Audio.play('clink', { vol: 0.5, rate: 0.7 });

                    continue;
                }

                b.hp--;
                b.shake = 0.25;
                res.hitSolidThing = true;
                this.hitstop(0.04);
                this.fx.shake(3, 0.1);
                BW.Audio.play('hit', { rate: 0.6, vol: 0.8 });

                this.fx.burst(BW.clamp(p.cx + p.facing * 40, r.x, r.x + r.w), p.cy, 10, {
                    color: [this.room.area.rim, this.room.area.ink, '#888'],
                    kind: 'shard',
                    speed: 260,
                    life: 0.5,
                    grav: 800,
                    size: 4,
                });

                if (b.hp <= 0) {
                    this.room.breakWall(b);
                    this.state.flags['brk_' + b.id] = true;
                    BW.Audio.play('break');
                    this.fx.shake(8, 0.3);

                    this.fx.burst(r.x + r.w / 2, r.y + r.h / 2, 40, {
                        color: [this.room.area.rim, this.room.area.ink, '#6a6a6a'],
                        kind: 'shard',
                        speed: 420,
                        life: 0.9,
                        grav: 1100,
                        size: 6,
                        jitter: 30,
                    });

                    this.saveGame();
                }
            }

            return res;
        }

        resolveLanceHits(l) {
            const box = l.box();

            for (const e of this.enemies) {
                if (e.dead || l.hits.has(e)) continue;
                if (!BW.overlap(box, e.hurtbox())) continue;

                l.hits.add(e);

                const r = e.damage(3 * BW.XP.power(this.state), 'lance', { cx: l.x - l.dir * 40 });

                if (r) {
                    this.hitstop(0.05);

                    this.fx.burst(e.cx, e.cy, 14, {
                        color: ['#fff6dc', '#ffd98a'],
                        kind: 'spark',
                        speed: 380,
                        life: 0.3,
                    });

                    BW.Audio.play('hit', { rate: 1.2 });
                }
            }

            for (const o of this.objects) {
                if (!o.strikable || o.dead || l.hits.has(o)) continue;

                if (BW.overlap(box, o.hurtbox())) {
                    l.hits.add(o);
                    o.hit();
                }
            }

            for (const s of this.shots) if (!s.dead && Math.abs(s.x - l.x) < 40 && Math.abs(s.y - l.y) < 24) s.pop();
        }

        spawnLance(x, y, dir) {
            this.lances.push(new BW.Lance(this, x, y, dir));
            this.fx.ring(x, y, 4, 40, 0.25, '#ffe7b5', 2);
        }
        spawnEnemyShot(x, y, vx, vy) {
            this.shots.push(new BW.EnemyShot(this, x, y, vx, vy));
        }
        spawnGlints(x, y, n) {
            for (let i = 0; i < n; i++) this.coins.push(new BW.GlintCoin(this, x, y));
        }
        addGlints(n) {
            this.state.glints += n;
        }

        // Experience. Rematches give nothing, like glints.
        gainXp(n) {
            const st = this.state;

            if (!st || this.rematch || !(n > 0)) return;

            n = Math.round(n);

            const before = BW.XP.level(st.xp);

            st.xp = (st.xp | 0) + n;
            this.hud.xpGain(n);

            const after = BW.XP.level(st.xp);

            if (after > before) this.levelUp(after);
        }
        levelUp(lv) {
            const st = this.state,
                p = this.player;

            const alive = p && p.state !== 'dead';

            if (alive) {
                st.hp = st.maxHp;
                st.silk = st.silkMax;
                this.hud.pulse('hp');
                this.hud.pulse('silk');
            }

            this.hud.toast(
                `Level ${lv}`,
                `Strike power +${Math.round(BW.XP.BONUS * (lv - 1) * 100)}%${alive ? '  \u00b7  Health and silk restored' : ''}`,
                3.6,
            );

            BW.Audio.play('shrine', { vol: 0.5, minGap: 0 });

            if (p) {
                this.fx.ring(p.cx, p.cy, 10, 150, 0.6, '#d9c8ff', 3);

                this.fx.burst(p.cx, p.cy, 22, {
                    color: ['#efe6ff', '#c7a8ff', '#ffffff'],
                    kind: 'glow',
                    speed: 200,
                    life: 0.8,
                    add: true,
                    size: 8,
                });
            }
        }
        addLight(x, y, r, color, a) {
            const n = this.lightN;

            if (n >= 256) return;

            this.lightN = n + 1;

            const l = this.lights[n];

            if (l) {
                l.x = x;
                l.y = y;
                l.r = r;
                l.color = color;
                l.a = a;
            } else this.lights[n] = { x, y, r, color, a };
        }

        onHazard() {
            const p = this.player,
                st = this.state;

            if (this.hazardBusy) return;

            this.hazardBusy = true;
            this.lastHitBy = 'The thorns';

            const trap = BW.Difficulty.get(st).trap;
            const fatal = !this.godMode && trap > 0 && st.hp <= trap;

            if (!this.godMode) st.hp = Math.max(0, st.hp - trap);

            p.flash = 1;
            p.vx = 0;
            p.vy = 0;
            BW.Audio.play('hurt');
            this.fx.shake(8, 0.25);

            if (trap > 0) this.fx.flash('#ff2a2a', 0.2);

            this.fx.burst(p.cx, p.cy, 18, {
                color: ['#1a1a24', '#ffcf7a', '#ffffff'],
                speed: 300,
                life: 0.5,
                kind: 'shard',
                size: 4,
            });

            if (trap > 0) this.hud.pulse('hp', true);

            this.hitstop(0.15);

            if (fatal) {
                st.hp = 0;
                this.hazardBusy = false;
                p.die();

                return;
            }

            p.state = 'cutscene';

            this.startTransition(
                () => {
                    p.x = p.safeX;
                    p.y = p.safeY;
                    p.px = p.x;
                    p.py = p.y;
                    p.vx = 0;
                    p.vy = 0;
                    p.state = 'normal';
                    p.invulnT = 1.0;
                    p.dashT = 0;
                    p.attackT = 0;
                    this.updateCamera(0, true);
                    this.hazardBusy = false;
                },
                0.3,
                0.35,
            );
        }

        onPlayerDeath() {
            const st = this.state;

            if (!this.rematch) st.stats.deaths = (st.stats.deaths || 0) + 1;

            this.slowT = 0.9;
            this.fx.shake(10, 0.4);
            this.fx.flash('#ffffff', 0.4);
            BW.Audio.play('die', { rate: 0.6 });
            BW.Audio.duckMusic(0.3, 3);

            this.fx.burst(this.player.cx, this.player.cy, 30, {
                color: ['#ffe7b5', '#fff', '#d8a634'],
                kind: 'thread',
                speed: 300,
                life: 1.2,
                add: true,
            });

            this.startSequence(deathSequence(this));
        }

        // Put back enemies cleared since the last rest. The Warden is left as the fight left it.
        refillClearedEnemies() {
            const room = this.room,
                flags = this.state.flags;

            if (!room) return;

            this.enemies = this.enemies.filter((e) => BW.BOSS_TYPES[e.kind]);

            for (const e of room.def.ents) {
                if ((e.when && !flags[e.when]) || (e.unless && flags[e.unless])) continue;
                if (!BW.ENEMY_TYPES[e.type] || BW.BOSS_TYPES[e.type]) continue;

                this.enemies.push(new BW.ENEMY_TYPES[e.type](this, e));
            }

            for (const e of BW.Difficulty.extras(room, flags, this.state))
                this.enemies.push(new BW.ENEMY_TYPES[e.type](this, e));
        }

        // ================================================================ checkpoints & progression
        restAt(lantern) {
            const st = this.state,
                p = this.player;

            p.state = 'rest';
            p.vx = 0;
            p.attackT = 0;
            p.restT = 0;
            p.x = lantern.x - 34 - p.w / 2;
            st.hp = st.maxHp;

            const first = !lantern.lit;

            lantern.light();
            st.lantern = lantern.id;
            st.lanternRoom = this.room.id;
            st.cleared = {};
            this.refillClearedEnemies();
            this.saveGame();
            this.hud.savedBlip();
            BW.Audio.play('save');

            if (first) BW.Audio.play('heal');

            this.fx.burst(lantern.x + 4, lantern.y - 84, first ? 26 : 10, {
                color: ['#ffd27a', '#fff2cc'],
                kind: 'glow',
                speed: 120,
                life: 0.8,
                add: true,
                size: 8,
            });

            this.hud.toast(first ? 'Lantern kindled' : 'Rested', 'Health restored · progress saved');
            this.hud.pulse('hp');
        }
        onStandUp() {
            /* nothing yet: hook for later stages */
        }

        // lanterns the player has kindled before, in room-list order
        litLanterns() {
            const lit = this.state.lanternsLit || {},
                out = [];

            for (const r of BW.ROOM_LIST)
                for (const e of r.ents)
                    if (e.type === 'lantern' && lit[e.id])
                        out.push({ id: e.id, roomId: r.id, name: r.name, area: BW.AREAS[r.area].name });

            return out;
        }
        canTravel() {
            return this.litLanterns().some((l) => l.id !== this.state.lantern);
        }

        openTravel() {
            if (!this.canTravel()) {
                this.hud.toast('No other lanterns lit', 'Kindle more lanterns to travel between them');
                BW.Audio.play('ui_back', { vol: 0.5 });

                return;
            }

            BW.Audio.play('ui_ok');
            this.menu.push('travel');
        }

        travelTo(roomId, lid) {
            const st = this.state;

            this.startTransition(
                () => {
                    st.lantern = lid;
                    st.lanternRoom = roomId;
                    st.hp = st.maxHp;
                    this.respawnAtLantern(true);
                    this.saveGame();
                    this.hud.toast('Travelled', 'Health restored · progress saved');
                },
                0.5,
                0.55,
            );

            BW.Audio.play('save', { vol: 0.7, rate: 0.8 });
        }

        collectUpgrade(kind, x, y) {
            const st = this.state;

            BW.Audio.play('shrine', { vol: 0.8 });

            this.fx.burst(x, y, 30, {
                color: ['#fff1c8', '#ffd98a', '#ffffff'],
                kind: 'glow',
                speed: 220,
                life: 0.9,
                add: true,
                size: 9,
            });

            this.fx.ring(x, y, 10, 160, 0.7, '#ffe7b5', 3);

            if (kind === 'lifethread') {
                st.maxHp = Math.min(12, st.maxHp + 1);
                st.hp = st.maxHp;

                this.hud.showAnnounce({
                    kicker: 'Obtained',
                    title: 'Lifethread',
                    lines: ['A strand of the old weavers’ vitality.', 'Your maximum health grows by one bell.'],
                    icon: iconDraw('item_lifethread'),
                });
            } else if (kind === 'spool') {
                st.silkMax = Math.min(18, st.silkMax + 3);
                st.silk = st.silkMax;

                this.hud.showAnnounce({
                    kicker: 'Obtained',
                    title: 'Silk Spool',
                    lines: ['A spindle of fine guild silk.', 'You can now hold three more silk threads.'],
                    icon: iconDraw('item_spool'),
                });
            }

            this.saveGame();
        }

        acquireAbility(shrine) {
            const key = shrine.def.ability || 'dash';

            if (this.state.abilities[key]) return;

            this.startSequence(shrineSequence(this, key));
        }

        rethreadLoom(loom) {
            this.startSequence(loomSequence(this, loom));
        }

        openGateAnimated(g) {
            const room = this.room;

            g.open = true;
            g.opening = true;
            g.anim = 0;
            room.fillTiles(g, '.');
            this.state.flags['seen_' + g.flag + '_' + room.id] = true;
            BW.Audio.play('gate');
            this.fx.shake(g.kind === 'seal' ? 10 : 5, g.kind === 'seal' ? 1.6 : 0.6);

            const cx = ((g.x0 + g.x1 + 1) / 2) * T,
                cy = ((g.y0 + g.y1 + 1) / 2) * T;

            this.fx.burst(cx, cy, g.kind === 'seal' ? 40 : 16, {
                color: [room.area.rim, '#ffffff'],
                kind: 'shard',
                speed: 260,
                life: 1,
                grav: 600,
                size: 4,
                jitter: 40,
            });

            if (g.kind === 'seal') {
                BW.Audio.play('bell', { pitch: 130.8, vol: 0.9 });
                this.hud.toast('The Belfry Seal opens', 'The way above is clear');
            }

            this.saveGame();
        }

        fireTrigger(tr) {
            const st = this.state;

            if (tr.once) st.flags[tr.once] = true;

            if (tr.action === 'reveal') {
                this.hud.areaTitle('The Silent Belfry', 'Above the threads');
                BW.Audio.play('bellfar', { pitch: 110, vol: 0.9 });
            } else if (tr.action === 'objective') {
                this.startSequence(cathedralSequence(this));
            } else if (tr.action === 'warden') {
                this.startWardenFight();
            }

            this.saveGame();
        }

        talkToOdo(npc) {
            const st = this.state,
                f = st.flags;

            const pages = [];

            if (!f.odo_met) {
                f.odo_met = true;

                pages.push(
                    'Oh! A Bellweaver? I thought the guild had gone quiet for good. I’m Odo. I keep these lamps lit, for whoever still walks the halls.',
                );

                pages.push(
                    'The Belfry has been sealed since the bells stopped. Two old toll-looms bind its seal. Rethread them both and the way up should open.',
                );

                pages.push(
                    'One loom hangs in the deep roots below the Hollow. The other lies past the Sundered Span… and nobody has crossed that in a long while.',
                );
            } else if (!st.abilities.parry) {
                pages.push(
                    'Before you go further, touch the shrine at the far end of this hall. The weavers called it the Answering Toll: it teaches you to turn a blow aside.',
                );
            } else if (!st.abilities.dash) {
                pages.push(
                    'The weavers had a shrine past the Loom Gallery, where they learned their swiftest stitch. Down through the gallery floor, if memory serves.',
                );
            } else if (!f.bell2) {
                pages.push(
                    'That stitch of yours! With it you could cross the Sundered Span, east of the Lantern Grotto. The second loom waits beyond.',
                );
            } else if (!f.bell1) {
                pages.push(
                    'The first loom is still slack. Follow the roots down from the Lantern Grotto, then west through the thorns.',
                );
            } else if (!f.reached_cathedral) {
                pages.push(
                    'Both looms sing again — I felt it in my shell! The seal above the Gatehouse should be open. Go on up.',
                );
            } else if (f.great_bell) {
                if (f.chapter2_clear)
                    pages.push(
                        'You went through the Last Door? Every lamp I own turned toward the east at once. I think the quiet you left behind is the good kind.',
                    );
                else if (f.silent_key)
                    pages.push(
                        'A key with no voice… The Last Door is at the end of that hall, they say. I hope you’ll tell me what the light is like.',
                    );
                else if (f.mourner_defeated)
                    pages.push(
                        'Did you feel that? The whole Gallery just let out a breath it had been holding for a thousand dusks. Look for an altar.',
                    );
                else if (f.mourner_met)
                    pages.push(
                        'Still on your feet? Good. The Long Mourner is only a mourner. Rest at the lantern outside its door; you will want it.',
                    );
                else if (st.visited.H1)
                    pages.push(
                        'The Hushed Gallery… my grandmother’s grandmother hung those veils. Ring the bells in there if you must, but expect company. The silent ones hear everything.',
                    );
                else {
                    pages.push(
                        'That sound… the Great Bell! I never thought I’d hear it again. Every lamp in the Hollow is burning brighter. Thank you, Bellweaver.',
                    );

                    pages.push(
                        'And there is something else. The black veils at the end of the Ashen Ramparts, east of the Cord Lift: I saw them move from the lift. Veils do not move, Bellweaver. They are listening.',
                    );
                }
            } else if (f.warden_defeated) {
                pages.push(
                    'The air feels lighter. Whatever guarded the cathedral is gone, isn’t it? Then the Great Bell is waiting for you.',
                );
            } else if (f.cathedral_open) {
                pages.push(
                    'I heard the great doors groan open, all the way down here. Something keeps the Great Bell silent. Rest at the lantern before you face it.',
                );
            } else {
                pages.push(
                    'You’ve seen the great doors, then. Strange… lately I hear a bell in my dreams. Just one. Very slow.',
                );
            }

            if (!f.odo_sold) {
                pages.push(
                    `I found a Lifethread in the dark once. It’s yours for 180 glints, if you have them. (You have ${st.glints}.)`,
                );

                this.dialog.open('Odo the Lamplighter', pages, {
                    speaker: 'odo',
                    choices: ['Buy Lifethread', 'Not now'],
                    onClose: (c) => {
                        if (c !== 'Buy Lifethread') return;

                        if (st.glints < 180) {
                            this.dialog.open(
                                'Odo the Lamplighter',
                                ['Ah, not quite enough glints. Bring me 180 and it’s yours.'],
                                { speaker: 'odo' },
                            );

                            return;
                        }

                        st.glints -= 180;
                        f.odo_sold = true;
                        this.collectUpgrade('lifethread', this.player.cx, this.player.cy - 40);
                    },
                });
            } else this.dialog.open('Odo the Lamplighter', pages, { speaker: 'odo' });

            this.saveGame();
        }

        // ================================================================ sequences (cutscenes)
        startSequence(gen) {
            this.seq = { gen, wait: 0, lockInput: true };
            this.stepSequence(0);
        }
        updateSequence(dt, inp) {
            const s = this.seq;

            if (s.wait > 0) {
                s.wait -= dt;

                if (s.wait > 0) return;
            }

            if (s.until && !s.until()) return;

            s.until = null;
            this.stepSequence(dt);
        }
        stepSequence() {
            const s = this.seq;

            if (!s) return;

            const r = s.gen.next();

            if (r.done) {
                this.seq = null;
                this.letterboxTarget = 0;

                return;
            }

            const v = r.value;

            if (typeof v === 'number') s.wait = v;
            else if (typeof v === 'function') s.until = v;
            else s.wait = 0;
        }

        // ================================================================ rendering
        render(alpha) {
            const ctx = this.ctx,
                k = this.pixelScale;

            ctx.setTransform(1, 0, 0, 1, 0, 0);

            if (this.mode === 'ending' && this.ending) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                ctx.setTransform(k, 0, 0, k, 0, 0);
                this.ending.draw(ctx);

                return;
            }

            if (this.mode === 'replay') {
                ctx.fillStyle = '#040508';
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                ctx.setTransform(k, 0, 0, k, 0, 0);

                if (this.loreSlide) BW.Lore.drawSlide(ctx, this.loreSlide);

                return;
            }

            if (this.mode === 'title' || !this.room) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                ctx.setTransform(k, 0, 0, k, 0, 0);
                this.menu.draw(ctx);

                return;
            }

            const zoom = this.zoom(),
                vw = BW.VW / zoom,
                vh = BW.VH / zoom;

            const camX = Math.round((BW.lerp(this.cam.px, this.cam.x, alpha) + this.fx.shakeX) * 2) / 2;
            const camY = Math.round((BW.lerp(this.cam.py, this.cam.y, alpha) + this.fx.shakeY) * 2) / 2;
            const cam = { x: camX, y: camY };
            const SK = BW.SKIP || {};

            ctx.setTransform(k * zoom, 0, 0, k * zoom, 0, 0);

            if (!SK.far) this.bg.drawFar(ctx, cam, vw, vh);

            ctx.translate(-camX, -camY);
            this.lightN = 0;
            this.bg.view = { x0: camX - 20, x1: camX + vw + 20 };
            this.bg.drawDeco(ctx, 'back');

            // lights placed with r.light() in the room definition (areas opt in with roomLights)
            if (this.room.area.roomLights)
                for (const l of this.room.def.lights)
                    this.addLight(l.x * T, l.y * T, l.r * T, l.color, l.a != null ? l.a : 0.4);

            // terrain (visible part only)
            const tc = this.terrain.canvas;

            const sx = BW.clamp(Math.floor(camX), 0, tc.width),
                sy = BW.clamp(Math.floor(camY), 0, tc.height);

            const sw = Math.min(tc.width - sx, Math.ceil(vw) + 2),
                sh = Math.min(tc.height - sy, Math.ceil(vh) + 2);

            if (sw > 0 && sh > 0 && !SK.terrain) ctx.drawImage(tc, sx, sy, sw, sh, sx, sy, sw, sh);

            for (const b of this.room.breakables) if (!b.broken) BW.Terrain.drawBreakable(ctx, this.room, b, this.time);
            for (const g of this.room.gates) BW.Terrain.drawGate(ctx, this.room, g, this.time);
            for (const o of this.objects) if (o.type !== 'hint') o.draw(ctx, alpha);
            for (const c of this.coins) c.draw(ctx);
            for (const e of this.enemies) e.draw(ctx, alpha);
            for (const h of this.hazards) h.draw(ctx);

            this.fx.drawGhosts(ctx);
            this.player.draw(ctx, alpha);

            for (const s of this.shots) s.draw(ctx);
            for (const l of this.lances) l.draw(ctx);

            for (const s of this.terrain.secrets)
                if (s.a > 0) {
                    ctx.globalAlpha = s.a;
                    ctx.drawImage(s.canvas, s.x, s.y);
                    ctx.globalAlpha = 1;
                }

            this.bg.drawDeco(ctx, 'front');
            this.fx.draw(ctx);
            this.fx.drawAdditive(ctx);

            if (BW.gfx.motes > 0) this.bg.drawMotes(ctx);

            // lighting
            const p = this.player,
                plight = this.plight;

            plight.x = p.cx;
            plight.y = p.cy - 10;
            ctx.setTransform(k * zoom, 0, 0, k * zoom, 0, 0);

            if (!SK.lighting && BW.gfx.lighting > 0)
                this.bg.drawLighting(ctx, cam, vw, vh, this.lights, this.lightN, plight);

            // prompts drawn above lighting so they stay readable
            ctx.translate(-camX, -camY);

            if (!this.seq && !this.hud.announce && !this.dialog.active)
                for (const o of this.objects) if (o.type === 'hint') o.draw(ctx, alpha);

            if (!this.seq) BW.drawPealHint(ctx, this);
            if (!this.seq) for (const e of this.enemies) e.drawBar(ctx, alpha);

            if (!this.seq && this.player.state === 'rest' && this.player.restT > 0.35 && !this.transition) {
                const pl = this.player;

                this.hud.worldPrompt(ctx, pl.x + pl.w / 2, pl.y - 36, { act: 'interact' }, 'Lantern', 1);
            }

            if (this.interactTarget && !this.seq && !this.dialog.active && !this.hud.announce && !this.loreSlide) {
                const o = this.interactTarget;

                this.hud.worldPrompt(
                    ctx,
                    o.x,
                    o.y -
                        (o.type === 'toll'
                            ? 330
                            : o.type === 'shrine'
                              ? 210
                              : o.type === 'npc'
                                ? 130
                                : o.type === 'door'
                                  ? 160
                                  : o.type === 'note'
                                    ? 70
                                    : 128),
                    { act: 'interact' },
                    o.prompt(),
                    1,
                );
            }

            // screen space
            ctx.setTransform(k, 0, 0, k, 0, 0);
            this.fx.drawFlash(ctx, BW.VW, BW.VH);
            // letterbox for sequences
            this.letterbox = BW.damp(this.letterbox, this.letterboxTarget || 0, 6, 1 / 60);

            if (this.letterbox > 0.01) {
                ctx.fillStyle = '#000';

                const h = 70 * this.letterbox;

                ctx.fillRect(0, 0, BW.VW, h);
                ctx.fillRect(0, BW.VH - h, BW.VW, h);
            }

            this.hudAlpha = BW.damp(this.hudAlpha, this.seq && this.seq.hideHud ? 0 : 1, 6, 1 / 60);

            if (!SK.hud) this.hud.draw(ctx);

            BW.drawBossOverlay(ctx, this);
            this.dialog.draw(ctx);
            this.hud.drawAnnounce(ctx);

            if (this.fade > 0) {
                ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
                ctx.fillRect(0, 0, BW.VW, BW.VH);
            }

            if (this.seqCard) this.drawSeqCard(ctx);
            if (this.chapterCard) this.drawChapterCard(ctx);
            if (this.deathCard) this.drawDeathCard(ctx);
            if (this.seqText) this.drawSeqText(ctx); // story text sits above the black fade
            if (this.loreSlide) BW.Lore.drawSlide(ctx, this.loreSlide);
            if (this.rematchCard) this.drawRematchCard(ctx);

            if (this.whiteFade > 0) {
                ctx.fillStyle = `rgba(255,250,240,${this.whiteFade})`;
                ctx.fillRect(0, 0, BW.VW, BW.VH);
            }

            if (this.menu.open) this.menu.draw(ctx);
        }

        drawFps(ctx) {
            const f = this.fpsStat;

            if (!f || !f.fps) return;

            const full = BW.settings.fpsCounter === 'full';
            const txt = full ? `${f.fps} FPS  ${f.ms.toFixed(1)} ms  (worst ${f.worst.toFixed(0)})` : `${f.fps} FPS`;

            ctx.save();
            ctx.font = `600 16px ${BW.FONT_B}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';

            const w = ctx.measureText(txt).width + 16;

            ctx.fillStyle = 'rgba(6,8,12,0.6)';
            ctx.fillRect(BW.VW - w - 10, 10, w, 26);
            ctx.fillStyle = f.fps >= 55 ? '#bfe8b0' : f.fps >= 30 ? '#ffd27a' : '#ff8a7a';
            ctx.fillText(txt, BW.VW - 18, 15);
            ctx.restore();
        }

        drawDeathCard(ctx) {
            const c = this.deathCard,
                cx = BW.VW / 2,
                t = c.t,
                VW = BW.VW,
                VH = BW.VH;

            const ease = (u) => {
                u = BW.clamp(u, 0, 1);

                return 1 - Math.pow(1 - u, 3);
            };

            const nm = c.diff.lock;

            ctx.save();
            ctx.globalAlpha = c.a;
            ctx.fillStyle = '#040206';
            ctx.fillRect(0, 0, VW, VH);

            const vg = ctx.createRadialGradient(cx, VH * 0.46, VH * 0.12, cx, VH * 0.5, VH * 0.95);

            vg.addColorStop(0, nm ? 'rgba(130,0,18,0.55)' : 'rgba(96,10,20,0.45)');
            vg.addColorStop(0.6, 'rgba(30,2,8,0.5)');
            vg.addColorStop(1, 'rgba(0,0,0,0.95)');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, VW, VH);
            // embers drifting up
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < 44; i++) {
                const x = ((i * 173.3) % VW) + Math.sin(t * 0.7 + i) * 26,
                    y = VH + 20 - ((i * 61.7 + t * (16 + (i % 5) * 7)) % (VH + 40));

                const f = 0.25 + 0.25 * Math.sin(t * 3 + i * 1.7);

                ctx.fillStyle = `rgba(255,${90 + (i % 4) * 25},70,${Math.max(0, f)})`;
                ctx.beginPath();
                ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            // the broken bell
            const be = ease(t / 1.1),
                by = VH * 0.27 - (1 - be) * 24;

            ctx.save();
            ctx.translate(cx, by);
            ctx.globalAlpha = c.a * be;
            ctx.globalCompositeOperation = 'lighter';

            const gl = ctx.createRadialGradient(0, 8, 0, 0, 8, 130);

            gl.addColorStop(0, `rgba(255,70,60,${0.28 + 0.06 * Math.sin(t * 2.4)})`);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(-140, -120, 280, 280);
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(235,225,205,0.55)';
            ctx.lineWidth = 2; // the snapped thread
            ctx.beginPath();
            ctx.moveTo(0, -150);
            ctx.lineTo(0, -88);
            ctx.lineTo(5, -80);
            ctx.moveTo(-5, -74);
            ctx.lineTo(0, -66);
            ctx.stroke();

            const bg = ctx.createLinearGradient(0, -50, 0, 50);

            bg.addColorStop(0, '#6a5a52');
            bg.addColorStop(0.55, '#3b2f33');
            bg.addColorStop(1, '#1a1318');
            ctx.fillStyle = bg;
            BW.bellIcon(ctx, 0, 0, 52);
            ctx.strokeStyle = '#ff4a3c';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.shadowColor = '#ff2a20';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(-8, -40);
            ctx.lineTo(4, -20);
            ctx.lineTo(-6, -2);
            ctx.lineTo(8, 18);
            ctx.lineTo(-2, 38);
            ctx.stroke();
            ctx.restore();

            // title
            const ta = BW.clamp((t - 0.45) / 0.9, 0, 1),
                sp = 6 + 16 * ease(t / 3.6),
                ty = VH * 0.54;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.save();
            ctx.globalAlpha = c.a * ta;
            ctx.translate(cx + sp / 2, ty);

            const pop = 1 + 0.07 * (1 - ease((t - 0.45) / 1.6));

            ctx.scale(pop, pop);
            ctx.font = `700 104px ${BW.FONT_T}`;

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = sp + 'px';

            ctx.shadowColor = 'rgba(210,20,40,0.85)';
            ctx.shadowBlur = 36;

            const tg = ctx.createLinearGradient(0, -50, 0, 50);

            tg.addColorStop(0, '#f0525e');
            tg.addColorStop(0.55, '#c4202f');
            tg.addColorStop(1, '#7c0f1c');
            ctx.fillStyle = tg;
            ctx.fillText('YOU DIED', 0, 0);
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(255,190,170,0.35)';
            ctx.strokeText('YOU DIED', 0, 0);

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

            ctx.restore();

            // rule with a diamond
            const ra = ease((t - 1) / 1.1),
                rw = 360 * ra,
                ry = VH * 0.635;

            if (ra > 0) {
                ctx.save();
                ctx.globalAlpha = c.a * ra;

                for (const s of [-1, 1]) {
                    const lg = ctx.createLinearGradient(cx, 0, cx + s * rw, 0);

                    lg.addColorStop(0, 'rgba(214,60,70,0.9)');
                    lg.addColorStop(1, 'rgba(214,60,70,0)');
                    ctx.strokeStyle = lg;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cx + s * 16, ry);
                    ctx.lineTo(cx + s * rw, ry);
                    ctx.stroke();
                }

                ctx.fillStyle = '#d6404d';
                ctx.beginPath();
                ctx.moveTo(cx, ry - 7);
                ctx.lineTo(cx + 7, ry);
                ctx.lineTo(cx, ry + 7);
                ctx.lineTo(cx - 7, ry);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // cause, flavour, tally
            const fa = (d) => c.a * BW.clamp((t - d) / 0.8, 0, 1);

            ctx.save();
            ctx.globalAlpha = fa(1.6);
            ctx.font = `600 16px ${BW.FONT_T}`;
            ctx.fillStyle = '#a98a86';

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '7px';

            ctx.fillText('FELLED BY', cx + 3, VH * 0.69);

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

            ctx.font = `italic 600 38px ${BW.FONT_B}`;
            ctx.fillStyle = '#f1dcd4';
            ctx.fillText(c.cause, cx, VH * 0.745);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = fa(2.1);
            ctx.font = `italic 500 24px ${BW.FONT_B}`;
            ctx.fillStyle = '#b8a39d';
            ctx.fillText('Your silk unravels, and the thread leads you back to the lantern.', cx, VH * 0.805);
            ctx.font = `600 18px ${BW.FONT_T}`;
            ctx.fillStyle = nm ? '#e0505c' : '#c9b49a';
            ctx.fillText(`${c.diff.name.toUpperCase()}   \u00b7   DEATHS ${c.deaths}`, cx, VH * 0.86);
            ctx.restore();

            if (t > 2.6) {
                ctx.save();
                ctx.globalAlpha = c.a * (0.55 + 0.35 * Math.sin(t * 3.2)) * BW.clamp((t - 2.6) / 0.6, 0, 1);
                ctx.font = `500 22px ${BW.FONT_B}`;
                ctx.fillStyle = '#e8d6ce';
                ctx.fillText(`Press ${BW.Input.label('confirm')} to rise`, cx, VH * 0.93);
                ctx.restore();
            }

            ctx.restore();
        }

        drawSeqCard(ctx) {
            const c = this.seqCard,
                cx = BW.VW / 2;

            ctx.save();
            ctx.globalAlpha = c.a;
            ctx.fillStyle = '#0a0105';
            ctx.fillRect(0, 0, BW.VW, BW.VH);

            const vg = ctx.createRadialGradient(cx, BW.VH / 2, BW.VH * 0.2, cx, BW.VH / 2, BW.VH * 0.95);

            vg.addColorStop(0, 'rgba(120,0,16,0.35)');
            vg.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, BW.VW, BW.VH);
            BW.drawNightmareIcon(ctx, cx, BW.VH * 0.34, 96, c.t);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `600 72px ${BW.FONT_T}`;
            ctx.fillStyle = `rgba(214,40,58,${0.88 + 0.12 * Math.sin(c.t * 9) * Math.sin(c.t * 2.3)})`;
            ctx.shadowColor = 'rgba(200,0,30,0.8)';
            ctx.shadowBlur = 24;

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '12px';

            ctx.fillText('NIGHTMARE', cx, BW.VH * 0.62);

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

            ctx.shadowBlur = 0;
            ctx.font = `italic 500 30px ${BW.FONT_B}`;
            ctx.fillStyle = '#e6c9c4';
            ctx.fillText('There is no turning back.', cx, BW.VH * 0.72);
            ctx.restore();
        }

        drawSeqText(ctx) {
            const s = this.seqText;

            ctx.save();
            ctx.globalAlpha = s.a;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `italic 500 ${s.size || 34}px ${BW.FONT_B}`;
            ctx.fillStyle = s.color || '#efe4cc';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 16;
            BW.wrapText(ctx, s.text, BW.VW / 2, BW.VH * (s.y != null ? s.y : 0.5) - 20, 840, 44);
            ctx.restore();
        }

        drawTitleBackdrop(ctx, t) {
            ctx.fillStyle = '#05080a';
            ctx.fillRect(0, 0, BW.VW, BW.VH);

            const img = BW.Assets.img('title_art');

            if (img) {
                const s = Math.max((BW.VW * 1.08) / img.width, (BW.VH * 1.08) / img.height);

                const w = img.width * s,
                    h = img.height * s;

                const ox = (BW.VW - w) / 2 + Math.sin(t * 0.07) * 20,
                    oy = (BW.VH - h) / 2 + Math.cos(t * 0.05) * 10;

                ctx.globalAlpha = Math.min(1, t / 2);
                ctx.drawImage(img, ox, oy, w, h);
                ctx.globalAlpha = 1;
            }

            const g = ctx.createLinearGradient(0, 0, 0, BW.VH);

            g.addColorStop(0, 'rgba(0,0,0,0.25)');
            g.addColorStop(0.5, 'rgba(0,0,0,0.05)');
            g.addColorStop(1, 'rgba(0,0,0,0.7)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, BW.VW, BW.VH);
            // drifting silk motes
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < 40; i++) {
                const x = ((i * 137.5 + t * (8 + (i % 5) * 3)) % (BW.VW + 40)) - 20,
                    y = BW.VH - ((i * 89.3 + t * (10 + (i % 7) * 2)) % (BW.VH + 40)) + 20;

                ctx.fillStyle = `rgba(255,236,200,${0.25 + (i % 3) * 0.12})`;
                ctx.beginPath();
                ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    function iconDraw(name) {
        return (ctx, x, y, t) => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            const g = ctx.createRadialGradient(x, y, 0, x, y, 90);

            g.addColorStop(0, 'rgba(255,230,180,0.5)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 90, y - 90, 180, 180);
            ctx.restore();
            BW.Assets.drawImg(ctx, name, x, y + Math.sin(t * 2) * 4, { w: 96, h: 96, ay: 0.5 });
        };
    }

    // ---------------------------------------------------------------- scripted sequences
    function* introSequence(g) {
        g.seq.hideHud = true;
        g.letterboxTarget = 1;
        g.fade = 1;

        if (BW.Difficulty.get(g.state).lock) {
            const c = (g.seqCard = { a: 0, t: 0 });

            BW.Audio.play('land', { rate: 0.5, vol: 0.9 });

            for (let i = 0; i < 40; i++) {
                c.a = i / 40;
                c.t += 1 / 60;
                yield 1 / 60;
            }

            c.a = 1;

            while (c.t < 4.2) {
                c.t += 1 / 60;
                yield 1 / 60;

                if (c.t > 1.2 && (BW.Input.pressed.confirm || BW.Input.pressed.jump)) break;
            }

            for (let i = 40; i >= 0; i--) {
                c.a = i / 40;
                c.t += 1 / 60;
                yield 1 / 60;
            }

            g.seqCard = null;
        }

        yield* BW.Lore.play(g, BW.Lore.INTRO);
        g.seqText = null;
        g.fade = 0;
        g.player.state = 'cutscene';
        BW.Audio.play('dash', { rate: 0.5, vol: 0.6 });
        yield () => g.player.onGround;
        g.fx.shake(6, 0.3);
        BW.Audio.play('land', { vol: 1 });

        g.fx.burst(g.player.cx, g.player.y + g.player.h, 18, {
            color: ['#3fae86', '#a8f7dc'],
            speed: 200,
            angle: -Math.PI / 2,
            spread: 2.6,
            life: 0.6,
            grav: 400,
        });

        yield 0.6;
        g.letterboxTarget = 0;
        g.seq.hideHud = false;
        g.player.state = 'normal';
        g.hud.areaTitle('Mosslit Hollow', 'Beneath the silent city');
        g.saveGame();
    }

    function* deathSequence(g) {
        g.seq.hideHud = false;
        yield 1.4;
        g.fade = 0;

        for (let i = 0; i <= 30; i++) {
            g.fade = i / 30;
            yield 1 / 60;
        }

        const st = g.state;

        g.seq.hideHud = true;

        const c = (g.deathCard = {
            a: 0,
            t: 0,
            cause: g.lastHitBy || 'The dark',
            deaths: st.stats.deaths || 0,
            diff: BW.Difficulty.get(st),
        });

        BW.Audio.play('bellfar', { pitch: 82.4, vol: 0.8, minGap: 0 });

        for (let i = 0; i <= 30; i++) {
            c.a = i / 30;
            c.t += 1 / 60;
            yield 1 / 60;
        }

        // the world is rebuilt behind the card
        st.hp = st.maxHp;
        st.silk = 0;
        g.respawnAtLantern(true);
        g.saveGame();

        while (c.t < 7) {
            c.t += 1 / 60;
            yield 1 / 60;

            if (c.t > 2.6 && (BW.Input.pressed.confirm || BW.Input.pressed.jump)) break;
        }

        g.fade = 0;

        for (let i = 30; i >= 0; i--) {
            c.a = i / 30;
            c.t += 1 / 60;
            yield 1 / 60;
        }

        g.deathCard = null;
        g.seq.hideHud = false;
    }

    const ABILITY_INFO = {
        dash: {
            kicker: 'Learned the Swift Stitch',
            title: 'Silk Dash',
            glow: ['#fff6dc', '#ffd98a'],
            ring: '#ffe7b5',
            note: 261.6,
            lines: (pad) => [
                `Press ${pad ? 'B or RT' : 'K or Shift'} to dash — on the ground or in mid-air.`,
                'One air dash per jump; it recharges when you land or strike downward.',
                'Dashing never costs silk.',
            ],
            toast: ['Try it: dash across the gap', 'dash'],
            icon: (ctx, x, y, t) => {
                ctx.strokeStyle = '#fff1d0';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';

                for (let i = 0; i < 4; i++) {
                    ctx.globalAlpha = 1 - i * 0.22;
                    ctx.beginPath();
                    ctx.moveTo(-70 + i * 10 + Math.sin(t * 3) * 8, -12 + i * 8);
                    ctx.lineTo(60 + Math.sin(t * 3) * 8, -12 + i * 8);
                    ctx.stroke();
                }
            },
        },
        parry: {
            kicker: 'Learned the Answering Toll',
            title: 'Parry',
            glow: ['#fff0dc', '#ffb48a'],
            ring: '#ffc6a0',
            note: 329.6,
            lines: (pad) => [
                `Press ${pad ? 'LB' : 'I'} just as a blow lands to turn it aside.`,
                'A clean parry costs you nothing, breaks the foe\u2019s rhythm and opens it to a counter.',
                'Mistime it and you are left open — and the sound rings differently when you get it right.',
            ],
            toast: ['Try it: parry a blow as it lands', 'parry'],
            icon: (ctx, x, y, t) => {
                ctx.strokeStyle = '#ffd9bd';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';

                const k = 1 + Math.sin(t * 4) * 0.06;

                ctx.beginPath();
                ctx.arc(0, 0, 46 * k, -2.4, 0.9);
                ctx.stroke();
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.moveTo(-40, -44);
                ctx.lineTo(40, 44);
                ctx.moveTo(40, -44);
                ctx.lineTo(-40, 44);
                ctx.stroke();
            },
        },
        dodge: {
            kicker: 'Learned the Unwoven Step',
            title: 'Shadow Step',
            glow: ['#f1ecff', '#a994ff'],
            ring: '#b9a6ff',
            note: 392,
            lines: (pad) => [
                `Dash (${pad ? 'B or RT' : 'K or Shift'}) just as a blow is about to land to slip through it.`,
                'You take no damage, a shadow of you remains, and the foe is frozen for a moment.',
                'Strike it while it is stunned for a free combo. Needs the Silk Dash.',
            ],
            toast: ['Try it: dash as a blow lands', 'dash'],
            icon: (ctx, x, y, t) => {
                for (let i = 0; i < 3; i++) {
                    ctx.globalAlpha = 0.9 - i * 0.28;
                    ctx.fillStyle = i ? '#7e6ad8' : '#f1ecff';
                    ctx.beginPath();
                    ctx.ellipse(-50 + i * 38 + Math.sin(t * 3) * 5, 0, 16, 40, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        },
    };

    function* shrineSequence(g, key) {
        const A = ABILITY_INFO[key],
            p = g.player;

        p.state = 'cutscene';
        p.vx = 0;
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        BW.Audio.duckMusic(0.25, 6);
        BW.Audio.play('shrine');

        for (let i = 0; i < 150; i++) {
            const a = Math.random() * Math.PI * 2,
                r = BW.rand(120, 260);

            g.fx.spawn({
                x: p.cx + Math.cos(a) * r,
                y: p.cy + Math.sin(a) * r,
                vx: -Math.cos(a) * r * 1.6,
                vy: -Math.sin(a) * r * 1.6,
                life: 0.6,
                size: 1.6,
                color: '#fff0c8',
                kind: 'thread',
                add: true,
                drag: 0,
            });

            if (i % 30 === 0) g.fx.ring(p.cx, p.cy, 200, 10, 0.5, A.ring, 2);

            p.glow = Math.min(1, i / 100);
            yield 1 / 60;
        }

        g.fx.flash('#fff6e0', 0.9);
        g.fx.shake(6, 0.4);
        g.fx.burst(p.cx, p.cy, 40, { color: A.glow, kind: 'glow', speed: 380, life: 0.9, add: true, size: 10 });
        BW.Audio.play('bell', { pitch: A.note, vol: 0.6 });
        g.state.abilities[key] = true;
        g.saveGame();
        yield 0.5;

        let closed = false;

        g.hud.showAnnounce({
            kicker: A.kicker,
            title: A.title,
            lines: A.lines(BW.Input.device === 'pad'),
            icon: (ctx, x, y, t) => {
                ctx.save();
                ctx.translate(x, y);
                A.icon(ctx, x, y, t);
                ctx.restore();
            },
            onClose: () => {
                closed = true;
            },
        });

        yield () => closed;
        g.letterboxTarget = 0;
        g.seq.hideHud = false;
        p.state = 'normal';
        p.glow = 0.6;
        g.hud.toast(A.toast[0], `${BW.Input.label(A.toast[1])}`);
        g.gainXp(BW.XP.REWARD.shrine);
        g.saveGame();
    }

    function* loomSequence(g, loom) {
        const p = g.player;

        p.state = 'cutscene';
        p.vx = 0;
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        p.facing = loom.x > p.cx ? 1 : -1;
        g.camFocus = { x: (p.cx + loom.x) / 2, y: loom.y - 180 };
        BW.Audio.duckMusic(0.2, 8);

        for (let i = 0; i < 90; i++) {
            const tx = loom.x + BW.rand(-60, 60),
                ty = loom.y - BW.rand(60, 300);

            g.fx.thread(p.cx, p.cy - 10, tx, ty, 0.4, '#ffe7b5');

            if (i % 6 === 0) BW.Audio.play('text', { vol: 1, minGap: 0 });

            yield 1 / 60;
        }

        g.state.flags['bell' + loom.def.bell] = true;
        loom.ring(1.6);
        BW.Audio.play('bell', { pitch: loom.def.bell === 1 ? 174.6 : 130.8, vol: 1, minGap: 0 });
        g.fx.shake(12, 1.2);
        g.fx.flash('#fff3d8', 0.6);

        for (let i = 0; i < 3; i++) g.fx.ring(loom.x, loom.y - 210, 20, 700 + i * 200, 1.4 + i * 0.3, '#ffe7b5', 4 - i);

        yield 1.6;

        const both = g.state.flags.bell1 && g.state.flags.bell2;

        if (both) g.state.flags.belfry_open = true;

        g.saveGame();
        BW.Audio.play('bellfar', { pitch: loom.def.bell === 1 ? 261.6 : 196, vol: 1 });
        yield 0.8;
        g.camFocus = null;
        g.letterboxTarget = 0;
        g.seq.hideHud = false;
        p.state = 'normal';

        if (loom.def.bell === 1)
            g.hud.toast(
                'The first toll-loom sings (1/2)',
                both ? 'The Belfry Seal is broken.' : 'Far above, a hatch unbolts and a lift stirs.',
            );
        else
            g.hud.toast(
                'The second toll-loom sings' + (both ? ' (2/2)' : ' (1/2)'),
                both ? 'The Belfry Seal is broken. The Cord Lift wakes.' : 'The Cord Lift wakes.',
            );

        g.gainXp(BW.XP.REWARD.loom);
        g.saveGame();
    }

    function* cathedralSequence(g) {
        const p = g.player;

        BW.Audio.playMusic(null, 4);
        g.letterboxTarget = 1;
        g.seq.hideHud = true;
        g.seq.lockInput = true;
        p.state = 'cutscene';
        p.vx = 0;
        g.camFocus = { x: 7 * T, y: 12 * T };
        yield 1.2;
        BW.Audio.play('bellfar', { pitch: 98, vol: 1 });
        g.hud.areaTitle('Cathedral of the Last Toll', 'The Silent Belfry');
        yield 3.4;
        g.camFocus = null;
        g.letterboxTarget = 0;
        g.seq.hideHud = false;
        p.state = 'normal';
        g.hud.toast('You reached the heart of the Belfry', 'The great doors wait before you');
        BW.Audio.playMusic(g.room.area.music, 4);
        g.saveGame();
    }

    BW.NULL_INPUT = { down: {}, pressed: {}, released: {}, consume() {} };
    BW.Game = Game;
})(window.BW);

'use strict';

// The Long Mourner, Keeper of the Final Silence: a tall black monster with a blank porcelain mask.
// It borrows the Warden's fight framework (health, poise, parry and Shadow Step, phase change, boss bar) but has
// its own body, its own poses and an all-new moveset built around reach, the ceiling and silence:
//   phase one   Long Reach, Needle Garden, Veil Net, Scuttle Rush
//   phase two   adds the Silent Wail, the Ceiling Drop, the Pounce and the Mourning Embrace (an unparryable grab)
// Art: assets/img/sprites/mourner.webp (tools/import_mourner_art.py). Every attack effect is drawn in code.
(function (BW) {
    const T = BW.T,
        Hazard = BW.Hazard;

    // [phase one, phase two] pairs. Times in seconds, speeds in px/s, lengths in px.
    // Phase two is a different animal: `speed` makes the whole body run faster (tells, strikes and recoveries alike),
    // it thinks for almost no time between attacks, and many attacks chain into the next.
    const TUNE = {
        hp: [45, 60], // the two health bars: phase one's, then phase two's (the Warden has 36 + 36)
        speed: [1, 1.3],
        think: [
            [0.5, 0.9],
            [0.06, 0.28],
        ],
        reach: { wind: [0.7, 0.55], len: 330, lunge: 520, rewind: 0.34, rec: [1.0, 0.7] },
        needles: {
            wind: [0.68, 0.52],
            n: [7, 11],
            gap: 84,
            step: [0.11, 0.07],
            tele: [0.55, 0.42],
            h: 150,
            rec: [0.95, 0.7],
        },
        veil: { wind: [0.82, 0.62], speed: [330, 460], rec: [1.05, 0.75] },
        rush: { wind: [0.58, 0.55], speed: [700, 700], time: [0.8, 0.85], rec: [0.95, 0.7] },
        darts: { wind: [0.6, 0.45], n: [3, 5], gap: [0.3, 0.2], speed: [600, 760], rec: [0.9, 0.6] },
        stalk: { wind: [0.6, 0.45], n: [3, 6], step: [0.4, 0.26], tele: [0.55, 0.42], h: 150, rec: [0.9, 0.65] },
        hush: { wind: 0.95, speed: [420, 520], h: 90, echoes: [0.7, 1.3], rec: 1.1 },
        drop: { climb: 0.5, crawl: 1.4, lock: 0.42, speed: 420, rec: 0.85 },
        crawl: { speed: 500, needleGap: 0.2, tele: 0.45, max: 2.6 },
        pounce: { wind: 0.58, air: 0.56, height: 170, rec: 0.75 },
        dance: { wind: 0.5, speed: 640, legs: 3, leg: 0.85 },
        embrace: { wind: 1.0, chain: 0.55, lunge: 0.32, speed: 700, rec: 1.2 },
    };

    // a shuffled bag per phase, so no attack repeats at once (the Warden's rule)
    const BAGS = [
        ['reach', 'needles', 'veil', 'rush', 'darts', 'stalk', 'reach', 'needles'],
        [
            'reach',
            'needles',
            'veil',
            'rush',
            'darts',
            'stalk',
            'hush',
            'drop',
            'pounce',
            'embrace',
            'crawl',
            'dance',
            'reach',
            'pounce',
        ],
    ];

    // the pose a Warden pose name maps to (the shared fight code sets some poses itself)
    const POSE_OF = { bound: 'rise', roar: 'hush', crouch: 'scuttle' };

    // hurtbox [width, height] for each pose, standing on the feet
    const HURT = {
        idle: [90, 270],
        walk: [100, 270],
        reach_tell: [110, 270],
        reach_strike: [120, 255],
        reach_recover: [120, 220],
        needle_tell: [100, 290],
        needle_plant: [140, 200],
        veil_tell: [90, 270],
        veil_cast: [110, 250],
        scuttle: [190, 170],
        stagger: [140, 220],
        fallen: [300, 90],
        rise: [200, 210],
        hush: [110, 300],
        cling: [120, 280],
        drop: [100, 330],
        land: [170, 230],
        pounce: [220, 220],
        embrace_tell: [110, 300],
        embrace_strike: [150, 280],
    };

    // states with the body moved by code, not by gravity
    const AIR = { drop_climb: 1, drop_cling: 1, crawl_run: 1, drop_fall: 1, pounce_air: 1 };

    // moments its guard can break in
    const STAG = {
        idle: 1,
        walk: 1,
        reach_wind: 1,
        reach_rec: 1,
        needles_wind: 1,
        needles_rec: 1,
        veil_wind: 1,
        veil_rec: 1,
        rush_wind: 1,
        rush_rec: 1,
        hush_rec: 1,
        pounce_wind: 1,
        pounce_rec: 1,
        drop_rec: 1,
        embrace_rec: 1,
        darts_wind: 1,
        darts_rec: 1,
        stalk_wind: 1,
        stalk_rec: 1,
        dance_wind: 1,
        dance_rec: 1,
    };

    // blow weights (bells), multiplied by the boss damage setting; anything else is a body brush at 1
    const WEIGHT = { reach: 1.5, rush: 1.5, dance: 1.5, embrace: 2.5, drop_fall: 2, drop_land: 2, pounce_land: 1.5 };

    // how strong the red glow in its palms is, by state (the Embrace's tell)
    const RED_IN = { embrace_wind: 1, embrace: 0.7 };

    // where the wind-up glint shows on a pose, as a fraction of the frame
    const GLINT_AT = { reach_tell: [0.05, 0.76], needle_tell: [0.77, 0.03], veil_tell: [0.55, 0.42] };

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [a[i], a[j]] = [a[j], a[i]];
        }

        return a;
    }

    class Mourner extends BW.Warden {
        constructor(game, def) {
            super(game, def);

            this.bossName = 'The Long Mourner';
            this.bossSub = 'Keeper of the Final Silence';
            this.w = 90;
            this.h = 270;
            this.x = (def.x + 0.5) * T - this.w / 2;
            this.y = (def.y + 1) * T - this.h;
            this.px = this.x;
            this.py = this.y;
            this.homeX = this.x;
            this.homeY = this.y;
            this.cords = [];
            this.recMap = { reach: 'reach_rec', drop_land: 'drop_rec', pounce_land: 'pounce_rec' };
            this.crashStates = ['rush', 'embrace', 'dance'];
            this.emberColors = ['#9fd8ff', '#e6f6ff', '#6fb7ff'];
            this.red = 0;
            this.ceilY = 0;
            this.climb = null;
            this.lock = false;
            this.hinted = false;
            this.pending = null;
            this.reachN = 0;
            this.pounceN = 0;
            this.introGlow = 0; // brightens the mask glow during the opening cinematic
            this.chain = false;
            this.crawl = false;
            this.crawlDir = 1;
            this.introStyle = 'mourner'; // which opening cinematic the fight plays (see cathedral.js)
            this.flagKey = 'mourner'; // flags mourner_met / mourner_defeated, attempts in stats.mournerAttempts
            this.heatDeep = '#030e18'; // the arena darkens and washes cold, not red, in phase two
            this.heatTint = '#4a9de0';
            this.codexId = 'mourner';

            // two health bars: phase one's is fought first, and phase two comes with a fresh, bigger one
            this.twoBars = true;
            this.glowColors = ['#7cc8ff', '#e6f6ff'];
            this.flashColor = '#cfeaff';
            this.ringColor = '#9fd8ff';

            if (this.state !== 'remains') {
                this.maxHp = TUNE.hp[0] + TUNE.hp[1];
                this.hp = this.maxHp;
                this.chip = this.hp;
                this.phaseAt = TUNE.hp[1];
            }
        }

        defeated() {
            return !!this.game.state.flags.mourner_defeated;
        }

        // ---------------------------------------------------------------- the two health bars and the tempo
        barFrac(v) {
            const f = this.phase === 1 ? (v - this.phaseAt) / (this.maxHp - this.phaseAt) : v / this.phaseAt;

            return BW.clamp(f, 0, 1);
        }
        reserve() {
            return this.phase === 1 ? 1 : 0;
        }
        // back to waiting: phase two runs faster and barely pauses between attacks
        toIdle(wait) {
            this.speed = TUNE.speed[this.phase - 1];
            this.chain = false;

            super.toIdle(wait != null ? wait : BW.rand(...TUNE.think[this.phase - 1]));
        }
        embraceWind() {
            return this.chain ? TUNE.embrace.chain : TUNE.embrace.wind;
        }

        // ---------------------------------------------------------------- boxes and weights
        canStagger() {
            return !!STAG[this.state];
        }
        poseName() {
            return POSE_OF[this.pose] || this.pose;
        }
        hurtbox() {
            if (this.state === 'remains') return { x: -9999, y: -9999, w: 0, h: 0 };

            const name = this.poseName(),
                [w, h] = HURT[name] || HURT.idle;

            if (name === 'cling') return { x: this.cx - w / 2, y: this.y, w, h };

            return { x: this.cx - w / 2, y: this.y + this.h - h, w, h };
        }
        attackBoxes() {
            const f = this.y + this.h,
                c = this.cx,
                d = this.facing,
                s = this.state,
                t = this.stateT;

            if (s === 'reach') {
                const r = TUNE.reach.len;

                return [{ x: d > 0 ? c + 10 : c - 10 - r, y: f - 150, w: r, h: 140 }];
            }

            if (s === 'embrace') return [{ x: d > 0 ? c - 10 : c - 240, y: f - 290, w: 250, h: 270 }];
            if (s === 'drop_land' && t < 0.14) return [{ x: c - 135, y: f - 130, w: 270, h: 130 }];
            if (s === 'pounce_land' && t < 0.12) return [{ x: c - 115, y: f - 115, w: 230, h: 115 }];

            return null;
        }
        isStriking() {
            return !!WEIGHT[this.state];
        }
        hitWeight() {
            return (
                (WEIGHT[this.state] || BW.Difficulty.WEIGHTS.warden.body) * BW.Difficulty.get(this.game.state).bossDmg
            );
        }
        // only a Shadow Step answers the Embrace: a parry does nothing against it
        get unparryable() {
            return this.state === 'embrace';
        }

        // ---------------------------------------------------------------- decisions
        suits(a, d) {
            switch (a) {
                case 'reach':
                    return d > 130 && d < 620;
                case 'veil':
                    return d > 160;
                case 'rush':
                    return d > 280;
                case 'pounce':
                    return d > 220;
                case 'embrace':
                    return d < 420;
                case 'darts':
                    return d > 200;
                case 'dance':
                    return d > 240;
                default:
                    return true;
            }
        }
        chooseAttack() {
            const d = this.pdist(),
                ph = this.phase - 1;

            if (!this.bag.length) this.bag = shuffle(BAGS[ph].slice());

            let i = this.bag.findIndex((a) => a !== this.lastAtk && this.suits(a, d));

            if (i < 0) i = this.bag.findIndex((a) => a !== this.lastAtk);
            if (i < 0) i = 0;

            const a = this.bag.splice(i, 1)[0];

            this.lastAtk = a;
            this.combo = 0;
            this.face();

            if (a === 'embrace' && d > 300) {
                this.pending = a;
                this.walkTo = 240;
                this.setState('walk');

                return;
            }

            this.startAttack(a);
        }
        startTransition() {
            this.bag = [];
            this.marker = null;
            this.climb = null;
            this.crawl = false;
            this.red = 0;

            super.startTransition();
        }
        startAttack(a) {
            const g = this.game;

            this.face();
            this.vx = 0;
            this.ev = {};

            switch (a) {
                case 'reach':
                    this.reachN = 0;
                    this.setState('reach_wind');
                    this.pose = 'reach_tell';
                    this.glint = 1;
                    BW.Audio.play('windup', { rate: 0.6, vol: 0.9 });
                    break;
                case 'needles':
                    this.setState('needles_wind');
                    this.pose = 'needle_tell';
                    this.glint = 1;
                    BW.Audio.play('windup', { rate: 0.5, vol: 1 });
                    BW.Audio.play('clink', { rate: 0.4, vol: 0.35 });
                    break;
                case 'veil':
                    this.setState('veil_wind');
                    this.pose = 'veil_tell';
                    this.glint = 1;
                    BW.Audio.play('windup', { rate: 0.7, vol: 0.8 });
                    break;
                case 'rush':
                    this.setState('rush_wind');
                    this.pose = 'scuttle';
                    this.sy = 0.94;
                    BW.Audio.play('boss_charge', { vol: 0.8, rate: 1.15 });
                    break;
                case 'hush':
                    this.setState('hush_wind');
                    this.pose = 'hush';
                    BW.Audio.play('boss_roar', { vol: 0.55, rate: 0.6 });
                    BW.Audio.play('bell', { pitch: 49, vol: 0.8, minGap: 0 });
                    BW.Audio.duckMusic(0.15, TUNE.hush.wind + 2.4);
                    break;
                case 'drop':
                    this.startDrop(false);
                    break;
                case 'crawl':
                    this.startDrop(true);
                    break;
                case 'darts':
                    this.setState('darts_wind');
                    this.pose = 'veil_tell';
                    this.glint = 1;
                    BW.Audio.play('windup', { rate: 0.85, vol: 0.8 });
                    break;
                case 'stalk':
                    this.setState('stalk_wind');
                    this.pose = 'needle_tell';
                    this.glint = 1;
                    BW.Audio.play('windup', { rate: 0.45, vol: 1 });
                    break;
                case 'dance':
                    this.setState('dance_wind');
                    this.pose = 'scuttle';
                    this.sy = 0.92;
                    BW.Audio.play('boss_charge', { vol: 0.8, rate: 1.3 });
                    break;
                case 'pounce':
                    this.pounceN = 0;
                    this.setState('pounce_wind');
                    this.pose = 'scuttle';
                    this.sy = 0.92;
                    BW.Audio.play('windup', { rate: 0.55, vol: 0.9 });
                    break;
                case 'embrace':
                    this.setState('embrace_wind');
                    this.pose = 'embrace_tell';
                    BW.Audio.play('boss_roar', { vol: 0.5, rate: 0.55 });
                    BW.Audio.play('boss_charge', { vol: 0.7, rate: 0.7 });

                    if (!this.hinted && BW.settings.hints !== false) {
                        this.hinted = true;
                        g.hud.toast('Mourning Embrace', 'It cannot be parried. Shadow Step it, or get clear.', 3);
                    }

                    break;
            }
        }

        // ---------------------------------------------------------------- behaviour
        think(dt) {
            super.think(dt);

            const g = this.game,
                p = g.player,
                s = this.state,
                t = this.stateT,
                ph = this.phase - 1,
                K = TUNE;

            this.red = BW.damp(this.red, RED_IN[s] || 0, 6, dt);

            switch (s) {
                case 'rise':
                    this.pose = t < 0.45 ? 'rise' : t < 1.1 ? 'hush' : 'idle';
                    return;
                // ---- long reach: one arm shoots out along the floor while it lunges after you (twice in phase two)
                case 'reach_wind':
                    this.vx = 0;
                    this.sx = BW.damp(this.sx, 0.96, 6, dt);

                    if (t >= (this.reachN ? K.reach.rewind : K.reach.wind[ph])) {
                        this.setState('reach');
                        this.pose = 'reach_strike';
                        this.vx = this.facing * K.reach.lunge;
                        BW.Audio.play('boss_sweep', { rate: 0.75, vary: 0.06 });
                        g.fx.shake(5, 0.15);

                        g.fx.slash(this.cx + this.facing * 150, this.y + this.h - 150, 'side', this.facing, {
                            r: 190,
                            w: 30,
                            life: 0.24,
                            color: '#e6f6ff',
                            edge: '#7cc8ff',
                        });
                    }

                    return;
                case 'reach':
                    if (t > 0.14) this.vx = 0;

                    if (t >= 0.22) {
                        this.setState('reach_rec');
                        this.vx = 0;
                    }

                    return;
                case 'reach_rec':
                    this.vx = 0;
                    this.pose = 'reach_recover';

                    if (this.phase === 2 && this.reachN < 2 && !this.combo && t >= 0.24) {
                        this.reachN++;
                        this.face();
                        this.setState('reach_wind');
                        this.pose = 'reach_tell';
                        this.glint = 1;
                        BW.Audio.play('windup', { rate: 0.85, vol: 0.8 });

                        return;
                    }

                    if (t > K.reach.rec[ph] * 0.6) this.pose = 'idle';
                    if (t >= K.reach.rec[ph]) this.toIdle();
                    return;
                // ---- needle garden: the arm is driven into the floor and needles burst up in a travelling row
                case 'needles_wind':
                    this.vx = 0;
                    this.sy = BW.damp(this.sy, 1.03, 5, dt);

                    if (t >= K.needles.wind[ph]) {
                        this.setState('needles');
                        this.pose = 'needle_plant';
                        this.needleGarden();
                    }

                    return;
                case 'needles':
                    if (t >= 0.25) this.setState('needles_rec');
                    return;
                case 'needles_rec':
                    this.vx = 0;

                    if (t > K.needles.rec[ph] * 0.55) this.pose = 'idle';
                    if (t >= K.needles.rec[ph]) this.toIdle();
                    return;
                // ---- veil net: it flings its veil as a net of threads with one opening, low or high
                case 'veil_wind':
                    this.vx = 0;
                    this.sx = BW.damp(this.sx, 0.95, 6, dt);

                    if (t >= K.veil.wind[ph]) {
                        this.setState('veil_cast');
                        this.pose = 'veil_cast';
                        this.castVeil();
                    }

                    return;
                case 'veil_cast':
                    if (t >= 0.3) this.setState('veil_rec');
                    return;
                case 'veil_rec':
                    this.vx = 0;

                    if (t > K.veil.rec[ph] * 0.55) this.pose = 'idle';
                    if (t >= K.veil.rec[ph]) this.toIdle();
                    return;
                // ---- scuttle rush: folds low and crabs across the floor; a wall stops it and it reels
                case 'rush_wind':
                    this.vx = 0;
                    this.sy = BW.damp(this.sy, 0.9, 8, dt);
                    this.dust(dt, 30, 160);

                    if (t >= K.rush.wind[ph]) {
                        this.setState('rush');
                        this.pose = 'scuttle';
                        BW.Audio.play('dash', { rate: 0.5, vol: 0.9 });
                    }

                    return;
                case 'rush':
                    this.vx = this.facing * K.rush.speed[ph];
                    this.dust(dt, 45, 140);

                    if (this.nearWall(this.facing, 6)) this.chargeImpact();
                    else if (t > K.rush.time[ph]) {
                        this.vx = 0;
                        this.setState('rush_rec');
                    }

                    return;
                case 'rush_rec':
                    this.vx = 0;

                    if (t > 0.3) this.pose = 'idle';
                    if (t >= K.rush.rec[ph]) this.toIdle();
                    return;
                // ---- silent wail (phase two): the music dies and two waves of silence roll out, then an echo
                case 'hush_wind':
                    this.vx = 0;

                    if (Math.random() < dt * 8) g.fx.shake(3, 0.1);

                    if (!this.ev.r1 && t > 0.3) {
                        this.ev.r1 = 1;
                        g.fx.ring(this.cx, this.y + 60, 20, 300, 0.7, '#9fd8ff', 3);
                    }

                    if (t >= K.hush.wind) {
                        this.setState('hush');
                        this.ev.e = 0;
                        g.fx.shake(7, 0.35);
                        g.fx.flash('#cfeaff', 0.16);
                        BW.Audio.play('boss_wave', { vol: 0.4, rate: 0.6 });
                        this.hushWaves();
                    }

                    return;
                case 'hush': {
                    const E = K.hush.echoes;

                    if (this.ev.e < E.length && t >= E[this.ev.e]) this.hushWaves(++this.ev.e);

                    if (t >= E[E.length - 1] + 0.4) this.setState('hush_rec');
                    return;
                }
                case 'hush_rec':
                    this.vx = 0;
                    this.pose = t < 0.5 ? 'hush' : 'idle';

                    if (t >= K.hush.rec) this.toIdle(0.3);
                    return;
                // ---- ceiling drop (phase two): up the wall, along the ceiling after you, then straight down
                case 'drop_climb': {
                    const u = Math.min(1, t / K.drop.climb);

                    this.y = BW.lerp(this.climb.y0, this.climb.y1, 1 - (1 - u) * (1 - u));
                    this.vx = 0;
                    this.vy = 0;

                    if (u >= 1 && this.crawl) {
                        this.setState('crawl_run');
                        this.pose = 'cling';
                        this.crawlDir = p.cx >= this.cx ? 1 : -1;
                        this.ev = { n: 0 };
                        BW.Audio.play('boss_step', { vol: 0.7, rate: 0.7 });
                        g.fx.shake(4, 0.2);
                    } else if (u >= 1) {
                        this.setState('drop_cling');
                        this.pose = 'cling';
                        this.lock = false;
                        this.marker = { x: this.cx, t: 0 };
                        BW.Audio.play('boss_step', { vol: 0.7, rate: 0.7 });
                        g.fx.shake(4, 0.2);
                    }

                    return;
                }
                case 'drop_cling': {
                    this.y = this.ceilY;
                    this.vx = 0;
                    this.vy = 0;
                    this.face();

                    if (t < K.drop.crawl) {
                        const tgt = BW.clamp(p.cx + p.vx * 0.3, this.ax0 + 80, this.ax1 - 80),
                            step = BW.clamp(tgt - this.cx, -K.drop.speed * dt, K.drop.speed * dt);

                        this.x += step;
                        this.marker.x = this.cx;

                        if (Math.random() < dt * 14)
                            g.fx.spawn({
                                x: this.cx + BW.rand(-30, 30),
                                y: this.ceilY + BW.rand(60, 160),
                                vx: BW.rand(-15, 15),
                                vy: BW.rand(40, 120),
                                life: 0.6,
                                size: 2,
                                color: '#9fd8ff',
                                kind: 'glow',
                                add: true,
                                drag: 0.5,
                            });
                    } else this.lock = true;

                    if (t >= K.drop.crawl + K.drop.lock) {
                        this.setState('drop_fall');
                        this.pose = 'drop';
                        this.vy = 0;
                        this.lock = false;
                        BW.Audio.play('dash', { rate: 0.4, vol: 0.9 });
                    }

                    return;
                }
                case 'drop_fall':
                    this.vy += 3800 * dt;
                    this.y += this.vy * dt;
                    this.vx = 0;

                    if (this.y >= this.floorY - this.h) this.landDrop();
                    return;
                case 'drop_land':
                    if (t >= 0.16) this.setState('drop_rec');
                    return;
                case 'drop_rec':
                    this.vx = 0;

                    if (t > 0.3) this.pose = 'idle';
                    if (t >= K.drop.rec) this.toIdle(0.3);
                    return;
                // ---- pounce (phase two): coils low, then springs across the arena at where you stood (twice)
                case 'pounce_wind':
                    this.vx = 0;
                    this.sy = BW.damp(this.sy, 0.9, 8, dt);
                    this.dust(dt, 25, 120);

                    if (t >= (this.pounceN ? 0.3 : K.pounce.wind)) this.startPounce();
                    return;
                case 'pounce_air': {
                    const L = this.leap,
                        u = Math.min(1, t / L.T);

                    if (u < 0.4) {
                        L.tx = BW.clamp(p.cx, this.ax0 + 80, this.ax1 - 80);
                        this.marker.x = L.tx;
                    }

                    this.x = BW.lerp(L.x0, L.tx, u) - this.w / 2;
                    this.y = this.floorY - this.h - L.H * 4 * u * (1 - u);
                    this.facing = L.tx >= L.x0 ? 1 : -1;

                    if (u >= 1) this.landPounce();
                    return;
                }
                case 'pounce_land':
                    if (t >= 0.14) this.setState('pounce_rec');
                    return;
                case 'pounce_rec':
                    this.vx = 0;

                    if (t > 0.2) this.pose = 'idle';

                    if (!this.combo && this.pounceN < 1 && t >= 0.25) {
                        this.pounceN = 1;
                        this.face();
                        this.setState('pounce_wind');
                        this.pose = 'scuttle';
                        BW.Audio.play('windup', { rate: 0.65, vol: 0.8 });

                        return;
                    }

                    // after the second pounce it is already on top of you: often straight into the Embrace
                    if (!this.combo && this.pounceN === 1 && t >= 0.25 && this.pdist() < 420 && Math.random() < 0.65) {
                        this.pounceN = 2;
                        this.chain = true;
                        this.face();
                        this.startAttack('embrace');

                        return;
                    }

                    if (t >= K.pounce.rec) this.toIdle();
                    return;
                // ---- thread darts: aimed black darts flung one after another from its veil
                case 'darts_wind':
                    this.vx = 0;
                    this.sx = BW.damp(this.sx, 0.95, 6, dt);

                    if (t >= K.darts.wind[ph]) {
                        this.setState('darts');
                        this.pose = 'veil_cast';
                        this.ev = { n: 0 };
                        BW.Audio.play('boss_sweep', { rate: 1.2, vol: 0.7 });
                    }

                    return;
                case 'darts': {
                    const D = K.darts;

                    this.vx = 0;

                    while (this.ev.n < D.n[ph] && t >= this.ev.n * D.gap[ph]) this.fireDart(this.ev.n++);

                    if (this.ev.n >= D.n[ph] && t >= D.n[ph] * D.gap[ph] + 0.15) this.setState('darts_rec');
                    return;
                }
                case 'darts_rec':
                    this.vx = 0;

                    if (t > 0.35) this.pose = 'idle';
                    if (t >= K.darts.rec[ph]) this.toIdle();
                    return;
                // ---- stalking needles: it plants its arm and needles keep bursting up under your feet
                case 'stalk_wind':
                    this.vx = 0;
                    this.sy = BW.damp(this.sy, 1.03, 5, dt);

                    if (t >= K.stalk.wind[ph]) {
                        this.setState('stalk');
                        this.pose = 'needle_plant';
                        this.ev = { n: 0 };
                        BW.Audio.play('boss_slam', { rate: 0.8, vol: 0.7 });
                        g.fx.shake(4, 0.2);
                    }

                    return;
                case 'stalk': {
                    const S = K.stalk;

                    this.vx = 0;

                    while (this.ev.n < S.n[ph] && t >= this.ev.n * S.step[ph]) this.stalkSpike(this.ev.n++);

                    if (this.ev.n >= S.n[ph] && t >= S.n[ph] * S.step[ph] + 0.2) this.setState('stalk_rec');
                    return;
                }
                case 'stalk_rec':
                    this.vx = 0;

                    if (t > K.stalk.rec[ph] * 0.55) this.pose = 'idle';
                    if (t >= K.stalk.rec[ph]) this.toIdle();
                    return;
                // ---- overhead crawl (phase two): races along the ceiling dropping needles, then falls
                case 'crawl_run': {
                    const C = K.crawl;

                    this.y = this.ceilY;
                    this.vx = 0;
                    this.vy = 0;
                    this.facing = this.crawlDir;
                    this.x = BW.clamp(this.x + this.crawlDir * C.speed * dt, this.ax0, this.ax1 - this.w);

                    while (t >= this.ev.n * C.needleGap) {
                        this.ev.n++;
                        this.dropNeedle();
                    }

                    if (t >= C.max || this.nearWall(this.crawlDir, 8)) {
                        this.crawl = false;
                        this.setState('drop_fall');
                        this.pose = 'drop';
                        this.vy = 0;
                        BW.Audio.play('dash', { rate: 0.4, vol: 0.9 });
                    }

                    return;
                }
                // ---- scuttle dance (phase two): rushes at you, turns on the spot and rushes again, three times over
                case 'dance_wind':
                    this.vx = 0;
                    this.sy = BW.damp(this.sy, 0.9, 8, dt);
                    this.dust(dt, 30, 160);

                    if (t >= K.dance.wind) {
                        this.setState('dance');
                        this.pose = 'scuttle';
                        this.ev = { leg: 1, lt: 0, pause: 0 };
                        BW.Audio.play('dash', { rate: 0.55, vol: 0.9 });
                    }

                    return;
                case 'dance': {
                    const D = K.dance;

                    if (this.ev.pause > 0) {
                        this.ev.pause -= dt;
                        this.vx = 0;

                        return;
                    }

                    this.vx = this.facing * D.speed;
                    this.ev.lt += dt;
                    this.dust(dt, 45, 140);

                    const wall = this.nearWall(this.facing, 6);

                    if (wall || this.ev.lt >= D.leg) {
                        this.vx = 0;

                        if (this.ev.leg >= D.legs) {
                            this.setState('dance_rec');

                            return;
                        }

                        if (wall) {
                            g.fx.shake(6, 0.2);
                            BW.Audio.play('boss_step', { vol: 0.8, rate: 0.8 });
                        }

                        this.ev.leg++;
                        this.ev.lt = 0;
                        this.ev.pause = 0.14;
                        this.face();
                        BW.Audio.play('dash', { rate: 0.6, vol: 0.8 });
                    }

                    return;
                }
                case 'dance_rec':
                    this.vx = 0;

                    if (t > 0.3) this.pose = 'idle';
                    if (t >= 0.9) this.toIdle();
                    return;
                // ---- mourning embrace (phase two): arms flung wide with a red glow, then a crushing lunge (Shadow Step only)
                case 'embrace_wind':
                    this.vx = 0;
                    this.sx = BW.damp(this.sx, 0.97, 5, dt);

                    if (t > this.embraceWind() * 0.55 && Math.random() < dt * 20)
                        g.fx.spawn({
                            x: this.cx + this.facing * BW.rand(60, 170),
                            y: this.y + this.h - BW.rand(150, 300),
                            vx: BW.rand(-20, 20),
                            vy: BW.rand(-60, -20),
                            life: 0.5,
                            size: 2.2,
                            color: '#ff5a4a',
                            kind: 'glow',
                            add: true,
                            drag: 0.6,
                        });

                    if (t >= this.embraceWind()) {
                        this.setState('embrace');
                        this.pose = 'embrace_strike';
                        this.vx = this.facing * K.embrace.speed;
                        BW.Audio.play('boss_slam', { rate: 0.7, vol: 0.9 });
                        g.fx.shake(8, 0.25);
                    }

                    return;
                case 'embrace':
                    this.vx = t < 0.18 ? this.facing * K.embrace.speed : 0;

                    if (t >= K.embrace.lunge) {
                        this.setState('embrace_rec');
                        this.vx = 0;
                    }

                    return;
                case 'embrace_rec':
                    this.vx = 0;

                    if (t > 0.6) this.pose = 'idle';
                    if (t >= K.embrace.rec) this.toIdle(0.35);
                    return;
            }
        }

        physics(dt) {
            if (AIR[this.state]) return;

            super.physics(dt);
        }
        // light dust at its feet, thrown back from the way it is facing
        dust(dt, rate, speed) {
            if (Math.random() >= dt * rate) return;

            this.game.fx.burst(this.cx - this.facing * 50, this.floorY, 2, {
                color: [this.game.room.area.moss, '#999'],
                speed,
                angle: -Math.PI / 2 - this.facing * 0.8,
                spread: 0.8,
                life: 0.4,
                grav: 500,
                size: 3,
            });
        }

        // needle garden: a row of needles marching toward (and past) the player; phase two adds one aimed at you
        needleGarden() {
            const g = this.game,
                ph = this.phase - 1,
                K = TUNE.needles,
                p = g.player;

            BW.Audio.play('boss_slam', { rate: 0.9, vol: 0.8 });
            g.fx.shake(6, 0.25);
            g.fx.ring(this.cx + this.facing * 90, this.floorY - 8, 8, 130, 0.35, '#9fd8ff', 3);

            for (let i = 0; i < K.n[ph]; i++) {
                const x = this.cx + this.facing * (90 + i * K.gap);

                if (x < this.ax0 + 20 || x > this.ax1 - 20) break;

                g.spawnHazard(new NeedleSpike(g, x, this.floorY, i * K.step[ph], { tele: K.tele[ph], h: K.h }));
            }

            if (this.phase === 2 && p.state !== 'dead') {
                const x = BW.clamp(p.cx + p.vx * 0.2, this.ax0 + 30, this.ax1 - 30);

                g.spawnHazard(new NeedleSpike(g, x, this.floorY, 0.7, { tele: K.tele[ph], h: K.h }));
            }
        }
        // veil net: the opening is low (stay on the ground) or high (jump into it)
        castVeil() {
            const g = this.game,
                ph = this.phase - 1;

            BW.Audio.play('boss_sweep', { rate: 0.55, vol: 0.8 });
            g.fx.shake(5, 0.2);

            g.spawnHazard(
                new VeilNet(g, this.cx + this.facing * 80, this.floorY, this.facing, {
                    speed: TUNE.veil.speed[ph],
                    high: Math.random() < 0.5,
                    ax0: this.ax0,
                    ax1: this.ax1,
                }),
            );
        }
        // `echo` 0 is the wail itself; every echo rolls out a little faster
        hushWaves(echo = 0) {
            const g = this.game,
                speed = TUNE.hush.speed[this.phase - 1] * (1 + echo * 0.12);

            for (const d of [-1, 1])
                g.spawnHazard(new HushWave(g, this.cx + d * 70, this.floorY, d, { speed, h: TUNE.hush.h }));

            g.fx.ring(this.cx, this.floorY - 20, 10, 220, 0.5, '#9fd8ff', 3);
        }

        // thread darts: aimed at where you are now, a little ahead of where you are going
        fireDart() {
            const g = this.game,
                p = g.player,
                o = this.framePoint(this.cx, this.y + this.h, 0.95, 0.33),
                dx = p.cx + p.vx * 0.12 - o.x,
                dy = p.y + p.h * 0.5 - o.y,
                d = Math.hypot(dx, dy) || 1,
                v = TUNE.darts.speed[this.phase - 1];

            g.spawnHazard(new ThreadDart(g, o.x, o.y, (dx / d) * v, (dy / d) * v));
            BW.Audio.play('silk_volley', { vol: 0.35, rate: 1.5, minGap: 0.05 });
        }
        // stalking needles: one under where you are heading
        stalkSpike() {
            const g = this.game,
                p = g.player,
                K = TUNE.stalk,
                x = BW.clamp(p.cx + p.vx * 0.35, this.ax0 + 30, this.ax1 - 30);

            g.spawnHazard(new NeedleSpike(g, x, this.floorY, 0, { tele: K.tele[this.phase - 1], h: K.h }));
        }
        // overhead crawl: a needle drops from the ceiling where it is now
        dropNeedle() {
            const g = this.game;

            g.spawnHazard(new FallingNeedle(g, this.cx, this.ceilY + 30, this.floorY, TUNE.crawl.tele));
        }

        // ---- ceiling drop
        ceilingAt(x) {
            const room = this.game.room;
            let y = this.floorY - 20;

            while (y > 0 && !room.solidPx(x, y)) y -= T / 2;

            return Math.max(0, Math.floor(y / T) + 1) * T;
        }
        startDrop(crawl) {
            const g = this.game;

            this.crawl = !!crawl;
            this.ceilY = this.ceilingAt(this.cx);
            this.climb = { y0: this.y, y1: this.ceilY };
            this.setState('drop_climb');
            this.pose = 'pounce';
            this.sy = 1.08;
            this.marker = null;
            BW.Audio.play('dash', { rate: 0.45, vol: 0.9 });
            g.fx.shake(4, 0.15);
            this.dust(1, 1000, 260);
        }
        landDrop() {
            const g = this.game;

            this.y = this.floorY - this.h;
            this.vy = 0;
            this.onGround = true;
            this.marker = null;
            this.setState('drop_land');
            this.pose = 'land';
            this.sy = 0.88;
            this.sx = 1.08;
            BW.Audio.play('boss_slam', { rate: 1.05 });
            g.fx.shake(14, 0.45);
            g.hitstop(0.05);

            g.fx.burst(this.cx, this.floorY, 30, {
                color: ['#c9c2b0', '#efe6d2', '#8a8478'],
                speed: 420,
                angle: -Math.PI / 2,
                spread: 2.8,
                life: 0.8,
                grav: 1100,
                size: 5,
            });

            // a halo of needles around the landing, and stone shaken loose from the vault
            for (const [i, off] of [-270, -170, 170, 270].entries())
                g.spawnHazard(new NeedleSpike(g, this.cx + off, this.floorY, (i % 2) * 0.08, { tele: 0.35, h: 130 }));

            this.dropDebris(3, true);
        }

        // ---- pounce
        startPounce() {
            const g = this.game,
                p = g.player,
                tx = BW.clamp(p.cx, this.ax0 + 80, this.ax1 - 80);

            this.leap = { x0: this.cx, tx, T: TUNE.pounce.air * (this.pounceN ? 0.85 : 1), H: TUNE.pounce.height };
            this.marker = { x: tx, t: 0 };
            this.setState('pounce_air');
            this.pose = 'pounce';
            this.sy = 1.06;
            this.onGround = false;
            BW.Audio.play('dash', { rate: 0.5, vol: 0.9 });
            g.fx.shake(4, 0.15);
            this.dust(1, 1000, 240);
        }
        landPounce() {
            const g = this.game;

            this.y = this.floorY - this.h;
            this.vy = 0;
            this.onGround = true;
            this.marker = null;
            this.setState('pounce_land');
            this.pose = 'land';
            this.sy = 0.9;
            this.sx = 1.06;
            BW.Audio.play('boss_slam', { rate: 1.2, vol: 0.9 });
            g.fx.shake(10, 0.3);

            g.fx.burst(this.cx, this.floorY, 22, {
                color: ['#c9c2b0', '#efe6d2', '#8a8478'],
                speed: 380,
                angle: -Math.PI / 2,
                spread: 2.6,
                life: 0.7,
                grav: 1100,
                size: 4,
            });

            for (const d of [-1, 1])
                g.spawnHazard(new HushWave(g, this.cx + d * 90, this.floorY, d, { speed: 380, h: 60 }));
        }

        // ---------------------------------------------------------------- drawing
        frame() {
            const s = BW.Assets.sprite('mourner_' + this.poseName());

            return s ? { s, f: s.frames[0] } : null;
        }
        // where the wind-up glint shows, relative to the anchor (facing right, before scaling by facing)
        glintAt() {
            const spot = GLINT_AT[this.pose],
                fr = this.frame();

            if (!spot || !fr) return undefined;

            return [(spot[0] * fr.f[2] - fr.f[4]) * fr.s.scale, (spot[1] * fr.f[3] - fr.f[5]) * fr.s.scale];
        }
        framePoint(x, y, u, v) {
            const fr = this.frame();

            if (!fr) return { x, y };

            return {
                x: x + (u * fr.f[2] - fr.f[4]) * fr.s.scale * this.facing,
                y: y + (v * fr.f[3] - fr.f[5]) * fr.s.scale,
            };
        }

        draw(ctx, alpha) {
            const g = this.game,
                s = this.state;

            const x = BW.lerp(this.px, this.x, alpha) + this.w / 2,
                top = BW.lerp(this.py, this.y, alpha);

            let y = top + this.h;

            // floor marker for the pounce and the drop (drawn first, under everything)
            if (this.marker) {
                const m = this.marker,
                    k = 0.6 + Math.sin(g.time * (this.lock ? 34 : 18)) * 0.25;

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.55 * k;
                ctx.drawImage(BW.glowSprite('#7cc8ff'), m.x - 130, this.floorY - 40, 260, 70);
                ctx.strokeStyle = `rgba(200,236,255,${0.7 * k})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(m.x, this.floorY - 3, 118, 12, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                g.addLight(m.x, this.floorY - 30, 160, '#7cc8ff', 0.35);
            }

            let pose = this.poseName(),
                ox = 0,
                rot = 0;

            if (s === 'walk') {
                const ph = this.walkDist / 80;

                pose = Math.floor(ph) % 2 ? 'walk' : 'idle';
                y -= Math.abs(Math.sin(ph * Math.PI)) * 5;
                rot = Math.sin(ph * Math.PI) * 0.015 * this.facing;
            }

            if (s === 'embrace_wind' || s === 'rush_wind' || (s === 'transition' && this.stateT < 1.5))
                ox = (Math.random() * 2 - 1) * 2.5;

            const hang = pose === 'cling',
                oy = hang ? top : y,
                idle = s === 'idle' ? 1 + Math.sin(this.t * 1.7) * 0.01 : 1;

            ctx.save();

            if (s === 'remains') ctx.globalAlpha = 0.8;

            const ok = BW.Assets.draw(ctx, 'mourner_' + pose, 0, x + ox, oy, {
                flip: this.facing < 0,
                sx: this.sx,
                sy: this.sy * idle,
                rot,
                flash: this.flash,
                rim: 0.34,
            });

            ctx.restore();

            if (!ok) {
                ctx.fillStyle = this.flash > 0.3 ? '#fff' : '#15161c';
                ctx.fillRect(x - this.w / 2, y - this.h, this.w, this.h);
            }

            if (s !== 'remains') g.addLight(x, hang ? top + 200 : y - 150, 230, '#bfe0ff', 0.28);

            // the mask has no eyes: a cold glow leaks from under its edge, stronger in phase two
            const glow = Math.min(1, this.eye + this.introGlow);

            if (glow > 0.02) {
                const e = this.eyePos(x, oy),
                    r = 30 + this.heat * 22 + this.introGlow * 14;

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = glow * (0.5 + 0.3 * this.heat);
                ctx.drawImage(BW.glowSprite('#7cc8ff'), e.x - r, e.y - r, r * 2, r * 2);
                ctx.restore();
                g.addLight(e.x, e.y, 90 + this.heat * 50, '#7cc8ff', 0.35 * glow);
            }

            // the Embrace's tell: a blood-red glow gathering in its open palms (and where they close)
            if (this.red > 0.03) {
                const spots =
                    pose === 'embrace_strike'
                        ? [[0.55, 0.45]]
                        : [
                              [0.05, 0.12],
                              [0.95, 0.68],
                          ];

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                for (const [u, v] of spots) {
                    const pt = this.framePoint(x, oy, u, v),
                        r = 40 + Math.sin(g.time * 22) * 6;

                    ctx.globalAlpha = Math.min(1, this.red);
                    ctx.drawImage(BW.glowSprite('#ff3a2a'), pt.x - r, pt.y - r, r * 2, r * 2);
                    g.addLight(pt.x, pt.y, 130, '#ff3a2a', 0.45 * this.red);
                }

                ctx.restore();
            }

            this.drawOverlays(ctx, x, oy);
        }

        die() {
            const g = this.game;

            g.hazards = g.hazards.filter((h) => !OWN_HAZARDS.some((C) => h instanceof C));
            this.red = 0;
            this.climb = null;

            super.die();
        }
    }

    // ==================================================================== hazards

    // Needle Garden: the floor cracks with a cold glow, then a black needle bursts up. Step into a gap, or jump it.
    class NeedleSpike extends Hazard {
        constructor(game, x, floorY, delay, o) {
            super(game);
            this.dmg = 1;
            this.x = x;
            this.fy = floorY;
            this.delay = delay;
            this.tele = o.tele;
            this.h = o.h;
            this.w = 30;
            this.live = 0.34;
            this.went = false;
        }
        rise() {
            const a = this.t - this.delay - this.tele;

            if (a < 0 || a > this.live) return 0;

            return Math.min(1, a / 0.08) * Math.min(1, (this.live - a) / 0.1);
        }
        boxes() {
            const k = this.rise();

            return k > 0.15 ? [{ x: this.x - this.w / 2, y: this.fy - this.h * k, w: this.w, h: this.h * k }] : null;
        }
        hitX() {
            return this.x;
        }
        update(dt) {
            super.update(dt);

            if (this.t < this.delay) return;

            const g = this.game;

            if (!this.warned) {
                this.warned = true;
                BW.Audio.play('debris', { vol: 0.3, rate: 0.9, minGap: 0.06 });
            }

            if (!this.went && this.t >= this.delay + this.tele) {
                this.went = true;
                BW.Audio.play('clink', { vol: 0.5, rate: 1.5, minGap: 0.05 });
                g.fx.shake(3, 0.12);

                g.fx.burst(this.x, this.fy - 6, 10, {
                    color: ['#7cc8ff', '#e6f6ff', '#2a2f3a'],
                    kind: 'shard',
                    speed: 340,
                    angle: -Math.PI / 2,
                    spread: 0.8,
                    life: 0.5,
                    grav: 1100,
                    size: 3,
                });
            }

            if (this.t > this.delay + this.tele + this.live + 0.3) this.dead = true;
        }
        draw(ctx) {
            const k = this.t - this.delay;

            if (k < 0) return;

            const x = this.x,
                y = this.fy;

            ctx.save();

            if (k < this.tele) {
                const u = k / this.tele;

                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = (0.3 + 0.55 * u) * (0.8 + Math.sin(this.t * 30) * 0.2);
                ctx.drawImage(BW.glowSprite('#7cc8ff'), x - 40, y - 20, 80, 32);
                ctx.globalAlpha = 0.4 + 0.5 * u;
                ctx.strokeStyle = '#cfeaff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x - 20, y - 2);
                ctx.lineTo(x - 6, y - 5 - u * 5);
                ctx.lineTo(x + 2, y - 1);
                ctx.lineTo(x + 20, y - 4);
                ctx.stroke();
                this.game.addLight(x, y - 10, 70, '#7cc8ff', 0.28 * u);
            } else {
                const r = this.rise(),
                    H = this.h * r,
                    hw = this.w / 2;

                if (r > 0) {
                    ctx.beginPath();
                    ctx.moveTo(x - hw, y);
                    ctx.lineTo(x - hw * 0.55, y - H * 0.7);
                    ctx.lineTo(x, y - H);
                    ctx.lineTo(x + hw * 0.55, y - H * 0.7);
                    ctx.lineTo(x + hw, y);
                    ctx.closePath();
                    ctx.fillStyle = '#0d0e14';
                    ctx.fill();
                    ctx.strokeStyle = '#7cc8ff';
                    ctx.lineWidth = 1.6;
                    ctx.stroke();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = 0.8;
                    ctx.drawImage(BW.glowSprite('#bfe8ff'), x - 16, y - H - 14, 32, 32);
                    this.game.addLight(x, y - H, 90, '#7cc8ff', 0.4 * r);
                }
            }

            ctx.restore();
        }
    }

    // Veil Net: a wall of black thread sweeps across the arena with one opening, low (stay down) or high (jump).
    class VeilNet extends Hazard {
        constructor(game, x, floorY, dir, o) {
            super(game);
            this.dmg = 1;
            this.x = x;
            this.fy = floorY;
            this.dir = dir;
            this.speed = o.speed;
            this.ax0 = o.ax0;
            this.ax1 = o.ax1;
            this.w = 84;
            this.top = floorY - 440;

            // the opening as [top, bottom] y values
            this.gap = o.high ? [floorY - 270, floorY - 100] : [floorY - 120, floorY];
        }
        boxes() {
            if (this.t < 0.12) return null;

            const x = this.x - this.w / 2,
                out = [{ x, y: this.top, w: this.w, h: this.gap[0] - this.top }];

            if (this.gap[1] < this.fy) out.push({ x, y: this.gap[1], w: this.w, h: this.fy - this.gap[1] });

            return out;
        }
        hitX() {
            return this.x - this.dir * 20;
        }
        update(dt) {
            super.update(dt);

            this.x += this.dir * this.speed * dt;

            if (this.x < this.ax0 - 80 || this.x > this.ax1 + 80 || this.t > 6) this.dead = true;

            if (Math.random() < dt * 30)
                this.game.fx.spawn({
                    x: this.x + BW.rand(-30, 30),
                    y: BW.rand(this.top, this.fy),
                    vx: -this.dir * BW.rand(20, 70),
                    vy: BW.rand(-20, 30),
                    life: 0.5,
                    size: 2,
                    color: '#9fd8ff',
                    kind: 'glow',
                    add: true,
                    drag: 1,
                });
        }
        draw(ctx) {
            const a = Math.min(1, this.t / 0.2),
                hw = this.w / 2;

            ctx.save();
            ctx.globalAlpha = a;

            // threads: two curtains of long strands, leaving the opening bare
            ctx.lineWidth = 2;

            for (let i = 0; i < 9; i++) {
                const sx = this.x - hw + (i / 8) * this.w + Math.sin(this.t * 9 + i) * 3;

                ctx.strokeStyle = 'rgba(9,10,15,0.9)';
                ctx.beginPath();
                ctx.moveTo(sx, this.top);
                ctx.lineTo(sx, this.gap[0]);

                if (this.gap[1] < this.fy) {
                    ctx.moveTo(sx, this.gap[1]);
                    ctx.lineTo(sx, this.fy);
                }

                ctx.stroke();
            }

            ctx.lineWidth = 1.5;

            for (let y = this.top; y < this.fy; y += 20) {
                if (y > this.gap[0] - 4 && y < this.gap[1] + 4) continue;

                const sag = Math.sin(this.t * 7 + y * 0.05) * 4;

                ctx.strokeStyle = 'rgba(9,10,15,0.85)';
                ctx.beginPath();
                ctx.moveTo(this.x - hw, y);
                ctx.quadraticCurveTo(this.x, y + sag - this.dir * 10, this.x + hw, y);
                ctx.stroke();
            }

            // the opening: a calm pale-blue lane, brighter at its two edges
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.7 * a;
            ctx.drawImage(BW.glowSprite('#9fd8ff'), this.x - 60, this.gap[0] - 10, 120, this.gap[1] - this.gap[0] + 20);
            ctx.strokeStyle = 'rgba(207,234,255,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - hw, this.gap[0]);
            ctx.lineTo(this.x + hw, this.gap[0]);
            ctx.moveTo(this.x - hw, this.gap[1]);
            ctx.lineTo(this.x + hw, this.gap[1]);
            ctx.stroke();
            ctx.restore();
            this.game.addLight(this.x, (this.gap[0] + this.gap[1]) / 2, 150, '#9fd8ff', 0.4 * a);
        }
    }

    // Silent Wail: a low wave of silence rolling along the floor. Jump it.
    class HushWave extends Hazard {
        constructor(game, x, floorY, dir, o) {
            super(game);
            this.dmg = 1;
            this.x = x;
            this.fy = floorY;
            this.dir = dir;
            this.speed = o.speed;
            this.h = o.h;
            this.fade = null;
        }
        boxes() {
            return this.fade != null ? null : [{ x: this.x - 20, y: this.fy - this.h, w: 40, h: this.h }];
        }
        hitX(p) {
            return p.cx - this.dir * 10;
        }
        update(dt) {
            super.update(dt);

            if (this.fade != null) {
                this.fade -= dt;

                if (this.fade <= 0) this.dead = true;

                return;
            }

            this.x += this.dir * this.speed * dt;

            const room = this.game.room,
                front = this.x + this.dir * 24;

            if (room.solidPx(front, this.fy - 10) || !room.solidPx(front, this.fy + 10) || this.t > 4) this.fade = 0.25;

            if (Math.random() < dt * 40)
                this.game.fx.spawn({
                    x: this.x - this.dir * BW.rand(0, 40),
                    y: this.fy - BW.rand(4, this.h * 0.8),
                    vx: -this.dir * BW.rand(10, 50),
                    vy: BW.rand(-60, -10),
                    life: 0.5,
                    size: BW.rand(1.5, 2.6),
                    color: BW.pick(['#cfeaff', '#7cc8ff']),
                    kind: 'glow',
                    add: true,
                    drag: 1,
                });
        }
        draw(ctx) {
            const a = this.fade != null ? Math.max(0, this.fade / 0.25) : Math.min(1, this.t / 0.08),
                d = this.dir,
                x = this.x,
                y = this.fy,
                H = this.h;

            ctx.save();
            ctx.globalAlpha = a;

            // a dark body of silence with a pale crest and a cold glow
            ctx.fillStyle = 'rgba(8,10,16,0.82)';
            ctx.beginPath();
            ctx.moveTo(x - d * 46, y);
            ctx.quadraticCurveTo(x - d * 10, y - H * 1.05, x + d * 26, y - H * 0.9);
            ctx.quadraticCurveTo(x + d * 12, y - H * 0.4, x + d * 30, y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(207,234,255,0.85)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(BW.glowSprite('#7cc8ff'), x - 60, y - H - 30, 120, H + 50);
            ctx.restore();
            this.game.addLight(x, y - H * 0.5, 100, '#7cc8ff', 0.4 * a);
        }
    }

    // Thread Darts: a black dart on a trail of pale thread, thrown at where you were. Move, jump or dash.
    class ThreadDart extends Hazard {
        constructor(game, x, y, vx, vy) {
            super(game);
            this.dmg = 1;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
        }
        boxes() {
            return [{ x: this.x - 13, y: this.y - 10, w: 26, h: 20 }];
        }
        hitX() {
            return this.x;
        }
        update(dt) {
            super.update(dt);

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (this.game.room.solidPx(this.x, this.y) || this.t > 2.4) {
                this.dead = true;

                this.game.fx.burst(this.x, this.y, 8, {
                    color: ['#9fd8ff', '#e6f6ff'],
                    kind: 'spark',
                    speed: 240,
                    life: 0.3,
                    add: true,
                });

                return;
            }

            if (Math.random() < dt * 50)
                this.game.fx.spawn({
                    x: this.x,
                    y: this.y + BW.rand(-4, 4),
                    vx: BW.rand(-20, 20),
                    vy: BW.rand(-20, 20),
                    life: 0.35,
                    size: 1.8,
                    color: '#9fd8ff',
                    kind: 'glow',
                    add: true,
                    drag: 1,
                });
        }
        draw(ctx) {
            const a = Math.atan2(this.vy, this.vx),
                x = this.x,
                y = this.y;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a);

            // the thread it trails
            const gr = ctx.createLinearGradient(-90, 0, 0, 0);

            gr.addColorStop(0, 'rgba(159,216,255,0)');
            gr.addColorStop(1, 'rgba(207,234,255,0.8)');
            ctx.strokeStyle = gr;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-90, 0);
            ctx.lineTo(0, 0);
            ctx.stroke();

            // the dart
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-4, -6);
            ctx.lineTo(-14, 0);
            ctx.lineTo(-4, 6);
            ctx.closePath();
            ctx.fillStyle = '#0d0e14';
            ctx.fill();
            ctx.strokeStyle = '#7cc8ff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.8;
            ctx.drawImage(BW.glowSprite('#7cc8ff'), -20, -20, 40, 40);
            ctx.restore();
            this.game.addLight(x, y, 70, '#7cc8ff', 0.35);
        }
    }

    // Overhead Crawl: a needle is marked on the floor, then falls from the ceiling. Watch above you.
    class FallingNeedle extends Hazard {
        constructor(game, x, startY, floorY, tele) {
            super(game);
            this.dmg = 1;
            this.x = x;
            this.y = startY;
            this.fy = floorY;
            this.tele = tele;
            this.vy = 0;
            this.mode = 'tele';
            this.life = 0;
        }
        boxes() {
            return this.mode === 'fall' ? [{ x: this.x - 9, y: this.y - 80, w: 18, h: 80 }] : null;
        }
        hitX() {
            return this.x;
        }
        update(dt) {
            super.update(dt);

            const g = this.game;

            if (this.mode === 'tele') {
                if (this.t >= this.tele) {
                    this.mode = 'fall';
                    this.vy = 1900;
                    BW.Audio.play('silk_volley', { vol: 0.25, rate: 1.7, minGap: 0.05 });
                }

                return;
            }

            if (this.mode === 'fall') {
                this.y += this.vy * dt;

                if (this.y >= this.fy) {
                    this.y = this.fy;
                    this.mode = 'done';
                    this.life = 0;
                    BW.Audio.play('clink', { vol: 0.4, rate: 1.4, minGap: 0.05 });

                    g.fx.burst(this.x, this.fy - 4, 8, {
                        color: ['#7cc8ff', '#e6f6ff', '#2a2f3a'],
                        kind: 'shard',
                        speed: 260,
                        angle: -Math.PI / 2,
                        spread: 1.2,
                        life: 0.4,
                        grav: 1000,
                        size: 3,
                    });
                }

                return;
            }

            this.life += dt;

            if (this.life > 0.3) this.dead = true;
        }
        draw(ctx) {
            const x = this.x;

            ctx.save();

            if (this.mode === 'tele') {
                const u = Math.min(1, this.t / this.tele);

                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = (0.3 + 0.6 * u) * (0.8 + Math.sin(this.t * 30) * 0.2);
                ctx.drawImage(BW.glowSprite('#7cc8ff'), x - 26, this.fy - 16, 52, 24);
                ctx.strokeStyle = 'rgba(207,234,255,0.5)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x, this.fy - 4);
                ctx.lineTo(x, this.fy - 4 - 80 * u);
                ctx.stroke();
            } else {
                const a = this.mode === 'done' ? Math.max(0, 1 - this.life / 0.3) : 1;

                ctx.globalAlpha = a;
                ctx.beginPath();
                ctx.moveTo(x, this.y);
                ctx.lineTo(x - 6, this.y - 56);
                ctx.lineTo(x + 6, this.y - 56);
                ctx.closePath();
                ctx.fillStyle = '#0d0e14';
                ctx.fill();
                ctx.strokeStyle = '#7cc8ff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (this.mode === 'fall') {
                    ctx.strokeStyle = 'rgba(159,216,255,0.4)';
                    ctx.beginPath();
                    ctx.moveTo(x, this.y - 56);
                    ctx.lineTo(x, this.y - 200);
                    ctx.stroke();
                }

                ctx.globalCompositeOperation = 'lighter';
                ctx.drawImage(BW.glowSprite('#bfe8ff'), x - 14, this.y - 14, 28, 28);
            }

            ctx.restore();
        }
    }

    // every hazard of its own, so they all vanish the moment it falls
    const OWN_HAZARDS = [NeedleSpike, VeilNet, HushWave, ThreadDart, FallingNeedle];

    BW.ENEMY_TYPES.mourner = Mourner;
    BW.Mourner = Mourner;
    BW.NeedleSpike = NeedleSpike;
    BW.VeilNet = VeilNet;
    BW.HushWave = HushWave;
    BW.ThreadDart = ThreadDart;
    BW.FallingNeedle = FallingNeedle;
})(window.BW);

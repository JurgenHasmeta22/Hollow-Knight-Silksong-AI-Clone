'use strict';

// The Faceless Ronin, the hero: movement, dash, parry, Shadow Step, mending and the combat below. A straw-hatted
// swordsman with a heavy, physical moveset and a second form.
//
//   Normal form    a three-hit dual-blade combo (the third hit lunges), an air slash, up and down strikes (the down strike
//                  bounces), a charged Void Slash (hold the strike button), the Energy Barrage (lance button, 3 silk), the
//                  Whirlwind Dash (skill button, 2 silk), a dash-slash (strike during a dash), Silk Dash, parry, Shadow Step
//                  and the drink that mends.
//   Shade          a gauge that fills with every blow, more with a parry or a Shadow Step. Full, it lets you transform.
//   Transformed    for about 24 seconds: faster, harder-hitting, a four-hit combo, a double jump (Flame Ascent), the Phantom
//                  Clone Dash, the Clashing Shadow Slash, the five-way Barrage, Phantom Grab (skill + up), Ground Eruption
//                  (skill + down on the ground), the Ground Pound (skill + down in the air), the Illusion Burst (answers a
//                  Shadow Step), and the Giant Spectral Summon (transform button again: the ultimate, which ends the form).
//
// Art: assets/img/sprites/ronin.webp, one sprite per pose named ronin_<pose> (tools/import_ronin_art.py). Every effect that
// is not part of a pose (the crescents, the spikes, the falling star) is drawn in code.
(function (BW) {
    const P = BW.PHYS,
        T = BW.T,
        Phys = BW.Phys;

    BW.HERO_SCALE = 1.2; // the hero is drawn a fifth larger than its hitbox, so combos read clearly

    // ================================================================ tuning
    const TUNE = {
        shade: { max: 100, hit: 3, kill: 6, parry: 16, dodge: 20 },
        form: { time: 24, max: 34, dmg: 1.4, speed: 1.14, atk: 1.3, hitTime: 0.3, parryTime: 1.2, hurtTime: 3.5 },
        combo: { window: 0.5 },
        whirl: { silk: 2, dur: 0.64, speed: 560, tick: 0.1, mul: 0.7, cd: 0.8 },
        barrage: { silk: 3, formSilk: 2, dur: 0.5, cd: 0.45 },
        void: { silk: 4, hold: 0.42, charge: 0.62, dur: 0.78, mul: 3, cd: 1.1 },
        dashslash: { dur: 0.36, speed: 620, mul: 1.4, cd: 0.6 },
        clash: { dur: 0.5, speed: 520, mul: 1.6, cd: 0.5 },
        clone: { dur: 0.3, speed: 1250, mul: 0.9, cd: 0.55 },
        grab: { dur: 0.62, reach: 340, mul: 2.2, cd: 0.9 },
        erupt: { dur: 0.7, n: 5, gap: 72, mul: 1.5, cd: 1.2 },
        pound: { speed: 1350, mul: 2.4, cd: 0.8 },
        illusion: { dur: 0.6, mul: 1.8, cd: 0.5 },
        ult: { dur: 2.1, mul: 6, radius: 270, minTime: 4 },
        transform: { dur: 2.9 },
        jumps: 1, // extra jumps in the air while transformed
    };

    // ================================================================ poses and animations
    const SPR = (pose) => 'ronin_' + pose;

    // The pose sheets were drawn pose by pose, so the same figure is 190 to 245 px tall from one pose to the next: idle
    // swapped a tall pose for a short one, the run cycle pulsed, the transformation swelled and shrank. These poses are
    // drawn at one common figure height (atlas px); the rest keep their own size (their sword, flames or lean are part of it).
    const STAND_H = 205;
    const RUN_H = 172;
    const STAND = new Set([
        'idle_a',
        'idle_b',
        'stand_c',
        'stand_d',
        'ready',
        'breath',
        'walk',
        'taunt',
        'drink',
        'return',
        'focus',
        'aura',
        'float',
        'absorb',
        'unleash',
        'transformed',
    ]);
    const RUN = new Set(['run1', 'run2', 'run3']);
    const poseK = {};

    // the factor that brings pose `pose` to its group's figure height (1 for a pose that is not normalised)
    function poseScale(pose) {
        if (poseK[pose] != null) return poseK[pose];

        const want = STAND.has(pose) ? STAND_H : RUN.has(pose) ? RUN_H : 0,
            s = want && BW.Assets.sprite(SPR(pose));

        if (!s) return want ? 1 : (poseK[pose] = 1);

        return (poseK[pose] = BW.clamp(want / s.frames[0][3], 0.8, 1.2));
    }

    // every pose a combo hit moves through, the hit's window (seconds into it), reach and weight
    const COMBO = [
        {
            dur: 0.26,
            hit: [0.06, 0.17],
            mul: 1,
            box: { w: 106, h: 70, dx: 4, dy: -38 },
            poses: ['slash1', 'slash2'],
            lunge: 120,
            fx: { r: 70, w: 24 },
        },
        {
            dur: 0.27,
            hit: [0.06, 0.18],
            mul: 1.1,
            box: { w: 118, h: 74, dx: 4, dy: -40 },
            poses: ['draw', 'slash3'],
            lunge: 140,
            fx: { r: 74, w: 26 },
        },
        {
            dur: 0.42,
            hit: [0.12, 0.27],
            mul: 1.8,
            box: { w: 146, h: 98, dx: 2, dy: -52 },
            poses: ['slash1', 'slash2', 'slash3'],
            lunge: 280,
            fx: { r: 92, w: 32, big: true },
            shock: true,
        },
        // the fourth hit only exists in the second form
        {
            dur: 0.46,
            hit: [0.12, 0.3],
            mul: 2.4,
            box: { w: 190, h: 124, dx: 0, dy: -66 },
            poses: ['slash1', 'void', 'slash3'],
            lunge: 320,
            fx: { r: 110, w: 38, big: true },
            shock: true,
            wave: true,
        },
    ];

    // run cycle, rest and the like: pose lists with the speed they play at
    const ANIMS = {
        idle: { poses: ['idle_a', 'breath', 'idle_b', 'breath'], fps: 1.3 },
        run: { poses: ['run1', 'run2', 'run3', 'run2'], fps: 11 },
        death: { poses: ['crumple', 'crawl', 'lying', 'dead', 'ash'], fps: 2.2, hold: true },
        // the pose each quick item is thrown or drunk in
        item: { charge: 'crouch', shards: 'barrage', veil: 'illusion', draught: 'taunt' },
    };

    const lerp = BW.lerp;

    function smooth(x) {
        x = BW.clamp(x, 0, 1);

        return x * x * (3 - 2 * x);
    }

    // ================================================================ projectiles and effects (they live in game.lances)
    // A black crescent of the Energy Barrage and the Void Slash: it passes through everything it cuts.
    class Crescent {
        constructor(game, x, y, vx, vy, o = {}) {
            this.game = game;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.size = o.size || 1;
            this.mul = o.mul || 1;
            this.life = o.life || 0.9;
            this.t = 0;
            this.dead = false;
            this.hits = new Set();
            this.ang = Math.atan2(vy, vx);
        }
        box() {
            const r = 26 * this.size;

            return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
        }
        update(dt) {
            const g = this.game,
                p = g.player;

            this.t += dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (this.t > this.life || g.room.solidPx(this.x, this.y)) {
                this.dead = true;
                g.fx.burst(this.x, this.y, 10, {
                    color: ['#0a0c12', '#9fb4d8', '#ffffff'],
                    kind: 'spark',
                    speed: 260,
                    life: 0.3,
                });

                return;
            }

            if (p.strikeAt) p.strikeAt(this.box(), this.mul, this.hits, 'side');

            if (Math.random() < 0.7)
                g.fx.spawn({
                    x: this.x - Math.cos(this.ang) * 16,
                    y: this.y - Math.sin(this.ang) * 16 + BW.rand(-6, 6),
                    vx: -this.vx * 0.1,
                    vy: BW.rand(-30, 30),
                    life: 0.35,
                    size: 3 * this.size,
                    color: BW.pick(['#0b0d14', '#6f86b5', '#cfe0ff']),
                    kind: 'glow',
                    add: false,
                });
        }
        draw(ctx) {
            const r = 34 * this.size;

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.ang);

            // the dark body, with a pale edge on the leading side
            ctx.fillStyle = '#05070b';
            ctx.beginPath();
            ctx.arc(0, 0, r, -1.15, 1.15);
            ctx.arc(-r * 0.42, 0, r * 0.88, 1.15, -1.15, true);
            ctx.closePath();
            ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(207,224,255,0.9)';
            ctx.lineWidth = 3 * this.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 0, r, -1.05, 1.05);
            ctx.stroke();
            ctx.restore();
            this.game.addLight(this.x, this.y, 90 * this.size, '#9fb4e8', 0.35);
        }
    }

    // A black spike that bursts out of the floor: the Ground Eruption, and the Ground Pound's two shocks.
    class Spike {
        constructor(game, x, floorY, delay, o = {}) {
            this.game = game;
            this.x = x;
            this.y = floorY;
            this.delay = delay;
            this.size = o.size || 1.9;
            this.mul = o.mul || 1;
            this.t = 0;
            this.dead = false;
            this.struck = false;
            this.hits = o.hits || new Set();
        }
        update(dt) {
            const g = this.game;

            if (this.delay > 0) {
                this.delay -= dt;

                if (this.delay <= 0) {
                    BW.Audio.playAt('slashbody', this.x, this.y, {
                        vol: 0.5,
                        rate: 0.7 + Math.random() * 0.3,
                        minGap: 0.04,
                    });
                    g.fx.shake(3, 0.1);
                    g.fx.burst(this.x, this.y, 8, {
                        color: ['#0a0c12', '#46557a', '#9fb4d8'],
                        kind: 'shard',
                        speed: 260,
                        life: 0.5,
                        grav: 800,
                        size: 4,
                    });
                }

                return;
            }

            this.t += dt;

            if (!this.struck && this.t > 0.05) {
                this.struck = true;

                const p = g.player;

                if (p.strikeAt)
                    p.strikeAt(
                        { x: this.x - 38, y: this.y - 240 * (this.size / 1.9), w: 76, h: 240 * (this.size / 1.9) },
                        this.mul,
                        this.hits,
                        'side',
                    );
            }

            if (this.t > 0.55) this.dead = true;
        }
        draw(ctx) {
            if (this.delay > 0) return;

            const k = smooth(this.t / 0.14),
                fade = BW.clamp((0.55 - this.t) / 0.2, 0, 1);

            ctx.save();
            ctx.globalAlpha = fade;
            BW.Assets.draw(ctx, SPR('erupt'), 0, this.x, this.y + 6, { scale: this.size * k });
            ctx.restore();
        }
    }

    // The Giant Spectral Summon: a spectral giant stands over the target and a burning star falls out of its fist.
    class Giant {
        constructor(game, x, floorY, mul) {
            this.game = game;
            this.x = x;
            this.y = floorY;
            this.mul = mul;
            this.t = 0;
            this.dead = false;
            this.landed = false;
        }
        update(dt) {
            const g = this.game,
                p = g.player;

            this.t += dt;

            if (!this.landed && this.t >= 1.15) {
                this.landed = true;
                g.fx.shake(20, 0.7);
                g.fx.flash('#ffffff', 0.7);
                g.hitstop(0.18);
                g.fx.ring(this.x, this.y - 10, 20, TUNE.ult.radius * 1.6, 0.7, '#ffb25a', 8);
                g.fx.ring(this.x, this.y - 10, 10, TUNE.ult.radius * 1.1, 0.5, '#ffffff', 5);
                g.fx.burst(this.x, this.y - 20, 50, {
                    color: ['#ffb25a', '#ffe1a0', '#ffffff', '#2a2230'],
                    kind: 'spark',
                    speed: 620,
                    life: 0.7,
                    add: true,
                });
                BW.Audio.play('combohit', { vol: 1, rate: 0.55, minGap: 0 });
                BW.Audio.play('voice', { vol: 1, rate: 0.5, minGap: 0 });
                BW.Audio.play('boss_slam', { vol: 1, rate: 0.6, minGap: 0 });

                const r = TUNE.ult.radius;

                if (p.strikeAt)
                    p.strikeAt(
                        { x: this.x - r, y: this.y - r * 0.9, w: r * 2, h: r * 1.1 },
                        this.mul,
                        new Set(),
                        'side',
                    );
            }

            if (this.t > 2) this.dead = true;
        }
        draw(ctx) {
            const t = this.t,
                a = t < 0.55 ? smooth(t / 0.55) : t < 1.4 ? 1 : BW.clamp((2 - t) / 0.6, 0, 1);

            ctx.save();
            ctx.globalAlpha = 0.6 * a;
            BW.Assets.draw(ctx, SPR('giant'), 0, this.x, this.y + 8, { scale: 2.5 });
            ctx.restore();

            // the star: it falls from above the screen over 0.6 s
            if (t >= 0.45 && t < 1.15) {
                const u = (t - 0.45) / 0.7,
                    y = lerp(this.y - 900, this.y - 20, u * u),
                    x = this.x - (1 - u) * 90,
                    r = 40 + u * 40;

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);

                grd.addColorStop(0, 'rgba(255,240,200,0.95)');
                grd.addColorStop(0.35, 'rgba(255,150,60,0.7)');
                grd.addColorStop(1, 'rgba(255,80,20,0)');
                ctx.fillStyle = grd;
                ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
                ctx.restore();
                this.game.addLight(x, y, 260, '#ff9a3c', 0.8);
            }

            if (this.landed) {
                const k = BW.clamp((t - 1.15) / 0.5, 0, 1);

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 1 - k;
                ctx.drawImage(
                    BW.glowSprite('#ffb25a'),
                    this.x - 320 * (0.5 + k),
                    this.y - 260 * (0.5 + k),
                    640 * (0.5 + k),
                    360 * (0.5 + k),
                );
                ctx.restore();
            }
        }
    }

    // ================================================================ the skills
    // Each: dur (seconds, or a function of the Ronin; Infinity until the skill ends itself), pose(p, s) -> pose name,
    // start(p, s), tick(p, s, dt, inp), end(p, s), and flags: noGrav (the skill carries you), keep (survives a hurt).
    const SKILLS = {
        // ---- the transformation: focus, flare, float, absorb, unleash, stand (the first six poses of the second sheet)
        transform: {
            dur: TUNE.transform.dur,
            noGrav: false,
            pose: (p, s) =>
                s.t < 0.5
                    ? 'focus'
                    : s.t < 0.95
                    ? 'aura'
                    : s.t < 1.5
                    ? 'float'
                    : s.t < 2
                    ? 'absorb'
                    : s.t < 2.45
                    ? 'unleash'
                    : 'transformed',
            start(p, s) {
                const g = p.game;

                p.skillInv = TUNE.transform.dur + 0.4;
                p.vx = 0;
                g.state.shade = 0;
                g.fx.flash('#6f8cff', 0.25);
                BW.Audio.play('shrine', { vol: 0.8, rate: 0.7, minGap: 0 });
                BW.Audio.play('voice', { vol: 0.8, rate: 0.6, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                p.vx = 0;
                p.lift = 34 * smooth((s.t - 0.9) / 0.5) * (1 - smooth((s.t - 1.9) / 0.4));

                if (s.t > 0.2 && s.t < 2 && Math.random() < dt * 50) {
                    const a = Math.random() * Math.PI * 2,
                        r = BW.rand(90, 150);

                    g.fx.spawn({
                        x: p.cx + Math.cos(a) * r,
                        y: p.cy + Math.sin(a) * r * 0.8,
                        vx: -Math.cos(a) * r * 2.2,
                        vy: -Math.sin(a) * r * 1.8,
                        life: 0.55,
                        size: 3,
                        color: BW.pick(['#6f8cff', '#9a6bff', '#ff5a4a']),
                        kind: 'glow',
                        add: true,
                        drag: 0,
                    });
                }

                if (!s.ev.aura && s.t >= 0.5) {
                    s.ev.aura = 1;
                    g.fx.ring(p.cx, p.cy, 10, 170, 0.6, '#9a6bff', 4);
                    g.fx.shake(4, 0.3);
                    BW.Audio.play('bellfar', { vol: 0.8, pitch: 98, minGap: 0 });
                }

                if (!s.ev.unleash && s.t >= 2) {
                    s.ev.unleash = 1;
                    p.beginForm();
                    g.fx.ring(p.cx, p.cy, 20, 420, 0.7, '#ff5a4a', 7);
                    g.fx.ring(p.cx, p.cy, 10, 300, 0.5, '#9fb4ff', 4);
                    g.fx.flash('#ff5a4a', 0.4);
                    g.fx.shake(12, 0.5);
                    g.hitstop(0.14);
                    BW.Audio.play('combohit', { vol: 1, rate: 0.6, minGap: 0 });
                    BW.Audio.play('boss_roar', { vol: 0.6, rate: 1.3, minGap: 0 });

                    for (const e of g.enemies) {
                        if (e.dead || Math.hypot(e.cx - p.cx, e.cy - p.cy) > 420) continue;

                        e.stun = Math.max(e.stun || 0, 1.2);
                        e.vx = BW.sign(e.cx - p.cx) * 420;
                    }
                }
            },
            end(p) {
                p.lift = 0;
                p.skillInv = Math.max(p.skillInv, 0.4);
            },
        },

        // ---- the form ending, on its own or after the ultimate
        detransform: {
            dur: 0.7,
            pose: () => 'return',
            start(p) {
                p.skillInv = 0.8;
                p.vx = 0;
                BW.Audio.play('shrine', { vol: 0.5, rate: 1.4, minGap: 0 });
            },
            tick(p, s, dt) {
                p.vx *= Math.exp(-10 * dt);

                if (!s.ev.out && s.t >= 0.2) {
                    s.ev.out = 1;
                    p.endForm();
                    p.game.fx.ring(p.cx, p.cy, 10, 200, 0.5, '#9fb4ff', 3);
                    p.game.fx.burst(p.cx, p.cy, 24, {
                        color: ['#6f8cff', '#ff5a4a', '#ffffff'],
                        kind: 'glow',
                        speed: 240,
                        life: 0.7,
                        add: true,
                        size: 8,
                    });
                }
            },
        },

        // ---- Whirlwind Dash: a spinning run that cuts everything it passes
        whirl: {
            dur: TUNE.whirl.dur,
            pose: (p, s) => (Math.floor(s.t * 14) % 2 ? 'tornado' : 'whirl'),
            start(p, s) {
                s.dir = p.facing;
                p.skillInv = 0.25;
                BW.Audio.play('bladedual', { vol: 0.8, rate: 0.9, minGap: 0 });
            },
            tick(p, s, dt) {
                p.facing = s.dir;
                p.vx = s.dir * TUNE.whirl.speed;
                s.acc = (s.acc || 0) + dt;

                if (s.acc >= TUNE.whirl.tick) {
                    s.acc -= TUNE.whirl.tick;
                    p.strikeAt({ x: p.cx - 88, y: p.cy - 56, w: 176, h: 100 }, TUNE.whirl.mul, new Set(), 'side');

                    // the spin is cut every 0.1 s but it should sound like one sweep, a whoosh on every third tick
                    s.n = (s.n || 0) + 1;

                    if (s.n % 3 === 0)
                        BW.Audio.play('bladedual', { vol: 0.4, rate: 1 + Math.random() * 0.3, minGap: 0.2 });
                }

                if (Math.random() < dt * 40)
                    p.game.fx.burst(p.cx - s.dir * 20, p.y + p.h - 4, 2, {
                        color: ['#0b0d14', '#6f86b5'],
                        speed: 160,
                        life: 0.4,
                        angle: s.dir > 0 ? Math.PI : 0,
                        spread: 1.2,
                        kind: 'shard',
                        size: 3,
                    });
            },
            end(p, s) {
                p.vx *= 0.3;
                p.cd.whirl = TUNE.whirl.cd;
            },
        },

        // ---- Energy Barrage: crescents thrown from the blade (one; five in a fan while transformed)
        barrage: {
            dur: TUNE.barrage.dur,
            pose: () => 'barrage',
            start(p) {
                p.vx = 0;
                BW.Audio.play('bladedual', { vol: 0.6, rate: 0.7, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                p.vx *= Math.exp(-14 * dt);

                if (!s.ev.fire && s.t >= 0.16) {
                    s.ev.fire = 1;

                    const f = p.facing,
                        n = p.form ? 5 : 1;

                    for (let i = 0; i < n; i++) {
                        const a = n === 1 ? 0 : (i - (n - 1) / 2) * 0.22;

                        g.lances.push(
                            new Crescent(g, p.cx + f * 36, p.cy - 8, Math.cos(a) * f * 980, Math.sin(a) * 980, {
                                size: n === 1 ? 1.2 : 0.9,
                                mul: n === 1 ? 2.2 : 1.4,
                            }),
                        );
                    }

                    p.vx = -f * 160;
                    g.fx.shake(4, 0.12);
                    g.fx.burst(p.cx + f * 40, p.cy - 8, 12, {
                        color: ['#0b0d14', '#9fb4d8', '#ffffff'],
                        kind: 'spark',
                        speed: 360,
                        life: 0.3,
                        add: true,
                    });
                    BW.Audio.play('slashbody', { vol: 0.6, rate: 1.3, minGap: 0 });
                }
            },
            end(p) {
                p.cd.barrage = TUNE.barrage.cd;
            },
        },

        // ---- charging the Void Slash: hold the strike button, release when the aura closes
        charge: {
            dur: Infinity,
            pose: () => 'charge',
            start(p, s) {
                p.vx = 0;
                s.full = false;
                BW.Audio.play('muffled', { vol: 0.6, rate: 0.7, minGap: 0 });
            },
            tick(p, s, dt, inp) {
                const g = p.game;

                p.vx *= Math.exp(-14 * dt);

                if (!s.full && s.t >= TUNE.void.charge) {
                    s.full = true;
                    g.fx.ring(p.cx, p.cy, 80, 10, 0.3, '#cfe0ff', 4);
                    BW.Audio.play('glint', { vol: 0.8, rate: 0.8, minGap: 0 });
                }

                if (Math.random() < dt * (s.full ? 60 : 25)) {
                    const a = Math.random() * Math.PI * 2;

                    g.fx.spawn({
                        x: p.cx + Math.cos(a) * 80,
                        y: p.cy + Math.sin(a) * 70,
                        vx: -Math.cos(a) * 140,
                        vy: -Math.sin(a) * 120,
                        life: 0.4,
                        size: 2.4,
                        color: s.full ? '#ffffff' : '#6f8cff',
                        kind: 'glow',
                        add: true,
                        drag: 0,
                    });
                }

                if (!inp.down.attack) {
                    p.skill = null;
                    s.def.end(p, s, true);

                    if (s.full) p.startVoid();
                }
            },
            end(p, s, released) {
                if (!released) p.cd.void = 0.2;
            },
        },

        // ---- Void Slash: a huge arc and a wave that carries on
        void: {
            dur: TUNE.void.dur,
            pose: (p, s) => (s.t < 0.26 ? 'slash1' : 'void'),
            start(p, s) {
                s.dir = p.facing;
                p.skillInv = 0.3;
                p.vx = 0;
                p.cd.void = TUNE.void.cd;
                BW.Audio.play('muffled', { vol: 0.6, rate: 0.9, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game,
                    f = s.dir;

                p.facing = f;

                if (!s.ev.cut && s.t >= 0.26) {
                    s.ev.cut = 1;
                    p.vx = f * 260;
                    p.strikeAt(
                        { x: f > 0 ? p.cx - 20 : p.cx - 250, y: p.cy - 120, w: 270, h: 190 },
                        TUNE.void.mul,
                        new Set(),
                        'side',
                    );
                    g.lances.push(
                        new Crescent(g, p.cx + f * 90, p.cy - 20, f * 820, 0, { size: 2.2, mul: 2.2, life: 0.8 }),
                    );
                    g.fx.shake(9, 0.3);
                    g.fx.flash('#cfe0ff', 0.14);
                    g.hitstop(0.07);
                    g.fx.ring(p.cx + f * 60, p.cy - 20, 10, 190, 0.35, '#cfe0ff', 5);
                    BW.Audio.play('combohit', { vol: 1, rate: 0.75, minGap: 0 });
                    BW.Audio.play('bladedual', { vol: 0.9, rate: 0.6, minGap: 0 });
                }

                if (s.t > 0.4) p.vx *= Math.exp(-9 * dt);
            },
        },

        // ---- a strike thrown in the middle of a dash: one lunging cut (Clashing Shadow Slash when transformed)
        dashslash: {
            dur: TUNE.dashslash.dur,
            pose: () => 'slash2',
            start(p, s) {
                s.dir = p.facing;
                p.skillInv = 0.2;
                p.vx = s.dir * TUNE.dashslash.speed;
                BW.Audio.play('bladedual', { vol: 0.8, rate: 1.1, minGap: 0 });
            },
            tick(p, s, dt) {
                p.facing = s.dir;

                if (!s.ev.cut && s.t >= 0.08) {
                    s.ev.cut = 1;
                    p.strikeAt(
                        { x: s.dir > 0 ? p.cx - 10 : p.cx - 150, y: p.cy - 50, w: 160, h: 90 },
                        TUNE.dashslash.mul,
                        new Set(),
                        'side',
                    );
                    p.game.fx.slash(p.cx + s.dir * 30, p.cy - 8, 'side', s.dir, { r: 86, w: 30, big: true });
                }

                p.vx = lerp(p.vx, 0, 1 - Math.exp(-8 * dt));
            },
            end(p) {
                p.cd.dashslash = TUNE.dashslash.cd;
            },
        },

        clash: {
            dur: TUNE.clash.dur,
            pose: () => 'clash',
            start(p, s) {
                s.dir = p.facing;
                p.skillInv = TUNE.clash.dur;
                p.vx = s.dir * TUNE.clash.speed;
                BW.Audio.play('combohit', { vol: 0.8, rate: 1.1, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                p.facing = s.dir;

                for (const t0 of [0.1, 0.26]) {
                    if (!s.ev['c' + t0] && s.t >= t0) {
                        s.ev['c' + t0] = 1;
                        p.strikeAt(
                            { x: s.dir > 0 ? p.cx - 30 : p.cx - 210, y: p.cy - 60, w: 240, h: 110 },
                            TUNE.clash.mul,
                            new Set(),
                            'side',
                        );
                        g.fx.slash(p.cx + s.dir * 40, p.cy - 10, 'side', s.dir, { r: 100, w: 34, big: true });
                        g.fx.shake(5, 0.12);
                        BW.Audio.play('bladedual', { vol: 0.7, rate: 1 + t0, minGap: 0 });
                    }
                }

                p.vx = lerp(p.vx, 0, 1 - Math.exp(-6 * dt));

                if (Math.random() < dt * 40)
                    g.fx.ghost(SPR('clash'), 0, p.cx, p.y + p.h, p.facing < 0, '#6f8cff', 0.2, BW.HERO_SCALE);
            },
            end(p) {
                p.cd.clash = TUNE.clash.cd;
            },
        },

        // ---- Phantom Clone Dash: a fast dash through everything, untouchable, that leaves clones
        clonedash: {
            dur: TUNE.clone.dur,
            noGrav: true,
            pose: (p, s) => (s.t < 0.06 ? 'speed' : 'clone'),
            start(p, s) {
                s.dir = p.heldDir || 0 || p.facing;
                p.facing = s.dir;
                p.skillInv = TUNE.clone.dur + 0.14;
                p.vy = 0;
                p.vx = s.dir * TUNE.clone.speed;
                s.hits = new Set();
                s.acc = 0;

                if (!p.onGround) p.airDashUsed = true;

                BW.Audio.play('bladedual', { vol: 0.9, rate: 1.2, minGap: 0 });
                BW.Audio.play('dash', { vol: 0.7, rate: 0.8, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                p.vy = 0;
                p.vx = s.dir * TUNE.clone.speed;
                s.acc += dt;
                p.strikeAt({ x: p.cx - 60, y: p.cy - 50, w: 120, h: 100 }, TUNE.clone.mul, s.hits, 'side');

                if (s.acc >= 0.045) {
                    s.acc = 0;
                    g.fx.ghost(SPR('clone'), 0, p.cx, p.y + p.h, p.facing < 0, '#6f8cff', 0.45, BW.HERO_SCALE);
                }
            },
            end(p, s) {
                p.vx = s.dir * 260;
                p.cd.clone = TUNE.clone.cd;
                p.game.fx.ring(p.cx, p.cy, 10, 150, 0.3, '#6f8cff', 3);
                p.strikeAt({ x: p.cx - 110, y: p.cy - 60, w: 220, h: 110 }, 1.2, s.hits, 'side');
            },
        },

        // ---- Phantom Grab: a shadow hand drags the nearest foe in front of you
        grab: {
            dur: TUNE.grab.dur,
            pose: () => 'grab',
            start(p) {
                p.vx = 0;
                p.skillInv = 0.2;
                BW.Audio.play('voice', { vol: 0.8, rate: 1.4, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game,
                    f = p.facing;

                p.vx *= Math.exp(-12 * dt);

                if (!s.ev.hand && s.t >= 0.18) {
                    s.ev.hand = 1;

                    let best = null;

                    for (const e of g.enemies) {
                        if (e.dead) continue;

                        const dx = (e.cx - p.cx) * f;

                        if (dx < 10 || dx > TUNE.grab.reach || Math.abs(e.cy - p.cy) > 150) continue;
                        if (!best || dx < (best.cx - p.cx) * f) best = e;
                    }

                    const ex = p.cx + f * (best ? (best.cx - p.cx) * f : TUNE.grab.reach);

                    g.fx.thread(p.cx + f * 30, p.cy - 6, ex, best ? best.cy : p.cy - 6, 0.4, '#8a7bff');
                    g.fx.ring(ex, best ? best.cy : p.cy - 6, 8, 70, 0.3, '#8a7bff', 4);

                    if (best) {
                        const boss = BW.BOSS_TYPES && BW.BOSS_TYPES[best.kind];

                        p.strikeAt(best.hurtbox(), TUNE.grab.mul, new Set(), 'side');
                        g.fx.shake(6, 0.2);
                        BW.Audio.play('slashbody', { vol: 0.8, rate: 0.8, minGap: 0 });

                        if (!boss && !best.dead) {
                            best.x = p.cx + f * 60 - best.w / 2;
                            best.vx = 0;
                            best.stun = Math.max(best.stun || 0, 0.9);
                            best.frozenT = Math.max(best.frozenT || 0, 0.5);
                        }
                    } else BW.Audio.play('bladedual', { vol: 0.5, rate: 0.7, minGap: 0 });
                }
            },
            end(p) {
                p.cd.grab = TUNE.grab.cd;
            },
        },

        // ---- Ground Eruption: five black spikes burst out of the floor, one after another
        erupt: {
            dur: TUNE.erupt.dur,
            pose: () => 'pound',
            start(p) {
                p.vx = 0;
                p.skillInv = 0.2;
                BW.Audio.play('muffled', { vol: 0.7, rate: 0.6, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game,
                    f = p.facing;

                p.vx *= Math.exp(-12 * dt);

                if (!s.ev.spikes && s.t >= 0.16) {
                    s.ev.spikes = 1;

                    const floor = p.y + p.h;

                    for (let i = 0; i < TUNE.erupt.n; i++)
                        g.lances.push(
                            new Spike(g, p.cx + f * (70 + i * TUNE.erupt.gap), floor, i * 0.07, {
                                mul: TUNE.erupt.mul,
                            }),
                        );

                    g.fx.shake(6, 0.35);
                    g.hitstop(0.05);
                }
            },
            end(p) {
                p.cd.erupt = TUNE.erupt.cd;
            },
        },

        // ---- Ground Pound: plunge from the air, and the floor answers on both sides
        pound: {
            dur: Infinity,
            noGrav: true,
            pose: (p, s) => (s.phase === 'land' ? 'spikes' : 'dive'),
            start(p, s) {
                s.phase = 'dive';
                p.skillInv = 5;
                p.vx = 0;
                BW.Audio.play('voice', { vol: 0.7, rate: 1.2, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                if (s.phase === 'dive') {
                    p.vy = TUNE.pound.speed;
                    p.vx = 0;

                    if (Math.random() < dt * 50)
                        g.fx.thread(
                            p.cx + BW.rand(-12, 12),
                            p.cy - 60,
                            p.cx + BW.rand(-12, 12),
                            p.cy - 160,
                            0.2,
                            '#6f8cff',
                        );

                    if (p.onGround) {
                        s.phase = 'land';
                        s.t0 = s.t;
                        p.vy = 0;
                        p.skillInv = 0.5;
                        p.strikeAt(
                            { x: p.cx - 190, y: p.y + p.h - 130, w: 380, h: 140 },
                            TUNE.pound.mul,
                            new Set(),
                            'side',
                        );
                        g.fx.shake(14, 0.45);
                        g.fx.flash('#ffffff', 0.18);
                        g.hitstop(0.1);
                        g.fx.ring(p.cx, p.y + p.h - 10, 10, 260, 0.4, '#cfe0ff', 6);
                        g.lances.push(new Spike(g, p.cx - 110, p.y + p.h, 0.03, { mul: 1.4, size: 1.6 }));
                        g.lances.push(new Spike(g, p.cx + 110, p.y + p.h, 0.03, { mul: 1.4, size: 1.6 }));
                        BW.Audio.play('combohit', { vol: 1, rate: 0.7, minGap: 0 });
                        BW.Audio.play('boss_slam', { vol: 0.9, rate: 0.8, minGap: 0 });
                    }
                } else if (s.t - s.t0 > 0.4) s.dur = s.t;
            },
            end(p) {
                p.cd.pound = TUNE.pound.cd;
            },
        },

        // ---- Illusion Burst: it answers a Shadow Step: phantoms burst out and stagger everything near
        illusion: {
            dur: TUNE.illusion.dur,
            pose: () => 'illusion',
            start(p) {
                p.skillInv = TUNE.illusion.dur + 0.1;
                p.vx = 0;
                BW.Audio.play('voice', { vol: 0.9, rate: 0.9, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                p.vx *= Math.exp(-10 * dt);

                if (!s.ev.burst && s.t >= 0.12) {
                    s.ev.burst = 1;
                    p.strikeAt({ x: p.cx - 270, y: p.cy - 130, w: 540, h: 250 }, TUNE.illusion.mul, new Set(), 'side');
                    g.fx.ring(p.cx, p.cy, 20, 340, 0.5, '#8a7bff', 6);
                    g.fx.ring(p.cx, p.cy, 10, 240, 0.4, '#ffffff', 3);
                    g.fx.flash('#8a7bff', 0.22);
                    g.fx.shake(8, 0.3);

                    for (let i = -2; i <= 2; i++)
                        if (i)
                            g.fx.ghost(
                                SPR('illusion'),
                                0,
                                p.cx + i * 70,
                                p.y + p.h,
                                i < 0,
                                '#8a7bff',
                                0.6,
                                BW.HERO_SCALE,
                            );

                    for (const e of g.enemies) {
                        if (e.dead || Math.hypot(e.cx - p.cx, e.cy - p.cy) > 340) continue;

                        e.stun = Math.max(e.stun || 0, 1);
                        e.frozenT = Math.max(e.frozenT || 0, 0.6);
                    }

                    BW.Audio.play('combohit', { vol: 0.9, rate: 1, minGap: 0 });
                }
            },
            end(p) {
                p.cd.illusion = TUNE.illusion.cd;
            },
        },

        // ---- the Giant Spectral Summon: the ultimate. It spends the form
        ult: {
            dur: TUNE.ult.dur,
            pose: (p, s) => (s.t < 0.55 ? 'burst' : s.t < 1.15 ? 'cross' : s.t < 1.55 ? 'gburst' : 'return'),
            start(p, s) {
                s.dir = p.facing;
                p.skillInv = TUNE.ult.dur + 0.3;
                p.vx = 0;
                BW.Audio.play('voice', { vol: 1, rate: 0.5, minGap: 0 });
                BW.Audio.play('shrine', { vol: 0.8, rate: 0.6, minGap: 0 });
            },
            tick(p, s, dt) {
                const g = p.game;

                p.vx = 0;

                if (!s.ev.call && s.t >= 0.55) {
                    s.ev.call = 1;

                    let best = null;

                    for (const e of g.enemies) {
                        if (e.dead) continue;

                        const dx = (e.cx - p.cx) * s.dir;

                        if (dx < -80 || dx > 900 || Math.abs(e.cy - p.cy) > 260) continue;
                        if (!best || e.hurtbox().w * e.hurtbox().h > best.hurtbox().w * best.hurtbox().h) best = e;
                    }

                    const tx = best ? best.cx : p.cx + s.dir * 340,
                        floor = best ? best.y + best.h : p.y + p.h;

                    g.lances.push(new Giant(g, tx, floor, TUNE.ult.mul));
                    g.fx.flash('#ffb25a', 0.2);
                    BW.Audio.play('boss_roar', { vol: 0.8, rate: 0.7, minGap: 0 });
                }

                if (s.t < 0.55 && Math.random() < dt * 60) {
                    const a = Math.random() * Math.PI * 2;

                    g.fx.spawn({
                        x: p.cx + Math.cos(a) * 120,
                        y: p.cy + Math.sin(a) * 100,
                        vx: -Math.cos(a) * 240,
                        vy: -Math.sin(a) * 200,
                        life: 0.45,
                        size: 3,
                        color: BW.pick(['#ffb25a', '#ff5a4a', '#ffffff']),
                        kind: 'glow',
                        add: true,
                        drag: 0,
                    });
                }

                if (!s.ev.end && s.t >= 1.7) {
                    s.ev.end = 1;
                    p.endForm();
                }
            },
        },
    };

    // ================================================================ the Ronin
    class Ronin {
        constructor(game) {
            this.game = game;
            this.w = P.w;
            this.h = P.h;
            this.reset(0, 0);
        }

        baseReset(x, y) {
            this.x = x;
            this.y = y;
            this.px = x;
            this.py = y;
            this.vx = 0;
            this.vy = 0;
            this.facing = 1;
            this.onGround = false;
            this.wasGround = false;
            this.groundT = 0;
            this.airT = 0;
            this.coyoteT = 0;
            this.jumpBufT = 0;
            this.jumpHeld = false;
            this.dashT = 0;
            this.dashCD = 0;
            this.airDashUsed = false;
            this.dashDir = 1;
            this.attackT = 0;
            this.attackCD = 0;
            this.attackDir = 'side';
            this.attackHits = new Set();
            this.attackSerial = 0;
            this.pogoDone = false;
            this.invulnT = 0;
            this.lockT = 0;
            this.recoilT = 0;
            this.healT = 0;
            this.castT = 0;
            this.castCD = 0;
            this.parryT = 0;
            this.parryMax = 0.18;
            this.parryCD = 0;
            this.guardT = 0;
            this.parryFx = 0;
            this.restT = 0;
            this.dodgeWinT = 0;
            this.dodgeT = 0;
            this.counterT = 0;
            this.counterMax = 1;
            this.state = 'normal';
            this.dropT = 0;
            this.dropThrough = false;
            this.platform = null;
            this.anim = 'idle';
            this.animT = 0;
            this.prevAnim = 'idle';
            this.sx = 1;
            this.sy = 1;
            this.lean = 0;
            this.safeX = x;
            this.safeY = y;
            this.safeRoom = null;
            this.stepT = 0;
            this.flash = 0;
            this.glow = 0;
            this.deathT = 0;
        }

        get cx() {
            return this.x + this.w / 2;
        }
        get cy() {
            return this.y + this.h / 2;
        }
        hurtbox() {
            return { x: this.x + 4, y: this.y + 8, w: this.w - 8, h: this.h - 10 };
        }

        get game_() {
            return this.game;
        }

        baseUpdate(dt, inp) {
            const g = this.game,
                room = g.room,
                st = g.state;

            this.px = this.x;
            this.py = this.y;
            this.animT += dt;

            for (const k of [
                'coyoteT',
                'invulnT',
                'lockT',
                'dashCD',
                'attackCD',
                'castCD',
                'recoilT',
                'dropT',
                'parryT',
                'parryCD',
                'guardT',
                'dodgeWinT',
                'dodgeT',
                'counterT',
                'deflectT',
                'dodgeAnimT',
                'landT',
                'itemAnimT',
            ])
                if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);

            this.flash = Math.max(0, this.flash - dt * 5);
            this.glow = Math.max(0, this.glow - dt * 1.5);
            this.sx = BW.damp(this.sx, 1, 14, dt);
            this.sy = BW.damp(this.sy, 1, 14, dt);
            this.dropThrough = this.dropT > 0;

            if (this.state === 'dead') {
                this.deathT += dt;
                this.vy = Math.min(this.vy + P.gravDown * dt, P.maxFall);
                this.vx *= Math.exp(-4 * dt);
                this.moveAndCollide(dt);
                this.setAnim('death');

                return;
            }

            if (this.state === 'cutscene') {
                this.applyGravityOnly(dt);
                this.setAnim(this.onGround ? 'idle' : 'fall');

                return;
            }

            if (this.state === 'rest') {
                this.vx = 0;
                this.applyGravityOnly(dt);
                this.setAnim('sit');
                this.restT += dt;

                if (this.restT > 0.35 && !g.seq && (inp.pressed.interact || inp.pressed.up)) {
                    inp.consume('interact');
                    inp.consume('up');
                    g.openLanternMenu();

                    return;
                }

                if (
                    inp.pressed.left ||
                    inp.pressed.right ||
                    inp.pressed.jump ||
                    inp.pressed.attack ||
                    inp.pressed.dash ||
                    inp.pressed.down
                ) {
                    this.state = 'normal';
                    g.onStandUp();
                    inp.consume('jump');
                }

                return;
            }

            // ---- moving platform carry ----
            if (this.platform && this.onGround) {
                const p = this.platform;

                if (p.stepDx) Phys.moveX(room, this, p.stepDx);

                if (p.stepDy) {
                    this.y += p.stepDy;
                }
            }

            let dir = (inp.down.right ? 1 : 0) - (inp.down.left ? 1 : 0);
            const locked = this.lockT > 0 || this.state === 'heal' || this.castT > 0;

            if (locked) dir = 0;

            // ---- heal (mend) ----
            if (this.state === 'heal' && !inp.down.heal) {
                this.state = 'normal';
                this.glow = 0.3;
            } // released early: no cost

            if (this.state === 'heal') {
                this.healT -= dt;
                this.vx = 0;

                if (Math.random() < 0.6) {
                    const a = Math.random() * Math.PI * 2,
                        r = BW.rand(40, 70);

                    g.fx.spawn({
                        x: this.cx + Math.cos(a) * r,
                        y: this.cy + Math.sin(a) * r,
                        vx: -Math.cos(a) * r * 3,
                        vy: -Math.sin(a) * r * 3,
                        life: 0.3,
                        size: 2,
                        color: '#fff3d6',
                        kind: 'thread',
                        add: true,
                        drag: 0,
                    });
                }

                if (this.healT <= 0) {
                    BW.Gourd.drink(st);

                    g.fx.burst(this.cx, this.cy, 18, {
                        color: ['#fff6dc', '#ffd98a'],
                        speed: 220,
                        life: 0.6,
                        add: true,
                        kind: 'glow',
                        size: 8,
                    });

                    g.fx.ring(this.cx, this.cy, 10, 70, 0.45, '#ffe7b5', 3);
                    BW.Audio.play('heal');
                    this.glow = 1;
                    g.hud.pulse('hp');

                    g.hud.pulse('gourd');

                    if (inp.down.heal && BW.Gourd.left(st) > 0 && st.hp < st.maxHp && this.onGround) {
                        this.healT = 0.7 * BW.Difficulty.get(st).mend;
                        BW.Audio.play('heal_start', { minGap: 0 });
                    } else this.state = 'normal';
                }
            }

            // ---- facing ----
            if (dir !== 0 && this.dashT <= 0 && (this.attackT <= 0 || this.attackT < 0.1)) this.facing = dir;

            // ---- jump buffer / coyote ----
            if (inp.pressed.jump) this.jumpBufT = P.jumpBuffer;
            else this.jumpBufT = Math.max(0, this.jumpBufT - dt);

            // ---- dash ----
            if (
                inp.pressed.dash &&
                st.abilities.dash &&
                this.dashCD <= 0 &&
                this.dashT <= 0 &&
                this.state === 'normal' &&
                this.lockT <= 0 &&
                (this.onGround || !this.airDashUsed)
            ) {
                this.dashT = P.dashTime;
                this.dashDir = dir || this.facing;
                this.facing = this.dashDir;
                this.vy = 0;

                if (!this.onGround) this.airDashUsed = true;

                this.dodgeWinT = st.abilities.dodge ? P.dashTime + BW.Difficulty.get(st).dodge : 0; // a blow landing inside this window is a Shadow Step
                this.attackT = 0;
                this.castT = 0;
                BW.Audio.play('dash', { vary: 0.05 });

                g.fx.burst(this.cx - this.dashDir * 10, this.cy + 6, 10, {
                    color: ['#ffe7b5', '#fff'],
                    speed: 200,
                    angle: this.dashDir > 0 ? Math.PI : 0,
                    spread: 1.2,
                    life: 0.35,
                    kind: 'thread',
                    add: true,
                });

                this.sx = 1.3;
                this.sy = 0.8;
                g.stats.dashes = (g.stats.dashes || 0) + 1;
            }

            if (this.dashT > 0) {
                this.dashT -= dt;
                this.vx = this.dashDir * P.dashSpeed;
                this.vy = 0;

                if (Math.floor(this.dashT * 120) % 3 === 0)
                    g.fx.ghost(
                        this.spriteFor('dash'),
                        this.frameFor('dash'),
                        this.cx,
                        this.y + this.h,
                        this.facing < 0,
                        '#ffcf7a',
                        0.22,
                        BW.HERO_SCALE,
                    );

                g.fx.thread(
                    this.cx - this.dashDir * 30,
                    this.cy + BW.rand(-12, 12),
                    this.cx - this.dashDir * 90,
                    this.cy + BW.rand(-16, 16),
                    0.25,
                );

                if (this.dashT <= 0) {
                    this.vx = this.dashDir * P.runSpeed;
                    this.dashCD = P.dashCooldown;
                }
            } else {
                // ---- jumping ----
                const canJump = this.state === 'normal' && this.lockT <= 0 && this.castT <= 0;

                if (canJump && this.jumpBufT > 0 && inp.down.down && this.onGround && this.standingOnOneWay()) {
                    this.dropT = 0.22;
                    this.dropThrough = true;
                    this.y += 2;
                    this.onGround = false;
                    this.jumpBufT = 0;
                    this.coyoteT = 0;
                } else if (canJump && this.jumpBufT > 0 && (this.onGround || this.coyoteT > 0)) {
                    this.vy = -P.jumpV;
                    this.onGround = false;
                    this.coyoteT = 0;
                    this.jumpBufT = 0;
                    this.jumpHeld = true;
                    this.platform = null;
                    this.sx = 0.86;
                    this.sy = 1.16;
                    BW.Audio.play('jump', { vary: 0.08, vol: 0.7 });

                    g.fx.burst(this.cx, this.y + this.h, 6, {
                        color: g.room.area.moss,
                        speed: 90,
                        angle: -Math.PI / 2,
                        spread: 2.2,
                        life: 0.35,
                        size: 2.5,
                        grav: 300,
                    });
                }

                if (this.jumpHeld && !inp.down.jump && this.vy < 0) {
                    this.vy *= P.jumpCutMul;
                    this.jumpHeld = false;
                }

                if (this.vy >= 0) this.jumpHeld = false;

                // ---- gravity ----
                let grav = this.vy < 0 && this.jumpHeld ? P.gravUp : P.gravDown;

                if (this.jumpHeld && Math.abs(this.vy) < P.apexHangV) grav *= P.apexHangMul;

                this.vy = Math.min(this.vy + grav * dt, P.maxFall);

                if (this.castT > 0 && !this.onGround) this.vy = Math.min(this.vy, 60);

                // ---- horizontal ----
                if (this.lockT > 0) this.vx *= Math.exp(-3 * dt);
                else if (this.recoilT > 0) {
                    /* keep recoil */
                } else {
                    const target = dir * P.runSpeed * (this.speedMul || 1);
                    const acc = this.onGround ? (dir ? P.groundAccel : P.groundDecel) : dir ? P.airAccel : P.airDecel;

                    this.vx = BW.approach(this.vx, target, acc * dt);
                }
            }

            this.moveAndCollide(dt, dir);

            // ---- landing / leaving ground ----
            if (this.onGround && !this.wasGround) this.onLand();
            if (!this.onGround && this.wasGround && this.vy >= 0) this.coyoteT = P.coyote;

            if (this.onGround) {
                this.groundT += dt;
                this.airT = 0;
                this.airDashUsed = false;
            } else {
                this.groundT = 0;
                this.airT += dt;
            }

            // ---- attacks ----
            if (this.castT > 0) this.castT = Math.max(0, this.castT - dt);

            if (
                inp.pressed.attack &&
                this.attackCD <= 0 &&
                this.dashT <= 0 &&
                this.state === 'normal' &&
                this.lockT <= 0
            )
                this.startAttack(inp);

            if (this.attackT > 0) {
                this.attackT -= dt;
                this.updateAttack();
            }

            // ---- heal start ----
            if (inp.pressed.heal && this.state === 'normal' && this.dashT <= 0 && this.lockT <= 0) {
                if (!this.onGround) {
                    /* must be grounded */
                } else if (st.hp >= st.maxHp) g.hud.deny('hp');
                else if (BW.Gourd.left(st) <= 0) {
                    g.hud.deny('gourd');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                } else {
                    this.state = 'heal';
                    this.healT = 0.7 * BW.Difficulty.get(st).mend;
                    this.attackT = 0;
                    BW.Audio.play('heal_start', { minGap: 0 });
                }
            }

            // ---- parry ----
            if (
                inp.pressed.parry &&
                st.abilities.parry &&
                this.state === 'normal' &&
                this.dashT <= 0 &&
                this.attackT <= 0 &&
                this.castT <= 0 &&
                this.lockT <= 0 &&
                this.parryCD <= 0
            ) {
                this.parryMax = BW.Difficulty.get(st).parry * (1 + BW.Skills.mod(st, 'parry'));
                this.parryT = this.parryMax;
                this.lockT = this.parryMax;
                this.parryCD = 0.65;
                this.attackCD = Math.max(this.attackCD, this.parryMax + 0.2); // a whiff leaves you open
                this.vx *= 0.3;
                this.parryFx = 0;
                BW.Audio.play('windup', { vol: 0.35, rate: 1.8, minGap: 0 });
            }

            // ---- hazards ----
            if (this.dashT <= 0 && Phys.touchesHazard(room, this)) {
                g.onHazard();

                return;
            }

            // ---- remember safe ground for hazard respawn ----
            if (this.onGround && !this.platform && this.groundT > 0.12 && this.isSafeSpot()) {
                this.safeX = this.x;
                this.safeY = this.y;
                this.safeRoom = room.id;
            }

            // ---- footsteps ----
            if (this.onGround && Math.abs(this.vx) > 60 && this.state === 'normal') {
                this.stepT -= dt;

                if (this.stepT <= 0) {
                    this.stepT = 0.27;
                    BW.Audio.play('step', { vol: 0.5, vary: 0.15 });

                    if (Math.random() < 0.5)
                        g.fx.spawn({
                            x: this.cx - this.facing * 6,
                            y: this.y + this.h - 2,
                            vx: -this.facing * 30,
                            vy: -20,
                            life: 0.4,
                            size: 2,
                            color: BW.rgba(g.room.area.moss, 0.7),
                            grav: 100,
                        });
                }
            }

            this.pickAnim();
            this.lean = BW.damp(this.lean, this.onGround && Math.abs(this.vx) > 60 ? this.facing * 0.05 : 0, 10, dt);
        }

        applyGravityOnly(dt) {
            this.vy = Math.min(this.vy + P.gravDown * dt, P.maxFall);
            this.vx *= Math.exp(-8 * dt);
            this.moveAndCollide(dt);
        }

        moveAndCollide(dt, dir = 0) {
            const room = this.game.room;
            const dx = this.vx * dt;
            const blockedX = Phys.moveX(room, this, dx);

            if (blockedX) {
                // ledge assist: pop up onto a ledge we barely missed
                if (!this.onGround && this.vy > -200 && dir === BW.sign(dx) && this.dashT <= 0) this.tryMantle(dx);

                if (this.dashT > 0) {
                    /* dash into wall: stop dash early */ this.dashT = Math.min(this.dashT, 0.02);
                }

                this.vx = 0;
            }

            const res = Phys.moveY(room, this, this.vy * dt);

            if (res.ceil) {
                if (!this.cornerCorrect()) {
                    this.vy = Math.max(this.vy, 0);
                    this.jumpHeld = false;
                }
            }

            this.wasGround = this.onGround;

            if (res.landed) {
                this.onGround = true;
                this.vy = 0;
                this.platform = res.platform;
            } else if (this.vy !== 0 || dx !== 0) {
                this.onGround = Phys.onGround(room, this) && this.vy >= 0;

                if (!this.onGround) this.platform = null;
            }
        }

        tryMantle(dx) {
            const room = this.game.room;
            const feet = this.y + this.h;
            const tx = dx > 0 ? Math.floor((this.x + this.w + 2) / T) : Math.floor((this.x - 2) / T);
            const ty = Math.floor((feet - 1) / T);

            if (!room.solid(tx, ty) || room.solid(tx, ty - 1) || room.solid(tx, ty - 2)) return false;

            const ledgeTop = ty * T;

            if (feet - ledgeTop > 16) return false;

            const oldY = this.y;

            this.y = ledgeTop - this.h - 0.5;

            if (Phys.overlapsSolid(room, this)) {
                this.y = oldY;

                return false;
            }

            Phys.moveX(room, this, dx > 0 ? 4 : -4);
            this.vy = Math.min(this.vy, 0);

            return true;
        }

        cornerCorrect() {
            // nudge sideways when the head clips a ceiling corner by a few pixels
            const room = this.game.room;

            for (const off of [3, -3, 6, -6, 9, -9, 12, -12]) {
                const test = { x: this.x + off, y: this.y - 3, w: this.w, h: this.h };

                if (!Phys.overlapsSolid(room, test)) {
                    this.x += off;

                    return true;
                }
            }

            return false;
        }

        standingOnOneWay() {
            const room = this.game.room;
            const ty = Math.floor((this.y + this.h + 1) / T);
            let any = false;

            for (let tx = Math.floor((this.x + 0.5) / T); tx <= Math.floor((this.x + this.w - 0.5) / T); tx++) {
                if (room.solid(tx, ty)) return false;
                if (room.oneway(tx, ty)) any = true;
            }

            return any;
        }

        isSafeSpot() {
            const room = this.game.room;
            const ty = Math.floor((this.y + this.h + 1) / T);

            const tx0 = Math.floor((this.x - T) / T),
                tx1 = Math.floor((this.x + this.w + T) / T);

            for (let tx = tx0; tx <= tx1; tx++) {
                if (room.hazard(tx, ty - 1) || room.hazard(tx, ty)) return false;
                if (!room.solid(tx, ty) && !room.oneway(tx, ty)) return false;
            }

            return true;
        }

        onLand() {
            const g = this.game;
            const impact = Math.min(1, this.airT / 0.6);

            this.landT = this.airT > 0.8 ? 0.26 : this.airT > 0.4 ? 0.14 : 0;
            this.landHard = this.airT > 0.8;

            this.sx = 1 + 0.18 * impact;
            this.sy = 1 - 0.2 * impact;

            if (this.airT > 0.15) {
                BW.Audio.play('land', { vol: 0.4 + impact * 0.5 });

                g.fx.burst(this.cx, this.y + this.h, 4 + Math.floor(impact * 8), {
                    color: [BW.rgba(g.room.area.moss, 0.8), BW.rgba(g.room.area.rim, 0.5)],
                    speed: 70 + impact * 90,
                    angle: -Math.PI / 2,
                    spread: 2.6,
                    life: 0.4,
                    size: 2.6,
                    grav: 380,
                });
            }

            this.jumpHeld = false;
        }

        slashOrigin(d) {
            if (d === 'up') return { x: this.cx, y: this.y + 14 };
            if (d === 'down') return { x: this.cx, y: this.y + this.h - 10 };

            return { x: this.cx - this.facing * 2, y: this.cy - 4 };
        }

        baseAttackBox() {
            const d = this.attackDir;

            if (d === 'up') return { x: this.cx - 38, y: this.y - 74, w: 76, h: 92 };
            if (d === 'down') return { x: this.cx - 34, y: this.y + this.h - 18, w: 68, h: 92 };

            return this.facing > 0
                ? { x: this.cx + 2, y: this.cy - 36, w: 84, h: 62 }
                : { x: this.cx - 86, y: this.cy - 36, w: 84, h: 62 };
        }

        baseUpdateAttack() {
            const g = this.game;
            const age = 0.24 - this.attackT;

            if (age < 0.015 || age > 0.13) return;

            const box = this.attackBox();
            const res = g.resolvePlayerAttack(box, this.attackDir, this.attackHits);

            if (res.hitEnemy || res.hitSolidThing) {
                if (this.attackDir === 'down' && !this.pogoDone) this.pogo();
                else if (this.attackDir === 'side' && res.hitEnemy) {
                    this.vx = -this.facing * (this.onGround ? 170 : 120);
                    this.recoilT = 0.08;
                }
            }

            if (this.attackDir === 'down' && !this.pogoDone && Phys.hazardInRect(g.room, box)) {
                this.pogo();
                g.fx.burst(this.cx, box.y + 50, 6, { color: '#ffffff', kind: 'spark', speed: 300, life: 0.25 });
                BW.Audio.play('clink', { vol: 0.5 });
            }

            if (res.blocked) {
                this.vx = -this.facing * 260;
                this.recoilT = 0.14;
            }
        }

        pogo() {
            this.pogoDone = true;
            this.vy = -P.pogoV;
            this.jumpHeld = false;
            this.airDashUsed = false;
            this.sx = 0.9;
            this.sy = 1.12;
        }

        // A well-timed parry: no damage, a little silk, and the attacker is thrown open for a riposte.
        baseDeflect(srcX, opts) {
            const g = this.game,
                st = g.state;

            this.parryT = 0;
            this.lockT = 0;
            this.guardT = 0.45;
            this.parryCD = 0.1;
            this.attackCD = 0;
            this.parryFx = 0.35;
            this.glow = 1;
            this.sx = 1.14;
            this.sy = 0.9;
            st.silk = Math.min(st.silkMax, st.silk + 1);
            g.hud.pulse('silk');

            const dirx = srcX != null ? (this.cx < srcX ? 1 : -1) : this.facing;

            this.facing = dirx;

            const fx = this.cx + dirx * 30,
                fy = this.cy - 6;

            g.hitstop(0.14);
            g.fx.shake(6, 0.18);
            g.fx.flash('#fff3d0', 0.08);
            g.fx.ring(fx, fy, 8, 90, 0.35, '#fff3d0', 3);
            g.fx.burst(fx, fy, 16, { color: ['#ffffff', '#ffe7b5'], kind: 'spark', speed: 380, life: 0.35, add: true });
            BW.Audio.play('parry', { vol: 1, minGap: 0 });
            BW.Audio.play('clink', { vol: 0.45, rate: 1.7, minGap: 0 });
            BW.Audio.play('glint', { vol: 0.4, minGap: 0 });
            g.stats.parries = (g.stats.parries || 0) + 1;

            const src = opts && opts.src;

            if (src && src.onParried) src.onParried(this);
        }

        // Shadow Step: a dash timed to the instant a blow lands. No damage, a shadow of you is left where you stood,
        // time slows, the attacker is frozen and your strikes come faster for a short counter window.
        basePerfectDodge(srcX, opts) {
            const g = this.game,
                st = g.state;

            this.dodgeT = 0.5;
            this.dodgeWinT = 0;
            this.counterT = this.counterMax = 1.6;
            this.attackCD = 0;
            st.silk = Math.min(st.silkMax, st.silk + 1);
            g.hud.pulse('silk');

            const fy = this.y + this.h,
                flip = this.facing < 0;

            g.fx.ghost(this.spriteFor('idle'), this.frameFor('idle'), this.cx, fy, flip, '#b9a6ff', 1.1, BW.HERO_SCALE);

            g.fx.ghost(
                this.spriteFor('dash'),
                this.frameFor('dash'),
                this.cx - this.dashDir * 26,
                fy,
                flip,
                '#b9a6ff',
                0.8,
                BW.HERO_SCALE,
            );

            g.fx.ring(this.cx, this.cy, 10, 120, 0.5, '#cdbfff', 3);

            g.fx.burst(this.cx, this.cy, 18, {
                color: ['#ffffff', '#cdbfff', '#ffe7b5'],
                kind: 'spark',
                speed: 320,
                life: 0.45,
                add: true,
            });

            g.fx.flash('#d9ccff', 0.22);
            g.fx.shake(4, 0.15);
            g.hitstop(0.09);
            g.slowT = Math.max(g.slowT, 1.0);
            BW.Audio.play('dash', { rate: 0.55, vol: 0.9, minGap: 0 });
            BW.Audio.play('glint', { rate: 0.7, vol: 0.8, minGap: 0 });
            g.stats.dodges = (g.stats.dodges || 0) + 1;

            const src = opts && opts.src;

            if (src && src.onDodged) src.onDodged(this);
        }

        baseHurt(dmg, srcX, opts = {}) {
            const g = this.game,
                st = g.state;

            if (
                this.invulnT > 0 ||
                this.guardT > 0 ||
                this.dodgeT > 0 ||
                this.state === 'dead' ||
                this.state === 'cutscene' ||
                g.godMode
            )
                return false;

            const noParry = opts.noParry || (opts.src && opts.src.unparryable);

            if (this.parryT > 0 && !opts.trap && !noParry) {
                this.deflect(srcX, opts);

                return true;
            }

            if (this.dodgeWinT > 0 && opts.strike && !opts.trap && !opts.noParry) {
                this.perfectDodge(srcX, opts);

                return true;
            }

            // holding the guard: a blow from the front costs posture instead of health (unless it cannot be blocked)
            if (this.blocking && !opts.trap && !noParry && (srcX == null || (this.cx < srcX ? 1 : -1) === this.facing))
                return this.blockHit(dmg, srcX, opts);

            const D = BW.Difficulty.get(st);
            // traps scale with the trap setting (none in Story); everything else with the enemy damage setting
            let amount = opts.trap ? Math.round(dmg * D.trap) : BW.Difficulty.hit(st, dmg);

            // a broken guard leaves you wide open
            if (this.breakT > 0) amount = Math.ceil(amount * 1.5);

            st.hp = Math.max(0, st.hp - amount);
            g.lastHitBy = opts.cause || null;
            this.invulnT = 1.15;
            this.lockT = 0.22;
            this.flash = 1;

            if (this.state === 'heal' || this.state === 'rest') this.state = 'normal';

            this.dashT = 0;
            this.attackT = 0;
            this.castT = 0;

            const dirx = srcX != null ? (this.cx < srcX ? -1 : 1) : -this.facing;

            this.vx = dirx * 300;
            this.vy = -420;
            this.jumpHeld = false;
            this.onGround = false;
            g.hitstop(0.11);
            g.fx.shake(9, 0.25);
            g.fx.flash('#ff2a2a', 0.1);

            g.fx.burst(this.cx, this.cy, 16, {
                color: ['#1a1a24', '#ffcf7a', '#ffffff'],
                speed: 320,
                life: 0.5,
                kind: 'shard',
                size: 4,
            });

            BW.Audio.play('hurt');

            if (amount > 0) g.hud.pulse('hp', true);
            if (!opts.trap && st.hp > 0 && st.abilities.parry) g.teach('parry');

            g.stats.hits = (g.stats.hits || 0) + 1;

            if (st.hp <= 0) {
                st.hp = 0;
                this.die();
            }

            return true;
        }

        baseDie() {
            this.state = 'dead';
            this.deathT = 0;
            this.game.onPlayerDeath();
        }

        // ---- animation ----
        setAnim(a) {
            if (this.anim !== a) {
                this.anim = a;
                this.animT = 0;
            }
        }

        // Violet halo while the Shadow Step counter window is open
        drawCounter(ctx, x, y) {
            const k = Math.min(1, this.counterT / 0.5) * (0.75 + 0.25 * Math.sin(this.counterT * 18));

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.55 * k;
            ctx.drawImage(BW.glowSprite('#a28bff'), x - 80, y - 120, 160, 160);
            ctx.restore();
        }

        // the guard: a pale arc in front of the blade, brighter the more posture is left
        drawBlock(ctx, x, y) {
            const k = BW.clamp(this.posture / this.postureMax(), 0, 1),
                f = this.facing;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(${k < 0.3 ? '255,150,110' : '230,240,255'},${0.25 + 0.35 * k})`;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x + f * 6, y - 46, 46, f > 0 ? -1.1 : Math.PI - 1.1, f > 0 ? 1.1 : Math.PI + 1.1);
            ctx.stroke();
            ctx.restore();
        }

        drawParry(ctx, x, y) {
            const k = this.parryT / this.parryMax,
                f = this.facing;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(255,240,200,' + (0.35 + 0.65 * k).toFixed(2) + ')';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x + f * 10, y - 46, 40 + (1 - k) * 10, f > 0 ? -1.0 : Math.PI - 1.0, f > 0 ? 1.0 : Math.PI + 1.0);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,' + k.toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(x + f * 10, y - 46, 30 + (1 - k) * 8, f > 0 ? -0.8 : Math.PI - 0.8, f > 0 ? 0.8 : Math.PI + 0.8);
            ctx.stroke();
            ctx.restore();
        }

        reset(x, y) {
            this.baseReset(x, y);

            this.form = false;
            this.formT = 0;
            this.skill = null;
            this.skillInv = 0;
            this.cd = {};
            this.comboN = 0;
            this.comboT = 0;
            this.atk = null;
            this.atkDur = 0.24;
            this.lift = 0;
            this.ascentT = 0;
            this.airJumps = 0;
            this.dashWin = 0;
            this.holdT = 0;
            this.heldDir = 0;
            this.speedMul = 1;
            this.hitMul = 1;
            this.noSilk = false;
            this.auraT = 0;
            this.posture = this.postureMax();
            this.postureDelay = 0;
            this.blocking = false;
            this.breakT = 0;
            this.rageT = 0;
            this.veilT = 0;
            this.deflectT = 0;
            this.dodgeAnimT = 0;
            this.landT = 0;
            this.landHard = false;
            this.itemAnimT = 0;
            this.itemKind = null;
            this.itemHoldT = 0;
            this.itemCycled = false;
        }

        get isRonin() {
            return true;
        }

        // ---------------------------------------------------------------- the second form
        beginForm() {
            this.form = true;
            this.formT = TUNE.form.time + BW.Skills.mod(this.game.state, 'formTime');
            this.speedMul = TUNE.form.speed;
            this.airJumps = TUNE.jumps;
        }

        endForm() {
            this.form = false;
            this.formT = 0;
            this.speedMul = 1;
            this.airJumps = 0;
            this.ascentT = 0;
        }

        addShade(n) {
            const st = this.game.state;

            if (this.form) return;

            const before = st.shade || 0;

            st.shade = Math.min(TUNE.shade.max, before + n * (1 + BW.Skills.mod(st, 'shadeGain')));

            if (before < TUNE.shade.max && st.shade >= TUNE.shade.max) {
                this.game.hud.pulse('shade');
                this.game.teach('shade');
                BW.Audio.play('shrine', { vol: 0.6, rate: 1.3, minGap: 0 });
            }
        }

        // called by Game.resolvePlayerAttack for every enemy a blow of ours lands on
        onHitEnemy(e, r) {
            if (this.form) this.formT = Math.min(this.formMax(), this.formT + TUNE.form.hitTime);
            else this.addShade(r === 'kill' ? TUNE.shade.kill : TUNE.shade.hit);

            BW.Audio.play('slashbody', { vol: 0.5, vary: 0.12, minGap: 0.1 });
        }

        // a blow of ours against everything in `box`: `mul` is its weight (the form makes every blow heavier)
        strikeAt(box, mul, hits, dir) {
            this.hitMul = mul * this.boost();
            this.noSilk = true;

            const res = this.game.resolvePlayerAttack(box, dir || 'side', hits || new Set());

            this.hitMul = 1;
            this.noSilk = false;

            return res;
        }

        // ---------------------------------------------------------------- the update
        tickTimers(dt) {
            for (const k of [
                'coyoteT',
                'invulnT',
                'lockT',
                'dashCD',
                'attackCD',
                'castCD',
                'recoilT',
                'dropT',
                'parryT',
                'parryCD',
                'guardT',
                'dodgeWinT',
                'dodgeT',
                'counterT',
                'deflectT',
                'dodgeAnimT',
                'landT',
                'itemAnimT',
            ])
                if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);

            this.flash = Math.max(0, this.flash - dt * 5);
            this.glow = Math.max(0, this.glow - dt * 1.5);
            this.sx = BW.damp(this.sx, 1, 14, dt);
            this.sy = BW.damp(this.sy, 1, 14, dt);
            this.dropThrough = this.dropT > 0;
        }

        update(dt, inp) {
            const g = this.game;

            for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);

            if (this.skillInv > 0) this.skillInv = Math.max(0, this.skillInv - dt);
            if (this.comboT > 0) this.comboT = Math.max(0, this.comboT - dt);
            if (this.ascentT > 0) this.ascentT = Math.max(0, this.ascentT - dt);

            this.dashWin = this.dashT > 0 ? 0.2 : Math.max(0, this.dashWin - dt);
            this.holdT = inp.down.attack ? this.holdT + dt : 0;
            this.heldDir = (inp.down.right ? 1 : 0) - (inp.down.left ? 1 : 0);
            this.speedMul = (this.form ? TUNE.form.speed : 1) * (this.blocking ? 0.45 : 1);

            this.updatePosture(dt, inp);

            // test saves (Save Data > Test Saves): the Shade is full again as soon as a form ends, and silk never runs out
            this.rageT = Math.max(0, this.rageT - dt);
            this.veilT = Math.max(0, this.veilT - dt);

            if (this.state === 'normal' && !this.skill && this.lockT <= 0 && !g.seq) this.updateItems(dt, inp);
            else this.itemHoldT = 0;

            if (g.state.flags && g.state.flags.test_save) {
                g.state.silk = g.state.silkMax;
                BW.Gourd.refill(g.state);

                for (const id of BW.Items.ORDER) g.state.items[id] = BW.Items.cap(g.state, id);

                if (!this.form && !this.skill) g.state.shade = TUNE.shade.max;
            }

            if (this.onGround && this.form) this.airJumps = TUNE.jumps;

            if (this.form) {
                this.formT -= dt;
                this.auraT += dt;

                if (this.auraT > 0.07 && Math.random() < 0.7) {
                    this.auraT = 0;
                    g.fx.spawn({
                        x: this.cx + BW.rand(-16, 16),
                        y: this.y + this.h - BW.rand(0, 70),
                        vx: BW.rand(-20, 20),
                        vy: BW.rand(-90, -40),
                        life: 0.6,
                        size: BW.rand(2, 4),
                        color: BW.pick(['#ff5a4a', '#6f8cff', '#2a2f4a']),
                        kind: 'glow',
                        add: true,
                        drag: 0.5,
                    });
                }

                if (this.formT <= 0 && !this.skill && this.state === 'normal') this.startSkill('detransform');
                else if (this.formT <= 0 && this.state !== 'normal') this.endForm();
            }

            // a sequence, a death, a rest: they own the hero, whatever it was doing
            if (this.state !== 'normal' && this.skill) {
                this.skill = null;
                this.lift = 0;
            }

            if (this.skill) {
                this.runSkill(dt, inp);

                return;
            }

            if (this.state === 'normal' && this.tryTriggers(dt, inp)) {
                this.runSkill(dt, inp);

                return;
            }

            this.baseUpdate(dt, inp);
        }

        // ---------------------------------------------------------------- starting skills from the controls
        tryTriggers(dt, inp) {
            const g = this.game,
                st = g.state,
                free = this.lockT <= 0 && this.castT <= 0 && !g.seq;

            if (!free) return false;

            // a second jump in the air: Flame Ascent
            if (
                this.form &&
                inp.pressed.jump &&
                !this.onGround &&
                this.coyoteT <= 0 &&
                this.airJumps > 0 &&
                this.dashT <= 0
            ) {
                this.airJumps--;
                this.vy = -P.jumpV * 0.95;
                this.jumpHeld = false;
                this.ascentT = 0.45;
                inp.consume('jump');
                g.fx.ring(this.cx, this.y + this.h, 8, 90, 0.35, '#ffb25a', 4);
                g.fx.burst(this.cx, this.y + this.h, 16, {
                    color: ['#ffb25a', '#ff5a4a', '#ffe1a0'],
                    kind: 'glow',
                    speed: 280,
                    angle: Math.PI / 2,
                    spread: 1.6,
                    life: 0.5,
                    add: true,
                    size: 7,
                });
                BW.Audio.play('jump', { vol: 0.8, rate: 0.8, minGap: 0 });
                BW.Audio.play('bladedual', { vol: 0.4, rate: 1.4, minGap: 0 });
            }

            if (this.state !== 'normal') return false;

            // transform, or (transformed) the ultimate
            if (inp.pressed.transform) {
                inp.consume('transform');

                if (!this.form && (st.shade || 0) >= TUNE.shade.max && this.onGround && this.dashT <= 0) {
                    this.startSkill('transform');

                    return true;
                }

                if (this.form && this.formT > TUNE.ult.minTime && this.unlocked('ult')) {
                    this.startSkill('ult');

                    return true;
                }

                if (this.form && !this.unlocked('ult')) this.lockedNote('ult');

                if (!this.form) {
                    g.hud.deny('shade');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                }
            }

            // strike in the middle of a dash: Dash Slash, or the Clashing Shadow Slash when transformed
            if (inp.pressed.attack && (this.dashT > 0 || this.dashWin > 0) && this.unlocked('dashslash')) {
                const name = this.form ? 'clash' : 'dashslash';

                if (!(this.cd[name] > 0)) {
                    inp.consume('attack');
                    this.dashT = 0;
                    this.startSkill(name);

                    return true;
                }
            }

            // Phantom Clone Dash replaces the dash while transformed
            if (
                this.form &&
                inp.pressed.dash &&
                st.abilities.dash &&
                !(this.cd.clone > 0) &&
                this.dashT <= 0 &&
                (this.onGround || !this.airDashUsed)
            ) {
                inp.consume('dash');
                this.startSkill('clonedash');

                return true;
            }

            // the skill button: Whirlwind Dash; transformed, up grabs and down erupts (or pounds, in the air)
            if (inp.pressed.skill) {
                inp.consume('skill');

                if (this.form && inp.down.down && !this.onGround && !(this.cd.pound > 0)) {
                    this.startSkill('pound');

                    return true;
                }

                if (this.form && inp.down.down && this.onGround && !(this.cd.erupt > 0)) {
                    this.startSkill('erupt');

                    return true;
                }

                if (this.form && inp.down.up && !(this.cd.grab > 0)) {
                    this.startSkill('grab');

                    return true;
                }

                if (!this.unlocked('whirl')) this.lockedNote('whirl');
                else if (!(this.cd.whirl > 0)) {
                    if (this.form || st.silk >= TUNE.whirl.silk) {
                        if (!this.form) {
                            st.silk -= TUNE.whirl.silk;
                            g.hud.pulse('silk');
                        }

                        this.startSkill('whirl');

                        return true;
                    }

                    g.hud.deny('silk');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                }
            }

            // the lance button throws the Energy Barrage
            if (inp.pressed.lance && !this.unlocked('barrage')) {
                inp.consume('lance');
                this.lockedNote('barrage');
            }

            if (inp.pressed.lance && !(this.cd.barrage > 0)) {
                const cost = this.form ? TUNE.barrage.formSilk : TUNE.barrage.silk;

                inp.consume('lance');

                if (st.silk >= cost) {
                    st.silk -= cost;
                    g.hud.pulse('silk');
                    this.startSkill('barrage');

                    return true;
                }

                g.hud.deny('silk');
                BW.Audio.play('ui_back', { vol: 0.5 });
            }

            // holding the strike button charges the Void Slash
            if (
                inp.down.attack &&
                this.holdT > TUNE.void.hold &&
                this.attackT <= 0 &&
                this.onGround &&
                !(this.cd.void > 0) &&
                this.unlocked('void') &&
                (this.form || st.silk >= TUNE.void.silk)
            ) {
                this.startSkill('charge');

                return true;
            }

            return false;
        }

        // ---------------------------------------------------------------- posture, the guard
        postureMax() {
            return 100 * (1 + BW.Skills.mod(this.game.state, 'posture'));
        }

        // Hold the parry button after its window to guard. Blocked blows drain the posture bar; empty, the guard breaks. The
        // bar then refills slowly (and a clean parry gives some of it back).
        updatePosture(dt, inp) {
            const st = this.game.state,
                max = this.postureMax();

            if (this.breakT > 0) {
                this.breakT = Math.max(0, this.breakT - dt);
                this.blocking = false;
                this.posture = Math.min(max, this.posture + 8 * dt);

                if (this.breakT <= 0) this.postureDelay = 0.4;

                return;
            }

            this.blocking =
                inp.down.parry &&
                !!st.abilities.parry &&
                this.state === 'normal' &&
                this.onGround &&
                !this.skill &&
                this.parryT <= 0 &&
                this.attackT <= 0 &&
                this.dashT <= 0 &&
                this.lockT <= 0 &&
                this.castT <= 0 &&
                this.posture > 0;

            this.postureDelay = Math.max(0, this.postureDelay - dt);

            if (!this.blocking && this.postureDelay <= 0) this.posture = Math.min(max, this.posture + 14 * dt);

            this.posture = Math.min(this.posture, max);
        }

        blockHit(dmg, srcX, opts) {
            const g = this.game,
                st = g.state,
                amount = Math.max(1, BW.Difficulty.hit(st, dmg));

            this.posture -= 14 + 12 * amount;
            this.postureDelay = 1.2;
            this.vx = -this.facing * 190;
            this.sx = 1.1;
            this.sy = 0.94;
            this.glow = 0.6;
            this.addShade(4);
            g.hitstop(0.06);
            g.fx.shake(4, 0.14);
            BW.Audio.play('clink', { vol: 0.9, minGap: 0 });
            g.fx.burst(this.cx + this.facing * 34, this.cy - 8, 12, {
                color: ['#ffffff', '#ffe9b0', '#cfe0ff'],
                kind: 'spark',
                speed: 340,
                life: 0.25,
                add: true,
            });
            g.fx.ring(this.cx + this.facing * 30, this.cy - 8, 6, 60, 0.25, '#ffe9b0', 3);
            g.hud.deny('posture');

            if (this.posture <= 0) this.breakGuard(srcX);

            const src = opts && opts.src;

            if (src && src.onBlocked) src.onBlocked(this);

            return true;
        }

        breakGuard() {
            const g = this.game;

            this.posture = 0;
            this.breakT = 1.6;
            this.blocking = false;
            this.lockT = Math.max(this.lockT, 1.2);
            this.attackT = 0;
            this.skill = null;
            this.vx = -this.facing * 300;
            this.vy = -200;
            this.onGround = false;
            this.flash = 1;
            g.hitstop(0.14);
            g.fx.shake(11, 0.3);
            g.fx.flash('#ff5a4a', 0.16);
            g.fx.ring(this.cx, this.cy, 10, 170, 0.4, '#ff5a4a', 5);
            g.fx.burst(this.cx, this.cy, 22, {
                color: ['#ff5a4a', '#ffd0c0', '#ffffff'],
                kind: 'shard',
                speed: 380,
                life: 0.5,
                size: 4,
            });
            BW.Audio.play('hurt', { vol: 0.8, rate: 0.8, minGap: 0 });
            BW.Audio.play('boss_slam', { vol: 0.6, rate: 1.3, minGap: 0 });
            g.hud.pulse('hp', true);
            g.hud.toast('Guard broken', 'Your posture is gone: you are open until it returns', 2.2);
        }

        // ---------------------------------------------------------------- skill tree and items
        unlocked(move) {
            return BW.Skills.unlocked(this.game.state, move);
        }
        lockedNote(move) {
            if ((this.noteT || 0) > this.game.time) return;

            this.noteT = this.game.time + 1.6;

            const node = BW.Skills.NODES.find((n) => n.unlock === move);

            this.game.hud.toast('Not learned yet', (node ? node.name : 'This skill') + ' is in the Skills menu', 2.4);
            BW.Audio.play('ui_back', { vol: 0.5 });
        }
        formMax() {
            return TUNE.form.max + BW.Skills.mod(this.game.state, 'formTime');
        }
        // the weight of every blow: the form, Burning Shade and a Rage Draught
        boost() {
            const st = this.game.state;

            return (this.form ? TUNE.form.dmg * (1 + BW.Skills.mod(st, 'formDmg')) : 1) * (this.rageT > 0 ? 1.25 : 1);
        }
        cycleItem() {
            const g = this.game;

            g.state.quick = BW.Items.cycle(g.state);
            g.hud.pulse('item');
            BW.Audio.play('ui_move', { vol: 0.6 });
        }
        // R uses the selected item, holding it (or T) changes the item
        updateItems(dt, inp) {
            const g = this.game;

            if (inp.pressed.itemNext) this.cycleItem();

            if (inp.pressed.item) {
                this.itemHoldT = 0.001;
                this.itemCycled = false;
            }

            if (this.itemHoldT <= 0) return;

            if (inp.down.item) {
                this.itemHoldT += dt;

                if (!this.itemCycled && this.itemHoldT > 0.35) {
                    this.itemCycled = true;
                    this.cycleItem();
                }

                return;
            }

            const id = g.state.quick;

            if (!this.itemCycled) {
                if (BW.Items.use(g, this)) {
                    this.itemAnimT = 0.35;
                    this.itemKind = id;
                } else {
                    g.hud.deny('item');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                }
            }

            this.itemHoldT = 0;
        }

        startVoid() {
            const st = this.game.state;

            if (!this.form) {
                st.silk -= TUNE.void.silk;
                this.game.hud.pulse('silk');
            }

            this.startSkill('void');
        }

        startSkill(name) {
            const def = SKILLS[name];

            this.skill = { name, def, t: 0, dur: def.dur, ev: {}, phase: null };
            this.attackT = 0;
            this.dashT = 0;
            this.castT = 0;
            this.parryT = 0;
            this.lift = 0;
            this.animT = 0;
            this.comboT = 0;

            if (def.start) def.start(this, this.skill);
        }

        endSkill() {
            const s = this.skill;

            this.skill = null;
            this.lift = 0;

            if (s && s.def.end) s.def.end(this, s, false);
        }

        runSkill(dt, inp) {
            const g = this.game,
                s = this.skill,
                def = s.def;

            this.px = this.x;
            this.py = this.y;
            this.animT += dt;
            s.t += dt;
            this.tickTimers(dt);

            if (def.tick) def.tick(this, s, dt, inp);

            // the skill may have ended itself in its tick (charge -> void); a new skill has started
            if (this.skill !== s) {
                this.pickAnim();

                return;
            }

            if (!def.noGrav) this.vy = Math.min(this.vy + P.gravDown * dt, P.maxFall);

            this.moveAndCollide(dt, 0);

            if (this.onGround) {
                this.groundT += dt;
                this.airT = 0;
                this.airDashUsed = false;

                if (this.form) this.airJumps = TUNE.jumps;
            } else {
                this.groundT = 0;
                this.airT += dt;
            }

            if (this.onGround && !this.wasGround) this.onLand();

            if (this.skillInv <= 0 && Phys.touchesHazard(g.room, this)) {
                this.skill = null;
                this.lift = 0;
                g.onHazard();

                return;
            }

            if (s.t >= s.dur) this.endSkill();

            this.pickAnim();
        }

        // ---------------------------------------------------------------- combat
        startAttack(inp) {
            const g = this.game,
                F = this.form;

            let d = 'side';

            if (inp.down.up) d = 'up';
            else if (inp.down.down && !this.onGround) d = 'down';

            this.attackDir = d;
            this.attackHits = new Set();
            this.attackSerial++;
            this.pogoDone = false;
            this.state = 'normal';
            this.animT = 0;

            if (d !== 'side') {
                // up and down strikes keep the base rules (the down strike bounces); the cut is just a little heavier
                this.atk = null;
                this.atkDur = 0.24;
                this.attackT = 0.24 / (F ? TUNE.form.atk : 1);
                this.attackCD = this.counterT > 0 ? 0.15 : 0.28 / (F ? TUNE.form.atk : 1);
                BW.Audio.play('bladedual', { vol: 0.5, vary: 0.12, rate: 1.2, minGap: 0.04 });

                const o = this.slashOrigin(d);

                g.fx.slash(o.x, o.y, d, this.facing, { r: 64, w: 22 });

                return;
            }

            const max = F ? 4 : 3;

            this.comboN = this.comboT > 0 ? (this.comboN + 1) % max : 0;

            const C = (this.atk = COMBO[this.comboN]),
                speed = F ? TUNE.form.atk : 1;

            this.atkDur = C.dur / speed;
            this.attackT = this.atkDur;
            this.attackCD = this.atkDur * 0.72;
            this.comboT = this.atkDur + TUNE.combo.window + BW.Skills.mod(this.game.state, 'combo');

            if (this.counterT > 0) this.attackCD *= 0.6;

            this.vx = this.facing * C.lunge * (this.onGround ? 1 : 0.5);
            this.recoilT = this.atkDur * 0.5;

            BW.Audio.play('bladedual', {
                vol: 0.6 + this.comboN * 0.08,
                vary: 0.1,
                rate: 1 - this.comboN * 0.06,
                minGap: 0.03,
            });

            const o = this.slashOrigin('side');

            g.fx.slash(
                o.x + this.facing * 10,
                o.y,
                'side',
                this.facing,
                Object.assign({ color: F ? '#ffd0c8' : '#f4fbff', edge: F ? '#ff5a4a' : '#8fd7ff' }, C.fx),
            );
        }

        attackBox() {
            if (this.attackDir !== 'side' || !this.atk) return this.baseAttackBox();

            const b = this.atk.box,
                F = this.form ? 1.12 : 1,
                w = b.w * F;

            return this.facing > 0
                ? { x: this.cx + b.dx, y: this.cy + b.dy * F, w, h: b.h * F }
                : { x: this.cx - b.dx - w, y: this.cy + b.dy * F, w, h: b.h * F };
        }

        updateAttack() {
            const g = this.game;

            if (this.attackDir !== 'side' || !this.atk) {
                // up / down: the base timings, with the heavier cut
                this.hitMul = this.boost();
                this.baseUpdateAttack();
                this.hitMul = 1;

                return;
            }

            const C = this.atk,
                speed = this.form ? TUNE.form.atk : 1,
                age = (this.atkDur - this.attackT) * speed;

            if (age < C.hit[0] || age > C.hit[1]) return;

            const box = this.attackBox();

            this.hitMul = C.mul * this.boost();

            const res = g.resolvePlayerAttack(box, 'side', this.attackHits);

            this.hitMul = 1;

            if (res.hitEnemy || res.hitSolidThing) {
                if (res.hitEnemy) {
                    this.recoilT = 0.05;
                    this.vx *= 0.35;
                }

                // the finisher shakes the floor
                if (C.shock && !this.attackHits.shocked) {
                    this.attackHits.shocked = true;
                    g.fx.shake(this.comboN === 3 ? 10 : 6, 0.2);
                    g.fx.flash(this.form ? '#ff5a4a' : '#cfe0ff', 0.08);
                    BW.Audio.play('combohit', { vol: 0.8, rate: this.comboN === 3 ? 0.8 : 1, minGap: 0.05 });
                }
            }

            if (C.wave && !this.attackHits.waved) {
                this.attackHits.waved = true;
                g.lances.push(
                    new Crescent(g, this.cx + this.facing * 70, this.cy - 24, this.facing * 760, 0, {
                        size: 1.4,
                        mul: 1.6,
                        life: 0.55,
                    }),
                );
            }

            if (res.blocked) {
                this.vx = -this.facing * 260;
                this.recoilT = 0.14;
            }
        }

        // ---------------------------------------------------------------- shared reactions
        deflect(srcX, opts) {
            this.baseDeflect(srcX, opts);
            this.deflectT = 0.28;
            this.posture = Math.min(this.postureMax(), this.posture + 25);
            this.addShade(TUNE.shade.parry);

            if (this.form) this.formT = Math.min(this.formMax(), this.formT + TUNE.form.parryTime);
        }

        perfectDodge(srcX, opts) {
            this.basePerfectDodge(srcX, opts);
            this.dodgeAnimT = 0.3;
            this.addShade(TUNE.shade.dodge);

            if (this.form && !(this.cd.illusion > 0) && this.state === 'normal') this.startSkill('illusion');
        }

        hurt(dmg, srcX, opts = {}) {
            if (this.skillInv > 0) return false;

            const st = this.game.state,
                hp = st.hp,
                r = this.baseHurt(dmg, srcX, opts);

            if (r && st.hp < hp) {
                this.skill = null;
                this.lift = 0;
                this.atk = null;
                this.attackT = 0; // the swing is over: the animation must not go on asking for its poses

                if (this.form) this.formT -= TUNE.form.hurtTime;
            }

            return r;
        }

        die() {
            this.skill = null;
            this.lift = 0;
            this.endForm();
            this.baseDie();
        }

        // ---------------------------------------------------------------- animation
        animKey() {
            if (this.state === 'dead') return 'death';
            if (this.skill) return 'skill:' + this.skill.name;
            if (this.state === 'rest') return 'sit';
            if (this.state === 'heal') return 'heal';
            if (this.breakT > 0) return 'broken';
            if (this.itemAnimT > 0) return 'item';
            if (this.deflectT > 0) return 'deflect';
            if (this.dodgeAnimT > 0) return 'dodge';
            if (this.parryT > 0 || this.guardT > 0.3) return 'guard';
            if (this.blocking) return 'block';
            if (this.dashT > 0) return 'dash';
            if (this.attackT > 0) return 'atk';
            if (this.lockT > 0) return 'hurt';
            if (this.ascentT > 0) return 'ascent';
            if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';
            if (this.landT > 0) return 'land';
            if (Math.abs(this.vx) > 40) return Math.abs(this.vx) < 150 ? 'walk' : 'run';

            return 'idle';
        }

        pickAnim() {
            const a = this.animKey();

            if (a !== this.anim) {
                this.anim = a;
                this.animT = 0;
            }
        }

        // the pose to draw now
        poseNow() {
            const a = this.anim,
                F = this.form;

            if (a.startsWith('skill:')) return this.skill ? this.skill.def.pose(this, this.skill) : 'idle_a';

            switch (a) {
                case 'death': {
                    const L = ANIMS.death.poses;

                    return L[Math.min(L.length - 1, Math.floor(this.deathT * ANIMS.death.fps))];
                }
                case 'sit':
                    return 'meditate';
                case 'heal':
                    return 'drink';
                case 'guard':
                    return 'ready';
                case 'block':
                    return this.firstPose('block', 'ready');
                case 'broken':
                    return this.firstPose('guard_break', 'knock');
                case 'dash':
                    return F ? 'speed' : 'run4';
                case 'atk': {
                    if (this.attackDir === 'up') return 'swordup';
                    if (this.attackDir === 'down') return 'pound';
                    if (!this.onGround && this.comboN === 0) return 'airslash';
                    if (!this.atk) return 'ready';

                    const L = this.atk.poses,
                        k = BW.clamp((this.atkDur - this.attackT) / this.atkDur, 0, 0.999);

                    return L[Math.floor(k * L.length)];
                }
                case 'hurt':
                    return this.lockT > 0.3 ? 'knock' : 'hurt';
                case 'item':
                    return ANIMS.item[this.itemKind] || 'taunt';
                case 'deflect':
                    return this.firstPose('parry_perfect', 'ready');
                case 'dodge':
                    return this.firstPose('dodge', 'tumble');
                case 'land':
                    return this.landHard ? 'slam' : 'crouch';
                case 'walk':
                    return 'walk';
                case 'ascent':
                    return 'flame';
                case 'jump':
                    return 'jump';
                case 'fall':
                    return 'midair';
                case 'run':
                    return ANIMS.run.poses[Math.floor(this.animT * ANIMS.run.fps) % ANIMS.run.poses.length];
                default:
                    if (this.game.state.hp <= 1 && this.game.state.maxHp > 1 && !F) return 'kneel';

                    return F
                        ? 'transformed'
                        : ANIMS.idle.poses[Math.floor(this.animT * ANIMS.idle.fps) % ANIMS.idle.poses.length];
            }
        }

        // the first of these poses that has a sprite (new art can be dropped in under these names, see docs/RONIN_SPRITES.md)
        firstPose(...names) {
            for (const n of names) if (BW.Assets.sprite(SPR(n))) return n;

            return names[names.length - 1];
        }

        // the transformed hero's own version of a pose (ronin_form_<pose>), when that sprite exists
        formPose(pose) {
            return this.form && BW.Assets.sprite(SPR('form_' + pose)) ? 'form_' + pose : pose;
        }

        // the ghost and counter code asks for sprites by animation name
        spriteFor(a) {
            return SPR({ dash: 'run4', idle: 'idle_a' }[a] || 'idle_a');
        }

        frameFor() {
            return 0;
        }

        draw(ctx, alpha) {
            const g = this.game;
            const x = lerp(this.px, this.x, alpha) + this.w / 2;
            const y = lerp(this.py, this.y, alpha) + this.h - this.lift;

            if (this.invulnT > 0 && this.state !== 'dead' && Math.floor(this.invulnT * 16) % 2 === 0 && this.lockT <= 0)
                return;

            const pose = this.formPose(this.poseNow()),
                name = SPR(pose);

            if (!BW.Assets.sprite(name)) return;

            // the second form burns: a crimson and cold-blue glow behind the body
            if (this.form || (this.skill && this.skill.name === 'transform')) {
                const k = 0.75 + 0.25 * Math.sin(g.time * 9);

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.5 * k;
                ctx.drawImage(BW.glowSprite('#ff3b30'), x - 90, y - 130, 180, 180);
                ctx.globalAlpha = 0.35 * k;
                ctx.drawImage(BW.glowSprite('#5a7dff'), x - 120, y - 150, 240, 220);
                ctx.restore();
                g.addLight(x, y - 50, 190, '#ff5a4a', 0.35);
            }

            if (this.glow > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.5 * this.glow;
                ctx.drawImage(BW.glowSprite('#cfe0ff'), x - 70, y - 100, 140, 140);
                ctx.restore();
            }

            let rot = this.lean;

            if (this.state === 'dead') rot = 0;

            BW.Assets.draw(ctx, name, 0, x, y, {
                flip: this.facing < 0,
                sx: this.sx,
                sy: this.sy,
                rot,
                flash: this.flash,
                alpha: this.veilT > 0 ? 0.5 : undefined,
                scale: BW.HERO_SCALE * poseScale(pose),
                rim: 0.3,
            });

            if (this.parryT > 0) this.drawParry(ctx, x, y);
            if (this.blocking) this.drawBlock(ctx, x, y);
            if (this.counterT > 0) this.drawCounter(ctx, x, y);
        }

        // the Shade gauge under the experience bar; while transformed it shows the form's time left
        drawGauge(ctx, x, y, alpha) {
            const st = this.game.state,
                t = this.game.time,
                w = 150,
                full = (st.shade || 0) >= TUNE.shade.max && !this.form,
                ratio = this.form
                    ? BW.clamp(this.formT / this.formMax(), 0, 1)
                    : BW.clamp((st.shade || 0) / TUNE.shade.max, 0, 1);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(8,10,14,0.65)';
            ctx.fillRect(x, y - 4, w, 9);

            const grd = ctx.createLinearGradient(x, 0, x + w, 0);

            grd.addColorStop(0, this.form ? '#ff5a4a' : '#5a6fd8');
            grd.addColorStop(1, this.form ? '#ffb25a' : '#c23a4a');
            ctx.fillStyle = grd;
            ctx.fillRect(x, y - 4, w * ratio, 9);

            if (full) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = alpha * (0.35 + 0.35 * Math.sin(t * 8));
                ctx.fillStyle = '#ffd0c8';
                ctx.fillRect(x - 3, y - 7, w + 6, 15);
            }

            ctx.restore();
            ctx.save();
            ctx.globalAlpha = alpha * 0.5;
            ctx.strokeStyle = 'rgba(230,220,200,0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 0.5, y - 4.5, w + 1, 10);
            ctx.restore();
        }
    }

    BW.Ronin = Ronin;
    BW.RoninFx = { Crescent, Spike, Giant, TUNE, SKILLS, COMBO };

    // the hero
    BW.CHARACTERS = {
        ronin: {
            id: 'ronin',
            name: 'The Faceless Ronin',
            sprite: 'ronin_idle_a',
            desc: 'Left among the dead with his face cut away, so the bells cannot find him. Heavy blades, a shade that burns, and a second form that unleashes a dozen new skills.',
        },
    };
})(window.BW);

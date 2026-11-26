'use strict';

// The Faceless Ronin: a second hero to start the journey with. A straw-hatted swordsman with a heavier, more physical
// moveset than the Bellweaver, and a second form.
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
        Phys = BW.Phys,
        Base = BW.Player;

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
        idle: { poses: ['idle_a', 'stand_d'], fps: 2.2 },
        run: { poses: ['run1', 'run2', 'run3', 'run2'], fps: 11 },
        death: { poses: ['crumple', 'crawl', 'dead'], fps: 2.6, hold: true },
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
            pose: (p, s) => (s.t < 0.55 ? 'burst' : s.t < 1.55 ? 'cross' : 'return'),
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
    class Ronin extends Base {
        reset(x, y) {
            super.reset(x, y);

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
        }

        get isRonin() {
            return true;
        }

        // ---------------------------------------------------------------- the second form
        beginForm() {
            this.form = true;
            this.formT = TUNE.form.time;
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

            st.shade = Math.min(TUNE.shade.max, before + n);

            if (before < TUNE.shade.max && st.shade >= TUNE.shade.max) {
                this.game.hud.pulse('shade');
                this.game.teach('shade');
                BW.Audio.play('shrine', { vol: 0.6, rate: 1.3, minGap: 0 });
            }
        }

        // called by Game.resolvePlayerAttack for every enemy a blow of ours lands on
        onHitEnemy(e, r) {
            if (this.form) this.formT = Math.min(TUNE.form.max, this.formT + TUNE.form.hitTime);
            else this.addShade(r === 'kill' ? TUNE.shade.kill : TUNE.shade.hit);

            BW.Audio.play('slashbody', { vol: 0.5, vary: 0.12, minGap: 0.1 });
        }

        // a blow of ours against everything in `box`: `mul` is its weight (the form makes every blow heavier)
        strikeAt(box, mul, hits, dir) {
            this.hitMul = mul * (this.form ? TUNE.form.dmg : 1);
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
            this.speedMul = this.form ? TUNE.form.speed : 1;

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

            super.update(dt, inp);
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

                if (this.form && this.formT > TUNE.ult.minTime) {
                    this.startSkill('ult');

                    return true;
                }

                if (!this.form) {
                    g.hud.deny('shade');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                }
            }

            // strike in the middle of a dash: Dash Slash, or the Clashing Shadow Slash when transformed
            if (inp.pressed.attack && (this.dashT > 0 || this.dashWin > 0)) {
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

                if (!(this.cd.whirl > 0)) {
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
                (this.form || st.silk >= TUNE.void.silk)
            ) {
                this.startSkill('charge');

                return true;
            }

            return false;
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
                // up and down strikes keep the Weaver's rules (the down strike bounces); the cut is just a little heavier
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
            this.comboT = this.atkDur + TUNE.combo.window;

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
            if (this.attackDir !== 'side' || !this.atk) return super.attackBox();

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
                // up / down: the Weaver's timings, with the heavier cut
                this.hitMul = this.form ? TUNE.form.dmg : 1;
                super.updateAttack();
                this.hitMul = 1;

                return;
            }

            const C = this.atk,
                speed = this.form ? TUNE.form.atk : 1,
                age = (this.atkDur - this.attackT) * speed;

            if (age < C.hit[0] || age > C.hit[1]) return;

            const box = this.attackBox();

            this.hitMul = C.mul * (this.form ? TUNE.form.dmg : 1);

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
            super.deflect(srcX, opts);
            this.addShade(TUNE.shade.parry);

            if (this.form) this.formT = Math.min(TUNE.form.max, this.formT + TUNE.form.parryTime);
        }
        perfectDodge(srcX, opts) {
            super.perfectDodge(srcX, opts);
            this.addShade(TUNE.shade.dodge);

            if (this.form && !(this.cd.illusion > 0) && this.state === 'normal') this.startSkill('illusion');
        }
        hurt(dmg, srcX, opts = {}) {
            if (this.skillInv > 0) return false;

            const st = this.game.state,
                hp = st.hp,
                r = super.hurt(dmg, srcX, opts);

            if (r && st.hp < hp) {
                this.skill = null;
                this.lift = 0;
                this.atk = null;

                if (this.form) this.formT -= TUNE.form.hurtTime;
            }

            return r;
        }
        die() {
            this.skill = null;
            this.lift = 0;
            this.endForm();
            super.die();
        }

        // ---------------------------------------------------------------- animation
        animKey() {
            if (this.state === 'dead') return 'death';
            if (this.skill) return 'skill:' + this.skill.name;
            if (this.state === 'rest') return 'sit';
            if (this.state === 'heal') return 'heal';
            if (this.parryT > 0 || this.guardT > 0.3) return 'guard';
            if (this.dashT > 0) return 'dash';
            if (this.attackT > 0) return 'atk';
            if (this.lockT > 0) return 'hurt';
            if (this.ascentT > 0) return 'ascent';
            if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';

            return Math.abs(this.vx) > 40 ? 'run' : 'idle';
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
                case 'dash':
                    return F ? 'speed' : 'run4';
                case 'atk': {
                    if (this.attackDir === 'up') return 'swordup';
                    if (this.attackDir === 'down') return 'pound';
                    if (!this.onGround && this.comboN === 0) return 'airslash';

                    const L = this.atk.poses,
                        k = BW.clamp((this.atkDur - this.attackT) / this.atkDur, 0, 0.999);

                    return L[Math.floor(k * L.length)];
                }
                case 'hurt':
                    return 'hurt';
                case 'ascent':
                    return 'flame';
                case 'jump':
                    return 'jump';
                case 'fall':
                    return 'midair';
                case 'run':
                    return ANIMS.run.poses[Math.floor(this.animT * ANIMS.run.fps) % ANIMS.run.poses.length];
                default:
                    return F
                        ? 'transformed'
                        : ANIMS.idle.poses[Math.floor(this.animT * ANIMS.idle.fps) % ANIMS.idle.poses.length];
            }
        }

        // the Weaver's ghost and counter code asks for sprites by animation name
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

            const pose = this.poseNow(),
                name = SPR(pose);

            if (!BW.Assets.sprite(name)) return super.draw(ctx, alpha);

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
                scale: BW.HERO_SCALE * poseScale(pose),
                rim: 0.3,
            });

            if (this.parryT > 0) this.drawParry(ctx, x, y);
            if (this.counterT > 0) this.drawCounter(ctx, x, y);
        }

        // the Shade gauge under the experience bar; while transformed it shows the form's time left
        drawGauge(ctx, x, y, alpha) {
            const st = this.game.state,
                t = this.game.time,
                w = 150,
                full = (st.shade || 0) >= TUNE.shade.max && !this.form,
                ratio = this.form
                    ? BW.clamp(this.formT / TUNE.form.max, 0, 1)
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

    // the heroes you can start the journey as
    BW.CHARACTERS = {
        weaver: {
            id: 'weaver',
            name: 'The Bellweaver',
            sprite: 'hero_idle',
            desc: 'Quick and precise. Needle, silk and the Answering Toll: a duelist who earns every opening.',
        },
        ronin: {
            id: 'ronin',
            name: 'The Faceless Ronin',
            sprite: 'ronin_idle_a',
            desc: 'Heavy blades and a shade that burns. A three-hit combo, charged slashes, and a second form that unleashes a dozen new skills.',
        },
    };
})(window.BW);

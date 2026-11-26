'use strict';

// Enemies. Every attack has a readable wind-up and a recovery window that can be punished.
(function (BW) {
    const T = BW.T,
        Phys = BW.Phys;

    class Enemy {
        constructor(game, def, o) {
            this.game = game;
            this.def = def;
            this.kind = def.type;
            this.w = o.w;
            this.h = o.h;
            this.x = (def.x + 0.5) * T - this.w / 2;
            this.y = (def.y + 1) * T - this.h;
            this.px = this.x;
            this.py = this.y;
            this.homeX = this.x;
            this.homeY = this.y;
            this.vx = 0;
            this.vy = 0;
            this.facing = def.facing || (game.player && game.player.cx > this.x ? 1 : -1);
            this.maxHp = o.hp + (def.variant === 'pale' ? 1 : 0);

            if (!o.fixedHp) this.maxHp = BW.Difficulty.scaleHp(game, this.maxHp);

            const D = BW.Difficulty.get(game.state);

            this.speed = o.fixedHp ? 1 : D.speed;
            this.hp = this.maxHp;
            this.state = 'idle';
            this.stateT = 0;
            this.cool = BW.rand(0.2, 0.8);
            this.flash = 0;
            this.dead = false;
            this.dying = 0;
            this.stun = 0;
            this.gravity = o.gravity !== false;
            this.onGround = false;
            this.kb = o.kb != null ? o.kb : 1;
            this.glints = o.glints || 2;
            this.xp = Math.round((o.xp || 6) * (def.variant === 'pale' ? 1.5 : 1));
            this.variant = def.variant;
            this.persistKey = BW.enemyPersistKey(game.room && game.room.id, def);
            this.harmful = true;
            this.t = Math.random() * 10;
            this.sx = 1;
            this.sy = 1;
            this.parried = 0;
            this.frozenT = 0;
            this.barA = 0;
            this.barT = 0;
            this.barHp = this.hp; // health bar: opacity, time left after a hit, trailing chip value
        }
        get cx() {
            return this.x + this.w / 2;
        }
        get cy() {
            return this.y + this.h / 2;
        }
        hurtbox() {
            return { x: this.x, y: this.y, w: this.w, h: this.h };
        }
        attackBoxes() {
            return null;
        }
        // True while the enemy is mid-attack (a lunge, dive or thrust); a body brush while it patrols doesn't count as a blow to dodge
        isStriking() {
            return this.state === 'lunge' || this.state === 'dive' || this.state === 'thrust' || this.state === 'leap';
        }
        setState(s) {
            this.state = s;
            this.stateT = 0;
        }
        playerDelta() {
            const p = this.game.player;

            return { dx: p.cx - this.cx, dy: p.cy - this.cy, p };
        }
        sees(range, maxDy = 9999) {
            const { dx, dy, p } = this.playerDelta();

            if (p.state === 'dead' || Math.abs(dx) > range || Math.abs(dy) > maxDy) return false;

            return Phys.los(this.game.room, this.cx, this.cy - 6, p.cx, p.cy - 10);
        }

        // The player parried this enemy's blow: it is thrown back and left open for a riposte.
        onParried(p) {
            if (this.dead) return;

            const dir = BW.sign(this.cx - p.cx) || 1;

            this.parried = 1.0;
            this.stun = 0.5;
            this.flash = 1;
            this.cool = Math.max(this.cool, 0.8);
            this.vx = dir * Math.max(220, 380 * this.kb);

            if (this.gravity) {
                if (this.onGround) this.vy = -140;
            } else this.vy = -120;

            if (this.canRecover && this.state !== 'recover') this.setState('recover');
        }

        // The player slipped this enemy's blow with a perfectly timed dash (Shadow Step): it freezes for a counter combo.
        onDodged(p) {
            if (this.dead) return;

            this.onParried(p);
            this.parried = 1.6;
            this.frozenT = 1.2;
            this.stun = 1.2;
            this.vx *= 0.25;
        }

        // returns 'hit', 'kill' or 'blocked'
        damage(n, dir, src) {
            if (this.dead) return null;

            if (this.blocks && this.blocks(dir, src)) {
                this.flash = 0.25;
                BW.Audio.play('clink', { vary: 0.08 });

                this.game.fx.burst(this.cx + (src ? BW.sign(src.cx - this.cx) * this.w * 0.45 : 0), this.cy - 6, 8, {
                    color: ['#ffffff', '#ffe9a8'],
                    kind: 'spark',
                    speed: 380,
                    life: 0.22,
                });

                return 'blocked';
            }

            if (this.parried > 0) n *= 2;

            this.hp -= n;
            this.flash = 1;
            this.barT = 3;

            if (!this.boss) this.game.codexSee(this.kind);

            const kdir = src ? BW.sign(this.cx - src.cx) || 1 : 1;

            if (dir === 'down') {
                this.vy = Math.max(this.vy, 120 * this.kb);
            } else if (dir === 'up') {
                this.vy = -220 * this.kb;
            } else {
                this.vx = kdir * 260 * this.kb * (this.frozenT > 0 ? 0.35 : 1);

                if (this.gravity && this.onGround) this.vy = -120 * this.kb * (this.frozenT > 0 ? 0.3 : 1);
            }

            this.stun = this.frozenT > 0 ? Math.max(this.stun, 0.4) : 0.12 * this.kb;
            this.onHit && this.onHit(dir, src);

            if (this.hp <= 0) {
                this.kill(kdir);

                return 'kill';
            }

            return 'hit';
        }

        markCleared() {
            const st = this.game.state;

            if (this.persistKey && st) {
                if (!st.cleared) st.cleared = {};

                st.cleared[this.persistKey] = true;
            }
        }

        kill(kdir) {
            const g = this.game;

            this.markCleared();
            this.dead = true;
            this.dying = 0.45;
            this.harmful = false;
            this.vx = kdir * 200;
            this.vy = -260;
            BW.Audio.play('die', { vary: 0.1 });

            g.fx.burst(this.cx, this.cy, 22, {
                color: this.deathColors || ['#1b1720', '#2b2433', '#ff9a3c', '#ffd27a'],
                speed: 300,
                life: 0.6,
                kind: 'shard',
                size: 5,
                grav: 500,
            });

            g.fx.burst(this.cx, this.cy, 10, {
                color: this.deathGlow || ['#ffb45a', '#ffe1a0'],
                speed: 160,
                life: 0.5,
                kind: 'glow',
                size: 10,
                add: true,
            });

            g.fx.ring(this.cx, this.cy, 6, 60, 0.35, this.deathRing || '#ffd9a0', 2);
            g.spawnGlints(this.cx, this.cy, this.glints);
            g.stats.kills = (g.stats.kills || 0) + 1;

            if (!this.boss) g.codexKill(this.kind);
            if (!this.noXp) g.gainXp(this.xp);
        }

        update(dt) {
            if (!this.dead) dt *= this.speed;

            this.updateBar(dt);
            this.px = this.x;
            this.py = this.y;
            this.t += dt;
            this.stateT += dt;

            if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);

            this.sx = BW.damp(this.sx, 1, 10, dt);
            this.sy = BW.damp(this.sy, 1, 10, dt);

            if (this.dead) {
                this.dying -= dt;
                this.vy += 1600 * dt;
                this.x += this.vx * dt;
                this.y += this.vy * dt;

                return;
            }

            if (this.cool > 0) this.cool -= dt;

            if (this.stun > 0) {
                this.stun -= dt;
            }

            if (this.parried > 0) this.parried -= dt;
            if (this.frozenT > 0) this.frozenT -= dt;

            this.think(dt);
            this.physics(dt);
        }

        physics(dt) {
            const room = this.game.room;

            if (this.gravity) {
                this.vy = Math.min(this.vy + 2400 * dt, 900);

                if (Phys.moveX(room, this, this.vx * dt)) this.hitWall && this.hitWall();

                const res = Phys.moveY(room, this, this.vy * dt);

                if (res.landed) {
                    if (!this.onGround) this.onLandE && this.onLandE();

                    this.vy = 0;
                    this.onGround = true;
                } else this.onGround = Phys.onGround(room, this) && this.vy >= 0;

                if (res.ceil) this.vy = Math.max(0, this.vy);

                // ground friction, except while it is lunging (a creature can also list states that should carry on sliding)
                if (
                    this.onGround &&
                    this.stun <= 0 &&
                    this.state !== 'lunge' &&
                    this.state !== 'leap' &&
                    !(this.slides && this.slides[this.state])
                )
                    this.vx *= Math.exp(-10 * dt);

                if (Phys.touchesHazard(room, this)) {
                    this.hp = 0;
                    this.noXp = true;
                    this.kill(0);
                }
            } else {
                if (Phys.moveX(room, this, this.vx * dt)) {
                    this.vx *= -0.3;
                    this.hitWall && this.hitWall();
                }

                const res = Phys.moveY(room, this, this.vy * dt);

                if (res.landed || res.ceil) {
                    this.vy *= -0.3;
                    this.hitWall && this.hitWall();
                }
            }

            if (this.y > room.ph + 200) {
                this.markCleared();
                this.dead = true;
                this.dying = 0;
            }
        }

        // Is there ground ahead (and no hazard) in direction d?
        groundAhead(d) {
            const room = this.game.room;
            const fx = d > 0 ? this.x + this.w + 4 : this.x - 4;

            const tx = Math.floor(fx / T),
                ty = Math.floor((this.y + this.h + 4) / T);

            if (room.hazard(tx, ty) || room.hazard(tx, ty - 1)) return false;
            if (room.solid(tx, ty - 1)) return false;

            return room.solid(tx, ty) || room.oneway(tx, ty);
        }

        // ---- health bar: appears when you get close or land a hit, and fades away again
        updateBar(dt) {
            const p = this.game.player;

            const near =
                !this.dead && !this.boss && p.state !== 'dead' && Math.hypot(p.cx - this.cx, p.cy - this.cy) < 340;

            if (
                !this.met &&
                !this.dead &&
                !this.boss &&
                p.state !== 'dead' &&
                Math.hypot(p.cx - this.cx, p.cy - this.cy) < 480
            ) {
                this.met = true;
                this.game.codexSee(this.kind);
            }

            if (this.barT > 0) this.barT -= dt;

            const show = !this.dead && !this.boss && (near || this.barT > 0);

            this.barA = BW.damp(this.barA, show ? 1 : 0, show ? 12 : 5, dt);

            if (this.barHp > this.hp) this.barHp = Math.max(this.hp, this.barHp - dt * this.maxHp * 0.9);
            else this.barHp = this.hp;
        }

        drawBar(ctx, alpha) {
            if (this.dead || this.boss || this.barA < 0.02) return;

            const a = this.barA * (this.game.hudAlpha != null ? this.game.hudAlpha : 1);

            if (a < 0.02) return;

            const x = BW.lerp(this.px, this.x, alpha) + this.w / 2,
                y = BW.lerp(this.py, this.y, alpha) - 20;

            const n = this.maxHp,
                w = BW.clamp(30 + n * 7, 52, 96),
                h = 7,
                left = x - w / 2;

            const k = BW.clamp(this.hp / n, 0, 1),
                kc = BW.clamp(this.barHp / n, 0, 1);

            ctx.save();
            ctx.globalAlpha = a;
            // name tag
            ctx.font = `600 13px ${BW.FONT_T}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(4,5,8,0.85)';
            ctx.fillStyle = this.variant === 'pale' ? '#f4ecd6' : '#e9dcc0';

            const name = (this.variant === 'pale' ? 'Pale ' : '') + BW.enemyName(this);

            ctx.strokeText(name, x, y - 5);
            ctx.fillText(name, x, y - 5);
            // frame
            ctx.fillStyle = 'rgba(6,8,12,0.82)';
            BW.roundRect(ctx, left - 2.5, y - 2.5, w + 5, h + 5, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(236,222,190,0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // trailing chip, then the live health
            ctx.fillStyle = '#f2f0e6';
            ctx.fillRect(left, y, w * kc, h);

            const col = k > 0.5 ? ['#ffe9b0', '#e0a63c'] : k > 0.25 ? ['#ffc27a', '#d9732a'] : ['#ff8a7a', '#c2281f'];
            const g = ctx.createLinearGradient(0, y, 0, y + h);

            g.addColorStop(0, col[0]);
            g.addColorStop(1, col[1]);
            ctx.fillStyle = g;
            ctx.fillRect(left, y, w * k, h);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(left, y, w * k, 2);

            // segment ticks, one per point of health, for the small ones
            if (n <= 12) {
                ctx.fillStyle = 'rgba(6,8,12,0.75)';

                for (let i = 1; i < n; i++) ctx.fillRect(left + (w * i) / n - 0.5, y, 1, h);
            }

            ctx.restore();
        }

        drawSprite(ctx, alpha, sprite, frame, extra = {}) {
            const x = BW.lerp(this.px, this.x, alpha) + this.w / 2;
            const y = BW.lerp(this.py, this.y, alpha) + this.h + (extra.oy || 0);
            const deadA = this.dead ? BW.clamp(this.dying / 0.45, 0, 1) : 1;

            const ok = BW.Assets.draw(ctx, sprite, frame, x, y, {
                flip: this.facing < 0,
                sx: this.sx * (extra.sx || 1),
                sy: this.sy * (extra.sy || 1),
                rot: (extra.rot || 0) + (this.dead ? (1 - deadA) * this.facing * 1.2 : 0),
                flash: Math.max(this.flash, this.dead ? 0.6 : 0),
                alpha: deadA * (extra.alpha != null ? extra.alpha : 1),
                variant: this.variant,
                scale: extra.scale,
                rim: this.rim != null ? this.rim : this.variant === 'pale' ? 0.18 : 0.3,
            });

            if (!this.dead)
                this.game.addLight(
                    x + this.facing * this.w * 0.3,
                    y - this.h * 0.65,
                    70,
                    this.lightColor || '#ff9a3c',
                    this.lightA != null ? this.lightA : 0.32,
                );
            if (!ok) this.drawFallback(ctx, x, y, deadA);

            return { x, y };
        }

        drawFallback(ctx, x, y, a) {
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(x, y);
            ctx.scale(this.facing * this.sx, this.sy);
            ctx.fillStyle = this.flash > 0.3 ? '#fff' : this.variant === 'pale' ? '#8d8a94' : '#231d2b';
            ctx.beginPath();
            ctx.ellipse(0, -this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff9a3c';
            ctx.beginPath();
            ctx.arc(this.w * 0.28, -this.h * 0.62, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // eye glow that intensifies during wind-ups
        drawEyeGlow(ctx, x, y, k) {
            if (k <= 0) return;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.75 * k;
            ctx.drawImage(BW.glowSprite('#ffb35a'), x - 26, y - 26, 52, 52);
            ctx.restore();
        }
    }

    // ---------------------------------------------------------------- Crawler: patrols, rears up, lunges
    class Crawler extends Enemy {
        constructor(game, def) {
            super(game, def, { w: 58, h: 32, hp: 3, glints: 2, xp: 8, kb: 1 });
            this.state = 'patrol';
            this.canRecover = true;
        }
        think(dt) {
            const s = this.state;

            if (this.stun > 0) return;

            if (s === 'patrol') {
                if (!this.groundAhead(this.facing)) this.facing *= -1;

                this.vx = this.facing * 55;

                const { dx, dy } = this.playerDelta();

                if (
                    this.cool <= 0 &&
                    Math.abs(dy) < 70 &&
                    BW.sign(dx) === this.facing &&
                    Math.abs(dx) < 240 &&
                    this.sees(240, 70)
                ) {
                    this.setState('windup');
                    this.vx = 0;
                    BW.Audio.play('windup', { vol: 0.6 });
                }
            } else if (s === 'windup') {
                this.vx = 0;
                this.sy = 1.12 + Math.sin(this.stateT * 60) * 0.03;
                this.sx = 0.92;

                if (this.stateT > 0.45) {
                    this.setState('lunge');
                    this.vx = this.facing * 430;
                    this.vy = -140;
                    BW.Audio.play('hop', { vol: 0.6 });
                    this.sx = 1.25;
                    this.sy = 0.85;
                }
            } else if (s === 'lunge') {
                if (!this.groundAhead(this.facing) && this.onGround) this.vx = 0;

                if (this.stateT > 0.34) {
                    this.setState('recover');
                }
            } else if (s === 'recover') {
                this.vx *= Math.exp(-12 * dt);

                if (this.stateT > 0.6) {
                    this.setState('patrol');
                    this.cool = 1.0;
                }
            }
        }
        hitWall() {
            if (this.state === 'patrol') this.facing *= -1;
        }
        draw(ctx, alpha) {
            const s = this.state;
            const sprite = s === 'windup' ? 'crawler_windup' : s === 'lunge' ? 'crawler_lunge' : 'crawler_walk';
            const fr = Math.floor(this.t * 8);
            const bob = s === 'patrol' ? Math.abs(Math.sin(this.t * 9)) * 0.05 : 0;

            const p = this.drawSprite(ctx, alpha, BW.Assets.sprite(sprite) ? sprite : 'crawler_walk', fr, {
                sy: 1 + bob,
                rot: s === 'windup' ? -this.facing * 0.12 : 0,
            });

            if (s === 'windup') this.drawEyeGlow(ctx, p.x + this.facing * 20, p.y - 20, Math.min(1, this.stateT / 0.3));
        }
    }

    // ---------------------------------------------------------------- Flyer: approaches, hovers, dives
    class Flyer extends Enemy {
        constructor(game, def) {
            super(game, def, { w: 38, h: 34, hp: 2, glints: 2, xp: 8, kb: 1.3, gravity: false });
            this.state = 'idle';
            this.target = { x: 0, y: 0 };
            this.side = 1;
            this.canRecover = true;
        }
        think(dt) {
            const s = this.state,
                p = this.game.player;

            const flap = Math.sin(this.t * 14);

            if (this.stun > 0) {
                this.vx *= Math.exp(-4 * dt);
                this.vy *= Math.exp(-4 * dt);

                if (s === 'windup' || s === 'dive') this.setState('recover');

                return;
            }

            const homeD = Math.hypot(this.cx - (this.homeX + this.w / 2), this.cy - (this.homeY + this.h / 2));

            if (s === 'idle') {
                const tx = this.homeX + Math.sin(this.t * 0.7) * 30,
                    ty = this.homeY + Math.cos(this.t * 1.1) * 14;

                this.steer(tx, ty, 70, dt);

                if (this.sees(330, 300) && p.state !== 'dead') {
                    this.setState('chase');
                    BW.Audio.play('flutter', { vol: 0.5 });
                }
            } else if (s === 'chase') {
                if (homeD > 720 || !this.sees(520, 520)) {
                    if (this.stateT > 1.2) this.setState('return');
                }

                this.side = this.cx < p.cx ? -1 : 1;

                const tx = p.cx + this.side * 130 - this.w / 2,
                    ty = p.y - 120;

                this.steer(tx, ty, 165, dt);
                this.facing = p.cx > this.cx ? 1 : -1;

                const near = Math.hypot(this.x - tx, this.y - ty) < 50;

                if ((near && this.stateT > 0.6) || this.stateT > 2.6) {
                    if (this.cool <= 0 && Phys.los(this.game.room, this.cx, this.cy, p.cx, p.cy)) {
                        this.setState('windup');
                        BW.Audio.play('windup', { vol: 0.5 });
                    }
                }
            } else if (s === 'windup') {
                this.vx *= Math.exp(-8 * dt);
                this.vy = BW.damp(this.vy, -40, 6, dt);
                this.facing = p.cx > this.cx ? 1 : -1;

                if (this.stateT > 0.5) {
                    const dx = p.cx - this.cx,
                        dy = p.cy - this.cy,
                        d = Math.hypot(dx, dy) || 1;

                    this.vx = (dx / d) * 540;
                    this.vy = (dy / d) * 540;
                    this.setState('dive');
                    BW.Audio.play('dash', { vol: 0.35, rate: 1.4 });
                }
            } else if (s === 'dive') {
                if (this.stateT > 0.62) this.setState('recover');
            } else if (s === 'recover') {
                this.vx *= Math.exp(-5 * dt);
                this.vy = BW.damp(this.vy, -60, 3, dt);

                if (this.stateT > 0.8) {
                    this.setState('chase');
                    this.cool = 0.6;
                }
            } else if (s === 'return') {
                this.steer(this.homeX, this.homeY, 140, dt);

                if (homeD < 20) this.setState('idle');
                if (this.sees(300, 260) && homeD < 400) this.setState('chase');
            }

            void flap;
        }
        hitWall() {
            if (this.state === 'dive') this.setState('recover');
        }
        steer(tx, ty, speed, dt) {
            const dx = tx - this.x,
                dy = ty - this.y,
                d = Math.hypot(dx, dy);

            const vx = d > 1 ? (dx / d) * Math.min(speed, d * 3) : 0,
                vy = d > 1 ? (dy / d) * Math.min(speed, d * 3) : 0;

            this.vx = BW.damp(this.vx, vx, 4, dt);
            this.vy = BW.damp(this.vy, vy, 4, dt);
        }
        draw(ctx, alpha) {
            const s = this.state;
            const sprite = s === 'windup' ? 'flyer_windup' : s === 'dive' ? 'flyer_dive' : 'flyer_fly';
            const fr = Math.floor(this.t * 16);
            const bob = s === 'dive' ? 0 : Math.sin(this.t * 5) * 3;
            const rot = s === 'dive' ? Math.atan2(this.vy, Math.abs(this.vx)) * 0.6 * this.facing : 0;

            const p = this.drawSprite(ctx, alpha, BW.Assets.sprite(sprite) ? sprite : 'flyer_fly', fr, {
                oy: bob,
                rot,
            });

            const k = s === 'windup' ? Math.min(1, this.stateT / 0.35) : s === 'dive' ? 0.7 : 0.25;

            this.drawEyeGlow(ctx, p.x - this.facing * 8, p.y - 12 + bob, k);
        }
    }

    // ---------------------------------------------------------------- Sentinel: shielded front, pike thrust
    class Sentinel extends Enemy {
        constructor(game, def) {
            super(game, def, { w: 46, h: 80, hp: 6, glints: 5, xp: 20, kb: 0.25 });
            this.state = 'patrol';
            this.turnT = 0;
            this.canRecover = true;
        }
        blocks(dir, src) {
            if (this.state === 'recover' || dir === 'down' || dir === 'lance' || !src) return false;

            return BW.sign(src.cx - this.cx) === this.facing;
        }
        attackBoxes() {
            if (this.state !== 'thrust') return null;

            return [
                this.facing > 0
                    ? { x: this.x + this.w - 4, y: this.y + 22, w: 112, h: 26 }
                    : { x: this.x - 108, y: this.y + 22, w: 112, h: 26 },
            ];
        }
        think(dt) {
            const s = this.state,
                { dx, dy } = this.playerDelta();

            if (this.stun > 0 && s !== 'thrust') return;

            const want = BW.sign(dx) || this.facing;

            if (s === 'patrol') {
                if (
                    !this.groundAhead(this.facing) ||
                    (Math.abs(this.x - this.homeX) > 4 * T && BW.sign(this.homeX - this.x) !== this.facing)
                )
                    this.facing *= -1;

                this.vx = this.facing * 38;

                if (this.sees(380, 110)) this.setState('approach');
            } else if (s === 'approach') {
                if (want !== this.facing) {
                    this.turnT += dt;
                    this.vx = 0;

                    if (this.turnT > 0.42) {
                        this.facing = want;
                        this.turnT = 0;
                    }
                } else {
                    this.turnT = 0;
                    this.vx = this.groundAhead(this.facing) && Math.abs(dx) > 90 ? this.facing * 62 : 0;

                    if (Math.abs(dx) < 140 && Math.abs(dy) < 70 && this.cool <= 0) {
                        this.setState('windup');
                        this.vx = 0;
                        BW.Audio.play('windup', { vol: 0.8 });
                    }
                }

                if (!this.sees(520, 160) && this.stateT > 1.5) this.setState('patrol');
            } else if (s === 'windup') {
                this.vx = 0;
                this.sx = 0.95;

                if (this.stateT > 0.62) {
                    this.setState('thrust');
                    BW.Audio.play('thrust');
                    this.vx = this.groundAhead(this.facing) ? this.facing * 260 : 0;
                }
            } else if (s === 'thrust') {
                if (!this.groundAhead(this.facing)) this.vx = 0;

                if (this.stateT > 0.18) {
                    this.setState('recover');
                    this.vx = 0;
                }
            } else if (s === 'recover') {
                this.vx = 0;

                if (this.stateT > 0.95) {
                    this.setState('approach');
                    this.cool = 0.7;
                }
            }
        }
        draw(ctx, alpha) {
            const s = this.state;
            let sprite = 'sentinel_walk';

            if (s === 'windup') sprite = 'sentinel_windup';
            else if (s === 'thrust') sprite = 'sentinel_thrust';
            else if (s === 'recover') sprite = 'sentinel_recover';

            if (!BW.Assets.sprite(sprite)) sprite = 'sentinel_walk';

            const walking = (s === 'patrol' || s === 'approach') && Math.abs(this.vx) > 5;
            const fr = walking ? Math.floor(this.t * 6) : 0;

            const p = this.drawSprite(ctx, alpha, sprite, fr, {
                rot: s === 'windup' ? -this.facing * 0.06 : s === 'recover' ? this.facing * 0.05 : 0,
                sy: walking ? 1 + Math.abs(Math.sin(this.t * 6)) * 0.03 : 1,
            });

            if (s === 'windup') {
                const k = Math.min(1, this.stateT / 0.4);

                this.drawEyeGlow(ctx, p.x + this.facing * 12, p.y - 62, k);
                // glint along the pike tip to telegraph the reach
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = BW.rgba('#ffe2b0', 0.5 * k);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - 38);
                ctx.lineTo(p.x + this.facing * (40 + 70 * k), p.y - 38);
                ctx.stroke();
                ctx.restore();
            }

            if (s === 'thrust') {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = 'rgba(255,230,180,0.35)';

                const b = this.attackBoxes()[0];

                ctx.fillRect(b.x, b.y + 8, b.w, 10);
                ctx.restore();
            }
        }
    }

    // ---------------------------------------------------------------- Spitter: swells, then fires a silk glob
    class Spitter extends Enemy {
        constructor(game, def) {
            super(game, def, { w: 56, h: 38, hp: 3, glints: 3, xp: 12, kb: 0.6, gravity: !def.hang });
            this.hang = def.hang || 0;

            if (this.hang) {
                this.anchorX = this.x + this.w / 2;
                this.anchorY = def.y * T;
                this.y = this.anchorY + this.hang * T - this.h;
                this.homeY = this.y;
                this.swing = 0;
            }

            this.state = 'idle';
            this.cool = BW.rand(0.5, 1.2);
        }
        think(dt) {
            const s = this.state,
                p = this.game.player;

            if (this.hang) {
                this.swing = BW.damp(this.swing, 0, 1.5, dt);
                this.x = this.anchorX - this.w / 2 + Math.sin(this.t * 1.3) * 6 + this.swing;
                this.y = this.homeY + Math.sin(this.t * 2.1) * 4;
                this.vx = 0;
                this.vy = 0;
            }

            if (this.stun > 0) return;

            this.facing = p.cx > this.cx ? 1 : -1;

            if (s === 'idle') {
                if (this.cool <= 0 && this.sees(470, 380)) {
                    this.setState('windup');
                    BW.Audio.play('windup', { vol: 0.5, rate: 1.3 });
                }
            } else if (s === 'windup') {
                this.sx = 1 + this.stateT * 0.35;
                this.sy = 1 + this.stateT * 0.25;

                if (this.stateT > 0.68) {
                    const ox = this.cx + this.facing * 16,
                        oy = this.cy - 2;

                    const dx = p.cx - ox,
                        dy = p.cy - 6 - oy,
                        d = Math.hypot(dx, dy) || 1;

                    this.game.spawnEnemyShot(ox, oy, (dx / d) * 240, (dy / d) * 240);
                    BW.Audio.play('spit', { vary: 0.1 });
                    this.sx = 0.8;
                    this.sy = 1.2;
                    this.setState('idle');
                    this.cool = 1.8;
                }
            }
        }
        onHit(dir, src) {
            if (this.hang) this.swing = (src ? BW.sign(this.cx - src.cx) : 1) * 26;
        }
        physics(dt) {
            if (this.hang) {
                if (this.dead) return;

                return;
            }

            super.physics(dt);
        }
        draw(ctx, alpha) {
            if (this.hang && !this.dead) {
                const x = BW.lerp(this.px, this.x, alpha) + this.w / 2,
                    y = BW.lerp(this.py, this.y, alpha);

                ctx.strokeStyle = 'rgba(235,235,225,0.55)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(this.anchorX, this.anchorY);
                ctx.lineTo(x, y + 6);
                ctx.stroke();
            }

            const s = this.state;
            const sprite = s === 'windup' && BW.Assets.sprite('spitter_windup') ? 'spitter_windup' : 'spitter_idle';

            const p = this.drawSprite(ctx, alpha, sprite, Math.floor(this.t * 6), {
                rot: this.hang ? this.swing * 0.01 : 0,
            });

            if (s === 'windup') this.drawEyeGlow(ctx, p.x, p.y - 18, Math.min(1, this.stateT / 0.5));
        }
    }

    // ---------------------------------------------------------------- Hopper: crouches, leaps, lands stunned
    class Hopper extends Enemy {
        constructor(game, def) {
            super(game, def, { w: 42, h: 42, hp: 4, glints: 3, xp: 14, kb: 0.8 });
            this.state = 'idle';
            this.cool = BW.rand(0.3, 1.0);
            this.canRecover = true;
        }
        think(dt) {
            const s = this.state,
                { dx, dy } = this.playerDelta();

            if (this.stun > 0 && s !== 'leap') return;

            if (s === 'idle') {
                if (this.onGround) this.vx *= Math.exp(-10 * dt);
                if (Math.abs(dx) > 20) this.facing = BW.sign(dx);

                if (
                    this.cool <= 0 &&
                    this.onGround &&
                    Math.abs(dx) < 330 &&
                    dy > -230 &&
                    dy < 160 &&
                    this.sees(330, 230)
                ) {
                    this.setState('crouch');
                    BW.Audio.play('windup', { vol: 0.5, rate: 1.6 });
                }
            } else if (s === 'crouch') {
                this.vx = 0;
                this.sy = 0.78;
                this.sx = 1.14;

                if (this.stateT > 0.45) {
                    const p = this.game.player;
                    const ddx = BW.clamp(p.cx - this.cx, -300, 300);

                    this.vx = ddx / 0.72;
                    this.vy = -720;
                    this.onGround = false;
                    this.setState('leap');
                    BW.Audio.play('hop');
                    this.sy = 1.3;
                    this.sx = 0.8;

                    this.game.fx.burst(this.cx, this.y + this.h, 6, {
                        color: this.game.room.area.moss,
                        speed: 120,
                        angle: -Math.PI / 2,
                        spread: 2,
                        life: 0.35,
                        grav: 400,
                        size: 2.5,
                    });
                }
            } else if (s === 'leap') {
                if (this.onGround && this.stateT > 0.1) {
                    this.setState('recover');
                    this.vx = 0;
                    this.sy = 0.7;
                    this.sx = 1.25;
                    BW.Audio.play('land', { vol: 0.6 });
                }

                if (this.stateT > 2.5) this.setState('recover');
            } else if (s === 'recover') {
                this.vx *= Math.exp(-14 * dt);

                if (this.stateT > 0.78) {
                    this.setState('idle');
                    this.cool = 0.45;
                }
            }
        }
        hitWall() {
            if (this.state === 'leap') this.vx *= -0.2;
        }
        draw(ctx, alpha) {
            const s = this.state;
            let sprite = 'hopper_idle';

            if (s === 'crouch') sprite = 'hopper_crouch';
            else if (s === 'recover') sprite = 'hopper_dazed';
            else if (s === 'leap') sprite = 'hopper_leap';

            if (!BW.Assets.sprite(sprite)) sprite = 'hopper_idle';

            const p = this.drawSprite(ctx, alpha, sprite, Math.floor(this.t * 6), {
                rot: s === 'leap' ? BW.clamp(this.vy / 900, -0.5, 0.5) * this.facing : 0,
            });

            if (s === 'crouch') this.drawEyeGlow(ctx, p.x + this.facing * 14, p.y - 26, Math.min(1, this.stateT / 0.3));

            if (s === 'recover') {
                // dizzy sparkle telegraphs the opening
                ctx.fillStyle = 'rgba(255,240,200,0.8)';

                for (let i = 0; i < 3; i++) {
                    const a = this.t * 6 + i * 2.1;

                    ctx.beginPath();
                    ctx.arc(p.x + Math.cos(a) * 16, p.y - 52 + Math.sin(a) * 5, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    BW.ENEMY_TYPES = { crawler: Crawler, flyer: Flyer, sentinel: Sentinel, spitter: Spitter, hopper: Hopper };

    BW.ENEMY_NAMES = {
        crawler: 'Moss Crawler',
        flyer: 'Lantern-moth',
        sentinel: 'Pike Sentinel',
        spitter: 'Glow Spitter',
        hopper: 'Cave-cricket',
        warden: 'The Bellbound Warden',
    };

    BW.enemyName = function (e) {
        return (
            (e && (e.boss ? e.bossName || BW.ENEMY_NAMES.warden : BW.ENEMY_NAMES[e.kind])) || 'Something in the dark'
        );
    };

    // Stable id for a placed enemy. The Warden is a story fight and is not remembered this way.
    BW.enemyPersistKey = function (roomId, e) {
        if (!roomId || !e || (BW.BOSS_TYPES && BW.BOSS_TYPES[e.type])) return null;

        return (
            roomId +
            ':' +
            e.type +
            ':' +
            e.x +
            ':' +
            e.y +
            (e.variant ? ':' + e.variant : '') +
            (e.extra ? ':+' + e.extra : '')
        );
    };

    BW.Enemy = Enemy;
})(window.BW);

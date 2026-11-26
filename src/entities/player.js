'use strict';

// The Bellweaver: movement, needle combat, Silk Dash, mending (heal) and the Silk Lance.
(function (BW) {
    const P = BW.PHYS,
        T = BW.T,
        Phys = BW.Phys;

    const ANIM = {
        // name: [sprite, fps, loop, fallbacks...]
        idle: ['hero_idle', 9, true],
        run: ['hero_run', 14, true],
        jump: ['hero_jump', 12, false],
        fall: ['hero_fall', 10, true],
        attack: ['hero_attack', 30, false],
        attack_up: ['hero_attack_up', 30, false],
        attack_down: ['hero_attack_down', 30, false],
        dash: ['hero_dash', 24, false],
        hurt: ['hero_hurt', 14, false],
        heal: ['hero_heal', 10, true],
        sit: ['hero_sit', 6, true],
        death: ['hero_death', 10, false],
        lance: ['hero_attack', 26, false],
    };

    const FALLBACK = {
        hero_fall: 'hero_jump',
        hero_attack_up: 'hero_attack',
        hero_attack_down: 'hero_attack',
        hero_dash: 'hero_run',
        hero_hurt: 'hero_jump',
        hero_heal: 'hero_idle',
        hero_sit: 'hero_heal',
        hero_death: 'hero_hurt',
        hero_jump: 'hero_idle',
        hero_run: 'hero_idle',
        hero_attack: 'hero_idle',
        hero_idle: 'hero_base',
    };

    class Player {
        constructor(game) {
            this.game = game;
            this.w = P.w;
            this.h = P.h;
            this.reset(0, 0);
        }

        reset(x, y) {
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

        update(dt, inp) {
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
                    st.hp = Math.min(st.maxHp, st.hp + 1);
                    st.silk -= 3;

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

                    if (inp.down.heal && st.silk >= 3 && st.hp < st.maxHp && this.onGround) {
                        this.healT = 0.55 * BW.Difficulty.get(st).mend;
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
                    const target = dir * P.runSpeed;
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

            // ---- silk lance ----
            if (
                inp.pressed.lance &&
                this.state === 'normal' &&
                this.dashT <= 0 &&
                this.castCD <= 0 &&
                this.lockT <= 0
            ) {
                if (st.silk >= 3) {
                    st.silk -= 3;
                    this.castCD = 0.45;
                    this.castT = 0.2;
                    this.attackT = 0;
                    g.spawnLance(this.cx + this.facing * 18, this.cy - 4, this.facing);
                    this.vx = -this.facing * 140;
                    this.recoilT = 0.1;
                    BW.Audio.play('lance');
                    g.hud.pulse('silk');
                } else {
                    g.hud.deny('silk');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                }
            }

            // ---- heal start ----
            if (inp.pressed.heal && this.state === 'normal' && this.dashT <= 0 && this.lockT <= 0) {
                if (!this.onGround) {
                    /* must be grounded */
                } else if (st.hp >= st.maxHp) g.hud.deny('hp');
                else if (st.silk < 3) {
                    g.hud.deny('silk');
                    BW.Audio.play('ui_back', { vol: 0.5 });
                } else {
                    this.state = 'heal';
                    this.healT = 0.55 * BW.Difficulty.get(st).mend;
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
                this.parryMax = BW.Difficulty.get(st).parry;
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

        // ---- combat ----
        startAttack(inp) {
            const g = this.game;
            let d = 'side';

            if (inp.down.up) d = 'up';
            else if (inp.down.down && !this.onGround) d = 'down';

            this.attackDir = d;
            this.attackT = 0.24;
            this.attackCD = this.counterT > 0 ? 0.15 : 0.3;
            this.attackHits = new Set();
            this.attackSerial++;
            this.pogoDone = false;
            this.state = 'normal';
            BW.Audio.play('swing', { vary: 0.1, vol: 0.8 });

            const fxp = this.slashOrigin(d);

            g.fx.slash(fxp.x, fxp.y, d, this.facing, { r: d === 'side' ? 64 : 60, w: 22 });
            this.animT = 0;
        }

        slashOrigin(d) {
            if (d === 'up') return { x: this.cx, y: this.y + 14 };
            if (d === 'down') return { x: this.cx, y: this.y + this.h - 10 };

            return { x: this.cx - this.facing * 2, y: this.cy - 4 };
        }

        attackBox() {
            const d = this.attackDir;

            if (d === 'up') return { x: this.cx - 38, y: this.y - 74, w: 76, h: 92 };
            if (d === 'down') return { x: this.cx - 34, y: this.y + this.h - 18, w: 68, h: 92 };

            return this.facing > 0
                ? { x: this.cx + 2, y: this.cy - 36, w: 84, h: 62 }
                : { x: this.cx - 86, y: this.cy - 36, w: 84, h: 62 };
        }

        updateAttack() {
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
        deflect(srcX, opts) {
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
            g.teach('riposte');

            const src = opts && opts.src;

            if (src && src.onParried) src.onParried(this);
        }

        // Shadow Step: a dash timed to the instant a blow lands. No damage, a shadow of you is left where you stood,
        // time slows, the attacker is frozen and your strikes come faster for a short counter window.
        perfectDodge(srcX, opts) {
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
            g.teach('dodge');

            const src = opts && opts.src;

            if (src && src.onDodged) src.onDodged(this);
        }

        hurt(dmg, srcX, opts = {}) {
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

            if (this.parryT > 0 && !opts.trap && !opts.noParry) {
                this.deflect(srcX, opts);

                return true;
            }

            if (this.dodgeWinT > 0 && opts.strike && !opts.trap && !opts.noParry) {
                this.perfectDodge(srcX, opts);

                return true;
            }

            const D = BW.Difficulty.get(st);
            // traps scale with the trap setting (none in Story); everything else with the enemy damage setting
            const amount = opts.trap ? Math.round(dmg * D.trap) : BW.Difficulty.hit(st, dmg);

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

        die() {
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
        pickAnim() {
            let a;

            if (this.state === 'heal') a = 'heal';
            else if (this.parryT > 0 || this.guardT > 0.3) a = 'idle';
            else if (this.dashT > 0) a = 'dash';
            else if (this.castT > 0) a = 'lance';
            else if (this.attackT > 0)
                a = this.attackDir === 'up' ? 'attack_up' : this.attackDir === 'down' ? 'attack_down' : 'attack';
            else if (this.lockT > 0) a = 'hurt';
            else if (!this.onGround) a = this.vy < 0 ? 'jump' : 'fall';
            else a = Math.abs(this.vx) > 40 ? 'run' : 'idle';

            if (a !== this.anim) {
                this.anim = a;
                this.animT = 0;
            }
        }

        spriteFor(a) {
            let name = ANIM[a][0];
            let guard = 0;

            while (!BW.Assets.sprite(name) && FALLBACK[name] && guard++ < 6) name = FALLBACK[name];

            return name;
        }
        frameFor(a) {
            const def = ANIM[a];
            const name = this.spriteFor(a);
            const n = BW.Assets.frameCount(name);
            const s = BW.Assets.sprite(name);
            const fps = (s && s.fps) || def[1];
            let f = Math.floor(this.animT * fps);
            const loop = s && s.loop != null ? s.loop : def[2];

            if (a === 'jump' || a === 'fall') {
                // map vertical velocity to frames so the arc reads clearly
                const t = BW.clamp((this.vy + P.jumpV) / (P.jumpV + P.maxFall), 0, 0.999);

                if (name === ANIM[a][0]) return Math.min(n - 1, Math.floor((a === 'jump' ? t * 2 : (t - 0.5) * 2) * n));

                return Math.min(n - 1, Math.floor(t * n));
            }

            if (a === 'attack' || a === 'attack_up' || a === 'attack_down' || a === 'lance') {
                const dur = a === 'lance' ? 0.2 : 0.24;

                return Math.min(n - 1, Math.floor((this.animT / dur) * n));
            }

            if (a === 'dash') return Math.min(n - 1, Math.floor((this.animT / P.dashTime) * n));

            return loop ? f % n : Math.min(n - 1, f);
        }

        draw(ctx, alpha) {
            const g = this.game;
            const x = BW.lerp(this.px, this.x, alpha) + this.w / 2;
            const y = BW.lerp(this.py, this.y, alpha) + this.h;

            if (this.invulnT > 0 && this.state !== 'dead' && Math.floor(this.invulnT * 16) % 2 === 0 && this.lockT <= 0)
                return;

            const a = this.anim;
            const name = this.spriteFor(a);
            const fr = this.frameFor(a);
            let rot = this.lean;

            if (a === 'attack_down' && name === 'hero_attack') rot += this.facing * 1.1;
            if (a === 'attack_up' && name === 'hero_attack') rot -= this.facing * 0.9;
            if (this.state === 'dead') rot = this.facing * -Math.min(1.4, this.deathT * 2.5);

            if (this.glow > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.5 * this.glow;
                ctx.drawImage(BW.glowSprite('#ffe7b5'), x - 70, y - 100, 140, 140);
                ctx.restore();
            }

            const ok = BW.Assets.draw(ctx, name, fr, x, y, {
                flip: this.facing < 0,
                sx: this.sx,
                sy: this.sy,
                rot,
                flash: this.flash,
                scale: BW.HERO_SCALE,
            });

            if (!ok) drawPlaceholderHero(ctx, x, y, this.facing, this.sx, this.sy, this.flash, a, this.animT);
            if (this.parryT > 0) this.drawParry(ctx, x, y);
            if (this.counterT > 0) this.drawCounter(ctx, x, y);
        }

        // Violet halo while the Shadow Step counter window is open
        drawCounter(ctx, x, y) {
            const k = Math.min(1, this.counterT / 0.5) * (0.75 + 0.25 * Math.sin(this.counterT * 18));

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.55 * k;
            ctx.drawImage(BW.glowSprite('#a28bff'), x - 80, y - 120, 160, 160);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.counterT / 0.6) * 0.9;
            ctx.textAlign = 'center';
            ctx.font = '600 15px Georgia, serif';
            ctx.fillStyle = '#d9ccff';
            ctx.shadowColor = '#7a5cff';
            ctx.shadowBlur = 8;
            ctx.fillText('SHADOW STEP', x, y - 118 - (this.counterMax - this.counterT) * 14);
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
    }

    BW.HERO_SCALE = 1;

    // Simple vector stand-in used only if hero art failed to load.
    function drawPlaceholderHero(ctx, x, y, f, sx, sy, flash, anim, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(f * sx, sy);

        const bob = anim === 'run' ? Math.sin(t * 20) * 2 : 0;

        ctx.fillStyle = '#d8a634';
        ctx.beginPath();
        ctx.moveTo(-6, -40 + bob);
        ctx.quadraticCurveTo(-26, -20, -18, -2);
        ctx.lineTo(4, -6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = flash > 0 ? '#ffffff' : '#1d1b24';
        ctx.fillRect(-6, -36 + bob, 12, 34);
        ctx.beginPath();
        ctx.arc(2, -46 + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffc24a';
        ctx.beginPath();
        ctx.arc(8, -47 + bob, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#efe6d0';
        ctx.beginPath();
        ctx.ellipse(-2, -34 + bob, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8e2d0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -58 + bob);
        ctx.quadraticCurveTo(-10, -76, -22, -70);
        ctx.stroke();
        ctx.strokeStyle = '#d7e3ea';
        ctx.beginPath();
        ctx.moveTo(6, -20 + bob);
        ctx.lineTo(34, -6);
        ctx.stroke();
        ctx.restore();
    }

    BW.Player = Player;
})(window.BW);

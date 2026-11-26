'use strict';

// The Hushed Gallery's cast and furniture.
//
// The Hushed are pitch-black mourners with blank porcelain masks. They have no eyes, so there is no eye glow: a faint cold
// glimmer under the mask is the only tell besides the pose. They are drawn to sound (see Hushed.onToll): striking a
// silent bell wakes every one of them in the room.
//
//   Hushling      small crawler. Creeps, coils, pounces, lands dazed.
//   Shroud Drifter  floating shroud. Hovers, crosses its arms, dives like a pair of spears, spins out dazed.
//   Stilt Mourner  tall stalker with a long reach. Leans away, then lunges its arm across the room.
//   Gallows Reacher  hangs from the ceiling. Curls up when you pass beneath, drops, then fights from the floor.
//   Shade Brute    heavy knuckle-walker. Fists overhead, then a slam that sends a wave along the floor.
//
// Objects: silentbell (strike it to unwrap its clapper), hushgate (the arch before the Long Mourner), keyaltar (the Silent
// Key), lastdoor (the Last Door). The sequences they start live in src/game/levels/hushed.js.
(function (BW) {
    const T = BW.T,
        Phys = BW.Phys,
        OBJ = BW.OBJ;

    const COLD = ['#06090d', '#14202a', '#9fd8ff', '#e6f6ff'];

    // ================================================================ keepsakes
    // The Gallery's keepsakes are drawn in code (no art needed): each has an icon (ctx, x, y, k), used on its altar and on
    // the pick-up card, and the lines that card shows. A relic's name is the key of BW.HUSH_RELICS and the flag it sets.
    function drawShears(ctx, x, y, k = 1) {
        ctx.save();
        ctx.translate(x, y - 6 * k);
        ctx.scale(k * 1.9, k * 1.9);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.6;

        for (const s of [-1, 1]) {
            ctx.save();
            ctx.translate(0, 8);
            ctx.rotate(s * 0.22);

            // the blade
            ctx.fillStyle = '#dcebf5';
            ctx.strokeStyle = '#4b6272';
            ctx.beginPath();
            ctx.moveTo(0, -46);
            ctx.lineTo(s * 7, -4);
            ctx.lineTo(s * 2, 2);
            ctx.lineTo(-s * 3, -6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // the handle and its ring
            ctx.strokeStyle = '#9fd8ff';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(s * 1, 2);
            ctx.lineTo(-s * 5, 20);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-s * 8, 28, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = '#e6f6ff';
        ctx.beginPath();
        ctx.arc(0, 8, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    BW.HUSH_RELICS = {
        shears: {
            name: 'Mourners’ Shears',
            icon: drawShears,
            lines: [
                'Long black shears, kept sharp by a hundred years of nothing to cut.',
                'The thick mourning cloth that bars the Gallery’s hidden ways will part for them. Strike it, even from above.',
            ],
        },
    };

    // ================================================================ sounds
    // What each creature says when it enters a state: [bank or sample, play options]. The `muffled` and `voice`
    // banks are the long low recordings (src/audio/audio.js decodes them into takes); `bladedual` is the thin whoosh
    // of a limb cutting the air, `slashbody` a blow landing on cloth and bone, `blood` a wet collapse.
    const CUES = {
        hushling: {
            tell: [['muffled', { vol: 0.5, rate: 1.55 }]],
            lunge: [['bladedual', { vol: 0.3, rate: 1.7 }]],
        },
        drifter: {
            tell: [['muffled', { vol: 0.5, rate: 0.8 }]],
            dive: [['bladedual', { vol: 0.5, rate: 0.9 }]],
        },
        stilt: {
            tell: [['muffled', { vol: 0.8, rate: 0.55 }]],
            reach: [['bladedual', { vol: 0.6, rate: 0.65 }]],
        },
        reacher: {
            curl: [['muffled', { vol: 0.6, rate: 0.9 }]],
            drop: [['bladedual', { vol: 0.5, rate: 0.7 }]],
            land: [['slashbody', { vol: 0.55, rate: 0.7 }]],
        },
        brute: {
            windup: [['muffled', { vol: 0.9, rate: 0.45 }]],
            slam: [['slashbody', { vol: 0.8, rate: 0.5 }]],
        },
    };

    // ================================================================ shared base
    class Hushed extends BW.Enemy {
        constructor(game, def, o) {
            super(game, def, o);
            this.lightColor = '#9fd8ff';
            this.lightA = 0.16;
            this.rim = 0.4; // a cold rim light keeps pitch-black bodies readable against black stone
            this.deathColors = COLD;
            this.sfxRate = { hushling: 1.5, drifter: 1.1, stilt: 0.7, reacher: 0.85, brute: 0.55 }[def.type] || 1;
            this.deathGlow = ['#9fd8ff', '#e6f6ff'];
            this.deathRing = '#9fd8ff';
            this.alertT = 0;
        }
        // a sound that comes from this creature: quieter and panned by where it is
        sfx(name, o) {
            BW.Audio.playAt(name, this.cx, this.cy, o);
        }
        setState(s) {
            super.setState(s);

            const cue = CUES[this.kind] && CUES[this.kind][s];

            if (cue) for (const [name, o] of cue) this.sfx(name, o);
        }
        damage(n, dir, src) {
            const r = super.damage(n, dir, src);

            if (r === 'hit') this.sfx('slashbody', { vol: 0.5, rate: this.sfxRate, vary: 0.12, minGap: 0.08 });

            if (r === 'kill') {
                this.sfx('blood', { vol: 0.75, vary: 0.1, minGap: 0 });
                this.sfx('muffled', { vol: 0.55, rate: this.sfxRate * 0.7, minGap: 0 });
            }

            return r;
        }
        // A silent bell was struck somewhere in the room: for a while this creature knows exactly where you are.
        onToll() {
            this.alertT = 6;
        }
        update(dt) {
            if (this.alertT > 0) this.alertT -= dt;

            super.update(dt);
        }
        // the cold glimmer that leaks from under the mask just before a blow lands
        glimmer(ctx, x, y, k, size = 56) {
            if (k <= 0) return;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.7 * k;
            ctx.drawImage(BW.glowSprite('#9fd8ff'), x - size / 2, y - size / 2, size, size);
            ctx.restore();
        }
    }

    // ================================================================ Hushling
    class Hushling extends Hushed {
        constructor(game, def) {
            super(game, def, { w: 42, h: 30, hp: 3, glints: 2, xp: 9, kb: 1 });
            this.state = 'idle';
            this.canRecover = true;
            this.cool = BW.rand(0.4, 1.0);
            this.lostT = 0;
        }
        think(dt) {
            const s = this.state,
                { dx, dy } = this.playerDelta();

            if (this.stun > 0) return;

            const alert = this.alertT > 0,
                range = alert ? 760 : 300;

            if (s === 'idle') {
                // crouched and listening: it turns toward a sound before it ever sees you
                if (alert && Math.abs(dx) > 16) this.facing = BW.sign(dx);

                if (this.sees(range, alert ? 220 : 90)) this.setState('crawl');
            } else if (s === 'crawl') {
                this.facing = BW.sign(dx) || this.facing;
                this.vx = this.groundAhead(this.facing) ? this.facing * (alert ? 150 : 98) : 0;

                if (this.sees(range + 120, 220)) this.lostT = 0;
                else if ((this.lostT += dt) > 2.2) this.setState('idle');

                if (this.cool <= 0 && Math.abs(dx) < 175 && Math.abs(dy) < 80 && this.sees(200, 80)) {
                    this.setState('tell');
                    this.vx = 0;
                    BW.Audio.play('windup', { vol: 0.5, rate: 1.5 });
                }
            } else if (s === 'tell') {
                this.vx = 0;
                this.sy = 0.88 + Math.sin(this.stateT * 40) * 0.025;
                this.sx = 1.08;

                if (this.stateT < 0.25) this.facing = BW.sign(dx) || this.facing;

                if (this.stateT > 0.42) {
                    this.setState('lunge');
                    this.vx = this.facing * 470;
                    this.vy = -230;
                    this.onGround = false;
                    this.sx = 1.25;
                    this.sy = 0.85;
                    BW.Audio.play('hop', { vol: 0.6, rate: 1.25 });
                }
            } else if (s === 'lunge') {
                // a short hop, then it skitters on along the floor: about 190 px in all, as far as the tell promises
                if (!this.groundAhead(this.facing) && this.onGround) this.vx = 0;

                if (this.stateT > 0.4) {
                    this.setState('recover');
                    this.vx *= 0.2;
                }
            } else if (s === 'recover') {
                this.vx *= Math.exp(-12 * dt);

                if (this.stateT > 0.8) {
                    this.setState('crawl');
                    this.cool = 0.8;
                }
            }
        }
        draw(ctx, alpha) {
            const s = this.state;
            let sprite = 'hushling_crawl';

            if (s === 'idle') sprite = 'hushling_idle';
            else if (s === 'tell') sprite = 'hushling_tell';
            else if (s === 'lunge') sprite = 'hushling_lunge';
            else if (s === 'recover') sprite = 'hushling_dazed';

            const p = this.drawSprite(ctx, alpha, sprite, Math.floor(this.t * 9), {});

            if (s === 'tell') this.glimmer(ctx, p.x + this.facing * 8, p.y - 26, Math.min(1, this.stateT / 0.3), 48);
        }
    }

    // ================================================================ Shroud Drifter
    class Drifter extends Hushed {
        constructor(game, def) {
            super(game, def, { w: 40, h: 80, hp: 3, glints: 3, xp: 12, kb: 1.3, gravity: false });
            this.state = 'idle';
            this.canRecover = true;
            this.cool = BW.rand(0.6, 1.4);
            this.dir = { x: 1, y: 0 };
            this.lostT = 0;
        }
        // its dive is two arms held out like spears
        attackBoxes() {
            if (this.state !== 'dive') return null;

            return [{ x: this.cx + this.dir.x * 46 - 32, y: this.cy + this.dir.y * 46 - 24, w: 64, h: 48 }];
        }
        steer(tx, ty, speed, dt) {
            const dx = tx - this.x,
                dy = ty - this.y,
                d = Math.hypot(dx, dy);

            this.vx = BW.damp(this.vx, d > 1 ? (dx / d) * Math.min(speed, d * 3) : 0, 3, dt);
            this.vy = BW.damp(this.vy, d > 1 ? (dy / d) * Math.min(speed, d * 3) : 0, 3, dt);
        }
        think(dt) {
            const s = this.state,
                p = this.game.player,
                alert = this.alertT > 0;

            if (this.stun > 0) {
                this.vx *= Math.exp(-4 * dt);
                this.vy *= Math.exp(-4 * dt);

                if (s === 'tell' || s === 'dive') this.setState('recover');

                return;
            }

            const homeD = Math.hypot(this.cx - (this.homeX + this.w / 2), this.cy - (this.homeY + this.h / 2));

            if (s === 'idle') {
                this.steer(this.homeX + Math.sin(this.t * 0.5) * 36, this.homeY + Math.cos(this.t * 0.8) * 14, 50, dt);

                if (this.sees(alert ? 820 : 400, 340) && p.state !== 'dead') this.setState('chase');
            } else if (s === 'chase') {
                this.facing = p.cx > this.cx ? 1 : -1;

                const side = this.cx < p.cx ? -1 : 1;

                this.steer(p.cx + side * 170 - this.w / 2, p.y - 46, alert ? 150 : 96, dt);

                if (this.sees(640, 520)) this.lostT = 0;
                else if ((this.lostT += dt) > 2 || homeD > 900) this.setState('return');

                if (
                    this.cool <= 0 &&
                    Math.abs(this.cx - p.cx) < 300 &&
                    Math.abs(this.cy - p.cy) < 240 &&
                    Phys.los(this.game.room, this.cx, this.cy, p.cx, p.cy)
                ) {
                    this.setState('tell');
                    BW.Audio.play('windup', { vol: 0.45, rate: 0.8 });
                }
            } else if (s === 'tell') {
                // arms crossed over the mask, hanging still in the air
                this.vx *= Math.exp(-6 * dt);
                this.vy *= Math.exp(-6 * dt);
                this.facing = p.cx > this.cx ? 1 : -1;

                if (this.stateT > 0.72) {
                    const dx = p.cx - this.cx,
                        dy = p.cy - 8 - this.cy,
                        d = Math.hypot(dx, dy) || 1;

                    this.dir = { x: dx / d, y: dy / d };
                    this.vx = this.dir.x * 520;
                    this.vy = this.dir.y * 520;
                    this.setState('dive');
                    BW.Audio.play('dash', { vol: 0.35, rate: 1.1 });
                }
            } else if (s === 'dive') {
                if (this.stateT > 0.6) this.setState('recover');
            } else if (s === 'recover') {
                this.vx *= Math.exp(-4 * dt);
                this.vy = BW.damp(this.vy, 0, 3, dt);

                if (this.stateT > 1.0) {
                    this.setState('chase');
                    this.cool = 1.2;
                }
            } else if (s === 'return') {
                this.steer(this.homeX, this.homeY, 110, dt);

                if (homeD < 24) this.setState('idle');
                else if (this.sees(360, 300)) this.setState('chase');
            }
        }
        hitWall() {
            if (this.state === 'dive') this.setState('recover');
        }
        draw(ctx, alpha) {
            const s = this.state;
            let sprite = 'drifter_drift';

            if (s === 'tell') sprite = 'drifter_tell';
            else if (s === 'dive') sprite = 'drifter_dive';
            else if (s === 'recover') sprite = 'drifter_dazed';

            const bob = s === 'dive' ? 0 : Math.sin(this.t * 2.2) * 4;
            const rot = s === 'dive' ? (Math.atan2(this.vy, Math.abs(this.vx) + 1) - 0.785) * this.facing : 0;
            const p = this.drawSprite(ctx, alpha, sprite, Math.floor(this.t * 2.4), { oy: bob, rot });

            if (s === 'tell') this.glimmer(ctx, p.x, p.y - 62 + bob, Math.min(1, this.stateT / 0.5), 60);
        }
    }

    // ================================================================ Stilt Mourner
    class Stilt extends Hushed {
        constructor(game, def) {
            super(game, def, { w: 38, h: 92, hp: 6, glints: 4, xp: 22, kb: 0.3 });
            this.state = 'patrol';
            this.turnT = 0;
            this.canRecover = true;
            this.slides = { reach: 1 }; // the lunge keeps its speed for the whole 0.22 s: about 66 px
        }
        isStriking() {
            return this.state === 'reach';
        }
        // the long arm, shot forward at the height of its chest
        attackBoxes() {
            if (this.state !== 'reach') return null;

            return [
                this.facing > 0
                    ? { x: this.cx + 6, y: this.y + 18, w: 104, h: 30 }
                    : { x: this.cx - 6 - 104, y: this.y + 18, w: 104, h: 30 },
            ];
        }
        think(dt) {
            const s = this.state,
                { dx, dy } = this.playerDelta();

            if (this.stun > 0 && s !== 'reach') return;

            const want = BW.sign(dx) || this.facing,
                alert = this.alertT > 0;

            if (s === 'patrol') {
                if (
                    !this.groundAhead(this.facing) ||
                    (Math.abs(this.x - this.homeX) > 4 * T && BW.sign(this.homeX - this.x) !== this.facing)
                )
                    this.facing *= -1;

                this.vx = this.facing * 34;

                if (this.sees(alert ? 760 : 460, 130)) this.setState('stalk');
            } else if (s === 'stalk') {
                if (want !== this.facing) {
                    // it turns its whole long body slowly
                    this.turnT += dt;
                    this.vx = 0;

                    if (this.turnT > 0.5) {
                        this.facing = want;
                        this.turnT = 0;
                    }
                } else {
                    this.turnT = 0;
                    this.vx = this.groundAhead(this.facing) && Math.abs(dx) > 165 ? this.facing * (alert ? 80 : 58) : 0;

                    // its blow reaches about 180 px (the arm's 104 plus the lunge): it only coils when you are within that
                    if (Math.abs(dx) < 185 && Math.abs(dy) < 90 && this.cool <= 0) {
                        this.setState('tell');
                        this.vx = 0;
                        BW.Audio.play('windup', { vol: 0.7, rate: 0.7 });
                    }
                }

                if (!this.sees(640, 170) && this.stateT > 1.8) this.setState('patrol');
            } else if (s === 'tell') {
                // it leans back, one arm drawn far behind it
                this.vx = 0;

                if (this.stateT > 0.75) {
                    this.setState('reach');
                    BW.Audio.play('thrust', { rate: 0.8 });
                    this.vx = this.groundAhead(this.facing) ? this.facing * 300 : 0;
                }
            } else if (s === 'reach') {
                if (!this.groundAhead(this.facing)) this.vx = 0;

                if (this.stateT > 0.22) {
                    this.setState('recover');
                    this.vx = 0;
                }
            } else if (s === 'recover') {
                this.vx = 0;

                if (this.stateT > 1.0) {
                    this.setState('stalk');
                    this.cool = 0.8;
                }
            }
        }
        draw(ctx, alpha) {
            const s = this.state;
            let sprite = Math.abs(this.vx) > 5 ? 'stilt_walk' : 'stilt_idle';

            if (s === 'tell') sprite = 'stilt_tell';
            else if (s === 'reach') sprite = 'stilt_reach';
            else if (s === 'recover') sprite = 'stilt_recover';

            const p = this.drawSprite(ctx, alpha, sprite, Math.floor(this.t * 3.5), {});

            if (s === 'tell') this.glimmer(ctx, p.x + this.facing * 4, p.y - 78, Math.min(1, this.stateT / 0.5), 52);

            if (s === 'reach') {
                // a streak along the length of the arm
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = 'rgba(159,216,255,0.28)';

                const b = this.attackBoxes()[0];

                ctx.fillRect(b.x, b.y + 10, b.w, 8);
                ctx.restore();
            }
        }
    }

    // ================================================================ Gallows Reacher
    class Reacher extends Hushed {
        constructor(game, def) {
            super(game, def, { w: 36, h: 100, hp: 5, glints: 3, xp: 18, kb: 0.5, gravity: false });
            // def.x / def.y name the tile whose underside it hangs from
            this.anchorX = (def.x + 0.5) * T;
            this.anchorY = (def.y + 1) * T;
            this.x = this.anchorX - this.w / 2;
            this.y = this.anchorY + 2;
            this.px = this.x;
            this.py = this.y;
            this.homeX = this.x;
            this.homeY = this.y;
            this.state = 'hang';
            this.canRecover = true;
            this.swing = 0;
            this.cool = BW.rand(0.2, 0.6);
            this.curlAt = 0.6;
        }
        isStriking() {
            return this.state === 'drop' || this.state === 'lunge';
        }
        onToll() {
            super.onToll();

            // the sound pulls it off the ceiling, wherever you are
            if (this.state === 'hang') {
                this.setState('hang');
                this.wake = BW.rand(0.3, 0.9);
            }
        }
        onHit(dir, src) {
            if (this.state === 'hang' || this.state === 'curl') this.swing = (src ? BW.sign(this.cx - src.cx) : 1) * 18;
        }
        drop() {
            this.setState('drop');
            this.gravity = true;
            this.vy = 260;
            this.vx = 0;
            BW.Audio.play('windup', { vol: 0.6, rate: 0.6 });
        }
        onLandE() {
            if (this.state !== 'drop') return;

            const g = this.game,
                bottom = this.y + this.h;

            // folded up on the floor, much shorter than it hung
            this.h = 52;
            this.y = bottom - this.h;
            this.setState('land');
            this.sx = 1.3;
            this.sy = 0.7;
            BW.Audio.play('land', { vol: 0.8 });
            g.fx.shake(3, 0.2);
            g.fx.ring(this.cx, bottom - 6, 6, 110, 0.35, '#9fd8ff', 3);

            g.fx.burst(this.cx, bottom - 4, 8, {
                color: ['#06090d', '#14202a', '#9fd8ff'],
                speed: 150,
                life: 0.4,
                grav: 400,
                size: 3,
                angle: -Math.PI / 2,
                spread: 2,
            });
        }
        think(dt) {
            const s = this.state,
                p = this.game.player;

            if (s === 'hang' || s === 'curl') {
                this.swing = BW.damp(this.swing, 0, 1.6, dt);
                this.x = this.anchorX - this.w / 2 + Math.sin(this.t * 1.1) * 5 + this.swing;
                this.y = this.homeY + Math.sin(this.t * 1.7) * 3;
                this.vx = 0;
                this.vy = 0;

                if (this.stun > 0) return;

                if (s === 'hang') {
                    if (this.wake != null) {
                        this.wake -= dt;

                        if (this.wake <= 0) {
                            this.wake = null;
                            this.setState('curl');
                            BW.Audio.play('windup', { vol: 0.5, rate: 0.7 });
                        }
                    } else if (this.cool <= 0 && p.state !== 'dead') {
                        const dx = p.cx - this.cx,
                            dy = p.cy - (this.y + this.h);

                        if (
                            Math.abs(dx) < 110 &&
                            dy > 30 &&
                            dy < 700 &&
                            Phys.los(this.game.room, this.cx, this.y + this.h, p.cx, p.cy - 10)
                        ) {
                            this.setState('curl');
                            BW.Audio.play('windup', { vol: 0.5, rate: 0.7 });
                        }
                    }
                } else {
                    // curled up tight, coiled to drop; it creaks and trembles
                    this.swing = Math.sin(this.stateT * 55) * 3;

                    if (this.stateT > this.curlAt) this.drop();
                }

                return;
            }

            if (this.stun > 0) return;

            const { dx, dy } = this.playerDelta();

            if (s === 'drop') {
                this.vx = 0;

                if (this.stateT > 3) this.setState('land');
            } else if (s === 'land') {
                // folded up on the floor, dazed by its own fall: the opening
                this.vx = 0;
                this.sx = BW.damp(this.sx, 1, 8, dt);
                this.sy = BW.damp(this.sy, 1, 8, dt);

                if (this.stateT > 0.9) this.setState('stalk');
            } else if (s === 'stalk') {
                this.facing = BW.sign(dx) || this.facing;
                this.vx = this.groundAhead(this.facing) ? this.facing * (this.alertT > 0 ? 110 : 80) : 0;

                if (this.cool <= 0 && Math.abs(dx) < 160 && Math.abs(dy) < 80) {
                    this.setState('windup');
                    this.vx = 0;
                    BW.Audio.play('windup', { vol: 0.5, rate: 1.2 });
                }
            } else if (s === 'windup') {
                this.vx = 0;
                this.sy = 0.86 + Math.sin(this.stateT * 40) * 0.03;
                this.sx = 1.1;

                if (this.stateT < 0.2) this.facing = BW.sign(dx) || this.facing;

                if (this.stateT > 0.45) {
                    this.setState('lunge');
                    this.vx = this.facing * 420;
                    this.vy = -170;
                    this.onGround = false;
                    BW.Audio.play('hop', { vol: 0.6, rate: 0.9 });
                }
            } else if (s === 'lunge') {
                if (!this.groundAhead(this.facing) && this.onGround) this.vx = 0;

                if (this.stateT > 0.34) {
                    this.setState('recover');
                    this.vx *= 0.2;
                }
            } else if (s === 'recover') {
                this.vx *= Math.exp(-12 * dt);

                if (this.stateT > 0.8) {
                    this.setState('stalk');
                    this.cool = 1.0;
                }
            }
        }
        physics(dt) {
            if (this.state === 'hang' || this.state === 'curl') {
                if (!this.dead) return;
            }

            super.physics(dt);
        }
        draw(ctx, alpha) {
            const s = this.state;

            if ((s === 'hang' || s === 'curl') && !this.dead) {
                const x = BW.lerp(this.px, this.x, alpha) + this.w / 2;

                // a pair of long arms gripping the underside of the stone, the sprite hung from the anchor
                BW.Assets.draw(ctx, s === 'curl' ? 'reacher_tell' : 'reacher_hang', 0, x, this.anchorY, {
                    flip: this.facing < 0,
                    rot: Math.sin(this.t * 1.1) * 0.025 + this.swing * 0.004,
                    flash: this.flash,
                    rim: this.rim,
                    sx: this.sx,
                    sy: this.sy,
                });

                this.game.addLight(x, this.y + 60, 60, '#9fd8ff', 0.14);

                if (s === 'curl')
                    this.glimmer(ctx, x + this.facing * 6, this.y + 40, Math.min(1, this.stateT / 0.4), 56);

                return;
            }

            let sprite = 'reacher_landed';

            if (s === 'drop') sprite = 'reacher_drop';
            else if (s === 'recover' || this.dead) sprite = 'reacher_dazed';

            this.drawSprite(ctx, alpha, sprite, 0, {});
        }
    }

    // ================================================================ Shade Brute
    // the wave its fists send along the floor: jump it
    class HushQuake extends BW.Hazard {
        constructor(game, x, floorY, dir) {
            super(game);
            this.dmg = BW.Difficulty.WEIGHTS.quake;
            this.x = x;
            this.fy = floorY;
            this.dir = dir;
            this.speed = 310;
            this.left = 400;
            this.cause = 'Shade Brute';
        }
        boxes() {
            return [{ x: this.x - 20, y: this.fy - 36, w: 40, h: 36 }];
        }
        hitX(p) {
            return p.cx - this.dir * 10;
        }
        update(dt) {
            super.update(dt);

            const step = this.speed * dt;

            this.x += this.dir * step;
            this.left -= step;

            // it dies against a wall or when it has spent itself
            if (this.left <= 0 || this.game.room.solidPx(this.x + this.dir * 20, this.fy - 12)) this.dead = true;

            if (Math.random() < dt * 40)
                this.game.fx.spawn({
                    x: this.x + BW.rand(-14, 14),
                    y: this.fy - BW.rand(2, 30),
                    vx: -this.dir * BW.rand(10, 60),
                    vy: BW.rand(-90, -20),
                    life: 0.4,
                    size: BW.rand(1.5, 3.5),
                    color: BW.pick(['#9fd8ff', '#e6f6ff', '#14202a']),
                    kind: 'glow',
                    add: true,
                });
        }
        draw(ctx) {
            const k = BW.clamp(this.left / 120, 0, 1);

            ctx.save();
            ctx.globalAlpha = k;
            ctx.fillStyle = '#06090d';
            ctx.beginPath();
            ctx.moveTo(this.x - 22 * this.dir, this.fy);

            for (let i = 0; i < 5; i++)
                ctx.lineTo(this.x + this.dir * (-16 + i * 9), this.fy - (i % 2 ? 22 : 36) - (i === 2 ? 6 : 0));

            ctx.lineTo(this.x + this.dir * 24, this.fy);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(159,216,255,0.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(159,216,255,0.2)';
            ctx.fillRect(this.x - 22, this.fy - 4, 44, 4);
            ctx.restore();
            this.game.addLight(this.x, this.fy - 18, 70, '#9fd8ff', 0.35 * k);
        }
    }

    class Brute extends Hushed {
        constructor(game, def) {
            super(game, def, { w: 62, h: 78, hp: 9, glints: 6, xp: 30, kb: 0.1 });
            this.state = 'patrol';
            this.turnT = 0;
            this.canRecover = true;
        }
        isStriking() {
            return this.state === 'slam';
        }
        // both fists, driven into the floor in front of it
        attackBoxes() {
            if (this.state !== 'slam' || this.stateT > 0.14) return null;

            return [
                this.facing > 0
                    ? { x: this.cx + 4, y: this.y + 12, w: 112, h: 66 }
                    : { x: this.cx - 4 - 112, y: this.y + 12, w: 112, h: 66 },
            ];
        }
        think(dt) {
            const s = this.state,
                { dx, dy } = this.playerDelta();

            if (this.stun > 0 && s !== 'slam') return;

            const want = BW.sign(dx) || this.facing,
                alert = this.alertT > 0;

            if (s === 'patrol') {
                if (
                    !this.groundAhead(this.facing) ||
                    (Math.abs(this.x - this.homeX) > 5 * T && BW.sign(this.homeX - this.x) !== this.facing)
                )
                    this.facing *= -1;

                this.vx = this.facing * 30;

                if (this.sees(alert ? 700 : 420, 130)) this.setState('approach');
            } else if (s === 'approach') {
                if (want !== this.facing) {
                    this.turnT += dt;
                    this.vx = 0;

                    if (this.turnT > 0.55) {
                        this.facing = want;
                        this.turnT = 0;
                    }
                } else {
                    this.turnT = 0;
                    this.vx = this.groundAhead(this.facing) && Math.abs(dx) > 140 ? this.facing * (alert ? 70 : 50) : 0;

                    if (Math.abs(dx) < 190 && Math.abs(dy) < 80 && this.cool <= 0) {
                        this.setState('windup');
                        this.vx = 0;
                        BW.Audio.play('windup', { vol: 0.9, rate: 0.55 });
                    }
                }

                if (!this.sees(640, 170) && this.stateT > 1.8) this.setState('patrol');
            } else if (s === 'windup') {
                // both fists raised high overhead, the whole body arched back
                this.vx = 0;
                this.sx = 0.96;

                if (this.stateT > 0.85) {
                    const g = this.game,
                        fy = this.y + this.h;

                    this.setState('slam');
                    this.sx = 1.08;
                    this.sy = 0.9;
                    BW.Audio.play('boss_slam', { vol: 0.8, rate: 1.1 });
                    g.fx.shake(5, 0.25);
                    g.fx.ring(this.cx + this.facing * 50, fy - 6, 8, 150, 0.4, '#9fd8ff', 3);

                    for (const d of [-1, 1])
                        g.spawnHazard(new HushQuake(g, this.cx + this.facing * 56 + d * 22, fy, d));
                }
            } else if (s === 'slam') {
                this.vx = 0;

                if (this.stateT > 0.2) this.setState('recover');
            } else if (s === 'recover') {
                // fists still buried in the stone
                this.vx = 0;

                if (this.stateT > 1.15) {
                    this.setState('approach');
                    this.cool = 1.0;
                }
            }
        }
        draw(ctx, alpha) {
            const s = this.state;
            let sprite = Math.abs(this.vx) > 5 ? 'brute_walk' : 'brute_idle';

            if (s === 'windup') sprite = 'brute_tell';
            else if (s === 'slam' || (s === 'recover' && this.parried <= 0)) sprite = 'brute_slam';
            else if (s === 'recover') sprite = 'brute_dazed';

            const p = this.drawSprite(ctx, alpha, sprite, Math.floor(this.t * 2.6), {});

            if (s === 'windup') this.glimmer(ctx, p.x + this.facing * 4, p.y - 66, Math.min(1, this.stateT / 0.6), 64);
        }
    }

    BW.ENEMY_TYPES.hushling = Hushling;
    BW.ENEMY_TYPES.drifter = Drifter;
    BW.ENEMY_TYPES.stilt = Stilt;
    BW.ENEMY_TYPES.reacher = Reacher;
    BW.ENEMY_TYPES.brute = Brute;

    Object.assign(BW.ENEMY_NAMES, {
        hushling: 'Hushling',
        drifter: 'Shroud Drifter',
        stilt: 'Stilt Mourner',
        reacher: 'Gallows Reacher',
        brute: 'Shade Brute',
        mourner: 'The Long Mourner',
    });

    BW.HushQuake = HushQuake;

    // ================================================================ silent bell
    // A bell whose clapper was cut out and wrapped in black cloth. Strike it (needle or lance) to unwrap it: it tolls,
    // every Hushed in the room hears (Game.hushToll), and the veil gate it is tied to parts once all its bells have rung.
    OBJ.silentbell = class SilentBell extends BW.ObjBase {
        constructor(g, d) {
            super(g, d);
            this.id = d.id;
            this.flag = 'hbell_' + d.id;
            this.rung = !!this.flags[this.flag];
            this.strikable = true;
            this.swing = 0;
            this.swingV = 0;
            this.cool = 0;
            this.glow = this.rung ? 0.6 : 0;
            this.pitch = d.pitch || { h2a: 98, h4a: 110, h4b: 130.8, h4c: 164.8 }[d.id] || 123.5;
        }
        hurtbox() {
            return { x: this.x - 50, y: this.y - 172, w: 100, h: 156 };
        }
        hit() {
            if (this.cool > 0) return;

            this.cool = 1.4;
            this.swingV += 5.5;
            this.game.hushToll(this);
        }
        // called by Game.hushToll for the cloth coming away the first time
        unwrap() {
            const g = this.game;

            this.rung = true;
            this.glow = 1;

            g.fx.burst(this.x, this.y - 60, 22, {
                color: ['#06090d', '#14202a', '#0b1015'],
                kind: 'shard',
                speed: 200,
                life: 1.1,
                grav: 500,
                size: 5,
            });
        }
        // a bell struck out of order has its cloth pulled tight again (Game.hushToll)
        rewrap() {
            const g = this.game;

            this.rung = false;
            this.glow = 0;
            this.swingV += 3;

            g.fx.burst(this.x, this.y - 70, 14, {
                color: ['#06090d', '#14202a', '#0b1015'],
                kind: 'shard',
                speed: 150,
                life: 0.8,
                grav: 300,
                size: 5,
            });
        }
        update(dt) {
            super.update(dt);
            this.cool = Math.max(0, this.cool - dt);
            this.swingV += -this.swing * 8 * dt;
            this.swingV *= Math.exp(-0.7 * dt);
            this.swing += this.swingV * dt;
            this.glow = Math.max(this.rung ? 0.5 : 0, this.glow - dt * 0.6);
        }
        draw(ctx) {
            const x = this.x,
                y = this.y;

            ctx.save();

            // the bell swings from the top of its bracket
            ctx.translate(x, y - 172);
            ctx.rotate(this.swing * 0.12);
            BW.Assets.drawImg(ctx, 'deco_hg_bell', 0, 172, { h: 190, w: 165, ay: 1 });
            ctx.restore();

            const k = this.rung ? 0.4 + this.glow * 0.5 : 0.1;

            this.game.addLight(x, y - 70, 130 + this.glow * 120, '#9fd8ff', k);

            if (!this.rung && Math.random() < 0.02)
                this.game.fx.spawn({
                    x: x + BW.rand(-30, 30),
                    y: y - BW.rand(30, 80),
                    vy: -12,
                    life: 1.2,
                    size: 1.5,
                    color: '#9fd8ff',
                    kind: 'glow',
                    add: true,
                });
        }
    };

    // ================================================================ a relic on its altar (the Mourners' Shears)
    // The Silent Key's altar, reused for the Gallery's other keepsakes: def.relic names the flag it sets, def.id is
    // the pickup flag. Taking it starts the sequence in src/game/levels/hushed.js (Game.takeRelic).
    OBJ.relicaltar = class RelicAltar extends BW.ObjBase {
        constructor(g, d) {
            super(g, d);
            this.range = 90;
        }
        has() {
            return !!this.flags[this.def.relic];
        }
        canInteract() {
            return !this.has() && this.near(90) && this.game.player.onGround && !this.game.seq;
        }
        prompt() {
            return 'Take the ' + (BW.HUSH_RELICS[this.def.relic] || { name: 'relic' }).name;
        }
        interact() {
            this.game.takeRelic(this);
        }
        draw(ctx) {
            const x = this.x,
                y = this.y;

            BW.Assets.drawImg(ctx, 'obj_hg_keyaltar', x, y + 3, { h: 150, w: 150, ay: 1 });

            if (!this.has()) {
                const bob = Math.sin(this.t * 2) * 4;

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.55;
                ctx.drawImage(BW.glowSprite('#9fd8ff'), x - 52, y - 150 + bob - 52, 104, 104);
                ctx.restore();
                BW.HUSH_RELICS[this.def.relic].icon(ctx, x, y - 118 + bob, 0.55);
                this.game.addLight(x, y - 118, 130, '#9fd8ff', 0.55);
            } else this.game.addLight(x, y - 90, 70, '#9fd8ff', 0.18);
        }
    };

    // ================================================================ the arch before the Long Mourner
    OBJ.hushgate = class HushGate extends BW.ObjBase {
        constructor(g, d) {
            super(g, d);
            this.k = 0; // 0 = standing open, 1 = veiled shut
        }
        update(dt) {
            super.update(dt);

            const gt = this.game.room.gates.find((x) => x.fixed);

            this.k = BW.approach(this.k, gt && !gt.open ? 1 : 0, dt * 2.2);
        }
        draw(ctx) {
            const H = 340,
                W = 290;

            BW.Assets.drawImg(ctx, 'obj_hg_gate_open', this.x, this.y + 3, { h: H, w: W, ay: 1 });

            if (this.k > 0.01)
                BW.Assets.drawImg(ctx, 'obj_hg_gate', this.x, this.y + 3, { h: H, w: W, ay: 1, alpha: this.k });

            this.game.addLight(this.x, this.y - 120, 150, '#9fd8ff', 0.28 * (1 - this.k) + 0.12);
        }
    };

    // ================================================================ the Silent Key's altar
    OBJ.keyaltar = class KeyAltar extends BW.ObjBase {
        constructor(g, d) {
            super(g, d);
            this.range = 90;
        }
        has() {
            return !!this.flags.silent_key;
        }
        canInteract() {
            return !this.has() && this.near(90) && this.game.player.onGround && !this.game.seq;
        }
        prompt() {
            return 'Take the Silent Key';
        }
        interact() {
            this.game.takeSilentKey(this);
        }
        draw(ctx) {
            const x = this.x,
                y = this.y;

            BW.Assets.drawImg(ctx, 'obj_hg_keyaltar', x, y + 3, { h: 150, w: 150, ay: 1 });

            if (!this.has()) {
                const bob = Math.sin(this.t * 2) * 4;

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.55;
                ctx.drawImage(BW.glowSprite('#9fd8ff'), x - 52, y - 150 + bob - 52, 104, 104);
                ctx.restore();
                BW.Assets.drawImg(ctx, 'item_silentkey', x, y - 118 + bob, { h: 84, w: 22, ay: 0.5 });
                this.game.addLight(x, y - 118, 130, '#9fd8ff', 0.55);
            } else this.game.addLight(x, y - 90, 70, '#9fd8ff', 0.18);
        }
    };

    // ================================================================ the Last Door
    OBJ.lastdoor = class LastDoor extends BW.ObjBase {
        constructor(g, d) {
            super(g, d);
            this.range = 150;
            this.open = this.flags.lastdoor_open ? 1 : 0;
            this.opening = false;
        }
        canInteract() {
            return this.near(150) && this.game.player.onGround && !this.opening && !this.game.seq;
        }
        prompt() {
            return this.open >= 1
                ? 'Step into the light'
                : this.flags.silent_key
                ? 'Unlock the Last Door'
                : 'Touch the door';
        }
        interact() {
            const g = this.game;

            if (this.open >= 1) g.enterLastDoor(this);
            else if (this.flags.silent_key) g.openLastDoor(this);
            else {
                g.dialog.open(
                    'The Last Door',
                    [
                        'A colossal black door, one smooth plate of metal. At its heart a keyhole in the shape of a blank mask’s oval glows faintly cold.',
                        'Whatever opens it is not forced. It was made to be answered with a key, and a sound.',
                    ],
                    { kind: 'sign' },
                );

                BW.Audio.play('bellfar', { pitch: 61.7, vol: 0.6 });
            }
        }
        update(dt) {
            super.update(dt);

            if (this.opening) {
                this.open = Math.min(1, this.open + dt / 3.4);

                if (this.open >= 1) this.opening = false;
            }
        }
        draw(ctx) {
            const x = this.x,
                y = this.y + 3,
                H = 440,
                W = 444;

            BW.Assets.drawImg(ctx, 'obj_lastdoor', x, y, { h: H, w: W, ay: 1 });

            if (this.open > 0.01)
                BW.Assets.drawImg(ctx, 'obj_lastdoor_open', x, y, { h: H, w: W, ay: 1, alpha: this.open });

            const k = this.open;

            this.game.addLight(x, y - 150, 190 + k * 190, k > 0 ? '#e6f6ff' : '#9fd8ff', 0.2 + k * 0.6);

            if (k > 0.2 && Math.random() < 0.3 * k)
                this.game.fx.spawn({
                    x: x + BW.rand(-60, 60),
                    y: y - BW.rand(20, 260),
                    vx: BW.rand(-10, 10),
                    vy: BW.rand(-30, -8),
                    life: 1.4,
                    size: BW.rand(1.5, 3),
                    color: '#e6f6ff',
                    kind: 'glow',
                    add: true,
                });
        }
    };
})(window.BW);

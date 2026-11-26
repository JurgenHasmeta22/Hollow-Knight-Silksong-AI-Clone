'use strict';

// World objects: checkpoints, pickups, NPC, shrine, toll-looms, lifts, movers, pendulums, projectiles.
(function (BW) {
    const T = BW.T,
        Phys = BW.Phys;

    const OBJ = {};

    class Obj {
        constructor(game, def) {
            this.game = game;
            this.def = def;
            this.type = def.type;
            this.x = (def.x + 0.5) * T;
            this.y = (def.y + 1) * T; // bottom-centre anchor
            this.t = Math.random() * 5;
            this.dead = false;
            this.range = 56;
        }
        get flags() {
            return this.game.state.flags;
        }
        update(dt) {
            this.t += dt;
        }
        draw() {}
        canInteract() {
            return false;
        }
        near(r = this.range) {
            const p = this.game.player;

            return Math.abs(p.cx - this.x) < r && Math.abs(p.y + p.h - this.y) < 70;
        }
    }

    // ------------------------------------------------------------------ Rest lantern (checkpoint)
    OBJ.lantern = class Lantern extends Obj {
        constructor(g, d) {
            super(g, d);
            this.id = d.id;
            this.lit = !!g.state.lanternsLit[d.id];
            this.kindle = 0;
        }
        canInteract() {
            return this.near(76) && this.game.player.onGround;
        }
        prompt() {
            return 'Rest';
        }
        interact() {
            this.game.restAt(this);
        }
        light() {
            if (!this.lit) {
                this.lit = true;
                this.kindle = 1;
                this.game.state.lanternsLit[this.id] = true;
            }
        }
        update(dt) {
            super.update(dt);
            this.kindle = Math.max(0, this.kindle - dt * 0.8);
        }
        draw(ctx) {
            const x = this.x,
                y = this.y;

            const f = this.lit ? 0.85 + Math.sin(this.t * 7) * 0.08 + Math.sin(this.t * 13) * 0.05 : 0;

            // the Hushed Gallery's lanterns burn cold: a bell-shaped glass on an iron arm, the post at the left of the art
            if (this.game.room.area.id === 'hushed') {
                BW.Assets.drawImg(ctx, this.lit ? 'obj_hg_lantern_lit' : 'obj_hg_lantern', x, y, {
                    h: 150,
                    w: 68,
                    ax: 0.18,
                    ay: 1,
                });

                const lx = x + 30,
                    ly = y - 92;

                if (this.lit)
                    this.game.addLight(lx, ly, 160 + this.kindle * 120, '#9fd8ff', 0.55 * f + this.kindle * 0.4);
                else this.game.addLight(lx, ly, 50, '#9fd8ff', 0.12);

                return;
            }

            if (!BW.Assets.drawImg(ctx, this.lit ? 'obj_lantern_lit' : 'obj_lantern', x, y, { h: 118, w: 70, ay: 1 })) {
                ctx.strokeStyle = '#2a2622';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y - 96);
                ctx.quadraticCurveTo(x, y - 110, x + 16, y - 104);
                ctx.stroke();
                ctx.fillStyle = '#3a3128';
                ctx.fillRect(x + 8, y - 98, 18, 24);
                ctx.fillStyle = this.lit ? '#ffd27a' : '#2d2a26';
                ctx.fillRect(x + 11, y - 94, 12, 16);
                ctx.fillStyle = '#2a2622';
                ctx.fillRect(x - 16, y - 8, 32, 8);
            }

            if (this.lit)
                this.game.addLight(x + 4, y - 80, 150 + this.kindle * 120, '#ffcf7a', 0.55 * f + this.kindle * 0.4);
            else this.game.addLight(x + 4, y - 80, 50, '#ffcf7a', 0.12);
        }
    };

    // ------------------------------------------------------------------ Lore tablet / sign
    OBJ.sign = class Sign extends Obj {
        canInteract() {
            return this.near(64) && this.game.player.onGround;
        }
        prompt() {
            return 'Read';
        }
        interact() {
            this.game.dialog.open(this.def.title || '', this.def.text, { kind: 'sign' });
        }
        draw(ctx) {
            const sm = this.def.small;

            const w = sm ? 26 : 40,
                h = sm ? 34 : 54;

            // a black memorial slate with a blank mask in the Hushed Gallery
            if (this.game.room.area.id === 'hushed') {
                BW.Assets.drawImg(ctx, 'obj_hg_tablet', this.x, this.y, { w: w * 1.5, h: h * 1.5, ay: 1 });
                this.game.addLight(this.x, this.y - 36, 46, '#9fd8ff', 0.16);

                return;
            }

            if (!BW.Assets.drawImg(ctx, 'obj_tablet', this.x, this.y, { w: w * 1.3, h: h * 1.25, ay: 1 })) {
                ctx.fillStyle = '#3b3f45';
                ctx.beginPath();
                ctx.moveTo(this.x - w / 2, this.y);
                ctx.lineTo(this.x - w / 2, this.y - h + 8);
                ctx.quadraticCurveTo(this.x, this.y - h - 6, this.x + w / 2, this.y - h + 8);
                ctx.lineTo(this.x + w / 2, this.y);
                ctx.fill();
                ctx.strokeStyle = 'rgba(220,230,240,0.35)';
                ctx.lineWidth = 1.5;

                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x - w / 2 + 7, this.y - h + 16 + i * 9);
                    ctx.lineTo(this.x + w / 2 - 7, this.y - h + 16 + i * 9);
                    ctx.stroke();
                }
            }
        }
    };

    // ------------------------------------------------------------------ Contextual control hints
    OBJ.hint = class Hint extends Obj {
        constructor(g, d) {
            super(g, d);
            this.a = 0;
            this.range = (d.range || 3) * T;
            this.y = (d.y + 0.5) * T;
        }
        update(dt) {
            super.update(dt);

            const p = this.game.player,
                s = this.game.state;

            let show =
                BW.settings.hints !== false && Math.abs(p.cx - this.x) < this.range && Math.abs(p.cy - this.y) < 3 * T;

            if (this.def.needs && !s.abilities[this.def.needs]) show = false;

            this.a = BW.approach(this.a, show ? 1 : 0, dt * 3);
        }
        draw(ctx) {
            if (this.a <= 0.01) return;

            const act = this.def.act;
            const key = act && act !== 'none' ? { act } : '';

            this.game.hud.worldPrompt(ctx, this.x, this.y - 30 + Math.sin(this.t * 2) * 3, key, this.def.text, this.a);
        }
    };

    // ------------------------------------------------------------------ Loose glints (one-time)
    OBJ.glint = class GlintPile extends Obj {
        constructor(g, d) {
            super(g, d);
            this.y = (d.y + 0.6) * T;

            if (g.state.flags['pk_' + d.id]) this.dead = true;
        }
        update(dt) {
            super.update(dt);

            const p = this.game.player;

            if (Math.abs(p.cx - this.x) < 26 && Math.abs(p.cy - this.y) < 40) {
                this.dead = true;
                this.flags['pk_' + this.def.id] = true;
                this.game.addGlints(this.def.n || 3);
                this.game.gainXp(BW.XP.REWARD.glints);
                BW.Audio.play('pickup', { vol: 0.6 });

                this.game.fx.burst(this.x, this.y, 10, {
                    color: ['#ffe6a6', '#9ff5ff'],
                    speed: 160,
                    life: 0.4,
                    add: true,
                    kind: 'glow',
                    size: 6,
                });
            }
        }
        draw(ctx) {
            const n = Math.min(4, this.def.n || 3);

            for (let i = 0; i < n; i++) {
                const a = this.t * 1.5 + i * ((Math.PI * 2) / n);

                drawGlintShard(ctx, this.x + Math.cos(a) * 8, this.y + Math.sin(a * 1.3) * 4 - 6, 0.9, this.t + i);
            }

            this.game.addLight(this.x, this.y - 6, 40, '#9fefff', 0.25);
        }
    };

    // ------------------------------------------------------------------ Glint cache (breakable crystal)
    OBJ.cache = class Cache extends Obj {
        constructor(g, d) {
            super(g, d);
            this.hp = 3;
            this.shake = 0;

            if (g.state.flags['pk_' + d.id]) this.dead = true;

            this.w = 46;
            this.h = 50;
            this.strikable = true;
        }
        hurtbox() {
            return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
        }
        hit() {
            this.hp--;
            this.shake = 0.25;
            BW.Audio.play('clink', { vol: 0.6, rate: 0.8 + Math.random() * 0.2 });

            this.game.fx.burst(this.x, this.y - 24, 8, {
                color: ['#bff7ff', '#ffffff'],
                kind: 'shard',
                speed: 260,
                life: 0.4,
                grav: 500,
                size: 3,
            });

            this.game.spawnGlints(this.x, this.y - 30, 2);

            if (this.hp <= 0) {
                this.dead = true;
                this.flags['pk_' + this.def.id] = true;
                this.game.spawnGlints(this.x, this.y - 30, (this.def.n || 20) - 4);
                this.game.gainXp(BW.XP.REWARD.cache);
                BW.Audio.play('break', { vol: 0.8 });

                this.game.fx.burst(this.x, this.y - 24, 24, {
                    color: ['#bff7ff', '#7fd9ff', '#ffffff'],
                    kind: 'shard',
                    speed: 380,
                    life: 0.7,
                    grav: 700,
                    size: 5,
                });

                this.game.fx.shake(4, 0.15);
            }
        }
        update(dt) {
            super.update(dt);
            this.shake = Math.max(0, this.shake - dt);
        }
        draw(ctx) {
            const sx = this.shake > 0 ? Math.sin(this.t * 80) * 3 : 0;

            if (!BW.Assets.drawImg(ctx, 'obj_cache', this.x + sx, this.y, { h: 62, w: 62, ay: 1 })) {
                ctx.fillStyle = '#5fb8c8';

                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x + sx + i * 14 - 8, this.y);
                    ctx.lineTo(this.x + sx + i * 14, this.y - 40 + Math.abs(i) * 12);
                    ctx.lineTo(this.x + sx + i * 14 + 8, this.y);
                    ctx.fill();
                }
            }

            this.game.addLight(this.x, this.y - 26, 70, '#9fefff', 0.35);
        }
    };

    // ------------------------------------------------------------------ Upgrades (Lifethread, Silk Spool)
    OBJ.pickup = class Pickup extends Obj {
        constructor(g, d) {
            super(g, d);
            this.y = (d.y + 0.5) * T;

            if (g.state.flags['pk_' + d.id]) this.dead = true;
        }
        update(dt) {
            super.update(dt);

            const p = this.game.player;

            if (p.state !== 'dead' && Math.abs(p.cx - this.x) < 28 && Math.abs(p.cy - this.y) < 42) {
                this.dead = true;
                this.flags['pk_' + this.def.id] = true;
                this.game.gainXp(BW.XP.REWARD[this.def.kind] || 0);
                this.game.collectUpgrade(this.def.kind, this.x, this.y);
            }
        }
        draw(ctx) {
            const bob = Math.sin(this.t * 2.2) * 5;
            const img = this.def.kind === 'spool' ? 'item_spool' : 'item_lifethread';

            this.game.addLight(this.x, this.y + bob, 110, this.def.kind === 'spool' ? '#cfe9ff' : '#ffd7a8', 0.55);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45;
            ctx.drawImage(BW.glowSprite('#fff0d2'), this.x - 46, this.y + bob - 46, 92, 92);
            ctx.restore();

            if (!BW.Assets.drawImg(ctx, img, this.x, this.y + bob, { w: 46, h: 46, ay: 0.5 })) {
                ctx.fillStyle = this.def.kind === 'spool' ? '#d8ecff' : '#ff8f6a';
                ctx.beginPath();
                ctx.arc(this.x, this.y + bob, 12, 0, Math.PI * 2);
                ctx.fill();
            }

            if (Math.random() < 0.15)
                this.game.fx.spawn({
                    x: this.x + BW.rand(-16, 16),
                    y: this.y + bob + BW.rand(-10, 10),
                    vy: -30,
                    life: 0.8,
                    size: 2,
                    color: '#fff3d0',
                    add: true,
                    kind: 'glow',
                });
        }
    };

    // ------------------------------------------------------------------ Odo the lamplighter
    OBJ.npc = class Npc extends Obj {
        canInteract() {
            return this.near(110) && this.game.player.onGround;
        }
        prompt() {
            return 'Talk';
        }
        interact() {
            this.game.talkToOdo(this);
        }
        draw(ctx) {
            const p = this.game.player;
            const face = p.cx < this.x ? -1 : 1;
            const talking = this.game.dialog.active && this.game.dialog.speaker === 'odo';
            const name = talking && BW.Assets.sprite('odo_talk') ? 'odo_talk' : 'odo_idle';
            const breath = 1 + Math.sin(this.t * 2) * 0.015;

            if (!BW.Assets.draw(ctx, name, 0, this.x, this.y, { flip: face < 0, sy: breath })) {
                ctx.fillStyle = '#6f7d8c';
                ctx.beginPath();
                ctx.ellipse(this.x, this.y - 24, 26, 24, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#efe2c4';
                ctx.fillRect(this.x - 18, this.y - 30, 36, 8);
            }

            this.game.addLight(this.x + face * 30, this.y - 90, 120, '#ffcf8a', 0.45 + Math.sin(this.t * 5) * 0.05);
        }
    };

    // ------------------------------------------------------------------ Shrine of the Swift Stitch
    OBJ.shrine = class Shrine extends Obj {
        constructor(g, d) {
            super(g, d);
            this.range = 70;
        }
        taken() {
            return !!this.game.state.abilities[this.def.ability];
        }
        canInteract() {
            return !this.taken() && this.near(120) && this.game.player.onGround;
        }
        prompt() {
            return 'Touch the shrine';
        }
        interact() {
            this.game.acquireAbility(this);
        }
        draw(ctx) {
            const taken = this.taken();

            if (!BW.Assets.drawImg(ctx, 'obj_shrine', this.x, this.y + 4, { h: 190, w: 150, ay: 1 })) {
                ctx.fillStyle = '#4a4552';
                ctx.fillRect(this.x - 40, this.y - 20, 80, 20);
                ctx.fillStyle = '#5d5866';
                ctx.beginPath();
                ctx.ellipse(this.x, this.y - 70, 26, 50, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            const pulse = taken ? 0.2 : 0.55 + Math.sin(this.t * 2.5) * 0.15;
            const tint = { parry: '#ffc6a0', dodge: '#b9a6ff' }[this.def.ability] || '#ffe2b0';

            this.game.addLight(this.x, this.y - 96, taken ? 90 : 170, tint, pulse);

            if (!taken && Math.random() < 0.25) {
                const a = Math.random() * Math.PI * 2;

                this.game.fx.spawn({
                    x: this.x + Math.cos(a) * 60,
                    y: this.y - 96 + Math.sin(a) * 40,
                    vx: -Math.cos(a) * 40,
                    vy: -Math.sin(a) * 30,
                    life: 1.2,
                    size: 1.6,
                    color: '#fff0c8',
                    kind: 'thread',
                    add: true,
                    drag: 0.5,
                });
            }
        }
    };

    // ------------------------------------------------------------------ Toll-loom (bell mechanism)
    OBJ.toll = class Toll extends Obj {
        constructor(g, d) {
            super(g, d);
            this.range = 90;
            this.flag = 'bell' + d.bell;
            this.swing = 0;
            this.swingV = 0;
        }
        rung() {
            return !!this.flags[this.flag];
        }
        canInteract() {
            return this.near(150) && this.game.player.onGround;
        }
        prompt() {
            return this.rung() ? 'Listen' : 'Rethread the loom';
        }
        interact() {
            if (this.rung()) {
                this.game.dialog.open(
                    'Toll-Loom',
                    ['The rethreaded cords hum faintly.', 'Far above, a bell answers.'],
                    { kind: 'sign' },
                );

                this.ring(0.4);

                return;
            }

            this.game.rethreadLoom(this);
        }
        ring(power) {
            this.swingV += power * 2.2;
            BW.Audio.play('bell', { pitch: this.def.bell === 1 ? 174.6 : 130.8, vol: 0.5 + power * 0.5, minGap: 0.2 });
        }
        update(dt) {
            super.update(dt);
            this.swingV += -this.swing * 9 * dt;
            this.swingV *= Math.exp(-0.6 * dt);
            this.swing += this.swingV * dt;
        }
        draw(ctx) {
            const rung = this.rung();

            const x = this.x,
                y = this.y;

            const bx = x,
                by = y - 168;

            // frame
            if (!BW.Assets.drawImg(ctx, 'obj_loom', x, y + 6, { h: 300, w: 300, ay: 1 })) {
                ctx.strokeStyle = '#3a2f26';
                ctx.lineWidth = 10;
                ctx.beginPath();
                ctx.moveTo(x - 110, y);
                ctx.lineTo(x - 90, y - 260);
                ctx.lineTo(x + 90, y - 260);
                ctx.lineTo(x + 110, y);
                ctx.stroke();
            }

            // cords
            ctx.strokeStyle = rung ? 'rgba(255,236,190,0.85)' : 'rgba(200,190,170,0.45)';
            ctx.lineWidth = rung ? 2 : 1.5;

            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + i * 14, y - 300);

                if (rung) ctx.lineTo(bx + i * 6 + Math.sin(this.swing) * 30, by - 40);
                else ctx.quadraticCurveTo(x + i * 22, y - 160 + Math.abs(i) * 10, x + i * 30 + 10, y - 40);

                ctx.stroke();
            }

            // bell
            ctx.save();
            ctx.translate(bx, by - 50);
            ctx.rotate(Math.sin(this.swing) * 0.35);

            if (!BW.Assets.drawImg(ctx, 'obj_bell', 0, 0, { w: 120, h: 120, ay: 0.05 })) {
                ctx.fillStyle = rung ? '#c79a4a' : '#7a6440';
                ctx.beginPath();
                ctx.moveTo(-18, 0);
                ctx.quadraticCurveTo(-26, 50, -52, 96);
                ctx.lineTo(52, 96);
                ctx.quadraticCurveTo(26, 50, 18, 0);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
            this.game.addLight(bx, by + 10, rung ? 220 : 120, rung ? '#ffe2a8' : '#9ff5dc', rung ? 0.5 : 0.25);
        }
    };

    // ------------------------------------------------------------------ Belfry seal emblems (S5 ceiling)
    OBJ.seal = class Seal extends Obj {
        constructor(g, d) {
            super(g, d);
            this.y = (d.y + 1) * T;
            this.x = (d.x + 0.5) * T;
            this.glow1 = 0;
            this.glow2 = 0;
        }
        update(dt) {
            super.update(dt);
            this.glow1 = BW.approach(this.glow1, this.flags.bell1 ? 1 : 0, dt);
            this.glow2 = BW.approach(this.glow2, this.flags.bell2 ? 1 : 0, dt);
        }
        draw(ctx) {
            const gate = this.game.room.gates.find((g) => g.kind === 'seal');
            const open = gate ? gate.anim : 0;

            if (open >= 1) return;

            const y = this.y + 6;

            for (const [i, gl] of [
                [-1, this.glow1],
                [1, this.glow2],
            ]) {
                const ex = this.x + i * 38 - i * open * 60;

                ctx.save();
                ctx.translate(ex, y);
                ctx.fillStyle = gl > 0 ? BW.rgba('#ffe7b0', 0.35 + gl * 0.6) : 'rgba(120,120,140,0.5)';
                bellIcon(ctx, 0, 0, 13);
                ctx.restore();

                if (gl > 0) this.game.addLight(ex, y + 8, 60 + gl * 40, '#ffe2a8', 0.5 * gl);
            }
        }
    };

    // ------------------------------------------------------------------ Cathedral doors (B3)
    // Sealed until the adventure's objectives are complete (both looms rethreaded); then they swing open
    // once with a short sequence, and afterwards lead into the cathedral.
    OBJ.door = class Door extends Obj {
        constructor(g, d) {
            super(g, d);
            this.range = 120;
            this.open = g.state.flags.cathedral_open ? 1 : 0;
            this.opening = false;
        }
        ready() {
            return !!(this.flags.bell1 && this.flags.bell2 && this.game.state.abilities.dodge);
        }
        canInteract() {
            return this.near(140) && this.game.player.onGround && !this.opening;
        }
        prompt() {
            return this.open >= 1 ? 'Enter the cathedral' : this.ready() ? 'Open the great doors' : 'Touch the doors';
        }
        interact() {
            if (this.open >= 1) {
                this.game.enterCathedral();

                return;
            }

            if (this.ready()) {
                this.game.openCathedralDoors(this);

                return;
            }

            const looms = this.flags.bell1 && this.flags.bell2;

            this.game.dialog.open(
                'The Great Doors',
                looms
                    ? [
                          'The looms sing, yet the doors hold fast.',
                          'A faint shrine glows in this antechamber. The weavers sealed the last lesson behind it: learn it before the doors will answer.',
                      ]
                    : [
                          'The doors are cold and do not move.',
                          'Somewhere beyond them, very faintly, a bell is waiting to be rung.',
                      ],
                { kind: 'sign' },
            );

            BW.Audio.play('bellfar', { pitch: 98, vol: 0.6 });
        }
        update(dt) {
            super.update(dt);

            if (this.opening) {
                this.open = Math.min(1, this.open + dt / 2.6);

                if (this.open >= 1) this.opening = false;
            }
        }
        draw(ctx) {
            const x = 2 * T + 6,
                y = 21 * T;

            drawCathedralDoor(ctx, x, y + 4, 300, 470, this.open, this.t, '#ffcf8a');
            this.game.addLight(x + 20, y - 200, 260, '#cfe0ff', 0.18 + Math.sin(this.t * 0.8) * 0.04);

            if (this.open > 0) this.game.addLight(x, y - 90, 140 + this.open * 140, '#ffd9a0', 0.42 * this.open);
        }
    };

    // ------------------------------------------------------------------ The open doors, seen from inside the cathedral (C1)
    OBJ.exitdoor = class ExitDoor extends Obj {
        constructor(g, d) {
            super(g, d);
            this.range = 110;
        }
        canInteract() {
            return this.near(110) && this.game.player.onGround && !this.game.bossActive();
        }
        prompt() {
            return 'Return to the antechamber';
        }
        interact() {
            this.game.exitCathedral();
        }
        draw(ctx) {
            drawCathedralDoor(ctx, this.x, this.y + 4, 200, 314, 1, this.t, '#bcd3ff');
            this.game.addLight(this.x, this.y - 110, 210, '#cfe0ff', 0.45);
        }
    };

    // ------------------------------------------------------------------ Cracked bell in the vestibule: rolls a practice toll along the floor
    OBJ.tollwave = class TollWave extends Obj {
        constructor(g, d) {
            super(g, d);
            this.cd = 1.4;
            this.glow = 0;
        }
        active() {
            return !this.flags.warden_met && this.game.state.abilities.dash;
        }
        update(dt) {
            super.update(dt);
            this.glow = Math.max(0, this.glow - dt * 1.2);

            if (!this.active()) return;

            const g = this.game,
                p = g.player;

            this.cd -= dt;

            if (
                this.cd <= 0 &&
                p.cx > this.x + 260 &&
                p.state === 'normal' &&
                !g.seq &&
                !g.transition &&
                !g.dialog.active
            ) {
                this.cd = 3.9;
                this.glow = 1;
                g.spawnHazard(new BW.PealWave(g, this.x + 34, this.y, 1, BW.PEAL_TEACH));
                BW.Audio.play('bell', { pitch: 98, vol: 0.5, minGap: 0.5 });
                BW.Audio.play('boss_wave', { vol: 0.45 });
                g.fx.ring(this.x, this.y - 30, 10, 120, 0.6, '#ffe2a8', 3);
            }
        }
        draw(ctx) {
            const x = this.x,
                y = this.y;

            const gl = this.glow + (this.active() ? 0.25 + Math.sin(this.t * 2.2) * 0.1 : 0);

            if (!BW.Assets.drawImg(ctx, 'deco_bf_bellfallen', x, y + 4, { h: 92, w: 140, ay: 1 })) {
                ctx.fillStyle = '#6d5a3a';
                ctx.beginPath();
                ctx.ellipse(x, y - 30, 60, 32, -0.3, 0, Math.PI * 2);
                ctx.fill();
            }

            if (gl > 0.05) this.game.addLight(x, y - 40, 90 + gl * 110, '#ffd27a', 0.25 + gl * 0.45);
        }
    };

    // ------------------------------------------------------------------ The Great Bell (C1): bound by the Warden, rethreaded at the end
    OBJ.greatbell = class GreatBell extends Obj {
        constructor(g, d) {
            super(g, d);
            this.x = (d.x + 0.5) * T;
            this.pivot = 200;
            this.ropeTop = 2 * T;
            this.swing = 0;
            this.swingV = 0;
            this.glow = g.state.flags.great_bell ? 1 : 0;
            this.cordA = 0;
            this.mouthY = this.pivot + 318; // lower rim of the bell
        }
        get rung() {
            return !!this.flags.great_bell;
        }
        canInteract() {
            const p = this.game.player;

            return (
                this.flags.warden_defeated &&
                !this.game.seq &&
                Math.abs(p.cx - this.x) < 120 &&
                p.onGround &&
                p.state === 'normal'
            );
        }
        prompt() {
            return this.flags.ending_seen ? 'Ring the Great Bell' : 'Rethread the Great Bell';
        }
        interact() {
            this.game.rethreadGreatBell(this);
        }
        ring(power) {
            this.swingV += power * 1.4;
        }
        update(dt) {
            super.update(dt);
            this.swingV += -this.swing * 3.2 * dt;
            this.swingV *= Math.exp(-0.35 * dt);
            this.swing += this.swingV * dt;
            this.cordA = BW.approach(this.cordA, this.flags.warden_defeated ? 1 : 0, dt * 0.6);

            if (this.rung) this.glow = Math.min(1, this.glow + dt * 0.5);
        }
        // where the bound cords attach (the Warden draws them to here)
        anchor() {
            return { x: this.x + Math.sin(this.swing) * 260, y: this.mouthY - 20 };
        }
        draw(ctx) {
            const x = this.x,
                py = this.pivot,
                rung = this.rung,
                gl = this.glow;

            // hanging ropes
            ctx.strokeStyle = rung ? `rgba(255,226,160,${0.55 + gl * 0.35})` : 'rgba(40,36,44,0.95)';
            ctx.lineWidth = 7;

            for (const o of [-46, 46]) {
                ctx.beginPath();
                ctx.moveTo(x + o * 1.4, this.ropeTop);
                ctx.lineTo(x + o + Math.sin(this.swing) * 12, py + 18);
                ctx.stroke();
            }

            ctx.save();
            ctx.translate(x, py);
            ctx.rotate(this.swing * 0.22);

            if (!BW.Assets.drawImg(ctx, 'obj_great_bell', 0, 0, { w: 300, h: 327, ay: 0 })) {
                ctx.fillStyle = '#3f6a5e';
                ctx.beginPath();
                ctx.moveTo(-50, 40);
                ctx.quadraticCurveTo(-70, 220, -150, 320);
                ctx.lineTo(150, 320);
                ctx.quadraticCurveTo(70, 220, 50, 40);
                ctx.closePath();
                ctx.fill();
            }

            if (gl > 0.01) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.55 * gl;
                ctx.drawImage(BW.glowSprite('#ffd27a'), -220, 40, 440, 380);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
            }

            ctx.restore();

            // the bell-pull: once the Warden falls, its slack silk hangs down within reach
            if (this.cordA > 0.01) {
                const cx = x + Math.sin(this.swing) * 70,
                    bottom = BW.lerp(this.mouthY, 21 * T - 70, this.cordA);

                ctx.strokeStyle = rung ? '#ffe7b5' : `rgba(236,230,214,${0.85 * this.cordA})`;
                ctx.lineWidth = rung ? 3 : 2.5;
                ctx.beginPath();
                ctx.moveTo(x, this.mouthY - 30);

                ctx.quadraticCurveTo(
                    cx + Math.sin(this.t * 1.3) * 10,
                    (this.mouthY + bottom) / 2,
                    cx + Math.sin(this.t * 1.7) * 6,
                    bottom,
                );

                ctx.stroke();
                ctx.fillStyle = rung ? '#fff1cf' : '#d9d2c2';
                ctx.beginPath();
                ctx.arc(cx + Math.sin(this.t * 1.7) * 6, bottom + 4, 6, 0, Math.PI * 2);
                ctx.fill();

                if (!rung)
                    this.game.addLight(
                        cx,
                        bottom,
                        70,
                        '#ffe7b5',
                        0.25 * this.cordA * (0.7 + Math.sin(this.t * 3) * 0.3),
                    );
            }

            this.game.addLight(x, py + 200, rung ? 380 : 220, rung ? '#ffd9a0' : '#9fb4e8', rung ? 0.55 * gl : 0.18);
        }
    };

    // ------------------------------------------------------------------ Moving shuttle platform
    OBJ.mover = class Mover extends Obj {
        constructor(g, d) {
            super(g, d);
            this.w = d.w * T;
            this.h = 18;
            this.solidTop = true;
            this.ax = d.ax * T;
            this.bx = d.bx * T;
            this.ay = d.ay * T;
            this.by = d.by * T;
            this.x = this.ax;
            this.y = this.ay;
            this.speed = d.speed || 90;
            this.dir = 1;
            this.wait = 0.5;
            this.stepDx = 0;
            this.stepDy = 0;
            g.room.platforms.push(this);
            this.isPlatform = true;
        }
        update(dt) {
            super.update(dt);

            const ox = this.x,
                oy = this.y;

            if (this.wait > 0) this.wait -= dt;
            else {
                const tx = this.dir > 0 ? this.bx : this.ax,
                    ty = this.dir > 0 ? this.by : this.ay;

                const dx = tx - this.x,
                    dy = ty - this.y,
                    d = Math.hypot(dx, dy);

                const sp = this.speed * BW.clamp(d / 40 + 0.25, 0.25, 1);

                if (d <= sp * dt) {
                    this.x = tx;
                    this.y = ty;
                    this.dir *= -1;
                    this.wait = 0.7;
                } else {
                    this.x += (dx / d) * sp * dt;
                    this.y += (dy / d) * sp * dt;
                }
            }

            this.stepDx = this.x - ox;
            this.stepDy = this.y - oy;
        }
        draw(ctx) {
            // rail
            ctx.strokeStyle = 'rgba(30,24,22,0.8)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.ax + this.w / 2, this.ay + 6);
            ctx.lineTo(this.bx + this.w / 2, this.by + 6);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,220,170,0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
            drawPlank(ctx, this.x, this.y, this.w, this.h, '#6b4a33', '#c69a6a');
            ctx.fillStyle = '#d8cbb6';
            ctx.beginPath();
            ctx.ellipse(this.x + this.w / 2, this.y + 12, 10, 7, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    // ------------------------------------------------------------------ Lift (station elevator)
    OBJ.lift = class Lift extends Obj {
        constructor(g, d) {
            super(g, d);
            this.w = d.w * T;
            this.h = 20;
            this.solidTop = true;
            this.isPlatform = true;
            this.x = d.x * T;
            this.yTop = d.top * T;
            this.yBottom = d.bottom * T;
            this.atTop = !!g.state.flags[d.id + '_top'];
            this.y = this.atTop ? this.yTop : this.yBottom;
            this.moving = false;
            this.vy = 0;
            this.rideT = 0;
            this.stepDx = 0;
            this.stepDy = 0;
            this.target = this.y;
            this.speed = d.speed || 420;
            g.room.platforms.push(this);
        }
        active() {
            return !!this.flags[this.def.flag];
        }
        update(dt) {
            super.update(dt);

            const p = this.game.player,
                oy = this.y;

            const riding = p.platform === this && p.onGround;

            if (!this.moving) {
                if (this.active()) {
                    if (riding && p.state === 'normal' && !this.needStepOff) {
                        this.rideT += dt;

                        if (this.rideT > 0.45) this.go(this.atTop ? this.yBottom : this.yTop);
                    } else if (riding) {
                        this.rideT = 0;
                    } else {
                        this.needStepOff = false;
                        this.rideT = 0;

                        const other = this.atTop ? this.yBottom : this.yTop;

                        const near =
                            Math.abs(p.y + p.h - other) < 8 &&
                            Math.abs(p.cx - (this.x + this.w / 2)) < this.w / 2 + 3 * T &&
                            p.onGround;

                        if (near) this.go(other);
                    }
                }
            } else {
                const dir = Math.sign(this.target - this.y);
                const dist = Math.abs(this.target - this.y);
                const sp = Math.min(this.speed, 60 + dist * 2.2, 60 + Math.abs(this.travel - dist) * 3);

                if (dist <= sp * dt) {
                    this.y = this.target;
                    this.moving = false;
                    this.atTop = this.target === this.yTop;
                    this.needStepOff = true;
                    this.flags[this.def.id + '_top'] = this.atTop;
                    this.game.fx.shake(3, 0.15);
                    BW.Audio.play('land', { vol: 0.8, rate: 0.6 });
                } else this.y += dir * sp * dt;

                if (Math.random() < 0.2)
                    this.game.fx.spawn({
                        x: this.x + BW.rand(0, this.w),
                        y: this.y + 16,
                        vx: 0,
                        vy: dir * -60,
                        life: 0.5,
                        size: 1.5,
                        color: '#ffe0b0',
                        add: true,
                    });
            }

            this.stepDy = this.y - oy;
        }
        go(ty) {
            this.target = ty;
            this.moving = true;
            this.travel = Math.abs(ty - this.y);
            this.rideT = 0;
            BW.Audio.play('lift');
        }
        draw(ctx) {
            const cx = this.x + this.w / 2;

            ctx.strokeStyle = this.active() ? 'rgba(255,232,190,0.8)' : 'rgba(170,160,150,0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x + 10, this.y);
            ctx.lineTo(this.x + 10, this.yTop - 400);
            ctx.moveTo(this.x + this.w - 10, this.y);
            ctx.lineTo(this.x + this.w - 10, this.yTop - 400);
            ctx.stroke();
            drawPlank(ctx, this.x, this.y, this.w, this.h, '#5c4636', '#d8b07a');
            ctx.fillStyle = this.active() ? '#ffd79a' : '#5a5048';
            ctx.beginPath();
            ctx.arc(cx, this.y + 10, 5, 0, Math.PI * 2);
            ctx.fill();

            if (this.active()) this.game.addLight(cx, this.y + 8, 60, '#ffd79a', 0.35);
        }
    };

    // ------------------------------------------------------------------ Swinging bell hazard
    OBJ.pendulum = class Pendulum extends Obj {
        constructor(g, d) {
            super(g, d);
            this.px0 = d.x * T;
            this.py0 = d.y * T;
            this.len = d.len * T;
            this.r = 34;
            this.lastSide = 0;
        }
        pos(time) {
            const a = this.def.amp * Math.sin((time / this.def.period) * Math.PI * 2 + this.def.phase);

            return { a, x: this.px0 + Math.sin(a) * this.len, y: this.py0 + Math.cos(a) * this.len };
        }
        update(dt) {
            super.update(dt);

            const p = this.pos(this.game.time),
                pl = this.game.player;

            const hb = pl.hurtbox();

            const cx = BW.clamp(p.x, hb.x, hb.x + hb.w),
                cy = BW.clamp(p.y, hb.y, hb.y + hb.h);

            if (Math.hypot(p.x - cx, p.y - cy) < this.r) pl.hurt(1, p.x, { trap: true, cause: 'A swinging bell' });

            const side = Math.sign(p.x - this.px0);

            if (side !== this.lastSide && Math.abs(pl.cx - p.x) < 700)
                BW.Audio.play('flutter', { vol: 0.25, rate: 0.5, minGap: 0.5 });

            this.lastSide = side;
        }
        draw(ctx) {
            const p = this.pos(this.game.time);

            ctx.strokeStyle = '#2a2830';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(this.px0, this.py0);
            ctx.lineTo(p.x, p.y - 30);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(220,220,235,0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(-p.a);

            if (!BW.Assets.drawImg(ctx, 'obj_bell', 0, -44, { w: 92, h: 92, ay: 0 })) {
                ctx.fillStyle = '#a9895a';
                ctx.beginPath();
                ctx.moveTo(-14, -40);
                ctx.quadraticCurveTo(-22, 0, -38, 36);
                ctx.lineTo(38, 36);
                ctx.quadraticCurveTo(22, 0, 14, -40);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
            this.game.addLight(p.x, p.y, 90, '#ffe2a8', 0.18);
        }
    };

    // ------------------------------------------------------------------ Dropped glint coin
    class GlintCoin {
        constructor(game, x, y) {
            this.game = game;
            this.x = x;
            this.y = y;
            this.w = 10;
            this.h = 10;
            this.vx = BW.rand(-220, 220);
            this.vy = BW.rand(-520, -260);
            this.t = 0;
            this.dead = false;
            this.grounded = false;
        }
        update(dt) {
            this.t += dt;

            const p = this.game.player,
                room = this.game.room;

            const dx = p.cx - this.x,
                dy = p.cy - this.y,
                d = Math.hypot(dx, dy);

            if (this.t > 0.35 && d < 170 && p.state !== 'dead') {
                this.vx = BW.damp(this.vx, (dx / d) * 520, 8, dt);
                this.vy = BW.damp(this.vy, (dy / d) * 520, 8, dt);
            } else this.vy = Math.min(this.vy + 1500 * dt, 700);

            const box = { x: this.x - 5, y: this.y - 5, w: 10, h: 10 };

            if (Phys.moveX(room, box, this.vx * dt)) this.vx *= -0.5;

            const r = Phys.moveY(room, box, this.vy * dt);

            if (r.landed) {
                this.vy = this.vy > 140 ? -this.vy * 0.4 : 0;
                this.vx *= 0.7;

                if (Math.abs(this.vy) > 60) BW.Audio.play('glint', { vol: 0.15, minGap: 0.05 });
            }

            if (r.ceil) this.vy = 0;

            this.x = box.x + 5;
            this.y = box.y + 5;

            if (d < 26 && this.t > 0.15 && p.state !== 'dead') {
                this.dead = true;
                this.game.addGlints(1);
                BW.Audio.play('glint', { vol: 0.35, minGap: 0.02 });

                this.game.fx.spawn({
                    x: this.x,
                    y: this.y,
                    life: 0.25,
                    size: 8,
                    color: '#bff7ff',
                    kind: 'glow',
                    add: true,
                });
            }

            if (this.t > 30) this.dead = true;
        }
        draw(ctx) {
            drawGlintShard(ctx, this.x, this.y, 0.8, this.t * 3);
        }
    }

    // ------------------------------------------------------------------ Spitter's silk glob
    class EnemyShot {
        constructor(game, x, y, vx, vy) {
            this.game = game;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.r = 11;
            this.t = 0;
            this.dead = false;
        }
        update(dt) {
            this.t += dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            const room = this.game.room,
                p = this.game.player;

            if (room.solidPx(this.x, this.y) || this.t > 5) return this.pop();

            const hb = p.hurtbox();

            const cx = BW.clamp(this.x, hb.x, hb.x + hb.w),
                cy = BW.clamp(this.y, hb.y, hb.y + hb.h);

            if (Math.hypot(this.x - cx, this.y - cy) < this.r - 2) {
                if (p.hurt(BW.Difficulty.WEIGHTS.glob, this.x, { cause: BW.ENEMY_NAMES.spitter })) this.pop();
            }

            if (Math.random() < 0.4)
                this.game.fx.spawn({
                    x: this.x,
                    y: this.y,
                    vx: -this.vx * 0.1,
                    vy: -this.vy * 0.1,
                    life: 0.35,
                    size: 3,
                    color: '#ffd59a',
                    add: true,
                    kind: 'glow',
                });
        }
        pop() {
            this.dead = true;

            this.game.fx.burst(this.x, this.y, 8, {
                color: ['#ffe2b0', '#fff'],
                speed: 160,
                life: 0.3,
                kind: 'thread',
                add: true,
            });

            BW.Audio.play('spit', { vol: 0.3, rate: 1.5 });
        }
        draw(ctx) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            const R = this.r * 2.2;

            ctx.drawImage(BW.glowSprite('#ffaa5a'), this.x - R, this.y - R, R * 2, R * 2);
            ctx.globalAlpha = 0.9;
            ctx.drawImage(BW.glowSprite('#fff0d2'), this.x - R * 0.5, this.y - R * 0.5, R, R);
            ctx.restore();
            ctx.fillStyle = '#fff5e0';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r * 0.55, 0, Math.PI * 2);
            ctx.fill();
            this.game.addLight(this.x, this.y, 60, '#ffb35a', 0.35);
        }
    }

    // ------------------------------------------------------------------ Silk Lance (player projectile)
    class Lance {
        constructor(game, x, y, dir) {
            this.game = game;
            this.x = x;
            this.y = y;
            this.dir = dir;
            this.vx = dir * 1150;
            this.t = 0;
            this.dead = false;
            this.hits = new Set();
            this.x0 = x;
        }
        box() {
            return { x: this.dir > 0 ? this.x - 50 : this.x - 10, y: this.y - 12, w: 60, h: 24 };
        }
        update(dt) {
            this.t += dt;
            this.x += this.vx * dt;

            const g = this.game;

            if (g.room.solidPx(this.x + this.dir * 10, this.y) || Math.abs(this.x - this.x0) > 760) {
                this.dead = true;
                g.fx.burst(this.x, this.y, 12, { color: ['#fff6dc', '#ffd98a'], kind: 'spark', speed: 300, life: 0.3 });

                return;
            }

            g.resolveLanceHits(this);

            if (Math.random() < 0.8)
                g.fx.spawn({
                    x: this.x - this.dir * 20,
                    y: this.y + BW.rand(-4, 4),
                    vx: -this.dir * 100,
                    vy: BW.rand(-20, 20),
                    life: 0.3,
                    size: 1.5,
                    color: '#fff3d0',
                    kind: 'thread',
                    add: true,
                });
        }
        draw(ctx) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            const len = 90;
            const g2 = ctx.createLinearGradient(this.x - this.dir * len, this.y, this.x, this.y);

            g2.addColorStop(0, 'rgba(255,220,150,0)');
            g2.addColorStop(1, 'rgba(255,248,230,0.95)');
            ctx.strokeStyle = g2;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.x - this.dir * len, this.y);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(this.x - this.dir * 40, this.y);
            ctx.lineTo(this.x + this.dir * 8, this.y);
            ctx.stroke();
            ctx.restore();
            this.game.addLight(this.x, this.y, 80, '#ffe7b5', 0.5);
        }
    }

    // ------------------------------------------------------------------ drawing helpers
    function drawGlintShard(ctx, x, y, s, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 2) * 0.4);
        ctx.scale(s, s);
        ctx.fillStyle = '#c99a4c';
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffe9b0';
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(2.5, -1);
        ctx.lineTo(-1.5, 1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawPlank(ctx, x, y, w, h, dark, light) {
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + 2, w, h - 4);
        ctx.fillStyle = light;
        ctx.fillRect(x, y, w, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + h - 6, w, 4);
        ctx.strokeStyle = 'rgba(20,14,10,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        for (let i = 1; i < w / 40; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * 40, y + 3);
            ctx.lineTo(x + i * 40, y + h - 3);
            ctx.stroke();
        }
    }

    // The great cathedral doors (one image), optionally swung open: the two leaves are slices of the image
    // narrowing toward their hinges inside the arch, revealing the light beyond.
    function drawCathedralDoor(ctx, x, yb, w, h, open, t, beyond) {
        const img = BW.Assets.img('obj_door');

        const L = x - w / 2,
            top = yb - h;

        if (!img) {
            ctx.fillStyle = '#2b2a33';
            ctx.fillRect(x - w * 0.4, yb - h * 0.9, w * 0.8, h * 0.9);

            return;
        }

        ctx.drawImage(img, L, top, w, h);

        if (open <= 0) return;

        const a = BW.easeInOutSine(Math.min(1, open));

        const lx = L + w * 0.2,
            rx = L + w * 0.8,
            sy = top + h * 0.4,
            ay = top + h * 0.215,
            by = top + h * 0.975;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lx, by);
        ctx.lineTo(lx, sy);
        ctx.quadraticCurveTo(lx, ay + (sy - ay) * 0.1, x, ay);
        ctx.quadraticCurveTo(rx, ay + (sy - ay) * 0.1, rx, sy);
        ctx.lineTo(rx, by);
        ctx.closePath();
        ctx.clip();

        const gr = ctx.createLinearGradient(0, ay, 0, by);

        gr.addColorStop(0, '#0b0a10');
        gr.addColorStop(0.45, BW.rgba(beyond, 0.1));
        gr.addColorStop(0.8, BW.rgba(beyond, 0.35));
        gr.addColorStop(1, BW.rgba(beyond, 0.7));
        ctx.fillStyle = '#0b0a10';
        ctx.fillRect(lx, ay, rx - lx, by - ay);
        ctx.fillStyle = gr;
        ctx.fillRect(lx, ay, rx - lx, by - ay);
        ctx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < 4; i++) {
            const bx = lx + (rx - lx) * (0.18 + i * 0.22) + Math.sin(t * 0.7 + i * 2) * 6;

            ctx.globalAlpha = (0.1 + Math.sin(t * 1.3 + i) * 0.04) * a;
            ctx.fillStyle = beyond;
            ctx.beginPath();
            ctx.moveTo(bx, ay + 20);
            ctx.lineTo(bx + 14, ay + 20);
            ctx.lineTo(bx + 40, by);
            ctx.lineTo(bx - 12, by);
            ctx.closePath();
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const lw = w * 0.3 * (1 - 0.86 * a),
            iw = img.width,
            ih = img.height;

        if (lw > 0.5) {
            ctx.drawImage(img, iw * 0.2, 0, iw * 0.3, ih, lx, top, lw, h);
            ctx.drawImage(img, iw * 0.5, 0, iw * 0.3, ih, rx - lw, top, lw, h);
            ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
            ctx.fillRect(lx, top, lw, h);
            ctx.fillRect(rx - lw, top, lw, h);
        }

        ctx.restore();
    }

    function bellIcon(ctx, x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.35, y - s * 0.7);
        ctx.quadraticCurveTo(x - s * 0.55, y + s * 0.1, x - s, y + s * 0.6);
        ctx.lineTo(x + s, y + s * 0.6);
        ctx.quadraticCurveTo(x + s * 0.55, y + s * 0.1, x + s * 0.35, y - s * 0.7);
        ctx.quadraticCurveTo(x, y - s * 1.0, x - s * 0.35, y - s * 0.7);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + s * 0.78, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }

    BW.OBJ = OBJ;
    BW.ObjBase = Obj;
    BW.GlintCoin = GlintCoin;
    BW.EnemyShot = EnemyShot;
    BW.Lance = Lance;
    BW.drawGlintShard = drawGlintShard;
    BW.bellIcon = bellIcon;
    BW.drawCathedralDoor = drawCathedralDoor;
    BW.drawPlank = drawPlank;
})(window.BW);

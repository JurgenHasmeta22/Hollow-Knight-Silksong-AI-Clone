'use strict';

// The bottom-left cluster, in the manner of Sekiro's tool wheel: four diamonds in a cross. The selected quick item sits
// at the top, large, with the previous and next items either side (they slide round when you change item) and the Healing
// Gourd below. Buffs ride on a ring around the selected item. Drawn over the base HUD (hud.js).
(function (BW) {
    const H = BW.Hud.prototype,
        base = H.draw,
        baseUpdate = H.update;

    // little vector icons, drawn around (0, 0) in a 40 x 40 box
    const ICONS = {
        charge(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(-12, 10);
            ctx.quadraticCurveTo(-14, -12, 0, -14);
            ctx.quadraticCurveTo(14, -12, 12, 10);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(-14, 8, 28, 5);
            ctx.fillStyle = '#1a1410';
            ctx.beginPath();
            ctx.arc(0, 15, 3, 0, Math.PI * 2);
            ctx.fill();
        },
        shards(ctx, c) {
            ctx.fillStyle = c;

            for (const a of [-0.5, 0, 0.5]) {
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(0, -16);
                ctx.lineTo(5, 4);
                ctx.lineTo(0, 11);
                ctx.lineTo(-5, 4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        },
        veil(ctx, c) {
            ctx.fillStyle = c;

            for (const [x, y, r] of [
                [-7, 4, 9],
                [7, 3, 10],
                [0, -6, 11],
                [-3, 11, 6],
            ]) {
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        draught(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(-4, -15);
            ctx.lineTo(4, -15);
            ctx.lineTo(4, -6);
            ctx.quadraticCurveTo(14, 0, 11, 11);
            ctx.lineTo(-11, 11);
            ctx.quadraticCurveTo(-14, 0, -4, -6);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#1a1410';
            ctx.fillRect(-5, -17, 10, 4);
        },
        gourd(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(0, 6, 12, 0, Math.PI * 2);
            ctx.arc(0, -9, 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-3, -19, 6, 8);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(-4, -22, 8, 4);
        },
    };

    BW.ItemIcons = ICONS;

    // a diamond (a square turned on its corner) of radius r
    function diamondPath(ctx, x, y, r, round = 5) {
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.lineJoin = 'round';
        ctx.lineWidth = round;
    }

    function keycap(ctx, x, y, label) {
        ctx.font = `600 13px ${BW.FONT_B}`;

        const w = Math.max(20, ctx.measureText(label).width + 12);

        ctx.fillStyle = 'rgba(8,10,14,0.85)';
        BW.roundRect(ctx, x - w / 2, y - 10, w, 20, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(236,222,190,0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#efe3c0';
        ctx.fillText(label, x, y + 1);
    }

    // one diamond slot: frame, icon, count
    function slot(ctx, x, y, r, o) {
        ctx.save();

        const lit = o.lit,
            tone = o.empty ? 0.38 : 1;

        diamondPath(ctx, x, y, r, 3);
        ctx.fillStyle = lit ? 'rgba(26,22,16,0.92)' : 'rgba(10,12,18,0.7)';
        ctx.fill();
        ctx.strokeStyle = o.ring || (lit ? 'rgba(236,214,160,0.9)' : 'rgba(225,214,192,0.28)');
        ctx.stroke();

        if (lit) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.18 + (o.flash || 0) * 0.5;
            diamondPath(ctx, x, y, r - 4, 1);
            ctx.fillStyle = '#ffe9b0';
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.globalAlpha = tone * (lit ? 1 : 0.75);
        ctx.translate(x, y - (lit ? 1 : 0));
        ctx.scale(r / 27, r / 27);
        ICONS[o.icon](ctx, o.empty ? '#8a8070' : lit ? '#fff1d0' : '#cdbf9c');
        ctx.restore();

        if (o.count != null) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `600 ${lit ? 17 : 14}px ${BW.FONT_B}`;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.strokeText(String(o.count), x + r * 0.62, y + r * 0.5);
            ctx.fillStyle = o.empty ? '#ff8a7a' : '#fff1d0';
            ctx.fillText(String(o.count), x + r * 0.62, y + r * 0.5);
            ctx.restore();
        }
    }

    H.update = function (dt) {
        baseUpdate.call(this, dt);

        const st = this.game.state;

        if (!st) return;

        // a change of item slides the diamonds round
        if (this.shownQuick == null) this.shownQuick = st.quick;

        if (st.quick !== this.shownQuick) {
            const o = BW.Items.ORDER,
                n = o.length,
                d = (o.indexOf(st.quick) - o.indexOf(this.shownQuick) + n) % n;

            this.slide = d === 1 ? 1 : d === n - 1 ? -1 : 1;
            this.slideT = 1;
            this.shownQuick = st.quick;
        }

        this.slideT = Math.max(0, (this.slideT || 0) - dt * 5.5);
    };

    H.draw = function (ctx) {
        base.call(this, ctx);

        const g = this.game,
            st = g.state;

        if (!st || !st.items || g.hudAlpha <= 0) return;

        const I = BW.Items,
            O = I.ORDER,
            n = O.length,
            sel = O.indexOf(st.quick),
            ox = 122,
            oy = BW.VH - 128,
            t = g.time,
            ease = (this.slideT || 0) * (this.slideT || 0),
            shift = (this.slide || 0) * ease; // the new item starts one step to the side and glides to the middle

        ctx.save();
        ctx.globalAlpha = g.hudAlpha;

        // soft glow behind the cluster so it reads over bright scenery
        const bg = ctx.createRadialGradient(ox, oy + 20, 10, ox, oy + 20, 150);

        bg.addColorStop(0, 'rgba(0,0,0,0.5)');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(ox - 160, oy - 110, 320, 300);

        // the carousel: the item before, the selected one, the item after (the rest are out of sight)
        const spots = [
            { rel: -1, x: -76, y: 16, r: 26 },
            { rel: 0, x: 0, y: -6, r: 42 },
            { rel: 1, x: 76, y: 16, r: 26 },
        ];

        const draws = [];

        for (let k = -2; k <= 2; k++) {
            const idx = (sel + k + n * 4) % n,
                rel = k + shift;

            // position from the relative slot (linear between the three spots, fading beyond them)
            const a = Math.max(-1, Math.min(1, rel)),
                side = a < 0 ? spots[0] : spots[2],
                mid = spots[1],
                u = Math.abs(a),
                x = mid.x + (side.x - mid.x) * u + (Math.abs(rel) > 1 ? Math.sign(rel) * (Math.abs(rel) - 1) * 76 : 0),
                y = mid.y + (side.y - mid.y) * u,
                r = mid.r + (side.r - mid.r) * u,
                vis = Math.abs(rel) <= 1 ? 1 : Math.max(0, 2 - Math.abs(rel));

            if (vis > 0.02) draws.push({ idx, rel, x: ox + x, y: oy + y, r, vis });
        }

        draws.sort((p, q) => Math.abs(q.rel) - Math.abs(p.rel));

        const flash = this.pulses.item || 0;

        for (const d of draws) {
            const id = O[d.idx],
                lit = Math.abs(d.rel) < 0.5;

            ctx.globalAlpha = g.hudAlpha * d.vis;
            slot(ctx, d.x, d.y, d.r, {
                icon: id,
                count: I.count(st, id),
                empty: I.count(st, id) <= 0,
                lit,
                flash: lit ? flash : 0,
                ring: lit && this.denies.item > 0 ? '#ff6a5a' : null,
            });
        }

        ctx.globalAlpha = g.hudAlpha;

        // buffs ring the selected item: a draught's remaining time, an Ash Veil's
        const pl = g.player,
            cx = ox,
            cy = oy - 6;

        for (const [left, full, col, rr] of [
            [pl.rageT || 0, 20, '#ff5a4a', 50],
            [pl.veilT || 0, 1.5, '#b8b8c8', 56],
        ]) {
            if (left <= 0) continue;

            ctx.strokeStyle = col;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / full));
            ctx.stroke();
        }

        // the name of the selected item, briefly after a change, and the keys
        const def = I.DEFS[st.quick];

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const nameA = Math.min(1, (this.slideT || 0) * 3 + flash * 2);

        if (nameA > 0.02) {
            ctx.globalAlpha = g.hudAlpha * nameA;
            ctx.font = `600 16px ${BW.FONT_B}`;
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.strokeText(def.name, ox, oy - 62);
            ctx.fillStyle = '#fff1d0';
            ctx.fillText(def.name, ox, oy - 62);
            ctx.globalAlpha = g.hudAlpha;
        }

        keycap(ctx, ox, oy + 42, BW.Input.label('item').split(' ')[0]);
        keycap(ctx, ox + 76, oy + 48, BW.Input.label('itemNext').split(' ')[0]);

        // the Healing Gourd: the fourth diamond, below
        const left = BW.Gourd.left(st),
            max = BW.Gourd.max(st),
            gx = ox,
            gy = oy + 100,
            gr = 31;

        slot(ctx, gx, gy, gr, {
            icon: 'gourd',
            lit: left > 0,
            empty: left <= 0,
            flash: this.pulses.gourd || 0,
            ring: this.denies.gourd > 0 ? '#ff6a5a' : left > 0 ? 'rgba(232,196,120,0.85)' : null,
        });

        // one pip per draught, in an arc to the right of the gourd
        for (let i = 0; i < max; i++) {
            const a = -0.6 + (i / Math.max(1, max - 1)) * 1.2,
                px = gx + 50 + Math.cos(a) * 14 - 12,
                py = gy + Math.sin(a) * 26;

            ctx.fillStyle = i < left ? '#ffe0a0' : 'rgba(255,255,255,0.16)';
            ctx.beginPath();
            ctx.arc(px, py, 4.2, 0, Math.PI * 2);
            ctx.fill();

            if (i < left) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = g.hudAlpha * (0.25 + 0.15 * Math.sin(t * 3 + i));
                ctx.fillStyle = '#ffd890';
                ctx.beginPath();
                ctx.arc(px, py, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = g.hudAlpha;
            }
        }

        keycap(ctx, gx - 50, gy + 4, BW.Input.label('heal').split(' ')[0]);
        ctx.restore();
    };
})(window.BW);

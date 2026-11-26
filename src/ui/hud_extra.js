'use strict';

// HUD pieces for the Healing Gourd and the quick-item slot, drawn bottom-left over the base HUD (hud.js).
(function (BW) {
    const H = BW.Hud.prototype,
        base = H.draw;

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
    };

    BW.ItemIcons = ICONS;

    function drawGourd(ctx, x, y, left, max, flash) {
        ctx.save();
        ctx.translate(x, y);

        const full = left > 0;

        ctx.fillStyle = 'rgba(8,10,14,0.65)';
        BW.roundRect(ctx, -34, -46, 68, 92, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,220,200,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // the gourd: a round body under a small head and a neck, with a cork
        const body = full ? '#c98a3a' : '#5a5148';

        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(0, 8, 17, 0, Math.PI * 2);
        ctx.arc(0, -13, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-4, -26, 8, 10);
        ctx.fillStyle = full ? '#8a5a22' : '#403a34';
        ctx.fillRect(-5, -30, 10, 6);
        ctx.strokeStyle = 'rgba(255,240,200,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-6, 6, 10, 2.4, 4.0);
        ctx.stroke();

        if (flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = flash;
            ctx.drawImage(BW.glowSprite('#ffe0a0'), -50, -56, 100, 100);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }

        // one pip per draught the gourd can hold
        for (let i = 0; i < max; i++) {
            ctx.fillStyle = i < left ? '#ffe0a0' : 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc((i - (max - 1) / 2) * 13, 34, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    function drawSlot(ctx, x, y, st, flash, deny, rage) {
        const id = st.quick,
            def = BW.Items.DEFS[id],
            n = BW.Items.count(st, id);

        ctx.save();
        ctx.translate(x + (deny > 0 ? Math.sin(deny * 60) * 3 : 0), y);
        ctx.fillStyle = 'rgba(8,10,14,0.65)';
        BW.roundRect(ctx, -34, -46, 68, 92, 14);
        ctx.fill();
        ctx.strokeStyle = rage > 0 ? '#ff5a4a' : 'rgba(230,220,200,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(0, -8);
        ctx.globalAlpha = n > 0 ? 1 : 0.35;
        ICONS[id](ctx, '#e8d8b0');
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 18px ${BW.FONT_B}`;
        ctx.fillStyle = n > 0 ? '#fff1d0' : '#8a8070';
        ctx.fillText('x' + n, 0, 22);
        ctx.font = `500 13px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(230,220,200,0.6)';
        ctx.fillText(BW.Input.label('item').split(' ')[0] + '  ' + def.name, 0, 38);

        if (flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = flash * 0.6;
            ctx.drawImage(BW.glowSprite('#ffffff'), -50, -56, 100, 100);
        }

        ctx.restore();
    }

    H.draw = function (ctx) {
        base.call(this, ctx);

        const g = this.game,
            st = g.state;

        if (!st || !st.items || g.hudAlpha <= 0) return;

        const left = BW.Gourd.left(st),
            max = BW.Gourd.max(st),
            y = BW.VH - 62;

        ctx.save();
        ctx.globalAlpha = g.hudAlpha;
        drawGourd(ctx, 52, y, left, max, this.pulses.gourd || 0);

        if (this.denies.gourd > 0) {
            ctx.strokeStyle = `rgba(255,90,74,${this.denies.gourd})`;
            ctx.lineWidth = 3;
            BW.roundRect(ctx, 52 - 34, y - 46, 68, 92, 14);
            ctx.stroke();
        }

        drawSlot(ctx, 132, y, st, this.pulses.item || 0, this.denies.item || 0, g.player.rageT || 0);
        ctx.restore();
    };
})(window.BW);

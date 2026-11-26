'use strict';

// The Skills screen (pause menu): the three branches of the skill tree, with the points to spend.
// Arrows move over the nodes, confirm learns the one under the cursor, back closes.
(function (BW) {
    const M = BW.Menu.prototype;
    const COLS = 3,
        ROWS = 5;

    const nodeAt = (c, r) => BW.Skills.NODES.find((n) => n.at[0] === c && n.at[1] === r);

    const pos = (n) => ({ x: BW.VW * (0.25 + 0.25 * n.at[0]), y: 190 + n.at[1] * 86 });

    M.skillsUpdate = function (dt, inp) {
        const d = this.screen.data,
            g = this.game,
            st = g.state;

        d.t = (d.t || 0) + dt;

        if (!d.id) d.id = BW.Skills.NODES[0].id;

        const cur = BW.Skills.BY_ID[d.id];

        const go = (c, r) => {
            c = (c + COLS) % COLS;
            r = BW.clamp(r, 0, ROWS - 1);

            const n = nodeAt(c, r);

            if (!n) return;

            d.id = n.id;
            BW.Audio.play('ui_move');
        };

        if (inp.pressed.left) go(cur.at[0] - 1, cur.at[1]);
        else if (inp.pressed.right) go(cur.at[0] + 1, cur.at[1]);
        else if (inp.pressed.up) go(cur.at[0], cur.at[1] - 1);
        else if (inp.pressed.down) go(cur.at[0], cur.at[1] + 1);

        if (inp.pressed.confirm && this.t > 0.1) {
            const was = BW.Skills.status(st, cur.id);

            if (was === 'open' && BW.Skills.learn(g, cur.id)) {
                d.flash = 1;
                g.hud.toast('Learned ' + cur.name, cur.desc, 3);
                g.hud.glintFlash = 0.3;
            } else BW.Audio.play('ui_back', { vol: 0.6 });
        }

        d.flash = Math.max(0, (d.flash || 0) - dt * 2);

        if ((inp.pressed.back || inp.pressed.pause) && this.t > 0.1) {
            BW.Audio.play('ui_back');
            this.pop();
        }
    };

    M.skillsDraw = function (ctx) {
        const d = this.screen.data,
            st = this.game.state,
            VW = BW.VW,
            VH = BW.VH,
            t = d.t || 0;

        ctx.save();
        ctx.fillStyle = '#05060b';
        ctx.fillRect(0, 0, VW, VH);

        const vg = ctx.createRadialGradient(VW / 2, VH * 0.45, VH * 0.2, VW / 2, VH * 0.5, VH);

        vg.addColorStop(0, 'rgba(40,44,70,0.35)');
        vg.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, VW, VH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 40px ${BW.FONT_T}`;
        ctx.fillStyle = '#f2e6cc';
        ctx.fillText('SKILLS', VW / 2, 52);
        // the purse: glints, the yellow stones, are the only currency
        BW.drawGlintShard(ctx, VW / 2 - 56, 92, 1.4, t);
        ctx.textAlign = 'left';
        ctx.font = `600 26px ${BW.FONT_B}`;
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText(String(st.glints | 0) + ' glints', VW / 2 - 36, 93);
        ctx.textAlign = 'center';

        // branch headings
        for (const b of BW.Skills.BRANCHES) {
            ctx.font = `600 24px ${BW.FONT_B}`;
            ctx.fillStyle = b.color;
            ctx.fillText(b.name.toUpperCase(), VW * (0.25 + 0.25 * b.col), 138);
        }

        // links first, then the nodes over them
        for (const n of BW.Skills.NODES) {
            if (!n.req) continue;

            const a = pos(BW.Skills.BY_ID[n.req]),
                b = pos(n);

            ctx.strokeStyle = BW.Skills.has(st, n.id) ? '#e8d8b0' : 'rgba(225,214,192,0.2)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        for (const n of BW.Skills.NODES) {
            const p = pos(n),
                s = BW.Skills.status(st, n.id),
                on = n.id === d.id,
                col = BW.Skills.BRANCHES.find((b) => b.id === n.branch).color;

            ctx.save();
            ctx.translate(p.x, p.y);

            if (on) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 4) + (d.flash || 0) * 0.5;
                ctx.drawImage(BW.glowSprite(col), -70, -70, 140, 140);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
            }

            ctx.beginPath();
            ctx.arc(0, 0, 26, 0, Math.PI * 2);
            ctx.fillStyle = s === 'learned' ? col : s === 'open' ? 'rgba(20,22,32,0.95)' : 'rgba(14,15,22,0.9)';
            ctx.fill();
            ctx.lineWidth = on ? 4 : 2.5;
            ctx.strokeStyle = s === 'learned' ? '#fff6dc' : s === 'open' ? col : 'rgba(225,214,192,0.25)';
            ctx.stroke();

            ctx.font = `600 ${s === 'learned' ? 22 : 15}px ${BW.FONT_B}`;
            ctx.fillStyle =
                s === 'learned'
                    ? '#10121a'
                    : s === 'locked'
                    ? 'rgba(225,214,192,0.3)'
                    : s === 'afford'
                    ? '#ff9a8a'
                    : '#ffe9a8';
            ctx.fillText(s === 'learned' ? '✓' : String(BW.Skills.price(n.id)), 0, 1);
            ctx.restore();

            ctx.font = `500 15px ${BW.FONT_B}`;
            ctx.fillStyle = on ? '#fff1d0' : s === 'locked' ? 'rgba(225,214,192,0.3)' : 'rgba(225,214,192,0.75)';
            ctx.fillText(n.name, p.x, p.y + 40);
        }

        // the node under the cursor
        const n = BW.Skills.BY_ID[d.id],
            s = BW.Skills.status(st, n.id);

        ctx.fillStyle = 'rgba(10,12,18,0.82)';
        BW.roundRect(ctx, VW * 0.16, VH - 150, VW * 0.68, 104, 14);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.font = `600 26px ${BW.FONT_B}`;
        ctx.fillStyle = '#fff1d0';
        ctx.fillText(n.name, VW * 0.16 + 26, VH - 120);
        ctx.font = `italic 500 20px ${BW.FONT_B}`;
        ctx.fillStyle = '#d9cdb0';
        ctx.fillText(n.desc, VW * 0.16 + 26, VH - 86);

        const note =
            s === 'learned'
                ? 'Learned'
                : s === 'locked'
                ? `Needs ${BW.Skills.BY_ID[n.req].name} first`
                : s === 'afford'
                ? `${BW.Skills.price(n.id)} glints: ${BW.Skills.price(n.id) - (st.glints | 0)} more needed`
                : `${BW.Skills.price(n.id)} glints: ${BW.Input.label('confirm')} to learn`;

        ctx.textAlign = 'right';
        ctx.font = `500 19px ${BW.FONT_B}`;
        ctx.fillStyle = s === 'open' ? '#ffe0a0' : 'rgba(225,214,192,0.6)';
        ctx.fillText(note, VW * 0.84 - 26, VH - 120);

        ctx.textAlign = 'center';
        ctx.font = `500 18px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(230,220,200,0.55)';
        ctx.fillText(
            `Arrows  move      ${BW.Input.label('confirm')}  learn      ${BW.Input.label('back')}  close`,
            VW / 2,
            VH - 22,
        );
        ctx.restore();
    };
})(window.BW);

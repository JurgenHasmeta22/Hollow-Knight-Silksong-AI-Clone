'use strict';

// The Skills screen (pause and lantern menus): three cards, one per branch, each a column of icons joined by glowing links.
// Arrows move the cursor, confirm learns the skill under it (paid in glints), back closes.
(function (BW) {
    const M = BW.Menu.prototype;
    const COLS = 3,
        ROWS = 5;

    const nodeAt = (c, r) => BW.Skills.NODES.find((n) => n.at[0] === c && n.at[1] === r);

    const pos = (n) => ({ x: BW.VW * (0.25 + 0.25 * n.at[0]), y: 214 + n.at[1] * 80 });

    const branchOf = (n) => BW.Skills.BRANCHES.find((b) => b.id === n.branch);

    // What a move is pressed with, in the player's own bindings.
    const HOW = {
        dashslash: () => `${BW.Input.label('attack')} during a dash`,
        void: () => `hold ${BW.Input.label('attack')}, release when the aura closes`,
        barrage: () => BW.Input.label('lance'),
        whirl: () => BW.Input.label('skill'),
        ult: () => `${BW.Input.label('transform')} while transformed`,
    };

    // ---------------------------------------------------------------- icons, drawn in a 40 x 40 box around (0, 0)
    const stroke = (ctx, c, w = 3) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    const ICON = {
        edge(ctx, c) {
            stroke(ctx, c, 4);
            ctx.beginPath();
            ctx.moveTo(-11, 12);
            ctx.lineTo(11, -12);
            ctx.stroke();
            stroke(ctx, c, 3);
            ctx.beginPath();
            ctx.moveTo(-14, 8);
            ctx.lineTo(-8, 14);
            ctx.stroke();
        },
        flow(ctx, c) {
            stroke(ctx, c);
            for (const y of [-8, 0, 8]) {
                ctx.beginPath();
                ctx.moveTo(-13, y);
                ctx.quadraticCurveTo(-4, y - 7, 3, y);
                ctx.quadraticCurveTo(8, y + 4, 13, y - 2);
                ctx.stroke();
            }
        },
        dashslash(ctx, c) {
            stroke(ctx, c);

            for (const [y, l] of [
                [-8, 8],
                [0, 14],
                [8, 8],
            ]) {
                ctx.beginPath();
                ctx.moveTo(-14, y);
                ctx.lineTo(-14 + l, y);
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(2, 0, 11, -1.1, 1.1);
            ctx.stroke();
        },
        void(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(0, 0, 14, -1.3, 1.3);
            ctx.arc(-7, 0, 12, 1.3, -1.3, true);
            ctx.closePath();
            ctx.fill();
        },
        barrage(ctx, c) {
            ctx.fillStyle = c;

            for (const [x, y, r] of [
                [-9, -9, 8],
                [-1, 0, 10],
                [-9, 9, 8],
            ]) {
                ctx.beginPath();
                ctx.arc(x, y, r, -1.2, 1.2);
                ctx.arc(x - 4, y, r * 0.85, 1.2, -1.2, true);
                ctx.closePath();
                ctx.fill();
            }
        },
        whirl(ctx, c) {
            stroke(ctx, c);
            ctx.beginPath();

            for (let a = 0; a < 11; a += 0.4) {
                const r = 2 + a * 1.2;

                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }

            ctx.stroke();
        },
        quicken(ctx, c) {
            stroke(ctx, c);
            ctx.beginPath();
            ctx.arc(0, 4, 13, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.lineTo(8, -6);
            ctx.stroke();
        },
        linger(ctx, c) {
            stroke(ctx, c, 2.5);
            ctx.beginPath();
            ctx.moveTo(-9, -13);
            ctx.lineTo(9, -13);
            ctx.lineTo(0, 0);
            ctx.lineTo(9, 13);
            ctx.lineTo(-9, 13);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.stroke();
        },
        burn(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.quadraticCurveTo(14, -2, 8, 10);
            ctx.quadraticCurveTo(0, 17, -8, 10);
            ctx.quadraticCurveTo(-12, 2, -3, -6);
            ctx.quadraticCurveTo(-2, -11, 0, -15);
            ctx.fill();
        },
        giant(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();

            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + (i * Math.PI) / 5,
                    r = i % 2 ? 6 : 15;

                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }

            ctx.closePath();
            ctx.fill();
        },
        gourd1(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(0, 6, 11, 0, Math.PI * 2);
            ctx.arc(0, -8, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-3, -17, 6, 6);
        },
        gourd2(ctx, c) {
            ICON.gourd1(ctx, c);
            stroke(ctx, '#10121a', 3);
            ctx.beginPath();
            ctx.moveTo(-5, 6);
            ctx.lineTo(5, 6);
            ctx.moveTo(0, 1);
            ctx.lineTo(0, 11);
            ctx.stroke();
        },
        guard(ctx, c) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(13, -9);
            ctx.quadraticCurveTo(13, 8, 0, 16);
            ctx.quadraticCurveTo(-13, 8, -13, -9);
            ctx.closePath();
            ctx.fill();
        },
        satchel(ctx, c) {
            ctx.fillStyle = c;
            BW.roundRect(ctx, -13, -6, 26, 20, 5);
            ctx.fill();
            stroke(ctx, c, 3);
            ctx.beginPath();
            ctx.arc(0, -7, 7, Math.PI, 0);
            ctx.stroke();
        },
        iron(ctx, c) {
            ctx.fillStyle = c;
            BW.bellIcon(ctx, 0, 0, 15);
        },
    };

    // ---------------------------------------------------------------- input
    M.skillsUpdate = function (dt, inp) {
        const d = this.screen.data,
            g = this.game,
            st = g.state;

        d.t = (d.t || 0) + dt;

        if (!d.id) d.id = BW.Skills.NODES[0].id;

        const cur = BW.Skills.BY_ID[d.id];

        // the cursor glides to the node it was sent to
        const here = pos(cur);

        d.cx = d.cx == null ? here.x : BW.damp(d.cx, here.x, 18, dt);
        d.cy = d.cy == null ? here.y : BW.damp(d.cy, here.y, 18, dt);

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
                d.learnT = 0;
                d.learnId = cur.id;
                g.hud.toast('Learned ' + cur.name, cur.desc, 3);
                g.hud.glintFlash = 0.3;
            } else {
                d.deny = 0.4;
                BW.Audio.play('ui_back', { vol: 0.6 });
            }
        }

        d.flash = Math.max(0, (d.flash || 0) - dt * 2);
        d.deny = Math.max(0, (d.deny || 0) - dt);

        if (d.learnT != null) d.learnT += dt;

        if ((inp.pressed.back || inp.pressed.pause) && this.t > 0.1) {
            BW.Audio.play('ui_back');
            this.pop();
        }
    };

    // ---------------------------------------------------------------- drawing
    M.skillsDraw = function (ctx) {
        const d = this.screen.data,
            st = this.game.state,
            VW = BW.VW,
            VH = BW.VH,
            t = d.t || 0,
            S = BW.Skills;

        ctx.save();
        ctx.fillStyle = '#05060b';
        ctx.fillRect(0, 0, VW, VH);

        const vg = ctx.createRadialGradient(VW / 2, VH * 0.45, VH * 0.15, VW / 2, VH * 0.5, VH);

        vg.addColorStop(0, 'rgba(46,50,80,0.4)');
        vg.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, VW, VH);

        // drifting motes
        ctx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < 26; i++) {
            const x = ((i * 173.1 + t * (7 + (i % 4) * 3)) % (VW + 40)) - 20,
                y = VH - ((i * 97.3 + t * (10 + (i % 5) * 2)) % (VH + 40)) + 20;

            ctx.fillStyle = `rgba(255,225,170,${0.06 + (i % 3) * 0.04})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';

        // title, the purse, and how much of the tree is learned
        const learned = S.NODES.filter((n) => S.has(st, n.id)).length;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = `600 36px ${BW.FONT_T}`;
        ctx.fillStyle = '#f2e6cc';
        ctx.fillText('SKILLS', 64, 52);
        ctx.font = `500 18px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(225,214,192,0.6)';
        ctx.fillText(`${learned} of ${S.NODES.length} learned`, 66, 86);

        ctx.textAlign = 'right';
        ctx.font = `600 28px ${BW.FONT_B}`;
        ctx.fillStyle = d.deny > 0 ? '#ff9a8a' : '#ffe9a8';
        ctx.fillText(String(st.glints | 0), VW - 64, 56);
        BW.drawGlintShard(ctx, VW - 64 - ctx.measureText(String(st.glints | 0)).width - 24, 56, 1.5, t);
        ctx.font = `500 16px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(225,214,192,0.5)';
        ctx.fillText('glints', VW - 64, 84);

        // a card per branch
        for (const b of S.BRANCHES) {
            const cx = VW * (0.25 + 0.25 * b.col),
                got = S.NODES.filter((n) => n.branch === b.id && S.has(st, n.id)).length,
                all = S.NODES.filter((n) => n.branch === b.id).length;

            ctx.fillStyle = 'rgba(12,14,22,0.72)';
            BW.roundRect(ctx, cx - 150, 118, 300, 404, 18);
            ctx.fill();
            ctx.strokeStyle = 'rgba(225,214,192,0.12)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const hg = ctx.createLinearGradient(cx - 150, 0, cx + 150, 0);

            hg.addColorStop(0, 'rgba(0,0,0,0)');
            hg.addColorStop(0.5, b.color);
            hg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = hg;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(cx - 150, 150, 300, 2);
            ctx.globalAlpha = 1;

            ctx.textAlign = 'center';
            ctx.font = `600 22px ${BW.FONT_B}`;
            ctx.fillStyle = b.color;

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';

            ctx.fillText(b.name.toUpperCase(), cx, 136);

            if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

            ctx.font = `500 13px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.45)';
            ctx.fillText(`${got} / ${all}`, cx + 112, 136);
        }

        // links: dim until both ends are learned, then they glow and a spark runs along them
        for (const n of S.NODES) {
            if (!n.req) continue;

            const a = pos(S.BY_ID[n.req]),
                b = pos(n),
                on = S.has(st, n.id),
                col = branchOf(n).color;

            ctx.strokeStyle = on ? col : 'rgba(225,214,192,0.16)';
            ctx.lineWidth = on ? 4 : 3;
            ctx.lineCap = 'round';
            ctx.globalAlpha = on ? 0.85 : 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.globalAlpha = 1;

            if (on) {
                const k = (t * 0.6 + n.at[1] * 0.3) % 1;

                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        }

        // the nodes
        for (const n of S.NODES) {
            const p = pos(n),
                s = S.status(st, n.id),
                on = n.id === d.id,
                col = branchOf(n).color,
                pop =
                    d.learnId === n.id && d.learnT != null && d.learnT < 0.6
                        ? 1 + 0.35 * Math.sin((d.learnT / 0.6) * Math.PI)
                        : 1;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(pop, pop);

            if (s === 'learned') {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 2 + n.at[1]);
                ctx.drawImage(BW.glowSprite(col), -52, -52, 104, 104);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
            }

            ctx.beginPath();
            ctx.arc(0, 0, 28, 0, Math.PI * 2);
            ctx.fillStyle =
                s === 'learned' ? 'rgba(30,26,20,0.98)' : s === 'locked' ? 'rgba(12,13,19,0.9)' : 'rgba(20,22,32,0.96)';
            ctx.fill();
            ctx.lineWidth = s === 'learned' ? 3.5 : 2.5;
            ctx.strokeStyle =
                s === 'learned'
                    ? col
                    : s === 'open'
                    ? col
                    : s === 'afford'
                    ? 'rgba(255,154,138,0.7)'
                    : 'rgba(225,214,192,0.2)';
            ctx.stroke();

            ctx.save();
            ctx.globalAlpha = s === 'locked' ? 0.28 : s === 'afford' ? 0.75 : 1;
            ICON[n.id](ctx, s === 'learned' ? col : s === 'afford' ? '#d8b4a8' : '#efe3c8');
            ctx.restore();

            // learned: a small tick; locked: a small lock
            if (s === 'learned') {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(20, -20, 8, 0, Math.PI * 2);
                ctx.fill();
                stroke(ctx, '#10121a', 2.5);
                ctx.beginPath();
                ctx.moveTo(16.5, -20);
                ctx.lineTo(19.5, -17);
                ctx.lineTo(24, -23);
                ctx.stroke();
            } else if (s === 'locked') {
                ctx.fillStyle = 'rgba(225,214,192,0.5)';
                BW.roundRect(ctx, 14, -26, 12, 9, 2);
                ctx.fill();
                stroke(ctx, 'rgba(225,214,192,0.5)', 2);
                ctx.beginPath();
                ctx.arc(20, -26, 4, Math.PI, 0);
                ctx.stroke();
            }

            ctx.restore();

            ctx.textAlign = 'center';
            ctx.font = `500 14px ${BW.FONT_B}`;
            ctx.fillStyle = on ? '#fff1d0' : s === 'locked' ? 'rgba(225,214,192,0.3)' : 'rgba(225,214,192,0.8)';
            ctx.fillText(n.name, p.x, p.y + 42);

            if (s !== 'learned') {
                ctx.font = `600 13px ${BW.FONT_B}`;
                ctx.fillStyle = s === 'locked' ? 'rgba(225,214,192,0.25)' : s === 'afford' ? '#ff9a8a' : '#ffe9a8';
                ctx.fillText(String(S.price(n.id)), p.x + 6, p.y + 59);
                BW.drawGlintShard(ctx, p.x - 12 + 0, p.y + 59, 0.7, t);
            }
        }

        // the cursor: a ring that glides between nodes
        const cur = S.BY_ID[d.id],
            pcur = pos(cur),
            cx = d.cx == null ? pcur.x : d.cx,
            cy = d.cy == null ? pcur.y : d.cy,
            ccol = branchOf(cur).color;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = ccol;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 6);
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.arc(0, 0, 36 + (d.deny > 0 ? Math.sin(d.deny * 70) * 3 : 0), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (d.flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = d.flash * 0.6;
            ctx.drawImage(BW.glowSprite(ccol), pcur.x - 110, pcur.y - 110, 220, 220);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }

        // the detail panel
        const s = S.status(st, cur.id),
            px = VW * 0.1,
            pw = VW * 0.8,
            py = VH - 168,
            ph = 128;

        ctx.fillStyle = 'rgba(10,12,18,0.9)';
        BW.roundRect(ctx, px, py, pw, ph, 16);
        ctx.fill();
        ctx.strokeStyle = ccol;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // icon medallion
        ctx.save();
        ctx.translate(px + 62, py + ph / 2);
        ctx.scale(1.5, 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,22,32,0.98)';
        ctx.fill();
        ctx.strokeStyle = ccol;
        ctx.lineWidth = 2;
        ctx.stroke();
        ICON[cur.id](ctx, s === 'learned' || s === 'open' ? ccol : '#cdbf9c');
        ctx.restore();

        const tx = px + 130;

        ctx.textAlign = 'left';
        ctx.font = `500 14px ${BW.FONT_B}`;
        ctx.fillStyle = ccol;

        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';

        ctx.fillText(`${branchOf(cur).name.toUpperCase()}  ·  ${cur.unlock ? 'A MOVE' : 'A PASSIVE'}`, tx, py + 24);

        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

        ctx.font = `600 28px ${BW.FONT_B}`;
        ctx.fillStyle = '#fff1d0';
        ctx.fillText(cur.name, tx, py + 54);
        ctx.font = `italic 500 19px ${BW.FONT_B}`;
        ctx.fillStyle = '#d9cdb0';
        BW.wrapText(ctx, cur.desc, tx + 0, py + 84, pw - 130 - 270, 24, 'left');

        if (cur.unlock && HOW[cur.unlock]) {
            ctx.font = `500 15px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.6)';
            ctx.fillText(`Used with: ${HOW[cur.unlock]()}`, tx, py + ph - 14);
        }

        // price and state, on the right
        const rx = px + pw - 28;

        ctx.textAlign = 'right';

        if (s === 'learned') {
            ctx.font = `600 22px ${BW.FONT_B}`;
            ctx.fillStyle = ccol;
            ctx.fillText('Learned', rx, py + 40);
        } else if (s === 'locked') {
            ctx.font = `600 18px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.55)';
            ctx.fillText(`Needs ${S.BY_ID[cur.req].name}`, rx, py + 40);
        } else {
            const price = S.price(cur.id),
                short = price - (st.glints | 0);

            ctx.font = `600 30px ${BW.FONT_B}`;
            ctx.fillStyle = s === 'open' ? '#ffe9a8' : '#ff9a8a';
            ctx.fillText(String(price), rx, py + 40);
            BW.drawGlintShard(ctx, rx - ctx.measureText(String(price)).width - 22, py + 40, 1.4, t);
            ctx.font = `500 17px ${BW.FONT_B}`;
            ctx.fillStyle = s === 'open' ? '#ffe0a0' : '#ff9a8a';
            ctx.fillText(s === 'open' ? `${BW.Input.label('confirm')}  to learn` : `${short} more needed`, rx, py + 76);
        }

        ctx.textAlign = 'center';
        ctx.font = `500 17px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(230,220,200,0.5)';
        ctx.fillText(
            `Arrows  move      ${BW.Input.label('confirm')}  learn      ${BW.Input.label('back')}  close`,
            VW / 2,
            VH - 20,
        );
        ctx.restore();
    };
})(window.BW);

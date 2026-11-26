'use strict';

// Odo's shop: a full screen of wares, paid for in glints. Up and down choose, confirm buys, back leaves.
// The wares: the four quick items (up to what the satchel holds) and, once, a Lifethread (one more bell of health).
(function (BW) {
    const M = BW.Menu.prototype;

    const LIFETHREAD_PRICE = 180;

    function wares(st) {
        const I = BW.Items;

        const list = I.ORDER.map((id) => ({
            id,
            kind: 'item',
            name: I.DEFS[id].name,
            desc: I.DEFS[id].desc,
            price: I.DEFS[id].price,
            have: I.count(st, id),
            cap: I.cap(st, id),
        }));

        if (!st.flags.odo_sold)
            list.push({
                id: 'lifethread',
                kind: 'lifethread',
                name: 'Lifethread',
                desc: 'A thread of life found in the dark, still warm. It adds one bell to your health, for good.',
                price: LIFETHREAD_PRICE,
                have: 0,
                cap: 1,
            });

        return list;
    }

    M.shopWares = wares;

    M.shopUpdate = function (dt, inp) {
        const d = this.screen.data,
            g = this.game,
            st = g.state;

        d.t = (d.t || 0) + dt;
        d.msg = Math.max(0, (d.msg || 0) - dt);

        const list = wares(st),
            n = list.length;

        d.sel = BW.clamp(d.sel | 0, 0, n - 1);

        if (inp.pressed.up) {
            d.sel = (d.sel + n - 1) % n;
            BW.Audio.play('ui_move');
        } else if (inp.pressed.down) {
            d.sel = (d.sel + 1) % n;
            BW.Audio.play('ui_move');
        }

        if (inp.pressed.confirm && this.t > 0.1) {
            const w = list[d.sel];

            if (w.have >= w.cap) {
                d.text = w.kind === 'item' ? 'Your satchel cannot hold any more of those.' : 'Already yours.';
                d.msg = 1.6;
                d.bad = true;
                BW.Audio.play('ui_back', { vol: 0.6 });
            } else if (st.glints < w.price) {
                d.text = `${w.price - st.glints} more glints needed.`;
                d.msg = 1.6;
                d.bad = true;
                d.shake = 0.4;
                BW.Audio.play('ui_back', { vol: 0.6 });
            } else {
                st.glints -= w.price;
                g.hud.glintFlash = 0.3;
                BW.Audio.play('pickup', { vol: 0.8 });
                d.bad = false;
                d.flash = 1;

                if (w.kind === 'lifethread') {
                    st.flags.odo_sold = true;
                    this.closeAll();
                    g.collectUpgrade('lifethread', g.player.cx, g.player.cy - 40);

                    return;
                }

                BW.Items.add(st, w.id, 1);
                d.text = `${w.name} added to the satchel.`;
                d.msg = 1.6;
                g.saveGame();
            }
        }

        d.flash = Math.max(0, (d.flash || 0) - dt * 2.5);
        d.shake = Math.max(0, (d.shake || 0) - dt);

        if ((inp.pressed.back || inp.pressed.pause) && this.t > 0.1) {
            BW.Audio.play('ui_back');
            g.saveGame();
            this.pop();
        }
    };

    M.shopDraw = function (ctx) {
        const d = this.screen.data,
            st = this.game.state,
            VW = BW.VW,
            VH = BW.VH,
            t = d.t || 0,
            list = wares(st),
            sel = BW.clamp(d.sel | 0, 0, list.length - 1),
            cur = list[sel];

        ctx.save();
        ctx.fillStyle = '#06070c';
        ctx.fillRect(0, 0, VW, VH);

        const vg = ctx.createRadialGradient(VW * 0.7, VH * 0.4, 60, VW * 0.7, VH * 0.5, VH);

        vg.addColorStop(0, 'rgba(70,52,28,0.4)');
        vg.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, VW, VH);

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = `600 38px ${BW.FONT_T}`;
        ctx.fillStyle = '#f2e6cc';
        ctx.fillText("ODO'S SATCHEL", 80, 64);
        ctx.font = `italic 500 20px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(225,214,192,0.6)';
        ctx.fillText('Supplies for whoever still walks the dark.', 82, 100);

        // the purse
        ctx.textAlign = 'right';
        BW.drawGlintShard(ctx, VW - 80 - ctx.measureText(String(st.glints)).width - 60, 64, 1.5, t);
        ctx.font = `600 30px ${BW.FONT_B}`;
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText(String(st.glints | 0), VW - 80, 64);
        ctx.textAlign = 'left';

        // the wares
        const rx = 80,
            ry = 160,
            rw = 520,
            rh = 76;

        list.forEach((w, i) => {
            const y = ry + i * (rh + 10),
                on = i === sel,
                afford = st.glints >= w.price,
                full = w.have >= w.cap;

            ctx.fillStyle = on ? 'rgba(60,46,26,0.92)' : 'rgba(14,15,22,0.8)';
            BW.roundRect(ctx, rx, y, rw, rh, 10);
            ctx.fill();
            ctx.strokeStyle = on ? '#e8c98a' : 'rgba(225,214,192,0.18)';
            ctx.lineWidth = on ? 2.5 : 1.5;
            ctx.stroke();

            ctx.save();
            ctx.translate(rx + 44, y + rh / 2);
            ctx.globalAlpha = full ? 0.4 : 1;

            if (w.kind === 'item') BW.ItemIcons[w.id](ctx, on ? '#fff1d0' : '#cdbf9c');
            else {
                ctx.fillStyle = on ? '#fff1d0' : '#cdbf9c';
                BW.bellIcon(ctx, 0, 0, 14);
            }

            ctx.restore();

            ctx.font = `600 24px ${BW.FONT_B}`;
            ctx.fillStyle = on ? '#fff1d0' : 'rgba(235,224,200,0.8)';
            ctx.fillText(w.name, rx + 90, y + 28);
            ctx.font = `500 17px ${BW.FONT_B}`;
            ctx.fillStyle = 'rgba(225,214,192,0.55)';
            ctx.fillText(w.kind === 'item' ? `Carrying ${w.have} / ${w.cap}` : 'One only', rx + 90, y + 54);

            ctx.textAlign = 'right';
            BW.drawGlintShard(ctx, rx + rw - 28 - ctx.measureText(String(w.price)).width - 14, y + rh / 2, 1.1, t);
            ctx.font = `600 24px ${BW.FONT_B}`;
            ctx.fillStyle = full ? 'rgba(225,214,192,0.35)' : afford ? '#ffe9a8' : '#ff9a8a';
            ctx.fillText(String(w.price), rx + rw - 24, y + rh / 2 + 1);
            ctx.textAlign = 'left';
        });

        // the detail panel
        const px = 660,
            py = 160,
            pw = VW - px - 80,
            ph = 440;

        ctx.fillStyle = 'rgba(10,12,18,0.82)';
        BW.roundRect(ctx, px, py, pw, ph, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(236,222,190,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        ctx.translate(px + pw / 2, py + 110);
        ctx.scale(3.2, 3.2);

        if (cur.kind === 'item') BW.ItemIcons[cur.id](ctx, '#fff1d0');
        else {
            ctx.fillStyle = '#fff1d0';
            BW.bellIcon(ctx, 0, 0, 14);
        }

        ctx.restore();

        if (d.flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = d.flash * 0.6;
            ctx.drawImage(BW.glowSprite('#ffe0a0'), px + pw / 2 - 150, py - 40, 300, 300);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }

        ctx.textAlign = 'center';
        ctx.font = `600 30px ${BW.FONT_B}`;
        ctx.fillStyle = '#fff1d0';
        ctx.fillText(cur.name, px + pw / 2, py + 230);
        ctx.font = `italic 500 20px ${BW.FONT_B}`;
        ctx.fillStyle = '#d9cdb0';
        BW.wrapText(ctx, cur.desc, px + pw / 2, py + 276, pw - 70, 28);

        const full = cur.have >= cur.cap,
            afford = st.glints >= cur.price;

        ctx.font = `600 22px ${BW.FONT_B}`;
        ctx.fillStyle = full ? 'rgba(225,214,192,0.5)' : afford ? '#ffe9a8' : '#ff9a8a';
        ctx.fillText(
            full
                ? 'Nothing more to buy'
                : afford
                ? `${BW.Input.label('confirm')}  buy for ${cur.price}`
                : `${cur.price} glints`,
            px + pw / 2,
            py + ph - 44,
        );

        if (d.msg > 0) {
            ctx.globalAlpha = Math.min(1, d.msg * 2);
            ctx.font = `500 19px ${BW.FONT_B}`;
            ctx.fillStyle = d.bad ? '#ff9a8a' : '#bff5c8';
            ctx.fillText(d.text || '', px + pw / 2, py + ph - 16);
            ctx.globalAlpha = 1;
        }

        ctx.textAlign = 'center';
        ctx.font = `500 18px ${BW.FONT_B}`;
        ctx.fillStyle = 'rgba(230,220,200,0.55)';
        ctx.fillText(
            `Up / Down  choose      ${BW.Input.label('confirm')}  buy      ${BW.Input.label('back')}  leave`,
            VW / 2,
            VH - 24,
        );
        ctx.restore();
    };
})(window.BW);

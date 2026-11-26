'use strict';

// HUD (health bells, silk spool, glints), prompts, toasts, area titles, dialog box and announcements.
(function (BW) {
    const FONT_T = "'Cinzel', 'Times New Roman', serif";
    const FONT_B = "'Cormorant Garamond', Georgia, serif";

    BW.FONT_T = FONT_T;
    BW.FONT_B = FONT_B;

    class Hud {
        constructor(game) {
            this.game = game;
            this.toasts = [];
            this.title = null;
            this.announce = null;
            this.pulses = { hp: 0, silk: 0, shade: 0 };
            this.denies = { hp: 0, silk: 0, shade: 0 };
            this.hurtPulse = 0;
            this.shownHp = 5;
            this.crack = [];
            this.glintShown = 0;
            this.glintFlash = 0;
            this.glintPop = null;
            this.ghostHp = 5;
            this.ghostPosture = 100;
            this.saveIcon = 0;
        }
        glintGain(n) {
            if (this.glintPop && this.glintPop.t < 1.2) {
                this.glintPop.n += n;
                this.glintPop.t = 0;
            } else this.glintPop = { n, t: 0 };

            this.glintFlash = 0.3;
        }
        pulse(k, hurt) {
            this.pulses[k] = 1;

            if (hurt) this.hurtPulse = 1;
        }
        deny(k) {
            this.denies[k] = 0.5;
        }
        toast(text, sub, time = 2.6) {
            this.toasts.push({ text, sub, t: 0, life: time });

            if (this.toasts.length > 3) this.toasts.shift();
        }
        areaTitle(name, sub) {
            this.title = { name, sub, t: 0, life: 4.2 };
        }
        showAnnounce(o) {
            this.announce = Object.assign({ t: 0 }, o);
        }
        savedBlip() {
            this.saveIcon = 1.6;
        }

        update(dt) {
            for (const k in this.pulses) this.pulses[k] = Math.max(0, this.pulses[k] - dt * 2.5);
            for (const k in this.denies) this.denies[k] = Math.max(0, this.denies[k] - dt);

            this.hurtPulse = Math.max(0, this.hurtPulse - dt * 1.5);

            for (const t of this.toasts) t.t += dt;

            BW.prune(this.toasts, (t) => t.t < t.life);

            if (this.title) {
                this.title.t += dt;

                if (this.title.t > this.title.life) this.title = null;
            }

            if (this.announce) this.announce.t += dt;

            const st = this.game.state;

            if (st) {
                if (this.glintShown < st.glints) {
                    this.glintShown = Math.min(
                        st.glints,
                        this.glintShown + Math.max(1, (st.glints - this.glintShown) * dt * 6),
                    );

                    this.glintFlash = 0.3;
                } else this.glintShown = st.glints;

                this.glintFlash = Math.max(0, this.glintFlash - dt);

                if (this.glintPop) {
                    this.glintPop.t += dt;

                    if (this.glintPop.t > 1.8) this.glintPop = null;
                }

                // the pale trail behind the health bar: it follows the fill down slowly, and up at once
                if (this.ghostHp > st.hp) this.ghostHp = Math.max(st.hp, this.ghostHp - dt * 2.2);
                else this.ghostHp = st.hp;

                // and the same behind the posture bar
                const pl = this.game.player,
                    pm = pl && pl.postureMax ? pl.postureMax() : 100,
                    pv = pl && pl.posture != null ? pl.posture : pm;

                if (this.ghostPosture > pv) this.ghostPosture = Math.max(pv, this.ghostPosture - dt * 40);
                else this.ghostPosture = pv;

                if (Math.ceil(st.hp) < Math.ceil(this.shownHp)) {
                    for (let i = Math.ceil(st.hp); i < Math.ceil(this.shownHp); i++) this.crack.push({ i, t: 0 });
                }

                this.shownHp = st.hp;
            }

            for (const c of this.crack) c.t += dt;

            BW.prune(this.crack, (c) => c.t < 0.6);
            this.saveIcon = Math.max(0, this.saveIcon - dt);
        }

        draw(ctx) {
            const st = this.game.state;

            if (!st) return;

            const alpha = this.game.hudAlpha;

            if (alpha <= 0) return;

            ctx.save();
            ctx.globalAlpha = alpha;

            // ---- health: a red bar, with a pale trail where it just fell ----
            const hx = 52,
                hy = 34,
                hh = 20,
                hw = 70 + st.maxHp * 26;

            const hshake = this.denies.hp > 0 ? Math.sin(this.denies.hp * 60) * 3 : 0,
                hr = BW.clamp(st.hp / st.maxHp, 0, 1),
                tr = BW.clamp(this.ghostHp / st.maxHp, 0, 1),
                low = st.hp > 0 && st.hp <= 1;

            ctx.save();
            ctx.translate(hshake, 0);
            ctx.fillStyle = 'rgba(6,7,10,0.82)';
            BW.roundRect(ctx, hx - 4, hy - 4, hw + 8, hh + 8, 6);
            ctx.fill();
            ctx.fillStyle = '#ecd6cc';
            ctx.fillRect(hx, hy, hw * tr, hh);

            const hg = ctx.createLinearGradient(0, hy, 0, hy + hh);

            hg.addColorStop(0, low ? '#ff7a6a' : '#f2504a');
            hg.addColorStop(0.5, '#c4202a');
            hg.addColorStop(1, '#7a0e18');
            ctx.fillStyle = hg;
            ctx.fillRect(hx, hy, hw * hr, hh);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(hx, hy, hw * hr, hh * 0.33);
            ctx.fillStyle = 'rgba(0,0,0,0.4)';

            for (let i = 1; i < st.maxHp; i++) ctx.fillRect(hx + (hw * i) / st.maxHp - 1, hy, 2, hh);

            if (this.pulses.hp > 0) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = alpha * this.pulses.hp * 0.5;
                ctx.fillStyle = '#ffd0c0';
                ctx.fillRect(hx, hy, hw * hr, hh);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = alpha;
            }

            ctx.strokeStyle = low ? `rgba(255,120,110,${0.6 + 0.3 * Math.sin(this.game.time * 7)})` : 'rgba(236,222,190,0.55)';
            ctx.lineWidth = 1.5;
            BW.roundRect(ctx, hx - 4, hy - 4, hw + 8, hh + 8, 6);
            ctx.stroke();

            // ---- posture: the guard. It drains when a blow is blocked, and breaks when it is empty ----
            const pl = this.game.player,
                pm = pl.postureMax ? pl.postureMax() : 100,
                pr = BW.clamp((pl.posture == null ? pm : pl.posture) / pm, 0, 1),
                broken = pl.breakT > 0,
                py = hy + hh + 9,
                ph = 9,
                pw = hw * 0.8;

            const quiet = pr >= 0.999 && !broken && !(pl.blocking || this.denies.posture > 0);

            ctx.globalAlpha = alpha * (quiet ? 0.4 : 1);
            ctx.fillStyle = 'rgba(6,7,10,0.8)';
            BW.roundRect(ctx, hx - 3, py - 3, pw + 6, ph + 6, 4);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,140,110,0.55)';
            ctx.fillRect(hx, py, pw * BW.clamp(this.ghostPosture / pm, 0, 1), ph);
            ctx.fillStyle = broken
                ? `rgba(255,70,60,${0.55 + 0.45 * Math.sin(this.game.time * 22)})`
                : pr < 0.25
                ? '#f08a4a'
                : '#efe3c0';
            ctx.fillRect(hx, py, pw * pr, ph);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(hx, py, pw * pr, ph * 0.35);
            ctx.strokeStyle = 'rgba(236,222,190,0.4)';
            ctx.lineWidth = 1;
            BW.roundRect(ctx, hx - 3, py - 3, pw + 6, ph + 6, 4);
            ctx.stroke();

            if (broken) {
                ctx.globalAlpha = alpha;
                ctx.font = `600 13px ${FONT_B}`;
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillStyle = '#ff9a8a';
                ctx.fillText('GUARD BROKEN', hx + pw + 12, py + ph / 2);
            }

            ctx.restore();
            ctx.globalAlpha = alpha;

            // ---- silk: small diamonds in threes, under the bars ----
            const sy = py + ph + 30;

            for (let i = 0; i < st.silkMax; i++) {
                const x = hx + 5 + i * 13 + Math.floor(i / 3) * 7,
                    on = i < Math.floor(st.silk);

                ctx.save();
                ctx.translate(x, sy);
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = on ? '#fff0cc' : 'rgba(255,255,255,0.12)';
                ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
                ctx.strokeStyle = on ? 'rgba(255,225,160,0.9)' : 'rgba(225,214,192,0.25)';
                ctx.lineWidth = 1;
                ctx.strokeRect(-3.4, -3.4, 6.8, 6.8);
                ctx.restore();
            }

            if (this.denies.silk > 0) {
                ctx.strokeStyle = `rgba(255,90,74,${this.denies.silk * 1.6})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(hx - 4, sy - 9, st.silkMax * 13 + Math.floor(st.silkMax / 3) * 7 + 2, 18);
            }

            // ---- glints: the yellow stones, the one currency, at the top right ----
            const gx = BW.VW - 52,
                gy = 50,
                num = String(Math.floor(this.glintShown));

            ctx.font = `600 30px ${FONT_B}`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'right';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.strokeText(num, gx, gy);
            ctx.fillStyle = this.glintFlash > 0 ? '#ffffff' : '#ffe9a8';
            ctx.fillText(num, gx, gy);
            BW.drawGlintShard(ctx, gx - ctx.measureText(num).width - 22, gy, 1.7, this.game.time);

            if (this.glintPop) {
                ctx.font = `600 18px ${FONT_B}`;
                ctx.globalAlpha = alpha * Math.min(1, (1.8 - this.glintPop.t) * 2);
                ctx.fillStyle = '#ffd86a';
                ctx.fillText(`+${this.glintPop.n}`, gx, gy + 28 - this.glintPop.t * 8);
                ctx.globalAlpha = alpha;
            }

            // hurt vignette
            if (this.hurtPulse > 0 || (st.hp > 0 && st.hp <= 1)) {
                const k = Math.max(
                    this.hurtPulse * 0.6,
                    st.hp > 0 && st.hp <= 1 ? 0.18 + Math.sin(this.game.time * 4) * 0.08 : 0,
                );

                const g = ctx.createRadialGradient(
                    BW.VW / 2,
                    BW.VH / 2,
                    BW.VH * 0.4,
                    BW.VW / 2,
                    BW.VH / 2,
                    BW.VH * 0.95,
                );

                g.addColorStop(0, 'rgba(120,0,0,0)');
                g.addColorStop(1, `rgba(120,10,10,${k})`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, BW.VW, BW.VH);
            }

            // the Ronin's Shade gauge
            if (this.game.player && this.game.player.drawGauge) this.game.player.drawGauge(ctx, hx + 6, py + ph + 6, alpha);

            // red alert: a boss is winding up a blow that cannot be parried, so the screen's edges flood red
            let alert = 0;

            for (const e of this.game.enemies || []) if (e.alert > alert) alert = e.alert;

            if (alert > 0.03) {
                const k = Math.min(1, alert) * (0.75 + 0.25 * Math.sin(this.game.time * 22));

                const g = ctx.createRadialGradient(
                    BW.VW / 2,
                    BW.VH / 2,
                    BW.VH * 0.3,
                    BW.VW / 2,
                    BW.VH / 2,
                    BW.VH * 0.85,
                );

                g.addColorStop(0, 'rgba(255,20,10,0)');
                g.addColorStop(1, `rgba(255,24,12,${0.6 * k})`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, BW.VW, BW.VH);
            }

            // save blip
            if (this.saveIcon > 0) {
                const a = Math.min(1, this.saveIcon * 2);

                ctx.globalAlpha = alpha * a;
                ctx.save();
                ctx.translate(BW.VW - 46, BW.VH - 44);
                ctx.rotate(this.game.time * 4);
                ctx.strokeStyle = '#ffe2b0';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 1.4);
                ctx.stroke();
                ctx.restore();
                ctx.font = `500 18px ${FONT_B}`;
                ctx.textAlign = 'right';
                ctx.fillStyle = '#efe6d2';
                ctx.fillText('Saved', BW.VW - 68, BW.VH - 43);
                ctx.globalAlpha = alpha;
            }

            ctx.restore();

            this.drawToasts(ctx);
            this.drawTitle(ctx);
        }

        drawToasts(ctx) {
            let y = BW.VH - 120;

            for (const t of this.toasts) {
                const a = Math.min(1, t.t * 4, (t.life - t.t) * 2);

                ctx.save();
                ctx.globalAlpha = a;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `600 26px ${FONT_B}`;

                const w = ctx.measureText(t.text).width + 60;

                ctx.fillStyle = 'rgba(6,8,12,0.66)';
                roundRect(ctx, BW.VW / 2 - w / 2, y - 22, w, t.sub ? 64 : 44, 10);
                ctx.fill();
                ctx.fillStyle = '#f4ead4';
                ctx.fillText(t.text, BW.VW / 2, y);

                if (t.sub) {
                    ctx.font = `italic 500 20px ${FONT_B}`;
                    ctx.fillStyle = '#cfc4ad';
                    ctx.fillText(t.sub, BW.VW / 2, y + 24);
                }

                ctx.restore();
                y -= 76;
            }
        }

        drawTitle(ctx) {
            const t = this.title;

            if (!t) return;

            const a = Math.min(1, t.t / 0.8, (t.life - t.t) / 1.0);

            ctx.save();
            ctx.globalAlpha = Math.max(0, a);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const y = BW.VH * 0.3;

            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 18;
            ctx.font = `400 22px ${FONT_T}`;
            ctx.fillStyle = '#d8ccb4';

            if (t.sub) ctx.fillText(t.sub, BW.VW / 2, y - 46);

            ctx.font = `600 58px ${FONT_T}`;
            ctx.fillStyle = '#f6eedd';
            ctx.fillText(t.name.toUpperCase(), BW.VW / 2, y);
            ctx.shadowBlur = 0;

            const w = 220 + Math.min(1, t.t / 1.2) * 120;

            ctx.strokeStyle = 'rgba(240,226,196,0.75)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(BW.VW / 2 - w, y + 42);
            ctx.lineTo(BW.VW / 2 - 14, y + 42);
            ctx.moveTo(BW.VW / 2 + 14, y + 42);
            ctx.lineTo(BW.VW / 2 + w, y + 42);
            ctx.stroke();
            ctx.fillStyle = '#f0e2c4';
            ctx.save();
            ctx.translate(BW.VW / 2, y + 42);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-5, -5, 10, 10);
            ctx.restore();
            ctx.restore();
        }

        // Item / ability announcement (blocks gameplay while shown)
        drawAnnounce(ctx) {
            const an = this.announce;

            if (!an) return;

            const a = Math.min(1, an.t / 0.5) * (an.closing ? Math.max(0, 1 - an.closeT / 0.4) : 1);

            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(2,3,6,0.72)';
            ctx.fillRect(0, 0, BW.VW, BW.VH);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const cy = BW.VH * 0.44;

            if (an.icon) an.icon(ctx, BW.VW / 2, cy - 120, an.t);

            ctx.font = `400 22px ${FONT_T}`;
            ctx.fillStyle = '#cbbd9f';
            ctx.fillText(an.kicker || '', BW.VW / 2, cy - 40);
            ctx.font = `600 54px ${FONT_T}`;
            ctx.fillStyle = '#fff3dc';
            ctx.shadowColor = 'rgba(255,200,120,0.6)';
            ctx.shadowBlur = 24;
            ctx.fillText(an.title, BW.VW / 2, cy + 12);
            ctx.shadowBlur = 0;
            ctx.font = `500 26px ${FONT_B}`;
            ctx.fillStyle = '#e9dfca';
            (an.lines || []).forEach((l, i) => ctx.fillText(l, BW.VW / 2, cy + 74 + i * 34));

            if (an.t > 1.2) {
                ctx.font = `500 20px ${FONT_B}`;
                ctx.fillStyle = `rgba(230,220,200,${0.5 + Math.sin(an.t * 3) * 0.3})`;
                ctx.fillText(`Press ${BW.Input.label('confirm')} to continue`, BW.VW / 2, BW.VH - 70);
            }

            ctx.restore();
        }

        // World-space control prompt (called during the world pass). key is plain text, or { act } to draw the
        // active device's keycap / controller glyphs for that action.
        worldPrompt(ctx, x, y, key, text, a) {
            ctx.save();
            ctx.globalAlpha *= a;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const G = BW.Glyphs,
                act = key && key.act,
                KH = 24;

            ctx.font = `600 19px ${FONT_B}`;

            const tw = ctx.measureText(text || '').width;

            ctx.font = `700 15px ${FONT_T}`;

            const kw = !key ? 0 : act ? G.actionWidth(ctx, act, KH) : ctx.measureText(key).width + 18;
            const w = tw + kw + (key && text ? 12 : 0) + 22;

            ctx.fillStyle = 'rgba(6,8,12,0.72)';
            roundRect(ctx, x - w / 2, y - 17, w, 34, 9);
            ctx.fill();
            ctx.strokeStyle = 'rgba(240,226,196,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();

            let cx = x - w / 2 + 11;

            if (key) {
                if (act) G.drawAction(ctx, act, cx, y, KH);
                else {
                    ctx.fillStyle = '#efe2c6';
                    roundRect(ctx, cx, y - 11, kw, 22, 5);
                    ctx.fill();
                    ctx.fillStyle = '#1b1712';
                    ctx.font = `700 15px ${FONT_T}`;
                    ctx.fillText(key, cx + kw / 2, y + 1);
                }

                cx += kw + 12;
            }

            if (text) {
                ctx.textAlign = 'left';
                ctx.font = `600 19px ${FONT_B}`;
                ctx.fillStyle = '#f2e8d4';
                ctx.fillText(text, cx, y + 1);
            }

            ctx.restore();
        }
    }

    // ---------------------------------------------------------------- Dialog box
    class Dialog {
        constructor(game) {
            this.game = game;
            this.active = false;
            this.pages = [];
            this.page = 0;
            this.chars = 0;
            this.title = '';
            this.speaker = null;
            this.onClose = null;
            this.choices = null;
            this.choice = 0;
        }
        open(title, pages, o = {}) {
            this.active = true;
            this.title = title;
            this.pages = pages.slice();
            this.page = 0;
            this.chars = 0;
            this.speaker = o.speaker || null;
            this.onClose = o.onClose || null;
            this.kind = o.kind || 'talk';
            this.choices = o.choices || null;
            this.choice = 0;
            this.t = 0;
            BW.Audio.play('ui_ok', { vol: 0.5 });
        }
        update(dt, inp) {
            if (!this.active) return;

            this.t += dt;

            const txt = this.pages[this.page] || '';
            const prev = Math.floor(this.chars);

            this.chars = Math.min(txt.length, this.chars + dt * 55);

            if (this.speaker && Math.floor(this.chars) > prev && Math.floor(this.chars) % 3 === 0)
                BW.Audio.play('text', { vol: 0.6, minGap: 0.02 });

            const last = this.page === this.pages.length - 1;

            if (last && this.choices && this.chars >= txt.length) {
                if (inp.pressed.up || inp.pressed.left) {
                    this.choice = (this.choice + this.choices.length - 1) % this.choices.length;
                    BW.Audio.play('ui_move');
                }

                if (inp.pressed.down || inp.pressed.right) {
                    this.choice = (this.choice + 1) % this.choices.length;
                    BW.Audio.play('ui_move');
                }
            }

            const adv = inp.pressed.confirm || inp.pressed.interact || inp.pressed.attack || inp.pressed.jump;

            if (adv && this.t > 0.15) {
                inp.consume('jump');
                inp.consume('attack');

                if (this.chars < txt.length) {
                    this.chars = txt.length;

                    return;
                }

                if (!last) {
                    this.page++;
                    this.chars = 0;
                    BW.Audio.play('ui_move', { vol: 0.6 });

                    return;
                }

                this.close(this.choices ? this.choices[this.choice] : null);
            } else if (inp.pressed.back && this.t > 0.15)
                this.close(this.choices ? this.choices[this.choices.length - 1] : null);
        }
        close(choice) {
            this.active = false;

            const cb = this.onClose;

            this.onClose = null;

            if (cb) cb(choice);
        }
        draw(ctx) {
            if (!this.active) return;

            const w = 860,
                h = 168,
                x = (BW.VW - w) / 2,
                y = BW.VH - h - 36;

            const a = Math.min(1, this.t * 6);

            ctx.save();
            ctx.globalAlpha = a;

            const g = ctx.createLinearGradient(0, y, 0, y + h);

            g.addColorStop(0, 'rgba(10,12,18,0.88)');
            g.addColorStop(1, 'rgba(4,5,8,0.94)');
            ctx.fillStyle = g;
            roundRect(ctx, x, y, w, h, 14);
            ctx.fill();
            ctx.strokeStyle = 'rgba(236,222,190,0.38)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 10);
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `600 22px ${FONT_T}`;
            ctx.fillStyle = '#e8c98a';
            ctx.fillText(this.title, x + 32, y + 20);
            ctx.font = `500 26px ${FONT_B}`;
            ctx.fillStyle = '#f1e8d6';

            const txt = (this.pages[this.page] || '').slice(0, Math.floor(this.chars));

            wrapText(ctx, txt, x + 32, y + 58, w - 64, 31);

            const last = this.page === this.pages.length - 1;
            const full = this.chars >= (this.pages[this.page] || '').length;

            if (last && this.choices && full) {
                ctx.font = `600 22px ${FONT_B}`;

                let cx = x + w - 32;

                ctx.textAlign = 'right';

                for (let i = this.choices.length - 1; i >= 0; i--) {
                    const label = this.choices[i];
                    const tw = ctx.measureText(label).width;

                    ctx.fillStyle = i === this.choice ? '#ffe1a0' : 'rgba(230,220,200,0.55)';
                    ctx.fillText((i === this.choice ? '▸ ' : '') + label, cx, y + h - 40);
                    cx -= tw + 48;
                }
            } else if (full) {
                ctx.fillStyle = `rgba(240,226,196,${0.5 + Math.sin(this.t * 5) * 0.4})`;
                ctx.beginPath();
                ctx.moveTo(x + w - 40, y + h - 32);
                ctx.lineTo(x + w - 28, y + h - 32);
                ctx.lineTo(x + w - 34, y + h - 24);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    function wrapText(ctx, text, x, y, maxW, lh) {
        const words = text.split(' ');

        let line = '',
            yy = y;

        for (const w of words) {
            const test = line ? line + ' ' + w : w;

            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x, yy);
                line = w;
                yy += lh;
            } else line = test;
        }

        if (line) ctx.fillText(line, x, yy);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    BW.Hud = Hud;
    BW.Dialog = Dialog;
    BW.roundRect = roundRect;
    BW.wrapText = wrapText;
})(window.BW);

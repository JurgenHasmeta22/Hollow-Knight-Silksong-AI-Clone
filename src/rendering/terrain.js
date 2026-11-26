'use strict';

// Pre-renders a room's terrain into cached canvases: textured rock with rounded convex corners,
// an ink outline, depth shading toward the interior, lit rims, and area-specific edge dressing.
(function (BW) {
    const T = BW.T;

    function isSolidChar(c) {
        return c === '#';
    }

    const Terrain = {
        build(room) {
            const def = room.def,
                area = room.area;

            const W = room.w,
                H = room.h,
                pw = room.pw,
                ph = room.ph;

            const g = def.grid;
            const solid = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? true : isSolidChar(g[y][x]));
            const rng = BW.seeded(BW.hashStr(def.id));

            // ---- mask path with rounded convex corners ----
            const path = new Path2D();
            const R = 12;

            for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                    if (!solid(x, y)) continue;

                    const up = solid(x, y - 1),
                        dn = solid(x, y + 1),
                        lf = solid(x - 1, y),
                        rt = solid(x + 1, y);

                    const tl = !up && !lf ? R : 0,
                        tr = !up && !rt ? R : 0,
                        br = !dn && !rt ? R : 0,
                        bl = !dn && !lf ? R : 0;

                    if (path.roundRect && (tl || tr || br || bl)) path.roundRect(x * T, y * T, T, T, [tl, tr, br, bl]);
                    else path.rect(x * T, y * T, T, T);
                }

            // concave fillets so inner corners read as carved, not gridded
            for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                    if (solid(x, y)) continue;

                    const up = solid(x, y - 1),
                        dn = solid(x, y + 1),
                        lf = solid(x - 1, y),
                        rt = solid(x + 1, y);

                    const f = 9;

                    const fil = (cx, cy, sx, sy) => {
                        path.moveTo(cx, cy);
                        path.lineTo(cx + sx * f, cy);
                        path.quadraticCurveTo(cx, cy, cx, cy + sy * f);
                        path.closePath();
                    };

                    if (up && lf && solid(x - 1, y - 1)) fil(x * T, y * T, 1, 1);
                    if (up && rt && solid(x + 1, y - 1)) fil((x + 1) * T, y * T, -1, 1);
                    if (dn && lf && solid(x - 1, y + 1)) fil(x * T, (y + 1) * T, 1, -1);
                    if (dn && rt && solid(x + 1, y + 1)) fil((x + 1) * T, (y + 1) * T, -1, -1);
                }

            const c = BW.makeCanvas(pw, ph),
                x = c.getContext('2d');

            // ---- ink outline (dilate the mask) ----
            x.fillStyle = area.ink;

            for (const [ox, oy] of [
                [-3, 0],
                [3, 0],
                [0, -3],
                [0, 3],
                [-2, -2],
                [2, -2],
                [-2, 2],
                [2, 2],
            ]) {
                x.save();
                x.translate(ox, oy);
                x.fill(path);
                x.restore();
            }

            // ---- texture fill ----
            x.save();
            x.clip(path);

            const tex = BW.Assets.img(area.tex);

            if (tex) {
                const pat = x.createPattern(tex, 'repeat');
                const s = 256 / tex.width;

                if (pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix().scale(s, s));

                x.fillStyle = pat;
            } else x.fillStyle = area.fog;

            x.fillRect(0, 0, pw, ph);
            // tint toward the area palette so all textures sit in the scene
            x.globalAlpha = 0.16;
            x.fillStyle = area.ink;
            x.fillRect(0, 0, pw, ph);
            x.globalAlpha = 1;

            // ---- depth shading ----
            const dist = new Float32Array(W * H).fill(1e9);
            const q = [];

            for (let yy = 0; yy < H; yy++)
                for (let xx = 0; xx < W; xx++)
                    if (!solid(xx, yy)) {
                        dist[yy * W + xx] = 0;
                        q.push(yy * W + xx);
                    }

            for (let i = 0; i < q.length; i++) {
                const id = q[i],
                    cx = id % W,
                    cy = (id / W) | 0,
                    d = dist[id] + 1;

                for (const [nx, ny] of [
                    [cx + 1, cy],
                    [cx - 1, cy],
                    [cx, cy + 1],
                    [cx, cy - 1],
                ]) {
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;

                    const n = ny * W + nx;

                    if (dist[n] > d) {
                        dist[n] = d;
                        q.push(n);
                    }
                }
            }

            const sh = BW.makeCanvas(W, H),
                sx = sh.getContext('2d'),
                img = sx.createImageData(W, H);

            const [dr, dg, db] = BW.hexToRgb(area.deep);

            for (let i = 0; i < W * H; i++) {
                const d = dist[i] >= 1e8 ? 6 : dist[i];
                const a = BW.clamp((d - 0.55) * 0.3, 0, 0.94);

                img.data[i * 4] = dr;
                img.data[i * 4 + 1] = dg;
                img.data[i * 4 + 2] = db;
                img.data[i * 4 + 3] = a * 255;
            }

            sx.putImageData(img, 0, 0);
            x.imageSmoothingEnabled = true;
            x.drawImage(sh, 0, 0, W, H, 0, 0, pw, ph);

            // ---- rims ----
            const [rr, rg, rb] = BW.hexToRgb(area.rim);

            for (let yy = 0; yy < H; yy++)
                for (let xx = 0; xx < W; xx++) {
                    if (!solid(xx, yy)) continue;

                    if (!solid(xx, yy - 1)) {
                        const gr = x.createLinearGradient(0, yy * T, 0, yy * T + 14);

                        gr.addColorStop(0, `rgba(${rr},${rg},${rb},0.5)`);
                        gr.addColorStop(1, `rgba(${rr},${rg},${rb},0)`);

                        x.fillStyle = gr;
                        x.fillRect(xx * T, yy * T, T, 14);
                    }

                    if (!solid(xx - 1, yy)) {
                        x.fillStyle = `rgba(${rr},${rg},${rb},0.12)`;
                        x.fillRect(xx * T, yy * T, 4, T);
                    }

                    if (!solid(xx + 1, yy)) {
                        x.fillStyle = 'rgba(0,0,0,0.25)';
                        x.fillRect(xx * T + T - 5, yy * T, 5, T);
                    }
                }

            x.restore();

            // ---- edge dressing ----
            const fx = x; // grass "in front" is baked straight into the terrain: no second room-sized canvas

            const tops = [],
                bottoms = [];

            for (let yy = 0; yy < H; yy++) {
                let run = null;

                for (let xx = 0; xx <= W; xx++) {
                    const edge = xx < W && solid(xx, yy) && !solid(xx, yy - 1) && yy > 0;

                    if (edge) {
                        if (!run) run = { y: yy, x0: xx, x1: xx };
                        else run.x1 = xx;
                    } else if (run) {
                        tops.push(run);
                        run = null;
                    }
                }

                run = null;

                for (let xx = 0; xx <= W; xx++) {
                    const edge = xx < W && solid(xx, yy) && !solid(xx, yy + 1) && yy < H - 1;

                    if (edge) {
                        if (!run) run = { y: yy, x0: xx, x1: xx };
                        else run.x1 = xx;
                    } else if (run) {
                        bottoms.push(run);
                        run = null;
                    }
                }
            }

            const style = DRESS[area.dress || area.id] || DRESS.mosslit;

            for (const r of tops) style.top(x, fx, r, rng, area, room);
            for (const r of bottoms) style.bottom(x, r, rng, area, room);

            // ---- one-way ledges and thorns ----
            for (let yy = 0; yy < H; yy++) {
                let run = null;

                for (let xx = 0; xx <= W; xx++) {
                    const c2 = xx < W ? g[yy][xx] : '';

                    if (c2 === '=') {
                        if (!run) run = { y: yy, x0: xx, x1: xx };
                        else run.x1 = xx;
                    } else if (run) {
                        style.ledge(x, run, rng, area);
                        run = null;
                    }
                }

                run = null;

                for (let xx = 0; xx <= W; xx++) {
                    const c2 = xx < W ? g[yy][xx] : '';

                    if (c2 === '^') {
                        if (!run) run = { y: yy, x0: xx, x1: xx };
                        else run.x1 = xx;
                    } else if (run) {
                        drawThorns(x, run, rng, area);
                        run = null;
                    }
                }
            }

            // ---- secret overlays: rock that hides a nook until revealed ----
            const secrets = (def.secrets || []).map((s) => {
                const sw = (s.x1 - s.x0 + 1) * T,
                    shh = (s.y1 - s.y0 + 1) * T;

                const cv = BW.makeCanvas(sw + 2 * T, shh + 2 * T),
                    cx2 = cv.getContext('2d');

                cx2.translate(-(s.x0 - 1) * T, -(s.y0 - 1) * T);

                if (tex) {
                    const pat = cx2.createPattern(tex, 'repeat');

                    if (pat.setTransform && window.DOMMatrix)
                        pat.setTransform(new DOMMatrix().scale(256 / tex.width, 256 / tex.width));

                    cx2.fillStyle = pat;
                } else cx2.fillStyle = area.fog;

                cx2.fillRect((s.x0 - 0.2) * T, (s.y0 - 0.2) * T, sw + 0.4 * T, shh + 0.4 * T);
                cx2.fillStyle = BW.rgba(area.deep, 0.62);
                cx2.fillRect((s.x0 - 0.2) * T, (s.y0 - 0.2) * T, sw + 0.4 * T, shh + 0.4 * T);

                return {
                    id: s.id,
                    canvas: cv,
                    x: (s.x0 - 1) * T,
                    y: (s.y0 - 1) * T,
                    rect: { x: s.x0 * T, y: s.y0 * T, w: sw, h: shh },
                    a: 1,
                };
            });

            return { canvas: c, secrets };
        },

        // Free the big offscreen surfaces of a terrain that is no longer shown (canvases and ImageBitmaps
        // otherwise linger until the garbage collector gets to them, and a few room loads pile up GPU memory).
        release(ter) {
            if (!ter) return;

            const free = (s) => {
                if (!s) return;

                if (s.close) s.close();
                else {
                    s.width = 0;
                    s.height = 0;
                }
            };

            free(ter.canvas);

            ter.canvas = null;

            for (const s of ter.secrets) {
                free(s.canvas);
                s.canvas = null;
            }

            ter.released = true;
        },

        // A breakable wall drawn as cracked rock in the room's texture.
        drawBreakable(ctx, room, b, t) {
            const area = room.area;

            const x0 = b.x0 * T,
                y0 = b.y0 * T,
                w = (b.x1 - b.x0 + 1) * T,
                h = (b.y1 - b.y0 + 1) * T;

            const shake = b.shake > 0 ? Math.sin(t * 90) * 3 * (b.shake / 0.25) : 0;

            ctx.save();
            ctx.translate(shake, 0);

            const tex = BW.Assets.img(area.tex);

            if (tex) {
                const pat = ctx.createPattern(tex, 'repeat');

                if (pat.setTransform && window.DOMMatrix)
                    pat.setTransform(new DOMMatrix().scale(256 / tex.width, 256 / tex.width));

                ctx.fillStyle = pat;
            } else ctx.fillStyle = area.fog;

            ctx.fillRect(x0, y0, w, h);
            ctx.fillStyle = BW.rgba(area.ink, 0.35);
            ctx.fillRect(x0, y0, w, h);
            ctx.strokeStyle = BW.rgba(area.deep, 0.85);
            ctx.lineWidth = 2;

            const rng = BW.seeded(BW.hashStr(b.id));
            const cracks = 2 + (3 - b.hp) * 2;

            for (let i = 0; i < cracks; i++) {
                let cx = x0 + rng() * w,
                    cy = y0 + rng() * h;

                ctx.beginPath();
                ctx.moveTo(cx, cy);

                for (let k = 0; k < 4; k++) {
                    cx += (rng() - 0.5) * 26;
                    cy += (rng() - 0.3) * 22;
                    ctx.lineTo(cx, cy);
                }

                ctx.stroke();
            }

            ctx.strokeStyle = BW.rgba(area.rim, 0.12);
            ctx.lineWidth = 1;
            ctx.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
            ctx.restore();
        },

        drawGate(ctx, room, gt, t) {
            const x0 = gt.x0 * T,
                y0 = gt.y0 * T,
                w = (gt.x1 - gt.x0 + 1) * T,
                h = (gt.y1 - gt.y0 + 1) * T;

            const a = gt.anim;

            if (a >= 1 && gt.kind !== 'seal' && gt.kind !== 'veil') return;

            if (gt.kind === 'bars') {
                const off = a * h;

                ctx.save();
                ctx.beginPath();
                ctx.rect(x0 - 10, y0 - 4, w + 20, h + 4);
                ctx.clip();
                ctx.fillStyle = '#1b1820';
                ctx.fillRect(x0 + 4, y0 - off, w - 8, 10);

                for (let i = 0; i < 4; i++) {
                    const bx = x0 + 8 + i * ((w - 16) / 3);

                    ctx.fillStyle = '#2c2833';
                    ctx.fillRect(bx - 4, y0 - off, 8, h);
                    ctx.fillStyle = 'rgba(255,230,190,0.18)';
                    ctx.fillRect(bx - 4, y0 - off, 2, h);
                    ctx.fillStyle = '#1b1820';
                    ctx.beginPath();
                    ctx.moveTo(bx - 6, y0 - off + h);
                    ctx.lineTo(bx, y0 - off + h + 10);
                    ctx.lineTo(bx + 6, y0 - off + h);
                    ctx.fill();
                }

                ctx.restore();
            } else if (gt.kind === 'hatch') {
                const half = w / 2,
                    open = a * half;

                ctx.fillStyle = '#26232a';
                ctx.fillRect(x0 - open, y0 + 6, half, h - 10);
                ctx.fillRect(x0 + half + open, y0 + 6, half, h - 10);
                ctx.strokeStyle = 'rgba(255,230,190,0.2)';
                ctx.lineWidth = 2;

                for (let i = 0; i < 4; i++) {
                    const bx = x0 + 10 + i * 20;

                    ctx.beginPath();
                    ctx.moveTo(bx, y0 + 8);
                    ctx.lineTo(bx, y0 + h - 6);
                    ctx.stroke();
                }

                ctx.fillStyle = '#3d3742';
                ctx.fillRect(x0 - 4, y0 + 2, w + 8, 6);
            } else if (gt.kind === 'veil') {
                // black funeral veils tied with silver thread: they hang across the way and, when the gate opens, are
                // drawn aside and tied back against the walls
                const open = BW.easeInOutSine(a),
                    n = Math.max(4, Math.round(w / 14)),
                    sw = w / n;

                ctx.save();

                for (let i = 0; i < n; i++) {
                    const u = (i + 0.5) / n,
                        side = u < 0.5 ? -1 : 1;

                    const gx = x0 + u * w + side * open * (w * 0.5 + 18) * (0.35 + 0.65 * Math.abs(u - 0.5) * 2);
                    const sway = Math.sin(t * 0.8 + i * 1.7) * 3 * (1 - open);
                    const len = h * (1 - 0.5 * open) + (i % 3) * 5;

                    ctx.fillStyle = i % 2 ? '#090c11' : '#10151b';
                    ctx.beginPath();
                    ctx.moveTo(gx - sw / 2 - 1, y0 - 4);
                    ctx.lineTo(gx + sw / 2 + 1, y0 - 4);
                    ctx.lineTo(gx + sw / 2 + sway, y0 + len);
                    ctx.lineTo(gx + sway, y0 + len - 7 - (i % 2) * 9);
                    ctx.lineTo(gx - sw / 2 + sway, y0 + len - 2);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = `rgba(159,216,255,${0.1 + 0.2 * (1 - open)})`;
                    ctx.fillRect(gx + sw / 2 - 1, y0, 1.4, len * 0.9);
                }

                if (open < 0.95) {
                    ctx.strokeStyle = `rgba(230,240,255,${0.6 * (1 - open)})`;
                    ctx.lineWidth = 1.2;

                    for (const k of [0.3, 0.55, 0.8]) {
                        ctx.beginPath();
                        ctx.moveTo(x0 + 4, y0 + h * k);
                        ctx.lineTo(x0 + w * 0.5, y0 + h * (k + 0.07));
                        ctx.lineTo(x0 + w - 4, y0 + h * k);
                        ctx.stroke();
                    }
                }

                // the cold light that leaks through the seams
                ctx.globalCompositeOperation = 'lighter';

                const gl = ctx.createLinearGradient(0, y0, 0, y0 + h);

                gl.addColorStop(0, 'rgba(159,216,255,0)');
                gl.addColorStop(1, `rgba(159,216,255,${0.12 * (1 - open)})`);
                ctx.fillStyle = gl;
                ctx.fillRect(x0, y0, w, h);
                ctx.restore();
            } else if (gt.kind === 'seal') {
                const half = w / 2,
                    open = BW.easeInOutSine(a) * (half + 30);

                ctx.save();

                for (const s of [-1, 1]) {
                    const px = s < 0 ? x0 - open : x0 + half + open;

                    ctx.fillStyle = '#4a4656';
                    ctx.fillRect(px, y0, half, h);
                    ctx.fillStyle = 'rgba(240,235,255,0.15)';
                    ctx.fillRect(px, y0 + h - 6, half, 3);
                    ctx.strokeStyle = '#2a2733';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px + 2, y0 + 2, half - 4, h - 4);
                }

                ctx.restore();
            }
        },
    };

    // ---------------------------------------------------------------- area dressing
    const DRESS = {
        mosslit: {
            top(x, fx, r, rng, area) {
                const y = r.y * T,
                    x0 = r.x0 * T - 4,
                    x1 = (r.x1 + 1) * T + 4;

                // moss blanket

                x.fillStyle = '#1f5a4a';
                x.beginPath();
                x.moveTo(x0, y + 10);

                for (let px = x0; px <= x1; px += 10) x.lineTo(px, y - 3 - rng() * 5);

                x.lineTo(x1, y + 12);

                for (let px = x1; px >= x0; px -= 14) x.lineTo(px, y + 9 + rng() * 9);

                x.closePath();
                x.fill();
                x.fillStyle = '#3c8f72';
                x.beginPath();
                x.moveTo(x0, y + 2);

                for (let px = x0; px <= x1; px += 8) x.lineTo(px, y - 2 - rng() * 4);

                x.lineTo(x1, y + 4);
                x.lineTo(x0, y + 4);
                x.closePath();
                x.fill();

                // grass blades, some in front of the player
                for (let px = x0 + 4; px < x1 - 4; px += 5 + rng() * 6) {
                    const h = 6 + rng() * 14,
                        lean = (rng() - 0.5) * 8;

                    const tgt = rng() < 0.25 ? fx : x;

                    tgt.strokeStyle = rng() < 0.15 ? '#8ff0c8' : rng() < 0.5 ? '#2f7e63' : '#4fae86';
                    tgt.lineWidth = 1.6;
                    tgt.beginPath();
                    tgt.moveTo(px, y + 2);
                    tgt.quadraticCurveTo(px + lean * 0.3, y - h * 0.6, px + lean, y - h);
                    tgt.stroke();
                }

                // glowing moss beads
                for (let px = x0 + 10; px < x1 - 10; px += 22 + rng() * 40) {
                    if (rng() < 0.55) {
                        x.fillStyle = 'rgba(140,255,215,0.85)';
                        x.beginPath();
                        x.arc(px, y - 2 - rng() * 3, 1.6 + rng() * 1.6, 0, Math.PI * 2);
                        x.fill();
                    }
                }

                // occasional props on wide ledges
                const len = r.x1 - r.x0 + 1;

                if (len >= 4) {
                    const n = Math.floor(len / 6) + (rng() < 0.5 ? 1 : 0);

                    for (let i = 0; i < n; i++) {
                        const pick = BW.pick([
                            'deco_mos_mush',
                            'deco_mos_fern',
                            'deco_mos_fern',
                            'deco_mos_bulb',
                            'deco_mos_crystal',
                            'deco_mos_rock',
                        ]);

                        const px = x0 + 20 + rng() * (x1 - x0 - 40);
                        const sc = 0.8 + rng() * 0.5;

                        const hh =
                            {
                                deco_mos_mush: 60,
                                deco_mos_fern: 46,
                                deco_mos_bulb: 44,
                                deco_mos_crystal: 40,
                                deco_mos_rock: 34,
                            }[pick] * sc;

                        const im = BW.Assets.img(pick);

                        if (im) {
                            const ww = (hh * im.width) / im.height;

                            (rng() < 0.3 ? fx : x).drawImage(im, px - ww / 2, y - hh + 6, ww, hh);
                        }
                    }
                }
            },
            bottom(x, r, rng) {
                const y = (r.y + 1) * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                for (let px = x0 + 6; px < x1 - 4; px += 9 + rng() * 16) {
                    const len = 8 + rng() * (rng() < 0.15 ? 70 : 24);

                    x.strokeStyle = rng() < 0.3 ? 'rgba(120,230,190,0.55)' : 'rgba(30,70,60,0.9)';
                    x.lineWidth = 1.5 + rng() * 1.5;
                    x.beginPath();
                    x.moveTo(px, y - 2);
                    x.quadraticCurveTo(px + (rng() - 0.5) * 10, y + len * 0.5, px + (rng() - 0.5) * 6, y + len);
                    x.stroke();

                    if (len > 40 && rng() < 0.6) {
                        x.fillStyle = 'rgba(150,255,220,0.9)';
                        x.beginPath();
                        x.arc(px, y + len, 2, 0, Math.PI * 2);
                        x.fill();
                    }
                }
            },
            ledge(x, r, rng) {
                const y = r.y * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                x.fillStyle = '#2b2219';
                x.beginPath();
                x.moveTo(x0 - 4, y + 2);
                x.lineTo(x1 + 4, y + 2);
                x.lineTo(x1, y + 16);
                x.lineTo(x0, y + 16);
                x.closePath();
                x.fill();
                x.fillStyle = '#4a3a2a';
                x.fillRect(x0, y + 3, x1 - x0, 4);
                x.fillStyle = '#3c8f72';

                for (let px = x0; px < x1; px += 6) x.fillRect(px, y - 1 - rng() * 3, 5, 5);

                x.strokeStyle = 'rgba(20,14,10,0.9)';
                x.lineWidth = 2;
                x.strokeRect(x0 - 1, y + 1, x1 - x0 + 2, 15);

                for (let px = x0 + 8; px < x1; px += 30) {
                    x.strokeStyle = 'rgba(30,70,60,0.8)';
                    x.beginPath();
                    x.moveTo(px, y + 16);
                    x.lineTo(px + 2, y + 26 + rng() * 14);
                    x.stroke();
                }
            },
        },
        spindle: {
            top(x, fx, r, rng) {
                const y = r.y * T,
                    x0 = r.x0 * T - 2,
                    x1 = (r.x1 + 1) * T + 2;

                x.fillStyle = '#3a2a22';
                x.fillRect(x0, y - 2, x1 - x0, 12);
                x.fillStyle = '#7a5a3e';
                x.fillRect(x0, y - 2, x1 - x0, 3);
                x.fillStyle = 'rgba(0,0,0,0.4)';
                x.fillRect(x0, y + 8, x1 - x0, 3);
                x.strokeStyle = 'rgba(15,10,8,0.9)';
                x.lineWidth = 2;
                x.strokeRect(x0, y - 2, x1 - x0, 12);

                for (let px = x0 + 14; px < x1 - 6; px += 38) {
                    x.fillStyle = '#c9a26a';
                    x.beginPath();
                    x.arc(px, y + 4, 1.8, 0, Math.PI * 2);
                    x.fill();
                }

                // silk wisps caught on edges
                for (let px = x0 + 20; px < x1 - 20; px += 50 + rng() * 80) {
                    if (rng() < 0.6) {
                        fx.strokeStyle = 'rgba(240,232,215,0.35)';
                        fx.lineWidth = 1;
                        fx.beginPath();
                        fx.moveTo(px, y + 2);
                        fx.quadraticCurveTo(px + 20, y - 18 - rng() * 12, px + 40 + rng() * 20, y + 2);
                        fx.stroke();
                    }
                }

                const len = r.x1 - r.x0 + 1;

                if (len >= 5 && rng() < 0.7) {
                    const pick = BW.pick(['deco_sp_spool', 'deco_sp_crates', 'deco_sp_gear', 'deco_sp_needle']);

                    const hh =
                        { deco_sp_spool: 54, deco_sp_crates: 62, deco_sp_gear: 50, deco_sp_needle: 80 }[pick] *
                        (0.85 + rng() * 0.3);

                    const im = BW.Assets.img(pick);
                    const px = x0 + 30 + rng() * (x1 - x0 - 60);

                    if (im) {
                        const ww = (hh * im.width) / im.height;

                        x.drawImage(im, px - ww / 2, y - hh + 4, ww, hh);
                    }
                }
            },
            bottom(x, r, rng) {
                const y = (r.y + 1) * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                x.fillStyle = '#2a1f1a';
                x.fillRect(x0, y - 8, x1 - x0, 8);

                for (let px = x0 + 10; px < x1 - 6; px += 14 + rng() * 26) {
                    const len = 10 + rng() * (rng() < 0.2 ? 90 : 30);

                    x.strokeStyle = `rgba(235,228,210,${0.18 + rng() * 0.3})`;
                    x.lineWidth = 1;
                    x.beginPath();
                    x.moveTo(px, y);
                    x.lineTo(px + (rng() - 0.5) * 6, y + len);
                    x.stroke();

                    if (len > 50 && rng() < 0.5) {
                        x.fillStyle = 'rgba(240,232,215,0.55)';
                        x.beginPath();
                        x.ellipse(px, y + len, 3, 5, 0, 0, Math.PI * 2);
                        x.fill();
                    }
                }
            },
            ledge(x, r) {
                const y = r.y * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                BW.drawPlank(x, x0, y, x1 - x0, 14, '#5a4030', '#b38a5c');
                x.strokeStyle = '#2a1e18';
                x.lineWidth = 3;

                for (const px of [x0 + 10, x1 - 10]) {
                    x.beginPath();
                    x.moveTo(px, y + 14);
                    x.lineTo(px - 8 * Math.sign(px - (x0 + x1) / 2 || 1), y + 34);
                    x.stroke();
                }
            },
        },
        belfry: {
            top(x, fx, r, rng) {
                const y = r.y * T,
                    x0 = r.x0 * T - 3,
                    x1 = (r.x1 + 1) * T + 3;

                x.fillStyle = '#d9d2c2';
                x.fillRect(x0, y - 4, x1 - x0, 9);
                x.fillStyle = '#f7f3ea';
                x.fillRect(x0, y - 4, x1 - x0, 2);
                x.fillStyle = 'rgba(40,40,60,0.45)';
                x.fillRect(x0, y + 5, x1 - x0, 4);
                x.strokeStyle = 'rgba(20,20,30,0.85)';
                x.lineWidth = 2;
                x.strokeRect(x0, y - 4, x1 - x0, 9);

                for (let px = x0 + 20; px < x1 - 10; px += 40) {
                    x.fillStyle = 'rgba(80,80,100,0.5)';
                    x.fillRect(px, y - 3, 2, 7);
                }

                const len = r.x1 - r.x0 + 1;

                if (len >= 4 && rng() < 0.6) {
                    const pick = BW.pick(['deco_bf_candles', 'deco_bf_candles', 'deco_bf_bellfallen']);
                    const hh = { deco_bf_candles: 40, deco_bf_bellfallen: 46 }[pick] * (0.85 + rng() * 0.3);
                    const im = BW.Assets.img(pick);
                    const px = x0 + 24 + rng() * (x1 - x0 - 48);

                    if (im) {
                        const ww = (hh * im.width) / im.height;

                        x.drawImage(im, px - ww / 2, y - hh + 4, ww, hh);
                    }
                }
            },
            bottom(x, r, rng) {
                const y = (r.y + 1) * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                x.fillStyle = '#bdb5a5';
                x.fillRect(x0, y - 6, x1 - x0, 6);
                x.fillStyle = 'rgba(30,30,45,0.5)';
                x.fillRect(x0, y - 2, x1 - x0, 2);

                for (let px = x0 + 20; px < x1 - 20; px += 40) {
                    x.fillStyle = '#a49c8c';
                    x.beginPath();
                    x.moveTo(px - 8, y);
                    x.lineTo(px + 8, y);
                    x.lineTo(px, y + 10);
                    x.closePath();
                    x.fill();
                }

                for (let px = x0 + 30; px < x1 - 30; px += 120 + rng() * 120) {
                    if (rng() < 0.4) {
                        x.strokeStyle = 'rgba(200,200,215,0.25)';
                        x.lineWidth = 1;
                        x.beginPath();
                        x.moveTo(px, y);
                        x.lineTo(px, y + 40 + rng() * 60);
                        x.stroke();
                    }
                }
            },
            ledge(x, r) {
                const y = r.y * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                x.fillStyle = '#cfc7b6';
                x.fillRect(x0, y, x1 - x0, 14);
                x.fillStyle = '#f2ede2';
                x.fillRect(x0, y, x1 - x0, 3);
                x.strokeStyle = 'rgba(20,20,30,0.85)';
                x.lineWidth = 2;
                x.strokeRect(x0, y, x1 - x0, 14);

                for (const px of [x0 + 12, x1 - 12]) {
                    x.fillStyle = '#a8a090';
                    x.beginPath();
                    x.moveTo(px - 8, y + 14);
                    x.lineTo(px + 8, y + 14);
                    x.lineTo(px, y + 30);
                    x.closePath();
                    x.fill();
                }
            },
        },
        // The Hushed Gallery: polished black stone, a cold rim of light, cloth fallen on the floor and veils for a ceiling
        hushed: {
            top(x, fx, r, rng) {
                const y = r.y * T,
                    x0 = r.x0 * T - 3,
                    x1 = (r.x1 + 1) * T + 3;

                x.fillStyle = '#0d1319';
                x.fillRect(x0, y - 3, x1 - x0, 9);
                x.fillStyle = 'rgba(159,216,255,0.55)';
                x.fillRect(x0, y - 3, x1 - x0, 1.6);
                x.fillStyle = 'rgba(159,216,255,0.1)';
                x.fillRect(x0, y + 6, x1 - x0, 2);

                // joints between the slabs
                for (let px = x0 + 20; px < x1 - 6; px += 46 + rng() * 34) {
                    x.fillStyle = 'rgba(2,4,6,0.75)';
                    x.fillRect(px, y - 3, 2, 9);
                }

                // black cloth, fallen and trodden flat; the odd shard of a mask
                for (let px = x0 + 12; px < x1 - 22; px += 46 + rng() * 64) {
                    if (rng() < 0.55) {
                        const w = 16 + rng() * 22;

                        x.fillStyle = '#06090d';
                        x.beginPath();
                        x.moveTo(px, y - 2);
                        x.quadraticCurveTo(px + w * 0.3, y - 7 - rng() * 4, px + w * 0.55, y - 3);
                        x.quadraticCurveTo(px + w * 0.8, y - 6, px + w, y - 2);
                        x.closePath();
                        x.fill();
                    }

                    if (rng() < 0.18) {
                        x.fillStyle = 'rgba(230,240,250,0.8)';
                        x.beginPath();
                        x.ellipse(px + 6, y - 3, 3.5, 2, rng() - 0.5, 0, Math.PI * 2);
                        x.fill();
                    }
                }
            },
            bottom(x, r, rng) {
                const y = (r.y + 1) * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                x.fillStyle = '#080c10';
                x.fillRect(x0, y - 5, x1 - x0, 5);

                // a ragged fringe of veil along the underside
                for (let px = x0 + 4; px < x1 - 4; px += 9 + rng() * 14) {
                    const len = 12 + rng() * 40,
                        w = 5 + rng() * 6;

                    x.fillStyle = rng() < 0.5 ? '#06090d' : '#0b1015';
                    x.beginPath();
                    x.moveTo(px, y - 2);
                    x.lineTo(px + w, y - 2);
                    x.lineTo(px + w * 0.7, y + len);
                    x.lineTo(px + w * 0.3, y + len * 0.8);
                    x.closePath();
                    x.fill();

                    if (rng() < 0.3) {
                        x.fillStyle = 'rgba(159,216,255,0.28)';
                        x.fillRect(px + w - 1, y, 1, len * 0.7);
                    }
                }
            },
            ledge(x, r) {
                const y = r.y * T,
                    x0 = r.x0 * T,
                    x1 = (r.x1 + 1) * T;

                x.fillStyle = '#121a21';
                x.fillRect(x0, y, x1 - x0, 12);
                x.fillStyle = 'rgba(159,216,255,0.6)';
                x.fillRect(x0, y, x1 - x0, 2);
                x.fillStyle = 'rgba(2,4,6,0.6)';
                x.fillRect(x0, y + 8, x1 - x0, 4);
                x.strokeStyle = 'rgba(2,4,8,0.9)';
                x.lineWidth = 2;
                x.strokeRect(x0, y, x1 - x0, 12);

                // a tassel of black thread at each end
                for (const px of [x0 + 5, x1 - 5]) {
                    x.strokeStyle = 'rgba(8,12,16,0.95)';
                    x.lineWidth = 2;
                    x.beginPath();
                    x.moveTo(px, y + 12);
                    x.lineTo(px + 1, y + 26);
                    x.stroke();
                }
            },
        },
    };

    function drawThorns(x, r, rng, area) {
        const y = (r.y + 1) * T,
            x0 = r.x0 * T,
            x1 = (r.x1 + 1) * T;

        const dress = area.dress || area.id,
            dark = dress === 'belfry' ? '#2a2630' : dress === 'hushed' ? '#0b1015' : '#1d1416',
            tip = dress === 'hushed' ? 'rgba(159,216,255,0.6)' : 'rgba(255,200,190,0.55)';

        x.fillStyle = dark;
        x.fillRect(x0, y - 12, x1 - x0, 12);

        for (let px = x0 + 2; px < x1 - 2; px += 7 + rng() * 5) {
            const h = 14 + rng() * 16,
                lean = (rng() - 0.5) * 10;

            x.fillStyle = dark;
            x.beginPath();
            x.moveTo(px - 5, y - 6);
            x.lineTo(px + lean, y - 6 - h);
            x.lineTo(px + 5, y - 6);
            x.closePath();
            x.fill();
            x.fillStyle = tip;
            x.beginPath();
            x.moveTo(px + lean * 0.8 - 1.5, y - 6 - h * 0.8);
            x.lineTo(px + lean, y - 6 - h);
            x.lineTo(px + lean * 0.8 + 1.5, y - 6 - h * 0.8);
            x.closePath();
            x.fill();
        }

        // vines
        x.strokeStyle = dress === 'hushed' ? '#161d25' : '#3a1f24';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(x0, y - 8);

        for (let px = x0; px <= x1; px += 16) x.lineTo(px, y - 8 - Math.sin(px * 0.13) * 4);

        x.stroke();
    }

    BW.Terrain = Terrain;
})(window.BW);

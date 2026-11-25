'use strict';
// Parallax backdrops, fog, ambient particles, room decorations and the light/darkness pass.
(function (BW) {
  const T = BW.T;

  class Background {
    constructor(game) {
      this.game = game; this.motes = []; this.area = null; this.t = 0;
      this.lightCanvas = BW.makeCanvas(BW.VW / 4, BW.VH / 4);
      this.lctx = this.lightCanvas.getContext('2d');
      this.vignette = null;
    }

    setRoom(room) {
      this.room = room; this.area = room.area; this.motes = [];
      this.farKey = null; this.grad = null;
    }

    // graphics options changed: rebuild the backdrop buffer at the new detail level
    gfxChanged() { this.farCanvas = null; this.farKey = null; }

    update(dt, cam, vw, vh) {
      this.t += dt;
      const kind = this.area.particles;
      const want = Math.round((kind === 'spores' ? 55 : kind === 'dust' ? 45 : 40) * BW.gfx.motes);
      if (this.motes.length > want) this.motes.length = want;
      while (this.motes.length < want) this.motes.push(this.newMote({}, cam, vw, vh, true));
      for (const m of this.motes) {
        m.t += dt;
        m.x += (m.vx + Math.sin(m.t * m.wf + m.ph) * m.wa) * dt; m.y += m.vy * dt;
        if (m.x < cam.x - 80 || m.x > cam.x + vw + 80 || m.y < cam.y - 80 || m.y > cam.y + vh + 80 || m.t > m.life) this.newMote(m, cam, vw, vh, false);
      }
    }

    // (re)initialises m in place so motes never churn the allocator
    newMote(m, cam, vw, vh, anywhere) {
      const kind = this.area.particles;
      m.t = 0; m.life = BW.rand(6, 14); m.ph = Math.random() * 6; m.wf = BW.rand(0.5, 1.5); m.wa = BW.rand(6, 18); m.z = BW.rand(0.6, 1.4); m.thread = false;
      m.x = cam.x + BW.rand(-40, vw + 40);
      m.y = anywhere ? cam.y + BW.rand(0, vh) : (kind === 'spores' ? cam.y + vh + 30 : cam.y - 30);
      if (kind === 'spores') { m.vx = BW.rand(-8, 8); m.vy = BW.rand(-26, -10); m.size = BW.rand(1, 2.6); m.color = Math.random() < 0.7 ? '#8ff5d4' : '#d6fff0'; }
      else if (kind === 'dust') { m.vx = BW.rand(-12, 12); m.vy = BW.rand(4, 14); m.size = BW.rand(0.8, 2); m.color = Math.random() < 0.5 ? '#ffe2b8' : '#f2e9da'; m.thread = Math.random() < 0.18; }
      else { m.vx = BW.rand(-6, 6); m.vy = BW.rand(6, 16); m.size = BW.rand(0.8, 2.2); m.color = '#e8eeff'; }
      return m;
    }

    // ---- screen-space backdrops (camera in world units; vw/vh = visible world size) ----
    // Rendered at reduced resolution into one buffer, then upscaled with a single draw. The buffer is only
    // repainted when the camera, the slow light drift or the colour wash actually changed.
    drawFar(ctx, cam, vw, vh) {
      const BWD = BW.gfx.farW, BHD = Math.round(BWD * 9 / 16);
      if (!this.farCanvas) { this.farCanvas = BW.makeCanvas(BWD, BHD); this.fctx = this.farCanvas.getContext('2d'); this.farKey = null; }
      const area = this.area, tint = area.tint && area.tint.a > 0.01 ? area.tint.a : 0;
      const tq = BW.gfx.godRays ? Math.floor(this.t * 6) : 0;
      const k = this.farKey || (this.farKey = { room: null });
      if (k.room !== this.room || k.x !== cam.x || k.y !== cam.y || k.vw !== vw || k.tq !== tq || k.tint !== tint) {
        k.x = cam.x; k.y = cam.y; k.vw = vw; k.tq = tq; k.tint = tint; k.room = this.room;
        const f = this.fctx;
        f.setTransform(BWD / vw, 0, 0, BHD / vh, 0, 0);
        this.paintFar(f, cam, vw, vh);
      }
      ctx.drawImage(this.farCanvas, 0, 0, vw, vh);
    }

    // gradients are rebuilt only when the area or the view height changes
    gradients(ctx, vh) {
      const area = this.area, c = this.grad;
      if (c && c.area === area && c.vh === vh && c.ctx === ctx) return c;
      const ray = ctx.createLinearGradient(0, 0, 160, vh);
      ray.addColorStop(0, BW.rgba(area.light, 1)); ray.addColorStop(1, BW.rgba(area.light, 0));
      const fog = ctx.createLinearGradient(0, 0, 0, vh);
      fog.addColorStop(0, BW.rgba(area.fog, 0.25)); fog.addColorStop(1, BW.rgba(area.fog, 0.55));
      return (this.grad = { area, vh, ctx, ray, fog });
    }

    paintFar(ctx, cam, vw, vh) {
      const room = this.room, area = this.area, G = this.gradients(ctx, vh);
      ctx.fillStyle = area.sky; ctx.fillRect(0, 0, vw, vh);
      const px = room.pw > vw ? BW.clamp(cam.x / (room.pw - vw), 0, 1) : 0.5;
      const py = room.ph > vh ? BW.clamp(cam.y / (room.ph - vh), 0, 1) : 0.5;
      const far = BW.Assets.img(area.bg[0]);
      if (far) {
        const s = Math.max(vw * 1.18 / far.width, vh * 1.18 / far.height);
        const w = far.width * s, h = far.height * s;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(far, -px * (w - vw), -py * (h - vh), w, h);
        ctx.globalAlpha = 1;
      }
      // god-rays / soft light bands
      if (BW.gfx.godRays) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = G.ray;
        for (let i = 0; i < 3; i++) {
          const bx = ((i * 0.37 + 0.15 - px * 0.12) % 1) * vw * 1.2 - vw * 0.1;
          ctx.globalAlpha = 0.035 + Math.sin(this.t * 0.3 + i) * 0.015;
          ctx.save(); ctx.translate(bx, 0);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(90, 0); ctx.lineTo(330, vh); ctx.lineTo(150, vh); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
      const mid = BW.Assets.img(area.bg[1]);
      if (mid) {
        const s = (vh * 1.05) / mid.height;
        const w = mid.width * s, h = mid.height * s;
        let ox = -(cam.x * 0.35) % w; if (ox > 0) ox -= w;
        const oy = vh - h + 40 - (py - 0.5) * 60;
        ctx.globalAlpha = 0.85;
        for (let xx = ox; xx < vw; xx += w) {
          const tile = Math.floor((xx - ox) / w + Math.floor(cam.x * 0.35 / w));
          if (tile % 2 === 0) ctx.drawImage(mid, xx, oy, w, h);
          else { ctx.save(); ctx.translate(xx + w, oy); ctx.scale(-1, 1); ctx.drawImage(mid, 0, 0, w, h); ctx.restore(); }
        }
        ctx.globalAlpha = 1;
      }
      // fog to push backdrops back
      ctx.fillStyle = G.fog; ctx.fillRect(0, 0, vw, vh);
      // optional colour wash (the cathedral's ember glow in the boss's second phase, dawn after the ending)
      if (area.tint && area.tint.a > 0.01) { ctx.fillStyle = BW.rgba(area.tint.color, area.tint.a); ctx.fillRect(0, 0, vw, vh); }
    }

    // ---- world-space room decorations ----
    drawDeco(ctx, layer) {
      const room = this.room, g = this.game;
      for (const d of room.def.deco) {
        const dl = d.layer || 'back';
        if (dl !== layer) continue;
        const x = d.x * T, y = d.y * T;
        switch (d.sprite) {
          case 'lightshaft': {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const a = (d.alpha || 0.4) * (0.8 + Math.sin(this.t * 0.7) * 0.2);
            const gr = ctx.createLinearGradient(x, y, x, y + d.h * T);
            gr.addColorStop(0, BW.rgba(room.area.light, a * 0.5)); gr.addColorStop(1, BW.rgba(room.area.light, 0));
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.moveTo(x - d.w * T * 0.25, y); ctx.lineTo(x + d.w * T * 0.25, y); ctx.lineTo(x + d.w * T * 0.6, y + d.h * T); ctx.lineTo(x - d.w * T * 0.6, y + d.h * T); ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
          }
          case 'cords': {
            const n = d.thin ? 1 : 3;
            for (let i = 0; i < n; i++) {
              const ox = (i - (n - 1) / 2) * 14;
              ctx.strokeStyle = 'rgba(28,22,20,0.85)'; ctx.lineWidth = d.thin ? 3 : 6;
              ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.quadraticCurveTo(x + ox + Math.sin(this.t * 0.4 + i) * 6, y + d.h * T * 0.5, x + ox, y + d.h * T); ctx.stroke();
              ctx.strokeStyle = 'rgba(230,210,170,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
            }
            break;
          }
          case 'threads': {
            for (let i = 0; i < 5; i++) {
              const ox = i * 9 - 18, len = d.h * T * (0.5 + ((i * 37) % 10) / 20);
              ctx.strokeStyle = 'rgba(240,232,215,0.22)'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.quadraticCurveTo(x + ox + Math.sin(this.t * 0.6 + i) * 8, y + len / 2, x + ox + Math.sin(this.t * 0.5 + i * 2) * 4, y + len); ctx.stroke();
            }
            break;
          }
          case 'water': {
            const w = d.w * T, h = d.h * T, v = this.view;
            // only the on-screen stretch of the surface lines is stroked
            let a0 = 0, a1 = w;
            if (v) { if (x > v.x1 || x + w < v.x0) break; a0 = Math.max(0, Math.floor((v.x0 - x) / 16) * 16); a1 = Math.min(w, v.x1 - x); }
            ctx.fillStyle = 'rgba(20,60,70,0.45)'; ctx.fillRect(x, y + 10, w, h - 10);
            ctx.strokeStyle = 'rgba(160,255,230,0.35)'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              for (let px = a0; px <= a1; px += 16) ctx.lineTo(x + px, y + 12 + i * 12 + Math.sin(px * 0.05 + this.t * 2 + i) * 2);
              ctx.globalAlpha = 0.6 - i * 0.12; ctx.stroke(); ctx.globalAlpha = 1;
            }
            break;
          }
          case 'gears': {
            const im = BW.Assets.img('deco_sp_gear');
            const sc = (d.scale || 1) * 220;
            ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 0.15 * (d.scale ? -1 : 1)); ctx.globalAlpha = 0.5;
            if (im) ctx.drawImage(im, -sc / 2, -sc / 2, sc, sc);
            ctx.restore();
            break;
          }
          case 'bellbig': {
            const sw = Math.sin(this.t * 0.5) * (d.swing || 0.03);
            ctx.save(); ctx.translate(x, y); ctx.rotate(sw); ctx.globalAlpha = 0.55;
            ctx.strokeStyle = 'rgba(20,20,30,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -y); ctx.lineTo(0, 30); ctx.stroke();
            BW.Assets.drawImg(ctx, 'obj_bell', 0, 20, { w: 300 * (d.scale || 1), h: 300 * (d.scale || 1), ay: 0 });
            ctx.restore();
            break;
          }
          default: {
            const map = { loom: 'deco_sp_loom', spools: 'deco_sp_spool', statue_keeper: 'deco_bf_statue', window: 'deco_bf_window', statue_moth: 'statue_moth' };
            const name = map[d.sprite] || d.sprite;
            const im = BW.Assets.img(name);
            if (!im) break;
            const hh = ({ deco_sp_loom: 230, deco_sp_spool: 90, deco_bf_statue: 260, deco_bf_window: 340, statue_moth: 420 }[name] || 160) * (d.scale || 1);
            const ww = hh * im.width / im.height;
            ctx.save(); ctx.globalAlpha = d.alpha != null ? d.alpha : 0.9;
            if (d.flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -ww / 2, (name === 'deco_bf_window' ? y : y - hh), ww, hh); }
            else ctx.drawImage(im, x - ww / 2, (name === 'deco_bf_window' ? y : y - hh), ww, hh);
            ctx.restore();
            if (name === 'deco_bf_window') g.addLight(x, y + hh * 0.4, 220, '#cfe0ff', 0.25);
          }
        }
      }
    }

    drawMotes(ctx) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        const k = Math.min(1, m.t / 1.2, (m.life - m.t) / 1.2);
        ctx.globalAlpha = 0.55 * k;
        ctx.fillStyle = m.color;
        if (m.thread) { ctx.strokeStyle = m.color; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + 10, m.y + 6); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(m.x, m.y, m.size * m.z, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }

    // ---- lighting: darkness (with the vignette baked in) cut by lights, plus additive glows ----
    // Both passes are drawn into small buffers and composited with one full-screen draw each.
    drawLighting(ctx, cam, vw, vh, lights, n, playerLight) {
      const area = this.area, L = this.lctx, lc = this.lightCanvas;
      const sx = lc.width / vw, sy = lc.height / vh, full = BW.gfx.lighting > 1;
      L.globalCompositeOperation = 'source-over';
      L.globalAlpha = 1;
      L.clearRect(0, 0, lc.width, lc.height);
      const dk = area.darkness + 0.06;
      if (this.darkArea !== area || this.darkVal !== dk) { this.darkArea = area; this.darkVal = dk; this.darkStyle = BW.rgba(area.deep, dk); }
      L.fillStyle = this.darkStyle;
      L.fillRect(0, 0, lc.width, lc.height);
      if (!this.vignette) {
        const vg = L.createRadialGradient(lc.width / 2, lc.height / 2, lc.height * 0.35, lc.width / 2, lc.height / 2, lc.height * 0.95);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
        this.vignette = vg;
      }
      L.fillStyle = this.vignette; L.fillRect(0, 0, lc.width, lc.height);
      L.globalCompositeOperation = 'destination-out';
      const hole = glowSprite('#000000');
      for (let i = 0; i <= n; i++) {
        const l = i < n ? lights[i] : playerLight;
        if (!l) break;
        const x = (l.x - cam.x) * sx, y = (l.y - cam.y) * sy, r = l.r * sx;
        if (x < -r || y < -r || x > lc.width + r || y > lc.height + r) continue;
        L.globalAlpha = Math.min(1, l.a * 1.4);
        L.drawImage(hole, x - r, y - r, r * 2, r * 2);
      }
      L.globalAlpha = 1;
      ctx.drawImage(lc, 0, 0, vw, vh);
      if (!full) return;
      // additive glows, drawn only where lights are (no full-screen buffer)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const l = lights[i];
        if (l.a < 0.12) continue;
        const x = l.x - cam.x, y = l.y - cam.y, r = l.r * 0.8;
        if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
        ctx.globalAlpha = Math.min(1, l.a * 0.32); ctx.drawImage(glowSprite(l.color), x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
  }

  // Cached radial glow sprites per colour (cheaper than building gradients every frame).
  const glowCache = {};
  function glowSprite(color) {
    let c = glowCache[color];
    if (c) return c;
    c = BW.makeCanvas(128, 128);
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, BW.rgba(color, 1)); g.addColorStop(0.4, BW.rgba(color, 0.45)); g.addColorStop(1, BW.rgba(color, 0));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    glowCache[color] = c;
    return c;
  }
  BW.glowSprite = glowSprite;

  BW.Background = Background;
})(window.BW);

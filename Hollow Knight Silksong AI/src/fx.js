'use strict';
// Particles, needle slash arcs, rings, afterimages, screen shake and flashes.
(function (BW) {
  const MAX_PARTS = 700;

  class FX {
    constructor() { this.reset(); }
    reset() {
      this.parts = []; this.slashes = []; this.rings = []; this.ghosts = []; this.threads = [];
      this.shakeT = 0; this.shakeA = 0; this.shakeX = 0; this.shakeY = 0;
      this.flashA = 0; this.flashColor = '#ffffff';
    }

    spawn(p) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      p.life = p.life || 0.6; p.t = 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.size = p.size || 3;
      p.grav = p.grav || 0; p.drag = p.drag != null ? p.drag : 1.5; p.color = p.color || '#fff'; p.kind = p.kind || 'dot';
      p.rot = p.rot || 0; p.vr = p.vr || 0; p.shrink = p.shrink != null ? p.shrink : 1;
      this.parts.push(p);
      return p;
    }

    burst(x, y, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = (o.angle != null ? o.angle : 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2);
        const sp = BW.rand(o.speedMin || 60, o.speed || 260);
        this.spawn({
          x: x + BW.rand(-(o.jitter || 0), o.jitter || 0), y: y + BW.rand(-(o.jitter || 0), o.jitter || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: BW.rand((o.life || 0.6) * 0.6, o.life || 0.6),
          size: BW.rand((o.size || 3) * 0.6, o.size || 3), color: Array.isArray(o.color) ? BW.pick(o.color) : (o.color || '#fff'),
          grav: o.grav || 0, drag: o.drag != null ? o.drag : 2, kind: o.kind || 'dot', add: o.add, vr: BW.rand(-8, 8),
        });
      }
    }

    // A needle arc. dir: 'side' | 'up' | 'down'; facing: 1 / -1
    slash(x, y, dir, facing, o = {}) {
      this.slashes.push({ x, y, dir, facing, t: 0, life: o.life || 0.14, r: o.r || 62, w: o.w || 22, color: o.color || '#f4fbff', edge: o.edge || '#8fd7ff', big: !!o.big });
    }

    ring(x, y, r0, r1, life, color, width = 3) { this.rings.push({ x, y, r0, r1, life, t: 0, color, width }); }

    ghost(spriteName, frame, x, y, flip, color, life = 0.25, scale = 1) {
      this.ghosts.push({ spriteName, frame, x, y, flip, color, life, t: 0, scale });
    }

    thread(x0, y0, x1, y1, life = 0.35, color = '#ffe7b5') { this.threads.push({ x0, y0, x1, y1, life, t: 0, color }); }

    shake(a, t) { if (BW.settings && BW.settings.shake === false) return; this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
    flash(color, a) { this.flashColor = color; this.flashA = Math.max(this.flashA, a); }

    update(dt) {
      for (const p of this.parts) {
        p.t += dt;
        p.vy += p.grav * dt;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      this.parts = this.parts.filter((p) => p.t < p.life);
      for (const s of this.slashes) s.t += dt;
      this.slashes = this.slashes.filter((s) => s.t < s.life);
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < r.life);
      for (const g of this.ghosts) g.t += dt;
      this.ghosts = this.ghosts.filter((g) => g.t < g.life);
      for (const th of this.threads) th.t += dt;
      this.threads = this.threads.filter((th) => th.t < th.life);
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const a = this.shakeA * Math.min(1, this.shakeT * 6);
        this.shakeX = (Math.random() * 2 - 1) * a; this.shakeY = (Math.random() * 2 - 1) * a;
        if (this.shakeT <= 0) { this.shakeA = 0; this.shakeX = 0; this.shakeY = 0; }
      }
      this.flashA = Math.max(0, this.flashA - dt * 3.2);
    }

    drawGhosts(ctx) {
      for (const g of this.ghosts) {
        const k = 1 - g.t / g.life;
        ctx.save();
        ctx.globalAlpha = 0.45 * k;
        if (!BW.Assets.draw(ctx, g.spriteName, g.frame, g.x, g.y, { flip: g.flip, flash: 0.75, scale: g.scale })) {
          ctx.fillStyle = g.color; ctx.fillRect(g.x - 12, g.y - 52, 24, 52);
        }
        ctx.restore();
      }
    }

    draw(ctx) {
      // threads (silk lines)
      for (const th of this.threads) {
        const k = 1 - th.t / th.life;
        ctx.strokeStyle = BW.rgba(th.color, 0.8 * k); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(th.x0, th.y0);
        const mx = (th.x0 + th.x1) / 2, my = (th.y0 + th.y1) / 2 + 10 * k;
        ctx.quadraticCurveTo(mx, my, th.x1, th.y1); ctx.stroke();
      }
      // normal particles
      for (const p of this.parts) {
        if (p.add) continue;
        this.drawPart(ctx, p);
      }
      // slashes
      for (const s of this.slashes) this.drawSlash(ctx, s);
      // rings
      for (const r of this.rings) {
        const k = r.t / r.life;
        ctx.strokeStyle = BW.rgba(r.color, 1 - k); ctx.lineWidth = r.width * (1 - k * 0.6);
        ctx.beginPath(); ctx.arc(r.x, r.y, BW.lerp(r.r0, r.r1, BW.easeOutCubic(k)), 0, Math.PI * 2); ctx.stroke();
      }
    }

    drawAdditive(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.parts) if (p.add) this.drawPart(ctx, p);
      ctx.restore();
    }

    drawPart(ctx, p) {
      const k = 1 - p.t / p.life;
      const sz = p.size * (p.shrink ? (0.3 + 0.7 * k) : 1);
      ctx.globalAlpha = Math.min(1, k * 1.6) * (p.alpha != null ? p.alpha : 1);
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color; ctx.lineWidth = sz * 0.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.kind === 'leaf' || p.kind === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (p.kind === 'glow') {
        if (p.color[0] === '#' && BW.glowSprite) ctx.drawImage(BW.glowSprite(p.color), p.x - sz, p.y - sz, sz * 2, sz * 2);
        else { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill(); }
      } else if (p.kind === 'thread') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawSlash(ctx, s) {
      const k = s.t / s.life;
      const a = 1 - k;
      ctx.save();
      ctx.translate(s.x, s.y);
      let base = 0;
      if (s.dir === 'side') base = s.facing > 0 ? 0 : Math.PI;
      else if (s.dir === 'up') base = -Math.PI / 2;
      else base = Math.PI / 2;
      ctx.rotate(base);
      if (s.dir !== 'side' && s.facing < 0) ctx.scale(1, -1);
      const sweep = 1.9;
      const prog = BW.easeOutCubic(Math.min(1, k * 2.2));
      const a0 = -sweep / 2 - 0.25, a1 = a0 + sweep * prog + 0.25;
      const R = s.r * (0.92 + 0.12 * prog), w = s.w * (1 - k * 0.5);
      // outer glow
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = BW.rgba(s.edge, 0.35 * a);
      crescent(ctx, R + 6, w + 10, a0, a1);
      ctx.fillStyle = BW.rgba(s.color, 0.95 * a);
      crescent(ctx, R, w, a0, a1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    drawFlash(ctx, w, h) {
      if (this.flashA <= 0) return;
      ctx.fillStyle = BW.rgba(this.flashColor, this.flashA);
      ctx.fillRect(0, 0, w, h);
    }
  }

  // A crescent between two arcs whose thickness tapers at both ends.
  function crescent(ctx, R, w, a0, a1) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, ang = a0 + (a1 - a0) * t;
      ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n, ang = a0 + (a1 - a0) * t;
      const th = w * Math.sin(Math.PI * Math.min(1, t * 1.1));
      ctx.lineTo(Math.cos(ang) * (R - th), Math.sin(ang) * (R - th));
    }
    ctx.closePath(); ctx.fill();
  }

  BW.FX = FX;
})(window.BW);

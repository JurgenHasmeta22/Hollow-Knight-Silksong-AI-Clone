'use strict';
// Stage 2: the Bellbound Warden, guardian of the Great Bell, and the hazards its attacks leave behind.
// Every attack has an anticipation pose with a sound and light cue, an active window and a recovery
// window that can be punished or used to heal. Below half health the same attacks are modified.
(function (BW) {
  const T = BW.T;

  // [phase one, phase two] pairs. Times in seconds, speeds in px/s. hitMult scales every hit the Warden
  // takes (needle and Silk Lance). The peal keeps its speed: jump + Silk Dash is tuned to clear it, and a
  // slower wave takes longer to cross, so slowing it would make it harder, not easier.
  const TUNE = {
    hp: 72, phaseAt: 36, hitMult: 2,
    walk: [115, 135], think: [[0.6, 0.95], [0.42, 0.7]],
    sweep: { wind: [0.56, 0.52], active: 0.17, rec: [0.72, 0.6], reach: 235, rewind: 0.38 },
    slam: { wind: [0.74, 0.68], rec: [1.0, 0.86], wave: [560, 600] },
    leap: { crouch: [0.46, 0.38], air: [0.9, 0.84], height: [300, 330], rec: [0.62, 0.5] },
    charge: { wind: [0.64, 0.6], speed: [860, 920], stun: [1.15, 1.0] },
    peal: { wind: [1.0, 0.96], speed: [400, 420], len: [440, 440], h: 50, rec: [0.95, 0.78] },
    rain: { tele: 1.1, col: 64, open: 4 },
    poise: [16, 14], stagger: 1.5,
  };
  BW.WARDEN_TUNE = TUNE;
  BW.PEAL_TEACH = { speed: 340, len: 420, h: 46 };   // the vestibule's practice toll

  const BAGS = [
    ['sweep', 'slam', 'leap', 'charge', 'peal', 'slam', 'sweep', 'leap'],
    ['sweep', 'slam', 'leap', 'charge', 'peal', 'rain', 'slam', 'peal', 'leap'],
  ];
  const STAGGERABLE = { idle: 1, walk: 1, sweep_wind: 1, slam_wind: 1, sweep_rec: 1, slam_rec: 1, leap_rec: 1, peal_wind: 1, peal_rec: 1, rain_rec: 1 };
  // telegraph glint positions on the clapper head (facing right, relative to the feet centre)
  const GLINT = { raise: [-100, -332], swingback: [-104, -258] };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  class Warden extends BW.Enemy {
    constructor(game, def) {
      super(game, def, { w: 110, h: 230, hp: TUNE.hp, glints: 0, kb: 0, fixedHp: true });
      const a = game.room.def.arena || { x0: 1, x1: 40, floor: 21 };
      this.ax0 = a.x0 * T; this.ax1 = (a.x1 + 1) * T; this.floorY = a.floor * T;
      this.boss = true; this.facing = def.facing || 1;
      this.phase = 1; this.poise = 0; this.bag = []; this.lastAtk = null; this.combo = 0;
      this.pose = 'bound'; this.heat = 0; this.eye = 0; this.chip = this.hp; this.chipT = 0;
      this.invuln = true; this.harmful = false; this.active = false; this.wait = 0;
      this.walkDist = 0; this.stepT = 0; this.ev = {}; this.glint = 0; this.marker = null; this.leap = null;
      this.cords = [[-34, -196], [8, -212], [42, -150], [-46, -118], [24, -92]].map(([ox, oy]) => ({ ox, oy, snap: -1 }));
      game.boss = this;
      if (game.state.flags.warden_defeated) { this.state = 'remains'; this.pose = 'fallen'; this.hp = 0; this.chip = 0; for (const c of this.cords) c.snap = 9; }
      else this.state = 'bound';
    }

    // ---------------------------------------------------------------- boxes
    hurtbox() {
      if (this.state === 'remains') return { x: -9999, y: -9999, w: 0, h: 0 };
      const f = this.y + this.h, c = this.cx;
      switch (this.pose) {
        case 'charge': return { x: c - 82, y: f - 140, w: 164, h: 140 };
        case 'crouch': return { x: c - 66, y: f - 168, w: 132, h: 168 };
        case 'slam': return { x: c - 62, y: f - 172, w: 124, h: 172 };
        case 'fallen': case 'bound': return { x: c - 60, y: f - 190, w: 120, h: 190 };
        case 'leap': return { x: c - 56, y: f - 205, w: 112, h: 205 };
        default: return { x: c - 50, y: f - 226, w: 100, h: 226 };
      }
    }
    attackBoxes() {
      const f = this.y + this.h, c = this.cx, d = this.facing, s = this.state, t = this.stateT;
      if (s === 'sweep') { const r = TUNE.sweep.reach; return [{ x: d > 0 ? c + 10 : c - 10 - r, y: f - 145, w: r, h: 130 }]; }
      if (s === 'slam' && t < 0.12) return [{ x: d > 0 ? c + 55 : c - 55 - 165, y: f - 130, w: 165, h: 130 }];
      if (s === 'leap_land' && t < 0.12) return [{ x: c - 120, y: f - 120, w: 240, h: 120 }];
      return null;
    }

    // The weight of the blow the Warden is dealing: crushing moves outweigh a graze
    isStriking() { const s = this.state; return s === 'sweep' || s === 'slam' || s === 'leap_land' || s === 'charge'; }
    hitWeight() {
      const W = BW.Difficulty.WEIGHTS.warden, s = this.state;
      const w = s === 'sweep' ? W.sweep : s === 'slam' ? W.slam : s === 'leap_land' ? W.leap_land : s === 'charge' ? W.charge : W.body;
      return w * BW.Difficulty.get(this.game.state).bossDmg;
    }

    // ---------------------------------------------------------------- damage
    damage(n, dir, src) {
      if (this.dead || this.state === 'remains') return null;
      const g = this.game;
      if (this.invuln || this.state === 'dying') {
        this.flash = 0.2; BW.Audio.play('clink', { vary: 0.08, vol: 0.7 });
        g.fx.burst(this.cx + (src ? BW.sign(src.cx - this.cx) * 40 : 0), this.cy - 30, 8, { color: ['#ffffff', '#ffe9a8'], kind: 'spark', speed: 380, life: 0.22 });
        return 'blocked';
      }
      n *= TUNE.hitMult / BW.Difficulty.get(g.state).bossHp;
      if (this.dodged > 0) n *= 1.6;
      this.hp -= n; this.flash = 0.55; this.poise += n; this.chipT = 0.45;
      this.sx = 0.97; this.sy = 1.025;
      if (++this.hitCount % 4 === 0) BW.Audio.play('bellfar', { pitch: BW.pick([110, 131, 147, 165]), vol: 0.7, minGap: 0.1 });
      if (this.phase === 1 && this.hp <= TUNE.phaseAt) { this.hp = TUNE.phaseAt; this.startTransition(); return 'hit'; }
      if (this.hp <= 0) { this.hp = 0; this.die(); return 'kill'; }
      if (this.poise >= TUNE.poise[this.phase - 1] && STAGGERABLE[this.state]) this.startStagger();
      return 'hit';
    }

    // A parry cracks the Warden's poise and cuts the blow short.
    onParried(p) {
      if (this.dead || this.invuln) return;
      const g = this.game;
      this.flash = 0.6; this.poise += 9;
      const rec = { sweep: 'sweep_rec', slam: 'slam_rec', leap_land: 'leap_rec' }[this.state];
      if (rec) { this.setState(rec); this.vx = 0; this.combo = 1; }
      if (this.poise >= TUNE.poise[this.phase - 1] && (STAGGERABLE[this.state] || rec)) this.startStagger();
      g.fx.shake(8, 0.25);
      g.fx.burst(this.cx + BW.sign(p.cx - this.cx) * 50, this.cy - 40, 14, { color: ['#ffffff', '#ffe9a8'], kind: 'spark', speed: 420, life: 0.3, add: true });
    }

    // The player slipped a blow with a perfectly timed dash (Shadow Step): the Warden loses its footing for a counter.
    onDodged(p) {
      if (this.dead || this.invuln) return;
      this.dodged = 1.6; this.flash = 0.5; this.poise += 6;
      const rec = { sweep: 'sweep_rec', slam: 'slam_rec', leap_land: 'leap_rec' }[this.state];
      if (rec) { this.setState(rec); this.vx = 0; this.combo = 1; }
      else if (this.state === 'charge') { this.vx = 0; this.setState('charge_hit'); this.pose = 'stagger'; this.sx = 0.9; }
      if (this.poise >= TUNE.poise[this.phase - 1] && (STAGGERABLE[this.state] || rec)) this.startStagger();
      this.game.fx.shake(6, 0.2);
    }

    // ---------------------------------------------------------------- scripted moments
    snapCord(i) {
      const c = this.cords[i]; if (!c || c.snap >= 0) return;
      c.snap = 0;
      const p = this.cordPoint(c);
      this.game.fx.burst(p.x, p.y, 10, { color: ['#efe6d2', '#fff8e8'], kind: 'thread', speed: 260, life: 0.5, add: true });
      BW.Audio.play('clink', { rate: 0.7 + i * 0.08, vol: 0.6, minGap: 0 });
    }
    snapAllCords() { for (let i = 0; i < this.cords.length; i++) this.snapCord(i); }
    // the intro wakes it; on retries the whole thing takes a moment
    rise() { this.state = 'rise'; this.stateT = 0; this.pose = 'roar'; this.eye = 1; this.snapAllCords(); this.sy = 0.92; }
    begin() {
      this.active = true; this.invuln = false; this.harmful = true;
      this.toIdle(0.45);
    }
    startTransition() {
      const g = this.game;
      this.phase = 2; this.invuln = true; this.harmful = false; this.vx = 0; this.marker = null; this.glint = 0;
      this.setState('transition'); this.ev = {};
      g.hitstop(0.14); g.fx.shake(10, 0.5); g.fx.flash('#ffffff', 0.45);
      BW.Audio.play('boss_crack'); BW.Audio.duckMusic(0.25, 2.4);
      const e = this.eyePos();
      g.fx.burst(e.x, e.y, 26, { color: ['#f4ead6', '#d8ccb4', '#fff6e4'], kind: 'shard', speed: 360, life: 0.9, grav: 900, size: 5 });
      g.fx.burst(e.x, e.y, 16, { color: ['#ff8a3c', '#ffd27a'], kind: 'glow', speed: 140, life: 0.7, add: true, size: 12 });
    }
    startStagger() {
      this.poise = 0; this.vx = 0; this.marker = null; this.glint = 0; this.harmful = false;
      this.setState('stagger');
      this.game.fx.shake(6, 0.3); BW.Audio.play('boss_crack', { vol: 0.55, rate: 1.3 });
      this.game.fx.burst(this.cx, this.y + 60, 14, { color: ['#ffe9c0', '#ffb35a'], kind: 'spark', speed: 300, life: 0.4 });
    }
    die() {
      const g = this.game;
      this.state = 'dying'; this.stateT = 0; this.ev = {}; this.invuln = true; this.harmful = false; this.active = false;
      this.vx = 0; this.marker = null; this.glint = 0;
      g.hazards = g.hazards.filter((h) => h instanceof Debris === false || h.t >= h.delay);
      g.onWardenDefeated(this);
    }
    toIdle(wait) { this.setState('idle'); this.pose = 'idle'; this.vx = 0; this.wait = wait != null ? wait : BW.rand(...TUNE.think[this.phase - 1]); this.harmful = this.active; }

    // ---------------------------------------------------------------- decisions
    face() { const d = BW.sign(this.game.player.cx - this.cx); if (d) this.facing = d; }
    pdist() { return Math.abs(this.game.player.cx - this.cx); }
    suits(a, d) {
      switch (a) {
        case 'sweep': return d < 430;
        case 'slam': return d < 520;
        case 'leap': return d > 170;
        case 'charge': return d > 280;
        case 'peal': return d > 300;
        default: return true;
      }
    }
    chooseAttack() {
      const d = this.pdist(), ph = this.phase - 1;
      if (!this.bag.length) this.bag = shuffle(BAGS[ph].slice());
      let i = this.bag.findIndex((a) => a !== this.lastAtk && this.suits(a, d));
      if (i < 0) i = this.bag.findIndex((a) => a !== this.lastAtk);
      if (i < 0) i = 0;
      const a = this.bag.splice(i, 1)[0];
      this.lastAtk = a; this.combo = 0;
      this.face();
      if ((a === 'sweep' && d > 200) || (a === 'slam' && d > 300)) { this.pending = a; this.walkTo = a === 'sweep' ? 175 : 250; this.setState('walk'); return; }
      this.startAttack(a);
    }
    startAttack(a) {
      const ph = this.phase - 1, g = this.game;
      this.face(); this.vx = 0;
      g.codexMove('warden', a);
      switch (a) {
        case 'sweep': this.setState('sweep_wind'); this.pose = 'swingback'; this.glint = 1; BW.Audio.play('windup', { rate: 0.7, vol: 0.9 }); break;
        case 'slam': this.setState('slam_wind'); this.pose = 'raise'; this.glint = 1; BW.Audio.play('windup', { rate: 0.5, vol: 1 }); BW.Audio.play('clink', { rate: 0.5, vol: 0.35 }); break;
        case 'leap': this.setState('leap_crouch'); this.pose = 'crouch'; this.sy = 0.94; BW.Audio.play('windup', { rate: 0.55, vol: 0.9 }); break;
        case 'charge': this.setState('charge_wind'); this.pose = 'crouch'; this.eye = 1.4; BW.Audio.play('boss_charge', { vol: 0.9 }); break;
        case 'peal':
          this.setState('peal_wind'); this.pose = 'roar'; this.ev = {};
          BW.Audio.play('bell', { pitch: 65.4, vol: 0.9, minGap: 0 }); BW.Audio.play('boss_roar', { vol: 0.55, rate: 1.15 });
          if (BW.settings.hints !== false && (g.state.stats.pealHints || 0) < 3) { g.pealHint = 2.4; g.state.stats.pealHints = (g.state.stats.pealHints || 0) + 1; }
          break;
        case 'rain':
          this.setState('rain_wind'); this.pose = 'roar';
          BW.Audio.play('boss_roar', { vol: 0.7, rate: 1.25 }); BW.Audio.play('silk_volley', { vol: 0.5, rate: 0.8 });
          g.spawnHazard(new ThreadRain(g, this.ax0 + 8, this.ax1 - 8, this.floorY, g.player.cx, TUNE.rain));
          break;
      }
      void ph;
    }

    // ---------------------------------------------------------------- behaviour
    think(dt) {
      const g = this.game, p = g.player, s = this.state, t = this.stateT, ph = this.phase - 1;
      this.heat = BW.approach(this.heat, this.phase === 2 && s !== 'remains' ? 1 : 0, dt * 0.7);
      this.eye = BW.damp(this.eye, s === 'remains' || s === 'bound' ? 0 : (s === 'dying' ? Math.max(0, 1 - t / 3.5) : 1), 4, dt);
      this.glint = Math.max(0, this.glint - dt * 1.4);
      if (this.dodged > 0) this.dodged -= dt;
      if (this.chip > this.hp) { this.chipT -= dt; if (this.chipT <= 0) this.chip = Math.max(this.hp, this.chip - dt * 26); } else this.chip = this.hp;
      for (const c of this.cords) if (c.snap >= 0) c.snap += dt;
      if (this.heat > 0.3 && Math.random() < dt * 14 && s !== 'remains') {
        g.fx.spawn({ x: this.cx + BW.rand(-50, 50), y: this.y + BW.rand(30, 200), vx: BW.rand(-20, 20), vy: BW.rand(-90, -40), life: BW.rand(0.6, 1.2), size: BW.rand(1.5, 3), color: BW.pick(['#ff9a3c', '#ffd27a', '#ff6a24']), kind: 'glow', add: true, drag: 0.5 });
      }
      switch (s) {
        case 'bound': case 'remains': this.vx = 0; return;
        case 'rise':
          this.vx = 0;
          if (t > 0.55) this.pose = 'idle';
          return;
        case 'idle':
          this.pose = 'idle'; this.vx = 0;
          if (t > 0.15) this.face();
          if (this.active && t >= this.wait && p.state !== 'dead') this.chooseAttack();
          return;
        case 'walk': {
          this.face(); this.pose = 'walk';
          this.vx = this.facing * TUNE.walk[ph];
          this.walkDist += Math.abs(this.vx) * dt;
          this.stepT -= dt;
          if (this.stepT <= 0) { this.stepT = 0.5; BW.Audio.play('boss_step', { vol: 0.55, vary: 0.1 }); g.fx.shake(2, 0.08); g.fx.burst(this.cx, this.floorY, 5, { color: [g.room.area.moss, '#888'], speed: 80, angle: -Math.PI / 2, spread: 2.4, life: 0.4, grav: 300, size: 2.5 }); }
          if (this.pdist() < this.walkTo || t > 1.4 || this.nearWall(this.facing, 30)) { this.vx = 0; this.startAttack(this.pending); }
          return;
        }
        // ---- sweep: clapper drawn back, then a wide horizontal swing (twice in phase two)
        case 'sweep_wind': {
          this.vx = 0; this.sx = BW.damp(this.sx, 0.96, 6, dt);
          const wind = this.combo ? TUNE.sweep.rewind : TUNE.sweep.wind[ph];
          if (t >= wind) {
            this.setState('sweep'); this.pose = 'swing'; this.vx = this.facing * 440;
            BW.Audio.play('boss_sweep', { vary: 0.06 }); g.fx.shake(5, 0.15);
            g.fx.slash(this.cx + this.facing * 60, this.y + this.h - 95, 'side', this.facing, { r: 170, w: 52, life: 0.24, color: '#fff3dc', edge: '#ffb35a' });
          }
          return;
        }
        case 'sweep':
          if (t > 0.1) this.vx = 0;
          if (t >= TUNE.sweep.active) { this.setState('sweep_rec'); this.vx = 0; }
          return;
        case 'sweep_rec':
          this.vx = 0;
          if (t > TUNE.sweep.rec[ph] * 0.55) this.pose = 'idle';
          if (this.phase === 2 && !this.combo && t >= 0.34) { this.combo = 1; this.face(); this.setState('sweep_wind'); this.pose = 'swingback'; this.glint = 1; BW.Audio.play('windup', { rate: 0.8, vol: 0.8 }); return; }
          if (t >= TUNE.sweep.rec[ph]) this.toIdle();
          return;
        // ---- slam: overhead blow; a shockwave runs along the floor (both ways in phase two, with falling debris)
        case 'slam_wind':
          this.vx = 0; this.sy = BW.damp(this.sy, 1.03, 5, dt);
          if (t >= TUNE.slam.wind[ph]) { this.setState('slam'); this.pose = 'slam'; this.slamImpact(); }
          return;
        case 'slam':
          if (t >= 0.12) this.setState('slam_rec');
          return;
        case 'slam_rec':
          if (t >= TUNE.slam.rec[ph]) this.toIdle();
          return;
        // ---- leap: crouch, a high arc toward the player's spot (marked on the floor), crushing landing
        case 'leap_crouch':
          this.vx = 0; this.sy = BW.damp(this.sy, 0.9, 8, dt);
          if (t >= (this.combo ? 0.29 : TUNE.leap.crouch[ph])) this.startLeap();
          return;
        case 'leap_air': {
          const L = this.leap, u = Math.min(1, t / L.T);
          if (this.phase === 2 && u < 0.4) { L.tx = BW.clamp(p.cx, this.ax0 + 80, this.ax1 - 80); this.marker.x = L.tx; }
          const nx = BW.lerp(L.x0, L.tx, u), arc = 4 * u * (1 - u);
          this.x = nx - this.w / 2; this.y = this.floorY - this.h - L.H * arc;
          this.facing = L.tx >= L.x0 ? 1 : -1;
          if (u >= 1) this.landLeap();
          return;
        }
        case 'leap_land':
          if (t >= 0.14) this.setState('leap_rec');
          return;
        case 'leap_rec':
          if (t > 0.2) this.pose = 'idle';
          if (this.phase === 2 && !this.combo && t >= 0.26) { this.combo = 1; this.face(); this.setState('leap_crouch'); this.pose = 'crouch'; BW.Audio.play('windup', { rate: 0.6, vol: 0.8 }); return; }
          if (t >= TUNE.leap.rec[ph]) this.toIdle();
          return;
        // ---- charge: lowered bell-ram across the arena until it hits the wall and reels
        case 'charge_wind':
          this.vx = 0;
          if (Math.random() < dt * 30) g.fx.burst(this.cx - this.facing * 40, this.floorY, 2, { color: [g.room.area.moss, '#999'], speed: 160, angle: -Math.PI / 2 - this.facing * 0.8, spread: 0.8, life: 0.4, grav: 500, size: 3 });
          if (t >= TUNE.charge.wind[ph]) { this.setState('charge'); this.pose = 'charge'; }
          return;
        case 'charge':
          this.vx = this.facing * TUNE.charge.speed[ph];
          if (Math.random() < dt * 40) g.fx.burst(this.cx - this.facing * 60, this.floorY, 2, { color: ['#c9c2b0', '#888'], speed: 120, angle: -Math.PI / 2 - this.facing, spread: 0.8, life: 0.35, grav: 400, size: 3 });
          if (this.nearWall(this.facing, 6) || t > 2.6) this.chargeImpact();
          return;
        case 'charge_hit':
          this.vx = 0;
          if (t >= TUNE.charge.stun[ph]) { this.face(); this.toIdle(0.2); }
          return;
        // ---- peal: it rings its own bell-body; a long wave of resonance rolls along the floor (jump + dash over it)
        case 'peal_wind': {
          this.vx = 0;
          if (!this.ev.r1 && t > 0.2) { this.ev.r1 = 1; g.fx.ring(this.cx, this.y + 120, 20, 260, 0.6, '#ffe2a8', 4); }
          if (!this.ev.r2 && t > 0.55) { this.ev.r2 = 1; g.fx.ring(this.cx, this.y + 120, 20, 300, 0.6, '#ffe2a8', 4); }
          if (t >= TUNE.peal.wind[ph]) {
            this.setState('peal'); g.fx.shake(8, 0.4); g.fx.flash('#ffe7c4', 0.15);
            BW.Audio.play('boss_wave'); BW.Audio.play('bell', { pitch: 98, vol: 1, minGap: 0 });
            g.spawnHazard(new PealWave(g, this.cx + this.facing * 70, this.floorY, this.facing, { speed: TUNE.peal.speed[ph], len: TUNE.peal.len[ph], h: TUNE.peal.h, echo: this.phase === 2 }));
          }
          return;
        }
        case 'peal':
          if (t >= 0.35) this.setState('peal_rec');
          return;
        case 'peal_rec':
          this.pose = t < 0.3 ? 'roar' : 'idle';
          if (t >= TUNE.peal.rec[ph]) this.toIdle();
          return;
        // ---- thread rain (phase two): silk spears fall everywhere except one marked opening
        case 'rain_wind':
          this.vx = 0;
          if (t >= 0.5) this.setState('rain_rec');
          return;
        case 'rain_rec':
          this.pose = t < 0.9 ? 'roar' : 'idle';
          if (t >= 2.0) this.toIdle(0.35);
          return;
        case 'stagger':
          this.vx = 0; this.pose = t < TUNE.stagger * 0.7 ? 'stagger' : 'idle';
          if (t >= TUNE.stagger) { this.face(); this.toIdle(0.15); }
          return;
        case 'transition': {
          this.vx = t < 0.7 ? -this.facing * 60 : 0;
          this.pose = t < 0.9 ? 'stagger' : t < 1.5 ? 'crouch' : 'roar';
          if (!this.ev.roar && t >= 1.5) {
            this.ev.roar = 1;
            BW.Audio.play('boss_roar'); BW.Audio.play('bell', { pitch: 73.4, vol: 1, minGap: 0 }); BW.Audio.playMusic('mus_boss2', 0.6);
            g.fx.shake(14, 1.0); g.fx.flash('#ff9a5a', 0.35);
            for (let i = 0; i < 3; i++) g.fx.ring(this.cx, this.y + 100, 20, 500 + i * 160, 0.9 + i * 0.2, '#ffb36a', 5 - i);
            const dx = p.cx - this.cx;
            if (Math.abs(dx) < 280 && p.state !== 'dead') { p.vx = BW.sign(dx || 1) * 520; p.vy = -300; p.onGround = false; p.recoilT = 0.25; }
            g.fx.burst(this.cx, this.y + 80, 40, { color: ['#ff9a3c', '#ffd27a', '#ff6a24'], kind: 'glow', speed: 320, life: 1, add: true, size: 8 });
          }
          if (t >= 3.0) { this.invuln = false; this.face(); this.toIdle(0.25); }
          return;
        }
        case 'dying': {
          this.vx = t < 0.8 ? -this.facing * 50 : 0;
          this.pose = t < 0.9 ? 'stagger' : t < 1.8 ? 'roar' : 'fallen';
          if (!this.ev.weak && t >= 0.9) { this.ev.weak = 1; BW.Audio.play('boss_roar', { rate: 0.75, vol: 0.8 }); g.fx.ring(this.cx, this.y + 100, 20, 320, 0.9, '#ffe2a8', 3); }
          if (!this.ev.fall && t >= 1.8) {
            this.ev.fall = 1;
            BW.Audio.play('boss_death'); g.fx.shake(16, 0.8); g.fx.flash('#ffffff', 0.3);
            g.fx.burst(this.cx, this.floorY, 40, { color: ['#c9c2b0', '#8a8478', '#efe6d2'], speed: 380, angle: -Math.PI / 2, spread: 2.8, life: 1.1, grav: 900, size: 5 });
            const e = this.eyePos();
            g.fx.burst(e.x, e.y, 22, { color: ['#f4ead6', '#d8ccb4'], kind: 'shard', speed: 300, life: 1, grav: 900, size: 5 });
            g.spawnGlints(this.cx, this.y + 80, 60);
          }
          if (t >= 1.8 && t < 4.2 && Math.random() < dt * 40) {
            g.fx.spawn({ x: this.cx + BW.rand(-70, 70), y: this.y + BW.rand(40, 210), vx: BW.rand(-30, 30), vy: BW.rand(-160, -70), life: BW.rand(1, 1.8), size: 1.6, color: BW.pick(['#fff3d6', '#efe6d2', '#ffd27a']), kind: 'thread', add: true, drag: 0.3 });
          }
          if (t >= 4.4) this.state = 'remains';
          return;
        }
      }
    }

    nearWall(dir, margin) { return dir > 0 ? this.x + this.w >= this.ax1 - margin : this.x <= this.ax0 + margin; }

    slamImpact() {
      const g = this.game, ph = this.phase - 1;
      const ix = this.cx + this.facing * 150;
      BW.Audio.play('boss_slam'); g.fx.shake(12, 0.4); g.hitstop(0.04);
      g.fx.burst(ix, this.floorY, 26, { color: ['#c9c2b0', '#efe6d2', '#8a8478'], speed: 420, angle: -Math.PI / 2, spread: 2.4, life: 0.8, grav: 1100, size: 5 });
      g.fx.ring(ix, this.floorY - 10, 10, 160, 0.4, '#ffe2a8', 4);
      g.spawnHazard(new Shockwave(g, ix + this.facing * 30, this.floorY, this.facing, TUNE.slam.wave[ph]));
      if (this.phase === 2) {
        g.spawnHazard(new Shockwave(g, this.cx - this.facing * 70, this.floorY, -this.facing, TUNE.slam.wave[ph]));
        this.dropDebris(3, true);
      }
    }
    startLeap() {
      const g = this.game, ph = this.phase - 1, p = g.player;
      const tx = BW.clamp(p.cx, this.ax0 + 80, this.ax1 - 80);
      this.leap = { x0: this.cx, tx, T: TUNE.leap.air[ph] * (this.combo ? 0.85 : 1), H: TUNE.leap.height[ph] };
      this.marker = { x: tx, t: 0 };
      this.setState('leap_air'); this.pose = 'leap'; this.sy = 1.08; this.onGround = false;
      BW.Audio.play('dash', { rate: 0.45, vol: 0.9 }); g.fx.shake(4, 0.15);
      g.fx.burst(this.cx, this.floorY, 16, { color: [g.room.area.moss, '#999'], speed: 260, angle: -Math.PI / 2, spread: 2.2, life: 0.5, grav: 600, size: 4 });
    }
    landLeap() {
      const g = this.game;
      this.y = this.floorY - this.h; this.vy = 0; this.onGround = true; this.marker = null;
      this.setState('leap_land'); this.pose = 'slam'; this.sy = 0.88; this.sx = 1.08;
      BW.Audio.play('boss_slam', { rate: 1.1 }); g.fx.shake(13, 0.4);
      g.fx.burst(this.cx, this.floorY, 30, { color: ['#c9c2b0', '#efe6d2', '#8a8478'], speed: 420, angle: -Math.PI / 2, spread: 2.8, life: 0.8, grav: 1100, size: 5 });
      if (this.phase === 2) {
        g.spawnHazard(new Shockwave(g, this.cx + 80, this.floorY, 1, TUNE.slam.wave[1]));
        g.spawnHazard(new Shockwave(g, this.cx - 80, this.floorY, -1, TUNE.slam.wave[1]));
      }
    }
    chargeImpact() {
      const g = this.game;
      this.vx = 0; this.setState('charge_hit'); this.pose = 'stagger'; this.sx = 0.9;
      BW.Audio.play('boss_slam', { rate: 0.85 }); BW.Audio.play('debris', { vol: 0.8 }); g.fx.shake(15, 0.6);
      g.fx.burst(this.facing > 0 ? this.ax1 : this.ax0, this.floorY - 140, 30, { color: ['#c9c2b0', '#efe6d2', '#8a8478'], speed: 420, angle: this.facing > 0 ? Math.PI : 0, spread: 1.8, life: 0.9, grav: 1100, size: 5 });
      this.dropDebris(this.phase === 2 ? 4 : 2, this.phase === 2);
    }
    // debris shaken loose from the vault; in phase two one piece always targets the player
    dropDebris(n, aimed) {
      const g = this.game, p = g.player;
      const xs = [];
      if (aimed && p.state !== 'dead') xs.push(BW.clamp(p.cx + BW.rand(-30, 30), this.ax0 + 30, this.ax1 - 30));
      let guard = 0;
      while (xs.length < n && guard++ < 40) {
        const x = BW.rand(this.ax0 + 40, this.ax1 - 40);
        if (xs.every((o) => Math.abs(o - x) > 150) && Math.abs(x - this.cx) > 90) xs.push(x);
      }
      xs.forEach((x, i) => g.spawnHazard(new Debris(g, x, this.floorY, 0.75 + i * 0.12)));
    }

    physics(dt) { if (this.state === 'leap_air') return; super.physics(dt); }

    // ---------------------------------------------------------------- drawing
    frame() { const s = BW.Assets.sprite('warden_' + this.pose); return s ? { s, f: s.frames[0] } : null; }
    eyePos(x = this.cx, y = this.y + this.h) {
      const fr = this.frame();
      if (fr && fr.f.length > 6) { const sc = fr.s.scale; return { x: x + (fr.f[6] - fr.f[4]) * sc * this.facing, y: y + (fr.f[7] - fr.f[5]) * sc }; }
      return { x: x + this.facing * 30, y: y - 200 };
    }
    cordPoint(c, x = this.cx, y = this.y + this.h) { return { x: x + c.ox * this.facing, y: y + c.oy }; }

    draw(ctx, alpha) {
      const g = this.game, s = this.state;
      const x = BW.lerp(this.px, this.x, alpha) + this.w / 2;
      let y = BW.lerp(this.py, this.y, alpha) + this.h;
      // floor marker for the leap (drawn first, under everything)
      if (this.marker) {
        const m = this.marker, k = 0.6 + Math.sin(g.time * 18) * 0.25;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * k; ctx.drawImage(BW.glowSprite('#ff9a3c'), m.x - 130, this.floorY - 40, 260, 70);
        ctx.strokeStyle = `rgba(255,214,150,${0.7 * k})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(m.x, this.floorY - 3, 118, 12, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        g.addLight(m.x, this.floorY - 30, 160, '#ff9a3c', 0.35);
      }
      // the silk cords that bind it to the Great Bell
      const bell = g.objects.find((o) => o.type === 'greatbell');
      if (bell && s !== 'remains') {
        const an = bell.anchor();
        for (const c of this.cords) {
          if (c.snap > 1.0) continue;
          const pt = this.cordPoint(c, x, y);
          ctx.save();
          if (c.snap < 0) {
            ctx.strokeStyle = 'rgba(236,228,210,0.75)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.quadraticCurveTo((pt.x + an.x) / 2, Math.max(pt.y, an.y) + 30, an.x + c.ox * 0.5, an.y); ctx.stroke();
          } else {
            const k = c.snap, a = 1 - k;
            ctx.strokeStyle = `rgba(255,240,214,${0.8 * a})`; ctx.lineWidth = 2;
            const mx = (pt.x + an.x) / 2, my = (pt.y + an.y) / 2;
            ctx.beginPath(); ctx.moveTo(an.x + c.ox * 0.5, an.y); ctx.lineTo(BW.lerp(mx, an.x, k), BW.lerp(my, an.y, k) - 20 * k); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(BW.lerp(mx, pt.x, k * 0.7), BW.lerp(my, pt.y, k * 0.7) + 60 * k); ctx.stroke();
          }
          ctx.restore();
        }
      }
      // body
      let ox = 0, rot = 0, sy = this.sy * (s === 'idle' ? 1 + Math.sin(this.t * 2.1) * 0.012 : 1);
      if (s === 'walk') { const ph = this.walkDist / 75; y -= Math.abs(Math.sin(ph * Math.PI)) * 5; rot = Math.sin(ph * Math.PI) * 0.02 * this.facing; }
      if (s === 'charge_wind' || s === 'transition' && this.stateT < 1.5) ox = (Math.random() * 2 - 1) * 2.5;
      let pose = this.pose;
      if (s === 'walk') pose = Math.floor(this.walkDist / 75) % 2 ? 'walk' : 'idle';
      const name = 'warden_' + pose;
      const dim = s === 'remains' ? 0.78 : 1;
      ctx.save();
      if (dim < 1) ctx.globalAlpha = dim;
      const ok = BW.Assets.draw(ctx, name, 0, x + ox, y, { flip: this.facing < 0, sx: this.sx, sy, rot, flash: this.flash, rim: 0.34, variant: this.heat > 0.5 ? 'ember' : null });
      ctx.restore();
      if (s !== 'remains') g.addLight(x, y - 130, 250, this.heat > 0.5 ? '#ffc8a0' : '#cdd6ff', 0.3);   // keeps the dark bronze readable
      if (!ok) { ctx.fillStyle = this.flash > 0.3 ? '#fff' : '#2f4a44'; ctx.fillRect(x - this.w / 2, y - this.h, this.w, this.h); }
      // ember heat in phase two
      if (this.heat > 0.01 && s !== 'remains') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 * this.heat * (0.85 + Math.sin(this.t * 9) * 0.15);
        ctx.drawImage(BW.glowSprite('#ff6a24'), x - 140, y - 250, 280, 260); ctx.restore();
      }
      // eye (and the cracked mask's glow)
      if (this.eye > 0.02) {
        const e = this.eyePos(x, y), r = 26 + this.heat * 22 + (s === 'charge_wind' ? 14 : 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, this.eye);
        ctx.drawImage(BW.glowSprite(this.heat > 0.5 ? '#ff7a2a' : '#ff9a3c'), e.x - r, e.y - r, r * 2, r * 2);
        ctx.globalAlpha = Math.min(1, this.eye) * 0.9; ctx.drawImage(BW.glowSprite('#fff0d2'), e.x - 5, e.y - 5, 10, 10);
        ctx.restore();
        g.addLight(e.x, e.y, 90 + this.heat * 60, '#ff9a3c', 0.4 * Math.min(1, this.eye));
      }
      // telegraph glint on the raised clapper
      const gp = GLINT[this.pose];
      if (this.glint > 0 && gp) {
        const gx = x + gp[0] * this.facing, gy = y + gp[1], k = this.glint, r = 18 + (1 - k) * 30;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
        ctx.drawImage(BW.glowSprite('#ffe2a8'), gx - r * 2, gy - r * 2, r * 4, r * 4);
        ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(gx - r * 1.4, gy); ctx.lineTo(gx + r * 1.4, gy); ctx.moveTo(gx, gy - r * 1.4); ctx.lineTo(gx, gy + r * 1.4); ctx.stroke();
        ctx.restore();
        g.addLight(gx, gy, 120, '#ffe2a8', 0.5 * k);
      }
      // the bell-body hums while it gathers a peal
      if (s === 'peal_wind') {
        const k = Math.min(1, this.stateT / TUNE.peal.wind[this.phase - 1]);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const len = 80 + k * 520, x0 = x + this.facing * 60;
        const gr = ctx.createLinearGradient(x0, 0, x0 + this.facing * len, 0);
        gr.addColorStop(0, `rgba(255,226,168,${0.55 * k})`); gr.addColorStop(1, 'rgba(255,226,168,0)');
        ctx.fillStyle = gr; ctx.fillRect(Math.min(x0, x0 + this.facing * len), this.floorY - 8 - k * 10, len, 8 + k * 10);
        ctx.globalAlpha = 0.5 * k; ctx.drawImage(BW.glowSprite('#ffd27a'), x - 150, y - 170, 300, 200);
        ctx.restore();
        g.addLight(x, y - 80, 200, '#ffd27a', 0.5 * k);
      }
    }
  }

  // ==================================================================== hazards
  class Hazard {
    constructor(game) { this.game = game; this.t = 0; this.dead = false; this.dmg = 1; }
    boxes() { return null; }
    hitX(p) { return p.cx; }
    update(dt) { this.t += dt; }
    draw() {}
  }

  // A crest of broken stone and light running along the floor. Jump it.
  class Shockwave extends Hazard {
    constructor(game, x, floorY, dir, speed) { super(game); this.dmg = BW.Difficulty.WEIGHTS.warden.shockwave; this.x = x; this.fy = floorY; this.dir = dir; this.speed = speed; this.fade = null; }
    boxes() { return this.fade != null ? null : [{ x: this.x - 22, y: this.fy - 44, w: 44, h: 44 }]; }
    hitX(p) { return p.cx - this.dir * 10; }
    update(dt) {
      super.update(dt);
      if (this.fade != null) { this.fade -= dt; if (this.fade <= 0) this.dead = true; return; }
      this.x += this.dir * this.speed * dt;
      const room = this.game.room, front = this.x + this.dir * 24;
      if (room.solidPx(front, this.fy - 10) || !room.solidPx(front, this.fy + 10) || this.t > 3) {
        this.fade = 0.22;
        this.game.fx.burst(this.x, this.fy - 10, 10, { color: ['#efe6d2', '#ffd27a'], speed: 220, life: 0.4, kind: 'spark' });
      }
      if (Math.random() < dt * 50) this.game.fx.spawn({ x: this.x - this.dir * 10, y: this.fy - 2, vx: -this.dir * BW.rand(20, 90), vy: BW.rand(-200, -80), life: 0.4, size: 2.5, color: BW.pick(['#c9c2b0', '#8a8478']), grav: 700 });
    }
    draw(ctx) {
      const a = this.fade != null ? Math.max(0, this.fade / 0.22) : Math.min(1, this.t / 0.06);
      const x = this.x, y = this.fy, d = this.dir;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(BW.glowSprite('#ffb35a'), x - 60, y - 84, 120, 100);
      ctx.fillStyle = 'rgba(255,206,140,0.6)';
      ctx.beginPath(); ctx.moveTo(x - d * 36, y); ctx.quadraticCurveTo(x - d * 8, y - 62, x + d * 24, y - 52); ctx.quadraticCurveTo(x + d * 10, y - 24, x + d * 28, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,236,0.95)';
      ctx.beginPath(); ctx.moveTo(x - d * 14, y); ctx.quadraticCurveTo(x, y - 46, x + d * 19, y - 41); ctx.quadraticCurveTo(x + d * 8, y - 18, x + d * 19, y); ctx.closePath(); ctx.fill();
      ctx.restore();
      this.game.addLight(x, y - 24, 100, '#ffc27a', 0.45 * a);
    }
  }

  // The Warden's peal: a long, low band of resonance rolling along the floor. Too long to clear with a
  // jump alone; run at it, jump, and Silk Dash across. In phase two it echoes back once off the wall.
  class PealWave extends Hazard {
    constructor(game, x, floorY, dir, o) {
      super(game); this.dmg = BW.Difficulty.WEIGHTS.warden.peal;
      this.dir = dir; this.fy = floorY; this.speed = o.speed; this.len = o.len; this.h = o.h || 62; this.echo = !!o.echo;
      this.front = x; this.back = x; this.wall = false; this.vis = 0;
    }
    span() { return this.dir > 0 ? [this.back, this.front] : [this.front, this.back]; }
    boxes() {
      const [a, b] = this.span();
      if (b - a < 20) return null;
      return [{ x: a + 8, y: this.fy - this.h, w: b - a - 16, h: this.h }];
    }
    hitX(p) { return p.cx - this.dir * 10; }
    update(dt) {
      super.update(dt);
      const room = this.game.room, v = this.speed * dt;
      this.vis = Math.min(1, this.vis + dt * 5);
      if (!this.wall) {
        const nf = this.front + this.dir * v;
        if (room.solidPx(nf, this.fy - 10)) { this.wall = true; this.front = this.dir > 0 ? Math.floor(nf / T) * T : (Math.floor(nf / T) + 1) * T; }
        else this.front = nf;
      }
      if (this.wall || Math.abs(this.front - this.back) >= this.len) this.back += this.dir * v;
      if (this.wall && this.dir * (this.back - this.front) >= 0) {
        if (this.echo) {
          this.echo = false; this.dir *= -1; this.back = this.front; this.wall = false; this.speed *= 1.06;
          BW.Audio.play('bell', { pitch: 110, vol: 0.8, minGap: 0 }); BW.Audio.play('boss_wave', { vol: 0.7 });
          this.game.fx.ring(this.front, this.fy - 40, 10, 180, 0.5, '#ffe2a8', 4);
        } else this.dead = true;
      }
      if (Math.random() < dt * 40) {
        const [a, b] = this.span();
        this.game.fx.spawn({ x: BW.rand(a, b), y: this.fy - BW.rand(4, 30), vx: this.dir * BW.rand(40, 120), vy: BW.rand(-140, -60), life: BW.rand(0.4, 0.8), size: BW.rand(1.5, 3), color: BW.pick(['#fff1c8', '#ffd27a']), kind: 'glow', add: true, drag: 1 });
      }
    }
    draw(ctx) {
      const [a0, b0] = this.span(), L = b0 - a0;
      if (L < 2) return;
      const y = this.fy, H = this.h * 1.3 * this.vis;
      const n = Math.max(2, Math.ceil(L / 14)), top = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = a0 + L * u;
        const taper = Math.min(1, (u * L) / 46, ((1 - u) * L) / 46);
        const rip = 0.8 + 0.2 * Math.sin(x * 0.045 - this.t * 14 * this.dir);
        top.push([x, y - H * taper * rip]);
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, y - H, 0, y);
      gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(0.4, 'rgba(255,196,110,0.4)'); gr.addColorStop(1, 'rgba(255,238,196,0.8)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(a0, y);
      for (const [x, yy] of top) ctx.lineTo(x, yy);
      ctx.lineTo(b0, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,226,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath();
      top.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy))); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < L / 34; k++) {
        const x = a0 + ((((k * 34 + this.t * 150 * this.dir) % L) + L) % L);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + this.dir * 8, y - H * 0.55); ctx.stroke();
      }
      const fx = this.dir > 0 ? b0 : a0;
      ctx.drawImage(BW.glowSprite('#ffd27a'), fx - 70, y - 110, 140, 130);
      ctx.restore();
      for (let k = 0; k < 3; k++) this.game.addLight(a0 + L * (0.2 + k * 0.3), y - 30, 150, '#ffd27a', 0.45 * this.vis);
    }
  }

  // Phase two: silk spears rain from the vault in every column except a marked opening.
  class ThreadRain extends Hazard {
    constructor(game, x0, x1, floorY, playerX, o) {
      super(game); this.dmg = BW.Difficulty.WEIGHTS.warden.rain;
      this.fy = floorY; this.top = 2 * T + 6; this.tele = o.tele;
      const col = o.col, n = Math.floor((x1 - x0) / col);
      const mid = (x0 + x1) / 2, toMid = playerX < mid ? 1 : -1;
      let oc = playerX + toMid * BW.rand(200, 330);
      oc = BW.clamp(oc, x0 + col * (o.open / 2 + 0.5), x1 - col * (o.open / 2 + 0.5));
      const i0 = Math.round((oc - x0) / col - o.open / 2);
      this.openX = x0 + (i0 + o.open / 2) * col; this.openW = o.open * col;
      this.cols = [];
      for (let i = 0; i < n; i++) {
        if (i >= i0 && i < i0 + o.open) continue;
        const cx = x0 + (i + 0.5) * col;
        this.cols.push({ x: cx, y: this.top, delay: Math.abs(cx - this.openX) * 0.00022, phase: 'tele', vy: 0, life: 0 });
      }
    }
    boxes() {
      const out = [];
      for (const c of this.cols) if (c.phase === 'fall') out.push({ x: c.x - 20, y: c.y - 74, w: 40, h: 74 });
      return out.length ? out : null;
    }
    hitX(p) { return p.cx + (p.cx < this.openX ? -10 : 10); }
    // the needle can cut a falling spear (consistent with cutting silk globs)
    cut(box) {
      let any = false;
      for (const c of this.cols) {
        if (c.phase !== 'fall') continue;
        if (BW.overlap(box, { x: c.x - 20, y: c.y - 74, w: 40, h: 74 })) { c.phase = 'cut'; c.life = 0; any = true; this.game.fx.burst(c.x, c.y - 30, 10, { color: ['#fff3d6', '#ffffff'], kind: 'thread', speed: 260, life: 0.4, add: true }); }
      }
      return any;
    }
    update(dt) {
      super.update(dt);
      let alive = 0;
      for (const c of this.cols) {
        if (c.phase === 'tele') { if (this.t >= this.tele + c.delay) { c.phase = 'fall'; c.vy = 1700; } }
        else if (c.phase === 'fall') {
          c.y += c.vy * dt;
          if (c.y >= this.fy) { c.y = this.fy; c.phase = 'stuck'; c.life = 0; this.game.fx.burst(c.x, this.fy - 4, 4, { color: ['#fff3d6', '#ffd27a'], kind: 'spark', speed: 220, life: 0.25 }); }
        } else { c.life += dt; if (c.life > 0.45) c.phase = 'done'; }
        if (c.phase !== 'done') alive++;
      }
      if (!this.fellSound && this.t >= this.tele) { this.fellSound = true; BW.Audio.play('silk_volley', { vol: 0.9 }); }
      if (!alive) this.dead = true;
    }
    draw(ctx) {
      const tele = Math.min(1, this.t / this.tele);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // the opening: a calm pool of cool light
      if (this.t < this.tele + 0.5) {
        const a = Math.min(1, this.t / 0.3) * (this.t > this.tele ? Math.max(0, 1 - (this.t - this.tele) / 0.5) : 1);
        ctx.globalAlpha = 0.75 * a; ctx.drawImage(BW.glowSprite('#bfe8ff'), this.openX - this.openW * 0.7, this.fy - 90, this.openW * 1.4, 130);
        ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#d8f2ff'; ctx.fillRect(this.openX - this.openW / 2 + 10, this.fy - 3, this.openW - 20, 3);
        this.game.addLight(this.openX, this.fy - 50, this.openW, '#bfe8ff', 0.5 * a);
      }
      for (const c of this.cols) {
        if (c.phase === 'done') continue;
        if (c.phase === 'tele') {
          const a = Math.min(1, tele * 1.3);
          ctx.globalAlpha = 0.3 + 0.6 * a * (0.8 + Math.sin(this.t * 20 + c.x) * 0.2);
          ctx.strokeStyle = '#ffe9c4'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(c.x, this.top); ctx.lineTo(c.x + Math.sin(this.t * 3 + c.x) * 3, this.top + (this.fy - this.top) * a); ctx.stroke();
          ctx.globalAlpha = 1; drawSpear(ctx, c.x, this.top + 20 + a * 40, 1);
          ctx.globalAlpha = 0.35 * a; ctx.drawImage(BW.glowSprite('#ffd9a0'), c.x - 14, this.fy - 18, 28, 22);
        } else {
          const a = c.phase === 'fall' ? 1 : Math.max(0, 1 - c.life / 0.45);
          ctx.globalAlpha = a; drawSpear(ctx, c.x, c.y, 1);
          if (c.phase === 'fall') { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x, c.y - 74); ctx.lineTo(c.x, c.y - 200); ctx.stroke(); }
        }
      }
      ctx.restore();
    }
  }
  function drawSpear(ctx, x, tipY, k) {
    ctx.fillStyle = '#fff6e2';
    ctx.beginPath(); ctx.moveTo(x, tipY); ctx.lineTo(x - 5 * k, tipY - 30 * k); ctx.lineTo(x - 2 * k, tipY - 70 * k); ctx.lineTo(x + 2 * k, tipY - 70 * k); ctx.lineTo(x + 5 * k, tipY - 30 * k); ctx.closePath(); ctx.fill();
    ctx.globalAlpha *= 0.6; ctx.drawImage(BW.glowSprite('#ffd9a0'), x - 16 * k, tipY - 60 * k, 32 * k, 70 * k);
  }

  // A chunk of the vault shaken loose; its shadow and a trickle of dust mark where it will land.
  class Debris extends Hazard {
    constructor(game, x, floorY, delay) { super(game); this.dmg = BW.Difficulty.WEIGHTS.warden.debris; this.x = x; this.fy = floorY; this.delay = delay; this.y = 2 * T + 20; this.vy = 0; this.r = 17; this.rot = Math.random() * 6; this.shape = [0.9, 1.1, 0.8, 1.0, 1.15, 0.85]; }
    boxes() { return this.t >= this.delay ? [{ x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }] : null; }
    hitX(p) { return this.x; }
    update(dt) {
      super.update(dt);
      if (this.t < this.delay) {
        if (Math.random() < dt * 30) this.game.fx.spawn({ x: this.x + BW.rand(-10, 10), y: this.y, vx: 0, vy: BW.rand(200, 320), life: 0.8, size: 1.5, color: '#b9b2a4', grav: 300, drag: 0 });
        if (!this.warned && this.t > 0.05) { this.warned = true; BW.Audio.play('debris', { vol: 0.35, rate: 1.4, minGap: 0.15 }); }
        return;
      }
      this.vy += 2000 * dt; this.y += this.vy * dt; this.rot += 7 * dt;
      if (this.y + this.r >= this.fy) {
        this.dead = true; BW.Audio.play('break', { vol: 0.5, rate: 1.2, minGap: 0.05 });
        this.game.fx.burst(this.x, this.fy - 8, 14, { color: ['#7a6a4a', '#c9c2b0', '#4f6a5e'], kind: 'shard', speed: 280, angle: -Math.PI / 2, spread: 2.6, life: 0.6, grav: 1000, size: 4 });
      }
    }
    draw(ctx) {
      if (this.t < this.delay) {
        const k = this.t / this.delay;
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * k})`;
        ctx.beginPath(); ctx.ellipse(this.x, this.fy - 2, 12 + 18 * k, 4 + 3 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * k;
        ctx.drawImage(BW.glowSprite('#ff9a3c'), this.x - 34, this.fy - 22, 68, 30); ctx.restore();
        return;
      }
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
      ctx.fillStyle = '#5d6f62'; ctx.strokeStyle = '#1d1a20'; ctx.lineWidth = 2;
      ctx.beginPath();
      this.shape.forEach((s, i) => { const a = (i / this.shape.length) * Math.PI * 2; const r = this.r * s; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(230,200,140,0.5)'; ctx.fillRect(-this.r * 0.5, -this.r * 0.6, this.r * 0.6, 3);
      ctx.restore();
    }
  }

  BW.ENEMY_TYPES.warden = Warden;
  BW.Warden = Warden;
  BW.Shockwave = Shockwave;
  BW.PealWave = PealWave;
  BW.ThreadRain = ThreadRain;
  BW.Debris = Debris;
})(window.BW);

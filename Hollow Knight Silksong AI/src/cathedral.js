'use strict';
// Stage 2: the cathedral. Opening the great doors, the Warden's entrance (full the first time, short on
// retries), the arena lock and camera, victory, rethreading the Great Bell, and the ending with credits.
(function (BW) {
  const T = BW.T, P = BW.PHYS;
  const G = BW.Game.prototype;

  function mixHex(a, b, t) {
    const A = BW.hexToRgb(a), B = BW.hexToRgb(b);
    const h = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(BW.lerp(A[0], B[0], t)) + h(BW.lerp(A[1], B[1], t)) + h(BW.lerp(A[2], B[2], t));
  }
  const skipPressed = () => BW.Input.pressed.jump || BW.Input.pressed.attack || BW.Input.pressed.confirm;

  // ================================================================ game hooks
  G.bossActive = function () { return !!(this.boss && this.boss.active); };
  G.spawnHazard = function (h) { this.hazards.push(h); return h; };

  G.openCathedralDoors = function (door) { this.startSequence(doorSequence(this, door)); };

  // The antechamber lantern becomes the checkpoint as soon as you step inside: retries start right outside.
  G.setArenaCheckpoint = function () {
    const st = this.state, first = st.lantern !== 'lan_b3';
    st.lantern = 'lan_b3'; st.lanternRoom = 'B3'; st.lanternsLit.lan_b3 = true;
    return first;
  };

  G.enterCathedral = function () {
    const p = this.player;
    p.state = 'cutscene'; p.vx = 0;
    BW.Audio.play('gate', { vol: 0.35, rate: 1.4 });
    this.startTransition(() => {
      const moved = this.setArenaCheckpoint();
      const ex = BW.ROOMS.C1.ents.find((e) => e.type === 'exitdoor');
      this.loadRoom('C1', { x: (ex.x + 0.5) * T - 80 - P.w / 2, y: (ex.y + 1) * T - P.h });
      p.state = 'normal'; p.facing = -1; p.vx = 0; p.vy = 0; p.onGround = true;
      p.safeX = p.x; p.safeY = p.y; p.safeRoom = 'C1';
      this.saveGame();
      if (moved) this.hud.toast('The antechamber lantern keeps watch', 'If you fall, you will wake beside it');
    }, 0.45, 0.6);
  };

  G.exitCathedral = function () {
    const p = this.player;
    p.state = 'cutscene'; p.vx = 0;
    this.startTransition(() => {
      this.endRematch();
      this.loadRoom('B3', { x: 5 * T, y: 21 * T - P.h });
      p.state = 'normal'; p.facing = 1; p.vx = 0; p.vy = 0; p.onGround = true;
      p.safeX = p.x; p.safeY = p.y; p.safeRoom = 'B3';
    }, 0.45, 0.5);
  };

  // Warden rematch, started from any lantern. The story save is parked and the fight runs on a copy of the
  // flags with the victory undone; everything earned or counted is skipped, and endRematch() restores the save.
  G.startRematch = function () {
    const p = this.player, st = this.state;
    if (!this.canRematch()) return;
    p.state = 'cutscene'; p.vx = 0;
    BW.Audio.play('gate', { vol: 0.35, rate: 1.4 });
    this.startTransition(() => {
      const f = Object.assign({}, st.flags);
      delete f.warden_defeated; delete f.great_bell; delete f.ending_seen;
      st.flagsReal = st.flags; st.flags = f;
      this.rematch = true; this.rematchT0 = st.stats.playTime || 0;
      st.hp = st.maxHp;
      const ex = BW.ROOMS.C1.ents.find((e) => e.type === 'exitdoor');
      this.loadRoom('C1', { x: (ex.x + 0.5) * T - 80 - P.w / 2, y: (ex.y + 1) * T - P.h });
      p.state = 'normal'; p.facing = -1; p.vx = 0; p.vy = 0; p.onGround = true;
      p.safeX = p.x; p.safeY = p.y; p.safeRoom = 'C1';
      this.hud.toast('Warden Rematch', 'Nothing is earned here. Dying costs nothing.', 3.4);
    }, 0.45, 0.6);
  };

  // Test boss rooms (def.testBoss, e.g. the Ramparts Throne) run the Warden like a rematch: on a copy of the
  // flags with the victory undone, nothing earned, and the story save restored on leaving.
  G.enterTestBoss = function () {
    if (this.rematch) return;
    const st = this.state, f = Object.assign({}, st.flags);
    delete f.warden_defeated; delete f.great_bell; delete f.ending_seen;
    f.warden_met = true;
    st.flagsReal = st.flags; st.flags = f;
    this.rematch = true; this.fortressTest = true;
  };
  const baseLoadRoom = G.loadRoom;
  G.loadRoom = function (id, place, opts) {
    const def = BW.ROOMS[id];
    if (def && def.testBoss) this.enterTestBoss();
    else if (this.fortressTest) this.endRematch();
    return baseLoadRoom.call(this, id, place, opts);
  };

  // portcullis between the vestibule and the arena
  G.arenaLock = function (closed) {
    const gt = this.room && this.room.gates.find((x) => x.fixed);
    if (!gt) return;
    if (closed) {
      if (!gt.open) return;
      gt.open = false; gt.opening = false; gt.closing = true; this.room.fillTiles(gt, 'G');
      BW.Audio.play('gate', { rate: 1.25 }); this.fx.shake(6, 0.35);
    } else if (!gt.open) {
      gt.closing = false; gt.open = true; gt.opening = true; this.room.fillTiles(gt, '.');
      BW.Audio.play('gate'); this.fx.shake(4, 0.4);
    }
  };

  G.startWardenFight = function () {
    const b = this.boss, st = this.state;
    if (!b || b.state !== 'bound' || st.flags.warden_defeated) return;
    const first = !st.flags.warden_met;
    st.flags.warden_met = true;
    if (!this.rematch) st.stats.wardenAttempts = (st.stats.wardenAttempts || 0) + 1;
    this.codexSee('warden');
    this.saveGame();
    this.startSequence(wardenIntro(this, b, first));
  };

  G.onWardenDefeated = function (b) {
    const st = this.state;
    if (this.fortressTest) {
      if (this.player.state !== 'dead') this.startSequence(testBossSequence(this, b));
      return;
    }
    if (this.rematch) {
      if (this.player.state !== 'dead') this.startSequence(rematchSequence(this, b));
      return;
    }
    st.flags.warden_defeated = true;
    st.stats.wardenWinTime = st.stats.wardenWinTime || st.stats.playTime;
    BW.Codex.kill(st, 'warden');
    this.gainXp(BW.XP.REWARD.warden);
    this.saveGame();
    // a trade of final blows: the victory still counts, the player wakes at the lantern and finds the bell waiting
    if (this.player.state === 'dead') return;
    this.startSequence(victorySequence(this, b));
  };

  G.rethreadGreatBell = function (bell) {
    // the ending plays until it has been seen once (even if the game was closed mid-way through it)
    this.startSequence(this.state.flags.ending_seen ? ringSequence(this, bell) : bellSequence(this, bell));
  };

  G.startEnding = function () {
    this.seq = null; this.letterboxTarget = 0; this.camFocus = null;
    this.mode = 'ending';
    this.ending = new Ending(this);
  };

  // Gallery: the epilogue and credits again, without touching the save
  G.replayEnding = function () {
    this.mode = 'ending';
    this.ending = new Ending(this, true);
    BW.Audio.playMusic('mus_ending', 1.5);
  };

  // Title screen (after the game is beaten): just the credits, read from the autosave
  G.titleCredits = function () {
    const st = BW.Save.load();
    if (!st) return;
    this.mode = 'ending';
    this.ending = new Ending(this, true, st, true);
    BW.Audio.playMusic('mus_ending', 1.5);
  };

  G.leaveEnding = function (choice) {
    this.ending = null; this.whiteFade = 0;
    if (choice === 'explore') {
      this.mode = 'play'; this.fade = 1;
      this.state.hp = this.state.maxHp;
      this.respawnAtLantern(true);
      this.saveGame();
      this.startTransition(() => {}, 0.01, 1.2);
    } else this.toTitle();
  };

  G.onEnterRoom = function (room) {
    const f = this.state.flags;
    if (room.def.arena) {
      room.area = Object.assign({}, room.area);   // per-visit copy: phase two and dawn recolour it
      this.bg.area = room.area;
      if (f.great_bell) BW.Audio.playMusic('mus_ending', 3);
    }
    this.dawn = f.great_bell ? 1 : 0;
  };

  // per-frame cathedral state: boss bar, phase-two heat and dawn light, post-game bells
  G.cathedralTick = function (dt) {
    const room = this.room, f = this.state.flags;
    if (this.bossBar) {
      const bb = this.bossBar;
      bb.a = BW.approach(bb.a, bb.out ? 0 : 1, dt * (bb.out ? 1.2 : 2.5));
      if (bb.out && bb.a <= 0) this.bossBar = null;
    }
    if (this.bossTitle) { this.bossTitle.t += dt; if (this.bossTitle.t > this.bossTitle.life) this.bossTitle = null; }
    if (this.pealHint > 0) this.pealHint -= dt;
    if (room && room.def.arena) {
      const a = room.area, base = BW.AREAS[room.def.area];
      const heat = this.boss ? this.boss.heat : 0;
      this.dawn = BW.approach(this.dawn || 0, f.great_bell ? 1 : 0, dt * 0.35);
      a.deep = this.dawn > 0 ? mixHex(base.deep, '#120c08', this.dawn) : mixHex(base.deep, '#1c0704', heat);
      a.darkness = base.darkness - 0.12 * this.dawn + 0.04 * heat;
      a.light = this.dawn > 0 ? mixHex(base.light, '#ffd29a', this.dawn) : base.light;
      a.tint = this.dawn > 0 ? { color: '#ffb36a', a: 0.13 * this.dawn } : { color: '#ff4a1a', a: 0.12 * heat };
    }
    // after the ending, the Belfry's bells answer now and then
    if (f.great_bell && room && (room.area.id === 'belfry' || room.area.id === 'cathedral')) {
      this.tollT = (this.tollT == null ? 6 : this.tollT) - dt;
      if (this.tollT <= 0) { this.tollT = BW.rand(16, 26); BW.Audio.play('bellfar', { pitch: BW.pick([130.8, 164.8, 196, 261.6]), vol: 0.8 }); }
    }
  };

  // ================================================================ sequences
  function* doorSequence(g, door) {
    const p = g.player;
    p.state = 'cutscene'; p.vx = 0; p.facing = -1;
    g.letterboxTarget = 1; g.seq.hideHud = true;
    g.camFocus = { x: 8 * T, y: 14 * T };
    BW.Audio.duckMusic(0.2, 7);
    yield 0.7;
    BW.Audio.play('bell', { pitch: 98, vol: 0.9, minGap: 0 });
    g.fx.ring(2 * T + 6, 15 * T, 20, 320, 1.2, '#ffe7b5', 3);
    yield 0.8;
    door.opening = true;
    BW.Audio.play('doors'); g.fx.shake(5, 2.4);
    for (let i = 0; i < 160; i++) {
      if (i % 3 === 0) g.fx.spawn({ x: 2 * T + 6 + BW.rand(-110, 110), y: 21 * T - BW.rand(380, 440), vx: BW.rand(-10, 10), vy: BW.rand(60, 160), life: 1.4, size: BW.rand(1.5, 3), color: '#b9b2a4', grav: 120 });
      if (i % 4 === 0) g.fx.spawn({ x: 2 * T + 6 + BW.rand(-60, 60), y: 21 * T - BW.rand(20, 300), vx: BW.rand(30, 90), vy: BW.rand(-20, 20), life: 1.6, size: BW.rand(2, 4), color: '#ffd9a0', kind: 'glow', add: true, drag: 0.6 });
      yield 1 / 60;
    }
    g.state.flags.cathedral_open = true;
    g.saveGame();
    yield 0.9;
    g.camFocus = null; g.letterboxTarget = 0; g.seq.hideHud = false; p.state = 'normal';
    g.hud.toast('The great doors stand open', 'The Cathedral of the Last Toll lies beyond');
  }

  function roar(g, b) {
    BW.Audio.play('boss_roar'); g.fx.shake(13, 1.0); g.fx.flash('#fff3d8', 0.3);
    for (let i = 0; i < 3; i++) g.fx.ring(b.cx, b.y + 110, 20, 420 + i * 170, 0.8 + i * 0.2, '#ffe2a8', 5 - i);
    g.fx.burst(b.cx, b.y + 120, 30, { color: ['#efe6d2', '#fff6e4'], kind: 'thread', speed: 360, life: 0.8, add: true });
  }

  function* wardenIntro(g, b, full) {
    const p = g.player;
    g.seq.hideHud = true; g.letterboxTarget = 1; p.state = 'cutscene'; p.vx = 0;
    g.arenaLock(true); g.arenaCam = true;
    BW.Audio.playMusic(null, 1.2);
    let skip = false;
    function* wait(t) {
      let w = 0;
      while (w < t) { w += 1 / 60; yield 1 / 60; if (w > 0.2 && skipPressed()) { skip = true; return; } }
    }
    if (full) {
      g.camFocus = { x: b.cx + 170, y: b.y + 50 };
      yield* wait(1.2);
      if (!skip) { b.eye = 1; BW.Audio.play('bellfar', { pitch: 65.4, vol: 1, minGap: 0 }); g.fx.shake(3, 1.4); yield* wait(1.1); }
      for (let i = 0; i < b.cords.length && !skip; i++) { b.snapCord(i); yield* wait(0.2); }
      if (!skip) {
        b.rise(); roar(g, b); BW.Audio.playMusic('mus_boss', 0.3);
        g.bossTitle = { name: 'The Bellbound Warden', sub: 'Keeper of the Last Toll', t: 0, life: 3.6 };
        yield* wait(2.5);
      }
    }
    if (!full || skip) {
      if (b.state === 'bound') { b.rise(); roar(g, b); }
      BW.Audio.playMusic('mus_boss', 0.3);
      if (full && !g.bossTitle) g.bossTitle = { name: 'The Bellbound Warden', sub: 'Keeper of the Last Toll', t: 0, life: 2.6 };
      g.camFocus = null;
      yield 0.85;
    }
    g.camFocus = null; g.letterboxTarget = 0; g.seq.hideHud = false; p.state = 'normal';
    b.begin();
    g.bossBar = { a: 0, out: false };
  }

  function* victorySequence(g, b) {
    const p = g.player;
    g.hitstop(0.3); g.slowT = 1.4; g.fx.flash('#ffffff', 0.8); g.fx.shake(10, 0.6);
    BW.Audio.playMusic(null, 2.5);
    g.seq.hideHud = true; g.letterboxTarget = 1;
    p.state = 'cutscene'; p.vx = 0; p.dashT = 0; p.attackT = 0;
    g.camFocus = { x: b.cx, y: b.y + 70 };
    yield () => b.state === 'remains';
    g.hazards = [];
    if (g.bossBar) g.bossBar.out = true;
    yield 0.7;
    const bell = g.objects.find((o) => o.type === 'greatbell');
    if (bell) {
      g.camFocus = { x: bell.x, y: bell.mouthY - 10 };
      bell.ring(0.35);
      BW.Audio.play('bellfar', { pitch: 98, vol: 1, minGap: 0 });
      yield 2.2;
    }
    g.arenaLock(false); g.arenaCam = false;
    g.camFocus = null; g.letterboxTarget = 0; g.seq.hideHud = false; p.state = 'normal';
    g.hud.toast('The Warden’s vow is broken', 'Its silk hangs slack from the Great Bell. Rethread it.', 4);
  }

  function* bellSequence(g, bell) {
    const p = g.player, st = g.state, b = g.boss;
    p.state = 'cutscene'; p.vx = 0; g.letterboxTarget = 1; g.seq.hideHud = true;
    p.facing = bell.x > p.cx ? 1 : -1;
    g.camFocus = { x: bell.x, y: bell.mouthY - 80 };
    BW.Audio.duckMusic(0.2, 8);
    for (let i = 0; i < 120; i++) {
      g.fx.thread(p.cx, p.cy - 10, bell.x + BW.rand(-100, 100), bell.mouthY - BW.rand(20, 220), 0.4, '#ffe7b5');
      if (b && i % 2 === 0) {
        const sx = b.cx + b.facing * 120, sy = b.floorY - 30;
        g.fx.spawn({ x: sx + BW.rand(-30, 30), y: sy, vx: (bell.x - sx) * 1.1, vy: (bell.mouthY - 80 - sy) * 1.1, life: 0.9, size: 3, color: '#ffd27a', kind: 'glow', add: true, drag: 0 });
      }
      if (i % 6 === 0) BW.Audio.play('text', { vol: 1, minGap: 0 });
      yield 1 / 60;
    }
    st.flags.great_bell = true;
    g.saveGame();
    bell.ring(1.6);
    BW.Audio.play('great_bell', { vol: 1, minGap: 0 });
    g.fx.shake(16, 2.2); g.fx.flash('#fff3d8', 0.85);
    for (let i = 0; i < 4; i++) g.fx.ring(bell.x, bell.mouthY - 140, 30, 900 + i * 260, 1.6 + i * 0.35, '#ffe7b5', 6 - i);
    g.fx.burst(bell.x, bell.mouthY - 120, 60, { color: ['#fff3d6', '#ffd27a', '#ffffff'], kind: 'glow', speed: 420, life: 1.6, add: true, size: 9 });
    BW.Audio.playMusic('mus_ending', 2.5);
    yield 1.6;
    for (const f of [261.6, 329.6, 392]) { BW.Audio.play('bellfar', { pitch: f, vol: 1, minGap: 0 }); bell.ring(0.25); yield 0.55; }
    yield 1.6;
    for (let i = 0; i <= 45; i++) { g.whiteFade = i / 45; yield 1 / 60; }
    g.startEnding();
  }

  // Test boss win: no stats, no card. The portcullis lifts and the player stays in the arena.
  function* testBossSequence(g, b) {
    const p = g.player;
    g.hitstop(0.3); g.slowT = 1.4; g.fx.flash('#ffffff', 0.7); g.fx.shake(9, 0.6);
    BW.Audio.playMusic(null, 2.5);
    g.seq.hideHud = true; g.letterboxTarget = 1;
    p.state = 'cutscene'; p.vx = 0; p.dashT = 0; p.attackT = 0;
    g.camFocus = { x: b.cx, y: b.y + 70 };
    yield () => b.state === 'remains';
    g.hazards = [];
    if (g.bossBar) g.bossBar.out = true;
    yield 1.4;
    g.arenaLock(false); g.arenaCam = false;
    g.camFocus = null; g.letterboxTarget = 0; g.seq.hideHud = false; p.state = 'normal';
    BW.Audio.playMusic(g.room.area.music, 2.5);
    g.hud.toast('Throne cleared', 'Test fight: nothing was earned. Leave and return to fight again.', 4);
  }

  // Rematch win: no bell, no ending. A result card, then back to the lantern the fight started from.
  function* rematchSequence(g, b) {
    const p = g.player, st = g.state;
    g.hitstop(0.3); g.slowT = 1.4; g.fx.flash('#ffffff', 0.7); g.fx.shake(9, 0.6);
    BW.Audio.playMusic(null, 2.5);
    g.seq.hideHud = true; g.letterboxTarget = 1;
    p.state = 'cutscene'; p.vx = 0; p.dashT = 0; p.attackT = 0;
    g.camFocus = { x: b.cx, y: b.y + 70 };
    yield () => b.state === 'remains';
    g.hazards = [];
    if (g.bossBar) g.bossBar.out = true;
    yield 1.1;
    const time = Math.max(0, (st.stats.playTime || 0) - (g.rematchT0 || 0));
    const prev = st.stats.rematchBest;
    const record = !prev || time < prev;
    st.stats.rematchWins = (st.stats.rematchWins || 0) + 1;
    if (record) st.stats.rematchBest = time;
    const c = g.rematchCard = { a: 0, t: 0, time, best: st.stats.rematchBest, record, wins: st.stats.rematchWins, diff: BW.Difficulty.get(st) };
    BW.Audio.play('bellfar', { pitch: 130.8, vol: 0.9, minGap: 0 });
    for (let i = 0; i <= 36; i++) { c.a = i / 36; c.t += 1 / 60; yield 1 / 60; }
    while (c.t < 7) { c.t += 1 / 60; yield 1 / 60; if (c.t > 2 && (BW.Input.pressed.confirm || BW.Input.pressed.jump)) break; }
    g.fade = 0;
    for (let i = 0; i <= 30; i++) { g.fade = i / 30; yield 1 / 60; }
    g.letterboxTarget = 0; g.camFocus = null;
    st.hp = st.maxHp; st.silk = 0;
    g.respawnAtLantern(true);   // also restores the real flags
    g.saveGame();
    g.rematchCard = null;
    g.seq.hideHud = false;
    g.fade = 0;
  }

  G.drawRematchCard = function (ctx) {
    const c = this.rematchCard, W = BW.VW, H = BW.VH, cx = W / 2, t = c.t;
    ctx.save(); ctx.globalAlpha = c.a;
    ctx.fillStyle = 'rgba(6,6,10,0.86)'; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createRadialGradient(cx, H * 0.4, 20, cx, H * 0.4, H * 0.8);
    gl.addColorStop(0, 'rgba(232,170,80,0.22)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 500 26px ${BW.FONT_B}`; ctx.fillStyle = '#d9cbb0'; ctx.fillText('The Bellbound Warden falls once more', cx, H * 0.27);
    ctx.save(); ctx.font = `600 78px ${BW.FONT_T}`; ctx.fillStyle = '#f7ecd6'; ctx.shadowColor = 'rgba(232,170,80,0.55)'; ctx.shadowBlur = 28;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '6px';
    ctx.fillText('REMATCH CLEARED', cx, H * 0.38); ctx.restore();
    const lw = 120 + Math.min(1, t / 1.2) * 300;
    ctx.strokeStyle = 'rgba(240,200,140,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - lw, H * 0.38 + 56); ctx.lineTo(cx - 14, H * 0.38 + 56); ctx.moveTo(cx + 14, H * 0.38 + 56); ctx.lineTo(cx + lw, H * 0.38 + 56); ctx.stroke();
    ctx.fillStyle = '#efe0c0'; ctx.save(); ctx.translate(cx, H * 0.38 + 56); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    const rows = [['Fight time', BW.fmtTime(c.time)], ['Best time', BW.fmtTime(c.best)], ['Rematches won', String(c.wins)], ['Difficulty', c.diff.name]];
    rows.forEach((r, i) => {
      const y = H * 0.38 + 110 + i * 40, a = Math.min(1, Math.max(0, (t - 0.5 - i * 0.18) / 0.4));
      ctx.globalAlpha = c.a * a;
      ctx.textAlign = 'right'; ctx.font = `500 25px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.7)'; ctx.fillText(r[0], cx - 20, y);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff1d0'; ctx.fillText(r[1], cx + 20, y);
    });
    ctx.globalAlpha = c.a; ctx.textAlign = 'center';
    if (c.record && t > 1.4) { ctx.font = `600 24px ${BW.FONT_T}`; ctx.fillStyle = `rgba(255,214,120,${0.7 + 0.3 * Math.sin(t * 5)})`; ctx.fillText('\u2726  NEW BEST TIME  \u2726', cx, H * 0.38 + 290); }
    ctx.font = `italic 500 21px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.6)'; ctx.fillText('A rematch earns nothing. The Hollow remembers only that you could.', cx, H * 0.86);
    if (t > 2) { ctx.font = `500 19px ${BW.FONT_B}`; ctx.fillStyle = `rgba(230,220,200,${0.45 + 0.2 * Math.sin(t * 3)})`; ctx.fillText(`${BW.Input.label('confirm')}  return to the lantern`, cx, H - 50); }
    ctx.restore();
  };

  function* ringSequence(g, bell) {
    const p = g.player;
    p.state = 'cutscene'; p.vx = 0;
    p.facing = bell.x > p.cx ? 1 : -1;
    for (let i = 0; i < 30; i++) { g.fx.thread(p.cx, p.cy - 10, bell.x + BW.rand(-60, 60), bell.mouthY - BW.rand(20, 160), 0.35, '#ffe7b5'); yield 1 / 60; }
    bell.ring(1.0);
    BW.Audio.play('great_bell', { vol: 0.8, minGap: 0 }); g.fx.shake(8, 1.2);
    for (let i = 0; i < 2; i++) g.fx.ring(bell.x, bell.mouthY - 140, 30, 700 + i * 240, 1.4 + i * 0.3, '#ffe7b5', 4 - i);
    yield 0.6;
    p.state = 'normal';
    g.hud.toast('The Great Bell sings', 'Far below, every bell in the Hollow answers');
  }

  // ================================================================ ending: epilogue, credits, choice
  const EPILOGUE = [
    'The Great Bell spoke, and the Belfry answered.',
    'Down through the looms and the roots, every silent bell rang out once more.',
    'The frayed threads of the Hollow drew tight, and in the long dark, lanterns began to wake.',
    'The last Bellweaver had mended what was left undone.',
  ];

  class Ending {
    constructor(game, replay, state, fromTitle) {
      this.game = game; this.t = 0; this.phase = fromTitle ? 'credits' : 'image'; this.pt = 0; this.line = 0; this.scroll = 0; this.sel = 0;
      this.replay = !!replay; this.fromTitle = !!fromTitle;
      const st = state || game.state;
      if (!this.replay) {
        st.flags.ending_seen = true;
        st.stats.clears = (st.stats.clears || 0) + 1;
        if (!st.stats.clearTime) st.stats.clearTime = st.stats.playTime;
        game.saveGame();
        game.hazards = []; game.bossBar = null; game.bossTitle = null; game.whiteFade = 0;
      }
      this.credits = this.buildCredits(st);
      this.creditsH = this.credits.reduce((h, c) => h + c.gap, 0);
    }
    buildCredits(st) {
      const f = st.flags, rooms = BW.ROOM_LIST.filter((r) => st.visited[r.id]).length;
      const upgrades = ['pk_lt_m5', 'pk_lt_m8', 'pk_spool_s5', 'odo_sold'].filter((k) => f[k]).length;
      const secretKeys = [];
      for (const r of BW.ROOM_LIST) {
        for (const s of r.secrets) secretKeys.push('sec_' + s.id);
        for (const e of r.ents) if (e.type === 'cache') secretKeys.push('pk_' + e.id);
      }
      const secrets = secretKeys.filter((k) => f[k]).length;
      const L = [];
      const add = (text, style, gap, value) => L.push({ text, style, gap, value });
      add('BELLWEAVER', 'logo', 86); add('a thread through the silent bells', 'tag', 96); add('', 'rule', 90);
      add('An original game', 'head', 40); add('Every room, creature, sound and line of text', 'line', 34); add('made for this project', 'line', 96);
      add('Design · Code · Levels · Writing', 'head', 40); add('Built with Claude Code', 'line', 96);
      add('Art', 'head', 40); add('GPT Image 2.5', 'line', 32); add('generated with Higgsfield, then cut, keyed and animated for the game', 'sub', 96);
      add('Music', 'head', 40); add('Sonilo Music', 'line', 32); add('generated with Higgsfield', 'sub', 96);
      add('Sound and ambience', 'head', 40); add('Seed Audio', 'line', 32); add('generated with Higgsfield', 'sub', 96);
      add('Type', 'head', 40); add('Cinzel and Cormorant Garamond', 'line', 32); add('SIL Open Font License', 'sub', 96);
      add('', 'rule', 80);
      add('Your journey', 'head', 56);
      add('Time', 'stat', 42, BW.fmtTime(st.stats.clearTime || st.stats.playTime || 0));
      add('Deaths', 'stat', 42, `${st.stats.deaths || 0}`);
      add('Rooms discovered', 'stat', 42, `${rooms} / ${BW.ROOM_LIST.length}`);
      add('Upgrades', 'stat', 42, `${upgrades} / 4`);
      add('Secrets', 'stat', 42, `${secrets} / ${secretKeys.length}`);
      add('Lore notes', 'stat', 42, `${BW.Lore.count(st)} / ${BW.Lore.NOTES.length}`);
      add('Attempts against the Warden', 'stat', 42, `${st.stats.wardenAttempts || 1}`);
      add('Level', 'stat', 120, `${BW.XP.level(st.xp | 0)}`);
      add('Thank you for playing', 'logo2', 0);
      return L;
    }
    update(dt, inp) {
      this.t += dt; this.pt += dt;
      const g = this.game;
      if (this.replay && this.t > 0.3 && (inp.pressed.pause || inp.pressed.back || (this.phase === 'end' && this.pt > 1 && (inp.pressed.confirm || inp.pressed.jump)))) {
        BW.Audio.play('ui_back');
        if (this.fromTitle) { g.ending = null; g.titleArm = true; g.toTitle(); } else g.endReplay();
        return;
      }
      if (this.phase === 'image') {
        if (this.pt > 2.6) { this.phase = 'epilogue'; this.pt = 0; this.line = 0; }
      } else if (this.phase === 'epilogue') {
        const dur = 4.4;
        if (this.pt > 0.8 && (inp.pressed.confirm || inp.pressed.jump || inp.pressed.attack)) { this.pt = Math.max(this.pt, dur - 0.6); BW.Audio.play('ui_move'); }
        if (this.pt >= dur) { this.line++; this.pt = 0; if (this.line >= EPILOGUE.length) { this.phase = 'credits'; this.scroll = 0; } }
      } else if (this.phase === 'credits') {
        const fast = inp.down.confirm || inp.down.jump || inp.down.attack;
        this.scroll += dt * (fast ? 240 : 48);
        if (inp.pressed.pause || inp.pressed.back) this.scroll = this.creditsH + BW.VH * 0.5;
        if (this.scroll >= this.creditsH + BW.VH * 0.5) { this.phase = 'end'; this.pt = 0; this.sel = 0; }
      } else if (this.phase === 'end') {
        if (this.pt < 1.0 || this.replay) return;
        if (inp.pressed.up || inp.pressed.down) { this.sel = 1 - this.sel; BW.Audio.play('ui_move'); }
        if (inp.pressed.confirm || inp.pressed.jump || inp.pressed.interact) {
          BW.Audio.play('ui_ok');
          g.leaveEnding(this.sel === 0 ? 'explore' : 'title');
        }
      }
    }
    draw(ctx) {
      const W = BW.VW, H = BW.VH, img = BW.Assets.img('end_dawn');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (img) {
        const z = 1.04 + Math.min(1, this.t / 70) * 0.08;
        const s = Math.max(W / img.width, H / img.height) * z, w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2 - (z - 1) * 120, w, h);
      }
      const dim = this.phase === 'credits' || this.phase === 'end' ? Math.min(0.62, (this.phase === 'end' ? 0.62 : this.scroll / 400 * 0.62)) : 0;
      if (dim > 0) { ctx.fillStyle = `rgba(4,5,8,${dim})`; ctx.fillRect(0, 0, W, H); }
      const vg = ctx.createLinearGradient(0, H * 0.55, 0, H);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vg; ctx.fillRect(0, H * 0.55, W, H * 0.45);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 16;
      if (this.phase === 'epilogue') {
        const dur = 4.4, a = Math.min(1, this.pt / 0.9, (dur - this.pt) / 0.7);
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `italic 500 34px ${BW.FONT_B}`; ctx.fillStyle = '#f6ecd6';
        BW.wrapText(ctx, EPILOGUE[this.line] || '', W / 2, H - 150, 880, 44);
      } else if (this.phase === 'credits') {
        let y = H + 40 - this.scroll;
        const diamond = (x, yy, r) => { ctx.save(); ctx.translate(x, yy); ctx.rotate(Math.PI / 4); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore(); };
        const flank = (w, yy, len) => {
          for (const s of [-1, 1]) {
            const x0 = W / 2 + s * (w / 2 + 18), x1 = x0 + s * len, gr = ctx.createLinearGradient(x0, 0, x1, 0);
            gr.addColorStop(0, 'rgba(232,201,138,0.75)'); gr.addColorStop(1, 'rgba(232,201,138,0)');
            ctx.fillStyle = gr; ctx.fillRect(Math.min(x0, x1), yy - 0.5, len, 1);
            ctx.fillStyle = '#e8c98a'; diamond(x0, yy, 2.5);
          }
        };
        for (const c of this.credits) {
          if (y > -80 && y < H + 80) {
            ctx.globalAlpha = Math.min(1, Math.max(0, (y - 40) / 120), Math.max(0, (H - y + 20) / 90));
            if (c.style === 'logo') { ctx.font = `600 66px ${BW.FONT_T}`; ctx.fillStyle = '#f6eedd'; ctx.fillText(c.text, W / 2, y); }
            else if (c.style === 'logo2') { ctx.font = `600 44px ${BW.FONT_T}`; ctx.fillStyle = '#f6eedd'; ctx.fillText(c.text, W / 2, y); }
            else if (c.style === 'tag') { ctx.font = `italic 500 28px ${BW.FONT_B}`; ctx.fillStyle = '#d9cbb0'; ctx.fillText(c.text, W / 2, y); }
            else if (c.style === 'head') {
              ctx.font = `600 19px ${BW.FONT_T}`; ctx.fillStyle = '#e8c98a';
              if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
              const t = c.text.toUpperCase(), w = ctx.measureText(t).width;
              ctx.fillText(t, W / 2 + 2, y);
              if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
              flank(w, y, 70);
            } else if (c.style === 'rule') {
              ctx.fillStyle = 'rgba(232,201,138,0.8)'; diamond(W / 2, y, 4);
              flank(0, y, 90);
            } else if (c.style === 'sub') { ctx.font = `italic 500 19px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(217,203,176,0.78)'; ctx.fillText(c.text, W / 2, y); }
            else if (c.style === 'stat') {
              const half = 250;
              ctx.fillStyle = 'rgba(232,201,138,0.22)'; ctx.fillRect(W / 2 - half, y + 17, half * 2, 1);
              ctx.font = `500 23px ${BW.FONT_B}`;
              ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(217,203,176,0.85)'; ctx.fillText(c.text, W / 2 - half, y);
              ctx.textAlign = 'right'; ctx.fillStyle = '#fff3dc'; ctx.fillText(c.value, W / 2 + half, y);
              ctx.textAlign = 'center';
            } else { ctx.font = `500 28px ${BW.FONT_B}`; ctx.fillStyle = '#f3e9d2'; ctx.fillText(c.text, W / 2, y); }
          }
          y += c.gap;
        }
      } else if (this.phase === 'end') {
        const a = Math.min(1, this.pt / 1.2);
        ctx.globalAlpha = a;
        ctx.font = `600 58px ${BW.FONT_T}`; ctx.fillStyle = '#f6eedd'; ctx.fillText('THE END', W / 2, H * 0.36);
        ctx.font = `italic 500 28px ${BW.FONT_B}`; ctx.fillStyle = '#d9cbb0'; ctx.fillText('The Great Bell rings again.', W / 2, H * 0.36 + 56);
        ctx.shadowBlur = 0;
        const opts = this.replay ? [this.fromTitle ? 'Back to the Title Screen' : 'Back to the Gallery'] : ['Return to the Belfry', 'Title Screen'];
        opts.forEach((o, i) => {
          const y = H * 0.6 + i * 50, on = i === this.sel;
          ctx.font = `${on ? 600 : 500} 28px ${BW.FONT_B}`; ctx.fillStyle = on ? '#fff3dc' : 'rgba(230,220,200,0.6)';
          ctx.fillText(o, W / 2, y);
          if (on) { ctx.fillStyle = '#e8c98a'; ctx.save(); ctx.translate(W / 2 - ctx.measureText(o).width / 2 - 24, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
        });
        ctx.font = `500 18px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(230,220,200,0.55)';
        ctx.fillText(this.fromTitle ? 'Thank you for playing.' : this.replay ? 'A memory, replayed. Nothing in your journey has changed.' : 'Your completion has been saved.', W / 2, H - 46);
      }
      ctx.restore();
      if (this.phase === 'image' && this.pt < 2.4) { ctx.fillStyle = `rgba(255,250,240,${Math.max(0, 1 - this.pt / 2.4)})`; ctx.fillRect(0, 0, W, H); }
      if (this.phase === 'credits' && this.scroll < this.creditsH) {
        ctx.save(); ctx.font = `500 17px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(230,220,200,0.5)'; ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
        ctx.fillText(`Hold ${BW.Input.label('confirm')} to speed up · ${BW.Input.label('pause')} to skip`, W - 24, 32); ctx.restore();
      }
    }
  }

  // ================================================================ boss bar, title card, peal hint
  BW.drawBossOverlay = function (ctx, g) {
    const bb = g.bossBar, b = g.boss;
    if (bb && b && bb.a > 0.01) {
      const w = 640, h = 12, x = (BW.VW - w) / 2, y = BW.VH - 56;
      ctx.save(); ctx.globalAlpha = bb.a * g.hudAlpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 21px ${BW.FONT_T}`; ctx.fillStyle = '#efe4cc'; ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10;
      ctx.fillText('THE BELLBOUND WARDEN', BW.VW / 2, y - 14);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(6,7,10,0.78)'; BW.roundRect(ctx, x - 5, y - 5, w + 10, h + 10 + 24, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(236,222,190,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      const k = Math.max(0, b.hp) / b.maxHp, kc = Math.max(0, b.chip) / b.maxHp;
      ctx.fillStyle = 'rgba(255,240,210,0.65)'; ctx.fillRect(x, y, w * kc, h);
      const gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, '#7a2410'); gr.addColorStop(1, b.phase === 2 ? '#ff7a2a' : '#d9a441');
      ctx.fillStyle = gr; ctx.fillRect(x, y, w * k, h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * k, 3);
      ctx.fillStyle = b.phase === 2 ? '#ffb36a' : '#f0e2c4';
      ctx.save(); ctx.translate(x + w * (BW.WARDEN_TUNE.phaseAt / b.maxHp), y + h / 2); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(BW.VW / 2 + s * (w / 2 + 16), y + h / 2); ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#e8d6b0'; ctx.strokeRect(-5, -5, 10, 10); ctx.restore(); }
      // poise: the Warden's guard. Strikes, parries and Shadow Steps fill it, it bleeds away if you stop, and when it is
      // full the Warden staggers (the bar then drains as the stagger timer). The diamond marks where a parry + Shadow Step break its guard.
      const T = BW.WARDEN_TUNE, st = b.state === 'stagger', cap = T.poise[b.phase - 1], py = y + h + 9, ph = 10;
      const target = st ? Math.max(0, 1 - b.stateT / Math.max(0.01, b.stunDur)) : Math.min(1, (b.poise || 0) / cap) || 0;
      b.poiseShown = b.poiseShown == null ? target : b.poiseShown + (target - b.poiseShown) * (target < b.poiseShown ? 0.2 : 0.35);
      const pk = b.poiseShown, win = Math.max(b.parryT || 0, b.dodgeT || 0), ready = !st && b.comboReady(), hot = st || win > 0;
      const pulse = !st && pk > 0.85 ? 0.7 + 0.3 * Math.sin(g.time * 16) : 1;
      ctx.fillStyle = 'rgba(14,18,24,0.95)'; ctx.fillRect(x, py, w, ph);
      const pg = ctx.createLinearGradient(x, 0, x + w, 0);
      if (st) { pg.addColorStop(0, b.broken ? '#ffb347' : '#e8b85a'); pg.addColorStop(1, '#fff3c8'); }
      else if (hot) { pg.addColorStop(0, b.lastKind === 'dodge' ? '#7d5fd0' : '#d9a441'); pg.addColorStop(1, b.lastKind === 'dodge' ? '#d9c8ff' : '#fff0c2'); }
      else { pg.addColorStop(0, '#3f7d96'); pg.addColorStop(1, '#a6e3f2'); }
      const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * pulse; ctx.fillStyle = pg; ctx.fillRect(x, py, w * pk, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, py, w * pk, 2);
      if (st) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,230,160,${0.18 + 0.12 * Math.sin(g.time * 20)})`; ctx.fillRect(x, py, w * pk, ph); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = a0;
      ctx.fillStyle = 'rgba(6,7,10,0.55)';
      for (let i = 1; i < 10; i++) ctx.fillRect(x + w * i / 10 - 0.5, py, 1, ph);
      ctx.strokeStyle = hot ? 'rgba(255,226,160,0.85)' : 'rgba(236,222,190,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, py + 0.5, w - 1, ph - 1);
      const mx = x + w * T.combo.need;
      ctx.save(); ctx.translate(mx, py + ph / 2); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = ready ? '#ffe2a8' : 'rgba(14,18,24,0.95)'; ctx.fillRect(-4, -4, 8, 8);
      ctx.strokeStyle = ready ? '#fff6dc' : 'rgba(236,222,190,0.7)'; ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
      if (win > 0 && !st) {
        ctx.fillStyle = 'rgba(255,226,160,0.9)'; ctx.fillRect(x, py + ph + 3, w * Math.min(1, win / T.combo.window), 2);
      }
      ctx.restore();
    }
    const bt = g.bossTitle;
    if (bt) {
      const a = Math.max(0, Math.min(1, bt.t / 0.6, (bt.life - bt.t) / 0.8));
      const y = BW.VH * 0.7;
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 20;
      ctx.font = `italic 500 26px ${BW.FONT_B}`; ctx.fillStyle = '#e2d3b4'; ctx.fillText(bt.sub, BW.VW / 2, y - 52);
      ctx.font = `600 64px ${BW.FONT_T}`; ctx.fillStyle = '#fff3dc'; ctx.fillText(bt.name.toUpperCase(), BW.VW / 2, y);
      ctx.shadowBlur = 0;
      const lw = 160 + Math.min(1, bt.t / 1.4) * 260;
      ctx.strokeStyle = 'rgba(240,200,140,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(BW.VW / 2 - lw, y + 46); ctx.lineTo(BW.VW / 2 - 14, y + 46); ctx.moveTo(BW.VW / 2 + 14, y + 46); ctx.lineTo(BW.VW / 2 + lw, y + 46); ctx.stroke();
      ctx.fillStyle = '#ffcf8a'; ctx.save(); ctx.translate(BW.VW / 2, y + 46); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
      ctx.restore();
    }
  };

  // world-space prompt over the player while the first peals roll in
  BW.drawPealHint = function (ctx, g) {
    if (!(g.pealHint > 0) || !g.state.abilities.dash) return;
    const p = g.player, a = Math.min(1, g.pealHint / 0.4, (2.4 - g.pealHint) / 0.3 + 0.2);
    g.hud.worldPrompt(ctx, p.cx, p.y - 46, { act: 'dash' }, 'Jump, then dash across the toll', Math.max(0, a));
  };

  BW.Ending = Ending;
})(window.BW);

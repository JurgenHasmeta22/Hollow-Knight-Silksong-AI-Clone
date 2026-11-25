'use strict';
// World map: explored rooms drawn to scale with their walls, thorns and ledges, the exits you have not taken yet
// (and a "?" where they lead), pins for lanterns, toll-looms and other landmarks, an objective marker, area
// progress and a legend. Lantern (zoom), Mend (re-centre) and the stick or arrows (pan) drive the view.
(function (BW) {
  const T = BW.T, M = BW.Menu.prototype;
  const VIEW = { x: 50, y: 78, w: 910, h: 518 };
  const SIDE = { x: 980, y: 78, w: 250, h: 518 };
  const ZOOMS = [1, 2, 3.4];
  const GOLD = '#e8c98a', CREAM = '#f2e6cc';
  const AREA_ORDER = ['mosslit', 'spindle', 'belfry', 'cathedral'];

  // ---- exits between rooms ----------------------------------------------------------------
  // Rooms share one tile grid, so a link is a run of open tiles along an edge where two rooms touch.
  let LINKS = null;
  const open = (c) => c === '.' || c === '=' || c === 'G';
  function links() {
    if (LINKS) return LINKS;
    LINKS = [];
    for (const a of BW.ROOM_LIST) for (const b of BW.ROOM_LIST) {
      if (a === b) continue;
      let run = null;
      if (a.x + a.w === b.x) {            // a lies left of b
        const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h);
        for (let y = y0; y <= y1; y++) {
          if (y < y1 && open(a.grid[y - a.y][a.w - 1]) && open(b.grid[y - b.y][0])) {
            if (run) run.to = y + 1; else run = { a, b, v: true, edge: b.x, from: y, to: y + 1 };
          } else if (run) { LINKS.push(run); run = null; }
        }
      }
      if (a.y + a.h === b.y) {            // a lies above b
        const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w);
        for (let x = x0; x <= x1; x++) {
          if (x < x1 && open(a.grid[a.h - 1][x - a.x]) && open(b.grid[0][x - b.x])) {
            if (run) run.to = x + 1; else run = { a, b, v: false, edge: b.y, from: x, to: x + 1 };
          } else if (run) { LINKS.push(run); run = null; }
        }
      }
    }
    return LINKS;
  }

  // ---- room bitmaps (one pixel per tile, cached) ------------------------------------------
  M.roomMap = function (def) {
    if (this.mapCanvas[def.id]) return this.mapCanvas[def.id];
    const w = def.w, h = def.h, c = BW.makeCanvas(w, h), x = c.getContext('2d'), im = x.createImageData(w, h);
    const [r, g, b] = BW.hexToRgb(BW.AREAS[def.area].mapColor);
    const solid = (xx, yy) => { if (xx < 0 || yy < 0 || xx >= w || yy >= h) return true; const ch = def.grid[yy][xx]; return ch === '#' || ch === 'B'; };
    const put = (i, R, G, B, A) => { im.data[i] = R; im.data[i + 1] = G; im.data[i + 2] = B; im.data[i + 3] = A; };
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const ch = def.grid[yy][xx], i = (yy * w + xx) * 4;
      if (solid(xx, yy)) {
        const wall = !solid(xx - 1, yy) || !solid(xx + 1, yy) || !solid(xx, yy - 1) || !solid(xx, yy + 1);
        if (wall) put(i, r * 0.5 + 10, g * 0.5 + 10, b * 0.5 + 12, 255);
        else put(i, 13, 15, 21, 235);
      } else if (ch === '^') put(i, 232, 84, 84, 255);
      else if (ch === '=') put(i, 255, 240, 204, 255);
      else if (ch === 'G') put(i, 255, 208, 120, 255);
      else put(i, r * 0.82, g * 0.82, b * 0.82, 200);
    }
    x.putImageData(im, 0, 0);
    this.mapCanvas[def.id] = c; return c;
  };

  // ---- view -------------------------------------------------------------------------------
  M.mapLayout = function (st) {
    const g = this.game, vis = (r) => !!st.visited[r.id];
    const rooms = new Set(), ghosts = new Set();
    for (const r of BW.ROOM_LIST) if (vis(r)) rooms.add(r);
    if (!rooms.size && g.room) rooms.add(g.room.def);
    for (const l of links()) {
      if (rooms.has(l.a) && !rooms.has(l.b)) ghosts.add(l.b);
      else if (rooms.has(l.b) && !rooms.has(l.a)) ghosts.add(l.a);
    }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const r of [...rooms, ...ghosts]) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); }
    const m = 3, z = ZOOMS[this.mapZoom || 0];
    const fit = Math.min(VIEW.w / (maxX - minX + 2 * m), VIEW.h / (maxY - minY + 2 * m), 9);
    const s = fit * z, p = g.player;
    const me = g.room ? { x: g.room.def.x + p.cx / T, y: g.room.def.y + p.cy / T } : null;
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (z > 1 && me) { cx = me.x; cy = me.y; }
    const pan = this.mapPan;
    // keep the view centre inside the explored area
    const wx = Math.max(minX, Math.min(maxX, cx - pan.x / s)), wy = Math.max(minY, Math.min(maxY, cy - pan.y / s));
    pan.x = (cx - wx) * s; pan.y = (cy - wy) * s;
    return { s, rooms, ghosts, me, minX, minY, maxX, maxY, z,
      ox: VIEW.x + VIEW.w / 2 - cx * s + pan.x, oy: VIEW.y + VIEW.h / 2 - cy * s + pan.y };
  };

  // Where the current objective can be found, if that place is already on the map
  M.mapObjective = function (st) {
    const f = st.flags;
    if (f.ending_seen || f.warden_met || f.warden_defeated) return null;
    const want = f.cathedral_open || f.reached_cathedral ? (e) => e.type === 'door'
      : f.bell1 && f.bell2 ? (e) => e.type === 'seal' && !f.belfry_open
        : (e) => e.type === 'toll' && !f['bell' + e.bell];
    for (const r of BW.ROOM_LIST) {
      if (!st.visited[r.id]) continue;
      for (const e of r.ents) if (want(e)) return { x: r.x + e.x + 0.5, y: r.y + e.y + 0.5 };
    }
    return null;
  };

  M.mapUpdate = function (dt, inp) {
    const sp = 520 * dt, pan = this.mapPan;
    if (this.mapZoom == null) this.mapZoom = 0;
    if (inp.down.left) pan.x += sp;
    if (inp.down.right) pan.x -= sp;
    if (inp.down.up) pan.y += sp;
    if (inp.down.down) pan.y -= sp;
    if (inp.pressed.lance) { this.mapZoom = (this.mapZoom + 1) % ZOOMS.length; this.mapPan = { x: 0, y: 0 }; BW.Audio.play('ui_move'); }
    if (inp.pressed.heal) { this.mapPan = { x: 0, y: 0 }; BW.Audio.play('ui_move'); }
    if (inp.pressed.map || inp.pressed.back || inp.pressed.pause || inp.pressed.confirm || inp.pressed.jump) {
      BW.Audio.play('ui_back'); if (this.stack.length > 1) this.pop(); else this.closeAll();
    }
  };

  // ---- drawing ----------------------------------------------------------------------------
  M.drawMap = function (ctx) {
    const g = this.game, st = g.state, t = this.t, lay = this.mapLayout(st);
    const { s, ox, oy, rooms, ghosts } = lay, u = Math.max(0.8, Math.min(1.6, 0.7 + s / 14));
    const px = (wx) => ox + wx * s, py = (wy) => oy + wy * s;
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,10,0.97)'; ctx.fillRect(0, 0, BW.VW, BW.VH);
    ctx.textBaseline = 'middle';

    // header
    ctx.textAlign = 'center'; ctx.font = `600 34px ${BW.FONT_T}`; ctx.fillStyle = CREAM; ctx.fillText('MAP', BW.VW / 2, 34);
    ctx.textAlign = 'left'; ctx.font = `italic 500 20px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.8)';
    const here = g.room ? g.room.def : null;
    if (here) ctx.fillText(`${here.name}, ${BW.AREAS[here.area].name}`, VIEW.x, 36);
    const lit = Object.keys(st.lanternsLit || {}).filter((k) => st.lanternsLit[k]).length;
    ctx.textAlign = 'right'; ctx.fillText(`${BW.ROOM_LIST.filter((r) => st.visited[r.id]).length} / ${BW.ROOM_LIST.length} rooms   \u00B7   ${lit} lanterns lit   \u00B7   ${BW.Lore.count(st)} / ${BW.Lore.NOTES.length} notes`, SIDE.x + SIDE.w, 36);

    // viewport
    BW.roundRect(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 12);
    const bg = ctx.createRadialGradient(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2, 60, VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2, VIEW.w * 0.62);
    bg.addColorStop(0, 'rgba(24,27,38,0.95)'); bg.addColorStop(1, 'rgba(9,10,15,0.98)');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); ctx.clip();

    // survey grid
    ctx.strokeStyle = 'rgba(232,201,138,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
    const gx0 = Math.floor((VIEW.x - ox) / s / 10) * 10, gx1 = (VIEW.x + VIEW.w - ox) / s, gy0 = Math.floor((VIEW.y - oy) / s / 10) * 10, gy1 = (VIEW.y + VIEW.h - oy) / s;
    for (let gx = gx0; gx <= gx1; gx += 10) { const x = Math.round(px(gx)) + 0.5; ctx.moveTo(x, VIEW.y); ctx.lineTo(x, VIEW.y + VIEW.h); }
    for (let gy = gy0; gy <= gy1; gy += 10) { const y = Math.round(py(gy)) + 0.5; ctx.moveTo(VIEW.x, y); ctx.lineTo(VIEW.x + VIEW.w, y); }
    ctx.stroke();

    // rooms you have seen the edge of but not entered
    ctx.save(); ctx.setLineDash([7, 6]);
    for (const r of ghosts) {
      const x = px(r.x), y = py(r.y), w = r.w * s, h = r.h * s;
      ctx.fillStyle = 'rgba(232,201,138,0.05)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(232,201,138,0.38)'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = 'rgba(232,201,138,0.3)'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(Math.max(18, Math.min(46, Math.min(w, h) * 0.4)))}px ${BW.FONT_T}`;
      ctx.fillText('?', x + w / 2, y + h / 2);
    }
    ctx.restore();

    // explored rooms
    ctx.imageSmoothingEnabled = false;
    for (const r of rooms) {
      const x = px(r.x), y = py(r.y), w = r.w * s, h = r.h * s;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.drawImage(this.roomMap(r), x, y, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    for (const r of rooms) {
      const x = px(r.x), y = py(r.y), w = r.w * s, h = r.h * s, cur = here && here.id === r.id;
      ctx.strokeStyle = cur ? '#fff1c8' : BW.AREAS[r.area].mapColor; ctx.globalAlpha = cur ? 0.7 + 0.3 * Math.sin(t * 4) : 0.8; ctx.lineWidth = cur ? 2.5 : 1.5;
      if (cur) { ctx.shadowColor = 'rgba(255,230,170,0.8)'; ctx.shadowBlur = 12; }
      ctx.strokeRect(x, y, w, h); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // area names, then room names once zoomed in
    if (lay.z === 1) {
      ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(Math.max(13, Math.min(22, s * 2.2)))}px ${BW.FONT_T}`;
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';
      for (const k of AREA_ORDER) {
        const rs = [...rooms].filter((r) => r.area === k); if (!rs.length) continue;
        let cx = 0, cy = 0, n = 0; for (const r of rs) { cx += (r.x + r.w / 2) * r.w * r.h; cy += (r.y + r.h / 2) * r.w * r.h; n += r.w * r.h; }
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(BW.AREAS[k].name.toUpperCase(), px(cx / n) + 1, py(cy / n) + 2);
        ctx.fillStyle = BW.AREAS[k].mapColor; ctx.globalAlpha = 0.5; ctx.fillText(BW.AREAS[k].name.toUpperCase(), px(cx / n), py(cy / n)); ctx.globalAlpha = 1;
      }
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    } else {
      ctx.textAlign = 'left'; ctx.font = `600 14px ${BW.FONT_T}`; ctx.lineJoin = 'round'; ctx.lineWidth = 4;
      for (const r of rooms) {
        if (ctx.measureText(r.name).width + 14 > r.w * s) continue;
        ctx.strokeStyle = 'rgba(5,6,10,0.85)'; ctx.strokeText(r.name, px(r.x) + 7, py(r.y) + 15);
        ctx.fillStyle = 'rgba(245,235,210,0.92)'; ctx.fillText(r.name, px(r.x) + 7, py(r.y) + 15);
      }
    }

    // exits not yet taken
    for (const l of links()) {
      const av = rooms.has(l.a), bv = rooms.has(l.b); if (av === bv) continue;
      const mid = (l.from + l.to) / 2, dir = av ? 1 : -1;
      const x = l.v ? px(l.edge) : px(mid), y = l.v ? py(mid) : py(l.edge);
      pin(ctx, 'exit', x, y, true, u, t, l.v ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
    }

    // landmarks
    for (const r of rooms) for (const e of r.ents) {
      const x = px(r.x + e.x + 0.5), y = py(r.y + e.y + 0.5);
      if (e.type === 'lantern') pin(ctx, 'lantern', x, y, !!st.lanternsLit[e.id], u, t);
      else if (e.type === 'toll') pin(ctx, 'bell', x, y, !!st.flags['bell' + e.bell], u, t);
      else if (e.type === 'shrine') pin(ctx, 'shrine', x, y, !!st.abilities[e.ability || 'dash'], u, t);
      else if (e.type === 'npc') pin(ctx, 'npc', x, y, true, u, t);
      else if (e.type === 'seal') pin(ctx, 'seal', x, y, !!st.flags.belfry_open, u, t);
      else if (e.type === 'door') pin(ctx, 'door', x, y, false, u, t);
    }

    // lore notes: solid once read, a faint hollow hint while unread in a room you have seen
    for (const n of BW.Lore.NOTES) {
      const r = BW.ROOMS[n.room]; if (!r || !rooms.has(r)) continue;
      const got = BW.Lore.has(st, n.id);
      if (!got && n.when && !st.flags[n.when]) continue;
      pin(ctx, 'note', px(r.x + n.x + 0.5), py(r.y + n.y + 0.5), got, u, t);
    }

    // objective (an arrow on the edge of the view when it is off screen)
    const ob = this.mapObjective(st);
    if (ob) {
      const x = px(ob.x), y = py(ob.y), m = 22;
      if (x > VIEW.x + m && x < VIEW.x + VIEW.w - m && y > VIEW.y + m && y < VIEW.y + VIEW.h - m) pin(ctx, 'star', x, y - 16 * u, true, u, t);
      else {
        const cx = VIEW.x + VIEW.w / 2, cy = VIEW.y + VIEW.h / 2, a = Math.atan2(y - cy, x - cx);
        const k = Math.min((VIEW.w / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (VIEW.h / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
        ctx.save(); ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k); ctx.rotate(a);
        ctx.fillStyle = `rgba(255,214,120,${0.6 + 0.4 * Math.sin(t * 5)})`; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3, 0); ctx.lineTo(-7, 8); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
      }
    }

    // you
    if (lay.me) pin(ctx, 'you', px(lay.me.x), py(lay.me.y), true, u, t, g.player.facing < 0 ? Math.PI : 0);
    ctx.restore();
    BW.roundRect(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 12); ctx.strokeStyle = 'rgba(236,222,190,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();

    this.drawMapSide(ctx, st, t, u);
    this.drawMapFooter(ctx, st, t);
    ctx.restore();
  };

  M.drawMapSide = function (ctx, st, t, u) {
    const x = SIDE.x, w = SIDE.w;
    BW.roundRect(ctx, x, SIDE.y, w, SIDE.h, 12); ctx.fillStyle = 'rgba(12,14,21,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(236,222,190,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let y = SIDE.y + 26;
    ctx.font = `600 17px ${BW.FONT_T}`; ctx.fillStyle = GOLD; ctx.fillText('REGIONS', x + 20, y); y += 26;
    for (const k of AREA_ORDER) {
      const all = BW.ROOM_LIST.filter((r) => r.area === k); if (!all.length) continue;
      const n = all.filter((r) => st.visited[r.id]).length;
      ctx.fillStyle = BW.AREAS[k].mapColor; ctx.fillRect(x + 20, y - 7, 5, 14);
      ctx.font = `500 17px ${BW.FONT_B}`; ctx.fillStyle = n ? 'rgba(240,230,210,0.92)' : 'rgba(200,190,170,0.4)'; ctx.fillText(n ? BW.AREAS[k].name : '???', x + 34, y);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,201,138,0.8)'; ctx.fillText(`${n} / ${all.length}`, x + w - 20, y); ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 34, y + 11, w - 54, 4);
      ctx.fillStyle = BW.AREAS[k].mapColor; ctx.fillRect(x + 34, y + 11, (w - 54) * n / all.length, 4);
      y += 38;
    }
    y += 4; ctx.strokeStyle = 'rgba(232,201,138,0.2)'; ctx.beginPath(); ctx.moveTo(x + 20, y - 12); ctx.lineTo(x + w - 20, y - 12); ctx.stroke();
    ctx.font = `600 17px ${BW.FONT_T}`; ctx.fillStyle = GOLD; ctx.fillText('LEGEND', x + 20, y + 4); y += 30;
    const leg = [['you', true, 'You are here'], ['star', true, 'Objective'], ['lantern', true, 'Lantern, lit'], ['lantern', false, 'Lantern, unlit'], ['bell', false, 'Toll-loom'],
      ['shrine', false, 'Shrine'], ['npc', true, 'Lamplighter'], ['seal', false, 'Belfry seal'], ['door', false, 'Cathedral doors'], ['exit', true, 'Unexplored exit'], ['note', true, 'Lore note, read'], ['note', false, 'Lore note, unread']];
    ctx.font = `500 16px ${BW.FONT_B}`;
    for (const [k, on, label] of leg) {
      pin(ctx, k, x + 32, y, on, 1, t, 0); ctx.fillStyle = 'rgba(232,225,205,0.85)'; ctx.fillText(label, x + 54, y + 1); y += 23;
    }
  };

  M.drawMapFooter = function (ctx, st, t) {
    const G = BW.Glyphs, g = this.game, fy = VIEW.y + VIEW.h + 12, w = VIEW.w;
    BW.roundRect(ctx, VIEW.x, fy, w + SIDE.w + 20, 54, 10); ctx.fillStyle = 'rgba(12,14,21,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(236,222,190,0.22)'; ctx.lineWidth = 1; ctx.stroke();
    pin(ctx, 'star', VIEW.x + 28, fy + 27, true, 1.1, t);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `500 19px ${BW.FONT_B}`; ctx.fillStyle = '#f1e8d6';
    const lines = [], words = g.objectiveText().split(' '); let line = '';
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > w + SIDE.w - 80 && line) { lines.push(line); line = wd; } else line = test; }
    lines.push(line);
    lines.slice(0, 2).forEach((l, i, a) => ctx.fillText(l, VIEW.x + 56, fy + 27 + (i - (a.length - 1) / 2) * 22));

    // controls
    const mode = G.mode(), H = 22, y = BW.VH - 24;
    const arrows = ['\u2190', '\u2191', '\u2193', '\u2192'];
    const items = [
      { label: 'Pan', w: () => mode === 'pad' ? H : arrows.length * (G.keyWidth(ctx, '\u2190', H) + 4) - 4, draw: (x) => { if (mode === 'pad') G.drawToken(ctx, 'LS', x, y, H); else { let cx = x; for (const a of arrows) cx += G.drawKeycap(ctx, a, cx, y, H) + 4; } } },
      { label: `Zoom ${ZOOMS[this.mapZoom || 0]}\u00D7`, w: () => G.actionWidth(ctx, 'lance', H), draw: (x) => G.drawAction(ctx, 'lance', x, y, H) },
      { label: 'Centre', w: () => G.actionWidth(ctx, 'heal', H), draw: (x) => G.drawAction(ctx, 'heal', x, y, H) },
      { label: 'Close', w: () => G.actionWidth(ctx, 'map', H), draw: (x) => G.drawAction(ctx, 'map', x, y, H) },
    ];
    ctx.font = `500 18px ${BW.FONT_B}`;
    const widths = items.map((it) => ctx.measureText(it.label).width + it.w() + 10);
    let x = (BW.VW - widths.reduce((a, b) => a + b, 0) - 36 * (items.length - 1)) / 2;
    items.forEach((it, i) => {
      it.draw(x); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `500 18px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.8)';
      ctx.fillText(it.label, x + it.w() + 10, y + 1); x += widths[i] + 36;
    });
  };

  // Map pins. rot is used by 'you' (facing) and 'exit' (which way the opening leads).
  function pin(ctx, kind, x, y, on, u, t, rot) {
    ctx.save(); ctx.translate(x, y); ctx.scale(u, u);
    ctx.lineJoin = 'round';
    if (kind === 'lantern') {
      if (on) { const gl = ctx.createRadialGradient(0, 0, 1, 0, 0, 15); gl.addColorStop(0, 'rgba(255,205,110,0.55)'); gl.addColorStop(1, 'rgba(255,205,110,0)'); ctx.fillStyle = gl; ctx.fillRect(-15, -15, 30, 30); }
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(7, -1, 0, 7); ctx.quadraticCurveTo(-7, -1, 0, -8); ctx.closePath();
      ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.stroke();
      if (on) { ctx.fillStyle = '#ffd27a'; ctx.fill(); ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.ellipse(0, 1, 2, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.lineWidth = 1.5; ctx.strokeStyle = '#9a948a'; ctx.stroke(); }
    } else if (kind === 'bell') {
      ctx.fillStyle = on ? '#ffe2a8' : '#8f8778'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
      BW.bellIcon(ctx, 0, 0, 8);
    } else if (kind === 'shrine') {
      ctx.rotate(Math.PI / 4); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeRect(-5.5, -5.5, 11, 11);
      ctx.fillStyle = on ? '#fff1c8' : '#c9b48a'; ctx.fillRect(-5.5, -5.5, 11, 11); ctx.fillStyle = on ? '#e8a84a' : '#6a5a40'; ctx.fillRect(-2, -2, 4, 4);
    } else if (kind === 'npc') {
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.stroke();
      ctx.fillStyle = '#9fc3e6'; ctx.fill(); ctx.fillStyle = '#e4f1ff'; ctx.beginPath(); ctx.arc(0, -1, 2, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'seal') {
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.moveTo(-6.5, 0); ctx.lineTo(6.5, 0); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = on ? '#ffe2a8' : '#c9c2d8'; ctx.stroke();
    } else if (kind === 'note') {
      ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(3, -6); ctx.lineTo(6, -3); ctx.lineTo(6, 6); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.stroke();
      if (on) {
        ctx.fillStyle = '#efe0b8'; ctx.fill();
        ctx.fillStyle = '#7a6440'; ctx.fillRect(-3, -2, 7, 1.2); ctx.fillRect(-3, 1, 7, 1.2); ctx.fillRect(-3, 4, 4, 1.2);
      } else { ctx.globalAlpha = 0.6; ctx.lineWidth = 1.4; ctx.strokeStyle = '#d8c79c'; ctx.stroke(); }
    } else if (kind === 'door') {
      ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-6, -2); ctx.arc(0, -2, 6, Math.PI, 0); ctx.lineTo(6, 8); ctx.closePath();
      ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.stroke(); ctx.fillStyle = '#d7d2e6'; ctx.fill();
      ctx.fillStyle = '#2a2733'; ctx.fillRect(-1, -8, 2, 16);
    } else if (kind === 'star') {
      const k = 1 + 0.12 * Math.sin(t * 5);
      ctx.scale(k, k);
      const gl = ctx.createRadialGradient(0, 0, 1, 0, 0, 18); gl.addColorStop(0, 'rgba(255,214,120,0.5)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = gl; ctx.fillRect(-18, -18, 36, 36);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.stroke(); ctx.fillStyle = '#ffd36e'; ctx.fill();
    } else if (kind === 'exit') {
      ctx.rotate(rot || 0);
      const a = 0.55 + 0.45 * Math.sin(t * 4);
      ctx.beginPath(); ctx.moveTo(-3 + 4 * (1 - a), -7); ctx.lineTo(6 + 4 * (1 - a), 0); ctx.lineTo(-3 + 4 * (1 - a), 7); ctx.lineTo(-1 + 4 * (1 - a), 0); ctx.closePath();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); ctx.fillStyle = `rgba(255,214,120,${0.55 + 0.45 * a})`; ctx.fill();
    } else if (kind === 'you') {
      const k = 0.5 + 0.5 * Math.sin(t * 5);
      const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 20); gl.addColorStop(0, `rgba(255,236,190,${0.55 + 0.25 * k})`); gl.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = gl; ctx.fillRect(-20, -20, 40, 40);
      ctx.rotate(rot || 0);
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fillStyle = '#fff1c8'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 8 + 3 * k, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(255,226,160,${0.7 - 0.4 * k})`; ctx.stroke();
    }
    ctx.restore();
  }
})(window.BW);

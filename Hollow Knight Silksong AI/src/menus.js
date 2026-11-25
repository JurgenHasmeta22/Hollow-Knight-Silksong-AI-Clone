'use strict';
// Title screen, pause menu, options, controls, save import/export, confirmations and the world map.
(function (BW) {
  const T = BW.T;

  class Menu {
    constructor(game) {
      this.game = game; this.stack = []; this.sel = 0; this.t = 0; this.msg = ''; this.msgT = 0;
      this.repeatT = 0; this.mapCanvas = {}; this.mapPan = { x: 0, y: 0 };
    }
    get screen() { return this.stack[this.stack.length - 1] || null; }
    get open() { return this.stack.length > 0; }
    push(name, data) { this.stack.push({ name, data: data || {} }); this.sel = this.firstEnabled(); this.t = 0; this.mapPan = { x: 0, y: 0 }; }
    pop() { this.stack.pop(); this.sel = 0; this.t = 0; if (this.screen && this.screen.lastSel != null) this.sel = this.screen.lastSel; }
    closeAll() { this.stack = []; }
    flash(m) { this.msg = m; this.msgT = 3.5; }
    firstEnabled() { const it = this.items(); for (let i = 0; i < it.length; i++) if (!it[i].disabled) return i; return 0; }

    items() {
      const g = this.game, s = this.screen; if (!s) return [];
      const st = BW.settings;
      switch (s.name) {
        case 'title': {
          const has = BW.Save.exists();
          return [
            { label: 'Continue', act: () => g.continueGame(), disabled: !has },
            { label: 'New Game', act: () => has ? this.push('confirm', { q: 'Start a new journey? Your current progress will be overwritten.', yes: () => { this.closeAll(); g.newGame(); } }) : (this.closeAll(), g.newGame()) },
            { label: 'Options', act: () => this.push('options') },
            { label: 'Controls', act: () => this.push('controls') },
            { label: 'Save Data', act: () => this.push('savedata') },
          ];
        }
        case 'pause': return [
          { label: 'Resume', act: () => this.closeAll() },
          { label: 'Map', act: () => this.push('map') },
          { label: 'Controls', act: () => this.push('controls') },
          { label: 'Options', act: () => this.push('options') },
          { label: 'Return to Last Lantern', act: () => this.push('confirm', { q: 'Return to the last lantern you rested at?', yes: () => { this.closeAll(); g.returnToLantern(); } }) },
          { label: 'Save & Quit to Title', act: () => { g.saveGame(); this.closeAll(); g.toTitle(); } },
        ];
        case 'options': return [
          { label: 'Master Volume', type: 'slider', get: () => st.master, set: (v) => { st.master = v; g.applySettings(); } },
          { label: 'Music Volume', type: 'slider', get: () => st.music, set: (v) => { st.music = v; g.applySettings(); } },
          { label: 'Effects Volume', type: 'slider', get: () => st.sfx, set: (v) => { st.sfx = v; g.applySettings(); BW.Audio.play('swing'); } },
          { label: 'Screen Shake', type: 'toggle', get: () => st.shake, set: (v) => { st.shake = v; g.applySettings(); } },
          { label: 'Control Hints', type: 'toggle', get: () => st.hints, set: (v) => { st.hints = v; g.applySettings(); } },
          { label: 'Fullscreen', type: 'toggle', get: () => !!document.fullscreenElement, set: () => g.toggleFullscreen() },
          { label: 'Resolution', type: 'choice', get: () => ({ auto: 'Auto', 1080: '1080p', 900: '900p', 720: '720p' })[st.res || 'auto'], set: (d) => { const o = ['auto', '1080', '900', '720']; st.res = o[(o.indexOf(st.res || 'auto') + d + o.length) % o.length]; g.autoCap = null; g.applySettings(); g.resize(); } },
          { label: 'Back', act: () => this.pop() },
        ];
        case 'controls': return [{ label: 'Back', act: () => this.pop() }];
        case 'savedata': return [
          { label: 'Export Save (download + copy)', act: () => { const ok = BW.Save.exportDownload(); this.flash(ok ? 'Save exported as bellweaver-save.json (also copied to clipboard).' : 'There is no save to export yet.'); } },
          { label: 'Import Save File', act: () => BW.Save.importFromFile((r) => { this.flash(r.msg); if (r.ok) g.onSaveImported(); }) },
          { label: 'Paste Save Text', act: () => { const txt = window.prompt('Paste the contents of a bellweaver-save.json file:'); if (txt) { const r = BW.Save.importText(txt); this.flash(r.msg); if (r.ok) g.onSaveImported(); } } },
          { label: 'Delete Save', act: () => this.push('confirm', { q: 'Delete your saved progress permanently?', yes: () => { BW.Save.erase(); this.pop(); this.flash('Save deleted.'); } }) , disabled: !BW.Save.exists() },
          { label: 'Back', act: () => this.pop() },
        ];
        case 'confirm': return [
          { label: 'Yes', act: () => { const y = s.data.yes; this.pop(); y(); } },
          { label: 'No', act: () => this.pop() },
        ];
        case 'map': return [];
        default: return [];
      }
    }

    update(dt, inp) {
      this.t += dt; this.msgT = Math.max(0, this.msgT - dt);
      const s = this.screen; if (!s) return;
      if (s.name === 'map') {
        const sp = 420 * dt;
        if (inp.down.left) this.mapPan.x += sp; if (inp.down.right) this.mapPan.x -= sp;
        if (inp.down.up) this.mapPan.y += sp; if (inp.down.down) this.mapPan.y -= sp;
        if (inp.pressed.map || inp.pressed.back || inp.pressed.pause || inp.pressed.confirm || inp.pressed.jump) {
          BW.Audio.play('ui_back'); if (this.stack.length > 1) this.pop(); else this.closeAll();
        }
        return;
      }
      const items = this.items();
      const move = (d) => {
        if (!items.length) return;
        let i = this.sel;
        for (let k = 0; k < items.length; k++) { i = (i + d + items.length) % items.length; if (!items[i].disabled) break; }
        if (i !== this.sel) { this.sel = i; BW.Audio.play('ui_move'); }
      };
      if (inp.pressed.up) move(-1);
      if (inp.pressed.down) move(1);
      // held repeat
      if (inp.down.up || inp.down.down) { this.repeatT += dt; if (this.repeatT > 0.38) { this.repeatT = 0.3; move(inp.down.up ? -1 : 1); } } else this.repeatT = 0;
      const it = items[this.sel];
      if (it && it.type === 'slider') {
        if (inp.pressed.left) { it.set(Math.max(0, Math.round((it.get() - 0.1) * 10) / 10)); BW.Audio.play('ui_move'); }
        if (inp.pressed.right) { it.set(Math.min(1, Math.round((it.get() + 0.1) * 10) / 10)); BW.Audio.play('ui_move'); }
      }
      if (it && it.type === 'toggle' && (inp.pressed.left || inp.pressed.right)) { it.set(!it.get()); BW.Audio.play('ui_move'); }
      if (it && it.type === 'choice' && (inp.pressed.left || inp.pressed.right)) { it.set(inp.pressed.left ? -1 : 1); BW.Audio.play('ui_move'); }
      if (inp.pressed.confirm && it && !it.disabled) {
        if (it.type === 'toggle') { it.set(!it.get()); BW.Audio.play('ui_ok'); }
        else if (it.type === 'choice') { it.set(1); BW.Audio.play('ui_ok'); }
        else if (it.act) { BW.Audio.play('ui_ok'); s.lastSel = this.sel; it.act(); }
      }
      if ((inp.pressed.back) && this.t > 0.1) {
        if (s.name === 'title') return;
        BW.Audio.play('ui_back');
        if (s.name === 'pause') this.closeAll(); else this.pop();
      }
      if (inp.pressed.pause && s.name === 'pause' && this.t > 0.1) { this.closeAll(); }
    }

    // ------------------------------------------------------------ drawing
    draw(ctx) {
      const s = this.screen; if (!s) return;
      if (s.name === 'title') return this.drawTitleMenu(ctx);
      if (s.name === 'map') return this.drawMap(ctx);
      ctx.save();
      ctx.fillStyle = 'rgba(3,4,8,0.78)'; ctx.fillRect(0, 0, BW.VW, BW.VH);
      ctx.restore();
      if (s.name === 'pause') this.drawPause(ctx);
      else if (s.name === 'controls') this.drawControls(ctx);
      else this.drawList(ctx, s.name === 'options' ? 'OPTIONS' : s.name === 'savedata' ? 'SAVE DATA' : '', BW.VH * 0.32);
      if (s.name === 'confirm') this.drawConfirm(ctx);
      this.drawMsg(ctx);
    }

    drawMsg(ctx) {
      if (this.msgT <= 0) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, this.msgT * 2); ctx.textAlign = 'center';
      ctx.font = `500 22px ${BW.FONT_B}`; ctx.fillStyle = '#ffe1a0'; ctx.fillText(this.msg, BW.VW / 2, BW.VH - 60); ctx.restore();
    }

    drawList(ctx, heading, y0, x0 = BW.VW / 2) {
      const items = this.items();
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (heading) { ctx.font = `600 40px ${BW.FONT_T}`; ctx.fillStyle = '#f2e6cc'; ctx.fillText(heading, x0, y0 - 80); ornament(ctx, x0, y0 - 46, 160); }
      items.forEach((it, i) => {
        const y = y0 + i * 50, on = i === this.sel;
        ctx.font = `${on ? 600 : 500} 30px ${BW.FONT_B}`;
        ctx.fillStyle = it.disabled ? 'rgba(200,190,170,0.3)' : on ? '#fff1d0' : 'rgba(225,214,192,0.75)';
        let label = it.label;
        if (it.type === 'slider') label = `${it.label}   ${bar(it.get())}`;
        if (it.type === 'toggle') label = `${it.label}   ${it.get() ? 'On' : 'Off'}`;
        if (it.type === 'choice') label = `${it.label}   \u2039 ${it.get()} \u203A`;
        ctx.fillText(label, x0, y);
        if (on && !it.disabled) {
          const w = ctx.measureText(label).width / 2 + 26;
          drawNeedleMark(ctx, x0 - w, y, 1, this.t); drawNeedleMark(ctx, x0 + w, y, -1, this.t);
        }
      });
      ctx.restore();
    }

    drawPause(ctx) {
      const g = this.game, st = g.state;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 44px ${BW.FONT_T}`; ctx.fillStyle = '#f2e6cc'; ctx.fillText('PAUSED', BW.VW * 0.3, 150);
      ornament(ctx, BW.VW * 0.3, 186, 150);
      ctx.restore();
      this.drawList(ctx, '', 260, BW.VW * 0.3);
      // journal panel
      const x = BW.VW * 0.56, y = 120, w = BW.VW * 0.38;
      ctx.save();
      ctx.fillStyle = 'rgba(14,16,22,0.7)'; BW.roundRect(ctx, x, y, w, 470, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(236,222,190,0.25)'; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = `600 22px ${BW.FONT_T}`; ctx.fillStyle = '#e8c98a'; ctx.fillText('JOURNAL', x + 26, y + 22);
      ctx.font = `500 24px ${BW.FONT_B}`; ctx.fillStyle = '#efe6d2';
      const room = g.room ? g.room.def : null;
      let yy = y + 64;
      ctx.fillStyle = '#cbbd9f'; ctx.font = `italic 500 21px ${BW.FONT_B}`;
      ctx.fillText(room ? `${room.name} — ${BW.AREAS[room.area].name}` : '', x + 26, yy); yy += 40;
      ctx.font = `500 23px ${BW.FONT_B}`; ctx.fillStyle = '#efe6d2';
      BW.wrapText(ctx, g.objectiveText(), x + 26, yy, w - 52, 29); yy += 120;
      const bells = (st.flags.bell1 ? 1 : 0) + (st.flags.bell2 ? 1 : 0);
      const rows = [
        ['Toll-looms rethreaded', `${bells} / 2`],
        ['Silk Dash', st.abilities.dash ? 'Learned' : 'Unknown'],
        ['Health bells', `${st.maxHp}`],
        ['Silk capacity', `${st.silkMax}`],
        ['Glints', `${st.glints}`],
        ['Rooms discovered', `${BW.ROOM_LIST.filter((r) => st.visited[r.id]).length} / ${BW.ROOM_LIST.length}`],
        ['Time', fmtTime(st.stats.playTime)],
      ];
      for (const [k, v] of rows) {
        ctx.fillStyle = 'rgba(225,214,192,0.75)'; ctx.fillText(k, x + 26, yy);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff1d0'; ctx.fillText(v, x + w - 26, yy); ctx.textAlign = 'left';
        yy += 34;
      }
      ctx.restore();
    }

    drawControls(ctx) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 40px ${BW.FONT_T}`; ctx.fillStyle = '#f2e6cc'; ctx.fillText('CONTROLS', BW.VW / 2, 90);
      ornament(ctx, BW.VW / 2, 124, 160);
      const rows = [
        ['Move', 'A / D  or  ← / →', 'Left Stick / D-Pad'],
        ['Aim attack up / down', 'W / S  or  ↑ / ↓', 'Stick up / down'],
        ['Jump (hold for height)', 'Space', 'A'],
        ['Needle strike', 'J', 'X'],
        ['Down strike (in air) — bounces', 'S + J', 'Down + X'],
        ['Silk Dash (once learned)', 'K  or  Shift', 'B  or  RT'],
        ['Silk Lance (3 silk)', 'L', 'Y'],
        ['Mend: hold to heal 1 (3 silk)', 'Hold Q', 'Hold LB / LT'],
        ['Interact / talk / rest', 'E  or  ↑', 'Up'],
        ['Drop through ledge', 'S + Space', 'Down + A'],
        ['Map', 'M  or  Tab', 'View / Back'],
        ['Pause', 'Esc', 'Menu / Start'],
      ];
      const x0 = BW.VW / 2 - 470, y0 = 160;
      ctx.font = `600 22px ${BW.FONT_T}`; ctx.fillStyle = '#e8c98a'; ctx.textAlign = 'left';
      ctx.fillText('ACTION', x0, y0); ctx.fillText('KEYBOARD', x0 + 430, y0); ctx.fillText('GAMEPAD', x0 + 730, y0);
      ctx.font = `500 24px ${BW.FONT_B}`;
      rows.forEach((r, i) => {
        const y = y0 + 42 + i * 36;
        ctx.fillStyle = 'rgba(225,214,192,0.85)'; ctx.fillText(r[0], x0, y);
        ctx.fillStyle = '#fff1d0'; ctx.fillText(r[1], x0 + 430, y); ctx.fillText(r[2], x0 + 730, y);
      });
      ctx.font = `italic 500 21px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.6)'; ctx.textAlign = 'center';
      ctx.fillText(BW.Input.padConnected ? 'Gamepad connected.' : 'Connect a gamepad at any time — it is detected automatically.', BW.VW / 2, BW.VH - 74);
      ctx.restore();
      this.drawList(ctx, '', BW.VH - 36);
    }

    drawConfirm(ctx) {
      const s = this.screen;
      ctx.save(); ctx.textAlign = 'center'; ctx.font = `500 28px ${BW.FONT_B}`; ctx.fillStyle = '#f2e6cc';
      BW.wrapText(ctx, s.data.q, BW.VW / 2 - 330, BW.VH * 0.28, 660, 34);
      ctx.restore();
    }

    // completion mark for the title screen (save read at most once a second)
    titleCleared() {
      const now = this.game.titleT;
      if (this.clrAt == null || Math.abs(now - this.clrAt) > 1) { const d = BW.Save.readRaw(); this.clr = !!(d && d.flags && d.flags.ending_seen); this.clrAt = now; }
      return this.clr;
    }

    drawTitleMenu(ctx) {
      const g = this.game;
      const tt = g.titleT;
      g.drawTitleBackdrop(ctx, tt);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const a = Math.min(1, Math.max(0, tt - 0.6) / 1.4);
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 24;
      ctx.font = `600 104px ${BW.FONT_T}`; ctx.fillStyle = '#f7ecd6';
      spaced(ctx, 'BELLWEAVER', BW.VW / 2, 190, 10);
      ctx.shadowBlur = 0;
      ctx.font = `italic 500 30px ${BW.FONT_B}`; ctx.fillStyle = '#e1d2b2';
      ctx.fillText('a thread through the silent bells', BW.VW / 2, 262);
      ornament(ctx, BW.VW / 2, 300, 210);
      if (this.titleCleared()) { ctx.font = `italic 500 22px ${BW.FONT_B}`; ctx.fillStyle = '#e8c98a'; ctx.fillText('✦  The Great Bell rings again  ✦', BW.VW / 2, 338); }
      ctx.restore();
      if (!g.started) {
        ctx.save(); ctx.textAlign = 'center'; ctx.font = `500 28px ${BW.FONT_B}`; ctx.fillStyle = `rgba(240,230,210,${Math.min(1, Math.max(0, tt - 1.8)) * (0.5 + Math.sin(tt * 2.5) * 0.35)})`;
        ctx.fillText('Press any key or button', BW.VW / 2, BW.VH * 0.66); ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(BW.VW / 2 - 220, 380, 440, 270); ctx.restore();
        this.drawList(ctx, '', 410);
      }
      ctx.save(); ctx.font = `500 17px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(230,220,200,0.5)'; ctx.textAlign = 'right';
      ctx.fillText(`Stage ${BW.BUILD_STAGE} build · v${BW.VERSION}`, BW.VW - 24, BW.VH - 22);
      ctx.textAlign = 'left'; ctx.fillText('An original game · art and audio generated with Higgsfield', 24, BW.VH - 22);
      ctx.restore();
      this.drawMsg(ctx);
    }

    // ------------------------------------------------------------ world map
    roomMap(def) {
      if (this.mapCanvas[def.id]) return this.mapCanvas[def.id];
      const c = BW.makeCanvas(def.w, def.h), x = c.getContext('2d');
      const im = x.createImageData(def.w, def.h);
      const [r, g, b] = BW.hexToRgb(BW.AREAS[def.area].mapColor);
      for (let yy = 0; yy < def.h; yy++) for (let xx = 0; xx < def.w; xx++) {
        const ch = def.grid[yy][xx], i = (yy * def.w + xx) * 4;
        const solid = ch === '#' || ch === 'B';
        if (solid) { im.data[i] = 18; im.data[i + 1] = 20; im.data[i + 2] = 26; im.data[i + 3] = 170; }
        else { im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = ch === '^' ? 120 : 235; }
      }
      x.putImageData(im, 0, 0);
      this.mapCanvas[def.id] = c; return c;
    }

    drawMap(ctx) {
      const g = this.game, st = g.state;
      ctx.save();
      ctx.fillStyle = 'rgba(6,7,10,0.94)'; ctx.fillRect(0, 0, BW.VW, BW.VH);
      // parchment frame
      ctx.strokeStyle = 'rgba(236,222,190,0.25)'; ctx.lineWidth = 2; BW.roundRect(ctx, 30, 30, BW.VW - 60, BW.VH - 60, 16); ctx.stroke();
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const r of BW.ROOM_LIST) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); }
      const s = Math.min((BW.VW - 180) / (maxX - minX), (BW.VH - 190) / (maxY - minY));
      const ox = (BW.VW - (maxX - minX) * s) / 2 - minX * s + this.mapPan.x;
      const oy = 96 + ((BW.VH - 190) - (maxY - minY) * s) / 2 - minY * s + this.mapPan.y;
      ctx.imageSmoothingEnabled = false;
      for (const r of BW.ROOM_LIST) {
        if (!st.visited[r.id]) continue;
        const x = ox + r.x * s, y = oy + r.y * s;
        ctx.drawImage(this.roomMap(r), x, y, r.w * s, r.h * s);
        ctx.strokeStyle = g.room && g.room.id === r.id ? 'rgba(255,236,190,0.9)' : 'rgba(236,222,190,0.35)';
        ctx.lineWidth = g.room && g.room.id === r.id ? 2 : 1;
        ctx.strokeRect(x, y, r.w * s, r.h * s);
      }
      ctx.imageSmoothingEnabled = true;
      // landmarks
      for (const r of BW.ROOM_LIST) {
        if (!st.visited[r.id]) continue;
        for (const e of r.ents) {
          const x = ox + (r.x + e.x + 0.5) * s, y = oy + (r.y + e.y + 0.5) * s;
          if (e.type === 'lantern') icon(ctx, 'lantern', x, y, !!st.lanternsLit[e.id]);
          else if (e.type === 'toll') icon(ctx, 'bell', x, y, !!st.flags['bell' + e.bell]);
          else if (e.type === 'shrine') icon(ctx, 'shrine', x, y, !!st.abilities.dash);
          else if (e.type === 'npc') icon(ctx, 'npc', x, y, true);
          else if (e.type === 'seal') icon(ctx, 'seal', x, y, !!st.flags.belfry_open);
          else if (e.type === 'door') icon(ctx, 'door', x, y, false);
        }
      }
      // player
      if (g.room) {
        const p = g.player;
        const x = ox + (g.room.def.x + p.cx / T) * s, y = oy + (g.room.def.y + p.cy / T) * s;
        const k = 0.6 + Math.sin(this.t * 6) * 0.4;
        ctx.fillStyle = `rgba(255,214,140,${k})`; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      // area labels
      ctx.textAlign = 'center'; ctx.font = `600 16px ${BW.FONT_T}`;
      const labels = { mosslit: [], spindle: [], belfry: [] };
      for (const r of BW.ROOM_LIST) if (st.visited[r.id]) labels[r.area].push(r);
      for (const k in labels) {
        if (!labels[k].length) continue;
        let cx = 0, cy = 0; for (const r of labels[k]) { cx += r.x + r.w / 2; cy += r.y + r.h / 2; }
        cx /= labels[k].length; cy /= labels[k].length;
        ctx.fillStyle = 'rgba(240,228,204,0.55)'; ctx.fillText(BW.AREAS[k].name.toUpperCase(), ox + cx * s, oy + cy * s - 8);
      }
      // header + legend
      ctx.font = `600 34px ${BW.FONT_T}`; ctx.fillStyle = '#f2e6cc'; ctx.fillText('MAP', BW.VW / 2, 70);
      ctx.font = `500 19px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.7)'; ctx.textAlign = 'left';
      const lx = 64, ly = BW.VH - 62;
      const leg = [['lantern', 'Rest lantern'], ['bell', 'Toll-loom'], ['shrine', 'Shrine'], ['npc', 'Lamplighter'], ['seal', 'Belfry seal'], ['door', 'Cathedral doors']];
      let xx = lx;
      for (const [k, l] of leg) { icon(ctx, k, xx + 8, ly, true); ctx.fillText(l, xx + 22, ly + 1); xx += ctx.measureText(l).width + 60; }
      ctx.textAlign = 'right'; ctx.fillText(`${BW.Input.label('map')} / ${BW.Input.label('back')}: close   ·   ${BW.Input.device === 'pad' ? 'Stick' : 'Arrows'}: pan`, BW.VW - 64, ly + 1);
      ctx.restore();
    }
  }

  function icon(ctx, kind, x, y, on) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'lantern') { ctx.fillStyle = on ? '#ffcf7a' : '#77706a'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(6, 0, 0, 7); ctx.quadraticCurveTo(-6, 0, 0, -7); ctx.fill(); }
    else if (kind === 'bell') { ctx.fillStyle = on ? '#ffe2a8' : '#8f8778'; BW.bellIcon(ctx, 0, 0, 7); }
    else if (kind === 'shrine') { ctx.fillStyle = on ? '#fff1c8' : '#c9b48a'; ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); }
    else if (kind === 'npc') { ctx.fillStyle = '#9fc3e6'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === 'seal') { ctx.strokeStyle = on ? '#ffe2a8' : '#c9c2d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); }
    else if (kind === 'door') { ctx.fillStyle = '#d7d2e6'; ctx.fillRect(-5, -7, 10, 14); ctx.fillStyle = '#2a2733'; ctx.fillRect(-1, -7, 2, 14); }
    ctx.restore();
  }
  function bar(v) { const n = Math.round(v * 10); return '■'.repeat(n) + '□'.repeat(10 - n); }
  function fmtTime(s) { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0'); }
  function ornament(ctx, x, y, w) {
    ctx.save(); ctx.strokeStyle = 'rgba(240,226,196,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - 12, y); ctx.moveTo(x + 12, y); ctx.lineTo(x + w, y); ctx.stroke();
    ctx.fillStyle = '#efe0c0'; ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  }
  function drawNeedleMark(ctx, x, y, dir, t) {
    ctx.save(); ctx.translate(x + Math.sin(t * 5) * 3 * dir, y);
    ctx.strokeStyle = '#efe2c6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-dir * 18, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-dir * 22, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function spaced(ctx, text, x, y, sp) {
    const w = ctx.measureText(text).width + sp * (text.length - 1);
    let cx = x - w / 2;
    ctx.textAlign = 'left';
    for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
    ctx.textAlign = 'center';
  }

  BW.Menu = Menu;
  BW.fmtTime = fmtTime;
})(window.BW);

'use strict';
// The Archive screen (pause menu): Tips & Mechanics, a Bestiary whose entries unlock as creatures are met, and the Lore notes found in the world.
(function (BW) {
  const M = BW.Menu.prototype;
  const GOLD = '#e8c98a', CREAM = '#f2e6cc';
  const PX = 410, PY = 150, PW = 810, PH = 490;           // detail panel
  const LX = 60, LW = 330, ROW = 44;                      // list panel (shares PY / PH)
  const BODY_Y = 150, BODY_H = PH - 150 - 34;             // text area inside the panel
  const FONT = 20, LH = 27;

  // the save being browsed: the live game, or the saved one from the title screen (all locked if there is none)
  M.guideState = function () {
    const g = this.game;
    if (g.mode === 'play' && g.state) return g.state;
    const d = this.screen.data;
    if (!d.st) d.st = BW.Save.exists() ? BW.Save.load() : { abilities: {}, flags: {}, stats: {}, difficulty: BW.Difficulty.DEFAULT, codex: { seen: {}, kills: {}, moves: {}, tips: {} } };
    return d.st;
  };

  M.guideItems = function () {
    const s = this.screen, st = this.guideState(), C = BW.Codex, c = C.data(st);
    const turn = () => { s.data.page = (s.data.page + 1) % Math.max(1, s.data.pageCount || 1); };
    if (!s.data.tab) return C.TIPS.map((t) => ({ label: C.tipOpen(st, t) ? t.title : '???', cat: t.cat, tip: t, locked: !C.tipOpen(st, t), act: turn }));
    if (s.data.tab === 2) return BW.Lore.NOTES.map((n) => { const got = BW.Lore.has(st, n.id); return { label: got ? n.title : '???', note: n, locked: !got, act: turn }; });
    return C.BEASTS.map((b) => ({ label: c.seen[b.id] ? b.name : '???', beast: b, locked: !c.seen[b.id], act: turn }));
  };

  function wrapLines(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(' ')) {
        const t = line ? line + ' ' + w : w;
        if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  // blocks: [{h, t: [paragraphs], dim}] packed into pages of BODY_H pixels. A block is never split.
  function paginate(ctx, blocks, w) {
    const pages = [[]]; let used = 0;
    for (const b of blocks) {
      ctx.font = `500 ${FONT}px ${BW.FONT_B}`;
      const paras = b.t.map((p) => wrapLines(ctx, p, w));
      const h = (b.h ? 32 : 0) + paras.reduce((a, l) => a + l.length * LH, 0) + (paras.length - 1) * 8 + 16;
      if (used + h > BODY_H && pages[pages.length - 1].length) { pages.push([]); used = 0; }
      pages[pages.length - 1].push({ h: b.h, paras, dim: b.dim });
      used += h;
    }
    return pages;
  }

  M.guideBlocks = function (it, st) {
    const C = BW.Codex, c = C.data(st), D = BW.Difficulty.get(st);
    if (it.tip) {
      if (it.locked) return [{ t: ['You have not learned this yet. It will be written here once you do.'], dim: true }];
      return [{ t: it.tip.body(D) }];
    }
    if (it.note) {
      if (it.locked) return [{ h: 'Not yet found', t: [it.note.hint + ' Notes are collected by reading them where they lie.'], dim: true }];
      return [{ t: it.note.text }, { h: 'Written by', t: [it.note.from] }];
    }
    const b = it.beast, kills = c.kills[b.id] || 0;
    if (it.locked) return [{ h: 'Undiscovered', t: [b.hint + ' Meet it in the world and its entry will fill in.'], dim: true }];
    const blocks = [
      { h: 'Lore', t: b.lore },
      { h: 'Behaviour', t: [b.habits] },
      kills ? { h: b.boss ? 'Strategy' : "Hunter\u2019s notes", t: [b.notes] }
        : { h: b.boss ? 'Strategy' : "Hunter\u2019s notes", t: [b.boss ? 'Defeat it to complete these notes.' : 'Defeat one to learn how best to fight it.'], dim: true },
    ];
    for (const [id, name, text] of b.moves || []) {
      const seen = c.moves[b.id + ':' + id];
      blocks.push(seen ? { h: name, t: [text] } : { h: '???', t: ['You have not witnessed this attack yet.'], dim: true });
    }
    return blocks;
  };

  M.drawGuide = function (ctx) {
    const s = this.screen, d = s.data, st = this.guideState(), C = BW.Codex, c = C.data(st);
    if (d.tab == null) { d.tab = 0; d.page = 0; d.scroll = 0; }
    const items = this.guideItems(), it = items[Math.min(this.sel, items.length - 1)];
    if (d.lastSel !== this.sel || d.lastTab !== d.tab) { d.page = 0; d.lastSel = this.sel; d.lastTab = d.tab; }
    ctx.save(); ctx.textBaseline = 'middle';

    // heading and tabs
    ctx.textAlign = 'center';
    ctx.font = `600 44px ${BW.FONT_T}`; ctx.fillStyle = CREAM; ctx.fillText('ARCHIVE', BW.VW / 2, 56);
    const tabs = ['Tips & Mechanics', `Bestiary  ${C.found(st)}/${C.BEASTS.length}`, `Lore  ${BW.Lore.count(st)}/${BW.Lore.NOTES.length}`];
    ctx.font = `600 26px ${BW.FONT_B}`;
    tabs.forEach((label, i) => {
      const x = BW.VW / 2 + (i - 1) * 310, on = i === d.tab, w = ctx.measureText(label).width;
      ctx.fillStyle = on ? '#fff1d0' : 'rgba(225,214,192,0.45)'; ctx.fillText(label, x, 112);
      if (on) { ctx.fillStyle = GOLD; ctx.fillRect(x - w / 2 - 8, 130, w + 16, 2); }
    });
    ctx.fillStyle = 'rgba(225,214,192,0.5)'; ctx.font = `500 24px ${BW.FONT_B}`;
    ctx.fillText('\u2039', BW.VW / 2 - 500, 112); ctx.fillText('\u203A', BW.VW / 2 + 500, 112);

    // list panel
    this.guidePanel(ctx, LX, PY, LW, PH);
    const vis = Math.floor((PH - 20) / ROW);
    if (this.sel < d.scroll) d.scroll = this.sel;
    if (this.sel >= d.scroll + vis) d.scroll = this.sel - vis + 1;
    ctx.save(); ctx.beginPath(); ctx.rect(LX, PY + 4, LW, PH - 8); ctx.clip();
    items.forEach((row, i) => {
      if (i < d.scroll || i >= d.scroll + vis) return;
      const y = PY + 10 + (i - d.scroll) * ROW + ROW / 2, on = i === this.sel;
      if (on) { ctx.fillStyle = 'rgba(232,201,138,0.14)'; ctx.fillRect(LX + 6, y - ROW / 2 + 2, LW - 12, ROW - 4); ctx.fillStyle = GOLD; ctx.fillRect(LX + 6, y - ROW / 2 + 2, 3, ROW - 4); }
      ctx.textAlign = 'left'; ctx.font = `${on ? 600 : 500} 23px ${BW.FONT_B}`;
      ctx.fillStyle = row.locked ? 'rgba(200,190,170,0.4)' : on ? '#fff1d0' : 'rgba(225,214,192,0.8)';
      ctx.fillText(row.label, LX + 24, y);
      if (row.cat) { ctx.textAlign = 'right'; ctx.font = `500 15px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(232,201,138,0.5)'; ctx.fillText(row.locked ? '' : row.cat, LX + LW - 18, y); }
      else if (row.beast && !row.locked && (c.kills[row.beast.id] || 0) > 0) { ctx.textAlign = 'right'; ctx.font = `500 15px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(232,201,138,0.6)'; ctx.fillText(row.beast.boss ? 'Defeated' : 'Studied', LX + LW - 18, y); }
    });
    ctx.restore();
    if (items.length > vis) {
      ctx.fillStyle = 'rgba(232,201,138,0.5)'; ctx.textAlign = 'center'; ctx.font = `500 16px ${BW.FONT_B}`;
      if (d.scroll > 0) ctx.fillText('\u25B2', LX + LW / 2, PY + 8);
      if (d.scroll + vis < items.length) ctx.fillText('\u25BC', LX + LW / 2, PY + PH - 8);
    }

    // detail panel
    this.guidePanel(ctx, PX, PY, PW, PH);
    if (it) {
      if (it.tip) this.guideTipHeader(ctx, it);
      else if (it.note) this.guideNoteHeader(ctx, it);
      else this.guideBeastHeader(ctx, it, st);
      const blocks = this.guideBlocks(it, st), key = JSON.stringify(blocks);
      if (d.cacheKey !== key) { d.cacheKey = key; d.pages = paginate(ctx, blocks, PW - 70); }
      d.pageCount = d.pages.length; d.page = Math.min(d.page, d.pageCount - 1);
      let y = PY + BODY_Y;
      for (const b of d.pages[d.page]) {
        ctx.textAlign = 'left';
        if (b.h) { ctx.font = `600 19px ${BW.FONT_B}`; ctx.fillStyle = b.dim ? 'rgba(232,201,138,0.45)' : GOLD; ctx.fillText(b.h.toUpperCase(), PX + 34, y + 12); y += 32; }
        ctx.font = `500 ${FONT}px ${BW.FONT_B}`; ctx.fillStyle = b.dim ? 'rgba(205,195,175,0.5)' : 'rgba(240,230,210,0.92)';
        b.paras.forEach((lines, i) => { if (i) y += 8; for (const l of lines) { ctx.fillText(l, PX + 34, y + LH / 2); y += LH; } });
        y += 16;
      }
      if (d.pageCount > 1) {
        ctx.textAlign = 'right'; ctx.font = `500 16px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(232,201,138,0.7)';
        ctx.fillText(`Page ${d.page + 1} / ${d.pageCount}  \u00B7  Confirm to turn the page`, PX + PW - 28, PY + PH - 22);
      }
    }

    ctx.textAlign = 'center'; ctx.font = `500 18px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(230,220,200,0.55)';
    ctx.fillText('\u25C4 \u25BA  Switch tab      \u25B2 \u25BC  Choose entry      Confirm  Turn page      Back  Close', BW.VW / 2, BW.VH - 38);
    ctx.restore();
  };

  M.guidePanel = function (ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10,12,20,0.7)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(240,226,196,0.28)'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };

  M.guideTipHeader = function (ctx, it) {
    const t = it.tip;
    ctx.textAlign = 'left';
    ctx.font = `600 36px ${BW.FONT_T}`; ctx.fillStyle = it.locked ? 'rgba(200,190,170,0.5)' : CREAM; ctx.fillText(it.locked ? '???' : t.title, PX + 34, PY + 44);
    ctx.font = `italic 500 19px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(232,201,138,0.7)'; ctx.fillText(t.cat, PX + 34, PY + 78);
    if (it.locked) return;
    let x = PX + 34;
    ctx.font = `600 18px ${BW.FONT_B}`;
    for (const [name, action] of t.keys) {
      const G = BW.Glyphs, nw = ctx.measureText(name).width, kk = G.actionWidth(ctx, action, 22, 'kb'), kp = G.actionWidth(ctx, action, 22, 'pad');
      const w = nw + kk + kp + 70;
      ctx.fillStyle = 'rgba(232,201,138,0.12)'; BW.roundRect(ctx, x, PY + 98, w, 36, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(232,201,138,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(225,214,192,0.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(name, x + 14, PY + 121);
      G.drawAction(ctx, action, x + 26 + nw, PY + 116, 22, 'kb');
      ctx.fillStyle = 'rgba(232,201,138,0.45)'; ctx.fillRect(x + 26 + nw + kk + 11, PY + 106, 1, 20);
      G.drawAction(ctx, action, x + 26 + nw + kk + 22, PY + 116, 22, 'pad');
      x += w + 12;
    }
  };

  M.guideNoteHeader = function (ctx, it) {
    const n = it.note;
    ctx.textAlign = 'left';
    ctx.font = `600 36px ${BW.FONT_T}`; ctx.fillStyle = it.locked ? 'rgba(200,190,170,0.5)' : CREAM; ctx.fillText(it.locked ? '???' : n.title, PX + 34, PY + 44);
    ctx.font = `italic 500 19px ${BW.FONT_B}`; ctx.fillStyle = it.locked ? 'rgba(232,201,138,0.4)' : 'rgba(232,201,138,0.8)';
    ctx.fillText(it.locked ? BW.Lore.areaName(n) : `Found in: ${BW.Lore.roomName(n)} \u2014 ${BW.Lore.areaName(n)}`, PX + 34, PY + 78);
    if (!it.locked) {
      ctx.strokeStyle = 'rgba(232,201,138,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PX + 34, PY + 104); ctx.lineTo(PX + PW - 34, PY + 104); ctx.stroke();
    }
  };

  M.guideBeastHeader = function (ctx, it, st) {
    const b = it.beast, c = BW.Codex.data(st), locked = it.locked;
    const bx = PX + 24, by = PY + 20, bs = 112;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, by, bs, bs);
    ctx.strokeStyle = 'rgba(240,226,196,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bs - 1, bs - 1);
    const sp = BW.Assets && BW.Assets.sprite(b.sprite);
    if (sp && sp.frames.length) {
      const f = sp.frames[b.frame % sp.frames.length], k = Math.min((bs - 16) / f[2], (bs - 16) / f[3]);
      const ax = f[4] != null ? f[4] : sp.ax || 0, ay = f[5] != null ? f[5] : sp.ay || 0;
      ctx.save();
      if (locked) { ctx.filter = 'brightness(0)'; ctx.globalAlpha = 0.55; }
      BW.Assets.draw(ctx, b.sprite, b.frame, bx + bs / 2 - (f[2] / 2 - ax) * k, by + bs / 2 - (f[3] / 2 - ay) * k, { scale: k / sp.scale });
      ctx.restore();
    }
    ctx.textAlign = 'left';
    if (locked) {
      ctx.font = `600 36px ${BW.FONT_T}`; ctx.fillStyle = 'rgba(200,190,170,0.5)'; ctx.fillText('???', PX + 160, PY + 44);
      ctx.font = `italic 500 19px ${BW.FONT_B}`; ctx.fillText('Not yet encountered', PX + 160, PY + 78);
      return;
    }
    ctx.font = `600 36px ${BW.FONT_T}`; ctx.fillStyle = CREAM; ctx.fillText(b.name, PX + 160, PY + 44);
    ctx.font = `italic 500 20px ${BW.FONT_B}`; ctx.fillStyle = GOLD; ctx.fillText(b.epithet, PX + 160, PY + 76);
    ctx.font = `500 17px ${BW.FONT_B}`; ctx.fillStyle = 'rgba(225,214,192,0.65)'; ctx.fillText('Found in: ' + b.habitat, PX + 160, PY + 102);
    const kills = c.kills[b.id] || 0;
    const stats = b.boss
      ? [['Attempts', st.stats.wardenAttempts || 0], ['Defeated', kills ? 'Yes' : 'Not yet'], ['Its hits', BW.Difficulty.fmtBells(BW.Difficulty.hit(st, 0.5 * BW.Difficulty.get(st).bossDmg)) + ' \u2013 ' + BW.Difficulty.fmtBells(BW.Difficulty.hit(st, 1.5 * BW.Difficulty.get(st).bossDmg))]]
      : [['Health', BW.Difficulty.scaleHp({ state: st }, b.hp)], ['Its strike', BW.Difficulty.fmtBells(BW.Difficulty.strikeCost(st, b.id))], ['Defeated', kills], ['Glints', b.glints], ['Parry', b.parry ? 'Yes' : 'No']];
    let x = PX + 160;
    for (const [k, v] of stats) {
      const key = k.toUpperCase(), val = String(v);
      ctx.font = `500 15px ${BW.FONT_B}`; const kw = ctx.measureText(key).width;
      ctx.fillStyle = 'rgba(232,201,138,0.65)'; ctx.fillText(key, x, PY + 126);
      ctx.font = `600 17px ${BW.FONT_B}`; const vw = ctx.measureText(val).width;
      ctx.fillStyle = '#fff1d0'; ctx.fillText(val, x + kw + 8, PY + 126);
      x += kw + vw + 34;
    }
  };

  // left / right switches tab. Called from Menu.update.
  M.guideNav = function (inp) {
    const s = this.screen, d = s.data;
    if (d.tab == null) { d.tab = 0; d.page = 0; d.scroll = 0; }
    if (inp.pressed.left || inp.pressed.right) {
      d.tab = (d.tab + (inp.pressed.left ? 2 : 1)) % 3; this.sel = 0; d.page = 0; d.scroll = 0; BW.Audio.play('ui_move');
    }
  };
})(window.BW);

'use strict';
// Ready-made saves for testing: everything discovered and unlocked, resting at the antechamber lantern
// outside the Warden's arena. Loaded from Save Data → Test Saves.
(function (BW) {
  const LIST = [
    { id: 'warden', name: 'Before the Warden', diff: 'action', desc: 'Everything unlocked, resting at the cathedral antechamber lantern. The Warden is waiting. 12 bells, 18 silk.' },
    { id: 'warden_nm', name: 'Before the Warden \u2014 Nightmare', diff: 'nightmare', desc: 'The same save on Nightmare: one bell per hit, denser rooms, tougher foes.' },
    { id: 'defeated', name: 'Warden Defeated', diff: 'action', desc: 'The Warden has fallen but the Great Bell is not yet rung. Boss Rematch is unlocked at every lantern.' },
    { id: 'cleared', name: 'Great Bell Rung', diff: 'action', desc: 'The whole story finished: ending seen, every lore note found, rematches unlocked.' },
  ];

  function build(id) {
    const meta = LIST.find((e) => e.id === id) || LIST[0];
    const d = BW.Save.defaults();
    d.difficulty = meta.diff;
    d.maxHp = 12; d.silkMax = 18; d.glints = 999;
    d.abilities = { dash: true, parry: true, dodge: true };
    const f = d.flags = {
      odo_met: true, odo_sold: true, bell1: true, bell2: true, belfry_open: true,
      reached_cathedral: true, cathedral_open: true, warden_met: id === 'warden' || id === 'warden_nm' ? false : true,
    };
    for (const r of BW.ROOM_LIST) {
      d.visited[r.id] = true;
      for (const s of r.secrets) f['sec_' + s.id] = true;
      for (const b of r.breakables) f['brk_' + b.id] = true;
      for (const e of r.ents) {
        if (e.type === 'lantern') d.lanternsLit[e.id] = true;
        if ((e.type === 'pickup' || e.type === 'cache' || e.type === 'glint') && e.id) f['pk_' + e.id] = true;
      }
    }
    if (id !== 'warden' && id !== 'warden_nm') { f.warden_met = true; f.warden_defeated = true; }
    if (id === 'cleared') { f.great_bell = true; f.ending_seen = true; }
    for (const n of BW.Lore.NOTES) if (!n.when || f[n.when]) f['note_' + n.id] = true;
    f.lore_spindle = true; f.lore_belfry = true;
    d.lantern = 'lan_b3'; d.lanternRoom = 'B3'; d.lastRoom = 'B3';
    d.stats = { playTime: 14400, deaths: 17, wardenAttempts: id === 'warden' || id === 'warden_nm' ? 0 : 6 };
    if (f.ending_seen) { d.stats.clears = 1; d.stats.clearTime = 14400; }
    const c = d.codex;
    for (const b of BW.Codex.BEASTS) {
      c.seen[b.id] = true;
      if (b.id !== 'warden') c.kills[b.id] = 12;
      for (const m of (b.moves || [])) c.moves[b.id + ':' + m[0]] = true;
    }
    if (f.warden_defeated) c.kills.warden = 1; else delete c.seen.warden;
    for (const t of Object.keys(BW.Codex.LESSONS)) c.tips[t] = true;
    d.createdAt = new Date().toISOString();
    return d;
  }

  BW.TestSaves = {
    LIST, build,
    load(g, id) {
      BW.Save.adopt(build(id));
      g.continueGame();
    },
  };
})(window.BW);

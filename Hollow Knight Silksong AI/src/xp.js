'use strict';
// Experience and levels. XP is a single running total in the save (state.xp); the level is derived from it, so
// there is nothing else to keep in sync. Each level adds a little strike power, and rising a level restores health and silk.
(function (BW) {
  const MAX = 10;
  const BONUS = 0.04;                              // strike power per level above the first
  const need = (lv) => 50 + 30 * (lv - 1);         // XP from level lv to lv + 1
  const CUM = [0];                                 // CUM[l - 1] = total XP needed to reach level l
  for (let l = 1; l < MAX; l++) CUM.push(CUM[l - 1] + need(l));

  // What each kind of find is worth. Enemies carry their own value (see enemies.js).
  const REWARD = { lifethread: 40, spool: 40, note: 15, shrine: 80, loom: 60, secret: 20, cache: 10, glints: 6, warden: 350 };

  const XP = {
    MAX, BONUS, REWARD, CUM,
    total(level) { return CUM[BW.clamp(level, 1, MAX) - 1]; },
    level(xp) {
      xp = xp | 0;
      let l = 1;
      while (l < MAX && xp >= CUM[l]) l++;
      return l;
    },
    // {level, into, span, ratio, max}: how far through the current level a total is (span is 0 at the top level)
    progress(xp) {
      xp = Math.max(0, xp);
      const level = this.level(xp), max = level >= MAX;
      const into = xp - CUM[level - 1], span = max ? 0 : need(level);
      return { level, into: Math.floor(into), span, ratio: max ? 1 : BW.clamp(into / span, 0, 1), max };
    },
    // multiplier applied to every blow the player lands
    power(st) { return 1 + BONUS * (this.level(st && st.xp) - 1); },
  };

  BW.XP = XP;
})(window.BW);

'use strict';
// Persistent progress. The save is a flat JSON object with a version number; unknown fields are
// preserved on write so later builds (and older snapshots) can share one save safely.
(function (BW) {
  const KEY = 'bellweaver.save';
  const SETTINGS_KEY = 'bellweaver.settings';
  const SAVE_VERSION = 1;

  function storage() {
    try { const s = window.localStorage; const k = '__bw_test'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; }
  }
  const memoryStore = {};

  const Save = {
    KEY, SAVE_VERSION,
    available: !!storage(),

    defaults() {
      return {
        game: 'bellweaver',
        version: SAVE_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        writtenBy: 'stage' + BW.BUILD_STAGE,
        lantern: null,          // id of last rested lantern
        lanternRoom: null,
        maxHp: 5,
        silkMax: 9,
        glints: 0,
        abilities: { dash: false },
        flags: {},              // bells, shortcuts, broken walls, collected pickups, story beats...
        visited: {},            // room id -> true (map discovery)
        lanternsLit: {},
        stats: { playTime: 0, deaths: 0 },
      };
    },

    // Bring any older save object up to the current structure without losing data.
    migrate(data) {
      if (!data || typeof data !== 'object') return null;
      if (data.game && data.game !== 'bellweaver') return null;
      const d = Object.assign(this.defaults(), data);
      d.abilities = Object.assign({ dash: false }, data.abilities || {});
      d.flags = Object.assign({}, data.flags || {});
      d.visited = Object.assign({}, data.visited || {});
      d.lanternsLit = Object.assign({}, data.lanternsLit || {});
      d.stats = Object.assign({ playTime: 0, deaths: 0 }, data.stats || {});
      if (typeof d.version !== 'number') d.version = 1;
      // (future versions add upgrade steps here, e.g. if (d.version < 2) { ...; d.version = 2; })
      if (d.version < SAVE_VERSION) d.version = SAVE_VERSION;
      d.maxHp = BW.clamp(d.maxHp | 0 || 5, 1, 12);
      d.silkMax = BW.clamp(d.silkMax | 0 || 9, 3, 18);
      d.glints = Math.max(0, d.glints | 0);
      return d;
    },

    exists() { return !!this.readRaw(); },

    readRaw() {
      const s = storage();
      const txt = s ? s.getItem(KEY) : memoryStore[KEY];
      if (!txt) return null;
      try { return JSON.parse(txt); } catch (e) { return null; }
    },

    load() { return this.migrate(this.readRaw()); },

    write(data) {
      const prev = this.readRaw() || {};
      const out = Object.assign({}, prev, data);   // keep unknown fields from other builds
      out.updatedAt = new Date().toISOString();
      out.writtenBy = 'stage' + BW.BUILD_STAGE;
      const txt = JSON.stringify(out);
      const s = storage();
      if (s) { try { s.setItem(KEY, txt); } catch (e) { BW.note('save failed'); return false; } } else memoryStore[KEY] = txt;
      return true;
    },

    erase() { const s = storage(); if (s) s.removeItem(KEY); delete memoryStore[KEY]; },

    exportText() {
      const raw = this.readRaw();
      if (!raw) return null;
      return JSON.stringify(raw, null, 2);
    },

    exportDownload() {
      const txt = this.exportText();
      if (!txt) return false;
      const blob = new Blob([txt], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'bellweaver-save.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      try { if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) { /* optional */ }
      return true;
    },

    importText(txt) {
      let obj;
      try { obj = JSON.parse(txt); } catch (e) { return { ok: false, msg: 'That file is not valid save data.' }; }
      const m = this.migrate(obj);
      if (!m) return { ok: false, msg: 'That is not a Bellweaver save.' };
      const s = storage();
      const str = JSON.stringify(Object.assign({}, obj, m));
      if (s) s.setItem(KEY, str); else memoryStore[KEY] = str;
      return { ok: true, msg: 'Save imported.' };
    },

    importFromFile(cb) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,application/json,text/plain';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) return cb({ ok: false, msg: 'No file chosen.' });
        const r = new FileReader();
        r.onload = () => cb(this.importText(String(r.result)));
        r.onerror = () => cb({ ok: false, msg: 'Could not read that file.' });
        r.readAsText(f);
      };
      input.click();
    },

    loadSettings() {
      const def = { master: 0.85, music: 0.6, sfx: 0.85, shake: true, hints: true, res: 'auto' };
      const s = storage();
      try { return Object.assign(def, JSON.parse((s ? s.getItem(SETTINGS_KEY) : memoryStore[SETTINGS_KEY]) || '{}')); } catch (e) { return def; }
    },
    saveSettings(st) {
      const s = storage(); const txt = JSON.stringify(st);
      if (s) { try { s.setItem(SETTINGS_KEY, txt); } catch (e) { /* ignore */ } } else memoryStore[SETTINGS_KEY] = txt;
    },
  };

  BW.Save = Save;
})(window.BW);

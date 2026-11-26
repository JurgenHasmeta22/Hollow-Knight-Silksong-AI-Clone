'use strict';

// Persistent progress. The save is a flat JSON object with a version number; unknown fields are
// preserved on write so later builds (and older snapshots) can share one save safely.
(function (BW) {
    const KEY = 'bellweaver.save';
    const SETTINGS_KEY = 'bellweaver.settings';
    const SAVE_VERSION = 1;

    function storage() {
        try {
            const s = window.localStorage;
            const k = '__bw_test';

            s.setItem(k, '1');
            s.removeItem(k);

            return s;
        } catch (e) {
            return null;
        }
    }

    const memoryStore = {};

    const Save = {
        KEY,
        SAVE_VERSION,
        available: !!storage(),

        defaults() {
            return {
                game: 'bellweaver',
                version: SAVE_VERSION,
                createdAt: new Date().toISOString(),
                updatedAt: null,
                writtenBy: 'stage' + BW.BUILD_STAGE,
                lantern: null, // id of last rested lantern
                lanternRoom: null,
                maxHp: 5,
                difficulty: 'action', // story | action | nightmare
                character: 'ronin', // the hero of this journey (the Faceless Ronin)
                shade: 0, // the Ronin's gauge (0..100), full to transform
                silkMax: 9,
                glints: 0,
                xp: 0, // experience; the level is derived from it (xp.js)
                abilities: { dash: false, parry: false, dodge: false }, // dash: Silk Dash, parry: Answering Toll, dodge: Shadow Step
                flags: {}, // bells, shortcuts, broken walls, collected pickups, story beats...
                visited: {}, // room id -> true (map discovery)
                lanternsLit: {},
                cleared: {}, // enemies that stay dead until the next lantern rest
                stats: { playTime: 0, deaths: 0 },
                codex: { seen: {}, kills: {}, moves: {}, tips: {} }, // field guide: creatures met, defeated, boss moves seen, lessons shown
            };
        },

        // Bring any older save object up to the current structure without losing data.
        migrate(data) {
            if (!data || typeof data !== 'object') return null;
            if (data.game && data.game !== 'bellweaver') return null;

            const d = Object.assign(this.defaults(), data);

            d.abilities = Object.assign({ dash: false, parry: false, dodge: false }, data.abilities || {});

            // saves from before parry and Shadow Step became shrine abilities keep what they could already do
            if (data.abilities && data.abilities.parry === undefined) d.abilities.parry = true;
            if (data.abilities && data.abilities.dodge === undefined) d.abilities.dodge = !!d.abilities.dash;

            d.flags = Object.assign({}, data.flags || {});
            d.visited = Object.assign({}, data.visited || {});
            d.lanternsLit = Object.assign({}, data.lanternsLit || {});
            d.cleared = Object.assign({}, data.cleared || {});
            d.stats = Object.assign({ playTime: 0, deaths: 0 }, data.stats || {});

            if (BW.Codex) BW.Codex.upgrade(d);
            if (typeof d.version !== 'number') d.version = 1;

            // (future versions add upgrade steps here, e.g. if (d.version < 2) { ...; d.version = 2; })
            if (d.version < SAVE_VERSION) d.version = SAVE_VERSION;

            d.maxHp = BW.clamp(d.maxHp | 0 || 5, 1, 12);
            d.silkMax = BW.clamp(d.silkMax | 0 || 9, 3, 18);
            d.glints = Math.max(0, d.glints | 0);
            d.xp = Math.max(0, d.xp | 0);
            d.shade = BW.clamp(+d.shade || 0, 0, 100);
            d.character = 'ronin'; // the Faceless Ronin is the only hero

            if (!BW.Difficulty.valid(d.difficulty)) d.difficulty = BW.Difficulty.DEFAULT;

            return d;
        },

        exists() {
            return !!this.readRaw();
        },

        readRaw() {
            const s = storage();
            const txt = s ? s.getItem(KEY) : memoryStore[KEY];

            if (!txt) return null;

            try {
                return JSON.parse(txt);
            } catch (e) {
                return null;
            }
        },

        load() {
            return this.migrate(this.readRaw());
        },

        write(data) {
            const prev = this.readRaw() || {};
            const out = Object.assign({}, prev, data); // keep unknown fields from other builds

            out.updatedAt = new Date().toISOString();
            out.writtenBy = 'stage' + BW.BUILD_STAGE;

            const txt = JSON.stringify(out);
            const s = storage();

            if (s) {
                try {
                    s.setItem(KEY, txt);
                } catch (e) {
                    BW.note('save failed');

                    return false;
                }
            } else memoryStore[KEY] = txt;

            return true;
        },

        erase() {
            const s = storage();

            if (s) s.removeItem(KEY);

            delete memoryStore[KEY];
        },

        // ---- Manual slots: each holds a full snapshot of the save, independent of the autosave.
        SLOTS: 5,
        slotKey(i) {
            return 'bellweaver.slot.' + i;
        },
        readSlot(i) {
            const s = storage(),
                txt = s ? s.getItem(this.slotKey(i)) : memoryStore[this.slotKey(i)];

            if (!txt) return null;

            try {
                const o = JSON.parse(txt);

                return this.migrate(o) ? o : null;
            } catch (e) {
                return null;
            }
        },
        writeSlot(i, data) {
            const out = Object.assign({}, data, { slotSavedAt: new Date().toISOString() });

            const txt = JSON.stringify(out),
                s = storage();

            if (s) {
                try {
                    s.setItem(this.slotKey(i), txt);
                } catch (e) {
                    BW.note('slot save failed');

                    return false;
                }
            } else memoryStore[this.slotKey(i)] = txt;

            return true;
        },
        eraseSlot(i) {
            const s = storage();

            if (s) s.removeItem(this.slotKey(i));

            delete memoryStore[this.slotKey(i)];
        },
        // make a snapshot the current autosave (replaces it entirely)
        adopt(data) {
            const o = Object.assign({}, data);

            delete o.slotSavedAt;

            this.erase();

            return this.write(o);
        },

        // Short description of a save for the slot cards.
        summary(d) {
            if (!d) return null;

            const m = this.migrate(d);

            if (!m) return null;

            const room = BW.ROOMS && BW.ROOMS[m.lanternRoom || m.lastRoom];
            const area = room && BW.AREAS[room.area];
            const total = (BW.ROOM_LIST || []).length || 1;
            const seen = Object.keys(m.visited).length;

            const lan =
                m.lantern && room
                    ? room.name
                    : m.lastRoom && BW.ROOMS[m.lastRoom]
                    ? BW.ROOMS[m.lastRoom].name
                    : 'Fallen Light';

            return {
                place: lan,
                area: area ? area.name : 'Mosslit Hollow',
                areaColor: area ? area.mapColor : '#9a7a5a',
                time: m.stats.playTime || 0,
                deaths: m.stats.deaths || 0,
                difficulty: m.difficulty,
                hearts: m.maxHp,
                silk: m.silkMax,
                glints: m.glints,
                pct: Math.min(100, Math.round((seen / total) * 100)),
                notes: BW.Lore ? BW.Lore.count(m) : 0,
                notesTotal: BW.Lore ? BW.Lore.NOTES.length : 0,
                warden: !!m.flags.warden_defeated,
                ending: !!m.flags.ending_seen,
                saved: d.slotSavedAt || d.updatedAt || null,
            };
        },

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
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                URL.revokeObjectURL(a.href);
                a.remove();
            }, 500);

            try {
                if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
            } catch (e) {
                /* optional */
            }

            return true;
        },

        importText(txt) {
            let obj;

            try {
                obj = JSON.parse(txt);
            } catch (e) {
                return { ok: false, msg: 'That file is not valid save data.' };
            }

            const m = this.migrate(obj);

            if (!m) return { ok: false, msg: 'That is not a Bellweaver save.' };

            const s = storage();
            const str = JSON.stringify(Object.assign({}, obj, m));

            if (s) s.setItem(KEY, str);
            else memoryStore[KEY] = str;

            return { ok: true, msg: 'Save imported.' };
        },

        importFromFile(cb) {
            const input = document.createElement('input');

            input.type = 'file';
            input.accept = '.json,application/json,text/plain';

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
            const def = {
                master: 0.85,
                music: 0.6,
                sfx: 0.85,
                ambience: 0.75,
                ui: 1,
                muteBlur: true,
                shake: true,
                hints: true,
                res: 'auto',
                pad: 'auto',
                quality: 'high',
                lighting: 'full',
                particles: 'high',
                ambient: 'on',
                backdrop: 'high',
                fpsCap: 0,
                fpsCounter: 'off',
            };

            const s = storage();

            try {
                return Object.assign(
                    def,
                    JSON.parse((s ? s.getItem(SETTINGS_KEY) : memoryStore[SETTINGS_KEY]) || '{}'),
                );
            } catch (e) {
                return def;
            }
        },
        saveSettings(st) {
            const s = storage();
            const txt = JSON.stringify(st);

            if (s) {
                try {
                    s.setItem(SETTINGS_KEY, txt);
                } catch (e) {
                    /* ignore */
                }
            } else memoryStore[SETTINGS_KEY] = txt;
        },
    };

    BW.Save = Save;
})(window.BW);

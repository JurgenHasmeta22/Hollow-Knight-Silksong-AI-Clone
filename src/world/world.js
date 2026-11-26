'use strict';

// Room definition DSL, runtime room state and tile collision shared by the player and enemies.
// Tile legend:  # solid   . air   = one-way ledge   ^ thorns   B breakable wall   G gate
(function (BW) {
    const T = BW.T;

    BW.ROOMS = {};
    BW.ROOM_LIST = [];

    // ---- Authoring ---------------------------------------------------------------------------
    BW.defineRoom = function (def, build) {
        const g = [];

        for (let y = 0; y < def.h; y++) g.push(new Array(def.w).fill('#'));

        const room = Object.assign(
            { ents: [], gates: [], breakables: [], deco: [], secrets: [], triggers: [], lights: [] },
            def,
        );

        const set = (x, y, c) => {
            if (x >= 0 && y >= 0 && x < def.w && y < def.h) g[y][x] = c;
        };

        const fill = (x0, y0, x1, y1, c) => {
            for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
                for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, c);
        };

        const api = {
            air: (x0, y0, x1, y1) => fill(x0, y0, x1, y1, '.'),
            solid: (x0, y0, x1, y1) => fill(x0, y0, x1, y1, '#'),
            plat: (x0, x1, y) => fill(x0, y, x1, y, '='),
            thorns: (x0, x1, y) => fill(x0, y, x1, y, '^'),
            breakable: (x0, y0, x1, y1, id, extra) => {
                fill(x0, y0, x1, y1, 'B');
                room.breakables.push(Object.assign({ id, x0, y0, x1, y1 }, extra || {}));
            },
            gate: (x0, y0, x1, y1, flag, extra) => {
                fill(x0, y0, x1, y1, 'G');
                room.gates.push(Object.assign({ flag, x0, y0, x1, y1, kind: 'bars' }, extra || {}));
            },
            ent: (type, x, y, props) => room.ents.push(Object.assign({ type, x, y }, props || {})),
            deco: (sprite, x, y, props) => room.deco.push(Object.assign({ sprite, x, y }, props || {})),
            secret: (x0, y0, x1, y1, id) => room.secrets.push({ id, x0, y0, x1, y1 }),
            trigger: (x0, y0, x1, y1, action, props) =>
                room.triggers.push(Object.assign({ x0, y0, x1, y1, action }, props || {})),
            light: (x, y, r, color, props) => room.lights.push(Object.assign({ x, y, r, color }, props || {})),
            set,
            fill,
        };

        build(api);
        room.grid = g;
        BW.ROOMS[def.id] = room;
        BW.ROOM_LIST.push(room);

        return room;
    };

    // ---- Runtime room ------------------------------------------------------------------------
    class Room {
        constructor(def, flags) {
            this.def = def;
            this.id = def.id;
            this.area = BW.AREAS[def.area];
            this.w = def.w;
            this.h = def.h;
            this.pw = def.w * T;
            this.ph = def.h * T;
            this.grid = def.grid.map((r) => r.slice());
            this.platforms = [];
            this.flags = flags;

            this.gates = def.gates.map((g, i) =>
                Object.assign({}, g, { index: i, open: !!flags[g.flag] !== !!g.invert, anim: 0 }),
            );

            this.breakables = def.breakables.map((b) =>
                Object.assign({}, b, { hp: b.hp || 3, broken: !!flags['brk_' + b.id], shake: 0 }),
            );

            for (const g of this.gates) {
                if (g.open) {
                    this.fillTiles(g, '.');
                    g.anim = 1;
                }
            }

            for (const b of this.breakables) if (b.broken) this.fillTiles(b, '.');
        }

        fillTiles(r, c) {
            for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) this.grid[y][x] = c;
        }

        raw(tx, ty) {
            if (tx < 0) tx = 0;
            else if (tx >= this.w) tx = this.w - 1;

            if (ty < 0) ty = 0;
            else if (ty >= this.h) ty = this.h - 1;

            return this.grid[ty][tx];
        }

        solid(tx, ty) {
            const c = this.raw(tx, ty);

            return c === '#' || c === 'B' || c === 'G';
        }

        oneway(tx, ty) {
            return this.raw(tx, ty) === '=';
        }

        hazard(tx, ty) {
            return this.raw(tx, ty) === '^';
        }

        solidPx(x, y) {
            return this.solid(Math.floor(x / T), Math.floor(y / T));
        }

        openGate(g) {
            if (g.open) return;

            g.open = true;
            this.fillTiles(g, '.');
        }

        breakWall(b) {
            b.broken = true;
            this.fillTiles(b, '.');
        }
    }

    BW.Room = Room;

    // ---- Collision helpers ---------------------------------------------------------------------
    const Phys = {
        // Move horizontally; returns true when blocked. Movement per step is always < one tile.
        moveX(room, e, dx) {
            if (dx === 0) return false;

            const ty0 = Math.floor((e.y + 0.5) / T),
                ty1 = Math.floor((e.y + e.h - 0.5) / T);

            // only tiles the leading edge newly enters can block (an embedded body is never snapped backwards)
            if (dx > 0) {
                const oldTx = Math.floor((e.x + e.w - 0.001) / T),
                    tx = Math.floor((e.x + e.w + dx - 0.001) / T);

                if (tx > oldTx)
                    for (let ty = ty0; ty <= ty1; ty++)
                        if (room.solid(tx, ty)) {
                            e.x = tx * T - e.w;

                            return true;
                        }
            } else {
                const oldTx = Math.floor(e.x / T),
                    tx = Math.floor((e.x + dx) / T);

                if (tx < oldTx)
                    for (let ty = ty0; ty <= ty1; ty++)
                        if (room.solid(tx, ty)) {
                            e.x = (tx + 1) * T;

                            return true;
                        }
            }

            e.x += dx;

            return false;
        },

        // Move vertically. Lands on solids, one-way ledges (when falling onto them) and moving platforms.
        moveY(room, e, dy) {
            const res = { landed: false, ceil: false, oneway: false, platform: null };

            if (dy === 0) return res;

            const x0 = e.x + 0.5,
                x1 = e.x + e.w - 0.5;

            const tx0 = Math.floor(x0 / T),
                tx1 = Math.floor(x1 / T);

            if (dy > 0) {
                const oldBottom = e.y + e.h;
                let nb = oldBottom + dy;
                const ty = Math.floor((nb - 0.001) / T);

                for (let tx = tx0; tx <= tx1; tx++)
                    if (room.solid(tx, ty)) {
                        nb = ty * T;
                        res.landed = true;
                        break;
                    }

                if (!res.landed && !e.dropThrough) {
                    for (let tx = tx0; tx <= tx1; tx++) {
                        if (room.oneway(tx, ty) && oldBottom <= ty * T + 0.5) {
                            nb = ty * T;
                            res.landed = true;
                            res.oneway = true;
                            break;
                        }
                    }
                }

                if (!e.dropThrough || true) {
                    for (const p of room.platforms) {
                        if (!p.solidTop) continue;

                        if (x1 > p.x && x0 < p.x + p.w && oldBottom <= p.y + Math.abs(p.stepDy || 0) + 1 && nb >= p.y) {
                            if (!res.landed || p.y < nb) {
                                nb = p.y;
                                res.landed = true;
                                res.platform = p;
                                res.oneway = false;
                            }
                        }
                    }
                }

                e.y = nb - e.h;
            } else {
                const nt = e.y + dy;
                const ty = Math.floor(nt / T);

                for (let tx = tx0; tx <= tx1; tx++)
                    if (room.solid(tx, ty)) {
                        e.y = (ty + 1) * T;
                        res.ceil = true;

                        return res;
                    }

                e.y = nt;
            }

            return res;
        },

        onGround(room, e) {
            const x0 = e.x + 0.5,
                x1 = e.x + e.w - 0.5,
                by = e.y + e.h + 1;

            const ty = Math.floor(by / T);

            for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
                if (room.solid(tx, ty)) return true;
                if (room.oneway(tx, ty) && Math.abs(e.y + e.h - ty * T) < 1.5) return true;
            }

            for (const p of room.platforms)
                if (p.solidTop && x1 > p.x && x0 < p.x + p.w && Math.abs(e.y + e.h - p.y) < 1.5) return true;

            return false;
        },

        overlapsSolid(room, r) {
            const tx0 = Math.floor(r.x / T),
                tx1 = Math.floor((r.x + r.w - 0.01) / T);

            const ty0 = Math.floor(r.y / T),
                ty1 = Math.floor((r.y + r.h - 0.01) / T);

            for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (room.solid(tx, ty)) return true;

            return false;
        },

        // Thorn tiles hurt in their lower part only, so a graze of the tips is forgiven.
        touchesHazard(room, e) {
            const x0 = e.x + 4,
                x1 = e.x + e.w - 4,
                y0 = e.y + 6,
                y1 = e.y + e.h - 1;

            const tx0 = Math.floor(x0 / T),
                tx1 = Math.floor(x1 / T),
                ty0 = Math.floor(y0 / T),
                ty1 = Math.floor(y1 / T);

            for (let ty = ty0; ty <= ty1; ty++)
                for (let tx = tx0; tx <= tx1; tx++) {
                    if (room.hazard(tx, ty)) {
                        const top = ty * T + 16;

                        if (y1 > top) return true;
                    }
                }

            return false;
        },

        hazardInRect(room, r) {
            const tx0 = Math.floor(r.x / T),
                tx1 = Math.floor((r.x + r.w) / T),
                ty0 = Math.floor(r.y / T),
                ty1 = Math.floor((r.y + r.h) / T);

            for (let ty = ty0; ty <= ty1; ty++)
                for (let tx = tx0; tx <= tx1; tx++) if (room.hazard(tx, ty)) return true;

            return false;
        },

        // Line of sight between two points (coarse, tile stepping).
        los(room, ax, ay, bx, by) {
            const d = Math.hypot(bx - ax, by - ay),
                n = Math.ceil(d / (T / 3));

            for (let i = 1; i < n; i++) {
                const t = i / n;

                if (room.solidPx(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
            }

            return true;
        },
    };

    BW.Phys = Phys;

    // Helper used by the map and transitions: which room contains a world tile position?
    BW.roomAtWorld = function (wx, wy, exceptId) {
        for (const r of BW.ROOM_LIST) {
            if (r.id === exceptId) continue;
            if (wx >= r.x && wx < r.x + r.w && wy >= r.y && wy < r.y + r.h) return r;
        }

        return null;
    };
})(window.BW);

'use strict';
// Bellweaver — core namespace, constants and small helpers shared by every module.
window.BW = window.BW || {};

(function (BW) {
    BW.VERSION = '0.9.0';
    BW.BUILD_STAGE = 2;
    BW.T = 40; // tile size in world units
    BW.VW = 1280; // logical view size (16:9)
    BW.VH = 720;
    BW.DT = 1 / 120; // fixed simulation step
    BW.DEFAULT_ZOOM = 1.12; // world units are drawn slightly enlarged for readability

    // Player movement tuning. The level validator reads these too, so rooms are designed against them.
    BW.PHYS = {
        w: 24,
        h: 56,
        runSpeed: 330,
        groundAccel: 5200,
        groundDecel: 7000,
        airAccel: 3600,
        airDecel: 2600,
        jumpV: 900,
        gravUp: 2300, // while rising with jump held
        gravDown: 2900, // falling / jump released
        apexHangV: 120,
        apexHangMul: 0.6,
        jumpCutMul: 0.45,
        maxFall: 960,
        coyote: 0.1,
        jumpBuffer: 0.13,
        dashSpeed: 1050,
        dashTime: 0.165,
        dashCooldown: 0.3,
        pogoV: 780,
        enterUpBoost: 1050,
        stepUp: 12,
    };

    BW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    BW.lerp = (a, b, t) => a + (b - a) * t;
    BW.approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
    BW.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    BW.rand = (a, b) => a + Math.random() * (b - a);
    BW.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
    BW.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    BW.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
    BW.damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    BW.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    BW.easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

    BW.easeOutBack = (t) => {
        const c1 = 1.70158,
            c3 = c1 + 1;

        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    BW.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    BW.pointIn = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

    // Deterministic PRNG for decoration placement (same room always looks the same).
    BW.seeded = function (seed) {
        let s = seed >>> 0 || 1;

        return function () {
            s ^= s << 13;
            s >>>= 0;
            s ^= s >>> 17;
            s ^= s << 5;
            s >>>= 0;

            return s / 4294967296;
        };
    };

    BW.hashStr = function (str) {
        let h = 2166136261;

        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }

        return h >>> 0;
    };

    BW.makeCanvas = function (w, h) {
        const c = document.createElement('canvas');

        c.width = Math.max(1, Math.ceil(w));
        c.height = Math.max(1, Math.ceil(h));

        return c;
    };

    // Convert a finished offscreen canvas into an ImageBitmap (GPU-friendly, immutable) when supported.
    BW.toBitmap = function (canvas, done) {
        if (!window.createImageBitmap) return;

        try {
            window
                .createImageBitmap(canvas)
                .then(done)
                .catch(() => {});
        } catch (e) {
            /* keep the canvas */
        }
    };

    // In-place filter for lists pruned every fixed step; avoids allocating a new array 120 times a second.
    BW.prune = function (arr, keep) {
        let j = 0;

        for (let i = 0; i < arr.length; i++) {
            const v = arr[i];

            if (keep(v)) arr[j++] = v;
        }

        arr.length = j;

        return arr;
    };

    const rgbCache = {};

    BW.hexToRgb = function (hex) {
        let c = rgbCache[hex];

        if (!c) {
            const v = parseInt(hex.slice(1), 16);

            c = rgbCache[hex] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        }

        return c;
    };

    BW.rgba = function (hex, a) {
        const [r, g, b] = BW.hexToRgb(hex);

        return `rgba(${r},${g},${b},${a})`;
    };

    // Simple event log used by the automated tests.
    BW.log = [];

    BW.note = function (msg) {
        BW.log.push(msg);

        if (BW.log.length > 200) BW.log.shift();
    };
})(window.BW);

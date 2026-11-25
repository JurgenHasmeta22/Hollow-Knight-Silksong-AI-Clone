'use strict';
// Graphics quality. The player-facing options live in BW.settings (strings); BW.gfx holds the numbers the
// renderer reads every frame, rebuilt by BW.Gfx.apply() whenever a setting changes.
(function (BW) {
    const PRESETS = {
        low: { lighting: 'simple', particles: 'low', ambient: 'off', backdrop: 'low', res: '720' },
        medium: { lighting: 'full', particles: 'medium', ambient: 'reduced', backdrop: 'low', res: '900' },
        high: { lighting: 'full', particles: 'high', ambient: 'on', backdrop: 'high', res: 'auto' },
    };
    const KEYS = Object.keys(PRESETS.high);

    const LIGHTING = { full: 2, simple: 1, off: 0 };
    const PARTICLES = { high: { scale: 1, cap: 700 }, medium: { scale: 0.6, cap: 420 }, low: { scale: 0.3, cap: 200 } };
    const AMBIENT = { on: 1, reduced: 0.5, off: 0 };
    const BACKDROP = { high: { w: 640, rays: true }, low: { w: 448, rays: false } };

    const Gfx = {
        PRESETS,
        KEYS,
        // which preset the current individual options add up to, or 'custom'
        detect(s) {
            for (const name of Object.keys(PRESETS)) if (KEYS.every((k) => s[k] === PRESETS[name][k])) return name;
            return 'custom';
        },
        usePreset(s, name) {
            if (PRESETS[name]) {
                Object.assign(s, PRESETS[name]);
                s.quality = name;
            }
        },
        apply(s) {
            const part = PARTICLES[s.particles] || PARTICLES.high,
                back = BACKDROP[s.backdrop] || BACKDROP.high;
            const g = BW.gfx || (BW.gfx = {});
            g.lighting = LIGHTING[s.lighting] != null ? LIGHTING[s.lighting] : 2;
            g.partScale = part.scale;
            g.partCap = part.cap;
            g.motes = AMBIENT[s.ambient] != null ? AMBIENT[s.ambient] : 1;
            g.farW = back.w;
            g.godRays = back.rays;
            g.smooth = s.quality === 'high' ? 'medium' : 'low';
            g.fpsCap = s.fpsCap | 0;
            return g;
        },
    };
    BW.Gfx = Gfx;
    BW.gfx = { lighting: 2, partScale: 1, partCap: 700, motes: 1, farW: 640, godRays: true, smooth: 'low', fpsCap: 0 };
})(window.BW);

'use strict';

// Controller button glyphs. Every action maps to canonical pad buttons (by position on a standard-mapped pad);
// a style (Xbox / PlayStation / Switch / Generic) decides how each button is named and drawn. The style comes from
// the "Controller Icons" option, or from the connected pad's id when that is left on Auto.
(function (BW) {
    // Canonical buttons: S/E/W/N are the south/east/west/north face buttons, LS the left stick,
    // DU/DD/DL/DR the d-pad, LB/RB/LT/RT the shoulders and triggers.
    const BINDS = {
        left: ['DL'],
        right: ['DR'],
        up: ['DU'],
        down: ['DD'],
        move: ['LS'],
        jump: ['S'],
        attack: ['W'],
        dash: ['E', 'RT'],
        lance: ['N'],
        heal: ['LT'],
        parry: ['LB'],
        interact: ['DU'],
        map: ['SELECT'],
        pause: ['START'],
        confirm: ['S'],
        back: ['E'],
    };

    const FACE = { S: 1, E: 1, W: 1, N: 1 };
    const SHOULDER = { LB: 1, RB: 1, LT: 1, RT: 1 };
    const DPAD = { DU: 1, DD: 1, DL: 1, DR: 1 };
    const TOKENS = Object.assign({ LS: 1, SELECT: 1, START: 1 }, FACE, SHOULDER, DPAD);
    const PS = { S: '#7fa8ff', E: '#ff6f7c', W: '#f093d2', N: '#52d4a8' };

    const STYLES = {
        xbox: {
            name: 'Xbox',
            face: { S: ['A', '#5cc05a'], E: ['B', '#e0483f'], W: ['X', '#4a86e8'], N: ['Y', '#eab92c'] },
            sh: { LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT' },
            select: 'View',
            start: 'Menu',
            words: { S: 'A', E: 'B', W: 'X', N: 'Y' },
        },
        playstation: {
            name: 'PlayStation',
            face: { S: ['x', PS.S], E: ['o', PS.E], W: ['sq', PS.W], N: ['tri', PS.N] },
            sh: { LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2' },
            start: 'Options',
            // the same button is "Share" on a DualShock 4 and "Create" on a DualSense
            get select() {
                return /dualsense|0ce6|0df2/i.test((BW.Input && BW.Input.padId) || '') ? 'Create' : 'Share';
            },
            words: { S: 'Cross', E: 'Circle', W: 'Square', N: 'Triangle' },
        },
        switch: {
            name: 'Switch',
            light: true,
            face: { S: ['B', '#23252c'], E: ['A', '#23252c'], W: ['Y', '#23252c'], N: ['X', '#23252c'] },
            sh: { LB: 'L', RB: 'R', LT: 'ZL', RT: 'ZR' },
            select: '\u2212',
            start: '+',
            words: { S: 'B', E: 'A', W: 'Y', N: 'X' },
        },
        generic: {
            name: 'Generic',
            light: true,
            face: { S: ['1', '#23252c'], E: ['2', '#23252c'], W: ['3', '#23252c'], N: ['4', '#23252c'] },
            sh: { LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2' },
            select: 'Back',
            start: 'Start',
            words: { S: 'Button 1', E: 'Button 2', W: 'Button 3', N: 'Button 4' },
        },
    };

    const ORDER = ['auto', 'xbox', 'playstation', 'switch', 'generic'];
    const DIRWORD = { DU: 'Up', DD: 'Down', DL: 'Left', DR: 'Right', LS: 'Left Stick' };

    const G = {
        STYLES,
        ORDER,
        TOKENS,

        // Style implied by the connected pad. Unknown pads are treated as Xbox-like, the web standard layout.
        detect() {
            const id = ((BW.Input && BW.Input.padId) || '').toLowerCase();

            if (/playstation|dualshock|dualsense|054c|sony|wireless controller/.test(id)) return 'playstation';
            if (/nintendo|switch|057e|joy-?con|pro controller/.test(id)) return 'switch';

            return 'xbox';
        },
        style() {
            const s = (BW.settings && BW.settings.pad) || 'auto';

            return s === 'auto' || !STYLES[s] ? this.detect() : s;
        },
        styleName(setting) {
            const s = setting || (BW.settings && BW.settings.pad) || 'auto';

            if (s === 'auto')
                return 'Auto' + (BW.Input && BW.Input.padConnected ? ' (' + STYLES[this.detect()].name + ')' : '');

            return STYLES[s] ? STYLES[s].name : 'Auto';
        },

        tokens(action) {
            return BINDS[action] || [];
        },
        word(tok) {
            const S = STYLES[this.style()];

            if (FACE[tok]) return S.words[tok];
            if (SHOULDER[tok]) return S.sh[tok];
            if (tok === 'SELECT') return S.select;
            if (tok === 'START') return S.start;

            return DIRWORD[tok] || tok;
        },
        // Plain-text name of an action's pad binding, for prompts that cannot draw glyphs
        words(action) {
            return (
                this.tokens(action)
                    .map((t) => this.word(t))
                    .join(' / ') || action
            );
        },

        // ---- drawing. x is the left edge, y the vertical centre, h the glyph height.
        tokenWidth(ctx, tok, h) {
            const S = STYLES[this.style()];

            if (FACE[tok] || tok === 'LS' || DPAD[tok]) return h;

            ctx.save();
            ctx.font = `700 ${Math.round(h * 0.56)}px ${BW.FONT_T}`;

            const t = SHOULDER[tok] ? S.sh[tok] : tok === 'SELECT' ? S.select : S.start;
            const w = Math.max(h * 1.25, ctx.measureText(t).width + h * 0.7);

            ctx.restore();

            return w;
        },
        drawToken(ctx, tok, x, y, h) {
            const S = STYLES[this.style()],
                r = h / 2,
                cx = x + r;

            ctx.save();

            if (FACE[tok]) {
                const [sym, col] = S.face[tok];

                ctx.fillStyle = S.light ? '#e8e6e0' : '#1c1f27';
                ctx.beginPath();
                ctx.arc(cx, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = S.light ? 'rgba(20,20,26,0.55)' : 'rgba(255,255,255,0.28)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.strokeStyle = col;
                ctx.fillStyle = col;
                ctx.lineWidth = Math.max(1.6, h * 0.1);
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';

                const k = r * 0.46;

                if (sym === 'x') {
                    ctx.beginPath();
                    ctx.moveTo(cx - k, y - k);
                    ctx.lineTo(cx + k, y + k);
                    ctx.moveTo(cx + k, y - k);
                    ctx.lineTo(cx - k, y + k);
                    ctx.stroke();
                } else if (sym === 'o') {
                    ctx.beginPath();
                    ctx.arc(cx, y, k * 1.05, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (sym === 'sq') {
                    ctx.strokeRect(cx - k, y - k, k * 2, k * 2);
                } else if (sym === 'tri') {
                    ctx.beginPath();
                    ctx.moveTo(cx, y - k * 1.1);
                    ctx.lineTo(cx + k * 1.1, y + k * 0.8);
                    ctx.lineTo(cx - k * 1.1, y + k * 0.8);
                    ctx.closePath();
                    ctx.stroke();
                } else {
                    ctx.font = `700 ${Math.round(h * 0.6)}px ${BW.FONT_T}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(sym, cx, y + h * 0.04);
                }
            } else if (tok === 'LS') {
                ctx.fillStyle = '#1c1f27';
                ctx.beginPath();
                ctx.arc(cx, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.fillStyle = '#3a3f4c';
                ctx.beginPath();
                ctx.arc(cx, y, r * 0.62, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e8e2d2';
                ctx.font = `700 ${Math.round(h * 0.5)}px ${BW.FONT_T}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('L', cx, y + h * 0.03);
            } else if (DPAD[tok]) {
                const a = r * 0.36,
                    L = r * 0.95;

                ctx.fillStyle = '#4a4f5c';
                ctx.fillRect(cx - a, y - L, a * 2, L * 2);
                ctx.fillRect(cx - L, y - a, L * 2, a * 2);
                ctx.fillStyle = '#fff1d0';

                if (tok === 'DU') ctx.fillRect(cx - a, y - L, a * 2, L);
                else if (tok === 'DD') ctx.fillRect(cx - a, y, a * 2, L);
                else if (tok === 'DL') ctx.fillRect(cx - L, y - a, L, a * 2);
                else ctx.fillRect(cx, y - a, L, a * 2);

                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx - L, y - a, L * 2, a * 2);
                ctx.strokeRect(cx - a, y - L, a * 2, L * 2);
            } else {
                const w = this.tokenWidth(ctx, tok, h),
                    trig = tok === 'LT' || tok === 'RT',
                    bh = h * 0.82;

                const t = SHOULDER[tok] ? S.sh[tok] : tok === 'SELECT' ? S.select : S.start;

                ctx.fillStyle = trig ? '#3b404d' : '#262a34';
                BW.roundRect(ctx, x, y - bh / 2, w, bh, trig ? bh * 0.5 : bh * 0.3);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.fillStyle = '#f0e8d4';
                ctx.font = `700 ${Math.round(h * 0.56)}px ${BW.FONT_T}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(t, x + w / 2, y + h * 0.03);
                ctx.restore();

                return w;
            }

            ctx.restore();

            return h;
        },

        // A keyboard keycap with the action's key text
        keyWidth(ctx, text, h) {
            ctx.save();
            ctx.font = `700 ${Math.round(h * 0.66)}px ${BW.FONT_T}`;

            const w = ctx.measureText(text).width + h * 0.8;

            ctx.restore();

            return Math.max(h, w);
        },
        drawKeycap(ctx, text, x, y, h) {
            const w = this.keyWidth(ctx, text, h);

            ctx.save();
            ctx.fillStyle = '#efe2c6';
            BW.roundRect(ctx, x, y - h / 2, w, h, Math.min(7, h * 0.25));
            ctx.fill();
            ctx.fillStyle = '#1b1712';
            ctx.font = `700 ${Math.round(h * 0.66)}px ${BW.FONT_T}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + w / 2, y + h * 0.04);
            ctx.restore();

            return w;
        },

        // An action's binding for the active device ('kb' | 'pad'), as keycaps or button glyphs
        mode() {
            return BW.Input && BW.Input.device === 'pad' ? 'pad' : 'kb';
        },
        actionWidth(ctx, action, h, mode) {
            mode = mode || this.mode();

            if (mode === 'kb') return this.keyWidth(ctx, BW.Input.label(action, 'kb'), h);

            return this.seqWidth(
                ctx,
                this.tokens(action).flatMap((t, i) => (i ? ['/', t] : [t])),
                h,
            );
        },
        drawAction(ctx, action, x, y, h, mode) {
            mode = mode || this.mode();

            if (mode === 'kb') return this.drawKeycap(ctx, BW.Input.label(action, 'kb'), x, y, h);

            return this.drawSeq(
                ctx,
                this.tokens(action).flatMap((t, i) => (i ? ['/', t] : [t])),
                x,
                y,
                h,
            );
        },

        // A free sequence of canonical tokens and plain text (e.g. ['DD', '+', 'W'])
        seqWidth(ctx, seq, h) {
            let w = 0;

            for (const s of seq) w += (TOKENS[s] ? this.tokenWidth(ctx, s, h) : this.textWidth(ctx, s, h)) + 6;

            return Math.max(0, w - 6);
        },
        textWidth(ctx, s, h) {
            ctx.save();
            ctx.font = `600 ${Math.round(h * 0.78)}px ${BW.FONT_B}`;

            const w = ctx.measureText(s).width;

            ctx.restore();

            return w;
        },
        drawSeq(ctx, seq, x, y, h) {
            let cx = x;

            for (const s of seq) {
                if (TOKENS[s]) cx += this.drawToken(ctx, s, cx, y, h) + 6;
                else {
                    ctx.save();
                    ctx.font = `600 ${Math.round(h * 0.78)}px ${BW.FONT_B}`;
                    ctx.fillStyle = 'rgba(240,230,210,0.85)';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(s, cx, y + h * 0.04);
                    cx += ctx.measureText(s).width + 6;
                    ctx.restore();
                }
            }

            return cx - x - 6;
        },
    };

    BW.Glyphs = G;
})(window.BW);

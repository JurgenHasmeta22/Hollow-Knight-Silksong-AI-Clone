'use strict';

// Keyboard + gamepad input mapped to abstract actions. Edges are latched until the next fixed step
// consumes them, so a quick tap is never lost regardless of frame rate.
(function (BW) {
    const ACTIONS = [
        'left',
        'right',
        'up',
        'down',
        'jump',
        'attack',
        'dash',
        'lance',
        'skill',
        'transform',
        'heal',
        'parry',
        'interact',
        'map',
        'pause',
        'confirm',
        'back',
    ];

    const KEYMAP = {
        ArrowLeft: ['left'],
        KeyA: ['left'],
        ArrowRight: ['right'],
        KeyD: ['right'],
        ArrowUp: ['up'],
        KeyW: ['up'],
        ArrowDown: ['down'],
        KeyS: ['down'],
        Space: ['jump', 'confirm'],
        KeyJ: ['attack', 'confirm'],
        KeyX: ['attack'],
        KeyK: ['dash'],
        ShiftLeft: ['dash'],
        ShiftRight: ['dash'],
        KeyC: ['dash'],
        KeyL: ['lance'],
        KeyU: ['skill'],
        KeyO: ['transform'],
        KeyI: ['parry'],
        KeyQ: ['heal'],
        KeyE: ['interact'],
        KeyM: ['map'],
        Tab: ['map'],
        Escape: ['pause', 'back'],
        KeyP: ['pause'],
        Backspace: ['back'],
        Enter: ['confirm'],
        NumpadEnter: ['confirm'],
    };

    // Standard-mapping gamepad buttons.
    const PADMAP = {
        0: ['jump', 'confirm'], // A / Cross
        1: ['dash', 'back'], // B / Circle
        2: ['attack'], // X / Square
        3: ['lance'], // Y / Triangle
        4: ['parry'], // LB / L1
        5: ['parry'], // RB / R1 (kept as a second parry button for muscle memory)
        6: ['heal'], // LT / L2
        10: ['transform'], // left stick click
        11: ['skill'], // right stick click
        7: ['dash'], // RT
        8: ['map'], // Back / View / Share (DualShock 4) / Create (DualSense)
        9: ['pause'], // Start / Menu / Options
        17: ['map'], // PlayStation touchpad click, a second map button
        12: ['up'],
        13: ['down'],
        14: ['left'],
        15: ['right'],
    };

    const Input = {
        ACTIONS,
        kbDown: {},
        padDown: {},
        injected: {},
        latchPress: {},
        latchRelease: {},
        down: {},
        pressed: {},
        released: {},
        device: 'kb',
        padConnected: false,
        padId: '',
        stick: { x: 0, y: 0 },
        enabled: true,
        _anyKeyCallbacks: [],

        init() {
            for (const a of ACTIONS) {
                this.kbDown[a] = 0;
                this.padDown[a] = false;
                this.injected[a] = false;
                this.down[a] = false;
                this.pressed[a] = false;
                this.released[a] = false;
            }

            window.addEventListener('keydown', (e) => {
                const acts = KEYMAP[e.code];

                if (acts || e.code === 'F11') {
                    if (e.code !== 'F11') e.preventDefault();
                }

                if (e.repeat) return;

                this.device = 'kb';
                this._anyKeyCallbacks.forEach((cb) => cb(e));

                if (!acts) return;

                this._keysHeld = this._keysHeld || {};

                if (this._keysHeld[e.code]) return;

                this._keysHeld[e.code] = true;

                for (const a of acts) {
                    if (this.kbDown[a] === 0) this.latchPress[a] = true;

                    this.kbDown[a]++;
                }
            });

            window.addEventListener('keyup', (e) => {
                const acts = KEYMAP[e.code];

                if (!acts) return;

                e.preventDefault();

                if (!this._keysHeld || !this._keysHeld[e.code]) return;

                this._keysHeld[e.code] = false;

                for (const a of acts) {
                    this.kbDown[a] = Math.max(0, this.kbDown[a] - 1);

                    if (this.kbDown[a] === 0) this.latchRelease[a] = true;
                }
            });

            window.addEventListener('blur', () => this.clearAll());

            window.addEventListener('gamepadconnected', (e) => {
                this.padConnected = true;
                this.padId = e.gamepad.id;
                BW.note('pad connected');
            });

            window.addEventListener('gamepaddisconnected', () => {
                this.padConnected = false;
                this.clearPad();
            });
        },

        onAnyKey(cb) {
            this._anyKeyCallbacks.push(cb);
        },

        clearAll() {
            this._keysHeld = {};

            for (const a of ACTIONS) {
                if (this.kbDown[a]) this.latchRelease[a] = true;

                this.kbDown[a] = 0;
            }

            this.clearPad();
        },
        clearPad() {
            for (const a of ACTIONS) this.padDown[a] = false;

            this.stick.x = 0;
            this.stick.y = 0;
        },

        pollPad() {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            let pad = null;

            for (const p of pads) {
                if (p && p.connected) {
                    pad = p;
                    break;
                }
            }

            const next = {};

            for (const a of ACTIONS) next[a] = false;

            if (pad) {
                this.padConnected = true;
                this.padId = pad.id || this.padId;

                pad.buttons.forEach((b, i) => {
                    const pressed = typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5;

                    if (pressed && PADMAP[i]) for (const a of PADMAP[i]) next[a] = true;
                });

                const ax = pad.axes[0] || 0,
                    ay = pad.axes[1] || 0;

                this.stick.x = Math.abs(ax) > 0.2 ? ax : 0;
                this.stick.y = Math.abs(ay) > 0.2 ? ay : 0;

                if (ax < -0.45) next.left = true;
                if (ax > 0.45) next.right = true;
                if (ay < -0.5) next.up = true;
                if (ay > 0.5) next.down = true;
            }

            let any = false;

            for (const a of ACTIONS) {
                if (next[a] && !this.padDown[a]) {
                    this.latchPress[a] = true;
                    any = true;
                }

                if (!next[a] && this.padDown[a]) this.latchRelease[a] = true;

                this.padDown[a] = next[a];
            }

            if (any) this.device = 'pad';
        },

        // Called once per fixed simulation step (and by menus once per frame).
        poll() {
            this.pollPad();

            for (const a of ACTIONS) {
                const d = this.enabled && (this.kbDown[a] > 0 || this.padDown[a] || this.injected[a]);

                this.pressed[a] = this.enabled && !!this.latchPress[a];
                this.released[a] = !!this.latchRelease[a];
                this.down[a] = d;
                this.latchPress[a] = false;
                this.latchRelease[a] = false;
            }
        },

        consume(a) {
            this.pressed[a] = false;
        },

        // Test hook: simulate holding / releasing an action.
        inject(a, isDown) {
            if (isDown && !this.injected[a]) this.latchPress[a] = true;
            if (!isDown && this.injected[a]) this.latchRelease[a] = true;

            this.injected[a] = isDown;
        },

        // Human readable binding labels for prompts and the controls screen. Pad names follow the chosen controller style.
        label(action, device) {
            const pad = (device || this.device) === 'pad';

            if (pad) return BW.Glyphs.words(action);

            const K = {
                left: 'A / ←',
                right: 'D / →',
                up: 'W / ↑',
                down: 'S / ↓',
                move: 'A D / ← →',
                jump: 'Space',
                attack: 'J',
                dash: 'K / Shift',
                lance: 'L',
                skill: 'U',
                transform: 'O',
                heal: 'Q',
                parry: 'I',
                interact: 'E',
                map: 'M',
                pause: 'Esc',
                confirm: 'Enter / J',
                back: 'Esc',
            };

            return K[action] || action;
        },
    };

    BW.Input = Input;
})(window.BW);

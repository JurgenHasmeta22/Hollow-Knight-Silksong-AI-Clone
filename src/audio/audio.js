'use strict';

// Audio: music/ambience stream through <audio> elements (works from file://), sound effects are
// decoded from an embedded base64 pack into WebAudio buffers, with small synthesized fallbacks.
(function (BW) {
    const A = {
        ctx: null,
        master: null,
        sfxBus: null,
        ready: false,
        vol: { master: 0.85, music: 0.6, sfx: 0.85, ambience: 0.75, ui: 1 },
        muted: false, // set while the window is in the background and "mute in background" is on
        buffers: {},
        banks: {}, // name -> [AudioBuffer]: takes cut from a longer recording (see sfx_bank.js); play() picks one at random
        tracks: {}, // name -> LoopPlayer
        musicName: null,
        ambName: null,
        lastPlay: {},
        noiseBuf: null,

        init() {
            if (this.ctx) {
                if (this.ctx.state === 'suspended') this.ctx.resume();

                return;
            }

            const AC = window.AudioContext || window.webkitAudioContext;

            if (!AC) return;

            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.connect(this.ctx.destination);
            this.sfxBus = this.ctx.createGain();

            const comp = this.ctx.createDynamicsCompressor();

            comp.threshold.value = -14;
            comp.ratio.value = 4;
            comp.attack.value = 0.004;
            comp.release.value = 0.2;

            this.sfxBus.connect(comp);

            comp.connect(this.master);

            this.applyVolumes();

            // noise buffer for synth fallbacks
            const len = this.ctx.sampleRate * 1.0;

            this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);

            const d = this.noiseBuf.getChannelData(0);

            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

            this.decodePack();
            this.decodeBank();
            this.ready = true;
        },

        // Decoded one sample per timer tick so the first click doesn't freeze the title screen.
        decodePack() {
            const pack = window.BW_SFX_DATA || {};
            const names = Object.keys(pack);

            const next = () => {
                const name = names.shift();

                if (!name) return;

                try {
                    const b64 = pack[name].split(',')[1];
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);

                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

                    this.ctx.decodeAudioData(
                        bytes.buffer,
                        (buf) => {
                            this.buffers[name] = buf;
                        },
                        () => BW.note('sfx decode failed ' + name),
                    );
                } catch (e) {
                    BW.note('sfx pack error ' + name);
                }

                setTimeout(next, 0);
            };

            next();
        },

        // The embedded recordings in BW_SFX_BANK each hold several takes: decode one, cut it into its takes and file them
        // under the bank name (a trailing digit is dropped, so voice1 and voice2 share the bank `voice`).
        decodeBank() {
            const data = window.BW_SFX_BANK || {};
            const names = Object.keys(data);

            const next = () => {
                const name = names.shift();

                if (!name) return;

                try {
                    const bin = atob(data[name].split(',')[1]);
                    const bytes = new Uint8Array(bin.length);

                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

                    this.ctx.decodeAudioData(
                        bytes.buffer,
                        (buf) => this.addTakes(name.replace(/\d+$/, ''), buf),
                        () => BW.note('sfx bank decode failed ' + name),
                    );
                } catch (e) {
                    BW.note('sfx bank error ' + name);
                }

                setTimeout(next, 0);
            };

            next();
        },

        addTakes(bank, buf) {
            const takes = this.findSegments(buf.getChannelData(0), buf.sampleRate, SEGMENT[bank]);
            const list = this.banks[bank] || (this.banks[bank] = []);

            for (const [a, b] of takes) {
                const len = b - a;
                const out = this.ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
                const fade = Math.min(len >> 1, Math.floor(buf.sampleRate * 0.012));
                let peak = 0.0001;

                for (let c = 0; c < buf.numberOfChannels; c++) {
                    const src = buf.getChannelData(c);

                    for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(src[i]));
                }

                for (let c = 0; c < buf.numberOfChannels; c++) {
                    const src = buf.getChannelData(c),
                        dst = out.getChannelData(c);

                    for (let i = 0; i < len; i++) {
                        const k = Math.min(1, i / fade, (len - 1 - i) / (fade * 4));

                        dst[i] = (src[a + i] / peak) * 0.9 * k;
                    }
                }

                list.push(out);
            }
        },

        // Cuts one recording into its separate takes: stretches of sound separated by quiet. `data` is one channel of
        // samples. Returns [[startSample, endSample], ...], each at most maxLen seconds long. Always returns at least one
        // take (the whole thing, capped), so a recording that is one long wash still plays.
        findSegments(data, sr, o = {}) {
            const win = Math.max(1, Math.floor(sr * 0.01)),
                n = Math.floor(data.length / win),
                rms = new Float32Array(n);

            let peak = 0;

            for (let w = 0; w < n; w++) {
                let s = 0;

                for (let i = w * win; i < (w + 1) * win; i++) s += data[i] * data[i];

                rms[w] = Math.sqrt(s / win);
                peak = Math.max(peak, rms[w]);
            }

            const thr = Math.max(peak * (o.rel || 0.07), 0.003),
                gap = Math.round((o.gap || 0.16) * 100),
                minLen = Math.round((o.minLen || 0.07) * 100),
                maxLen = Math.floor(sr * (o.maxLen || 2.4)),
                tail = Math.round((o.tail || 0.12) * 100),
                lead = Math.round(0.02 * 100);

            const spans = [];
            let s = -1,
                last = -1;

            for (let w = 0; w < n; w++) {
                if (rms[w] > thr) {
                    if (s < 0) s = w;

                    last = w;
                } else if (s >= 0 && w - last > gap) {
                    if (last - s + 1 >= minLen) spans.push([s, last]);

                    s = -1;
                }
            }

            if (s >= 0 && last - s + 1 >= minLen) spans.push([s, last]);

            const out = [];

            spans.forEach(([a, b], i) => {
                const nextStart = i + 1 < spans.length ? spans[i + 1][0] : n;
                const start = Math.max(i ? spans[i - 1][1] + 1 : 0, a - lead) * win;
                let end = Math.min(nextStart - 1, b + tail) * win;

                end = Math.min(end, start + maxLen);

                if (end - start > win * 4) out.push([start, end]);
            });

            if (!out.length) out.push([0, Math.min(data.length, maxLen)]);

            return out;
        },

        // A positional sound: quieter and panned by where the source is relative to the hero (silent beyond `range`).
        playAt(name, sx, sy, opts = {}) {
            const g = window.BW_GAME,
                p = g && g.player;

            if (!p) return this.play(name, opts);

            const range = opts.range || 900,
                dx = sx - p.cx,
                dy = (sy - p.cy) * 1.4,
                d = Math.hypot(dx, dy);

            if (d >= range) return;

            const k = 1 - d / range;

            this.play(
                name,
                Object.assign({}, opts, {
                    vol: (opts.vol != null ? opts.vol : 1) * k * k * 1.15,
                    pan: BW.clamp(dx / range, -0.8, 0.8),
                }),
            );
        },

        masterLevel() {
            return this.muted ? 0 : this.vol.master;
        },
        applyVolumes() {
            if (this.master) this.master.gain.value = this.masterLevel();
            if (this.sfxBus) this.sfxBus.gain.value = this.vol.sfx;

            for (const k in this.tracks) this.tracks[k].applyVolume();
        },

        setVolumes(v) {
            Object.assign(this.vol, v);
            this.applyVolumes();
        },
        setMuted(m) {
            if (this.muted === !!m) return;

            this.muted = !!m;
            this.applyVolumes();
        },

        // ---- Sound effects ----
        play(name, opts = {}) {
            if (!this.ctx || this.ctx.state !== 'running') {
                if (this.ctx) this.ctx.resume();
                if (!this.ctx) return;
            }

            const now = this.ctx.currentTime;
            const minGap = opts.minGap != null ? opts.minGap : 0.03;

            if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;

            this.lastPlay[name] = now;

            let vol = opts.vol != null ? opts.vol : 1;

            if (name.startsWith('ui_')) vol *= this.vol.ui;
            if (vol <= 0.001) return;

            const out = this.ctx.createGain();

            out.gain.value = vol;

            let dest = out;

            if (opts.pan && this.ctx.createStereoPanner) {
                const p = this.ctx.createStereoPanner();

                p.pan.value = BW.clamp(opts.pan, -1, 1);
                out.connect(p);
                p.connect(this.sfxBus);
            } else out.connect(this.sfxBus);

            const alias = ALIAS[name];
            const sample = opts.sample || (alias && alias.sample) || name;
            const bank = this.banks[sample];
            const buf = bank && bank.length ? bank[Math.floor(Math.random() * bank.length)] : this.buffers[sample];

            if (buf) {
                const src = this.ctx.createBufferSource();

                src.buffer = buf;

                let rate = (opts.rate || 1) * (opts.vary ? 1 + (Math.random() * 2 - 1) * opts.vary : 1);

                if (opts.pitch && BASE_PITCH[sample]) rate *= opts.pitch / BASE_PITCH[sample];

                src.playbackRate.value = rate;

                let node = src;
                const lp = opts.lowpass || (alias && alias.lowpass);

                if (lp) {
                    const f = this.ctx.createBiquadFilter();

                    f.type = 'lowpass';
                    f.frequency.value = lp;
                    src.connect(f);
                    node = f;
                }

                if (alias && alias.vol) out.gain.value *= alias.vol;

                node.connect(dest);
                src.start(now);

                // one sound per call: a take that still holds a second blow is cut short with a quick fade
                const cap = opts.maxDur || CAP[sample];

                if (cap && buf.duration > cap) {
                    const end = now + cap / rate,
                        g0 = out.gain.value;

                    out.gain.setValueAtTime(g0, Math.max(now, end - 0.06));
                    out.gain.linearRampToValueAtTime(0, end);
                    src.stop(end + 0.01);
                }

                return;
            }

            const synth = SYNTH[name];

            if (synth) synth(this.ctx, dest, now, opts, this);
        },

        // ---- Music & ambience ----
        registerTrack(name, src, gain = 1, xfade = 2.5) {
            if (this.tracks[name]) return;

            this.tracks[name] = new LoopPlayer(name, src, gain, xfade, name.startsWith('amb') ? 'amb' : 'music');
        },

        // The Faceless Ronin's journey keeps the calm tracks for its quiet stretches (the Hollow, the Spindleworks) and swaps
        // the opening, the Belfry and the ending for the dark loops from tools/make_dark_music.py.
        setTheme(hero) {
            this.theme = hero === 'ronin' ? THEME_RONIN : null;
        },
        themed(name) {
            return (this.theme && this.theme[name]) || name;
        },
        // play the current theme's version of whatever was last asked for (e.g. the title music once a hero is picked)
        retheme(fade = 1.5) {
            if (this.musicRaw) this.playMusic(this.musicRaw, fade);
        },

        playMusic(name, fade = 2.0) {
            this.musicRaw = name;
            name = name ? this.themed(name) : name;

            if (this.musicName === name) return;

            const prev = this.tracks[this.musicName];

            if (prev) prev.fadeTo(0, fade, true);

            this.musicName = name;

            const t = this.tracks[name];

            if (t) {
                t.start();
                t.fadeTo(1, fade);
            }
        },
        playAmbience(name, fade = 2.0) {
            if (this.ambName === name) return;

            const prev = this.tracks[this.ambName];

            if (prev) prev.fadeTo(0, fade, true);

            this.ambName = name;

            const t = this.tracks[name];

            if (t) {
                t.start();
                t.fadeTo(1, fade);
            }
        },
        duckMusic(level, time) {
            const t = this.tracks[this.musicName];

            if (t) t.duck(level, time);
        },
        stopAll(fade = 1) {
            for (const k in this.tracks) this.tracks[k].fadeTo(0, fade, true);

            this.musicName = null;
            this.ambName = null;
        },

        update(dt) {
            for (const k in this.tracks) this.tracks[k].update(dt);
        },
    };

    // Two <audio> elements per track, crossfaded near the end so loops never click or gap.
    class LoopPlayer {
        constructor(name, src, gain, xfade, kind) {
            this.name = name;
            this.src = src;
            this.gain = gain;
            this.xfade = xfade;
            this.kind = kind;

            this.els = [new Audio(src), new Audio(src)];

            this.els.forEach((e) => {
                e.preload = 'auto';
                e.volume = 0;
            });

            this.cur = 0;
            this.level = 0;
            this.target = 0;
            this.rate = 1;
            this.stopWhenSilent = false;
            this.active = false;
            this.duckLevel = 1;
            this.duckT = 0;
            this.elLevel = [0, 0];
        }
        start() {
            if (this.active) {
                this.stopWhenSilent = false;

                return;
            }

            this.active = true;
            this.stopWhenSilent = false;

            const e = this.els[this.cur];

            try {
                e.currentTime = 0;
            } catch (err) {
                /* not loaded yet */
            }

            this.elLevel[this.cur] = 1;

            const p = e.play();

            if (p && p.catch) p.catch(() => {});
        }
        fadeTo(level, time, stopAfter) {
            this.target = level;
            this.rate = time > 0 ? 1 / time : 1000;
            this.stopWhenSilent = !!stopAfter;
        }
        duck(level, time) {
            this.duckLevel = level;
            this.duckT = time;
        }
        applyVolume() {
            const v =
                A.masterLevel() *
                (this.kind === 'amb' ? A.vol.ambience : A.vol.music) *
                this.gain *
                this.level *
                this.duckLevel;

            // Writing .volume crosses into the media pipeline, so skip it when nothing audibly changed.
            const last = this.lastVol || (this.lastVol = [-1, -1]);

            for (let i = 0; i < 2; i++) {
                const nv = BW.clamp(v * this.elLevel[i], 0, 1);

                if (Math.abs(nv - last[i]) > 0.002 || (nv === 0) !== (last[i] === 0)) {
                    this.els[i].volume = nv;
                    last[i] = nv;
                }
            }
        }
        update(dt) {
            if (!this.active) return;

            this.level = BW.approach(this.level, this.target, this.rate * dt);

            if (this.duckT > 0) {
                this.duckT -= dt;

                if (this.duckT <= 0) this.duckLevel = 1;
            }

            const e = this.els[this.cur],
                other = this.els[1 - this.cur];

            const dur = e.duration;

            if (
                dur &&
                isFinite(dur) &&
                dur > this.xfade * 2 &&
                e.currentTime > dur - this.xfade &&
                this.elLevel[1 - this.cur] === 0
            ) {
                try {
                    other.currentTime = 0;
                } catch (err) {
                    /* ignore */
                }

                const p = other.play();

                if (p && p.catch) p.catch(() => {});

                this.elLevel[1 - this.cur] = 0.0001;
            }

            if (this.elLevel[1 - this.cur] > 0) {
                const inc = dt / this.xfade;

                this.elLevel[1 - this.cur] = Math.min(1, this.elLevel[1 - this.cur] + inc);
                this.elLevel[this.cur] = Math.max(0, this.elLevel[this.cur] - inc);

                if (this.elLevel[this.cur] <= 0) {
                    e.pause();
                    this.cur = 1 - this.cur;
                }
            }

            this.retryT = (this.retryT || 0) - dt;

            if (e.paused && this.elLevel[this.cur] > 0 && this.level > 0 && !this.stopWhenSilent && this.retryT <= 0) {
                // the element may have been blocked by autoplay rules; keep trying, but not every tick
                this.retryT = 0.5;

                const p = e.play();

                if (p && p.catch) p.catch(() => {});
            }

            this.applyVolume();

            if (this.stopWhenSilent && this.level <= 0.001) {
                this.els.forEach((x) => x.pause());
                this.active = false;
                this.elLevel = [0, 0];
            }
        }
    }

    // Generated samples reused for related cues; bell pitches are expressed relative to the sample.
    // The blade, blow and impact recordings hold a run of blows (a combo of swishes). Cut at every blow, not only at long
    // silences, so one take is one blow: the Ronin's swings, hits and finishers each land on their own.
    const SEGMENT = {
        bladedual: { gap: 0.035, rel: 0.12, minLen: 0.05, maxLen: 0.5, tail: 0.07 },
        slashbody: { gap: 0.035, rel: 0.12, minLen: 0.05, maxLen: 0.45, tail: 0.07 },
        combohit: { gap: 0.045, rel: 0.12, minLen: 0.06, maxLen: 0.8, tail: 0.1 },
    };

    // the longest a single play of a bank may last (seconds of the recording): a safety net if a take still runs on
    const CAP = { bladedual: 0.55, slashbody: 0.5, combohit: 0.85 };
    const THEME_RONIN = { mus_title: 'mus_dark_title', mus_belfry: 'mus_dark_belfry', mus_ending: 'mus_dark_ending' };
    const BASE_PITCH = { bell: 196 };
    const ALIAS = { bellfar: { sample: 'bell', vol: 0.32, lowpass: 900 } };

    // ---- Synthesized fallbacks (used only when no generated sample exists for a name) ----
    function env(g, t, a, peak, d, sustain = 0) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    }

    function noise(ctx, dest, t, dur, type, f0, f1, q, peak, a = 0.003) {
        const src = ctx.createBufferSource();

        src.buffer = A.noiseBuf;

        const f = ctx.createBiquadFilter();

        f.type = type;
        f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

        const g = ctx.createGain();

        env(g, t, a, peak, dur);
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
    }

    function tone(ctx, dest, t, dur, type, f0, f1, peak, a = 0.005) {
        const o = ctx.createOscillator();

        o.type = type;
        o.frequency.setValueAtTime(f0, t);

        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

        const g = ctx.createGain();

        env(g, t, a, peak, dur);

        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    function bell(ctx, dest, t, base, dur, peak) {
        const partials = [
            [0.5, 0.5],
            [1, 1],
            [1.19, 0.55],
            [1.56, 0.4],
            [2, 0.35],
            [2.51, 0.22],
            [2.66, 0.18],
            [3.01, 0.12],
            [4.1, 0.08],
        ];

        for (const [m, a] of partials)
            tone(ctx, dest, t, dur * (1.2 - m * 0.18), 'sine', base * m, base * m * 0.998, peak * a, 0.004);
    }

    const SYNTH = {
        swing(ctx, d, t) {
            noise(ctx, d, t, 0.13, 'bandpass', 900, 4200, 1.2, 0.35);
        },
        hit(ctx, d, t) {
            noise(ctx, d, t, 0.12, 'lowpass', 3000, 300, 0.7, 0.6);
            tone(ctx, d, t, 0.12, 'triangle', 180, 60, 0.6);
        },
        hurt(ctx, d, t) {
            tone(ctx, d, t, 0.35, 'sawtooth', 220, 55, 0.35);
            noise(ctx, d, t, 0.25, 'lowpass', 2000, 200, 0.8, 0.5);
        },
        jump(ctx, d, t) {
            noise(ctx, d, t, 0.12, 'bandpass', 600, 1600, 1.0, 0.12);
        },
        land(ctx, d, t) {
            noise(ctx, d, t, 0.09, 'lowpass', 500, 120, 0.7, 0.25);
        },
        step(ctx, d, t) {
            noise(ctx, d, t, 0.04, 'bandpass', 1400, 900, 2, 0.05);
        },
        dash(ctx, d, t) {
            noise(ctx, d, t, 0.22, 'bandpass', 500, 3800, 0.8, 0.4);
            tone(ctx, d, t, 0.18, 'sine', 400, 900, 0.08);
        },
        pickup(ctx, d, t) {
            tone(ctx, d, t, 0.25, 'sine', 1568, 1568, 0.18);
            tone(ctx, d, t + 0.05, 0.3, 'sine', 2349, 2349, 0.12);
        },
        glint(ctx, d, t) {
            tone(ctx, d, t, 0.18, 'sine', 2093 + Math.random() * 200, 2093, 0.08);
        },
        heal_start(ctx, d, t) {
            noise(ctx, d, t, 0.5, 'bandpass', 600, 2400, 1.5, 0.08, 0.2);
            tone(ctx, d, t, 0.5, 'sine', 392, 523, 0.05, 0.2);
        },
        heal(ctx, d, t) {
            [523, 659, 784, 1046].forEach((f, i) => tone(ctx, d, t + i * 0.04, 0.7, 'sine', f, f, 0.08, 0.05));
        },
        lance(ctx, d, t) {
            noise(ctx, d, t, 0.3, 'bandpass', 2400, 600, 1.5, 0.35);
            tone(ctx, d, t, 0.25, 'triangle', 880, 440, 0.15);
        },
        clink(ctx, d, t) {
            tone(ctx, d, t, 0.3, 'square', 1800, 1700, 0.08);
            tone(ctx, d, t, 0.25, 'sine', 2600, 2500, 0.15);
            noise(ctx, d, t, 0.05, 'highpass', 5000, 3000, 0.5, 0.2);
        },
        // A parry: steel meeting steel. A bright transient, an inharmonic ring that hangs in the air, a rising "shing"
        // sweep and a low body thump, so it never reads as the plain clink of a blocked blow.
        parry(ctx, d, t) {
            noise(ctx, d, t, 0.05, 'highpass', 6500, 3500, 0.6, 0.6, 0.001);
            noise(ctx, d, t + 0.01, 0.34, 'bandpass', 2400, 9500, 4, 0.2, 0.01);
            tone(ctx, d, t, 0.16, 'triangle', 260, 70, 0.5, 0.002);

            for (const [m, a, dur] of [
                [1, 0.5, 0.9],
                [2.76, 0.34, 0.65],
                [5.4, 0.22, 0.4],
                [8.93, 0.12, 0.22],
            ])
                tone(ctx, d, t, dur, 'sine', 1175 * m, 1175 * m * 0.997, a * 0.4, 0.001);

            tone(ctx, d, t + 0.02, 0.5, 'sine', 3136, 3120, 0.06, 0.004);
        },
        spit(ctx, d, t) {
            noise(ctx, d, t, 0.15, 'lowpass', 1200, 300, 2, 0.3);
            tone(ctx, d, t, 0.12, 'sine', 300, 600, 0.12);
        },
        die(ctx, d, t) {
            noise(ctx, d, t, 0.35, 'lowpass', 2500, 150, 0.6, 0.5);
            tone(ctx, d, t, 0.3, 'triangle', 300, 70, 0.3);
        },
        break(ctx, d, t) {
            noise(ctx, d, t, 0.6, 'lowpass', 1800, 100, 0.5, 0.6);
            tone(ctx, d, t, 0.4, 'sine', 90, 40, 0.5);
        },
        gate(ctx, d, t) {
            noise(ctx, d, t, 1.6, 'lowpass', 300, 60, 0.5, 0.5, 0.2);
            tone(ctx, d, t, 1.4, 'sine', 55, 45, 0.4, 0.2);
        },
        bell(ctx, d, t, o) {
            bell(ctx, d, t, o.pitch || 196, 5.5, 0.35);
        },
        bellfar(ctx, d, t, o) {
            bell(ctx, d, t, o.pitch || 147, 4.5, 0.07);
        },
        save(ctx, d, t) {
            [784, 988, 1175].forEach((f, i) => tone(ctx, d, t + i * 0.08, 0.6, 'sine', f, f, 0.08, 0.02));
        },
        shrine(ctx, d, t) {
            [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(ctx, d, t + i * 0.12, 2.2, 'sine', f, f, 0.07, 0.08));
        },
        ui_move(ctx, d, t) {
            tone(ctx, d, t, 0.06, 'sine', 1200, 1200, 0.05);
        },
        ui_ok(ctx, d, t) {
            tone(ctx, d, t, 0.12, 'sine', 880, 1320, 0.08);
        },
        ui_back(ctx, d, t) {
            tone(ctx, d, t, 0.12, 'sine', 660, 440, 0.07);
        },
        windup(ctx, d, t) {
            tone(ctx, d, t, 0.35, 'sawtooth', 120, 260, 0.05, 0.2);
        },
        thrust(ctx, d, t) {
            noise(ctx, d, t, 0.2, 'bandpass', 1500, 400, 1, 0.35);
        },
        hop(ctx, d, t) {
            noise(ctx, d, t, 0.1, 'lowpass', 900, 300, 1, 0.2);
        },
        flutter(ctx, d, t) {
            noise(ctx, d, t, 0.25, 'bandpass', 300, 900, 3, 0.12);
        },
        lift(ctx, d, t) {
            tone(ctx, d, t, 1.2, 'triangle', 70, 90, 0.15, 0.2);
            noise(ctx, d, t, 1.0, 'lowpass', 400, 200, 1, 0.1, 0.2);
        },
        text(ctx, d, t) {
            tone(ctx, d, t, 0.03, 'sine', 900 + Math.random() * 300, 900, 0.015);
        },
    };

    BW.Audio = A;
})(window.BW);

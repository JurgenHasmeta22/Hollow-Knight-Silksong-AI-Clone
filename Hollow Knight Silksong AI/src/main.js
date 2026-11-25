'use strict';
// Entry point. With ?test=1 the loop does not auto-run; the automated play-tests drive it via BW.Test.
(function (BW) {
    const canvas = document.getElementById('game');
    const test = /[?&]test=1/.test(location.search);
    const game = new BW.Game(canvas);
    window.BW_GAME = game;
    const ready = game.boot(test);
    canvas.focus();
    if (!test) return;
    const T = BW.T;
    const held = {};
    BW.Test = {
        ready,
        game,
        newGame(skipIntro = true, difficulty) {
            game.started = true;
            BW.Audio.init();
            game.newGame(difficulty);
            if (skipIntro) {
                game.seq = null;
                game.seqText = null;
                game.seqCard = null;
                game.deathCard = null;
                game.fade = 0;
                game.letterboxTarget = 0;
                game.player.state = 'normal';
            }
            return this.info();
        },
        teleport(room, tx, ty) {
            game.transition = null;
            game.fade = 0;
            game.hazardBusy = false;
            game.seq = null;
            game.hud.announce = null;
            game.dialog.active = false;
            game.loadRoom(room, { x: (tx + 0.5) * T - BW.PHYS.w / 2, y: (ty + 1) * T - BW.PHYS.h });
            game.player.vx = 0;
            game.player.vy = 0;
            game.player.state = 'normal';
            return this.info();
        },
        hold(actions) {
            for (const a of BW.Input.ACTIONS) {
                const want = !!(actions && actions[a]);
                if (want !== !!held[a]) {
                    BW.Input.inject(a, want);
                    held[a] = want;
                }
            }
        },
        step(n, actions) {
            if (actions !== undefined) this.hold(actions);
            for (let i = 0; i < n; i++) game.tick(BW.DT);
            return this.info();
        },
        tap(action, n = 2) {
            this.hold(Object.assign({}, held, { [action]: true }));
            this.step(n);
            const h = Object.assign({}, held);
            h[action] = false;
            this.hold(h);
            return this.info();
        },
        render() {
            game.render(1);
        },
        info() {
            const p = game.player,
                st = game.state;
            return {
                mode: game.mode,
                room: game.room && game.room.id,
                x: +(p.x / T).toFixed(2),
                y: +(p.y / T).toFixed(2),
                px: Math.round(p.x),
                py: Math.round(p.y),
                vx: Math.round(p.vx),
                vy: Math.round(p.vy),
                ground: p.onGround,
                state: p.state,
                hp: st && st.hp,
                silk: st && st.silk,
                glints: st && st.glints,
                enemies: game.enemies.length,
                seq: !!game.seq,
                dialog: game.dialog.active,
                announce: !!game.hud.announce,
                menu: game.menu.screen && game.menu.screen.name,
                fade: game.fade,
            };
        },
        flags() {
            return game.state.flags;
        },
        boss() {
            const b = game.boss;
            return (
                b && {
                    state: b.state,
                    pose: b.pose,
                    hp: b.hp,
                    phase: b.phase,
                    x: Math.round(b.cx),
                    active: b.active,
                    invuln: b.invuln,
                    harmful: b.harmful,
                    heat: +b.heat.toFixed(2),
                }
            );
        },
        hazards() {
            return game.hazards.map((h) => h.constructor.name);
        },
        log() {
            return BW.log.slice(-40);
        },
    };
})(window.BW);

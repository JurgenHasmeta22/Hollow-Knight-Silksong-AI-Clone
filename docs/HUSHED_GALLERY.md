# The Hushed Gallery: Chapter II design notes

Everything in Area G of [ART_PROMPTS.md](./ART_PROMPTS.md): its backdrops, eight props, objects, the Silent Key, the Last Door and the five creatures, built into the game. The art is imported by `tools/import_hushed_art.py`; this document covers the design.

## Where it fits

```
Great Bell rung (flag great_bell)
  -> the black veils at the end of the Rampart Gatehall (F4) part
  -> H1 ... H6  the Gallery
  -> H7         the Long Mourner (real fight, real rewards)
  -> H8         the Silent Key, then the Last Door -> Chapter II complete
```

The Gallery is a continuation after the ending, not a gate on it: the Warden and the Great Bell are untouched. The Ashen Ramparts (reached from the Cord Lift's top station) are the road to it; the old Mourner test arena there became the Gatehall.

## Rooms

| Room | Name | What is in it |
|---|---|---|
| F4 | Rampart Gatehall | lantern `lan_f4`; a veil gate (`great_bell`) across the east tunnel; a sentinel and a lantern-moth |
| H1 | Veilgate Threshold | lantern `lan_h1`; two Hushlings; first veils, windows and candles |
| H2 | Hall of Hanging Veils | a 10-tile pit with two stepping stones; Hushlings and Drifters; **silent bell `h2a`** opens the veil gate to H3 |
| H3 | The Mask Crypt | a descent by four ledges; two Stilt Mourners, two Reachers under stone beams, a Hushling; secret nook with a **Lifethread** |
| H4 | The Muffled Belfry | a zig-zag climb (no jump needs the dash); **three bells `h4a/b/c`** must all be unwrapped to part the veil at the top; Reachers and Drifters; lantern `lan_h4` |
| H5 | The Candlelit Aisle | the gauntlet: two Shade Brutes, three Hushlings, a Drifter; lantern `lan_h5`; secret nook with a **Silk Spool** and a glint cache |
| H6 | The Bier Chamber | no enemies: the bier, kneeling statues, two tablets, a lore note |
| H7 | The Hush Arena | vestibule with lantern `lan_h7`; a veiled arch falls when the fight starts; **the Long Mourner**; a veil gate (`mourner_defeated`) opens east afterwards |
| H8 | The Last Door Hall | lantern `lan_h8`; the **key altar**; the **Last Door** |

Every enemy, object and exit is checked for reachability by `tools/validate_world.js` using a stricter jump model than the rest of the world (3-row steps, 5-tile reach, a 3-tile dash on top), so nothing in the Gallery asks for a perfect jump.

## The silent bell

`OBJ.silentbell` (`src/entities/hushed.js`) is struck like a cache: the needle and the Silk Lance both reach it. `Game.hushToll` (`src/game/levels/hushed.js`) then

1. sets `hbell_<id>` and unwraps the cloth (first strike only), tolls, and flashes;
2. calls `onToll()` on every creature in the room: a Hushling or Drifter is *alerted* for 6 s (longer sight, faster, hunts from across the room), a Reacher is pulled off the ceiling after 0.3 to 0.9 s;
3. if the bell has a `gate`, checks whether every bell in its `group` has rung and, if so, sets the gate's flag and opens it with the normal gate animation.

Striking an already-unwrapped bell tolls again (1.4 s cooldown) and re-alerts the room, so the player can choose to wake it a second time but never has to.

## Creatures

Times in seconds, speeds in px/s, hero hitbox 24 x 56 px. Every blow has a readable pose change plus a pale glimmer under the mask (no eyes anywhere: the masks are blank). Weights multiply the difficulty's base hit (`Difficulty.WEIGHTS`).

| Creature | HP | XP | Moves | Tell | Blow | Open after | Weight |
|---|---|---|---|---|---|---|---|
| Hushling | 3 | 9 | crawls 98 (150 alerted) | 0.42 coil | lunge 470 for 0.4 (about 190 px) | 0.8 dazed | 1 |
| Shroud Drifter | 3 | 12 | hovers 96 (150 alerted) | 0.72 arms crossed | dive 520 for 0.6, arms are the hit box | 1.0 spinning | 1.5 |
| Stilt Mourner | 6 | 22 | stalks 58 (80 alerted) | 0.75 lean back | arm 104 px + lunge 66 px over 0.22 | 1.0 arm dragging | 2 |
| Gallows Reacher | 5 | 18 | hangs; stalks 80 after landing | 0.6 curl and tremble | drop (falls straight down), then a 0.45-tell lunge | 0.9 folded after landing, 0.8 after a lunge | 2 |
| Shade Brute | 9 | 30 | knuckle-walks 50 (70 alerted) | 0.85 fists overhead | slam box 112 px, plus a wave 310 px/s for 400 px each way | 1.15 fists buried | 2 (wave 1) |

Each tell is started only inside the range its blow can reach, so a hero who stands still is struck and one who steps back is not. Reachers are never duplicated by the Nightmare "extra enemies" pass (`HANGERS` in `difficulty.js`).

## Flags added to the save

`hb_h2`, `hb_h4` (veil gates), `hbell_<id>` (bells unwrapped), `mourner_met`, `mourner_defeated`, `silent_key`, `lastdoor_open`, `chapter2_clear`, `lore_hushed`, plus the usual `pk_*`, `sec_*` and `note_*` for the Gallery's finds. Stats: `mournerAttempts`, `mournerWinTime`, `chapter2Time`. Saves that predate the chapter load unchanged.

## Engine changes this needed

- `r.light()` was in the room DSL but never drawn. Areas can now opt in with `roomLights: true`; the Gallery does, no other area changed.
- `deco` accepts `hang` (anchored by its top) and `sway`; the veils use both.
- A `veil` gate kind (black curtains that part and tie back) and a `hush` kind (drawn by the arch object); `drawGate` keeps drawing the veils after they open.
- `onEnterRoom` / `cathedralTick` gave *every* arena room the cathedral's dawn recolour and ending music after the ending. They are now the cathedral's alone, and a boss can name its own phase-two colours (`heatTint`, `heatDeep`: the Mourner's are cold).
- `startWardenFight` / `onWardenDefeated` work on a boss's own flags (`flagKey`, `codexId`); the Warden's constructor asks `defeated()`, which the Mourner overrides.
- Enemies can list `slides` (states that keep their speed instead of braking) and set `lightColor`, `rim` and `deathColors`.
- Any object with `strikable` and `hit()` is struck by the needle and lance; caches use it too.

## Checking it without a browser

```
node tools/validate_world.js            # overlaps, misaligned exits, every placement reachable (SHOW=H4 prints a room)
node tools/smoke_hushed.js              # creatures, bells, gates, boss victory, key, Last Door, chapter card (VERBOSE=1 for timelines)
```

Neither can judge feel, difficulty or looks. What they do not cover and a playthrough should: jump comfort in the long rooms, fight pacing and damage on each difficulty, how the Gallery reads at 1280x720, and the cutscene timings.

## Known limits

- The Last Door ends Chapter II with a card and a teaser: the final boss behind it is not built.
- The Long Mourner has no rematch yet (the Warden's rematch machinery is Warden-only).
- The Gallery has no music by design. If music is added later, set `music` on `BW.AREAS.hushed` and give the Mourner's phases their own tracks in `mournerIntro`.

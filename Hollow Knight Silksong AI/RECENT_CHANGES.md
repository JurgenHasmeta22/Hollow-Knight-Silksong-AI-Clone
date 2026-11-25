# Bellweaver: what the last five commits added

A feature-by-feature account of the five most recent commits, oldest first. Everything lives in `Hollow Knight Silksong AI/` and is vanilla JavaScript on a global `BW` namespace with no build step. File names point to where the work is.

| # | Commit | Summary |
|---|---|---|
| 1 | `b5f3492` | Fix enemies respawning; adds agent skill packs |
| 2 | `491e7df` | Fix FPS drop in room M2 and stabilise frame time |
| 3 | `35ebe81` | Difficulty modes, lantern travel, parry, Archive, map, controller glyphs |
| 4 | `016498b` | Manual saves, boss rematch, test saves, intro lore and lore notes |
| 5 | `79e505e` | Archive merge, boss tuning, Shadow Step, learnable abilities, title fix |

Commits 3 to 5 were local only and are the ones in the accompanying patch file together with this document.

---

## 1. `b5f3492` Fix enemies respawn

**Problem:** enemies you killed reappeared as soon as you re-entered a room, even without resting.

**Fix (`enemies.js`, `game.js`, `save.js`):**
- Every placed enemy gets a stable id, `BW.enemyPersistKey(roomId, def)`, built from room, type, position and variant. The Warden is excluded, since it is a story fight.
- A killed enemy (or one that fell out of the world) is recorded in `state.cleared` and is skipped when the room loads again.
- Resting at a lantern, or respawning after death, clears the list and refills the current room, which matches how soulslike and Metroidvania bonfires work.
- `cleared` is written to saves and migrated for older ones.

**Tooling (not game code):** the commit also adds the agent skill packs under `.agents/skills/`, `.claude/skills/` and `skills-lock.json` (game design, level design, game feel, audio, platformer and similar references). They do not affect the game.

---

## 2. `491e7df` Performance: fix the M2 FPS drop and stabilise frame time

All changes are about avoiding allocations and wasted work (`audio.js`, `background.js`, `core.js`, `fx.js`, `game.js`, `hud.js`, `terrain.js`):
- Per-room terrain canvases and bitmaps are released when a room loads, and the extra full-size front canvas is gone.
- Per-tick entity lists are pruned in place (`BW.prune`) instead of allocating new arrays 120 times a second.
- Audio element volume is written only when it changes, and the blocked-play retry is throttled.
- `imageSmoothingQuality` is lowered, off-screen water is culled and `hexToRgb` is cached.
- The HUD shares a single health-bell gradient.
- Automatic resolution step-down requires two consecutive slow windows, so a single hitch no longer drops quality.

---

## 3. `35ebe81` Added lots of features

### Difficulty modes (`difficulty.js`, `menus.js`, `save.js`, `game.js`)
Three presets stored in the save (`state.difficulty`): **Story**, **Action** and **Nightmare**.

| | Story | Action | Nightmare |
|---|---|---|---|
| Enemies per room | as placed | about 1.5x | about 3x |
| Enemy health | 75% | 100% | 175% |
| Base hit | 1/4 bell | 1/2 bell | 1 bell |
| Enemy speed | normal | normal | 120% |
| Mend channel time | normal | normal | 140% |
| Thorns and swinging bells | no damage (you are only set back) | 1 | 2 |

- **Extra enemy placement** is deterministic per room and difficulty, so cleared-enemy keys stay stable.
- **Story** takes no damage from traps, and most hits take a quarter bell.
- **Nightmare is permanent.** Choosing it shows a warning screen first. Once chosen, it can never be switched to another mode. Story and Action can still be switched in **Options → Difficulty**.
- **Nightmare menu identity:** the blood-red menu entry and warning screen, plus its own difficulty screen with an icon. This is menu-only: gameplay visuals are identical across modes (no red tint or lighting change in play).
- Older saves load as Action.

### Damage by attack type
Each enemy attack has a weight multiplied by the difficulty's base hit, rounded to the nearest quarter bell and never below a quarter. Slow telegraphed blows hit harder than cheap ones, and pale variants hit 0.5 harder (cap 2). The Bestiary shows the real cost on your difficulty.

| Source | Weight |
|---|---|
| Flyer or spitter body touch, falling debris | 0.5 |
| Crawler body and lunge, flyer dive, spitter glob, Warden sweep/shockwave/Peal/thread rain | 1 |
| Hopper leap, Warden slam, leap landing and charge | 1.5 |
| Sentinel thrust | 2 |

### Parry (`player.js`, `enemies.js`, `audio.js`)
- Press the parry button just before a blow lands: no damage, +1 silk, the attacker is thrown back and dazed for about a second, and your strikes deal double damage to a dazed foe.
- A miss leaves you open briefly, so it cannot be spammed.
- Not parryable: thorns, swinging bells, the Warden's shockwaves, Peal, falling debris and silk spears.
- Parrying the Warden's own strikes cuts them short and cracks its poise; two parries stagger it.
- **Distinct parry sound** (`SYNTH.parry` in `audio.js`): a bright steel strike with a ringing tail and a rising shing, layered over the shield clink. Dropping a `parry` sample into the SFX pack overrides it.
- Contextual tips teach it: a hint in the Glowmoss Path, a tip the first time an enemy hurts you and another the first time you parry (switch off with **Options → Control Hints**).

### Lantern fast travel (`menus.js`, `objects.js`, `game.js`)
- While resting at a lantern, a lantern menu opens (E or Up).
- **Travel** lists every lantern you have already kindled, Sekiro-style. You arrive rested, healed and saved, and it becomes your respawn point.

### Enemy health bars (`hud.js`, `enemies.js`)
- A named bar appears over an enemy when you get close or hit it, with a pale trailing chip showing the damage just dealt. The Warden uses its own boss bar.

### "You Died" screen (`game.js`, `hud.js`)
- A full death card with what felled you and your death count. Press confirm to skip the wait. You then rise at the last lantern.

### Archive: Tips & Mechanics and Bestiary (`codex.js`, `guide.js`)
- **Tips & Mechanics:** how to move, strike, Mend, parry, dash, use the Lance, rest, travel, hazards, difficulty and the map. Entries that depend on an ability appear once learned.
- **Bestiary:** every creature starts as `???`. Meeting one writes its lore, behaviour, health and stats. Defeating it adds the hunter's notes. The Warden's attacks each stay `???` until seen. Sentinel, crawler, flyer, spitter, hopper and the Warden are covered.
- Tied to the save, and older saves are back-filled from the enemies you had already cleared.

### Map redesign (`map.js`)
- Explored rooms are drawn to scale with walls, ledges, thorns and gates. Neighbouring undiscovered rooms show as dashed `?` outlines, and gold chevrons mark unexplored exits.
- Pins for lanterns (lit or unlit), toll-looms, shrine, lamplighter, Belfry seal and cathedral doors.
- Objective marker: a pulsing star with an edge arrow when off screen.
- Side panel: rooms explored per region and a legend. The footer repeats the objective.
- Pan with arrows or stick, three zoom levels (1x, 2x, 3.4x), follow-and-recentre.

### Controller glyphs (`glyphs.js`, `input.js`)
- On-screen prompts switch to the device you last used.
- **Options → Controller Icons** cycles Auto, Xbox, PlayStation, Switch and Generic. The Controls screen, Archive tip chips, world prompts and tutorial hints all show both the key and the pad button.

### Intro and story flow (`main.js`, `menus.js`)
- A new game plays an intro sequence (`introSequence` in `game.js`) before the story intro, after the Nightmare entry screen if that difficulty was chosen.

---

## 4. `016498b` Added manual saves

### Manual save slots and loading (`slots.js`, `save.js`, `menus.js`)
- Five manual slots plus the autosave. **Save Game** and **Load Game** are in the pause menu, and Load Game is also on the title screen.
- Slot cards show the last lantern's room and region, exploration progress, play time and difficulty.
- Each slot keeps its own difficulty, so the Nightmare lock applies per save.
- Delete a slot with Q or LT, with a confirmation.
- Export and import of save files is kept, and starting a new game overwrites only the autosave (with a warning).

### Boss rematch from any lantern (`cathedral.js`, `game.js`, `slots.js`)
- After the Warden is defeated, the lantern menu offers **Boss Rematch**, with a briefing screen.
- The story save is parked while the fight runs on a copy of the flags with the victory undone. Nothing earned or counted is kept: no glints, rewards or stats. It records only your best time and win count, and `endRematch()` restores the save either way.

### Test saves (`testsaves.js`, `saves/before-the-warden.json`)
- **Save Data → Test Saves** offers *Before the Warden* (Action), *Before the Warden: Nightmare*, *Warden Defeated* and *Great Bell Rung*. Each has every room visited, every lantern lit, all abilities, 12 bells, 18 silk, 999 glints, all lore notes and a full Archive, and rests you at the Cathedral Antechamber lantern.
- `saves/before-the-warden.json` is a ready-made file to import.

### Intro lore and lore notes (`lore.js`)
- A longer run of intro chapters, plus an **interlude card** the first time you enter each region.
- **16 lore notes** are scattered through the world (one needs the Warden defeated). Read one with E or Up. Notes show their author and where they were found. Unread notes appear as faint pins on the map in rooms you have seen, and solid once read.

### Controls
- **Parry also on L1 / LB** (`input.js`, `glyphs.js`), with RB kept as a second parry button for muscle memory.

---

## 5. `79e505e` Finished main features

### Archive merge (`menus.js`, `guide.js`)
- Tips, Bestiary and Lore are one **Archive** in the pause menu, with three tabs. The Field Guide entry is gone from the title menu, and Archive is not available there.

### Boss tuning (`difficulty.js`, `boss.js`)
- The Warden is tankier and hits harder on the harder modes, via two new settings:

| | Story | Action | Nightmare |
|---|---|---|---|
| Warden health (`bossHp`) | 75% | 160% | 240% |
| Warden damage (`bossDmg`) | normal | 150% | 125% |

- `bossDmg` is applied on top of the base hit to the Warden's own blows. A reported problem on Action, where you could win by only attacking, motivated this.

### Shadow Step (perfect dodge) (`player.js`, `enemies.js`, `boss.js`, `game.js`)
- Dash just as a blow is launched at you, with the old dash still available. If a lunge, dive, thrust or Warden strike is within reach, you slip it: no damage, +1 silk, time slows, a violet shadow of you is left behind, the attacker is frozen for about 1.2 seconds and your strikes come faster for a counter window.
- A frozen foe takes extra damage (the Warden takes 1.6x). Dodging the Warden's sweep or slam cracks its poise, and dodging its charge stops it short.
- Detection is based on reach, not on the hit having to overlap you, so it works whichever way you dash. It does not work on thorns, bells, spitter globs, shockwaves, the Peal, debris or silk spears.
- It has its own Archive tip and is listed in **Controls**.

### Learnable abilities (`save.js`, `rooms.js`, `objects.js`, `game.js`, `map.js`)
Parry and Shadow Step are now learned at shrines, the same way as the Silk Dash, so you hold all three before the boss:

| Ability | Shrine | Where |
|---|---|---|
| Parry | Answering Toll | Weavers' Hall (room with the lantern and Odo) |
| Silk Dash | Swift Stitch | Shrine below the Loom Gallery (unchanged) |
| Shadow Step | Unwoven Step | Cathedral Antechamber; the great doors will not open until learned |

- Each shrine has its own colour, announcement and "try it" toast. Shadow Step also requires the Silk Dash.
- Tips, hints, Controls rows, the map pins and Odo's dialogue all react to what you have learned. The Journal shows "Abilities learned x / 3".
- **Old saves** keep what they could already do: they keep Parry, and Shadow Step if they had the dash.

### Difficulty-scaled windows (`difficulty.js`)
Standard action-game windows, scaling by difficulty:

| | Story | Action | Nightmare |
|---|---|---|---|
| Parry window | 0.36 s (22 frames) | 0.28 s (17 frames) | 0.20 s (12 frames) |
| Shadow Step window | 0.37 s | 0.31 s | 0.25 s |
| Shadow Step reach | 160 px | 120 px | 90 px |

### Title screen fix (`game.js`)
- On "Press any key or button", pressing Enter also activated the first menu item. The waking press is now swallowed, and a gamepad press also wakes the title.

### Documentation
- `README.md` was updated for controls, difficulty tables, abilities and the Archive, and `Controls` now lists Shadow Step and Parry as "once learned".

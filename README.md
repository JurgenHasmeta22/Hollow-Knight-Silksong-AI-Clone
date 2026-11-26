# Bellweaver

*a thread through the silent bells*

An original, hand-painted 2D action-exploration game that runs in the browser. You play the last Bellweaver, a small moth-knight with a silver needle. She climbs from the glowing caves of **Mosslit Hollow**, through the abandoned looms of **the Spindleworks**, up to **the Silent Belfry**. There she rethreads the two toll-looms that keep its seal shut, then opens the great doors of the **Cathedral of the Last Toll**.

**This is the complete game (v0.9.0 Alpha):** the full exploration adventure, the final boss and the ending.

---

## How to play

Use either option. Both run fully offline.

**Option A: just open it**
Double-click `index.html`. It works in Chrome, Edge, Firefox and Safari.

**Option B: local server**
- **macOS:** double-click `play.command`. The first time, macOS may ask you to allow it (right-click → Open). It starts a tiny local server and opens `http://127.0.0.1:8123/index.html`.
- **Windows:** double-click `play.bat`. Requires Python 3.
- **Any system:** run `python3 -m http.server 8123` in this folder, then open `http://127.0.0.1:8123/`.

Click the game once (or press any key) so the browser allows sound. A 16:9 window or fullscreen (Options → Fullscreen) is ideal for recording.

> **Saves follow the address.** A save made through `index.html` (file://) and one made through `http://127.0.0.1:8123` are stored separately by the browser. To move progress between them, or to another computer, use **Save Data → Export Save**, then **Import Save File**.

**Saves from the Stage 1 build load as they are.** Stage 2 only adds new progress flags, so the save format didn't change. If you finished Stage 1, choose **Continue**. You'll wake at the lantern in the Cathedral Antechamber, a few steps from the great doors.

**Want to go straight to the boss?** Open **Save Data → Test Saves** and pick one: *Before the Warden* (Action), *Before the Warden — Nightmare*, *Warden Defeated* or *Great Bell Rung*. Each has every room visited, every lantern lit, the dash, parry and Shadow Step, 12 bells, 18 silk, 999 glints, all lore notes and a full Archive, and rests you at the Cathedral Antechamber lantern. `saves/before-the-warden.json` is a similar file you can import with **Save Data → Import Save File**.

---

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | A / D or ← / → | Left stick / D-pad |
| Aim strike up / down | W / S or ↑ / ↓ | Stick up / down |
| Jump (hold for height) | Space | A |
| Needle strike | J | X |
| Down strike in air (bounces off enemies and thorns) | S + J | Down + X |
| Silk Dash (once learned) | K or Shift | B or RT |
| Shadow Step (once learned; the same button, pressed just as a blow lands) | K or Shift | B or RT |
| Silk Lance (costs 3 silk) | L | Y |
| Parry (once learned; time it as a blow lands) | I | LB / L1 (RB also works) |
| Mend: hold to heal 1 (costs 3 silk) | Hold Q | Hold LT / L2 |
| Interact / talk / rest / open doors | E or ↑ | Up |
| Lantern menu (while resting at a lantern) | E or ↑ | Up |
| Drop through a ledge | S + Space | Down + A |
| Map | M or Tab | Share / Create / View / Back (or touchpad click) |
| Pause | Esc | Menu / Start |

The game detects gamepads automatically (standard layout: Xbox, PlayStation and most others), and on-screen prompts switch to match the device you used last. The full list of controls is at **Options → Controls** (also on the title screen), and the same screen is where **Controller Icons** cycles **Auto** (detects the pad), **Xbox**, **PlayStation**, **Switch** and **Generic** (numbered buttons). The Controls screen, Archive tip chips, world prompts and tutorial hints all show the keyboard key and the matching pad button.

## Experience and levels

Defeating creatures earns **XP**, and so does finding things: glint stashes and loose glints, Lifethreads and Silk Spools, lore notes, hidden nooks, toll-looms and the stitches taught at the shrines. Lanterns give none, and neither do boss rematches. The level and an XP bar sit under the glints in the HUD, with a `+N XP` pop-up on every gain, and the pause Journal shows your progress.

| Source | XP |
|---|---|
| Moss Crawler / Lantern-moth | 8 |
| Glow Spitter | 12 |
| Cave-cricket | 14 |
| Pike Sentinel | 20 (pale variants earn 1.5×) |
| Glint pile / glint cache | 6 / 10 (once) |
| Lore note, hidden nook | 15, 20 (once) |
| Lifethread / Silk Spool | 40 each (once) |
| Toll-loom | 60 each (once) |
| Shrine stitch | 80 each (once) |
| The Bellbound Warden | 350 |

There are ten levels (50 XP to reach level 2, then 30 more for each next one, 1,530 in total). Every level makes every strike and Lance hit 4% stronger (up to +36%) and fully restores health and silk. Creatures come back when you rest, so they can be farmed a little, but each level asks for more than the last. Rematches give no XP. Saves from older builds start at level 1.

---

## Difficulty

Pick one under **New Game**. Saves from older builds load as **Action**. You can switch between Story and Action later in **Options → Difficulty** (enemy changes apply from the next room you enter).

**Nightmare is permanent.** Choosing it shows a warning screen first, and once chosen it can never be changed to another difficulty. Nightmare only looks different in the menus (blood-red entry and warning screen); gameplay visuals are the same on every difficulty.

| | Story | Action | Nightmare |
|---|---|---|---|
| Enemies per room | as placed | about 1.25× | about 3× |
| Enemy health | 75% | 100% | 175% |
| Damage from a hit | ¼ bell (weak hits ¼, heavy ½) | ½ bell (heavy ¾ to 1) | 1 bell (heavy 1½ to 2) |
| Enemy speed | normal | normal | 120% |
| Mend channel time | normal | normal | 140% |
| Thorns and swinging bells | no damage (you are still set back) | 1 | 2 |
| Warden health | 75% | 210% | 360% |
| Warden damage | normal | 125% | 125% |
| Parry window | 0.36 s (22 frames) | 0.32 s (19 frames) | 0.20 s (12 frames) |
| Shadow Step window | 0.37 s | 0.35 s | 0.25 s |
| Shadow Step reach (how close the blow must be) | 160 px | 135 px | 90 px |

**Damage by enemy and attack.** The base hit is ¼ / ½ / 1 bell (Story / Action / Nightmare) multiplied by a weight, rounded to the nearest ¼ bell (never below ¼):

| Source | Weight | Story / Action / Nightmare |
|---|---|---|
| Flyer or spitter body touch | 0.5 | ¼ / ¼ / ½ |
| Crawler body, lunge; flyer dive; spitter glob; Warden sweep, shockwave, Peal, thread rain, Tolling Tremor eruption, Rimcutter, tone-orb | 1 | ¼ / ½ / 1 |
| Hopper leap; Warden slam, leap landing, charge | 1.5 | ½ / ¾ / 1½ |
| Sentinel thrust | 2 | ½ / 1 / 2 |
| Falling debris | 0.5 | ¼ / ¼ / ½ |

Pale variants hit 0.5 harder (capped at 2). The Bestiary shows each creature's strike cost on your current difficulty. The Warden's own blows are further multiplied by its damage setting (Action and Nightmare 125% on top of the base hit); the Warden's damage weights in the table above apply before that multiplier.

**Enemy health bars.** A named health bar appears over an enemy when you get close or hit it, with a pale trail showing the damage just dealt. The Warden uses its own boss bar.

**Death screen.** When you fall, a "YOU DIED" card shows what felled you and your death count, then you rise at your last lantern (press confirm to skip the wait).

---

## Parry

Press **I** (LB / L1) just before a blow lands. A good parry takes no damage, gives +1 silk, throws the attacker back and leaves it dazed for about a second, during which your strikes deal double damage. A miss leaves you open for a moment. You can't parry thorns, swinging bells, or the Warden's shockwaves, the Peal, falling debris, silk spears, Tolling Tremor eruptions, the Rimcutter ring and tone-orbs. Parrying the Warden's own strikes cuts them short and fills its **poise** bar (a segmented bar under its health bar), and so does a Shadow Step (a gold **PARRY** or violet **SHADOW STEP** call-out floats over it with the poise built); ordinary strikes add very little, and almost nothing on Nightmare, so parries and Shadow Steps are the way to fill the bar. Poise only drains after a few quiet seconds. On Action and Nightmare its health is very high, so staggering it is how the fight is won. **Full poise staggers it** (about 3.4 s, roughly triple damage, reached after about three or four parries and Shadow Steps, stars, a ring and a "Staggered" call-out), and **a parry plus a Shadow Step within about 6 seconds, with poise at least 60% up (the diamond on the bar), breaks its guard**: "Guard broken", about 5.2 s of stun at about four times the damage. Running away or trading blows no longer wins the fight; weave parries and Shadow Steps together, then punish.

A parry has its own sound: a bright steel strike with a ringing tail, layered over the shield clink (synthesised in `audio.js` as `SYNTH.parry`; dropping a `parry` sample into the SFX pack would override it). You learn it at the **Shrine of the Answering Toll** in the Weavers' Hall (the lantern room with Odo), early in the journey. Once learned, a tip is taught in the Glowmoss Path, and the first time an enemy hurts you and the first time you parry one a short tip appears (turn off with **Options → Control Hints**).
## Options

**Audio:** master, music, sound effects, ambience and interface volumes, plus mute when the window loses focus.

**Graphics:** a Low / Medium / High quality preset (or Custom), resolution, lighting (full / simple / off), particles, ambient effects, backdrop detail, a frame limit (off / 30 / 60), an FPS counter (FPS or detailed with frame time) and fullscreen.

**Gameplay:** screen shake, control hints, controller icons and (in play) difficulty.

Settings are saved on this device.

## Shadow Step (perfect dodge)

You learn it at the **Shrine of the Unwoven Step** in the Cathedral Antechamber, and the Cathedral's great doors will not open until you have. It needs the Silk Dash. Press **Dash** the moment a blow is launched at you. If a lunge, dive, pike thrust or one of the Warden's sweep, slam, leap landing or charge is in flight within reach of you (see the reach row above) during your dash or the window after it, you slip it cleanly, whichever way you dash: no damage, +1 silk, time slows, a violet shadow of you is left behind and the attacker is frozen for about 1.2 seconds. Your strikes then come faster for a short counter window and a frozen foe takes extra damage (the Warden takes 1.6×). A dash that isn't timed to a blow is just a dash, and it does not work on thorns, swinging bells, spitter globs or the Warden's shockwaves, Peal, debris, silk spears, eruptions, Rimcutter ring and tone-orbs. Dodging the Warden's sweep or slam leaves it open like a parry does and cracks its poise; dodging its charge stops it short. The tip is taught the first time you do it and lives in the Archive.

## Archive

Open **Archive** from the pause menu (it is not on the title screen).

- **Tips & Mechanics**: how to move, strike, Mend, parry, dash, Shadow Step, use the Lance, rest and travel between lanterns, plus hazards, difficulty and the map. Entries that depend on an ability (Parry, Silk Dash, Shadow Step) appear once you learn it.
- **Bestiary**: every creature starts as `???`. Meeting one in the world writes its lore, behaviour, health and stats. Defeating one adds the hunter's notes (how to fight it). The Warden's entry is written when you meet it; each of its attacks stays `???` until you have seen it, and its strategy is completed when you defeat it.
- **Lore**: the 16 notes you have read, each with its author and where it was found. Unread ones show a hint about where to look.

Entries are stored in the save. Saves from older builds are filled in from the enemies you had already cleared.

## Gallery

Open **Gallery** from the pause menu. **Left / Right** switches category and **Up / Down** browses; everything is read-only, so nothing you do here touches your save or the world.

- **Realms**: full-screen backdrops of Mosslit Hollow, the Spindleworks, the Silent Belfry and the Cathedral (unlocked by visiting each region), plus the title art and, after the ending, the dawn over the Hollow. Each plays its own music and shows how many of its rooms you have found.
- **Creatures**: large animated portraits of every creature in the Bestiary, plus Odo and the Bellweaver, with their lore. Unmet ones are black silhouettes marked `???`.
- **Memories**: replay story moments you have already seen: the prologue, the region interludes, the shrines, the toll-looms, the Warden's tale, the vow broken, and the ending with its epilogue and credits. Press confirm to watch; **Esc / Back** skips and returns to the Gallery.

## Map

Press **M**, **Share / Create / View** or the touchpad click to open the map, from the game or from the pause menu. Explored rooms are drawn to scale with walls, ledges, thorns and gates. Rooms next to ones you have explored show as dashed **?** outlines, and gold chevrons mark exits you have not taken yet. Pins show lanterns (lit or unlit), toll-looms, the shrine, the Lamplighter, the Belfry seal, the Cathedral doors and lore notes (a solid scroll once read, a faint outline while unread in a room you have seen); a pulsing star marks your current objective once you have found the place (an edge arrow points to it when it is off screen). The side panel tracks rooms explored per region and holds the legend; the footer repeats the current objective.

Controls: pan with the arrows or left stick, **L / Y** cycles zoom (1×, 2×, 3.4×; zoomed views follow you and show room names), **Q / LT** re-centres, **M / Esc** closes.

## Fast travel, saving and rematches

Lanterns you have kindled stay lit. While resting at one, press **E** or **↑** to open the **lantern menu**:

- **Travel**: pick any other kindled lantern. You arrive rested, healed and saved there, and it becomes your respawn point.
- **Save Game**: write the moment into one of five manual slots.
- **Boss Rematch** (after the Warden has fallen): fight it again from any lantern. A rematch gives no glints or rewards, does not change your story save, and records only your best time and win count. Losing or winning returns you to the lantern.

The game still autosaves when you rest, travel or fall. **Load Game** (title and pause menus) lists the five slots and the autosave; **Q / LT** on a slot deletes it (with confirmation). **Save Game** is also in the pause menu. Each slot keeps its own difficulty, so the Nightmare lock applies per save.

## Story and lore

The game opens with a short run of intro chapters, plus an interlude card the first time you enter each region. Sixteen lore notes lie in the world (one needs the Warden defeated). Read one with **E** / **↑**; read notes are listed under **Pause → Archive → Lore** and are marked on the map.

---

## What's in the game

**The exploration adventure (Stage 1)**
- **18 hand-designed rooms in three areas and the cathedral:** loops, shortcuts, optional side paths and secrets.
- **Five enemy types**, each with a readable wind-up and a punishable recovery:
  - mossy crawlers that lunge
  - lantern-moths that dive
  - shielded pike sentinels
  - glowing spitters
  - spiny cave-crickets
- **Combat and resources:**
  - Directional needle strikes, pogo down-strikes, hit-stop, knockback and invulnerability frames.
  - Hits build **silk**, which is spent on **Mend** (heal) or the **Silk Lance**.
- **Three learnable abilities, all earned before the boss:** **Parry** (Shrine of the Answering Toll, Weavers' Hall), **Silk Dash** (found halfway through; works on the ground and in mid-air) and **Shadow Step** (Shrine of the Unwoven Step, Cathedral Antechamber, required to open the great doors). Saves from before this change keep what they could already do.
- **Rest lanterns, upgrades and Odo:** lanterns heal and save. You can find Lifethreads, a Silk Spool and glint currency, and Odo the lamplighter gives hints and runs a small shop.
- **Map and saving:** a discovered-room map with exits, pins, objective marker, zoom and pan, plus local saves with export and import.

**What Stage 2 added**
- **The great doors open.** Once both looms sing, the sealed doors of the Cathedral of the Last Toll swing open in a short sequence.
- **A short approach:** a vestibule where a cracked bell rolls its toll along the floor. It's a safe place to practise the move the boss will demand: *run at it, jump, then Silk Dash across*.
- **The Bellbound Warden**, an original towering insect guardian. Its body is a weathered bronze bell, its ceremonial mask is cracked, silk hangs from it, and its weapon is the Great Bell's own clapper.
  - **Entrance:** bound to the Great Bell by silk cords, it tears free to a title reveal and its own battle music. You can skip the entrance, and retries get a brief version.
  - **Six telegraphed attacks:** each has a wind-up pose with a sound and light cue, then a recovery window you can punish or heal in.
    - Clapper sweep.
    - Overhead slam with a traveling shockwave.
    - Leap onto a marked spot.
    - Bell-ram charge that ends in a stunned stagger.
    - **The Peal:** a long, low wave of resonance that's too long to jump. You must jump and Silk Dash across it.
    - Thread rain (phase two only).
  - **Stagger:** enough hits make it stagger.
  - **Phase two at half health:** its mask cracks, its silk catches fire, the cathedral glows red and the music intensifies.
    - Sweeps and leaps come in pairs.
    - Slams also shake debris from the vault.
    - The Peal echoes back off the walls.
    - Silk spears rain everywhere except one marked opening.
- **Health bar** with a phase marker at half.
- **Retry-friendly:** the antechamber lantern, just outside the arena, becomes your checkpoint. On death you wake there with full health, the arena and all hazards reset, and the entrance takes about a second.
- **A real ending:**
  - The defeat sequence and a reward.
  - Rethreading the Great Bell, which tolls for the first time since the silence and turns the cathedral to dawn light.
  - An illustrated epilogue and credits with your stats. Once the game is beaten, **Credits** also appears on the title screen and rolls them again.
  - The choice to return to exploring or go back to the title.
  - Completion is saved and marked on the title screen. Afterwards the Belfry's bells ring now and then, and you can ring the Great Bell again.

---

## Credits

- **Game design, code, levels and writing:** created for this project with Claude Code. No engine or framework (plain HTML5 Canvas and JavaScript).
- **Art:** generated with **Higgsfield** (GPT Image 2.5) from original prompts. This includes the character and boss pose sheets, enemies, props, textures, backgrounds, the Great Bell, title art and the ending painting. Everything was then cropped, keyed, anchored and packed for the game.
- **Music:** generated with **Higgsfield** (Sonilo Music), including the two boss phases and the ending theme. **Ambience and sound effects:** **Higgsfield** (Seed Audio). A few interface clicks are synthesized in code.
- **Fonts:** Cinzel and Cormorant Garamond, under the SIL Open Font License.

The game never contacts Higgsfield or any other service while you play. Every asset is included in `assets/`.

---

## Project layout

```
index.html          entry point
play.command/.bat   optional local-server launchers
saves/              a ready-made save just before the boss (optional)
src/                game code (classic scripts, no build step; load order is set in index.html)
  core/
    core.js         constants, physics tuning, helpers
    main.js         entry point
  input/
    input.js        keyboard + gamepad
    glyphs.js       keyboard keycaps and Xbox / PlayStation / Switch / generic button icons
  audio/
    audio.js        music / ambience streaming, SFX, synth fallbacks
  save/
    save.js         versioned save format, export / import, migration
    testsaves.js    ready-made test saves (Save Data → Test Saves)
  rendering/
    graphics.js     Quality presets and the per-frame render settings (BW.gfx)
    assets.js       image loading and sprite drawing
    fx.js           particles, slashes, screen shake
    terrain.js      pre-rendered terrain
    background.js   parallax, atmosphere, lighting
  world/
    world.js        room DSL, tile collision
    rooms.js        the world: areas and all rooms (incl. the cathedral)
    fortress.js     the Ashen Ramparts test area, including the Ramparts Throne boss arena
  entities/
    player.js       the Bellweaver
    enemies.js      enemy behaviours
    objects.js      lanterns, pickups, NPC, shrine, toll-looms, lifts, doors, the Great Bell
    boss.js         the Bellbound Warden and its attack hazards
    mourner.js      the Long Mourner: a second boss with its own poses, a moveset of its own, two health bars and an
                    opening cinematic (fights in the Ramparts Throne test arena)
  progression/
    difficulty.js   Story / Action / Nightmare presets and extra-enemy placement
    xp.js           experience curve, levels and the strike-power bonus
    codex.js        Archive data (tips, bestiary, unlocks)
    lore.js         intro chapters, region interludes, collectible lore notes
  ui/
    hud.js          HUD, prompts, toasts, dialog box
    menus.js        title, pause, options and other menus
    guide.js        the Archive screen (tips, bestiary, lore tabs)
    map.js          the world map screen (exits, pins, objective, zoom and pan)
    slots.js        manual save slot, lantern menu and boss rematch screens
    gallery.js      Gallery screen (realms, creatures, replayable story memories) and the read-only replay mode
  game/
    game.js         game loop, rooms, camera, sequences
    levels/cathedral.js  doors, boss entrance, arena, victory, Great Bell, ending and credits
assets/
  manifest.js       generated sprite / image manifest
  img/ audio/ fonts/
```

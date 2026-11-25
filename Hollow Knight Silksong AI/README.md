# Bellweaver

*a thread through the silent bells*

An original, hand-painted 2D action-exploration game that runs in the browser. You play the last Bellweaver, a small moth-knight with a silver needle. She climbs from the glowing caves of **Mosslit Hollow**, through the abandoned looms of **the Spindleworks**, up to **the Silent Belfry**. There she rethreads the two toll-looms that keep its seal shut, then opens the great doors of the **Cathedral of the Last Toll**.

**This is the complete game (Stage 2):** the full exploration adventure, the final boss and the ending.

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

**Want to go straight to the boss?** `saves/before-the-warden.json` is a ready-made save at that lantern, with the exploration finished. Import it with **Save Data → Import Save File**.

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
| Silk Lance (costs 3 silk) | L | Y |
| Mend: hold to heal 1 (costs 3 silk) | Hold Q | Hold LB / LT |
| Interact / talk / rest / open doors | E or ↑ | Up |
| Drop through a ledge | S + Space | Down + A |
| Map | M or Tab | View / Back |
| Pause | Esc | Menu / Start |

The game detects gamepads automatically (standard layout: Xbox, PlayStation and most others), and on-screen prompts switch to match the device you used last.

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
- **Silk Dash:** found halfway through. It works on the ground and in mid-air.
- **Rest lanterns, upgrades and Odo:** lanterns heal and save. You can find Lifethreads, a Silk Spool and glint currency, and Odo the lamplighter gives hints and runs a small shop.
- **Map and saving:** a discovered-room map, plus local saves with export and import.

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
  - An illustrated epilogue and credits with your stats.
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
src/                game code (classic scripts, no build step)
  core.js           constants, physics tuning, helpers
  input.js          keyboard + gamepad
  audio.js          music / ambience streaming, SFX, synth fallbacks
  save.js           versioned save format, export / import, migration
  world.js          room DSL, tile collision
  rooms.js          the world: areas and all rooms (incl. the cathedral)
  fx.js             particles, slashes, screen shake
  player.js         the Bellweaver
  enemies.js        enemy behaviours
  objects.js        lanterns, pickups, NPC, shrine, toll-looms, lifts, doors, the Great Bell
  boss.js           the Bellbound Warden and its attack hazards
  terrain.js        pre-rendered terrain
  background.js     parallax, atmosphere, lighting
  hud.js / menus.js HUD, dialog, menus, map
  game.js           game loop, rooms, camera, sequences
  cathedral.js      doors, boss entrance, arena, victory, Great Bell, ending and credits
assets/
  manifest.js       generated sprite / image manifest
  img/ audio/ fonts/
```

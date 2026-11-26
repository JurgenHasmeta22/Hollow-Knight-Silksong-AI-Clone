# Adding new Ronin sprites

The Ronin's poses are the sprites named `ronin_<pose>` in `assets/manifest.js`, cut from the sheets in `tools/art/` by
`tools/import_ronin_art.py` (see its header: pose rectangles per sheet, packed into `assets/img/sprites/ronin.webp`).
Add a new pose rectangle there, re-run the script, and the code below picks it up by name with no other change.

## Names the code already looks for

| Pose name | When it is shown | Falls back to |
| --- | --- | --- |
| `form_<pose>` (any existing pose, e.g. `form_run1`, `form_walk`, `form_jump`, `form_midair`, `form_idle_a`, `form_ready`) | the transformed hero's own version of that pose | the normal pose |
| `parry_perfect` | the moment a parry lands cleanly | `ready` |
| `dodge` | a Shadow Step / perfect dodge | `tumble` |

The existing poses and where they appear: idle (`idle_a`, `breath`, `idle_b`), `walk` (slow), `run1-3` (fast), `jump` / `midair`,
`crouch` (a short fall) / `slam` (a long fall), `ready` (parry stance), `knock` (a heavy hit) / `hurt`, `kneel` (one bell left),
`drink` (the gourd), the item poses (`crouch`, `barrage`, `illusion`, `taunt`), the combo, skill and form poses in
`src/entities/ronin.js` (`SKILLS`, `COMBO`, `poseNow`), and the death poses (`crumple`, `crawl`, `lying`, `dead`, `ash`).

Figure heights vary a lot between hand-drawn poses, so poses are drawn at a common height: add a new standing pose to `STAND`
(or a running one to `RUN`) near the top of `src/entities/ronin.js` and it is scaled to match.

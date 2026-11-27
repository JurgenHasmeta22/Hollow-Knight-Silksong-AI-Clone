# What the Ronin still needs

What is drawn today, what is missing, and what a full 2D Phantom-Blade-style hero would have. "Burning form" is the
transformation. Poses are named as the code looks for them (see RONIN_SPRITES.md); `form_<pose>` is picked up
automatically when it exists.

## The one thing that is wrong right now

Only the `transformed` pose and the `form_*` poses from the third sheet show the burning form's own design (crimson and violet,
red eyes, no white mask). **Every other move the burning form has was drawn in the normal look** (a white mask and a straw hat),
so while transformed those are drawn with a crimson-violet tint (`Assets` variant `shade`) as a stand-in. They read as
"transformed" but they are not the right art. Replace them, most visible first:

| Priority | Pose to draw in the burning form | Used for | Name to give it |
| --- | --- | --- | --- |
| 1 | **run cycle (4 to 6 frames)** | every step while transformed (today `form_walk` with a bob) | `form_run1` ... `form_run4` |
| 1 | **dash** | the Phantom Clone Dash, the dash | `form_speed` |
| 1 | **hurt / knocked back** | every hit taken (today the stand pose) | `form_hurt`, `form_knock` |
| 1 | **idle, 2 or 3 poses** | standing still (today one pose) | `form_idle_a`, `form_idle_b` |
| 2 | clone dash, clash (dash slash), whirlwind, grab | skills | `form_clone`, `form_clash`, `form_whirl`, `form_grab` |
| 2 | ground eruption (arm driven into the floor), ground pound dive | skills | `form_erupt`, `form_dive` |
| 2 | up strike, down strike | aimed strikes | `form_swordup`, `form_pound` |
| 2 | landing, heavy landing | after a fall | `form_crouch`, `form_slam` |
| 2 | gourd (drinking) and the item throws | healing and items | `form_drink`, `form_throw` |
| 3 | barrage, void slash charge, illusion burst | skills | `form_barrage`, `form_charge`, `form_illusion` |
| 3 | the ultimate: burst, crossed arms, release | the Giant Spectral Summon | `form_burst`, `form_cross`, `form_gburst` |
| 3 | the return to the normal form | when the form ends | `form_return` |

Also: `form_special` and `form_attack` are single poses; the combo would read better with a different pose per hit.

## Normal form: what is there and what is missing

| Move | Have | Missing |
| --- | --- | --- |
| Stand | 3 idle poses, breathing, kneel when wounded | a real idle loop (4 to 6 frames) |
| Walk, run | 1 walk pose, 3 run poses | proper cycles (6 to 8 frames each), a turn-around, a skid when stopping |
| Jump | jump, fall, soft and hard landing | take-off (anticipation), apex, the double-jump is burning-form only |
| Dash | 1 pose | dash start and dash end |
| Ground combo | 3 hits | a fourth and fifth hit, a heavy attack and its wind-up, a launcher (uppercut) |
| Air | air slash, juggle, down strike | a three-hit air combo, plunge: start, fall, land |
| Guard | block, parry, perfect parry, perfect dodge | block-hit recoil (2 frames), a riposte after a perfect parry, guard break stagger (today the knock-back pose) |
| Dodge | the perfect dodge | a dodge roll or back-step for a normal evade |
| Hurt | hurt, knock | light vs heavy hit, knocked down, getting up |
| Death | 5 poses | fine |
| Items | gourd (1 pose), item poses borrowed from other moves | a drinking loop (4 frames), a proper throw |
| Other | meditate, taunt, interact | ledge grab and climb, a pick-up pose, praying at a shrine |

## What a full Phantom-Blade-style 2D hero would have

1. **Frames, not poses.** Today each move is one pose. A modern action game draws 4 to 8 frames for a run, 3 to 6 for a swing,
   with anticipation, contact and follow-through. This is the biggest jump in feel.
2. **Execution (fatal strike).** A staggered or guard-broken enemy can be finished with a dedicated animation: a wind-up, a strike
   and a finish pose, plus the same from the air. Phantom Blade Zero is built around this.
3. **A combo tree with cancels.** Light and heavy strings, a launcher into air combos, a dodge or parry that cancels recovery,
   and special moves on cooldown that chain out of them.
4. **Attack trails.** The old thin arcs were removed; each attack should have a drawn trail (one sheet per hit and per form)
   so a swing has weight.
5. **Hit and block effects as sprite sheets:** hit sparks, block sparks, a parry flash, a perfect-parry burst, a guard-break shatter.
6. **Movement set:** ledge grab and climb, a slide or crouch, wall slide and wall jump if the levels want them, an air dash.
7. **Both forms complete.** Everything above twice, or one shared set plus a recolour pipeline.

## Technical requirements for new sheets

- Transparent background if possible; otherwise one flat grey (the importer keys it out).
- One pose per cell, the figure facing right, **feet on a common baseline** (the anchor is taken from the lowest solid row).
- The same figure scale across all sheets (the normal figure is about 400 px tall at the size of the first two sheets; the third sheet
  is half that and is enlarged 2x on import). Draw at 2x if you can.
- A caption under each pose is fine (it is wiped), but leave a gap between the pose and its caption.
- Effects (trails, sparks) either inside the pose or on their own cells named `fx_<name>`.

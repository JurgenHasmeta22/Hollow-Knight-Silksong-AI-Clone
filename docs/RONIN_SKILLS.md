# Testing every skill and the transformation

## Where

**Pause (Esc) → Save Data → Test Saves** has three saves, all the Faceless Ronin:

- **Skill Test: everything unlocked**: the whole world open, every skill learned, a full satchel and gourd. The best place to try things.
- **Before the Warden**: resting at the antechamber lantern, the first boss next door.
- **Before the Long Mourner**: the Gallery crossed, resting outside the Hush Arena.

A loaded test save is flagged. While it is, **silk, the gourd and the satchel never run out** and **the Shade is full again as
soon as a form ends**, so you can transform over and over. A normal journey is unchanged.

In a normal journey the special moves are **learned in the Skills menu** (Pause → Skills); the first points arrive at level 2.

## Keys (keyboard defaults; the Controls screen in Options shows the gamepad ones)

| Action | Key |
| --- | --- |
| Move / aim up / aim down | A D / W / S (or the arrows) |
| Jump | Space |
| Strike | J (or X) |
| Dash | K (or Shift, C) |
| Energy Barrage | L |
| Skill | U |
| Transform / ultimate | O |
| Parry | I |
| Healing Gourd | Q (hold to drink) |
| Quick item: use / change | R (hold, or T, to change) |

## Normal form

| Skill | How |
| --- | --- |
| Three-hit combo (the third lunges) | tap J three times quickly |
| Air slash | J in the air |
| Up strike / down strike (bounces) | W + J / S + J in the air |
| Void Slash (Skills: Void Slash) | hold J on the ground until the aura closes (about 0.6 s), then release (4 silk) |
| Energy Barrage (Skills: Energy Barrage) | L (3 silk) |
| Whirlwind Dash (Skills: Whirlwind Dash) | U (2 silk) |
| Dash slash (Skills: Dash Slash) | J in the middle of a dash |
| Parry | I just before a blow lands |
| Shadow Step | dash K in the instant before a blow lands |

## Transformation

The **Shade** gauge sits under the experience bar: every blow fills it, a parry or a Shadow Step fills it a lot. When it is
full (it is, in a test save) press **O** on the ground. About 24 seconds, extended by every hit and every parry.

| Skill | How |
| --- | --- |
| Four-hit combo | tap J four times |
| Flame Ascent (double jump) | Space again in the air |
| Phantom Clone Dash | K (an untouchable dash that leaves clones) |
| Clashing Shadow Slash | J in the middle of a dash |
| Five-way Barrage | L (2 silk) |
| Whirlwind Dash | U (free) |
| Phantom Grab | U + W |
| Ground Eruption | U + S on the ground |
| Ground Pound | U + S in the air |
| Illusion Burst | after a perfect Shadow Step while transformed |
| Giant Spectral Summon (Skills: Giant Spectral Summon) | O again with more than 4 s left (the ultimate: it ends the form) |

## The gourd, the quick items and the skill tree

| Thing | What it does |
| --- | --- |
| Healing Gourd | Hold Q: a draught mends two bells (three with Sweet Gourd). Three draughts, four with Deep Gourd; they refill at every lantern and when you wake after a fall. |
| Toll Charge | Stuns every foe near you and chips them. |
| Shard Fan | Three bell shards that pass through everything. |
| Ash Veil | Untouchable for 1.5 s. |
| Rage Draught | Blows hit 25% harder for 20 s. |
| Odo's shop | Talk to Odo → Buy supplies. Prices: 60 / 40 / 80 / 120 glints. Fallen foes also drop items now and then (10%). |
| Skills | Pause (or the lantern menu) → Skills. Three branches: Blade (Whetted Edge, Flowing Strikes, Dash Slash, Void Slash, Energy Barrage), Shade (Whirlwind Dash, Quickening, Lingering Shade, Burning Shade, Giant Spectral Summon) and Resolve (Deep Gourd, Sweet Gourd, Steady Guard, Deep Satchel, Iron Resolve). Each costs glints: 80 per point of cost, 22 points (1,760 glints) for the lot. |
| Glints | The yellow stones: the only currency (no experience, no levels). Earned from kills, stones and caches, lore notes, hidden nooks, bells, shrines, looms and the two great foes. Spent on skills and in Odo's shop. |

## The guard and the posture bar

Under the red health bar is the **posture bar**. Hold the parry button (I / LB) *after* its window to raise the guard:

- A blow from the front costs posture, not health (about 26 per ordinary blow). Walking slowly is allowed while guarding.
- A clean **parry** (a tap just before a blow) costs nothing and gives 25 posture back.
- Keeping the guard up costs posture all the while (9 a second), so it cannot be held for ever; at zero it breaks.
- Posture does not refill while you guard. After a short pause it refills at 14 a second.
- **Empty = guard broken**: you reel for 1.2 s and stay open for 1.6 s, taking 50% more damage, and the bar creeps back at 8 a second.
- Blows from behind, traps, and attacks with the red tell cannot be blocked.
- Steady Guard in the Skills screen makes the bar 30% larger.

When new art arrives, a `block` pose (the held guard) and a `guard_break` pose are picked up by name (see RONIN_SPRITES.md).

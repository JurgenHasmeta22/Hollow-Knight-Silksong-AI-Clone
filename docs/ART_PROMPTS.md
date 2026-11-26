# Bellweaver — Chapter II art prompt pack

Paste-ready prompts for an image generator (GPT-Image, Higgsfield, etc.). Companion to [EXPANSION_PLAN.md](./EXPANSION_PLAN.md).
Area A (Garrison Road & Hollow Keep) backdrops are already generated, so §3 starts with its bosses and enemies; its backdrop prompts are kept in §5 for reference.
**Area G, The Hushed Gallery**, is a further area added after A to F: its boss (§3.7), its five enemies (§4, #13 to #17) and the shared **[HUSHED LOOK]** block (§2.1) are all below.

## 0. How to use

1. Always paste the **STYLE PREAMBLE** (§1) first, then the asset prompt. Replace `[PREAMBLE]` with it.
2. Sprites and props go on a flat chroma-key green `#00FF00` background so `tools/pack_sprites.py` can key and crop them.
3. Generate one **pose sheet** per character: all poses in one image, in a row (or two rows), same scale, same feet baseline, no overlap, generous spacing.
4. Reuse the same reference image / seed for every sheet of one character, so the design stays identical.
5. Keep the pose order exactly as listed. The order is the order of the frames in the manifest.
6. Generated files go to `assets/img/sprites|bg|tex|props|obj/`, then run the pack tool. No code change is needed to swap art.

## 1. Style preamble

```
Hand-painted 2D game art for a dark gothic metroidvania, insect-folk fairy tale.
Dark ink outlines, painterly brush texture, soft rim light, desaturated palette with ONE
luminous accent colour. Haunted, melancholic mood. Strong readable silhouette. Original design,
no logos, no text, no watermark. Side view (facing right), flat orthographic, no perspective
distortion. Same visual style as a bell-tower cathedral of moss, thread and bronze bells.
```

## 2. Sprite-sheet rules (append to every character prompt)

```
Layout: one single image, all poses side by side in a row (two rows if more than 7), flat solid
chroma-key green #00FF00 background, no shadows on the ground, no ground line, no text or labels.
Each pose fully visible, not touching the others, with at least 40 px of gap. Identical character
design, scale and proportions in every pose. Feet/lowest point of every pose on the same baseline.
All characters face right. Clean outlines (no green fringing), no motion-blur smears.
```

### 2.1 Area G look block, [HUSHED LOOK] (paste after the preamble for every Area G prompt)

Every creature of the Hushed Gallery shares this look, so the boss and its servants read as one family. The mask must stay blank, so keep the NEGATIVE line: image generators like to add eyes. If one slips through, regenerate with "the mask is a blank smooth oval, like an egg".

```
THE HUSHED (shared look): matte pitch-black, inky silk-like bodies, very long thin limbs with too many
joints, tattered black mourning veils, and a smooth bone-white porcelain MASK that is completely
featureless: no eyes, no eye holes, no nose, no mouth, no cracks that form a face. Only a faint cold
pale-blue glimmer leaking from joints and from under the mask edge. Accent colour: cold pale blue.
ABSOLUTELY NO TEXT of any kind in the image: no labels, no numbers, no captions, no pose names, no
titles, no watermark. The space under every pose is plain flat #00FF00.
NEGATIVE: eyes, eye sockets, eye glow, pupils, mouth, nose, facial features, expression, text, labels,
numbers, captions, pose names, watermark, green fringing, motion blur, background scenery.
```

Labels are the common failure: if the generator adds them anyway, they cannot be removed by asking, so strip them in an image editor (paint the strip under each pose with the same flat #00FF00) before packing.

## 3. Bosses (7) — pose sheets, 12–14 poses each

Every boss sheet has the common poses first, then one pose per move tell/strike. A **tell pose** is the readable wind-up; the strike/recovery are separate poses.
Common poses (all bosses): `idle`, `walk`, `roar` (phase change), `stagger` (poise/posture broken), `fallen` (defeated).

### 3.1 Sir Aldric Vael, the Gilded Duelist (Area A — Garrison Keep)

Design: tall, slim insect-knight swordsman, gilded but battered plate armour, tattered crimson sash, thin rapier, small round buckler. Elegant and precise.
Accent: gold. Palette: warm grey steel, gold trim, faded crimson.

```
[PREAMBLE] Character pose sheet of SIR ALDRIC VAEL, a tall slender insect-knight duelist in
gilded, battered plate armour with a tattered crimson sash, a thin rapier in his right hand and a
small round buckler on his left arm, a plumed helm with a narrow visor slit and faint amber eyes.
Graceful, precise, aristocratic. 14 poses in order:
1 idle (guard stance, rapier forward), 2 walk (measured stride),
3 quick-thrust tell (arm drawn back, rapier pulled to the hip), 4 quick-thrust strike (full lunge, arm extended),
5 rising-cut tell (blade low behind the body), 6 rising-cut strike (blade swept up overhead),
7 three-cut string pose A (horizontal slash, mid-swing), 8 three-cut string pose B (feint: blade held, body coiled, hesitating),
9 shield-bash tell (buckler pulled back, shoulder turned), 10 shield-bash strike (buckler thrust forward),
11 backstep-lunge tell (crouched, weight on back leg), 12 impaling-lunge tell (rapier held level at eye height, body lowered, a faint blood-red glow along the blade),
13 stagger (posture broken, kneeling, rapier dropped low), 14 fallen (collapsed, helm cracked).
[SPRITE RULES]
```

Extra phase-2 poses (separate sheet, same design, slightly more damaged armour, cracked helm, amber glow brighter):
```
[PREAMBLE] Same character as the reference: SIR ALDRIC VAEL, phase 2, armour more cracked, one
pauldron missing, eyes glowing brighter amber. 6 poses: 1 crescent-flurry cut A, 2 crescent-flurry cut B,
3 crescent-flurry cut C, 4 phantom-step vanish (body fading to translucent gold dust),
5 phantom-step reappear (leaning, blade striking backwards), 6 roar (blade raised to the sky).
[SPRITE RULES]
```

### 3.2 Gorehorn, the Rootbound Stag (Area B — Antler Warren)

Design: huge dark stag-beast, antlers wrapped in living roots, a bone mask for a face, mossy hide, glowing ochre eyes. Heavy, muscular, bestial.
Accent: ochre. Palette: bark brown, bone white, moss green.

```
[PREAMBLE] Character pose sheet of GOREHORN, a huge four-legged stag-beast, 3x the height of a
person, wide spreading antlers wrapped in living roots and thorny vines, a cracked bone mask over its
face, dark shaggy hide with moss patches, ochre glowing eyes. Menacing but tragic. 13 poses in order:
1 idle (head lowered, breathing), 2 walk (heavy stride),
3 antler-sweep tell (head swung back, antlers cocked to one side), 4 antler-sweep strike (head swung through, antlers wide),
5 gore-charge tell (front hoof scraping the ground, head down), 6 gore-charge run (full gallop, antlers forward),
7 wall-stun (head stuck in a wall, legs flailing, dazed),
8 rear-and-stomp tell (rearing up on hind legs, front hooves high), 9 stomp strike (front hooves slamming down, ground cracking),
10 leap-pounce (airborne, all legs tucked, antlers forward),
11 bellow (head raised, mouth open, shockwave feel),
12 impale-rush tell (head low, antlers glowing blood-red, body coiled), 13 fallen (collapsed on its side).
[SPRITE RULES]
```

### 3.3 Marshal Vespera of the Wasp Host (Area D — Wasp Aerie)

Design: armoured wasp-woman commander, translucent gold wings, banner-cape, a longbow and a short lance on her back, sleek and elegant. Flies.
Accent: gold. Palette: cream, gold, black and amber stripes.

```
[PREAMBLE] Character pose sheet of MARSHAL VESPERA, an armoured wasp-woman commander with
translucent gold-veined wings, black-and-amber striped plate armour, a long banner-cape, a longbow in
hand and a short lance on her back, an elegant tall crested helm. Proud, cold, commanding. 13 poses in order:
1 idle hover (wings blurred, bow lowered), 2 fly-forward (wings back, leaning),
3 arrow-volley tell (bow drawn, aiming at the viewer-right), 4 arrow-volley release (bow forward, string vibrating),
5 lance-dive tell (hovering high, lance pointed down), 6 lance-dive strike (diving diagonally, body streamlined),
7 wing-gust (wings flared wide forward, wind streaks),
8 call-scouts (arm raised, banner-cape flaring),
9 fire-arrow tell (arrow tip aflame, bow drawn), 10 fire-arrow release,
11 skewer tell (lance levelled, locked on, blood-red glow along the lance tip),
12 grounded stagger (wing clipped, on one knee, one wing bent), 13 fallen (wings crumpled on the ground).
[SPRITE RULES]
```

### 3.4 Ironbound Hosk, the Siegebreaker (Area C — Cinderworks)

Design: enormous armoured soldier-beetle, a giant tower shield cracked into three stages, a chain-flail with a spiked iron ball, furnace-lit vents on the armour.
Accent: furnace orange. Palette: black iron, rust, ember orange.

```
[PREAMBLE] Character pose sheet of IRONBOUND HOSK, an enormous hulking beetle-soldier in black
riveted iron armour, a gigantic tower shield strapped to his left arm, a long chain-flail with a
spiked iron ball in his right hand, glowing ember-orange vents in the armour, a small slit helm.
Slow, immovable, brutal. 14 poses in order:
1 idle (shield planted, flail hanging), 2 walk (heavy step),
3 shield-wall (shield raised, fully covering the body), 4 shield-bash tell (shield pulled back), 5 shield-bash strike (shield slammed forward),
6 shield cracked (stage 2, large crack across the shield, same stance as idle), 7 shield nearly shattered (stage 3, shield in pieces),
8 flail-whirl (flail spinning overhead, body braced), 9 chain-haul tell (flail thrown forward, chain taut),
10 quake-stomp (one leg raised high, then planted, ground cracking),
11 shield-charge (low, shoulder-first, shield forward),
12 two-handed overhead tell (shield gone, flail gripped in both hands above the head, blood-red glow on the ball),
13 stagger (shield-break stun, on one knee), 14 fallen (face-down, armour split).
[SPRITE RULES]
```

### 3.5 The Drowned Choir (Nacreous Maw) (Area E — Drowned Ossuary)

Design: a monster, not a creature on legs. A giant pale mollusc-maw rising from the water, ringed by many small singing mouths, pearl-lined tentacles, barnacles, nacre sheen.
Accent: teal. Palette: pearl white, teal, deep blue.

```
[PREAMBLE] Character pose sheet of THE DROWNED CHOIR, a colossal eldritch sea-maw: a huge round
mouth ringed with rows of small pale singing mouths, thick pearl-studded tentacles, barnacles and
shells encrusting a nacreous shell-like body, wet teal sheen. It rises up from the water, so the lower
edge of every pose is a flat horizontal waterline. 12 poses in order:
1 idle (calm, mouths slightly open, tentacles drifting), 2 surface-ripple (just beginning to rise),
3 tentacle-slam tell (one tentacle raised high), 4 tentacle-slam strike (tentacle smashing down),
5 tidal-surge tell (body swelling, a wave rising in front), 6 siren-song (all mouths wide open, mouth glowing teal),
7 pearl-spit tell (cheek bulging, a pearl visible in the mouth), 8 pearl-spit release,
9 double-slam (two tentacles raised together),
10 drowning-grasp tell (maw gaping wide, leaning forward, blood-red glow inside the mouth), 11 beached stagger (stranded, tentacles limp),
12 defeated (sinking, mouths closing).
[SPRITE RULES]
```

### 3.6 The Unspun (Hollow Bellweaver) (Area F — Underloom, finale)

Design: a dark mirror of the player character: same silhouette as the hero, but made of black silk thread and silver filaments, a hollow face with two violet eyes, needle weapon identical to the hero's. Three phases.
Accent: violet. Palette: black, silver thread, violet.

```
[PREAMBLE] Character pose sheet of THE UNSPUN, a dark mirror-twin of a small cloaked
insect-hero: the same silhouette and proportions, but woven from black silk and silver thread, trailing loose
threads, a hollow porcelain-white mask face with two glowing violet eyes, a long silver needle
weapon. Eerie, graceful. 14 poses in order:
1 idle (needle held low), 2 walk (gliding, threads trailing),
3 mirror-needle combo A (slash), 4 mirror-needle combo B (return slash), 5 mirror-needle combo C (thrust),
6 silk-lance tell (arm raised, silver lance of thread forming), 7 silk-lance release,
8 dash-feint (leaning forward, afterimage), 9 counter-stance (needle held across the body, glowing white, completely still),
10 thread-web (arms spread, threads spreading outward),
11 parry-clash (needles crossed, sparks),
12 last-stitch tell (needle drawn back, blood-red glow on the needle, still stance),
13 unravel (body coming apart into loose threads), 14 fallen (collapsed into a heap of thread).
[SPRITE RULES]
```

### 3.7 The Long Mourner, Keeper of the Final Silence (Area G — The Hushed Gallery)

Design: a colossal, very tall and gaunt black monster, about 2.5 times a person's height. Impossibly long thin arms ending in needle fingers, long stilt legs with backwards knees, tattered mourning veils, and a large smooth bone-white porcelain mask with NO facial features at all.
Accent: cold pale blue (and the usual **blood-red glow** only on its unparryable execution tell). Palette: pitch black, bone white, pale blue.

This boss has its **own poses and its own moveset** (it does not reuse the Warden's). It is built around reach, the ceiling and silence. Two sheets, like Sir Aldric: sheet A has phase one, sheet B has phase two and the specials. Generate A first, then use its best pose as the reference image for B.

| Move (phase) | Poses it needs | Idea for the code |
|---|---|---|
| Long Reach (1, 2) | reach tell, reach strike, reach recover | one arm shoots along the floor to far beyond its body length; jump or Shadow Step it |
| Needle Garden (1, 2) | needle tell, needle plant | the arm is driven into the floor; needle fingers burst up in a row, telegraphed one by one |
| Veil Net (1, 2) | veil tell, veil cast | it flings its veil as a net of black threads; slow, wide, can be dashed through |
| Scuttle (1, 2) | scuttle | drops low and crab-walks fast along the floor to reposition; the lead-in to the pounce |
| Silent Wail (2) | hush, rise | arms spread, all sound is cut and a ring of silence expands; also the phase-change pose |
| Ceiling Drop (2) | cling, drop, land | it climbs to the ceiling, crawls overhead, then falls on you; a floor marker shows the spot |
| Pounce (2) | pounce | from the scuttle it springs across the arena on all limbs |
| Mourning Embrace (2, execution) | embrace tell, embrace strike | both arms open wide, then close in a crushing hug; blood-red tell, only Shadow Step beats it |

Common poses on the sheets: idle, walk, stagger, fallen.

**Sheet A: phase one (12 poses, two rows of 6)**
```
[PREAMBLE] [HUSHED LOOK] Character pose sheet of THE LONG MOURNER, Keeper of the Final Silence: a
colossal, very tall and gaunt monstrous black creature, roughly 2.5 times the height of a person,
pitch-black matte inky silk-like body, impossibly long thin arms that reach below the knees and end in
long needle-like fingers, long stilt legs with extra joints and backwards knees, a narrow hunched torso
wrapped in tattered black mourning veils and frayed black thread, a small head crowned with thin
drooping antennae-like threads, and a large smooth bone-white porcelain MASK that is completely
featureless: no eyes, no eye holes, no nose, no mouth, no cracks, only a faint cold pale-blue glow
leaking from under the mask edge and from the joints. Silent, tragic, towering, inhuman. The silhouette
is much taller than wide. 12 poses in this exact order, two rows of 6:
1 idle (arms hanging low, head slightly bowed, veils still),
2 walk (slow, long stalking stride, arms swaying),
3 reach tell (one very long arm drawn far back behind the body, torso twisted away, needle fingers
spread, the other arm held low),
4 reach strike (the arm shot far forward at hip height, fully extended to nearly twice the body's length,
fingers spread, body stretched and leaning through the strike),
5 reach recover (the long arm dragging limply on the ground, torso off balance, head turned away),
6 needle tell (one arm raised straight up high, needle fingers pointing down like a dagger, the other
arm braced, torso arched back),
7 needle plant (the arm driven down into the floor up to the elbow, body bent low over it, small
cracks in the ground),
8 veil tell (both arms crossed over the chest gripping the front of the veil, shoulders hunched,
body coiled),
9 veil cast (both arms flung forward and wide, the veil blown out in front like a net of long black
threads, body leaning in),
10 scuttle (folded down very low onto all limbs, crab-like, knees high above the back, head forward),
11 stagger (hunched, one knee buckled, one long arm braced on the ground, veils torn),
12 fallen (collapsed in a long heap on the ground, arms outstretched, the mask lying cracked beside it
but still blank).
Same height, same scale and proportions in every pose, feet on one common baseline.
No text of any kind: no labels, no numbers, no captions under the poses. [SPRITE RULES]
```

**Sheet B: phase two and specials (8 poses, two rows of 4)**
```
[PREAMBLE] [HUSHED LOOK] Same character as the reference: THE LONG MOURNER, phase two. The veils are more
tattered and some of the thread is torn loose, the pale-blue glow under the mask edge and at the joints is
brighter, the mask is still completely smooth and blank. 8 poses in this exact order, two rows of 4:
1 rise (unfolding from a tight huddle on the ground, the long limbs unfolding one by one, head just
lifting),
2 hush (standing tall, arms spread very wide, head thrown back, the mask tilted skyward, a pale-blue
glow pouring from under the mask, absolute stillness, no mouth),
3 cling (hanging UPSIDE DOWN from a flat ceiling line at the TOP of the pose: all four limbs gripping the
ceiling with needle fingers, the body dangling and curled below it, the veil hanging upward-down,
the mask turned toward the floor),
4 drop (falling straight down, all four limbs stretched down in front, veils streaming upward,
needle fingers pointing at the floor),
5 land (crouched in impact on all limbs, the fingers planted, the knees high, the head up, the ground
cracking),
6 pounce (airborne, limbs splayed wide like a spider mid-spring, the arms reaching forward, veils
streaming),
7 embrace tell (standing tall and leaning forward, both long arms flung wide open to the sides, fingers
spread, a faint blood-red glow in the palms, the mask tilted down),
8 embrace strike (the arms swung inward and closed in a crushing hug in front of the body, the torso
folded forward over the arms, the blood-red glow where the hands meet).
Pose 3 (cling) hangs from the top edge of its cell; every other pose stands on the same floor baseline.
Same height, same scale and proportions in every pose.
No text of any kind: no labels, no numbers, no captions under the poses. The space under every pose is plain flat #00FF00.
The mask is a blank smooth featureless oval in every pose: no eyes, no eye holes, no glowing eyes. [SPRITE RULES]
```

## 4. Enemies (17) — pose sheets, 4–6 poses each

All enemies: scale roughly the same as the existing enemies (hero-sized or smaller) unless noted. Standard poses: `idle/walk`, `windup` (the readable tell), `strike`, `recover/dazed`.

| # | Enemy | Poses (in order) |
|---|---|---|
| 1 | Hollow Footman | idle, walk, spear-jab tell, spear-jab strike, shield-bash strike, dazed |
| 2 | Wasp Crossbowman | hover, aim tell, shoot, reload, dazed |
| 3 | Banner Knight | idle, walk, plant-banner, banner-planted (idle), dazed |
| 4 | Halberdier | idle, walk, overhead-chop tell, chop strike, recover |
| 5 | Mantis Duelist | idle, walk, feint, delayed-strike, recover, dazed |
| 6 | Cinder Sapper | idle, walk, throw tell, throw, fuse-flash (pot lit), dazed |
| 7 | Gloam Bat | fly A, fly B, swoop-windup, swoop dive, screech |
| 8 | Grave Toad | idle, tongue-lash tell, tongue strike, belly-slam, dazed |
| 9 | Rootmaw | burrow (dust mound), dust-trail, erupt, recover |
| 10 | Needle Centipede | ceiling-crawl, drop, coil tell, strike, recover |
| 11 | Lamprey | water-ripple, leap, snap, fall |
| 12 | Silk Husk | idle, walk, whip tell, whip strike, collapse (thread cut) |
| 13 | Hushling (Area G) | idle, crawl A, crawl B, lunge tell, lunge strike, dazed |
| 14 | Shroud Drifter (Area G) | drift A, drift B, dive tell, dive strike, dazed |
| 15 | Stilt Mourner (Area G) | idle, walk A, walk B, reach tell, reach strike, recover |
| 16 | Gallows Reacher (Area G) | hang idle, hang tell, drop strike, landed, dazed |
| 17 | Shade Brute (Area G) | idle, walk A, walk B, slam tell, slam strike, dazed |

### Paste-ready prompts

**1. Hollow Footman**
```
[PREAMBLE] Character pose sheet of a HOLLOW FOOTMAN: a hollow-eyed insect foot-soldier in dented
grey iron half-armour and a conical helm, a short spear and a round wooden shield, tattered
banner-cloth tabard. Plain, grim, disciplined. 6 poses in order: idle (shield up, spear low), walk,
spear-jab tell (spear pulled back, body leaning), spear-jab strike (spear fully extended), shield-bash
strike (shield thrust forward), dazed (stumbling, shield dropped). [SPRITE RULES]
```

**2. Wasp Crossbowman**
```
[PREAMBLE] Character pose sheet of a WASP CROSSBOWMAN: a small armoured wasp soldier in flight,
translucent wings, striped black-and-amber, a heavy crossbow, open-faced helm. 5 poses in order:
hover (wings blurred), aim tell (crossbow levelled, small glint on the bolt tip), shoot (bolt released,
crossbow kicks up), reload (cranking the bow), dazed (spiralling, wings bent). [SPRITE RULES]
```

**3. Banner Knight**
```
[PREAMBLE] Character pose sheet of a BANNER KNIGHT: a stocky insect knight in heavy plate carrying a
tall war-banner on a long pole, a small mace on the belt, the banner bright gold with a stitched sigil.
5 poses in order: idle (banner carried upright), walk, plant-banner (slamming the pole into the
ground), banner-planted (banner glowing faintly gold, arms raised), dazed. [SPRITE RULES]
```

**4. Halberdier**
```
[PREAMBLE] Character pose sheet of a HALBERDIER: a tall gaunt insect soldier in a wide kettle
helm and a mail coat, a very long halberd with a broad axe blade. 5 poses in order: idle, walk,
overhead-chop tell (halberd raised high over the head), chop strike (halberd swung down in a wide
arc), recover (halberd stuck low, leaning). [SPRITE RULES]
```

**5. Mantis Duelist (elite)**
```
[PREAMBLE] Character pose sheet of a MANTIS DUELIST: a slender praying-mantis swordsman, narrow
triangular head, green-gold carapace with leather straps, two curved blades on the forearms, poised
and deadly. 6 poses in order: idle (arms folded, blades crossed), walk (fluid), feint (one blade
raised, body hesitating, weight on the back foot), delayed-strike (a sudden slash, body extended),
recover, dazed. [SPRITE RULES]
```

**6. Cinder Sapper**
```
[PREAMBLE] Character pose sheet of a CINDER SAPPER: a short insect bomb-carrier in a soot-black
canvas hood and goggles, a bandolier of clay pots with smoking fuses, one pot in hand.
6 poses in order: idle, walk (waddling), throw tell (arm swung back with a lit pot), throw (arm
extended, pot leaving), fuse-flash (the pot lit, bright orange glow on the pot), dazed. [SPRITE RULES]
```

**7. Gloam Bat**
```
[PREAMBLE] Character pose sheet of a GLOAM BAT: a small dark furry bat with large ragged wings,
big pointed ears, tiny glowing pale eyes, sharp fangs. 5 poses in order: fly with wings up, fly with wings
down, swoop-windup (wings folded, hanging upside-down), swoop-dive (body streamlined, diagonal dive),
screech (mouth wide open, jaw unhinged, wings spread). [SPRITE RULES]
```

**8. Grave Toad**
```
[PREAMBLE] Character pose sheet of a GRAVE TOAD: a fat, warty, pale-grey toad with a crown of small
tombstone-like bumps on its back, a huge wide mouth, bulging yellow eyes. 5 poses in order: idle
(puffed throat), tongue-lash tell (mouth open, tongue starting to move), tongue strike (long
tongue extended fully to the right), belly-slam (jumping, belly facing down), dazed (flat on its belly).
[SPRITE RULES]
```

**9. Rootmaw**
```
[PREAMBLE] Character pose sheet of a ROOTMAW: a burrowing mole-like creature with a round
tooth-ringed maw, thick root-like claws, a dark earth-covered body. 4 poses in order: burrowed
(only a small mound of earth), dust-trail (a long low trail of kicked-up dust, small bulge),
erupt (bursting out, maw wide open, dirt flying), recover (stuck half-out of the ground). [SPRITE RULES]
```

**10. Needle Centipede**
```
[PREAMBLE] Character pose sheet of a NEEDLE CENTIPEDE: a long thin glossy-black centipede with
many fine legs ending in needle-like points, a pale head with long antennae. 5 poses in order:
ceiling-crawl (shown upside down along a flat ceiling line), drop (falling, body stretched),
coil tell (coiled in a spiral on the ground, ready to spring), strike (body uncoiled and lunging
forward), recover. [SPRITE RULES]
```

**11. Lamprey**
```
[PREAMBLE] Character pose sheet of a LAMPREY: a slimy grey-teal eel-like creature with a round
sucker mouth ringed with rows of fine teeth, small blind eyes. 4 poses in order: water-ripple (just
the ripple rings on a water surface, a faint shadow under it), leap (arcing out of the water), snap
(mouth wide open, teeth bared), fall (curving back down). [SPRITE RULES]
```

**12. Silk Husk**
```
[PREAMBLE] Character pose sheet of a SILK HUSK: an empty suit of ragged cloth and old armour held
upright by visible silver marionette threads going up out of frame, a hollow dark helm with two
violet pinprick eyes. 5 poses in order: idle (threads taut), walk (jerky puppet step), thread-whip
tell (an arm raised, a long thread coiling), thread-whip strike (thread lashing out to the right),
collapse (threads cut, a heap of cloth and armour). [SPRITE RULES]
```

### Area G — The Hushed Gallery (enemies 13 to 17)

Paste the preamble and the **[HUSHED LOOK]** block (§2.1) before each. The Hushed are all pitch black with a blank white mask, so their silhouettes must differ: small and low (Hushling), floating (Shroud Drifter), tall with a long reach (Stilt Mourner), hanging from the ceiling (Gallows Reacher) and heavy (Shade Brute).

**13. Hushling** (small crawler, about half the hero's height)
```
[PREAMBLE] [HUSHED LOOK] Character pose sheet of a HUSHLING: a small pitch-black crawler that moves on
all fours with long spindly arms and legs bent like a spider's, a bone-white featureless porcelain
mask on a round head, a ragged black veil dragging behind. Creepy, quick, child-sized. 6 poses in
order: 1 idle (crouched low, arms folded under the body), 2 crawl A (left limbs forward), 3 crawl B
(right limbs forward), 4 lunge tell (body pulled back, all limbs coiled, mask tilted down),
5 lunge strike (fully airborne, arms stretched far forward, claws open), 6 dazed (flat on its belly,
limbs splayed, a few pale stars). [SPRITE RULES]
```

**14. Shroud Drifter** (flyer)
```
[PREAMBLE] [HUSHED LOOK] Character pose sheet of a SHROUD DRIFTER: a floating tattered black funeral
shroud with no legs, a bone-white featureless porcelain mask at the top, two impossibly long thin
arms hanging far below the body, a ragged hem trailing like smoke. Silent, weightless. 5 poses in
order: 1 drift A (arms hanging, shroud billowing up), 2 drift B (shroud billowing down),
3 dive tell (arms drawn up and crossed over the mask, shroud pulled tight, hovering high),
4 dive strike (streamlined diagonal dive, arms stretched ahead like spears, shroud streaming behind),
5 dazed (spiralling, shroud knotted, arms limp). [SPRITE RULES]
```

**15. Stilt Mourner** (tall reach enemy, about 1.6x the hero's height)
```
[PREAMBLE] [HUSHED LOOK] Character pose sheet of a STILT MOURNER: a tall gaunt black figure on very
long thin stilt-like legs with backwards knees, a narrow torso, and arms nearly as long as its body
ending in thin needle fingers, a bone-white featureless porcelain mask on a small head, a short
tattered veil. Patient and unnerving. 6 poses in order: 1 idle (arms hanging to the ground, head
slightly bowed), 2 walk A (slow stalking step), 3 walk B, 4 reach tell (one long arm drawn far back,
body leaning away, fingers spread), 5 reach strike (arm shot far forward to full length, body
stretched thin, needle fingers pointing), 6 recover (arm dragging on the ground, off balance).
[SPRITE RULES]
```

**16. Gallows Reacher** (ceiling ambusher)
```
[PREAMBLE] [HUSHED LOOK] Character pose sheet of a GALLOWS REACHER: a long black spidery creature that
hangs from the ceiling, gripping with very long thin arms, body and veil dangling below, a bone-white
featureless porcelain mask on a small head, legs folded up like a crushed insect. Lurking, patient.
ALL poses hang from a single common ceiling line at the TOP of each pose (not a floor baseline).
5 poses in order: 1 hang idle (arms gripping the ceiling, body swaying, veil hanging), 2 hang tell
(body curled up tight, arms flexed, coiled to drop), 3 drop strike (falling, arms stretched straight
down, body stretched, veil streaming up), 4 landed (crouched on the floor, arms planted, head up),
5 dazed (collapsed, arms folded over the mask). [SPRITE RULES]
```

**17. Shade Brute** (heavy melee, about 1.4x the hero's height, bulky)
```
[PREAMBLE] [HUSHED LOOK] Character pose sheet of a SHADE BRUTE: a hulking pitch-black creature with a
hunched back and enormous long arms ending in huge heavy fists that reach almost to the ground, short
thin legs, a bone-white featureless porcelain mask on a small head sunk between the shoulders, shreds
of black veil. Slow and crushing. 6 poses in order: 1 idle (knuckles resting on the ground),
2 walk A (heavy knuckle-walk), 3 walk B, 4 slam tell (both fists raised high overhead, body arched
back), 5 slam strike (both fists driven into the ground, body folded forward, ground cracking),
6 dazed (slumped forward, fists limp, a few pale stars). [SPRITE RULES]
```

## 5. Area backdrops (far / mid / tile / props)

Per area: `far` (parallax, low contrast, 16:9), `mid` (chroma-key green, 16:9), `tile` (seamless 512x512), `props` (6–8 items on green).

### Area A — Garrison Road & Hollow Keep (DONE)
Grey stone, banners, torch-amber.

```
[PREAMBLE] Wide far-distance backdrop, 16:9. A ruined medieval fortress road at dusk: silhouettes of
a huge hollow keep, broken battlements and watchtowers fading into cold grey-blue mist. Tattered banners,
faint amber glow from far torches. Low contrast, empty calm centre. No foreground, no ground line, no characters.
```

### Area B — Antler Warren (roots, bone, ochre)
```
FAR: [PREAMBLE] Wide far backdrop, 16:9. A vast underground warren of giant tangled roots forming
cathedral-like arches, antler-shaped branches, scattered bones in the distance, warm ochre dust light shafts
from above. Low contrast, soft haze, calm centre. No ground line, no characters.

MID: [PREAMBLE] Mid-ground layer, 16:9, on chroma-key green #00FF00. Thick hanging roots, root-wrapped
pillars, half-buried giant antlers and ribs, clumps of pale fungus. Keep the centre and the lower 25% clear.

TILE: [PREAMBLE] Seamless tileable texture, 1:1, 512x512, flat. Packed dark earth with woven roots, small
pale bone fragments, ochre-stained clay. Edges tile perfectly.

PROPS: [PREAMBLE] Prop sheet on green #00FF00, 8 separate objects: 1) giant shed antler, 2) tangled root
arch, 3) hanging root curtain, 4) bone pile, 5) skull of a large beast half-buried, 6) glowing ochre
fungus cluster, 7) cracked clay pot, 8) root-wrapped stone totem.
```

### Area C — Cinderworks / Siege Foundry (iron, furnace-orange)
```
FAR: [PREAMBLE] Wide far backdrop, 16:9. A colossal siege foundry seen in the distance: huge chimneys,
catapult and trebuchet silhouettes, rivers of molten metal glowing orange in black-grey smoke.
Low contrast, calm centre. No ground line, no characters.

MID: [PREAMBLE] Mid-ground layer, 16:9, on green #00FF00. Iron girders, hanging chains, cooling
furnaces with orange glow, huge gears, scaffolding. Keep the centre and the lower 25% clear.

TILE: [PREAMBLE] Seamless tile, 512x512. Black riveted iron plates, scorch marks, subtle orange glow
in the seams. Tiles perfectly.

PROPS: [PREAMBLE] Prop sheet on green #00FF00, 8 objects: 1) iron anvil, 2) cooling ingot rack, 3) hanging
chain bundle, 4) cracked cauldron of molten metal, 5) broken catapult arm, 6) stack of cannonballs, 7) furnace
door with glow, 8) bellows.
```

### Area D — Wasp Aerie (pale sky, banners, gold)
```
FAR: [PREAMBLE] Wide far backdrop, 16:9. A cliff-top fortress high above a sea of pale clouds, hanging
wasp-host banners on spires, gold morning sun, distant floating islands. Low contrast, airy, calm
centre. No ground line, no characters.

MID: [PREAMBLE] Mid-ground layer, 16:9, on green #00FF00. Stone balconies, tall banner poles with
gold-and-black banners, hanging rope bridges, stone arches. Keep the centre and the lower 25% clear.

TILE: [PREAMBLE] Seamless tile, 512x512. Pale cream sandstone blocks, gold inlay lines, wind-worn edges.

PROPS: [PREAMBLE] Prop sheet on green #00FF00, 8 objects: 1) gold war banner, 2) stone watch-post,
3) hanging rope bridge section, 4) weathervane shaped like a wasp, 5) stacked arrow crates, 6) wind
chime, 7) stone perch, 8) broken ballista.
```

### Area E — Drowned Ossuary (teal water, nacre)
```
FAR: [PREAMBLE] Wide far backdrop, 16:9. A flooded bone vault seen through teal water: giant vaulted
ribs, pearl-lit glow, drifting shells and bubbles, rays of pale light from above. Low contrast, calm
centre. No ground line, no characters.

MID: [PREAMBLE] Mid-ground layer, 16:9, on green #00FF00. Rib-bone arches, hanging kelp, shell-encrusted
pillars, stacked skulls, glowing pearl clusters. Keep the centre and the lower 25% clear.

TILE: [PREAMBLE] Seamless tile, 512x512. Wet bone-white stone with barnacles and nacre sheen, faint teal tint.

PROPS: [PREAMBLE] Prop sheet on green #00FF00, 8 objects: 1) giant clam shell, 2) bone arch, 3) hanging kelp,
4) skull stack, 5) glowing pearl cluster, 6) rusted anchor, 7) broken amphora, 8) coral-covered statue.
```

### Area F — The Underloom (dark silver thread, violet)
```
FAR: [PREAMBLE] Wide far backdrop, 16:9. An endless dark void strung with thousands of silver threads,
colossal loom silhouettes far away, faint violet glow, drifting needles. Very low contrast, calm
centre. No ground line, no characters.

MID: [PREAMBLE] Mid-ground layer, 16:9, on green #00FF00. Giant spools, hanging thread curtains, floating
needles, loom frames. Keep the centre and the lower 25% clear.

TILE: [PREAMBLE] Seamless tile, 512x512. Dark woven fabric with silver thread patterns, subtle violet sheen.

PROPS: [PREAMBLE] Prop sheet on green #00FF00, 8 objects: 1) giant spool, 2) floating needle, 3) hanging
thread curtain, 4) loom frame, 5) tangled thread ball, 6) cut thread ends, 7) empty marionette stand,
8) violet thread lantern.
```

## 6. Shared objects & UI art

```
FOG GATE: [PREAMBLE] Object on green #00FF00. A tall archway sealed by a swirling pale silver-white fog
curtain, carved stone frame with runes, glowing softly. Front view. Two images: sealed and open (fog thinned).

SIGILS (6): [PREAMBLE] A set of 6 small round sigil emblems on green #00FF00, each a carved metal medallion:
Oath (a sword and a banner), Antler (a stag antler), Chain (a chain ring), Wing (a wasp wing), Pearl
(a pearl in a shell), Weave (a needle and thread, for the final boss). Gold edge, dark centre, each with a
faint different accent glow.

SIGIL SOCKETS: [PREAMBLE] A large stone door with 5 round empty sockets arranged in an arc, thread-wrapped
frame, dim violet glow; and a second version with all five sockets filled and glowing.

DRAWBRIDGE: [PREAMBLE] A heavy wooden and iron drawbridge in two states (raised, lowered), side view on green.

EXECUTION GLYPH: [PREAMBLE] A blood-red sigil on green #00FF00: a circular glyph with a sword-and-eye motif,
glowing, ominous, simple readable shape.

CHAPTER CARD: [PREAMBLE] Full-screen 16:9 painted card art: a great bronze bell, cracked, with golden
dawn light breaking through a ruined belfry, silver thread drifting upward. Empty centre for text.

BOSS TITLE PLATES (6): [PREAMBLE] A wide ornate dark plate frame, 16:9 strip, aged metal with the area's
accent colour, empty centre for the boss name. Make 6 variants: gold, ochre, orange, pale gold, teal, violet.

CODEX PORTRAITS: reuse the idle pose of each boss/enemy sheet, cropped.
```

## 7. QA checklist for every generated asset

- Background is a true flat `#00FF00` (no gradient or shadow) where chroma-keying is needed.
- All poses face right, same scale, same feet baseline, nothing touching.
- The silhouette reads at ~100 px tall; the tell poses look clearly different from idle.
- The colour language holds: **gold glint** = parry, **violet glint** = Shadow Step only, **blood-red glow** = Nightmare execution tell.
- No text, signature or watermark in the image.
- Backdrops: calm, low-contrast centre; platforms and enemies must stay readable on top.

# THE UNCALLED: the Faceless Ronin's story

The Ronin's journey is the same game (same city, rooms, creatures, bosses and moves) told as a much darker tale. Only
words and music change. The Bellweaver's story is untouched and is restored whenever that hero is on the field.
The original pitch it grows from is `the_resonance_veil_game_pitch_lore.md` (a blank mask, an order that harvests minds).

## The tale

Nobody in the Hollow is born with eyes. Every child is **veiled at its first toll** and sees by the echo of a bell:
walls, roads and the faces of the people they love, all drawn in sound. The **Weavers' Concord** runs the toll-looms. The
looms spin the cord that hangs every bell, and the cord is spun from the hair and breath of the bound (the clappers are
people: "tongues"). A bell with a **face pressed into its mouth** sees truest.

**House Vael** cast the Great Bell. On the **hundredth dusk** the Concord meant to toll it and tune every mind in the city to
one note, and the House refused to finish it. By dawn the House was dead and their faces hung in the bronze.

**Orrin Vael**, the eldest, gave the Concord his family's names to live, then heard them in the metal. He sealed the clapper
with his own body so the Long Toll would never ring. He is the **Warden** of the Cathedral of the Last Toll. He calls it
penance; it is a longer way of dying.

The dead were thrown down the **Fallen Light**. One of them woke: the youngest Vael, the House's sword, with his face cut
away. Because he has no face, the bells cannot find him. He took a blank mask from the Mask Crypt (they were carved blank so
the bells could never call the dead) and climbs the city to the Great Bell.

| Place | In the Ronin's tale |
| --- | --- |
| Mosslit Hollow, Fallen Light | the heap where the dead were thrown; where he wakes |
| The Spindleworks | where the cords are spun (every fathom has a name in it) |
| The Silent Belfry | bells with a face in every mouth, clappers that are people tied with one knot |
| Cathedral of the Last Toll | Orrin Vael, his brother, who held the silence |
| The Hushed Gallery | veils hung so no bell could find the dead and ring them; the Long Mourner kept them quiet and called it kindness |
| The Last Door | the room where the faces are kept |
| Ending | he tolls the Great Bell once; every face has a voice for one breath, then the cords go slack and the dead stop being called. The city is blind again, mercifully |

## Where it lives

| What | File |
| --- | --- |
| Chapters, interludes, all 34 lore notes, Odo's 18 lines, epilogue, title | `src/progression/lore_ronin.js` |
| Swapping the story by hero | `BW.Lore.set('ronin' \| 'weaver')`, called from `Game.setCharacter` and the character screen |
| Odo's talk | `BW.Lore.odo(state, key, original)` in `Game.talkToOdo` |
| Epilogue | `Ending.epilogue()` in `src/game/levels/cathedral.js` |
| Title screen name and tagline | `BW.TITLE`, drawn by `drawTitleMenu` in `src/ui/menus.js` |
| Checks | `node tools/smoke_lore.js` |

Choosing a wanderer on the character screen previews that hero's title and opening music.

## The music

The calm tracks stay: **Mosslit Hollow and the Spindleworks keep their chill music** for the quiet stretches of the Ronin's
journey, and the Hushed Gallery and the bosses keep theirs. Three darker loops replace the opening, the Belfry and the
ending (`Audio.theme` in `src/audio/audio.js`):

| Replaces | Dark loop | What it is |
| --- | --- | --- |
| `mus_title` (opening) | `mus_dark_title.wav` | sub drone, a funeral toll on D that never resolves with a minor-third answer, a veiled choir, a slow pulse |
| `mus_belfry` | `mus_dark_belfry.wav` | lower and slower, a falling lament line under the tolling |
| `mus_ending` | `mus_dark_ending.wav` | a bell tolling a falling phrase, one stroke for each of the dead, over a pad that finally opens |

They are synthesised, not sampled: `python tools/make_dark_music.py` (needs numpy) regenerates them as seamless loops.
They have not been auditioned by ear in the session that wrote them: if a loop is too loud, too thin or too bleak, edit the
levels or the notes at the bottom of that script and rerun it, or change `gain` in `assets/audio/music.js`.

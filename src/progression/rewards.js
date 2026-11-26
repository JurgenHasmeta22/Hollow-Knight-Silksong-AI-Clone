'use strict';

// Glints, the yellow stones, are the one currency: there is no experience and there are no levels. They are earned by
// defeating creatures, breaking stones and caches, finding things (lore notes, hidden nooks, toll-looms, shrines, bells,
// relics, keys) and by the great foes, and they are spent on skills (the Skills screen) and on supplies (Odo's shop).
// Lanterns give none, and neither do boss rematches.
(function (BW) {
    // what each kind of find is worth in glints. Creatures carry their own value (see enemies.js).
    const Rewards = {
        lifethread: 40,
        spool: 40,
        note: 15,
        shrine: 80,
        loom: 60,
        secret: 20,
        cache: 10,
        warden: 350,
        mourner: 500,
        key: 120,
        relic: 100,
        bell: 20,
        // multiplier on every blow the hero lands: the skill tree is the only source of strength
        power(st) {
            return 1 + (BW.Skills ? BW.Skills.mod(st, 'dmg') : 0);
        },
    };

    BW.Rewards = Rewards;
})(window.BW);

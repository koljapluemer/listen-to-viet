Currently, we have a very fancy exercise/distractor selection flow. Simplify to the following:

- get rid of the ebisu dependency
- treat all pairs symmetrically from now on. In the stats page, track only matrix cell for e.g. ă/ê that is meant for BOTH directions; meaning also for ê/ă. Use the same strat later
- redesign exercise picking to this simple concept:
    - when generating an exercise, first pick 3 random strings from the dataset, with 5 or less words
    - generate all possible distractors/exercise pairs from these 3, and the set of bidirectional pairs practiced with these exercises, heeding the one-tone-per-word and only-use-confirmed-Viet word rules
    - randomly pick a number from 0 to 1, if it's >0.5, we will call it strategy B, otherwise A
    - strategy A: from the possible birectional pairs, check if any have so far, globally, been practiced less than 10 times. If so, choose a random exercise pertaining to this set of "undertrained" pairs. If not, choose any possible exercise from the set, at random
    - strategy B: from the possible bidirectional pairs, choose the one where the success rate of the last 10 exercises is lowest. Pick one exercise pertaining to this set.
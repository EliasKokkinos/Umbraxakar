# Resolution Model

This is the end-of-turn resolution spec: how the resources assigned to an event produce a result, and what that result costs them.

- Items marked **[P]** are Antrikkos' proposals.
- All tunable numbers are in `data/resolution-config.json`.
- The event-side consequences (closing, containment, civilian losses, corruption) are defined in `docs/events-model.md`.

**Decisions from the DM:**
- **Only NPC resources** fight. Player characters command but are never placed on events.
- Several resources combine as **best + support**.
- **Heroes never die automatically.** Only the DM kills a hero.
- Morale gives a **small modifier**, and a resource at **Morale 1 refuses to deploy**.

---

## 1. Effective Power of a card

A *card* is one resource on the board, together with any heroes attached to it. Its effective Power is built up as follows:

| Step | Modifier |
|---|---|
| Base | `power` |
| Morale | Morale 2 gives **−1**. Morale 3–4 give **0**. Morale 5 gives **+1**. Morale 1 means the card can't be deployed (see §5). |
| Hero injuries | The penalties of all injuries are added together (Minor −1, Serious −2, Grievous −3), to a maximum of **−4** |
| Group strength | Active strength is `(number − injured) / maxNumber`. Below 75% gives **−1**, below 50% **−2**, below 25% **−3**. At 0 the group is destroyed. |
| Attached heroes | Each hero adds **a third of their own effective Power, rounded up** (Karsa 8 gives +3, Trull 5 gives +2), to a maximum of **+5** in total |
| Mother Dark temple | **+3** if the card's base resource is tagged `tiste-andii` and the event is inside an active temple's aura |
| Castle training | a temporary bonus, defined in the Castle step |

The result is never below 1, and there is no upper cap.

- **Only groups take the field.** Heroes and avatars go to an event by attaching to a group (up to 3 per group); a hero never goes alone. If any attached hero cannot deploy (Morale 1, grievously injured, a refusal trait), the group cannot be sent until they are detached.
- Attached heroes also contribute their `canCleanse` ability to the card.

## 2. Event Power and the roll

```
Event Power = highest effective Power among assigned cards
            + min(3, number of assigned cards − 1)      // support bonus

Target = 10 + (Difficulty − Event Power), clamped to 2..20
Roll   = 1d20.   Success if roll ≥ Target.
         Natural 1  → always fails  ("Rout")
         Natural 20 → always succeeds ("Heroic Victory")
```

Chance of success by the gap between Event Power and Difficulty:

| Event Power − Difficulty | −10 or less | −4 | −2 | 0 | +2 | +4 | +6 | +8 or more |
|---|---|---|---|---|---|---|---|---|
| Target | 20 | 14 | 12 | 10 | 8 | 6 | 4 | 2 |
| Chance | 5% | 35% | 45% | 55% | 65% | 75% | 85% | 95% |

**Worked example.** A Difficulty 7 portal has Karsa (8), a Malazan Legion (4) and the Bridgeburners (5) assigned. Event Power is 8 + 2 = 10, so the target is 7 or higher, a 70% chance.

- **An event with nothing assigned** has no roll. It counts as unopposed.
- **A dormant temple** uses the same roll, with `activationDifficulty` as the Difficulty.

## 3. Harm: injuries and losses

Every assigned card rolls for harm separately, and so does every hero attached to it. The *threat* uses the card's **own** effective Power, so weaker units bleed more even when a strong hero carries the fight.

```
Threat T = Difficulty − own effective Power − resistance
           (resistance = injuryResistance for heroes, decimationResistance for groups)

Harm chance:
  Won:   clamp(10% + 10% × T, 0%, 60%)
  Lost:  clamp(40% + 10% × T, 5%, 95%)
  +20% if the portal has a legendary spawn
  +20% on a Rout (natural 1)
  No harm at all on a Heroic Victory (natural 20)
```

| Example | T | Won | Lost |
|---|---|---|---|
| Malazan Legion (Power 4, Resistance 2) vs Difficulty 5 | −1 | 0% | 30% |
| Malazan Legion vs Difficulty 7 | +1 | 20% | 50% |
| Avowed (Power 7, Resistance 5) vs Difficulty 9 | −3 | 0% | 10% |
| Karsa (Power 8, Resistance 5) vs Difficulty 10, legendary | −3 | 20% | 30% |

### Severity: roll `1d6 + max(0, T)`

| Roll | Hero | Group (of active strength) |
|---|---|---|
| 1–3 | **Minor** injury (−1 Power) | **Light**: 5% killed, 10% injured |
| 4–5 | **Serious** injury (−2 Power, needs a healer) | **Heavy**: 10% killed, 15% injured |
| 6+ | **Grievous** injury (−3 Power, can't deploy until healed) | **Severe**: 20% killed, 20% injured |

- When a group is harmed, at least 1 is killed and at least 1 is injured.
- Losses from a non-replenishable group, such as the Avowed, are **permanent**.
- **A hero who is already Grievously injured and takes another Grievous injury** becomes **"Fallen?"**. The hero leaves play, and the DM decides the outcome in the story. The system never kills a hero on its own.
- How injuries heal and how the injured return to the ranks is defined in the Castle step.

## 4. Morale after resolution
Applied to every card that was assigned to an event:
- **−1** for serving at an event this turn.
- **−1 more** if the battle was lost, which is −2 in total. The card stays attached to the event for the next turn.
- **[P]** A Heroic Victory (natural 20) means no morale loss.
- Morale never goes below 1 or above 5.

## 5. Morale 1: refusal
- A resource at Morale 1 **cannot be assigned**. On the table screen its card shows as *"Refuses"*.
- **[P]** If a card drops to Morale 1 while attached to a lost event, it **routs**: it returns to the castle at the start of the next turn instead of staying attached.

## 6. Traits (optional, per resource) [P]
- Optional per-resource rule quirks from the lore:
  - **Silchas Ruin: "No suicidal orders."** He refuses assignment to any event whose Difficulty is at least his effective Power + 3.
- Traits are data (`traits: [...]` on the resource), and the DM can add or remove them.

## 7. Dice, undo and DM control
- The RNG is **seeded and stored in the game state**.
  - **Undo** restores the seed, so ending the turn again gives the **same** results. Undo can't be used to fish for better rolls.
  - Deliberate rerolls are a separate DM action.
- **DM screen, per event:** see the target and every harm chance, **reroll**, **force a win or loss**, and edit any harm result before revealing it.
- **Table screen:** the DM reveals events one at a time for drama. Each reveal shows the d20, the target and the outcome. Harm details are shown after the DM confirms them.
- Every roll is written to the turn log: event, cards, Power breakdown, d20, target, and harm rolls.

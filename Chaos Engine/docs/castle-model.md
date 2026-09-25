# Castle Model

The Iron Company castle on Einhart Island is the staging area. It is where resources recover, heal, train and are paid for.

- Items marked **[P]** are Antrikkos' proposals.
- All costs and numbers are in `data/castle.json`.
- **All gold values are placeholders.** The DM edits the treasury and the prices in the app.

---

## 1. The castle is the pool
- **Every resource that isn't assigned to an event is at the castle.** There is no separate "garrison" state.
- Castle actions are queued during the planning phase and take effect in the **end-of-turn Castle phase** (§6).
- A resource that is **healing or training** is *occupied* for the turn and can't be assigned to an event.

## 2. Treasury
| Field | Notes |
|---|---|
| `treasury` | Current gold. Starts at **200,000 gp**, a placeholder based on a 2023 note of "200k gold". The DM sets the real figure from the recaps. |
| `incomePerTurn` | Default 0. **[P]** The DM can set income (wine sales, church revenue, the Delias). |

- Every spend is a named action in the log, so it can be undone.
- The DM can add or remove gold at any time, with a reason ("Loot from the necromancer's lair").

## 3. Facilities
Every facility has a level from 1 to 3 and starts at level 1. An upgrade costs gold and takes **2 turns** (6 days) to build. **[P]** The facility keeps working at its old level while the upgrade is built.

| Facility | Lore | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| **Great Hall** | guest quarters that have hosted gods and archdevils | +1 morale per turn at the castle | +1, and entertainer contracts cost half | **+2** morale per turn at the castle |
| **Healers' Hall** | healers recruited through John's drive | 1 healing slot; 50% of a group's injured recover each turn | 2 slots; 75% | 3 slots; 100% |
| **Training Grounds** | | 1 training slot; +1 Power | 2 slots; +1 Power | 3 slots; **+2** Power |
| **Barracks** | Malazan forces stationed at the castle | recruitment ×1 | ×1.5; militia can be mustered | ×2 |
| **Draconus's Forge** | Sam Yellin; blessed with three Warrens | 1 forging slot | 2 slots | 2 slots, and forging takes 1 turn |
| **Tom's Winery** | the heroic wine | 1 cask per turn | 2 casks | 3 casks |

The **Kurald Galain Shrine** is already an active Mother Dark temple (`temple-einhart-shrine`). Its aura covers the castle's position on the map, so it doesn't need a second castle rule.

## 4. Castle actions

| Action | Target | Cost | Effect |
|---|---|---|---|
| **Hire entertainers** | every resource at the castle | 2,000 gp per week | **+1 extra morale** per turn for **2 turns** (one week, since a turn is 3 days). Doesn't stack with itself. |
| **Train** | one resource at the castle, using a training slot | 500 gp | +Power from the Training Grounds bonus for the **next 2 turns**. **Costs −1 morale**, and the resource doesn't recover morale that turn. It can't train at Morale 2 or below. |
| **Heal** | one injured hero, using a healing slot | Serious 1,000 gp; Grievous 5,000 gp | Removes one injury (see §5) |
| **Recruit** | one replenishable group at the castle | 20 gp per soldier | Restores numbers, up to `recruitRate × maxNumber × barracks multiplier` per turn, never above max |
| **Muster militia** | new group; needs Barracks level 2 | 5,000 gp | After 2 turns, creates *"Militia of Lether"*: 100 troops, Power 2, Morale 3, Decimation Resistance 1, replenishable. Training Grounds level 3 makes new militia Power 3. |
| **Forge arms** | one group, using a forging slot | 25,000 gp | After 2 turns, a **permanent +1 Power**. Each group can be forged only once. |
| **Serve Tom's wine** | one resource at the castle, using a cask | 1,000 gp | **+1 morale** straight away. It can lift a resource out of Morale 1 refusal. |

## 5. Healing and recovery

### Heroes
| Injury | Rest at the castle (no slot) | Healers' Hall slot |
|---|---|---|
| **Minor** | healed after **1 turn** | not needed |
| **Serious** | healed after **3 turns** | healed at the end of this turn |
| **Grievous** | **never heals without a healer**; the hero can't deploy | healed after **2 turns** in a slot, which drops it to Serious **[P]** |
| **Fallen?** | out of the system until the DM decides | none |

- **Healer heroes.** A hero tagged `healer` who is at the castle and not deployed adds **+1 healing slot**. Cowl (High Priest of Hood) and Kazz D'avore (Destriant) are tagged. So keeping a healer home competes with sending them to cleanse deep corruption, which is intentional.

### Groups
- At the end of each turn at the castle, **injured return to the ranks** at the Healers' Hall rate (at least 1).
- Injured soldiers on an event don't recover.
- Soldiers killed are gone. A replenishable group can **recruit** them back; the Avowed never can.

### Morale
Morale recovery at the castle each turn: `Great Hall bonus + entertainers (+1 if active) + wine (immediate)`. A trained resource gets none of it that turn. Morale is capped at 5.

## 6. End-of-turn Castle phase
This runs after the event phase (`docs/events-model.md` §5), in this order:
1. Add `incomePerTurn`.
2. Morale recovery for resources at the castle that aren't training.
3. Hero healing: rest timers and healer slots.
4. Group injured recovery.
5. Recruitment.
6. Advance the timers for training buffs, entertainers, muster, forge work and upgrades, and complete any that are due.
7. Resources that routed (Morale 1 on a lost event) arrive back at the castle.

## 7. Table screen
- The castle sits **above the resource slider**, as in the mission statement. Opening it shows the facilities and their levels, the treasury, active effects (for example "Entertainers: 1 turn left") and the healing and training slots.
- Players can **propose** actions from the TV. The DM confirms them on the laptop, since the DM screen is the input device.
- Gold amounts are shown on the table. **[P]** The DM can hide the treasury if the Company's finances should stay vague.

## 8. Open items for the DM
- The real treasury figure, and whether there is income each turn.
- Every price in `data/castle.json`. The placeholders are sized for a treasury of about 200k.
- Where the castle (Einhart Island) sits on the world map.
- Which other heroes should count as healers.

# Events Model

This is the Chaos Engine events specification. It turns the Events section of `Mission Statement.md` into data and rules.

- Items marked **[P]** are Antrikkos' proposals, filling gaps the mission statement leaves open. The DM confirms or changes them.
- Every number the DM may want to adjust lives in `data/events-config.json`. None are hard-coded.
- How assigned resources combine and roll is defined in the **Resolution** step, not here. This file defines event state and how it changes each turn.

---

## 1. Map and coordinates

- Positions are **normalised `{x, y}` in 0–1** relative to the active map image. The map can be swapped without changing the event data, although the DM will need to reposition events that were placed by hand.
- Map config lives in `data/map.json`. It lists the available maps, the active one, and the named **regions**, which supply flavour text and portal names.
- **Land detection** decides where random seeding may place a portal:
  - `color` mode samples the map image. A pixel counts as land if it is **not** within `tolerance` of `seaColor`. A candidate point is accepted only if at least `minLandRatio` of the pixels within `sampleRadiusPx` are land, which rejects ocean labels, rivers and coastline strokes. This works on the world atlas, whose sea is flat light blue (`#C4DFFF`).
  - `mask` mode uses a black-and-white mask image that the DM paints. It's the fallback for maps with textured seas.
  - `noSpawnZones` are rectangles that are never seeded, for example the southern polar ice and the title block.
- Source maps live in `F:\OneDrive\Dungeons & Dragons\Book of the Fallen Flight of Dragons\Maps`. The app copies the chosen map into its own assets.

## 2. Common event fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | unique |
| `type` | `chaos-portal` \| `mother-dark-temple` \| `custom` | `custom` is reserved for later event types |
| `name` | string | generated for portals; the DM can rename |
| `position` | `{x, y}` | normalised |
| `regionId` | string \| null | derived from position, or set by the DM |
| `hidden` | bool | **DM-only when true. It is never rendered on the table screen** |
| `assigned` | string[] | resource ids currently attached |
| `dmNotes` | string | never shown on the table |
| `createdTurn` | number | |

## 3. Chaos Portal

| Field | Range | Seeded | Notes |
|---|---|---|---|
| `corruption` | 1–5 | starts at 1 **[P]** | +1 per round |
| `difficulty` | 1–9 (10 with a legendary spawn) | random 1–5 | stays fixed unless the DM edits it or a legendary spawn appears |
| `impact` | 0–10 | random 1–10 | the DM adjusts it for proximity to civilisation |
| `legendary` | bool | false | set when corruption reaches 5 |
| `status` | `open` \| `closed` | `open` | |
| `lastOutcome` | `won` \| `contained` \| `lost` \| `unopposed` | `null` | the result of the most recent resolution; *contained* is an outcome, not a status |

### Rules
1. **Corruption growth.** At the end of each turn, an open or contained portal gains +1 corruption, up to 5.
   - **[P]** A portal where the battle was won that turn does **not** gain corruption.
2. **Temple ward.** A portal inside the aura of an **active** Mother Dark temple cannot go above corruption 2. If it is already above 2 when the temple activates, it drops to 2 **[P]**.
3. **Deep corruption (3 or more).** The portal can only be closed if the winning force includes a resource with `canCleanse`. That means a cleric or paladin of level 12+, or a hero the DM has flagged (Angels, Gods and so on).
   - **[P]** A win without a cleanser **contains** the portal: no civilians are lost and corruption does not rise that turn, but the portal stays open. The resources return to the castle. The players may send them back next turn.
4. **Legendary spawn.** When corruption reaches 5, `legendary` becomes true, the difficulty cap becomes 10, and difficulty is set to 10.
5. **Civilian losses per turn:**
   - Unopposed or lost: `impact × civiliansPerImpact × random(0.5–1.5)` civilians, added to the Civilian Death Count. `civiliansPerImpact` defaults to 100.
   - Battle lost: **[P]** half of the unopposed figure.
   - Battle won or contained: 0.
6. **Closing.** When a battle is won and corruption is below 3 (or a cleanser is present), the portal's status becomes `closed`. It leaves the map but stays in the turn log. Assigned resources return to the pool.
7. **Lost battle.** Assigned resources stay attached for the next turn. This follows the mission statement; the morale loss is handled in the Resources step.

### Seeding
- **Session start:** `(number of deployable groups) + 1d6` portals. Only groups take the field, so heroes don't count. Locked groups don't count either. With the current roster that is 12 + 1d6, so 13–18.
  - With today's roster that's roughly 25–30 portals, which is more than the players can cover. The resulting triage is intentional, but the DM may want to trim it.
- **Each later round:** `newPortalsPerRound` (default `1d3`) **[P]**.
- **The DM can seed more or remove any portal at any time.**
- Placement: a random land point, outside `noSpawnZones`, and at least `minSpacing` away from other events.
- **Name:** `<descriptor> <noun> of <region>`, built from the lists in the config. For example, *"The Weeping Rift of Seven Cities"*.

## 4. Mother Dark Temple

| Field | Range | Notes |
|---|---|---|
| `active` | bool | 5 of the 17 are active at the start |
| `origin` | `story` \| `ally` \| `undiscovered` | 2 story, 3 ally, 12 undiscovered |
| `activationDifficulty` | 1–9 | rolled like a portal when resources are assigned to a dormant temple |
| `discovered` | bool | **[P]** undiscovered temples are hidden from the table until the DM reveals them |

### Rules
- **Aura radius** is one global setting (`templeAuraRadius`, a fraction of the map width) that the DM can change. It applies to every temple.
- **Effects inside the aura of an active temple:**
  - Portal corruption can't go above 2.
  - Resources tagged `tiste-andii` ("Anomander's resources") get **+3 Power** there.
- **Activation.** The players assign resources to a dormant, discovered temple. The roll works like a portal battle against `activationDifficulty`. Success sets `active` to true. Failure has no civilian cost, but the morale rules still apply.
- **[P]** Temples cannot be destroyed in v1.

## 5. End-of-turn order (event side)
1. Resolve battles and activations (Resolution step).
2. Apply outcomes: portals close or are contained, temples activate.
3. Apply civilian losses.
4. Grow corruption and apply the temple cap.
5. Check for legendary spawns.
6. Seed new portals.
7. Add 3 days to the in-game calendar.

## 6. Open items for the DM
- The 17 temples are placeholders (`data/temples.json`). Only **Jhag Odhan** is confirmed canon. The Einhart castle shrine is used as the second story temple. Rename them and reposition them on the map.
- The location of Einhart Island (the castle) on the world map has not been established.
- Decide whether the **[P]** rules stand, especially containment and legendary spawns.

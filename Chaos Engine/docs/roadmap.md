# Chaos Engine: Development Roadmap

Each phase is independently testable. Phases 1–4 are the **rules engine**: pure TypeScript with no Angular, covered by unit tests. Phases 5 and later are UI.

| # | Phase | Delivers | Done when |
|---|---|---|---|
| 0 ✅ | **Scaffold** | Angular 22 workspace, Vitest, `data/` served as assets, engine folder, seed loader | `npm test`, `npm run build` pass; the app boots and logs the loaded seed counts |
| 1 ✅ | **Core rules** | Domain types, seeded RNG, effective Power, event roll, harm, morale after battle | Unit tests reproduce every worked example in `docs/resolution-model.md` |
| 2 ✅ | **Events engine** | Portal seeding (injectable land test), corruption and temple cap, legendary spawn, casualties, closing and containment, temple activation | Unit tests for every rule in `docs/events-model.md` |
| 3 ✅ | **Castle engine + turn pipeline** | Castle actions, healing, recovery, recruitment, timers, and the full `endTurn(state)` | A scripted 5-turn simulation test runs with deterministic output |
| 4 ✅ | **State store** | Signals store, named actions, 10-step undo, save/load of versioned JSON | Tests: undo restores the exact state and RNG; save → load round-trips |
| 5 ✅ | **DM screen (functional)** | `/dm`: edit resources and events, assign, run the castle, end turn, reveal, override rolls | Manual: a full turn can be played on the laptop alone |
| 6 ✅ | **Table screen** | `/table`: map with events, resource slider, castle panel, drag-and-drop, sync with `/dm` | Manual: two windows stay in sync; no DM-only data appears on `/table` |
| 7 ✅ | **Drama and polish** | Roll reveal animation, legendary spawn moment, TV readability pass, sound (optional) | Playtest session on the TV |
| 8 ✅ | **Commanders** | Commander selection and per-resource morale links (content from the recaps) | Choosing a commander changes the morale shown; the rule is tested |

**Decided:** one device. The TV is a second screen of the DM's laptop, so `/dm` and `/table` are two browser windows kept in sync with `BroadcastChannel`. No server is needed.

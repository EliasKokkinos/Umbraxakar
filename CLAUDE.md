# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is an **Aurora Builder** content repository — a D&D 5e character builder application that loads custom content from XML files declared in `.index` files. There are no build scripts, package managers, or test suites. "Deploying" content means pushing XML changes to the appropriate GitHub branch; Aurora Builder fetches content live from the raw GitHub URLs declared in the index.

The campaign setting is **Umbraxakar / "Book of the Fallen"** — a homebrew D&D 5e campaign blending the Malazan Book of the Fallen universe with Brandon Sanderson's Mistborn magic system (Allomancy).

## How Aurora Builder Loading Works

Aurora Builder users paste a URL to an `.index` file into the application. The index declares which XML files to fetch and from which URLs.

- `umbraxakar.index` → points to `master` branch; this is the **production** index used by players
- `testing-nikos-cretan.index` → points to `Nikos-the-Cretan` branch; used for playtesting

When content is updated on a branch, Aurora Builder users who already loaded the index receive updates automatically on next app launch (it checks the `<update version="...">` tag against the locally cached version).

## Versioning

Every XML file has an `<info>` block with a version. Every `.index` file also has a version inside `<update version="...">`. **Both must be incremented when content is changed:**

1. Bump the version in the `<info>/<update version="...">` of the modified XML file
2. Bump the version in the `.index` file that references it

Versions use semantic-ish numbers like `1.0.8`. Increment the patch number for minor changes.

## Repository Structure

```
umbraxakar.index              # Production index (master branch)
testing-nikos-cretan.index    # Test index (Nikos-the-Cretan branch)
core/                         # Custom "Book of the Fallen" campaign content
  weapons.xml                 # Magic weapons (e.g. Dragnipur, Hammer of Hephaestus)
  armors.xml                  # Magic armors
  spells.xml                  # Custom spells including Allomancy metals
  feats.xml                   # Custom feats (e.g. Mark of Shadowthrone)
  supernatural-gifts.xml      # Epic boons and supernatural gifts
  companions.xml              # Custom companion stat blocks
  rings.xml / scrolls.xml / misc-items.xml
  rogue-mistborn.xml          # Rogue: Mistborn subclass (Allomancy archetype)
Vault/
  DM Guide/                   # DMG content (classes, items, races)
  forgotten-secrets/          # "Compendium of Forgotten Secrets: Awakening" (COFSA)
    archetypes/               # 17+ warlock patrons and other subclasses
    races/                    # Races from COFSA
    spells.xml / feats.xml / invocations.xml / familiars.xml / items.xml
Wildemount/
  items.xml                   # Explorer's Guide to Wildemount items
```

## XML Element Structure

All content files wrap elements in `<elements>`. Each `<element>` follows this pattern:

```xml
<element name="Display Name" type="Magic Item" source="Book of the Fallen" id="ID_BOTF_MAGIC_ITEM_UNIQUE_NAME">
    <description>
        <p>HTML-formatted description shown in Aurora.</p>
    </description>
    <setters>
        <set name="category">Magic Weapons</set>
        <set name="rarity">Legendary</set>
        <set name="attunement">true</set>
        <!-- type-specific setters -->
    </setters>
    <sheet>
        <!-- Short version shown on the character sheet -->
        <description>Brief mechanical summary.</description>
    </sheet>
    <rules>
        <!-- Mechanical grants, e.g.: -->
        <stat name="stealth:misc" value="10" />
        <grant type="Archetype Feature" id="ID_..." level="3"/>
    </rules>
</element>
```

**Element types** used in this repo: `Magic Item`, `Spell`, `Feat`, `Archetype`, `Archetype Feature`, `Companion`, `Source`, `Race`, `Sub Race`, `Class Feature`, `Invocation`, `Class`

## ID Naming Conventions

IDs are globally unique across Aurora Builder. Follow these patterns:

| Content type | Pattern | Example |
|---|---|---|
| Core campaign content | `ID_BOTF_[TYPE]_[NAME]` | `ID_BOTF_MAGIC_ITEM_DRAGNIPUR` |
| Forgotten Secrets | `ID_GFP_[TYPE]_[NAME]` | `ID_GFP_SOURCE_FORGOTTEN_SECRETS` |
| DMG content | `ID_WOTC_[TYPE]_[NAME]` | `ID_WOTC_SOURCE_DUNGEON_MASTERS_GUIDE` |

`BOTF` = Book of the Fallen, `GFP` = Genuine Fantasy Press, `WOTC` = Wizards of the Coast.

Use `SCREAMING_SNAKE_CASE` for the descriptive part. IDs must be unique — duplicates will cause Aurora Builder to error.

## Branch Workflow

- `master` — stable, used by players via `umbraxakar.index`
- `Nikos-the-Cretan` — testing branch, used via `testing-nikos-cretan.index`
- Feature branches (e.g. `Anomander-the-Rake`) — individual contributor branches, PR'd into master

Content that should immediately be available to all players goes to `master`. Content under development or testing goes to `Nikos-the-Cretan` first.

## Thematic Context

- **Malazan lore**: Kurald Galain (Elder Darkness), Tiste Andii, Shadowthrone, Meanas (Warren of shadow), Draconus, Dragnipur
- **Mistborn lore**: Allomancy (burning metals), Lerasium, Mistborn, Coinshot, Lurcher, Tineye, Thug, Rioter, Soother
- `source="Book of the Fallen"` is used for all custom campaign content in `core/`

# Chaos Engine - Notes and Requirements

### Keywords (notes for writter)
- Characters
- Resources
  - Morale
  - Inspect
    - Attach Heroes
    - Supply
- Events
  - Chaos Portals
    - Corruption, Difficulty, Impact
  - Mother Dark Temples
- Global counters: Civilian Death Count
- Castle: Staging Area, resource recovery

### Preface:
- This is software for a custom D&D Campaign campaign based on the Malazan Book of the Fallen universe. The lore was adapted and changed significantly. Extensive documentation exists here:
F:\OneDrive\Dungeons & Dragons\Book of the Fallen Flight of Dragons\AI Assisted Book of the Fallen
- The aim of this is to be a game played over a TV screen over a table, receiving input from a laptop. There should be a DM screen and a  game screen.
- Approximate game length ~40min to an hour every session

### Main idea
- Every time a commander is chosen from the players (this is an ingame character that a player controls) to direct the available resources to defend Edar. (for first version we ignore the warrens.)
- Every commander changes the morale score of a resource, depending on their in game interactions so far in the storyline.
- The player screen consists of a Map of Edar, and to the left on a slider the resources. 
The resources can be inspected for details and several actions can be taken.
  - The resource can be dragged and assigned to an Event
  - Resources can diminish in strength (Lessen in Numbers, injuries, this implies resource tyype, downtime, healing, supplies etc)
- Events are mainly Chaos Portals which appear randomly (there also other types of events on the map to be expanded later)
- This Events carry corruption scores and difficulty, as well as local impact.
- Each turn takes 3 in game days.
- Things to keep track off: Civilian Casualties
- No End of the World Counter, this is an in game decission for the dm, not part of this software.
- Above the resources have the Castle. Which can be opened and upgraded. The castle restores morale, heals some resource types.

## Mechanics
### Events
- Chaos Portals
  - Number: Main Resources +1 d6 roll (adjustable by DM - allow to seed more or remove)
  - Seed randomly on Land
  - Corruption: Max level 5. When level 3 is reached the area can only be uncorrupted by a cleric or a palladin on level 12 and above. (can include heroes such as Angels, Gods, etc)
This is an attribute that can be given to a resource by the DM. At level 5 a legendary spawn appears. Maxing Difficulty and adds +1 to the normal max
Corruption progresses by one every round.
  - Difficulty: Start randomly from 1 to 5 with a max of 9 (10 when a legenday spawn appears)
  - Impact: This is how many civillians might be lost per turn. Max level 10. Seed randomly. DM  needs to manually change the number for some, depending proximity to civilization etc.
  - New portals open per round

- Mother Dark Temples
  - Effect: Corruption cannot be or raise more than 2 in their proximity. Anomanders Resources gain +3 to power in the area.
  - Consider that 5 are already established - already 2 from story, and 3 from allies. 17 in total. (area of effect can be changed globally for all by the DM)
  - To be activated there is a difficulty similar to Chaos Portals

### Resources
#### Types
Heroes (Karsa, Korlat - Dragon), Avatars (a god Avatar - none available yet), Groups (Avowed (2 groups), Blue Rose units, Ubraxakar units etc) 
 
- Power: How strong the resource is. 1 to 10
- Morale: 1 to 5. Determined by story at where it starts. if left at the castle it raises by 1 per round. 
  - castle improvements to raise it faster
Lose 1 per turn at an event. 2 lost if event battle is not won (if a battle is not won the asset remains attached to the event for the next turn)
- Number: (groups have numbers) - Some can be replenished, some cannot. e.g. Avowed are a static pool.
- Decimation resistance: groups that have numbers have this as well. it determines the possibillity of deaths in the group
- Injury resistance: heroes thave this as well. it determines the possibillity of deaths in the group
- Injured: groups have injuries
- Injuries: Heroes can receive injuries that require a healer.

Heroes can be grouped. Groups can be assigned 1 to 3 Heroes.
This alters the stats. How I think of resources is a rectangle, with an image to the left and stats to the right.
attached heroes are bellow the stats. They can be remove or added. If they are added to a group or another hero they are removed from the resource pool.

### Castle
- The players have a money cache. (the amount is in the recaps, can be altered by the DM based on in game actions)
- Can hire entertainers for a week (raises morale faster) - has cost
- Can offer training (temporary power boost - lowers morale) - training grounds can be upgraded
- Resources like heroes can be healed
- Other similar things that can affect the resources
- Train militias etc

Loop:
Events exist on the map, new Chaos Portals appear every turn. The players have a finite amount of resources.
Those resources can be upgraded, compined etc. 
At the start of each turn a commander is selected. Resources can be assigned on Events to complete them.
The castle can be updated / upgraded etc.

At the end of every turn the system runs 'dice' to determin the conclussion for every event. 
For example. On a Level 5 Difficulty Chaos Portal a Level 4 Hero is assigned. 
The d20 roll (done by the system) needs to be  10 + (Event Difficulty - Resource Power)
Also Event Difficulty - Resource Power - Decimation/Injury  resistance should also determine a change for injury or number loss in a group or sustaining personal injury or injured numder

## System
The system should 
- allow the DM to add or alter resources manually
- add/edit/remove events, including moving them
- procceed to undo actions (via save load and 10 action undo)
- have persistance - in the form of a database or json files














import { assign } from './assignment';
import { chooseCommander } from './commanders';
import { updatePortal, updateResource, updateTemple } from './dm-edits';
import { GameState, Result, newGame } from './game-state';
import { NO_REVEAL, tableView } from './table-view';
import { endTurn, resolveAll } from './turn';
import { RULES, SEED } from './testing';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const commanders = SEED.commanders;

/** A session salted with secrets the table must never see. */
function secretive(): GameState {
  let s = newGame(SEED, RULES, 99);
  const [hiddenPortal, visiblePortal] = s.events.portals;
  s = unwrap(updatePortal(s, hiddenPortal.id, { hidden: true, dmNotes: 'SECRET-PORTAL-NOTE' }, RULES));
  s = unwrap(updatePortal(s, visiblePortal.id, { dmNotes: 'SECRET-VISIBLE-NOTE' }, RULES));
  s = unwrap(updateTemple(s, 'temple-jhag-odhan', { dmNotes: 'SECRET-TEMPLE-NOTE' }, RULES));
  s = unwrap(assign(s, 'uruk', hiddenPortal.id, RULES));
  s = unwrap(updateResource(s, 'karsa-orlong', { fallen: true }));
  return s;
}

describe('tableView: nothing DM-only reaches the table', () => {
  const s = secretive();
  const view = tableView(s, RULES, commanders);
  const json = JSON.stringify(view);

  it('omits hidden events and undiscovered temples', () => {
    const hidden = s.events.portals[0];
    expect(view.portals.some((p) => p.id === hidden.id)).toBe(false);
    expect(json).not.toContain(hidden.name);
    for (const t of s.events.temples.filter((t) => !t.discovered)) expect(json).not.toContain(t.name);
    expect(view.temples.every((t) => t.discovered)).toBe(true);
  });

  it('strips every DM note', () => {
    expect(json).not.toMatch(/SECRET-/);
  });

  it('omits locked resources and the fallen', () => {
    for (const name of ['Anomander Rake', 'Tiamat', "Hood's Gathered Host", 'Avowed: Avernus Contingent', 'The Seguleh']) {
      expect(json).not.toContain(name);
    }
    expect(view.resources.some((r) => r.id === 'karsa-orlong')).toBe(false);
    expect(json).not.toMatch(/lockReason|Not yet resurrected/);
  });

  it('shows a card at a hidden event as away at the castle, not where it went', () => {
    expect(view.resources.find((r) => r.id === 'uruk')!.location).toEqual({ kind: 'castle' });
  });

  it('gives odds only for events and cards the table can see', () => {
    const hidden = s.events.portals[0];
    expect(Object.keys(view.odds.send)).not.toContain(hidden.id);
    expect(Object.keys(view.odds.current)).not.toContain(hidden.id);
    const shownIds = new Set(view.resources.map((r) => r.id));
    for (const byCard of Object.values(view.odds.send)) {
      expect(Object.keys(byCard).every((id) => shownIds.has(id))).toBe(true);
      expect(Object.keys(byCard)).not.toContain('anomander-rake');
    }
    const any = Object.values(view.odds.send)[0]['uruk'];
    expect(any.ok).toBe(true);
  });

  it('never carries the local path of the source map', () => {
    expect(json).not.toContain('OneDrive');
    expect('source' in view.map).toBe(false);
  });

  it('hides the treasury when the DM says so', () => {
    expect(view.treasury).toBe(200000);
    const quiet = { ...s, castle: { ...s.castle, showTreasuryOnTable: false } };
    expect(tableView(quiet, RULES, commanders).treasury).toBeNull();
  });
});

describe('tableView: reveals', () => {
  it('shows only the battles the DM has revealed, and no harm', () => {
    let s = newGame(SEED, RULES, 12);
    const [a, b] = s.events.portals;
    s = unwrap(assign(s, 'karsa-orlong', a.id, RULES));
    s = unwrap(assign(s, 'uruk', b.id, RULES));
    const pending = resolveAll(s, RULES);

    expect(tableView(s, RULES, commanders, NO_REVEAL).reckoning).toBeNull();
    const none = tableView(s, RULES, commanders, { pending, revealed: [], showReport: false });
    expect(none.reckoning).toEqual([]);

    const one = tableView(s, RULES, commanders, { pending, revealed: [a.id], showReport: false });
    expect(one.reckoning).toEqual([
      expect.objectContaining({ eventId: a.id, eventName: a.name, d20: pending.battles[a.id].d20, cards: ['Karsa Orlong'] }),
    ]);
    expect(JSON.stringify(one.reckoning)).not.toMatch(/harm|threat|chance/);
  });

  it('never reveals a battle at a hidden event, nor names the fallen on a card', () => {
    let s = newGame(SEED, RULES, 12);
    const hidden = s.events.portals[0];
    s = unwrap(assign(s, 'uruk', hidden.id, RULES));
    s = unwrap(updatePortal(s, hidden.id, { hidden: true }, RULES));
    const pending = resolveAll(s, RULES);
    const view = tableView(s, RULES, commanders, { pending, revealed: [hidden.id], showReport: false });
    expect(view.reckoning).toEqual([]);
    expect(JSON.stringify(view)).not.toContain(hidden.name);

    let t = newGame(SEED, RULES, 12);
    t = { ...t, resources: t.resources.map((r) => (r.id === 'blues' ? { ...r, attachedTo: 'avowed-prince', fallen: true } : r)) };
    expect(tableView(t, RULES, commanders).resources.find((r) => r.id === 'avowed-prince')!.attached).toEqual([]);
  });

  it('shows the turn report only when the DM does', () => {
    const s = endTurn(newGame(SEED, RULES, 3), RULES);
    expect(tableView(s, RULES, commanders).report).toBeNull();
    expect(tableView(s, RULES, commanders, { ...NO_REVEAL, showReport: true }).report?.turn).toBe(1);
  });

  it('names the commander once they take command, with their sway, but never over locked resources', () => {
    const s = unwrap(chooseCommander(newGame(SEED, RULES, 3), 'imogen', RULES));
    const c = tableView(s, RULES, commanders).commander!;
    expect(c.name).toBe('Imogen Ashborn');
    expect(c.player).toBe('marios.p (Marios)');
    expect(c.impact.map((i) => [i.name, i.delta])).toEqual([
      ['Cowl', 1],
      ["Kazz D'avore", -1],
    ]);
    // Neldor sways Anomander, who is locked: the table must not learn of him.
    const n = tableView(unwrap(chooseCommander(newGame(SEED, RULES, 3), 'neldor-andarist', RULES)), RULES, commanders).commander!;
    expect(n.impact.some((i) => i.name === 'Silchas Ruin')).toBe(true);
    // Reasons may name people the players know; the locked resources themselves must not be listed.
    expect(n.impact.map((i) => i.name)).not.toEqual(expect.arrayContaining(['Anomander Rake']));
    expect(n.impact.map((i) => i.name).filter((x) => ['Anomander Rake', 'Tiamat', 'The Seguleh'].includes(x))).toEqual([]);
  });

  it('shows no commander from a previous turn', () => {
    const s = endTurn(unwrap(chooseCommander(newGame(SEED, RULES, 3), 'imogen', RULES)), RULES);
    expect(tableView(s, RULES, commanders).commander).toBeNull();
  });
});

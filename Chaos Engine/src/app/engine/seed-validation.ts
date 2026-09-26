import { GroupSeed, HeroSeed, Point, Seed } from './seed-types';

/** Returns human-readable problems with the seed data; empty when valid. */
export function validateSeed(seed: Seed): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, msg: string) => {
    if (!ok) errors.push(msg);
  };
  const inRange = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
  const onMap = (p: Point) => inRange(p.x, 0, 1) && inRange(p.y, 0, 1);

  const { heroes, avatars, groups } = seed.resources;
  const allResources = [...heroes, ...avatars, ...groups];

  // Unique ids across every entity kind, since they share one state namespace.
  const ids = [
    ...seed.commanders.map((c) => c.id),
    ...allResources.map((r) => r.id),
    ...seed.temples.map((t) => t.id),
  ];
  const seen = new Set<string>();
  for (const id of ids) {
    check(!seen.has(id), `Duplicate id: ${id}`);
    seen.add(id);
  }

  const resourceIds = new Set(allResources.map((r) => r.id));
  for (const c of seed.commanders) {
    check(inRange(c.level, 1, 20), `Commander ${c.id}: level ${c.level} out of 1-20`);
    for (const i of c.influence ?? []) {
      check(resourceIds.has(i.resourceId), `Commander ${c.id}: influence on unknown resource ${i.resourceId}`);
      check(inRange(i.morale, -2, 2) && i.morale !== 0, `Commander ${c.id}: influence on ${i.resourceId} must be -2..2 and not 0`);
      check(!!i.reason?.trim(), `Commander ${c.id}: influence on ${i.resourceId} needs a reason`);
    }
  }

  const checkCommon = (r: HeroSeed | GroupSeed) => {
    check(inRange(r.power, 1, 10), `${r.id}: power ${r.power} out of 1-10`);
    check(inRange(r.morale, 1, 5), `${r.id}: morale ${r.morale} out of 1-5`);
    check(!r.locked || !!r.lockReason, `${r.id}: locked without lockReason`);
  };
  for (const h of [...heroes, ...avatars]) {
    checkCommon(h);
    check(inRange(h.injuryResistance, 1, 5), `${h.id}: injuryResistance out of 1-5`);
  }
  for (const g of groups) {
    checkCommon(g);
    check(inRange(g.decimationResistance, 1, 5), `${g.id}: decimationResistance out of 1-5`);
    check(g.number >= 0 && g.number <= g.maxNumber, `${g.id}: number ${g.number} not within 0-${g.maxNumber}`);
    check(g.injured >= 0 && g.injured <= g.number, `${g.id}: injured exceeds number`);
  }

  const cfg = seed.eventsConfig;
  check(seed.temples.length === cfg.temple.total, `Expected ${cfg.temple.total} temples, found ${seed.temples.length}`);
  for (const t of seed.temples) {
    check(onMap(t.position), `${t.id}: position off map`);
    check(inRange(t.activationDifficulty, 1, cfg.portal.maxDifficulty), `${t.id}: activationDifficulty out of range`);
    check(!t.active || t.discovered, `${t.id}: active but undiscovered`);
  }

  const activeMap = seed.map.maps.find((m) => m.id === seed.map.activeMapId);
  check(!!activeMap, `activeMapId ${seed.map.activeMapId} has no map`);
  for (const m of seed.map.maps) {
    for (const r of [...m.regions, ...m.noSpawnZones]) {
      check(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001, `${m.id}/${r.id}: rect leaves the map`);
    }
    const styleIds = (m.styles ?? []).map((st) => st.id);
    check(new Set(styleIds).size === styleIds.length, `${m.id}: map style ids repeat`);
    for (const st of m.styles ?? []) check(!!st.asset && !!st.name, `${m.id}/${st.id}: a map style needs a name and an image`);
  }

  check(onMap(seed.castle.position), 'Castle position off map');
  check(seed.castle.treasury >= 0, 'Treasury negative');
  for (const f of seed.castle.facilities) {
    check(inRange(f.level, 1, 3), `Facility ${f.id}: level out of 1-3`);
    check(['1', '2', '3'].every((l) => l in f.levels), `Facility ${f.id}: missing level definitions`);
  }

  return errors;
}

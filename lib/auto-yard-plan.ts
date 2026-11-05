import type { Property, RoadTask } from "./account/repository";
import { resolvedPlant, type Survey } from "./survey";
import { curatedPlantActions } from "./plant-actions";
import { canonicalReferenceTaxon } from "./taxon-names";

export type GeneratedRoadTask = Omit<RoadTask, "id" | "updated_at" | "created_at">;
export function njDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function planTaskState(task: Pick<RoadTask, "done" | "due_start" | "due_end">, now = new Date()): "done" | "pending" | "upcoming" | "overdue" {
  if (task.done) return "done";
  const today = njDate(now);
  if (task.due_end && task.due_end < today) return "overdue";
  if (task.due_start && task.due_start > today) return "upcoming";
  return "pending";
}
/** Only unambiguous explicit seasons are calendar windows; phenology remains a prerequisite. */
export function actionWindow(text: string, now = new Date()): { season: RoadTask["season"]; due_start: string | null; due_end: string | null; plan_year: number } {
  const today = njDate(now), year = Number(today.slice(0, 4));
  let season: RoadTask["season"] = "Any season", start = "", end = "";
  if (/^(Autumn|Autumn colour change|Early-fall flowering stage in the source reference)$/.test(text)) { season = "Autumn"; start = "09-01"; end = "11-30"; }
  else if (/^(Spring, before flowering|Spring leaf-out and any later frost|Spring leaf-out and flowering|Early spring flowering|Spring flowering|Spring flowering and basal-leaf growth)$/.test(text)) { season = "Spring"; start = "03-01"; end = "05-31"; }
  else if (text === "Before and during hot summer weather") { season = "Summer"; start = "06-01"; end = "08-31"; }
  // Age-dependent late-winter advice and multi-season/phenology-only advice stay undated.
  const plan_year = start && `${year}-${end}` < today ? year + 1 : year;
  return { season, plan_year, due_start: start ? `${plan_year}-${start}` : null, due_end: end ? `${plan_year}-${end}` : null };
}
export function generateAutoYardPlan(property: Property, surveys: Survey[], now = new Date()): GeneratedRoadTask[] {
  const areaIds = new Set(property.yard_areas.map(a => a.id));
  const latest = new Map<string, Survey>();
  for (const s of surveys) {
    if (s.source !== "upload" || !s.photoPath || !s.areaId || !areaIds.has(s.areaId)) continue;
    const previous = latest.get(s.areaId);
    if (!previous || s.createdAt > previous.createdAt || (s.createdAt === previous.createdAt && s.id > previous.id)) latest.set(s.areaId, s);
  }
  const year = Number(njDate(now).slice(0, 4));
  const tasks = new Map<string, GeneratedRoadTask>();
  function add(areaId: string | null, taxon: string, action: string, values: Partial<GeneratedRoadTask>) {
    const task: GeneratedRoadTask = { property_id: property.id, yard_area_id: areaId, title: "", notes: "", replacement_id: null, done: false, stage: "Review", season: "Any season", plan_year: year, due_start: null, due_end: null, ...values };
    task.auto_key = JSON.stringify(["yard-plan-v1", property.id, areaId, taxon, action, task.season, task.plan_year]);
    tasks.set(task.auto_key, task);
  }
  if (!latest.size) {
    add(null, "initial-scan", "scan", { title: "Save your first yard observation", notes: "Photograph a yard area, review the plant identities and confirm which plants belong to your yard before planning plant work." });
    return [...tasks.values()];
  }
  for (const [areaId, survey] of latest) {
    const seen = new Set<string>();
    for (const region of survey.plants) {
      if (region.yardScope === "background") continue;
      const plant = resolvedPlant(region);
      const canonical = canonicalReferenceTaxon(region.scientificName);
      const taxon = canonical?.toLowerCase() || region.scientificName.trim().toLowerCase() || `unidentified:${region.id}`;
      if (seen.has(taxon)) continue;
      seen.add(taxon);
      const provenance = { survey_id: survey.id, source_details: `Saved observation ${survey.createdAt}; area ${areaId}; ${canonical || "identity unresolved"}.` };
      const exact = !!canonical && !!plant && canonicalReferenceTaxon(plant.scientificName)?.toLowerCase() === taxon && plant.horticulture?.taxonScope !== "genus";
      if (!region.reviewed || region.yardScope !== "yard" || !exact) {
        add(areaId, taxon, "review", { ...provenance, title: `Review ${canonical || region.suggestion || "plant identity"}`, notes: "Confirm the exact identity and that this plant belongs to your yard. No plant care or removal action is inferred from this provisional observation." });
        continue;
      }
      const actions = curatedPlantActions(plant!.id);
      if (!actions.length) {
        add(areaId, taxon, "source-review", { ...provenance, title: `Find sourced guidance for ${plant!.commonName}`, notes: "This reviewed observation has no curated species-specific action. Review reliable local guidance before planning work." });
      }
      for (const action of actions) {
        add(areaId, taxon, `${action.kind}:${action.title}`, { ...provenance, ...actionWindow(action.season, now), title: `${plant!.commonName}: ${action.title}`, stage: "Do", notes: `${action.detail}\nTiming prerequisite: ${action.season}.\nScope: ${action.scope}`, source_details: `${provenance.source_details}\n${action.source.label}: ${action.source.url}\nChecked ${action.source.checkedOn}; ${action.evidence.basis}.` });
      }
    }
  }
  return [...tasks.values()];
}

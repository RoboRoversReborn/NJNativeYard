import { assessablePlant, resolvedPlant, type Survey, type SurveyPlant } from "./survey";
import { taxonKey } from "./nj-evidence";

/** Unknown legacy capture data must remain absent, rather than inferred from upload time. */
export interface ComparisonCaptureContext {
  capturedAt?: string;
  exifCaptureTime?: { dateTimeOriginal: string; offsetTimeOriginal?: string };
  capturedAtSource?: "user-confirmed" | "exif" | "upload-fallback";
  capturedAtConfirmed?: boolean;
  photoPointId?: string;
  photoPointConfirmed?: boolean;
  imageSha256?: string;
  method?: {
    provider?: string;
    modelVersion?: string;
    promptVersion?: string;
    pipelineVersion?: string;
  };
}

export type ComparisonObservation = Survey & { capture?: ComparisonCaptureContext };
type Declaration = "comparable" | "different" | "unknown";
export interface ComparisonEvidence {
  beforeSurveyId: string;
  afterSurveyId: string;
  /** Bind declarations to comparisonFingerprint(), including capture/method changes. */
  beforeFingerprint: string;
  afterFingerprint: string;
  sameView?: Declaration;
  season?: Declaration;
  visibility?: Declaration;
  reviewerId?: string;
  reviewedAt?: string;
}
export type ComparisonReasonCode =
  | "not_real_observations" | "area_missing" | "area_mismatch"
  | "same_photo" | "snapshot_missing" | "snapshot_unavailable"
  | "review_unsaved" | "snapshot_review_mismatch" | "scope_unconfirmed" | "no_yard_regions"
  | "identity_unreviewed" | "identity_unresolved" | "snapshot_scope_unconfirmed"
  | "capture_time_unconfirmed" | "capture_order_unconfirmed"
  | "photo_point_unconfirmed" | "photo_point_mismatch" | "image_identity_missing"
  | "catalog_missing" | "catalog_mismatch" | "formula_missing" | "formula_mismatch"
  | "method_missing" | "method_mismatch" | "evidence_missing" | "evidence_stale"
  | "reviewer_unconfirmed" | "framing_unconfirmed" | "framing_different"
  | "season_unconfirmed" | "season_different" | "visibility_unconfirmed" | "visibility_different";
export interface ComparisonReason {
  code: ComparisonReasonCode;
  message: string;
  basis: "computed" | "missing-evidence" | "user-declared";
}
export interface SpeciesObservationRef {
  surveyId: string;
  regionIds: string[];
  reviewed: boolean;
}
export interface SpeciesLedgerEntry {
  taxonKey: string;
  scientificName: string;
  status: "SeenBoth" | "NewlyObserved" | "NotObserved" | "RecordCorrected";
  evidenceLevel: "reviewed-taxon-records" | "suggested-taxon-records";
  before: SpeciesObservationRef | null;
  after: SpeciesObservationRef | null;
  explanation: string;
}
export interface ObservationComparison {
  state: "Comparable" | "ReviewRequired" | "DifferentViewOrMethod" | "RecordCorrected";
  eligible: boolean;
  reasons: ComparisonReason[];
  /** Difference of immutable saved index numbers, never current-reference recomputation. */
  numericDelta: number | null;
  numericDeltaUnit: "index points";
  savedScores: { before: number | null; after: number | null };
  ledger: SpeciesLedgerEntry[];
  unresolvedRegionIds: { before: string[]; after: string[] };
}

const latest = (survey: Survey) => survey.assessmentHistory?.at(-1);
const timestamp = (value?: string) => value ? Date.parse(value) : NaN;
const hash = (value?: string) => !!value && /^[a-f0-9]{64}$/i.test(value);
const known = (value?: string) => !!value?.trim() &&
  !/^(unknown|unavailable|unrecorded|unspecified|latest|n\/a)$/i.test(value.trim()) &&
  !/(?:^|[-_/])latest$/i.test(value.trim());

/** A change-detection key, not an authorization token or proof of botanical identity. */
export function comparisonFingerprint(survey: ComparisonObservation): string {
  const c = survey.capture;
  const s = latest(survey);
  return JSON.stringify({
    id: survey.id, areaId: survey.areaId ?? null, source: survey.source,
    revision: survey.revision ?? null, photoPath: survey.photoPath ?? null,
    snapshot: s ?? null,
    capture: c ? {
      capturedAt: c.capturedAt ?? null, capturedAtSource: c.capturedAtSource ?? null,
      capturedAtConfirmed: c.capturedAtConfirmed ?? false,
      photoPointId: c.photoPointId ?? null, photoPointConfirmed: c.photoPointConfirmed ?? false,
      imageSha256: c.imageSha256?.toLowerCase() ?? null,
      method: [c.method?.provider, c.method?.modelVersion, c.method?.promptVersion, c.method?.pipelineVersion],
    } : null,
    regions: survey.plants.map(p => [p.id, p.plantId ?? null, p.scientificName, p.reviewed,
      p.yardScope ?? null, p.box.x, p.box.y, p.box.w, p.box.h]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });
}

function speciesRecords(survey: ComparisonObservation) {
  const taxa = new Map<string, { name: string; regions: SurveyPlant[] }>();
  const unresolved: string[] = [];
  for (const region of survey.plants.filter(p => p.yardScope === "yard")) {
    const name = resolvedPlant(region)?.scientificName || region.scientificName;
    if (!name || /\bspp?\.?\b/i.test(name) || /^(unknown|unidentified|unverified)\b/i.test(name) ||
      !/^[a-z][a-z-]+\s+(?:[×x]\s+)?[a-z][a-z-]+/i.test(name)) {
      unresolved.push(region.id);
      continue;
    }
    const key = taxonKey(name);
    const entry = taxa.get(key) || { name, regions: [] };
    entry.regions.push(region);
    taxa.set(key, entry);
  }
  return { taxa, unresolved };
}

export function compareObservations(
  before: ComparisonObservation,
  after: ComparisonObservation,
  evidence?: ComparisonEvidence,
): ObservationComparison {
  const reasons: ComparisonReason[] = [];
  const add = (code: ComparisonReasonCode, message: string, basis: ComparisonReason["basis"] = "computed") => {
    if (!reasons.some(r => r.code === code)) reasons.push({ code, message, basis });
  };
  const a = latest(before), b = latest(after);
  const sameArea = !!before.areaId && before.areaId === after.areaId;
  const real = before.source === "upload" && after.source === "upload";
  if (!real) add("not_real_observations", "Only saved real-photo observations can establish a comparison.");
  if (!before.areaId || !after.areaId) add("area_missing", "Confirm the area for both observations.", "missing-evidence");
  else if (!sameArea) add("area_mismatch", "These observations belong to different areas.");
  const samePhoto = before.id === after.id ||
    (!!before.photoPath && before.photoPath === after.photoPath) ||
    (hash(before.capture?.imageSha256) && hash(after.capture?.imageSha256) &&
      before.capture!.imageSha256!.toLowerCase() === after.capture!.imageSha256!.toLowerCase());
  if (samePhoto) add("same_photo", "These records review the same photo; differences are record corrections, not a new capture.");
  if (!a || !b) add("snapshot_missing", "A saved assessment snapshot is missing; historic numbers are not reconstructed.", "missing-evidence");
  if ([a, b].some(s => s && (s.score === null || !Number.isFinite(s.score))))
    add("snapshot_unavailable", "At least one saved observation has no usable index number.");
  if (before.revision || after.revision) add("review_unsaved", "Save the current review before comparing immutable records.");
  for (const survey of [before, after]) {
    const saved = latest(survey);
    if (saved) {
      try {
        const content = JSON.parse(saved.fingerprint);
        const rows = Array.isArray(content) ? content.at(-1) : null;
        const currentRows = survey.plants.map(p => [p.id, resolvedPlant(p)?.id || p.scientificName,
          p.reviewed, p.yardScope || null]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
        if (!Array.isArray(rows) || JSON.stringify(rows) !== JSON.stringify(currentRows))
          add("snapshot_review_mismatch", "The current region review does not match its saved assessment snapshot.");
      } catch {
        add("snapshot_review_mismatch", "The saved review fingerprint cannot be verified.", "missing-evidence");
      }
    }
    if (survey.plants.some(p => !p.yardScope)) add("scope_unconfirmed", "Yard membership is unconfirmed for one or more regions.", "missing-evidence");
    const yard = survey.plants.filter(p => p.yardScope === "yard");
    if (!yard.length) add("no_yard_regions", "Each observation needs confirmed yard regions.");
    if (yard.some(p => !p.reviewed)) add("identity_unreviewed", "Review all included yard identities before a numeric comparison.", "missing-evidence");
    if (yard.some(p => !assessablePlant(p))) add("identity_unresolved", "An included identity or NJ ecological role is unresolved.", "missing-evidence");
    const c = survey.capture;
    if (!c?.capturedAtConfirmed || !["user-confirmed", "exif"].includes(c.capturedAtSource || "") || !Number.isFinite(timestamp(c.capturedAt)))
      add("capture_time_unconfirmed", "Capture time needs confirmation; upload time is not substituted.", "missing-evidence");
    if (!c?.photoPointId?.trim() || !c.photoPointConfirmed)
      add("photo_point_unconfirmed", "Confirm the photo point for both captures.", "missing-evidence");
    if (!hash(c?.imageSha256)) add("image_identity_missing", "Image identity provenance is missing.", "missing-evidence");
    if (![c?.method?.provider, c?.method?.modelVersion, c?.method?.promptVersion, c?.method?.pipelineVersion].every(known))
      add("method_missing", "Provider, model, prompt and pipeline versions must be recorded; aliases such as latest are not fixed provenance.", "missing-evidence");
  }
  if ([a, b].some(s => s && (s.assessmentScope !== "yard" || s.scopeProvisional || s.provisional || !s.scope || s.scope.unconfirmed > 0)))
    add("snapshot_scope_unconfirmed", "Saved estimates must contain reviewed, confirmed-yard scope.", "missing-evidence");
  const ta = timestamp(before.capture?.capturedAt), tb = timestamp(after.capture?.capturedAt);
  if (Number.isFinite(ta) && Number.isFinite(tb) && tb <= ta)
    add("capture_order_unconfirmed", "Choose a later capture after the earlier one; same-day captures are allowed when their order is known.");
  if (before.capture?.photoPointId && after.capture?.photoPointId && before.capture.photoPointId !== after.capture.photoPointId)
    add("photo_point_mismatch", "These captures use different photo points.");
  if (!known(a?.catalogVersion) || !known(b?.catalogVersion)) add("catalog_missing", "Historic catalog versions are missing.", "missing-evidence");
  else if (a!.catalogVersion !== b!.catalogVersion) add("catalog_mismatch", "Catalog treatment differs; saved scores remain separate.");
  if (!known(a?.version) || !known(b?.version)) add("formula_missing", "Historic formula versions are missing.", "missing-evidence");
  else if (a!.version !== b!.version) add("formula_mismatch", "The saved index formulas differ; no physical change is inferred.");
  const ma = before.capture?.method, mb = after.capture?.method;
  if (ma && mb && (["provider", "modelVersion", "promptVersion", "pipelineVersion"] as const).some(k => known(ma[k]) && known(mb[k]) && ma[k] !== mb[k]))
    add("method_mismatch", "Capture analysis methods differ.");
  if (!evidence) add("evidence_missing", "Confirm comparable framing, season and visibility for this exact pair.", "missing-evidence");
  else {
    if (evidence.beforeSurveyId !== before.id || evidence.afterSurveyId !== after.id ||
      evidence.beforeFingerprint !== comparisonFingerprint(before) || evidence.afterFingerprint !== comparisonFingerprint(after))
      add("evidence_stale", "The observation or capture context changed after these declarations; review the pair again.");
    if (!evidence.reviewerId?.trim() || !Number.isFinite(timestamp(evidence.reviewedAt)) ||
      (Number.isFinite(tb) && timestamp(evidence.reviewedAt) < tb))
      add("reviewer_unconfirmed", "Record who reviewed the pair and when, after its captures.", "missing-evidence");
    for (const [field, missing, different, label] of [
      ["sameView", "framing_unconfirmed", "framing_different", "Framing"],
      ["season", "season_unconfirmed", "season_different", "Season or growth stage"],
      ["visibility", "visibility_unconfirmed", "visibility_different", "Visibility and photographed coverage"],
    ] as const) {
      if (evidence[field] === "different") add(different, `${label} differs between these captures.`, "user-declared");
      else if (evidence[field] !== "comparable") add(missing, `${label} comparability is not confirmed.`, "missing-evidence");
    }
  }
  const sa = speciesRecords(before), sb = speciesRecords(after);
  const ref = (survey: Survey, entry?: { regions: SurveyPlant[] }): SpeciesObservationRef | null => entry ? {
    surveyId: survey.id, regionIds: entry.regions.map(p => p.id), reviewed: entry.regions.every(p => p.reviewed),
  } : null;
  const ledger: SpeciesLedgerEntry[] = real && sameArea ? [...new Set([...sa.taxa.keys(), ...sb.taxa.keys()])].sort().map(key => {
    const left = sa.taxa.get(key), right = sb.taxa.get(key), ar = ref(before, left), br = ref(after, right);
    const both = !!left && !!right;
    return {
      taxonKey: key, scientificName: (right || left)!.name,
      status: both ? "SeenBoth" : samePhoto ? "RecordCorrected" : right ? "NewlyObserved" : "NotObserved",
      evidenceLevel: [ar, br].filter(Boolean).every(r => r!.reviewed) ? "reviewed-taxon-records" : "suggested-taxon-records",
      before: ar, after: br,
      explanation: samePhoto ? "Species classifications in reviews of the same photo; no new physical observation is inferred."
        : both ? "The taxon is recorded in both photos; this does not identify the same individual plant."
          : "The taxon is recorded in one photo, not established in the other; visibility and cause remain unknown.",
    };
  }) : [];
  const different = reasons.some(r => ["area_mismatch", "photo_point_mismatch", "catalog_mismatch", "formula_mismatch", "method_mismatch", "framing_different", "season_different", "visibility_different"].includes(r.code));
  const eligible = reasons.length === 0;
  return {
    state: samePhoto && real && sameArea ? "RecordCorrected" : eligible ? "Comparable" : different ? "DifferentViewOrMethod" : "ReviewRequired",
    eligible, reasons, numericDelta: eligible ? b!.score! - a!.score! : null,
    numericDeltaUnit: "index points", savedScores: { before: a?.score ?? null, after: b?.score ?? null },
    ledger, unresolvedRegionIds: { before: sa.unresolved, after: sb.unresolved },
  };
}

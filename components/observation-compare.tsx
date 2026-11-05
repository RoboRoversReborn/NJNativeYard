"use client";
import { ObservationTrend } from "./observation-trend";
import { useState } from "react";
import type { Survey } from "@/lib/survey";
import {
  compareObservations,
  comparisonFingerprint,
  type ComparisonEvidence,
} from "@/lib/observation-comparison";

const recorded = (s: Survey) =>
  s.capture?.capturedAtConfirmed && s.capture.capturedAt
    ? `Captured ${new Date(s.capture.capturedAt).toLocaleString()}`
    : `Recorded ${new Date(s.createdAt).toLocaleString()} · capture date unconfirmed`;
const labels = {
  Comparable: "Ready for observation comparison",
  ReviewRequired: "Review differences first",
  DifferentViewOrMethod: "Different views or methods",
  RecordCorrected: "Same photo, revised assessment",
};
export function ObservationCompare({
  surveys,
  beforeId,
  afterId,
  reviewerId,
  onPair,
  onOpen,
  onSaveEvidence,
}: {
  surveys: Survey[];
  beforeId?: string;
  afterId?: string;
  reviewerId: string;
  onPair: (before: string, after: string) => void;
  onOpen: (s: Survey) => void;
  onSaveEvidence: (s: Survey, evidence: ComparisonEvidence) => Promise<void>;
}) {
  const rows = surveys
    .filter((s) => s.source === "upload")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const before =
    rows.find((s) => s.id === beforeId) ||
    (!beforeId ? rows.at(-2) : undefined);
  const after =
    rows.find((s) => s.id === afterId) || (!afterId ? rows.at(-1) : undefined);
  const saved =
    before && after
      ? after.comparisonEvidenceHistory?.findLast(
          (e) =>
            e.beforeSurveyId === before.id &&
            e.afterSurveyId === after.id &&
            e.beforeFingerprint === comparisonFingerprint(before) &&
            e.afterFingerprint === comparisonFingerprint(after),
        )
      : undefined;
  const [declarations, setDeclarations] = useState<{
    sameView: "unknown" | "comparable" | "different";
    season: "unknown" | "comparable" | "different";
    visibility: "unknown" | "comparable" | "different";
  }>({
    sameView: saved?.sameView || "unknown",
    season: saved?.season || "unknown",
    visibility: saved?.visibility || "unknown",
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (rows.length < 2)
    return (
      <section>
        <h1>Compare observations</h1>
        <p>
          Save a second real photo in this area to inspect the two observations.
          Samples are excluded.
        </p>
      </section>
    );
  if (!before || !after)
    return (
      <section>
        <h1>Comparison unavailable</h1>
        <p>
          A selected observation is unavailable in this area. Choose a pair from
          its saved surveys.
        </p>
        <button onClick={() => onPair(rows.at(-2)!.id, rows.at(-1)!.id)}>
          Choose latest pair
        </button>
      </section>
    );
  const result = compareObservations(before, after, saved);
  async function save() {
    if (!before || !after || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await onSaveEvidence(after, {
        beforeSurveyId: before.id,
        afterSurveyId: after.id,
        beforeFingerprint: comparisonFingerprint(before),
        afterFingerprint: comparisonFingerprint(after),
        ...declarations,
        reviewerId,
        reviewedAt: new Date().toISOString(),
      });
      setMessage(
        "Comparison declarations saved. Missing capture or method evidence still prevents numeric change.",
      );
    } catch {
      setMessage(
        "Declarations could not be saved. Your selections remain here; retry when connected.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="observation-compare">
      <p className="eyebrow">YOUR AREA’S OBSERVATION RECORD</p>
      <h1>What these photos tell us</h1>
      <p>
        The latest two recorded photos are suggested initially. Choose any pair
        in this area for visual inspection; recorded time is not an inferred
        capture date.
      </p>
      <div className="comparison-photos">
        {([before, after] as const).map((s, i) => (
          <article key={`${i}/${s.id}`}>
            <label>
              {i ? "Later survey" : "Earlier survey"}
              <select
                value={s.id}
                onChange={(e) => {
                  setMessage("");
                  setDeclarations({
                    sameView: "unknown",
                    season: "unknown",
                    visibility: "unknown",
                  });
                  onPair(
                    i ? before.id : e.target.value,
                    i ? e.target.value : after.id,
                  );
                }}
              >
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {recorded(r)}
                  </option>
                ))}
              </select>
            </label>
            {s.photo ? (
              <a href={s.photo} target="_blank" rel="noreferrer">
                <img
                  src={s.photo}
                  alt={`${i ? "Later" : "Earlier"} saved area observation; open full image`}
                />
              </a>
            ) : (
              <p>
                Photo unavailable. Reload account data to renew private photo
                access.
              </p>
            )}
            <p>{recorded(s)}</p>
            <button className="secondary" onClick={() => onOpen(s)}>
              Open survey
            </button>
          </article>
        ))}
      </div>
      <section className="notice">
        <h2>{labels[result.state]}</h2>
        {result.numericDelta !== null ? (
          <p>
            Saved index difference: {result.numericDelta >= 0 ? "+" : ""}
            {result.numericDelta} index points. This is an observation
            difference, not a measured ecological outcome.
          </p>
        ) : (
          <p>
            Numeric difference is withheld. You can still inspect the photos and
            species records.
          </p>
        )}
        <ul>
          {result.reasons.map((r) => (
            <li key={r.code}>
              {r.message} <small>({r.basis})</small>
            </li>
          ))}
        </ul>
      </section>
      <details>
        <summary>Review the comparison context</summary>
        <p>
          These are your declarations about the photos. They cannot replace
          missing capture, method, identity or boundary records.
        </p>
        {(
          [
            ["sameView", "Viewpoint and framing"],
            ["season", "Season and growth stage"],
            ["visibility", "Visibility and coverage"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={declarations[key]}
              onChange={(e) =>
                setDeclarations({
                  ...declarations,
                  [key]: e.target.value as (typeof declarations)[typeof key],
                })
              }
            >
              <option value="unknown">Unknown / not reviewed</option>
              <option value="comparable">Comparable in my review</option>
              <option value="different">Different</option>
            </select>
          </label>
        ))}
        <button className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save comparison declarations"}
        </button>
        {saved && (
          <p>
            Saved review: {new Date(saved.reviewedAt!).toLocaleString()}.
            Changes to either observation invalidate the prior declaration.
          </p>
        )}
      </details>
      {message && <p role="status">{message}</p>}
      <ObservationTrend surveys={rows} onOpen={onOpen} />
      <h2>Species observation ledger</h2>
      <p>
        These are taxon records, not tracking of individual plants. “Not
        observed” does not establish removal, death or treatment success.
      </p>
      {result.ledger.length ? (
        <ul>
          {result.ledger.map((row) => (
            <li key={row.taxonKey}>
              <strong>{row.scientificName}</strong> ·{" "}
              {
                {
                  SeenBoth: "Seen in both",
                  NewlyObserved: "Newly observed",
                  NotObserved: "Not observed this time",
                  RecordCorrected: "Record corrected",
                }[row.status]
              }
              <p>{row.explanation}</p>
              <small>
                {row.evidenceLevel} · earlier region IDs:{" "}
                {row.before?.regionIds.join(", ") || "none"} · later region IDs:{" "}
                {row.after?.regionIds.join(", ") || "none"}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No scoped species records are available yet. Review identities and
          yard boundaries in each survey.
        </p>
      )}
      <button className="secondary" onClick={() => window.print()}>
        Print comparison
      </button>
    </section>
  );
}

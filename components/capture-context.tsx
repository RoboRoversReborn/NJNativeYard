"use client";
import { captureTimeInput, captureTimeFromInput } from "@/lib/capture-time";
import { useState } from "react";
import type { Survey } from "@/lib/survey";
import type { ComparisonCaptureContext } from "@/lib/observation-comparison";
export function CaptureContext({
  survey,
  previous,
  onChange,
  actorId,
}: {
  survey: Survey;
  previous: Survey[];
  onChange: (s: Survey) => void;
  actorId: string;
}) {
  const [date, setDate] = useState(
    survey.capture?.capturedAtConfirmed
      ? captureTimeInput(survey.capture.capturedAt)
      : "",
  );
  const [point, setPoint] = useState(
    survey.capture?.photoPointId || "",
  );
  const [pointConfirmed, setPointConfirmed] = useState(!!survey.capture?.photoPointConfirmed);
  const [note, setNote] = useState(survey.observationNote || "");
  const points = [
    ...new Set(
      previous
        .filter(
          (s) => s.areaId === survey.areaId && s.capture?.photoPointConfirmed,
        )
        .map((s) => s.capture!.photoPointId!)
        .filter(Boolean),
    ),
  ];
  function record() {
    const next: ComparisonCaptureContext = {
      ...survey.capture,
      capturedAt: captureTimeFromInput(
        date,
        survey.capture?.capturedAtConfirmed
          ? survey.capture.capturedAt
          : undefined,
      ),
      capturedAtSource: date ? "user-confirmed" : undefined,
      capturedAtConfirmed: !!date,
      photoPointId: point || undefined,
      photoPointConfirmed: !!point.trim() && pointConfirmed,
    };
    const changedAt = new Date().toISOString();
    onChange({
      ...survey,
      capture: next,
      observationNote: note,
      revision: changedAt,
      captureEdits: [
        ...(survey.captureEdits || []),
        { changedAt, actorId, previous: survey.capture || {}, next, note },
      ],
    });
  }
  return (
    <details className="capture-context">
      <summary>{survey.photoPath && !survey.revision ? `Photo details${survey.capture?.photoPointId ? ` · ${survey.capture.photoPointId}` : ""} · Edit` : "Photo date, photo spot and observation note (optional)"}</summary>
      <p>
        Upload time is not the capture date. Confirm only what you know; unknown
        context remains unknown. Stand in the same spot and include the same bed
        and landmarks for repeat photos.
      </p>
      <label>
        When was this photo captured?
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <small>Leave blank if unknown. Uses your browser’s local time.</small>
      </label>
      <label>
        Photo spot (optional)
        <input value={point} aria-label="Photo spot (optional)" maxLength={200} placeholder="Back door facing the fence"
          list={`photo-spots-${survey.id}`}
          onChange={(e) => { setPoint(e.target.value); setPointConfirmed(false); }} />
        <small>Give this spot and direction a memorable name. Repeat photos from the same spot, facing the same direction, help comparisons.</small>
        <datalist id={`photo-spots-${survey.id}`}>
          {points.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </datalist>
      </label>
      <details>
        <summary>Comparison setup (optional)</summary>
        <p>Only confirm a photo spot when you know where you stood and which direction you faced. A name alone does not confirm comparable framing. You can save without setting this up.</p>
        <label><input type="checkbox" checked={pointConfirmed} disabled={!point.trim()}
          onChange={(e) => setPointConfirmed(e.target.checked)} />
          Confirm this photo spot and direction for comparison
        </label>
      </details>
      <label>
        Observation note
        <textarea
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was planted, hidden or changed? Include only what you observed."
        />
      </label>
      <button className="secondary" onClick={record}>
        Apply context to this draft
      </button>
      <p className="micro">
        Save the survey to retain this context. Earlier context edits remain in
        its record; this does not verify plant identity or establish ecological
        improvement.
      </p>
      {!!survey.captureEdits?.length && (
        <details>
          <summary>Context edit history ({survey.captureEdits.length})</summary>
          <ul>
            {survey.captureEdits.map((e, i) => (
              <li key={`${e.changedAt}/${i}`}>
                {new Date(e.changedAt).toLocaleString()} ·{" "}
                {e.actorId === actorId ? "You" : "Prior reviewer"} · capture
                date {e.next.capturedAt || "unknown"} · viewpoint{" "}
                {e.next.photoPointId || "unknown"}
                <p>{e.note}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </details>
  );
}

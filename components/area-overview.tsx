"use client";

import { useState } from "react";
import { ArrowLeft, Camera, ImageOff } from "lucide-react";
import type { Area, Property, RoadTask } from "@/lib/account/repository";
import { savedAssessment, type Survey } from "@/lib/survey";
import { generateAutoYardPlan, planTaskState } from "@/lib/auto-yard-plan";
import { compareObservations } from "@/lib/observation-comparison";
import { ObservationTrend } from "./observation-trend";

export type AreaOverviewProps = {
  property: Property;
  area: Area;
  surveys: Survey[];
  tasks: RoadTask[];
  section?: "overview" | "surveys";
  onOpenSurvey: (survey: Survey) => void;
  onUpload: () => void;
  onOpenPlan: () => void;
  onBack: () => void;
  onSwitchArea: (areaId: string) => void;
};
const time = (value?: string) =>
  value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
function captureLabel(survey: Survey) {
  return time(survey.capture?.capturedAt)
    ? `Captured ${date(survey.capture!.capturedAt!)}${survey.capture?.capturedAtConfirmed ? "" : " · date unconfirmed"}`
    : "Capture date not recorded";
}
function SavedPhoto({ survey, area }: { survey: Survey; area: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="area-record-photo">
      {survey.photo && !failed ? (
        <img
          src={survey.photo}
          alt={`Saved photo of ${area}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="area-photo-unavailable">
          <ImageOff aria-hidden="true" />
          <span>Photo temporarily unavailable</span>
          <small>Your saved analysis remains available.</small>
        </div>
      )}
    </figure>
  );
}

export function AreaOverview({
  property,
  area,
  surveys,
  tasks,
  section = "overview",
  onOpenSurvey,
  onUpload,
  onOpenPlan,
  onBack,
  onSwitchArea,
}: AreaOverviewProps) {
  const areas = property.yard_areas.filter(
    (item) => item.property_id === property.id,
  );
  const belongs =
    area.property_id === property.id &&
    areas.some((item) => item.id === area.id);
  const records = belongs
    ? surveys
        .filter(
          (survey) => survey.source === "upload" && survey.areaId === area.id,
        )
        .sort(
          (a, b) =>
            Number(time(b.createdAt)) - Number(time(a.createdAt)) ||
            b.id.localeCompare(a.id),
        )
    : [];
  const latest = records[0];
  const snapshot = latest?.assessmentHistory?.at(-1);
  const assessment = latest && snapshot ? savedAssessment(latest) : undefined;
  const actionIdentity=(key:string)=>{try{const parts=JSON.parse(key);return Array.isArray(parts)&&parts[0]==="yard-plan-v1"?JSON.stringify(parts.slice(0,-1)):key;}catch{return key;}};
  const activeKeys=new Set(generateAutoYardPlan(property,surveys).map(task=>actionIdentity(task.auto_key!)));
  const scopedTasks = belongs
    ? tasks.filter(
        (task) =>
          task.property_id === property.id && task.yard_area_id === area.id && (!task.auto_key || task.done || activeKeys.has(actionIdentity(task.auto_key))),
      )
    : [];
  const counts = { pending: 0, upcoming: 0, overdue: 0, done: 0 };
  for (const task of scopedTasks) counts[planTaskState(task)]++;
  const previous = records[1];
  const pair =
    latest && previous
      ? compareObservations(
          previous,
          latest,
          latest.comparisonEvidenceHistory?.findLast(
            (e) =>
              e.beforeSurveyId === previous.id && e.afterSurveyId === latest.id,
          ),
        )
      : undefined;
  if (!belongs)
    return (
      <section className="area-overview">
        <h1>Area unavailable</h1>
        <p>Choose an area from this property.</p>
        <button className="garden-button" onClick={onBack}>
          Back to My garden
        </button>
      </section>
    );

  return (
    <div className="my-garden area-overview">
      <nav className="area-breadcrumb" aria-label="Area navigation">
        <button className="garden-link" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          My garden
        </button>
        <span aria-hidden="true">/</span>
        <span>{property.name}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{area.name}</span>
      </nav>
      <header className="garden-heading">
        <div>
          <p className="garden-eyebrow">YOUR SAVED AREA</p>
          <h1>{area.name}</h1>
          <p>
            {property.name} · NJ ZIP {property.zip}
          </p>
        </div>
        {areas.length > 1 && (
          <label className="area-switch">
            Switch area
            <select
              value={area.id}
              onChange={(event) => {
                if (areas.some((item) => item.id === event.target.value))
                  onSwitchArea(event.target.value);
              }}
            >
              {areas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {section === "overview" && (
        <>
          {latest ? (
            <section
              className="area-latest"
              aria-labelledby="area-latest-title"
            >
              <SavedPhoto
                key={latest.photo || latest.id}
                survey={latest}
                area={area.name}
              />
              <div className="area-latest-body">
                <p className="garden-eyebrow">LATEST SAVED OBSERVATION</p>
                <h2 id="area-latest-title">A closer look at {area.name}</h2>
                <p className="area-record-date">{captureLabel(latest)}</p>
                <p className="garden-fine">
                  Record saved{" "}
                  {time(latest.createdAt) ? date(latest.createdAt) : "—"}. This
                  describes the photographed view.
                </p>
                {assessment ? (
                  <>
                    <div className="area-index">
                      <span>Saved composition index</span>
                      <strong>
                        {assessment.score ?? "—"}
                        <small>
                          {assessment.score == null ? "Not available" : "/100"}
                        </small>
                      </strong>
                    </div>
                    <p>
                      {assessment.assessed}/{assessment.total} included regions
                      assessed · {assessment.reviewed}/{assessment.total}{" "}
                      identities reviewed
                    </p>
                    <p>
                      {assessment.assessmentScope === "yard"
                        ? "Confirmed yard regions only"
                        : "Photo estimate · yard boundary unconfirmed"}
                      {assessment.provisional || assessment.scopeProvisional
                        ? " · Review needed"
                        : ""}
                    </p>
                    <p className="garden-fine">
                      Saved assessment from{" "}
                      {time(snapshot!.recordedAt)
                        ? date(snapshot!.recordedAt)
                        : "an unrecorded date"}
                      ; no new analysis has been run.
                    </p>
                  </>
                ) : (
                  <p>
                    No saved assessment snapshot is available for this record.
                    Open the analysis to inspect its saved photo and region
                    records.
                  </p>
                )}
                <div className="garden-actions">
                  <button
                    className="garden-button is-primary"
                    onClick={() => onOpenSurvey(latest)}
                  >
                    Open full analysis
                  </button>
                  <button className="garden-button" onClick={onUpload}>
                    <Camera size={17} aria-hidden="true" />
                    Upload latest photo
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="garden-welcome">
              <Camera size={32} aria-hidden="true" />
              <h2>A starting point for {area.name}</h2>
              <p>
                No saved photos yet. Add a photo to create this area’s first
                observation.
              </p>
              <button className="garden-button is-primary" onClick={onUpload}>
                Add a baseline photo
              </button>
            </section>
          )}
          <div className="area-overview-grid">
            <section
              className="area-panel"
              aria-labelledby="area-progress-title"
            >
              <p className="garden-eyebrow">OBSERVATIONS OVER TIME</p>
              <h2 id="area-progress-title">Your photo record</h2>
              {records.length <= 1 ? (
                <p>
                  {latest
                    ? "One observation establishes a starting record. A change cannot be established from this photo alone."
                    : "A first observation will become your starting record."}
                </p>
              ) : (
                <>
                  <p>
                    {pair?.eligible
                      ? `Saved index difference: ${pair.numericDelta! > 0 ? "+" : ""}${pair.numericDelta} index points. Comparable photos do not establish the cause of a change.`
                      : "Numeric change is withheld. These saved observations do not establish a numeric change. Their values remain separate until comparison evidence is confirmed."}
                  </p>
                  {pair && !pair.eligible && (
                    <details>
                      <summary>Why a change is not shown</summary>
                      <ul>
                        {pair.reasons.map((reason) => (
                          <li key={reason.code}>{reason.message}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <ObservationTrend surveys={records} onOpen={onOpenSurvey} />
                </>
              )}
            </section>
            <section className="area-panel" aria-labelledby="area-plan-title">
              <p className="garden-eyebrow">AREA CHECKLIST</p>
              <h2 id="area-plan-title">Small steps for {area.name}</h2>
              <dl className="area-task-counts" aria-label="Area task counts">
                {(
                  [
                    ["pending", "Pending"],
                    ["upcoming", "Upcoming"],
                    ["overdue", "Overdue"],
                    ["done", "Completed"],
                  ] as const
                ).map(([state, label]) => (
                  <div key={state}>
                    <dt>{label}</dt>
                    <dd>{counts[state]}</dd>
                  </div>
                ))}
              </dl>
              <p className="garden-fine">
                Tasks belong to this area. Completing a task does not change a
                saved observation’s index.
              </p>
              <button className="garden-button" onClick={onOpenPlan}>
                Open area plan
              </button>
            </section>
          </div>
        </>
      )}
      <section
        className="area-history area-panel"
        aria-labelledby="area-history-title"
      >
        <div className="area-history-heading">
          <div>
            <p className="garden-eyebrow">SAVED PHOTOS</p>
            <h2 id="area-history-title">{area.name} history</h2>
          </div>
          {section === "surveys" && (
            <button className="garden-button is-primary" onClick={onUpload}>
              Upload latest photo
            </button>
          )}
        </div>
        {records.length ? (
          <ul>
            {records.map((survey) => (
              <li key={survey.id}>
                <button
                  className="area-history-record"
                  onClick={() => onOpenSurvey(survey)}
                >
                  <SavedPhoto
                    key={survey.photo || survey.id}
                    survey={survey}
                    area={area.name}
                  />
                  <span>
                    <strong>{captureLabel(survey)}</strong>
                    <small>
                      Saved{" "}
                      {time(survey.createdAt)
                        ? date(survey.createdAt)
                        : "date not recorded"}
                    </small>
                    <span>Open saved analysis →</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No saved photo records for this area.</p>
        )}
      </section>
    </div>
  );
}

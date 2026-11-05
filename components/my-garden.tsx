"use client";

import { useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ImageOff,
  MapPin,
  Plus,
  Sprout,
} from "lucide-react";
import type { Property, RoadTask } from "@/lib/account/repository";
import { savedAssessment, type ScoreSnapshot, type Survey } from "@/lib/survey";

export type MyGardenProps = {
  properties: Property[];
  propertyId: string;
  areaId?: string;
  surveys: Survey[];
  tasks: RoadTask[];
  displayName?: string;
  loading?: boolean;
  error?: string;
  onSelectProperty: (propertyId: string) => void;
  onOpenArea: (propertyId: string, areaId: string) => void;
  onOpenSurvey: (survey: Survey) => void;
  onAddPhoto: (propertyId: string, areaId: string) => void;
  onOpenPlan: (propertyId: string, areaId?: string) => void;
  onAddProperty: () => void;
  onAddArea: (propertyId: string) => void;
  onRetry?: () => void;
};

type Assessment = ReturnType<typeof savedAssessment>;
type ReviewedRecord = { survey: Survey; snapshot: ScoreSnapshot };
const timestamp = (value: string) =>
  Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
function recordDate(value: string) {
  return timestamp(value)
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      }).format(new Date(value))
    : "Date not recorded";
}
function needsReview(assessment: Assessment) {
  return (
    assessment.provisional ||
    assessment.scopeProvisional ||
    assessment.assessmentScope !== "yard" ||
    assessment.assessed < assessment.total ||
    assessment.reviewed < assessment.total ||
    !assessment.total
  );
}
function previousReviewed(scans: Survey[]): ReviewedRecord | undefined {
  return scans
    .flatMap((survey) =>
      (survey.assessmentHistory || [])
        .filter(
          (snapshot) =>
            snapshot.total > 0 &&
            snapshot.score !== null &&
            !snapshot.provisional &&
            snapshot.assessmentScope === "yard" &&
            !snapshot.scopeProvisional &&
            snapshot.reviewed >= snapshot.total &&
            snapshot.assessed >= snapshot.total,
        )
        .map((snapshot) => ({ survey, snapshot })),
    )
    .sort(
      (a, b) =>
        timestamp(b.snapshot.recordedAt) - timestamp(a.snapshot.recordedAt),
    )[0];
}
function ScopeLine({
  assessment,
}: {
  assessment: Pick<
    ScoreSnapshot,
    "assessmentScope" | "scope" | "scopeProvisional"
  >;
}) {
  const yard = assessment.assessmentScope === "yard";
  return (
    <p className="garden-scope">
      {yard
        ? "Confirmed yard regions only"
        : "Photo estimate · yard boundary unconfirmed"}
      {assessment.scope
        ? ` · ${assessment.scope.yard} yard / ${assessment.scope.background} background excluded / ${assessment.scope.unconfirmed} boundary unconfirmed`
        : ""}
      {yard && assessment.scopeProvisional
        ? ". Other regions still need a boundary decision."
        : "."}
    </p>
  );
}
function RecordSummary({ survey }: { survey: Survey }) {
  const assessment = savedAssessment(survey);
  const hasSnapshot = Boolean(survey.assessmentHistory?.length);
  return (
    <div className="garden-record-summary">
      <div className="garden-index">
        <span>
          {hasSnapshot
            ? "Saved composition index"
            : "Current reference estimate"}
        </span>
        <strong>
          {assessment.score ?? "—"}
          <small>{assessment.score === null ? "Not available" : "/100"}</small>
        </strong>
      </div>
      <p className="garden-record-counts">
        {assessment.assessed}/{assessment.total} included regions assessed ·{" "}
        {assessment.reviewed}/{assessment.total} identities reviewed
      </p>
      <ScopeLine assessment={assessment} />
      {!hasSnapshot && (
        <p className="garden-fine">
          No immutable assessment snapshot is stored for this record.
        </p>
      )}
    </div>
  );
}
function GardenPhoto({
  src,
  area,
  empty = false,
  onRetry,
}: {
  src?: string;
  area: string;
  empty?: boolean;
  onRetry?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`garden-photo${empty ? " is-empty" : ""}`}>
      {src && !failed ? (
        <>
          <img
            src={src}
            alt={`Your recorded photo of ${area}`}
            onError={() => setFailed(true)}
          />
          <figcaption>Your photo</figcaption>
        </>
      ) : (
        <div className="garden-photo-fallback">
          {empty ? (
            <Camera aria-hidden="true" />
          ) : (
            <ImageOff aria-hidden="true" />
          )}
          <span>
            {empty
              ? "Your first photo goes here"
              : "Photo temporarily unavailable"}
          </span>
          {!empty && (
            <>
              <small>Observation details remain available.</small>
              {onRetry && (
                <button className="garden-link" onClick={onRetry}>
                  Refresh photo access
                </button>
              )}
            </>
          )}
        </div>
      )}
    </figure>
  );
}

export function MyGarden({
  properties,
  propertyId,
  areaId,
  surveys,
  tasks,
  displayName,
  loading = false,
  error,
  onSelectProperty,
  onOpenArea,
  onOpenSurvey,
  onAddPhoto,
  onOpenPlan,
  onAddProperty,
  onAddArea,
  onRetry,
}: MyGardenProps) {
  const property = properties.find((item) => item.id === propertyId);
  const areas = property?.yard_areas || [];
  const allowedAreaIds = new Set(areas.map((area) => area.id));
  const records = surveys
    .filter(
      (survey) =>
        survey.source === "upload" &&
        survey.areaId &&
        allowedAreaIds.has(survey.areaId),
    )
    .sort(
      (a, b) =>
        timestamp(b.createdAt) - timestamp(a.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const areaRecords = areas.map((area) => {
    const scans = records.filter((survey) => survey.areaId === area.id);
    return { area, scans, latest: scans[0], reviewed: previousReviewed(scans) };
  });
  const photographed = areaRecords.filter((item) => item.latest).length;
  const reviewCount = areaRecords.filter(
    (item) => item.latest && needsReview(savedAssessment(item.latest)),
  ).length;
  const preferred = areaRecords.find((item) => item.area.id === areaId);
  const featured =
    preferred ||
    areaRecords.find((item) => item.latest?.id === records[0]?.id) ||
    (areaRecords.length === 1 ? areaRecords[0] : undefined);
  const [photoChoice, setPhotoChoice] = useState({
    propertyId,
    areaId: areaId || (areas.length === 1 ? areas[0].id : ""),
  });
  const selectedPhotoArea =
    photoChoice.propertyId === propertyId
      ? areas.find((area) => area.id === photoChoice.areaId)
      : areas.find((area) => area.id === areaId) ||
        (areas.length === 1 ? areas[0] : undefined);
  const propertyTasks = tasks.filter((task) => task.property_id === propertyId);
  const year = new Date().getFullYear();
  const taskRank = (task: RoadTask) =>
    task.plan_year === year
      ? 0
      : task.plan_year == null
        ? 1
        : task.plan_year < year
          ? 2
          : 3;
  const nextTasks = propertyTasks
    .filter((task) => !task.done)
    .sort(
      (a, b) =>
        taskRank(a) - taskRank(b) ||
        timestamp(a.created_at || a.updated_at) -
          timestamp(b.created_at || b.updated_at),
    )
    .slice(0, 3);
  type Activity = {
    id: string;
    date: string;
    kind: "photo" | "review" | "task";
    title: string;
    area: string;
    survey?: Survey;
    task?: RoadTask;
  };
  const activity: Activity[] = [
    ...records.map((survey) => ({
      id: `photo-${survey.id}`,
      date: survey.createdAt,
      kind: "photo" as const,
      title: "Photo record added",
      area: areas.find((area) => area.id === survey.areaId)!.name,
      survey,
    })),
    ...records.flatMap((survey) =>
      (survey.assessmentHistory || []).map((snapshot, index) => ({
        id: `review-${survey.id}-${index}`,
        date: snapshot.recordedAt,
        kind: "review" as const,
        title: "Assessment record saved",
        area: areas.find((area) => area.id === survey.areaId)!.name,
        survey,
      })),
    ),
    ...propertyTasks.map((task) => ({
      id: `task-${task.id}`,
      date:
        task.done && task.completed_at ? task.completed_at : task.updated_at,
      kind: "task" as const,
      title:
        task.done && task.completed_at
          ? "Task recorded complete"
          : "Plan task updated",
      area: task.yard_area_id
        ? areas.find((area) => area.id === task.yard_area_id)?.name ||
          "Area unavailable"
        : "Whole property",
      task,
    })),
  ]
    .filter((item) => timestamp(item.date) > 0)
    .sort(
      (a, b) =>
        timestamp(b.date) - timestamp(a.date) || a.id.localeCompare(b.id),
    )
    .slice(0, 5);

  return (
    <div className="my-garden" aria-busy={loading}>
      <header className="garden-heading">
        <div>
          <p className="garden-eyebrow">YOUR FIELD JOURNAL</p>
          <h1>My garden.</h1>
          <p>
            {displayName ? `Welcome, ${displayName}. ` : ""}A place for your
            observations and your next small step.
          </p>
        </div>
        <button
          className="garden-quiet"
          disabled={loading}
          onClick={onAddProperty}
        >
          <Plus size={17} aria-hidden="true" />
          Add property
        </button>
      </header>
      {error && (
        <div className="garden-error" role="alert">
          <strong>Your garden could not be refreshed.</strong>
          <p>{error}</p>
          {properties.length > 0 && <p>These are your last loaded records.</p>}
          {onRetry && (
            <button className="garden-button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}
      {loading && !properties.length ? (
        <div className="garden-loading" role="status">
          <Sprout aria-hidden="true" />
          <h2>Loading your garden…</h2>
          <p>Gathering your saved areas and observations.</p>
        </div>
      ) : !properties.length ? (
        !error && (
          <section className="garden-welcome">
            <Sprout aria-hidden="true" size={34} />
            <p className="garden-eyebrow">A PLACE TO BEGIN</p>
            <h2>Give your garden a home.</h2>
            <p>
              Name your property and the first area you’ll photograph again. An
              exact address is not needed.
            </p>
            <button
              className="garden-button is-primary"
              onClick={onAddProperty}
            >
              <Plus size={18} aria-hidden="true" />
              Add your first property
            </button>
          </section>
        )
      ) : (
        <>
          <div className="garden-location-bar">
            {properties.length > 1 ? (
              <label>
                Property
                <select
                  value={property?.id || ""}
                  disabled={loading}
                  onChange={(event) => onSelectProperty(event.target.value)}
                >
                  <option value="" disabled>
                    Choose a property
                  </option>
                  {properties.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              property && (
                <p className="garden-location-name">
                  <MapPin size={18} aria-hidden="true" />
                  <strong>{property.name}</strong>
                  <span>NJ ZIP {property.zip}</span>
                </p>
              )
            )}
            {property && areas.length > 0 && (
              <div className="garden-photo-action">
                {areas.length > 1 ? (
                  <label>
                    Area for new photo
                    <select
                      value={selectedPhotoArea?.id || ""}
                      disabled={loading}
                      onChange={(event) =>
                        setPhotoChoice({
                          propertyId,
                          areaId: event.target.value,
                        })
                      }
                    >
                      <option value="">Choose an area</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>
                    Photo for <strong>{areas[0].name}</strong>
                  </p>
                )}
                <button
                  className="garden-button is-primary"
                  disabled={loading || !selectedPhotoArea}
                  onClick={() =>
                    selectedPhotoArea &&
                    onAddPhoto(property.id, selectedPhotoArea.id)
                  }
                >
                  <Camera size={18} aria-hidden="true" />
                  Add a photo
                </button>
              </div>
            )}
          </div>
          {!property ? (
            <section className="garden-welcome">
              <h2>Choose a property to continue.</h2>
              <p>
                This view doesn’t have an available property selected. Your
                other records stay separate.
              </p>
              {properties.length === 1 && (
                <button
                  className="garden-button"
                  onClick={() => onSelectProperty(properties[0].id)}
                >
                  Open {properties[0].name}
                </button>
              )}
            </section>
          ) : (
            <>
              <ul
                className="garden-overview-counts"
                aria-label="Property record summary"
              >
                <li>
                  <strong>{areas.length}</strong>
                  <span>{areas.length === 1 ? "area" : "areas"}</span>
                </li>
                <li>
                  <strong>{photographed}</strong>
                  <span>with photo records</span>
                </li>
                <li>
                  <strong>{reviewCount}</strong>
                  <span>
                    {reviewCount === 1
                      ? "latest record needs review"
                      : "latest records need review"}
                  </span>
                </li>
              </ul>
              {!areas.length ? (
                <section className="garden-welcome">
                  <Camera size={34} aria-hidden="true" />
                  <h2>Where will you start?</h2>
                  <p>
                    Add an area to {property.name}: a front bed, a side border,
                    or your entire yard. It’s a place you can photograph again.
                  </p>
                  <button
                    className="garden-button is-primary"
                    disabled={loading}
                    onClick={() => onAddArea(property.id)}
                  >
                    <Plus size={18} aria-hidden="true" />
                    Add your first area
                  </button>
                </section>
              ) : (
                <>
                  {featured ? (
                    <section
                      className="garden-continue"
                      aria-labelledby="garden-continue-title"
                    >
                      <GardenPhoto
                        key={featured.latest?.photo || featured.area.id}
                        src={featured.latest?.photo}
                        area={featured.area.name}
                        empty={!featured.latest}
                        onRetry={onRetry}
                      />
                      <div className="garden-continue-body">
                        <p className="garden-eyebrow">
                          CONTINUE WHERE YOU LEFT OFF
                        </p>
                        <h2 id="garden-continue-title">{featured.area.name}</h2>
                        {featured.latest ? (
                          <>
                            <p className="garden-record-date">
                              Newest photo record ·{" "}
                              {recordDate(featured.latest.createdAt)}
                              <span>Capture date not recorded.</span>
                            </p>
                            <span
                              className={`garden-status${needsReview(savedAssessment(featured.latest)) ? " needs-review" : ""}`}
                            >
                              {needsReview(savedAssessment(featured.latest))
                                ? "Review this observation"
                                : "Reviewed yard observation"}
                            </span>
                            <RecordSummary survey={featured.latest} />
                            <div className="garden-actions">
                              <button
                                className="garden-button is-primary"
                                disabled={loading}
                                onClick={() =>
                                  needsReview(savedAssessment(featured.latest))
                                    ? onOpenSurvey(featured.latest)
                                    : onAddPhoto(property.id, featured.area.id)
                                }
                              >
                                {needsReview(savedAssessment(featured.latest))
                                  ? "Review this photo"
                                  : "Repeat this area’s photo"}
                                <ArrowRight size={17} aria-hidden="true" />
                              </button>
                              <button
                                className="garden-link"
                                onClick={() =>
                                  onOpenArea(property.id, featured.area.id)
                                }
                              >
                                Open area
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p>
                              A first photo gives this area a starting record.
                              Include the bed and a few landmarks you can find
                              again.
                            </p>
                            <button
                              className="garden-button is-primary"
                              disabled={loading}
                              onClick={() =>
                                onAddPhoto(property.id, featured.area.id)
                              }
                            >
                              Add a baseline photo
                              <Camera size={18} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </section>
                  ) : (
                    <section className="garden-start-note">
                      <Camera aria-hidden="true" />
                      <div>
                        <h2>Choose an area for your first photo.</h2>
                        <p>
                          Start with a repeatable view. Each area keeps its own
                          observation history.
                        </p>
                      </div>
                    </section>
                  )}
                  <section
                    className="garden-areas"
                    aria-labelledby="garden-areas-title"
                  >
                    <div className="garden-section-heading">
                      <div>
                        <p className="garden-eyebrow">ONE PLACE AT A TIME</p>
                        <h2 id="garden-areas-title">Your areas</h2>
                      </div>
                      <button
                        className="garden-quiet"
                        disabled={loading}
                        onClick={() => onAddArea(property.id)}
                      >
                        <Plus size={17} aria-hidden="true" />
                        Add area
                      </button>
                    </div>
                    <div className="garden-area-grid">
                      {areaRecords.map(({ area, scans, latest, reviewed }) => (
                        <article className="garden-area-card" key={area.id}>
                          <GardenPhoto
                            key={latest?.photo || area.id}
                            src={latest?.photo}
                            area={area.name}
                            empty={!latest}
                            onRetry={onRetry}
                          />
                          <div className="garden-area-content">
                            <h3>{area.name}</h3>
                            {latest ? (
                              <>
                                <p className="garden-record-date">
                                  Newest record · {recordDate(latest.createdAt)}
                                  <span>Capture date not recorded.</span>
                                </p>
                                <RecordSummary survey={latest} />
                                {needsReview(savedAssessment(latest)) &&
                                  reviewed && (
                                    <aside className="garden-reviewed-snapshot">
                                      <p>
                                        <CheckCircle2
                                          size={15}
                                          aria-hidden="true"
                                        />
                                        <strong>
                                          Previous fully reviewed snapshot
                                        </strong>
                                      </p>
                                      <p>
                                        {recordDate(
                                          reviewed.snapshot.recordedAt,
                                        )}{" "}
                                        · {reviewed.snapshot.score}/100
                                      </p>
                                      <p>
                                        {reviewed.snapshot.assessed}/
                                        {reviewed.snapshot.total} included
                                        regions assessed. Historical record, not
                                        the newest result.
                                      </p>
                                      <button
                                        className="garden-link"
                                        onClick={() =>
                                          onOpenSurvey(reviewed.survey)
                                        }
                                      >
                                        Open its photo record
                                      </button>
                                    </aside>
                                  )}
                                <p className="garden-readiness">
                                  {scans.length === 1
                                    ? "One photo record. Repeat the same view to add another observation."
                                    : `${scans.length} photo records to inspect. View, season and method comparability still need checking.`}
                                </p>
                              </>
                            ) : (
                              <p className="garden-empty-copy">
                                No photo records yet. A first view starts this
                                area’s journal.
                              </p>
                            )}
                            <button
                              className="garden-area-open"
                              disabled={loading}
                              onClick={() => onOpenArea(property.id, area.id)}
                              aria-label={`Open area ${area.name}`}
                            >
                              Open area
                              <ArrowRight size={17} aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              )}
              <div className="garden-bottom-grid">
                <section
                  className="garden-next-steps"
                  aria-labelledby="garden-next-title"
                >
                  <div className="garden-section-heading">
                    <div>
                      <p className="garden-eyebrow">YOUR PLAN, AT YOUR PACE</p>
                      <h2 id="garden-next-title">Your next steps</h2>
                    </div>
                    <ClipboardList aria-hidden="true" size={23} />
                  </div>
                  <p className="garden-section-intro">
                    Open tasks for {property.name}, with this year’s tasks
                    first.
                  </p>
                  {nextTasks.length ? (
                    <ol className="garden-next-list">
                      {nextTasks.map((task) => (
                        <li key={task.id}>
                          <span
                            className="garden-task-dot"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="garden-task-area">
                              {task.yard_area_id
                                ? areas.find(
                                    (area) => area.id === task.yard_area_id,
                                  )?.name || "Area unavailable"
                                : "Whole property"}
                            </span>
                            <button
                              className="garden-task-title"
                              onClick={() =>
                                onOpenPlan(
                                  property.id,
                                  allowedAreaIds.has(task.yard_area_id || "")
                                    ? task.yard_area_id!
                                    : undefined,
                                )
                              }
                            >
                              {task.title}
                            </button>
                            <span className="garden-task-timing">
                              {task.plan_year ?? "Undated backlog"}
                              {task.season ? ` · ${task.season}` : ""}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="garden-small-empty">
                      <Sprout aria-hidden="true" />
                      <p>
                        No open tasks yet. Keep an observation to revisit, or
                        plan a small change.
                      </p>
                    </div>
                  )}
                  <p className="garden-fine">
                    Task completion records your work. It doesn’t increase an
                    observation’s index.
                  </p>
                  <button
                    className="garden-button"
                    disabled={loading}
                    onClick={() => onOpenPlan(property.id)}
                  >
                    Open yard plan
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </section>
                <section
                  className="garden-recent"
                  aria-labelledby="garden-recent-title"
                >
                  <div className="garden-section-heading">
                    <div>
                      <p className="garden-eyebrow">THE DATED RECORD</p>
                      <h2 id="garden-recent-title">Recent activity</h2>
                    </div>
                    <Clock3 aria-hidden="true" size={23} />
                  </div>
                  {activity.length ? (
                    <ol className="garden-activity-list">
                      {activity.map((item) => (
                        <li key={item.id}>
                          <span
                            className={`garden-activity-icon ${item.kind}`}
                            aria-hidden="true"
                          >
                            {item.kind === "photo" ? (
                              <Camera size={16} />
                            ) : item.kind === "review" ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <ClipboardList size={16} />
                            )}
                          </span>
                          <div>
                            <strong>{item.title}</strong>
                            <span>
                              {item.area}
                              {item.task ? ` · ${item.task.title}` : ""}
                            </span>
                            <time dateTime={item.date}>
                              {recordDate(item.date)}
                            </time>
                            {item.survey ? (
                              <button
                                className="garden-link"
                                onClick={() => onOpenSurvey(item.survey!)}
                              >
                                Open photo record
                              </button>
                            ) : (
                              <button
                                className="garden-link"
                                onClick={() =>
                                  onOpenPlan(
                                    property.id,
                                    item.task?.yard_area_id &&
                                      allowedAreaIds.has(item.task.yard_area_id)
                                      ? item.task.yard_area_id
                                      : undefined,
                                  )
                                }
                              >
                                Open yard plan
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="garden-empty-copy">
                      Saved photos, assessment records and dated plan updates
                      will appear here.
                    </p>
                  )}
                </section>
              </div>
              <details className="garden-explanation">
                <summary>How to read this garden journal</summary>
                <p>
                  Each area keeps its own dated photos, reviewed matches and planned work. Open a saved observation to explore its plants or revisit the same view to track changes.
                </p>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}

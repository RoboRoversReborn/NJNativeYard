"use client";
import { useRef, useState } from "react";
import type { AppUser as User } from "@/lib/firebase/auth-user";
import { ArrowRight, Check, Plus, Sprout, TreeDeciduous } from "lucide-react";
import {
  scanComparison,
  catalog,
  plantById,
  savedAssessment,
  type Survey,
  type ScoreSnapshot,
} from "@/lib/survey";
import type { Property, RoadTask } from "@/lib/account/repository";
import * as accountRepository from "@/lib/account/repository";
import { nativePlantingOption } from "@/lib/nj-evidence";
import { generateAutoYardPlan, planTaskState, njDate } from "@/lib/auto-yard-plan";
import { EmailSignIn } from "./email-sign-in";
import { QaSignIn } from "./qa-sign-in";
import { compareObservations } from "@/lib/observation-comparison";
import { TaskEventHistory } from "./task-event-history";
import { loadTaskEvents, type TaskStage } from "@/lib/account/task-events";
export function SignIn({
  qaConfigured = false,
  emailConfigured = false,
  emailDeliveryRestricted = false,
  onSendEmailCode,
  onVerifyEmailCode,
  configured,
  onSignIn,
  onScan,
  busy,
  returnToSurvey,
}: {
  returnToSurvey?: () => void;
  qaConfigured?: boolean;
  emailConfigured?: boolean;
  emailDeliveryRestricted?: boolean;
  onSendEmailCode?: (email: string) => Promise<void>;
  onVerifyEmailCode?: (email: string, token: string) => Promise<void>;
  configured: boolean;
  onSignIn: () => void;
  onScan: () => void;
  busy: boolean;
}) {
  const emailAvailable = Boolean(
    emailConfigured && onSendEmailCode && onVerifyEmailCode,
  );
  return (
    <section className="signin-page">
      <div className="signin-art">
        <Sprout size={44} />
        <h1>
          A little care.
          <br />A longer story.
        </h1>
        <p>
          {configured || emailAvailable || qaConfigured
            ? "Give your surveys a home, name your yard areas, and make a plan for what comes next."
            : "A photo, a closer look, a new idea. You can explore your yard without an account."}
        </p>
        <img
          src="/images/home-garden.webp"
          alt="Garden with layered planting"
        />
      </div>
      <div className="signin-content">
        <p className="eyebrow">YOUR OPTIONAL NATIVEYARD ACCOUNT</p>
        <h2>
          {configured || emailAvailable || qaConfigured
            ? "Let’s keep it growing."
            : "Your NativeYard profile."}
        </h2>
        <p>
          {configured || emailAvailable || qaConfigured
            ? "Sign in to save your properties, photos and plant reviews. Your yard plan keeps planned changes and completed tasks alongside your real survey history."
            : "Account sign-in is not available yet. You can still explore samples, scan plants, compare matches and print a report to keep a copy."}
        </p>
        {configured && (
          <button
            className="primary google-button"
            disabled={busy}
            onClick={onSignIn}
          >
            <strong>G</strong> Continue with Google <ArrowRight size={18} />
          </button>
        )}
        {emailConfigured && onSendEmailCode && onVerifyEmailCode && (
          <>
            {emailDeliveryRestricted && (
              <p className="notice">
                Email verification is currently limited to approved test
                addresses. Google sign-in is also available.
              </p>
            )}
            <EmailSignIn
              onSendEmailCode={onSendEmailCode}
              onVerifyEmailCode={onVerifyEmailCode}
              busy={busy}
            />
          </>
        )}
        {qaConfigured && <QaSignIn busy={busy} />}
        {returnToSurvey && (
          <button className="secondary" onClick={returnToSurvey}>
            Return to my survey
          </button>
        )}
        <button className="text-button" onClick={onScan}>
          Keep exploring without an account →
        </button>
        <p className="micro">
          Scanning, reviewing matches, and exploring native alternatives do not
          require sign-in.
        </p>
      </div>
    </section>
  );
}
export function Scope({
  properties,
  propertyId,
  areaId,
  onProperty,
  onArea,
  allAreas = false,
  locked = false,
}: {
  properties: Property[];
  propertyId: string;
  areaId: string;
  onProperty: (id: string) => void;
  onArea: (id: string) => void;
  allAreas?: boolean;
  locked?: boolean;
}) {
  const property = properties.find((p) => p.id === propertyId);
  return (
    <div className="scope-bar">
      <label>
        Property
        <select
          value={propertyId}
          disabled={locked}
          onChange={(e) => onProperty(e.target.value)}
        >
          <option value="" disabled>
            Select property
          </option>
          {properties.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Yard area
        <select
          value={areaId}
          disabled={locked}
          onChange={(e) => onArea(e.target.value)}
        >
          <option value="">
            {allAreas ? "Whole property" : "Select yard area"}
          </option>
          {property?.yard_areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {locked && (
        <small>This saved survey stays with its original yard area.</small>
      )}
    </div>
  );
}
export function PropertiesView({
  section,
  initialAdding,
  onCompare,
  properties,
  propertyId,
  areaId,
  surveys,
  onOpen,
  onScan,
  onScanArea,
  onScopeCreated,
  onRoadmap,
  onRefresh,
  onError,
  repository = accountRepository,
}: {
  section?: "overview" | "surveys";
  initialAdding?: "property" | "area";
  onCompare?: () => void;
  repository?: typeof accountRepository;
  properties: Property[];
  propertyId: string;
  areaId: string;
  surveys: Survey[];
  onOpen: (s: Survey) => void;
  onScan: () => void;
  onScanArea?: (areaId: string) => void;
  onScopeCreated?: (propertyId: string, areaId?: string) => void;
  onRoadmap: () => void;
  onRefresh: () => Promise<unknown>;
  onError: (s: string) => void;
}) {
  const [adding, setAdding] = useState<"property" | "area" | null>(
      initialAdding || null,
    ),
    [name, setName] = useState(""),
    [zip, setZip] = useState(""),
    [busy, setBusy] = useState(false),
    [renameTarget, setRenameTarget] = useState<{
      kind: "property" | "area";
      id: string;
    } | null>(null);
  const [firstArea, setFirstArea] = useState("Front bed"),
    [propertyOnly, setPropertyOnly] = useState(false);
  const [propertyStep, setPropertyStep] = useState(false);
  const creation = useRef<{ property?: string; area?: string }>({});
  const creating = useRef(false);
  const property = properties.find((p) => p.id === propertyId),
    areas = property?.yard_areas || [];
  const areaIds = new Set(areas.map((a) => a.id));
  const history = surveys.filter(
    (s) =>
      s.areaId && areaIds.has(s.areaId) && (!areaId || s.areaId === areaId),
  );
  const timeline = areaId ? scanComparison(surveys, areaId) : [];
  const comparison =
    timeline.length >= 2
      ? compareObservations(timeline[0].survey, timeline.at(-1)!.survey)
      : null;
  const comparableTimeline = comparison?.eligible === true;
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    try {
      let createdProperty: string | undefined, createdArea: string | undefined;
      if (renameTarget) {
        if (renameTarget.kind === "property")
          await repository.renameProperty(renameTarget.id, name.trim());
        else await repository.renameArea(renameTarget.id, name.trim());
      } else if (adding === "property") {
        if (!/^0[78]\d{3}$/.test(zip))
          throw new Error("Enter a New Jersey ZIP code.");
        creation.current.property ||= crypto.randomUUID();
        createdProperty = await repository.addProperty(
          name.trim(),
          zip,
          creation.current.property,
        );
        setPropertyStep(true);
        if (!propertyOnly) {
          creation.current.area ||= crypto.randomUUID();
          createdArea = await repository.addArea(
            createdProperty,
            firstArea.trim(),
            creation.current.area,
          );
        }
      } else createdArea = await repository.addArea(propertyId, name.trim());
      await onRefresh();
      if (createdProperty) onScopeCreated?.(createdProperty, createdArea);
      else if (createdArea) onScopeCreated?.(propertyId, createdArea);
      creation.current = {};
      setPropertyStep(false);
      setAdding(null);
      setRenameTarget(null);
      setName("");
      setZip("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not create this item.");
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR HOME FOR SMALL CHANGES</p>
          <h1>My properties.</h1>
          <p>One yard area at a time. Every survey adds to the story.</p>
        </div>
        <button className="primary" onClick={onScan}>
          Scan a plant or yard
        </button>
      </div>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => {
            setAdding("property");
            setRenameTarget(null);
            setName("");
          }}
        >
          <Plus size={16} /> Add property
        </button>
        <button
          className="secondary"
          disabled={!propertyId}
          onClick={() => {
            setAdding("area");
            setRenameTarget(null);
            setName("");
          }}
        >
          <Plus size={16} /> Add yard area
        </button>
        <button
          className="secondary"
          disabled={!propertyId}
          onClick={onRoadmap}
        >
          Open your yard plan →
        </button>
      </div>
      {property && (
        <div className="actions">
          <strong>{property.name}</strong>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setRenameTarget({ kind: "property", id: property.id });
              setAdding("property");
              setName(property.name);
            }}
          >
            Rename property
          </button>
        </div>
      )}
      {areaId && onCompare && (
        <button className="secondary" onClick={onCompare}>
          Compare area observations
        </button>
      )}
      {adding && (
        <form className="inline-form" onSubmit={create}>
          <h3>
            {renameTarget
              ? `Rename ${renameTarget.kind === "property" ? "property" : "yard area"}`
              : adding === "property"
                ? "Name a property"
                : "Name a yard area"}
          </h3>
          <label>
            Name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={adding === "property" ? "My home" : "Front garden"}
            />
          </label>
          {adding === "property" && !renameTarget && (
            <label>
              NJ ZIP code
              <input
                required
                inputMode="numeric"
                pattern="0[78][0-9]{3}"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </label>
          )}
          {adding === "property" && !renameTarget && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={propertyOnly}
                  disabled={busy || propertyStep}
                  onChange={(e) => setPropertyOnly(e.target.checked)}
                />{" "}
                Add property only
              </label>
              {!propertyOnly && (
                <label>
                  Name the first area
                  <input
                    required
                    value={firstArea}
                    maxLength={100}
                    onChange={(e) => setFirstArea(e.target.value)}
                  />
                  <small>
                    A place you’ll photograph again, such as Front bed.
                  </small>
                </label>
              )}
              {propertyStep && (
                <p className="notice">
                  The property step is already recorded. Retry finishes this
                  same property and area.
                </p>
              )}
            </>
          )}
          <div className="actions">
            <button className="primary" disabled={busy || !name.trim()}>
              {renameTarget ? "Save name" : `Create ${adding}`}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                creation.current = {};
                setPropertyStep(false);
                setAdding(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!properties.length ? (
        <div className="empty-state">
          <TreeDeciduous size={36} />
          <h2>Your first property starts here.</h2>
          <p>
            Add your home, then name a yard area such as “Front garden” to give
            surveys a consistent place.
          </p>
        </div>
      ) : (
        <>
          <div className="zone-grid" hidden={section === "surveys"}>
            {areas.map((a) => {
              const scans = surveys.filter((s) => s.areaId === a.id);
              const latest = scans[0];
              return (
                <article className="zone-card" key={a.id}>
                  <Sprout />
                  <h3>{a.name}</h3>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setRenameTarget({ kind: "area", id: a.id });
                      setAdding("area");
                      setName(a.name);
                    }}
                  >
                    Rename {a.name}
                  </button>
                  <p>
                    {scans.length} saved survey{scans.length === 1 ? "" : "s"}
                  </p>
                  {latest ? (
                    <>
                      <p>
                        Latest: {date(latest.createdAt)} ·{" "}
                        {savedAssessment(latest).score ?? "—"}/100{" "}
                        {savedAssessment(latest).provisional
                          ? "provisional"
                          : "reviewed identities"}
                      </p>
                      <AssessmentScopeNote
                        assessment={savedAssessment(latest)}
                        source={latest.source}
                      />
                      <button
                        className="text-button"
                        onClick={() => onOpen(latest)}
                      >
                        Open latest survey →
                      </button>
                    </>
                  ) : (
                    <p className="micro">Ready for your baseline photo.</p>
                  )}
                  {onScanArea && (
                    <button
                      className="secondary"
                      onClick={() => onScanArea(a.id)}
                    >
                      {latest
                        ? "Repeat this area’s photo"
                        : "Add baseline photo"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {!areas.length && (
            <p className="notice">
              Add a yard area to save surveys to {property?.name}.
            </p>
          )}
          <section className="account-section" hidden={section === "overview"}>
            <h2>Your ecosystem over time.</h2>
            <p>
              Every saved scan in this yard area adds a dated ecosystem
              estimate. Scan again after a change, or revisit the same view
              through the seasons. Updated plant references or corrected
              identities can also change an estimate.
            </p>
            {timeline.length ? (
              <>
                <p className="notice">
                  First saved observation: {date(timeline[0].survey.createdAt)}{" "}
                  · {timeline[0].score ?? "—"}/100. This is the earliest saved
                  photo for this area. Select a baseline to track a comparable
                  view.
                </p>
                <AssessmentScopeNote
                  assessment={timeline[0]}
                  source={timeline[0].survey.source}
                />
                <div className="scan-timeline">
                  {timeline.map((a) => (
                    <article key={a.survey.id}>
                      <span className="eyebrow">
                        {date(a.survey.createdAt)}
                      </span>
                      <strong>
                        {a.score ?? "—"}
                        <small>/100</small>
                      </strong>
                      <span
                        className={`assessment-state ${a.provisional ? "provisional" : "reviewed"}`}
                      >
                        {a.provisional ? "Provisional" : "Reviewed identities"}
                      </span>
                      <AssessmentScopeNote
                        assessment={a}
                        source={a.survey.source}
                      />
                      <p>
                        {a.coverage}% assessed · {a.reviewed}/{a.total} reviewed
                      </p>
                      <button
                        className="text-button"
                        onClick={() => onOpen(a.survey)}
                      >
                        Open this scan →
                      </button>
                    </article>
                  ))}
                </div>
                {timeline.length >= 2 && !comparableTimeline && (
                  <p className="notice">
                    Numeric change is withheld:{" "}
                    {comparison?.reasons.map((r) => r.message).join(" ")}
                  </p>
                )}
                {comparableTimeline &&
                  timeline[0].score !== null &&
                  timeline.at(-1)!.score !== null && (
                    <p className="notice">
                      Estimate change:{" "}
                      {timeline.at(-1)!.score! - timeline[0].score! >= 0
                        ? "+"
                        : ""}
                      {timeline.at(-1)!.score! - timeline[0].score!} points
                      since {date(timeline[0].survey.createdAt)}. Match
                      corrections, coverage, yard-boundary choices and photo
                      framing can change the estimate; use a similar view for
                      useful comparisons.
                    </p>
                  )}
              </>
            ) : (
              <div className="empty-inline">
                {!areaId
                  ? "Choose a yard area to compare its scans."
                  : "Save your first real-photo scan here to start your ecosystem timeline. Samples do not count."}
              </div>
            )}
          </section>
          <section className="account-section" hidden={section === "overview"}>
            <h2>Survey history.</h2>
            {!history.length ? (
              <p className="empty-inline">
                No saved surveys in this scope yet.
              </p>
            ) : (
              <div className="history-grid">
                {history.map((s) => (
                  <article key={s.id}>
                    <SavedSurveyPhoto key={s.photo} photo={s.photo} />
                    <div>
                      <p className="eyebrow">
                        {areas.find((a) => a.id === s.areaId)?.name}
                      </p>
                      <h3>{date(s.createdAt)}</h3>
                      <p className="history-score">
                        {savedAssessment(s).score ?? "—"}
                        <small>/100</small>{" "}
                        <span>
                          {savedAssessment(s).provisional
                            ? "Provisional"
                            : "Reviewed identities"}
                        </span>
                      </p>
                      <AssessmentScopeNote
                        assessment={savedAssessment(s)}
                        source={s.source}
                      />
                      <p>
                        {savedAssessment(s).coverage}% assessed ·{" "}
                        {savedAssessment(s).reviewed}/{s.plants.length} reviewed
                        ·{" "}
                        {s.source === "sample"
                          ? "Illustrative sample"
                          : "Uploaded photo"}
                      </p>
                      {!!s.assessmentHistory?.length && (
                        <details className="saved-score-updates">
                          <summary>
                            Saved score updates ({s.assessmentHistory.length})
                          </summary>
                          {s.assessmentHistory.map((snapshot, i) => (
                            <div key={`${snapshot.recordedAt}-${i}`}>
                              <p>
                                {date(snapshot.recordedAt)} ·{" "}
                                {snapshot.score ?? "—"}/100 ·{" "}
                                {snapshot.coverage}% assessed ·{" "}
                                {snapshot.provisional
                                  ? "Provisional"
                                  : "Reviewed identities"}
                              </p>
                              <AssessmentScopeNote
                                assessment={snapshot}
                                source={s.source}
                              />
                            </div>
                          ))}
                        </details>
                      )}
                      <button className="secondary" onClick={() => onOpen(s)}>
                        Open survey
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
export function RoadmapView({
  property,
  planError,
  onRetry,
  onScan,
  loadEvents = loadTaskEvents,
  surveys = [],
  onOpenSurvey,
  propertyId,
  areaId,
  tasks,
  onRefresh,
  onError,
  busy: parentBusy,
  repository = accountRepository,
}: {
  property?: Property;
  planError?: string | null;
  onRetry?: () => void;
  onScan?: () => void;
  loadEvents?: typeof loadTaskEvents;
  repository?: typeof accountRepository;
  surveys?: Survey[];
  onOpenSurvey?: (survey: Survey) => void;
  propertyId: string;
  areaId: string;
  tasks: RoadTask[];
  onRefresh: () => Promise<unknown>;
  onError: (s: string) => void;
  busy: boolean;
}) {
  const [year, setYear] = useState(Number(njDate().slice(0,4)));
  const scopedSurveys = property
    ? surveys.filter((s) =>
        property.yard_areas.some((area) => area.id === s.areaId),
      )
    : surveys;
  const autoIdentity = (key: string) => {
    try {
      const parts: unknown = JSON.parse(key);
      return Array.isArray(parts) && parts[0] === "yard-plan-v1"
        ? JSON.stringify(parts.slice(0, -1))
        : key;
    } catch {
      return key;
    }
  };
  const currentAutoKeys = property
    ? new Set(
        generateAutoYardPlan(property, surveys).map((t) =>
          autoIdentity(t.auto_key!),
        ),
      )
    : null;
  const scopeTasks = tasks.filter(
    (t) =>
      t.property_id === propertyId &&
      (!areaId || t.yard_area_id === areaId) &&
      (!currentAutoKeys ||
        !t.auto_key ||
        t.done ||
        year < Number(njDate().slice(0,4)) ||
        currentAutoKeys.has(autoIdentity(t.auto_key))),
  );
  const scoped = scopeTasks.filter(
    (t) =>
      t.plan_year == null ||
      t.plan_year === year ||
      (t.plan_year < year && !t.done) ||
      (year === Number(njDate().slice(0,4)) &&
        Boolean(t.auto_key) &&
        t.plan_year === year + 1),
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const statuses = ["all", "done", "pending", "upcoming", "overdue"] as const;
  const statusNames = {
    all: "All",
    done: "Done",
    pending: "Pending",
    upcoming: "Upcoming",
    overdue: "Overdue",
  };
  const now = new Date();
  const counts = {
    all: scoped.length,
    done: scoped.filter((t) => planTaskState(t, now) === "done").length,
    pending: scoped.filter((t) => planTaskState(t, now) === "pending").length,
    upcoming: scoped.filter((t) => planTaskState(t, now) === "upcoming").length,
    overdue: scoped.filter((t) => planTaskState(t, now) === "overdue").length,
  };
  const visibleTasks = scoped.filter(
    (t) => statusFilter === "all" || planTaskState(t, now) === statusFilter,
  );
  const annual = scopeTasks.filter((t) => t.plan_year === year);
  const stages: TaskStage[] = ["Review", "Plan", "Do", "Revisit"];
  const stageOf = (task: RoadTask): TaskStage => task.stage || "Plan";
  const years = [
    ...new Set([
      Number(njDate().slice(0,4)),
      Number(njDate().slice(0,4)) - 1,
      Number(njDate().slice(0,4)) + 1,
      ...scopeTasks.flatMap((t) => (t.plan_year == null ? [] : [t.plan_year])),
      ...scopedSurveys
        .filter(
          (s) => s.source === "upload" && (!areaId || s.areaId === areaId),
        )
        .map((s) => new Date(s.createdAt).getFullYear())
        .filter(Number.isFinite),
    ]),
  ].sort((a, b) => b - a);
  const linkedSurveys = scopedSurveys.filter(
    (s) => s.source === "upload" && (!areaId || s.areaId === areaId),
  );
  const [editing, setEditing] = useState<Partial<RoadTask> | null>(null);
  const editingArea = editing?.id ? editing.yard_area_id : areaId || null;
  const editingSurveyOptions = linkedSurveys.filter(
    (s) => !editingArea || s.areaId === editingArea,
  );
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.title?.trim()) return;
    setBusy(true);
    try {
      await repository.putTask({
        ...editing,
        id: editing.id,
        property_id: propertyId,
        yard_area_id: editing.id
          ? editing.yard_area_id || null
          : areaId || null,
        title: editing.title.trim(),
        notes: editing.notes || "",
        replacement_id: editing.replacement_id || null,
        done: editing.done || false,
        plan_year: editing.plan_year ?? null,
        stage: editing.stage || "Plan",
        season: editing.season ?? null,
        completed_at: editing.completed_at ?? null,
        survey_id: editing.survey_id ?? null,
      });
      await onRefresh();
      setEditing(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Task could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(t: RoadTask) {
    setBusy(true);
    try {
      await repository.putTask({
        ...t,
        done: !t.done,
        completed_at: t.done ? null : new Date().toISOString(),
      });
      await onRefresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not update task.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FROM A LITTLE KNOWLEDGE TO A LITTLE ACTION</p>
          <h1>Your yard plan.</h1>
          <p>
            A checklist from your saved observations and current plant guidance.
            Review uncertain matches first, then work through supported actions
            at your own pace.
          </p>
        </div>
        <button
          className="primary"
          disabled={!propertyId || busy || parentBusy}
          onClick={() =>
            setEditing({
              title: "",
              notes: "",
              replacement_id: null,
              done: false,
              plan_year: year,
              stage: "Plan",
              season: "Any season",
              completed_at: null,
              survey_id: null,
            })
          }
        >
          <Plus size={17} /> Add task
        </button>
      </div>
      <label>
        Plan year
        <select
          aria-label="Plan year"
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            setEditing(null);
          }}
        >
          {years.map((y) => (
            <option value={y} key={y}>
              {y}
              {y === Number(njDate().slice(0,4)) ? " · this year" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="roadmap-progress">
        <strong>
          {annual.filter((t) => t.done).length} of {annual.length} tasks
          complete
        </strong>
        <progress
          value={annual.filter((t) => t.done).length}
          max={annual.length || 1}
          aria-label={`${year} plan completion`}
        />
        <p>
          {year} plan · Undated backlog tasks stay visible below and are not
          counted in this year’s progress. Unfinished earlier-year tasks also
          stay visible and are excluded from this progress count.
        </p>
        <p>
          Task completion tracks your work. New photo surveys help estimate
          changes in observed plant mix.
        </p>
      </div>
      {!propertyId && (
        <p className="notice">
          Create a property first to give your yard plan a home.
        </p>
      )}
      {planError && (
        <div className="notice" role="alert">
          <p>{planError}</p>
          {onRetry && (
            <button
              className="secondary"
              disabled={busy || parentBusy}
              onClick={onRetry}
            >
              Retry yard plan
            </button>
          )}
        </div>
      )}
      <nav className="yard-plan-filters" aria-label="Task status filters">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            {statusNames[status]} <strong>{counts[status]}</strong>
          </button>
        ))}
      </nav>
      <p className="micro yard-plan-scope" role="status">
        Showing {visibleTasks.length} of {counts.all} tasks in this property
        {areaId ? " and yard area" : ""} for {year}, including undated and
        unfinished earlier work, plus next year’s automatically planned work.{" "}
        Pending tasks are ready or unscheduled. Upcoming and overdue require a
        recorded date window; undated tasks are never overdue.
      </p>
      {propertyId && !linkedSurveys.length && (
        <div className="notice">
          <strong>Start with a saved photo scan.</strong>
          <p>
            Scan this {areaId ? "yard area" : "property"} and save the
            observation to create a plan from the plants you observed.
          </p>
          {onScan && (
            <button className="secondary" onClick={onScan}>
              Scan this area
            </button>
          )}
        </div>
      )}
      {editing && (
        <form onSubmit={save} className="inline-form">
          <h3>{editing.id ? "Edit your task" : "A new small change"}</h3>
          <label>
            Task
            <input
              required
              maxLength={200}
              value={editing.title || ""}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
            />
          </label>
          <label>
            Task year
            <select
              aria-label="Task year"
              value={editing.plan_year ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  plan_year: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Undated backlog</option>
              {years.map((y) => (
                <option value={y} key={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stage
            <select
              value={editing.stage || "Plan"}
              onChange={(e) =>
                setEditing({ ...editing, stage: e.target.value as TaskStage })
              }
            >
              {stages.map((stage) => (
                <option value={stage} key={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season
            <select
              value={editing.season ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  season: (e.target.value || null) as RoadTask["season"],
                })
              }
            >
              <option value="">Not scheduled</option>
              {["Spring", "Summer", "Autumn", "Winter", "Any season"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          {!!editingSurveyOptions.length && (
            <label>
              Related observation
              <select
                value={editing.survey_id ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, survey_id: e.target.value || null })
                }
              >
                <option value="">No linked scan</option>
                {editingSurveyOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {date(s.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Planned native replacement
            <select
              value={editing.replacement_id || ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  replacement_id: e.target.value || null,
                })
              }
            >
              <option value="">No replacement selected</option>
              {catalog.filter(nativePlantingOption).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.commonName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <textarea
              value={editing.notes || ""}
              maxLength={4000}
              onChange={(e) =>
                setEditing({ ...editing, notes: e.target.value })
              }
              placeholder="Timing, supplies, planting conditions, or follow-up observations"
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy || parentBusy}>
              Save task
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {stages.map((stage) => {
        const stageTasks = visibleTasks.filter(
          (task) => stageOf(task) === stage,
        );
        if (!stageTasks.length) return null;
        return (
          <section
            className="task-stage-group"
            aria-label={`${stage} tasks`}
            key={stage}
          >
            <h2>
              {stage}{" "}
              <small>
                {stageTasks.length} task{stageTasks.length === 1 ? "" : "s"}
              </small>
            </h2>
            <div className="task-list">
              {stageTasks.map((t) => (
                <article key={t.id} className={t.done ? "done" : ""}>
                  <button
                    className="task-check"
                    disabled={busy || parentBusy}
                    aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
                    aria-pressed={t.done}
                    onClick={() => toggle(t)}
                  >
                    {t.done && <Check size={18} />}
                  </button>
                  <div>
                    <span className="eyebrow">
                      {t.yard_area_id
                        ? "YARD AREA TASK"
                        : "WHOLE PROPERTY TASK"}
                    </span>
                    <h3>{t.title}</h3>
                    <p className="yard-plan-state">
                      <strong>{statusNames[planTaskState(t, now)]}</strong>
                      {t.auto_key && (
                        <span>
                          {" "}
                          ·{" "}
                          {stageOf(t) === "Review"
                            ? "Review needed before action"
                            : "From plant guidance"}
                        </span>
                      )}
                    </p>
                    {t.due_start || t.due_end ? (
                      <p className="micro">
                        Suggested window: {t.due_start || "Start not set"} –{" "}
                        {t.due_end || "End not set"}
                      </p>
                    ) : (
                      <p className="micro">Timing not scheduled</p>
                    )}
                    {t.source_details && (
                      <p className="yard-plan-source">{t.source_details}</p>
                    )}
                    <p className="micro">
                      {t.plan_year ?? "Undated backlog"}
                      {t.season ? ` · ${t.season}` : ""}
                    </p>
                    <p className="task-backlog-label">
                      {t.plan_year == null
                        ? "Undated backlog"
                        : t.plan_year < year
                          ? `Earlier-year unfinished backlog · ${t.plan_year}`
                          : t.plan_year > year
                            ? `Next-year plan · ${t.plan_year}`
                            : `Selected-year plan · ${year}`}
                      {t.stage == null
                        ? " · Stage not recorded; grouped with Plan"
                        : ""}
                    </p>
                    {t.survey_id &&
                      onOpenSurvey &&
                      linkedSurveys.some((s) => s.id === t.survey_id) && (
                        <button
                          className="text-button"
                          onClick={() =>
                            onOpenSurvey(
                              linkedSurveys.find((s) => s.id === t.survey_id)!,
                            )
                          }
                        >
                          Revisit linked observation →
                        </button>
                      )}
                    {t.replacement_id && (
                      <p>
                        <Sprout size={15} /> Planned:{" "}
                        {plantById(t.replacement_id)?.commonName ||
                          t.replacement_id}
                      </p>
                    )}
                    <p className="task-notes">
                      {t.notes || "Add notes to keep the details in one place."}
                    </p>
                    <small>
                      {t.done
                        ? t.completed_at
                          ? `Completed ${date(t.completed_at)}`
                          : "Completed · date not recorded"
                        : "Planned"}{" "}
                      · updated {date(t.updated_at)}
                    </small>
                    <TaskEventHistory
                      propertyId={t.property_id}
                      taskId={t.id}
                      title={t.title}
                      version={t.updated_at}
                      loadEvents={loadEvents}
                    />
                  </div>
                  <button
                    className="secondary"
                    disabled={busy || parentBusy}
                    onClick={() => setEditing(t)}
                  >
                    Edit
                  </button>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {!!scoped.length && !visibleTasks.length && (
        <p className="empty-inline">No {statusFilter} tasks in this scope.</p>
      )}
      {onOpenSurvey && (
        <section className="account-section">
          <h2>{year} observations</h2>
          <p>Revisit saved real-photo scans alongside this year’s work.</p>
          {linkedSurveys.filter(
            (s) => new Date(s.createdAt).getFullYear() === year,
          ).length ? (
            <div className="history-grid">
              {linkedSurveys
                .filter((s) => new Date(s.createdAt).getFullYear() === year)
                .map((s) => (
                  <article key={s.id}>
                    <div>
                      <h3>{date(s.createdAt)}</h3>
                      <p>
                        Observed estimate: {savedAssessment(s).score ?? "—"}/100
                        ·{" "}
                        {savedAssessment(s).provisional
                          ? "Provisional"
                          : "Reviewed identities"}
                      </p>
                      <AssessmentScopeNote
                        assessment={savedAssessment(s)}
                        source={s.source}
                      />
                      <button
                        className="secondary"
                        onClick={() => onOpenSurvey(s)}
                      >
                        Revisit this observation
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <p className="empty-inline">
              No saved real-photo observations in this scope for {year}. Keep
              tasks and observed changes separate.
            </p>
          )}
        </section>
      )}
      {propertyId && !scoped.length && (
        <div className="empty-state">
          <Sprout size={32} />
          <h2>Room for your next small change.</h2>
          <p>
            Add a task or plan a native replacement from a reviewed plant in
            your survey.
          </p>
        </div>
      )}
    </section>
  );
}
export function ProfileView({
  onPublicHome,
  user,
  onRoadmap,
  onProperties,
  onSignOut,
  onError,
  repository = accountRepository,
}: {
  repository?: typeof accountRepository;
  onPublicHome?: () => void;
  user: User;
  onRoadmap: () => void;
  onProperties: () => void;
  onSignOut: () => void;
  onError: (s: string) => void;
}) {
  const [name, setName] = useState(user.user_metadata.full_name || ""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await repository.saveProfile(name.trim());
      setSaved(true);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-page">
      <p className="eyebrow">YOUR NATIVEYARD ACCOUNT</p>
      <h1>Account settings.</h1>
      {onPublicHome && (
        <button className="text-button" onClick={onPublicHome}>
          Public homepage
        </button>
      )}
      <form className="inline-form" onSubmit={save}>
        <label>
          Name
          <input
            value={name}
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Email
          <input value={user.email || ""} readOnly />
        </label>
        <p className="micro">
          {user.app_metadata?.nativeyard_qa
            ? "Local QA account with persistent test data. This account was seeded by an administrator."
            : "Your saved yards and plans stay connected to your account."}
        </p>
        <button className="primary" disabled={busy}>
          Save profile
        </button>
        {saved && <p role="status">Profile saved.</p>}
      </form>
      <div className="profile-links">
        <button onClick={onProperties}>
          My properties and survey history <ArrowRight />
        </button>
        <button onClick={onRoadmap}>
          Your yard plan <ArrowRight />
        </button>
      </div>
      <button className="secondary" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SavedSurveyPhoto({ photo }: { photo: string }) {
  const [failed, setFailed] = useState(false);
  return photo && !failed ? (
    <img src={photo} alt="Saved survey photo" onError={() => setFailed(true)} />
  ) : (
    <div className="notice" role="status">
      Saved photo is temporarily unavailable. Your plant review and history are
      still available; reload your account to retry access.
    </div>
  );
}

function AssessmentScopeNote({
  assessment,
  source,
}: {
  assessment: Pick<
    ScoreSnapshot,
    "assessmentScope" | "scopeProvisional" | "scope"
  >;
  source: Survey["source"];
}) {
  const mode =
    source === "sample"
      ? "illustrative"
      : (assessment.assessmentScope ?? "photo");
  const counts = assessment.scope;
  return (
    <p className="micro assessment-scope-note">
      {mode === "illustrative"
        ? "Illustrative sample estimate"
        : mode === "photo"
          ? "Photo estimate; yard boundary unconfirmed"
          : "Yard estimate; confirmed yard regions only"}
      {counts && mode !== "illustrative"
        ? ` · ${counts.yard} yard · ${counts.background} background excluded · ${counts.unconfirmed} boundary unconfirmed`
        : ""}
      {mode === "yard" && assessment.scopeProvisional
        ? " · scope remains provisional"
        : ""}
      .
    </p>
  );
}

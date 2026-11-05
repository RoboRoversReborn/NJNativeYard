"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  loadTaskEvents,
  taskEventLabel,
  type TaskEvent,
} from "@/lib/account/task-events";

const fieldLabels: Record<string, string> = {
  title: "Task",
  notes: "Notes",
  stage: "Stage",
  done: "Completion",
  completed_at: "Completion time",
  plan_year: "Plan year",
  season: "Season",
  replacement_id: "Planned replacement",
  survey_id: "Related observation",
  yard_area_id: "Yard area",
  property_id: "Property",
};
function recordedTime(value?: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Time not recorded";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
  });
}
function stateValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "")
    return field === "completed_at"
      ? "No completion time recorded"
      : "Not recorded";
  if (field === "done") return value ? "Complete" : "Not complete";
  if (field === "completed_at") return recordedTime(String(value));
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function eventFields(event: TaskEvent) {
  const fields = new Set(
    event.changed_fields.filter((field) => field !== "updated_at"),
  );
  if (event.event_type === "completed" || event.event_type === "reopened") {
    fields.add("done");
    fields.add("completed_at");
  }
  return [...fields];
}

export function TaskEventHistory({
  propertyId,
  taskId,
  title,
  version,
  loadEvents = loadTaskEvents,
}: {
  propertyId: string;
  taskId: string;
  title: string;
  version?: string;
  loadEvents?: typeof loadTaskEvents;
}) {
  const key = `${propertyId}/${taskId}`;
  const id = useId();
  const lifecycle = useRef({ mounted: false, request: 0 });
  const [state, setState] = useState<{
    key: string;
    open: boolean;
    phase: "loading" | "ready" | "error";
    events: TaskEvent[];
    version?: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const life = lifecycle.current;
    life.mounted = true;
    return () => {
      life.mounted = false;
      life.request++;
    };
  }, []);
  useEffect(() => {
    const life = lifecycle.current;
    life.request++;
    return () => {
      life.request++;
    };
  }, [key]);
  const current = state?.key === key ? state : null;
  const open = !!current?.open;
  async function load() {
    const request = ++lifecycle.current.request;
    const requestedKey = key;
    setState({
      key: requestedKey,
      open: true,
      phase: "loading",
      events: [],
      version,
    });
    try {
      const rows = await loadEvents(propertyId, taskId);
      if (!lifecycle.current.mounted || lifecycle.current.request !== request)
        return;
      const events = rows
        .filter(
          (row) => row.property_id === propertyId && row.task_id === taskId,
        )
        .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
      setState({
        key: requestedKey,
        open: true,
        phase: "ready",
        events,
        version,
      });
    } catch (error) {
      if (lifecycle.current.mounted && lifecycle.current.request === request)
        setState({
          key: requestedKey,
          open: true,
          phase: "error",
          events: [],
          version,
          error:
            error instanceof Error
              ? error.message
              : "Task history could not be loaded.",
        });
    }
  }
  return (
    <section
      className="task-event-history"
      aria-label={`Task history: ${title}`}
    >
      <button
        type="button"
        className="text-button"
        aria-label={`${open ? "Hide" : "View"} history for ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (open) {
            lifecycle.current.request++;
            setState(current ? { ...current, open: false } : null);
          } else void load();
        }}
      >
        {open ? "Hide history" : "View history"}
      </button>
      <div id={id} hidden={!open}>
        {current?.phase === "loading" && (
          <p role="status">Loading task history…</p>
        )}
        {current?.phase === "error" && (
          <div role="alert">
            <p>{current.error} Your saved task has not changed.</p>
            <button
              type="button"
              className="secondary"
              onClick={() => void load()}
            >
              Retry task history
            </button>
          </div>
        )}
        {current?.phase === "ready" && (
          <>
            {current.version !== version && (
              <div className="task-event-stale" role="status">
                <p>This task changed since history was loaded.</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void load()}
                >
                  Refresh task history
                </button>
              </div>
            )}
            {!current.events.length ? (
              <p>
                No recorded events returned. Older task changes may not have
                been recorded.
              </p>
            ) : (
              <ol className="task-event-list">
                {current.events.map((event) => (
                  <li key={event.id}>
                    <strong>{taskEventLabel(event)}</strong>
                    <p className="task-event-meta">
                      {event.actor_type === "system"
                        ? "System"
                        : "Property owner"}{" "}
                      ·{" "}
                      <time dateTime={event.occurred_at}>
                        {recordedTime(event.occurred_at)}
                      </time>
                    </p>
                    <details open={event.event_type !== "created"}>
                      <summary>
                        {event.event_type === "created"
                          ? "Initial saved values"
                          : "Saved changes"}
                      </summary>
                      <dl className="task-event-changes">
                        {eventFields(event).map((field) => (
                          <div key={field}>
                            <dt>{fieldLabels[field] || field}</dt>
                            <dd>
                              <span>
                                <b>Before: </b>
                                {event.before_state
                                  ? stateValue(
                                      field,
                                      event.before_state[
                                        field as keyof typeof event.before_state
                                      ],
                                    )
                                  : "No earlier task record"}
                              </span>
                              <span>
                                <b>After: </b>
                                {stateValue(
                                  field,
                                  event.after_state[
                                    field as keyof typeof event.after_state
                                  ],
                                )}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                    <details className="task-event-record">
                      <summary>Recorded actor and time</summary>
                      <p>
                        Actor identifier:{" "}
                        {event.actor_user_id || "Not recorded"}
                      </p>
                      <p>
                        Original event time:{" "}
                        {event.occurred_at || "Not recorded"}
                      </p>
                    </details>
                  </li>
                ))}
              </ol>
            )}
            <p className="task-event-note">
              History records saved actions and edits. It does not measure an
              ecosystem improvement.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

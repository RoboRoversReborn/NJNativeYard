"use client";
import { useEffect, useRef, useState } from "react";
import type { Survey } from "@/lib/survey";
import {
  loadAreaBaseline,
  loadBaselineEvents,
  setAreaBaseline,
} from "@/lib/account/area-baseline";
export function AreaBaseline({
  areaId,
  surveys,
  onOpen,
}: {
  areaId: string;
  surveys: Survey[];
  onOpen: (s: Survey) => void;
}) {
  const [selected, setSelected] = useState(""),
    [saved, setSaved] = useState<string | null | undefined>(),
    [reason, setReason] = useState(""),
    [events, setEvents] = useState<
      Awaited<ReturnType<typeof loadBaselineEvents>>
    >([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const options = surveys
    .filter((s) => s.areaId === areaId && s.source === "upload")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const [record, history] = await Promise.all([
        loadAreaBaseline(areaId),
        loadBaselineEvents(areaId),
      ]);
      if (!alive.current) return;
      setSaved(record.baselineSurveyId);
      setSelected(record.baselineSurveyId || "");
      setEvents(history);
    } catch {
      if (alive.current)
        setMessage(
          "Baseline records could not load. Your saved observations are unchanged; retry when connected.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function save() {
    if (!reason.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await setAreaBaseline(areaId, selected || null, reason.trim());
      if (!alive.current) return;
      setSaved(selected || null);
      setReason("");
      setMessage(
        "Baseline choice saved. Prior choices remain in the area history; saved survey scores have not changed.",
      );
      setEvents(await loadBaselineEvents(areaId));
    } catch {
      if (alive.current)
        setMessage(
          "The baseline choice could not be confirmed. Reload its history before retrying; your selection and reason remain available.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <details className="capture-context">
      <summary>Area baseline and choice history</summary>
      <p>
        A baseline is your chosen reference observation. It does not establish
        complete property coverage or botanical correctness. Existing
        observations are never automatically relabelled as confirmed baselines.
      </p>
      <button className="secondary" disabled={busy} onClick={() => void load()}>
        {busy ? "Loading…" : "Load baseline record"}
      </button>
      {saved !== undefined && (
        <>
          <p>
            {saved
              ? `Selected reference: ${options.find((s) => s.id === saved) ? new Date(options.find((s) => s.id === saved)!.createdAt).toLocaleString() : "saved observation unavailable"}`
              : "No explicit baseline selected."}
          </p>
          <label>
            Reference observation
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">No explicit baseline</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.createdAt).toLocaleString()} · recorded time
                </option>
              ))}
            </select>
          </label>
          <label>
            Why change this baseline?
            <textarea
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !reason.trim()}
            onClick={() => void save()}
          >
            Save baseline choice
          </button>
          {selected && options.some((s) => s.id === selected) && (
            <button
              className="secondary"
              onClick={() => onOpen(options.find((s) => s.id === selected)!)}
            >
              Open reference survey
            </button>
          )}
          <details>
            <summary>Baseline choice events ({events.length})</summary>
            <ul>
              {events.map((e, i) => (
                <li key={i}>
                  <strong>
                    {
                      {
                        selected: "Reference selected",
                        replaced: "Reference replaced",
                        cleared: "Reference cleared",
                      }[e.event_type]
                    }
                  </strong>
                  <p>
                    {new Date(e.occurred_at).toLocaleString()} ·{" "}
                    {e.actor_type === "owner"
                      ? "Recorded by you"
                      : "System event"}
                  </p>
                  <p>{e.reason}</p>
                  <p>
                    Earlier reference:{" "}
                    {e.before_survey_id
                      ? options.find((s) => s.id === e.before_survey_id)
                        ? new Date(
                            options.find((s) => s.id === e.before_survey_id)!
                              .createdAt,
                          ).toLocaleString()
                        : "record unavailable"
                      : "none"}{" "}
                    → Current reference:{" "}
                    {e.after_survey_id
                      ? options.find((s) => s.id === e.after_survey_id)
                        ? new Date(
                            options.find((s) => s.id === e.after_survey_id)!
                              .createdAt,
                          ).toLocaleString()
                        : "record unavailable"
                      : "none"}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import type { RoadTask } from "../lib/account/repository";
import type { TaskEvent } from "../lib/account/task-events";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, within, cleanup, fireEvent, waitFor, act } =
  await import("@testing-library/react");
const { RoadmapView } = await import("../components/account-views");
const { TaskEventHistory } = await import("../components/task-event-history");
const repository = await import("../lib/account/repository");
const year = new Date().getFullYear();
const row = (id: string, overrides: Partial<RoadTask> = {}): RoadTask => ({
  id,
  property_id: "p1",
  yard_area_id: "a1",
  title: id,
  notes: "",
  replacement_id: null,
  done: false,
  updated_at: "2026-11-04T12:00:00Z",
  ...overrides,
});

test("stages preserve current, undated and unfinished earlier-year work while progress counts selected year only", async () => {
  const tasks = [
    row("Review this match", { stage: "Review", plan_year: year }),
    row("This year done", { stage: "Do", plan_year: year, done: true }),
    row("Undated work"),
    row("Earlier unfinished", { stage: "Revisit", plan_year: year - 1 }),
    row("Earlier completed", {
      stage: "Review",
      plan_year: year - 1,
      done: true,
    }),
    row("Future work", { plan_year: year + 1 }),
    row("Other property", { property_id: "p2" }),
  ];
  let saved: Parameters<typeof repository.putTask>[0] | undefined;
  try {
    render(
      React.createElement(RoadmapView, {
        propertyId: "p1",
        areaId: "a1",
        tasks,
        surveys: [],
        busy: false,
        onRefresh: async () => {},
        onError: () => {},
        repository: {
          ...repository,
          putTask: async (task) => {
            saved = task;
          },
        },
      }),
    );
    assert.ok(screen.getByText("1 of 2 tasks complete"));
    assert.ok(
      within(screen.getByRole("region", { name: "Review tasks" })).getByRole(
        "heading",
        { name: "Review this match" },
      ),
    );
    assert.ok(
      within(screen.getByRole("region", { name: "Plan tasks" })).getByRole(
        "heading",
        { name: "Undated work" },
      ),
    );
    assert.ok(screen.getByRole("heading", { name: "Earlier unfinished" }));
    for (const name of ["Earlier completed", "Future work", "Other property"])
      assert.equal(screen.queryByRole("heading", { name }), null);
    assert.ok(
      screen.getByText(
        new RegExp(`Earlier-year unfinished backlog · ${year - 1}`),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Inspect new shoots" },
    });
    fireEvent.change(screen.getByLabelText("Stage"), {
      target: { value: "Review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    await waitFor(() => assert.equal(saved?.stage, "Review"));
    assert.equal(saved?.done, false);
    assert.equal(saved?.plan_year, year);
  } finally {
    cleanup();
  }
});

function historyEvent(
  type: TaskEvent["event_type"],
  propertyId = "p1",
): TaskEvent {
  const oldTime = "2026-11-02T15:30:00Z";
  return {
    id: `${propertyId}-${type}`,
    task_id: "task",
    property_id: propertyId,
    yard_area_id: "a1",
    owner_user_id: "owner",
    actor_user_id: "owner",
    actor_type: "owner",
    event_type: type,
    occurred_at: "2026-11-03T16:00:00Z",
    changed_fields: ["done", "completed_at"],
    before_state: row("task", { done: true, completed_at: oldTime }),
    after_state: row("task", { done: false, completed_at: null }),
  };
}

test("on-demand history retains before/after completion times on undo and rejects foreign scope rows", async () => {
  let calls = 0;
  const event = historyEvent("reopened");
  try {
    render(
      React.createElement(TaskEventHistory, {
        propertyId: "p1",
        taskId: "task",
        title: "Plant inkberry",
        loadEvents: async () => {
          calls++;
          return [event, historyEvent("reopened", "p2")];
        },
      }),
    );
    assert.equal(calls, 0);
    fireEvent.click(
      screen.getByRole("button", { name: "View history for Plant inkberry" }),
    );
    await screen.findByText("Completion undone");
    assert.equal(calls, 1);
    assert.equal(document.querySelectorAll(".task-event-list > li").length, 1);
    assert.ok(screen.getByText(/Property owner/));
    assert.equal(
      document.querySelector("time")?.getAttribute("datetime"),
      event.occurred_at,
    );
    const changes = screen.getByText("Completion time").closest("div")!;
    assert.match(changes.textContent!, /Before:.*2026/);
    assert.match(changes.textContent!, /After:.*No completion time recorded/);
    assert.ok(screen.getByText(/does not measure an ecosystem improvement/));
  } finally {
    cleanup();
  }
});

test("history failure can retry and stale previous-scope replies never appear", async () => {
  let finish!: (rows: TaskEvent[]) => void;
  const old = new Promise<TaskEvent[]>((resolve) => {
    finish = resolve;
  });
  let attempts = 0;
  try {
    const view = render(
      React.createElement(TaskEventHistory, {
        propertyId: "p1",
        taskId: "task",
        title: "Old task",
        loadEvents: async () => old,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View history for Old task" }),
    );
    view.rerender(
      React.createElement(TaskEventHistory, {
        propertyId: "p2",
        taskId: "task",
        title: "New task",
        loadEvents: async () => {
          if (++attempts === 1) throw new Error("History connection failed.");
          return [];
        },
      }),
    );
    await act(async () => {
      finish([historyEvent("reopened")]);
    });
    assert.equal(screen.queryByText("Completion undone"), null);
    fireEvent.click(
      screen.getByRole("button", { name: "View history for New task" }),
    );
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry task history" }));
    await screen.findByText(/No recorded events returned/);
    assert.equal(attempts, 2);
    view.unmount();
  } finally {
    cleanup();
  }
});

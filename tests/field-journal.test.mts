import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import type { Survey } from "../lib/survey";
import type { ComparisonEvidence } from "../lib/observation-comparison";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, fireEvent, cleanup, waitFor } =
  await import("@testing-library/react");
const { exampleSurvey, withScoreSnapshot } = await import("../lib/survey");
const { ObservationCompare } =
  await import("../components/observation-compare");
const { CaptureContext } = await import("../components/capture-context");
const { PropertiesView } = await import("../components/account-views");
const repository = await import("../lib/account/repository");

test("legacy visual comparison withholds delta and saves declarations bound to its immutable pair", async () => {
  try {
    const a = withScoreSnapshot({
      ...exampleSurvey(),
      id: "a",
      createdAt: "2026-11-03T00:00:00Z",
      source: "upload" as const,
      areaId: "front",
      photoPath: "owner/a.jpg",
    });
    const b = withScoreSnapshot({
      ...a,
      id: "b",
      createdAt: "2026-11-04T00:00:00Z",
      photoPath: "owner/b.jpg",
    });
    let saved: { s: Survey; e: ComparisonEvidence } | undefined;
    render(
      React.createElement(ObservationCompare, {
        surveys: [a, b],
        reviewerId: "owner",
        onPair: () => {},
        onOpen: () => {},
        onSaveEvidence: async (s, e) => {
          saved = { s, e };
        },
      }),
    );
    assert.ok(screen.getByText("Review differences first"));
    assert.ok(screen.getByText(/Numeric difference is withheld/));
    fireEvent.change(screen.getByLabelText("Viewpoint and framing"), {
      target: { value: "comparable" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save comparison declarations" }),
    );
    await waitFor(() => assert.equal(saved!.e.beforeSurveyId, "a"));
    assert.equal(saved!.e.afterSurveyId, "b");
    assert.equal(saved!.e.reviewerId, "owner");
    assert.equal(saved!.e.sameView, "comparable");
    assert.equal(saved!.e.season, "unknown");
    assert.equal(saved!.s.id, "b");
  } finally {
    cleanup();
  }
});

test("capture context does not infer dates or viewpoints and preserves correction history", () => {
  try {
    let changed: Survey | undefined;
    const s = {
      ...exampleSurvey(),
      source: "upload" as const,
      capture: { imageSha256: "a".repeat(64) },
    };
    render(
      React.createElement(CaptureContext, {
        survey: s,
        previous: [],
        actorId: "owner",
        onChange: (next) => {
          changed = next;
        },
      }),
    );
    assert.equal(
      (
        screen.getByLabelText(
          /When was this photo captured/,
        ) as HTMLInputElement
      ).value,
      "",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply context to this draft" }),
    );
    assert.equal(changed!.capture!.capturedAtConfirmed, false);
    assert.equal(changed!.capture!.photoPointConfirmed, false);
    assert.equal(changed!.capture!.imageSha256, s.capture.imageSha256);
    assert.equal(changed!.captureEdits!.length, 1);
    assert.deepEqual(changed!.captureEdits![0].previous, s.capture);
  } finally {
    cleanup();
  }
});

test("first property and area retry reuses identifiers after a partial write", async () => {
  try {
    const ids: string[] = [],
      areas: string[] = [];
    let first = true;
    let created: [string, string | undefined] | undefined;
    render(
      React.createElement(PropertiesView, {
        initialAdding: "property",
        properties: [],
        propertyId: "",
        areaId: "",
        surveys: [],
        onOpen: () => {},
        onScan: () => {},
        onRoadmap: () => {},
        onRefresh: async () => {},
        onError: () => {},
        onScopeCreated: (p, a) => {
          created = [p, a];
        },
        repository: {
          ...repository,
          addProperty: async (_n, _z, id) => {
            ids.push(id!);
            return id!;
          },
          addArea: async (_p, _n, id) => {
            areas.push(id!);
            if (first) {
              first = false;
              throw new Error("network");
            }
            return id!;
          },
        },
      }),
    );
    fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
      target: { value: "My home" },
    });
    fireEvent.change(screen.getByLabelText("NJ ZIP code"), {
      target: { value: "07645" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create property" }));
    await waitFor(() => assert.equal(areas.length, 1));
    await waitFor(() =>
      assert.equal(
        (
          screen.getByRole("button", {
            name: "Create property",
          }) as HTMLButtonElement
        ).disabled,
        false,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create property" }));
    await waitFor(() => assert.ok(created));
    assert.equal(ids.length, 2);
    assert.equal(ids[0], ids[1]);
    assert.equal(areas[0], areas[1]);
    assert.deepEqual(created, [ids[0], areas[0]]);
  } finally {
    cleanup();
  }
});

test("saved fingerprint-valid comparison declarations restore after reopening", async () => {
  const { comparisonFingerprint } =
    await import("../lib/observation-comparison");
  try {
    const a = withScoreSnapshot({
      ...exampleSurvey(),
      id: "restore-a",
      source: "upload" as const,
      areaId: "front",
      createdAt: "2026-11-01T00:00:00Z",
      photoPath: "owner/a.jpg",
    });
    const b = withScoreSnapshot({
      ...a,
      id: "restore-b",
      createdAt: "2026-11-02T00:00:00Z",
      photoPath: "owner/b.jpg",
    });
    b.comparisonEvidenceHistory = [
      {
        beforeSurveyId: a.id,
        afterSurveyId: b.id,
        beforeFingerprint: comparisonFingerprint(a),
        afterFingerprint: comparisonFingerprint(b),
        sameView: "different",
        season: "comparable",
        visibility: "different",
        reviewerId: "owner",
        reviewedAt: "2026-11-03T00:00:00Z",
      },
    ];
    render(
      React.createElement(ObservationCompare, {
        surveys: [a, b],
        reviewerId: "owner",
        onPair: () => {},
        onOpen: () => {},
        onSaveEvidence: async () => {},
      }),
    );
    assert.equal(
      (screen.getByLabelText("Viewpoint and framing") as HTMLSelectElement)
        .value,
      "different",
    );
    assert.equal(
      (screen.getByLabelText("Season and growth stage") as HTMLSelectElement)
        .value,
      "comparable",
    );
    assert.equal(
      (screen.getByLabelText("Visibility and coverage") as HTMLSelectElement)
        .value,
      "different",
    );
  } finally {
    cleanup();
  }
});

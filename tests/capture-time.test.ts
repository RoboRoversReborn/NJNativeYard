import test from "node:test";
import assert from "node:assert/strict";
import { captureTimeInput, captureTimeFromInput } from "../lib/capture-time";
test("New York capture input displays local clock and unchanged apply retains the same instant", () => {
  const prior = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const iso = "2026-11-04T20:31:42.123Z";
    assert.equal(captureTimeInput(iso), "2026-11-04T15:31");
    assert.equal(captureTimeFromInput(captureTimeInput(iso), iso), iso);
    assert.equal(
      captureTimeFromInput("2026-11-04T16:31", iso),
      "2026-11-04T21:31:00.000Z",
    );
  } finally {
    if (prior === undefined) delete process.env.TZ;
    else process.env.TZ = prior;
  }
});
test("unchanged ambiguous fall-back time retains its original DST-fold offset", () => {
  const prior = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    for (const iso of [
      "2026-11-01T05:30:00.000Z",
      "2026-11-01T06:30:00.000Z",
    ]) {
      assert.equal(captureTimeInput(iso), "2026-11-01T01:30");
      assert.equal(captureTimeFromInput("2026-11-01T01:30", iso), iso);
    }
    assert.equal(captureTimeFromInput(""), undefined);
    assert.equal(captureTimeInput(), "");
  } finally {
    if (prior === undefined) delete process.env.TZ;
    else process.env.TZ = prior;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { legacySurvey } from "./fixtures/reference-survey";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  location: { value: dom.window.location, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, fireEvent, cleanup, waitFor, within } =
  await import("@testing-library/react");
const { NativeYardApp } = await import("../components/native-yard-app");
const { SurveyWorkspace } = await import("../components/survey-workspace");
const { exampleSurvey, summary } = await import("../lib/survey");
const { sampleYards: currentSamples } = await import("../lib/sample-yards");
function reviewControl(kind: "manual" | "leaf") {
  if (!screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
  const dialog = within(screen.getByRole("dialog"));
  const review = dialog.getByRole("button", { name: "Review plant match" });
  if (review.getAttribute("aria-expanded") !== "true") fireEvent.click(review);
  return dialog.getByRole("button", { name: kind === "manual" ? "Choose a plant match" : "Use a leaf photo" });
}


test("unavailable accounts leave useful guest actions without a saving dead end", async () => {
  const { JourneyHome } = await import("../components/journey-home");
  let scans = 0,
    signins = 0;
  try {
    render(
      React.createElement(JourneyHome, {
        accountsAvailable: false,
        onScan: () => {
          scans++;
        },
        onExample: () => {},
        onSignIn: () => {
          signins++;
        },
      }),
    );
    assert.equal(
      screen.queryByRole("button", { name: /Save your yard’s progress/ }),
      null,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Scan a plant or yard" }),
    );
    assert.equal(scans, 1);
    fireEvent.click(
      screen.getByRole("button", { name: /Sign in \/ create a profile/ }),
    );
    assert.equal(signins, 1);
    assert.ok(screen.getByText(/Account saving is unavailable/));
    cleanup();
    render(
      React.createElement(SurveyWorkspace, {
        survey: exampleSurvey(),
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        accountsAvailable: false,
        busy: false,
      }),
    );
    assert.equal(
      screen.queryByRole("button", { name: /Save to my yard/ }),
      null,
    );
    assert.ok(screen.getByRole("button", { name: /Print report/ }));
  } finally {
    cleanup();
  }
});

test("manual plant search finds partial and complete supported scientific synonyms", () => {
  try {
    render(
      React.createElement(SurveyWorkspace, {
        survey: exampleSurvey(),
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    fireEvent.click(
      reviewControl("manual"),
    );
    assert.equal(
      document.activeElement,
      screen.getByRole("heading", { name: "Compare plant matches" }),
    );
    fireEvent.change(screen.getByLabelText("Search plants"), {
      target: { value: "Polygonum" },
    });
    assert.ok(
      screen.getByRole("button", { name: /Use Japanese knotweed as match/i }),
    );
    fireEvent.change(screen.getByLabelText("Search plants"), {
      target: { value: "  POLYGONUM   CUSPIDATUM  " },
    });
    assert.ok(
      screen.getByRole("button", { name: /Use Japanese knotweed as match/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Back to plant profile" }),
    );
    assert.equal(
      document.activeElement,
      document.querySelector("#plant-details h2"),
    );
  } finally {
    cleanup();
  }
});

test("Back cancels an upload and an ignored stale response cannot replace or clear a newer scan", async () => {
  const { act } = await import("@testing-library/react");
  const originalURL = dom.window.location.href;
  dom.window.history.replaceState(null, "", "/?view=scan");
  const original = globalThis.fetch;
  const uploads: {
    signal: AbortSignal;
    resolve: (response: Response) => void;
  }[] = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: true, accounts: false });
    if (String(url) !== "/api/analyze") return Response.json({});
    return new Promise<Response>((resolve) =>
      uploads.push({ signal: options!.signal as AbortSignal, resolve }),
    );
  };
  try {
    render(React.createElement(NativeYardApp));
    await screen.findByRole("heading", { name: "What’s growing out there?" });
    const upload = () =>
      fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
        target: {
          files: [
            new dom.window.File(["jpeg"], "yard.jpg", { type: "image/jpeg" }),
          ],
        },
      });
    upload();
    await waitFor(() => assert.equal(uploads.length, 1));
    dom.window.history.replaceState(null, "", "/?view=home");
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: /Your yard.*world worth/i });
    assert.equal(uploads[0].signal.aborted, true);
    fireEvent.click(
      screen.getByRole("button", { name: "Scan a plant or yard" }),
    );
    upload();
    await waitFor(() => assert.equal(uploads.length, 2));
    await act(async () => {
      uploads[0].resolve(
        Response.json({ ...exampleSurvey(), source: "upload" }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.ok(screen.getByText("Finding plants in your photo…"));
    assert.equal(dom.window.location.search, "?view=scan");
    assert.equal(uploads[1].signal.aborted, false);
    const newer = {
      ...exampleSurvey(undefined, "back-yard"),
      id: "newer-scan",
      source: "upload",
    };
    await act(async () => {
      uploads[1].resolve(Response.json(newer));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.ok(
      screen.getByRole("heading", { name: "Improve your yard’s ecosystem." }),
    );
    assert.equal(
      document.querySelector(".rw-photo > img")?.getAttribute("src"),
      newer.photo,
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
    dom.window.history.replaceState(null, "", originalURL);
  }
});
test("homepage keeps one concise journey before exactly three real samples", async () => {
  const { JourneyHome } = await import("../components/journey-home");
  const { sampleYards } = await import("../lib/sample-yards");
  let opened = "",
    scans = 0,
    signins = 0;
  try {
    render(
      React.createElement(JourneyHome, {
        accountsAvailable: true,
        onScan: () => {
          scans++;
        },
        onExample: (id: string) => {
          opened = id;
        },
        onSignIn: () => {
          signins++;
        },
      }),
    );
    assert.ok(screen.getByRole("heading", { name: /Your yard.*world worth/i }));
    assert.equal(
      document.querySelectorAll(".home-experience > section").length,
      3,
    );
    assert.deepEqual(
      Array.from(document.querySelectorAll(".home-discovery-steps h3")).map(
        (node) => node.textContent,
      ),
      ["Meet your yard", "Follow your curiosity", "Make one useful change"],
    );
    assert.ok(
      document
        .getElementById("how")!
        .compareDocumentPosition(document.getElementById("examples")!) & 4,
    );
    assert.equal(document.querySelectorAll(".home-yard-card").length, 3);
    for (const sample of sampleYards) {
      fireEvent.click(
        screen.getByRole("button", { name: `Open example: ${sample.title}` }),
      );
      assert.equal(opened, sample.id);
      const card = screen
        .getByRole("heading", { name: sample.title })
        .closest("article")!;
      assert.equal(
        card.querySelector(".home-yard-score strong")!.textContent,
        String(summary(sample).score),
      );
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Scan a plant or yard" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Sign in \/ create a profile/ }),
    );
    assert.equal(scans, 1);
    assert.equal(signins, 1);
  } finally {
    cleanup();
  }
});

test("composition graphic filters the survey and displays distinct plant and score shares", () => {
  try {
    render(
      React.createElement(SurveyWorkspace, {
        survey: legacySurvey(),
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Keystone natives: 33% of detected plant regions",
      }),
    );
    const impact = screen.getByLabelText(
      "Selected category score contribution",
    );
    assert.match(impact.textContent!, /\+33\.3score points/);
    assert.doesNotMatch(impact.textContent!, /of current score/);
    assert.equal(document.querySelectorAll(".plant-box").length, 2);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Invasive: 33% of detected plant regions",
      }),
    );
    assert.match(impact.textContent!, /invasive weight/);
    assert.match(impact.textContent!, /−16\.7score points/);
    fireEvent.click(
      screen.getByRole("button", { name: "Clear filter · Show all plants" }),
    );
    assert.equal(
      screen.queryByLabelText("Selected category score contribution"),
      null,
    );
  } finally {
    cleanup();
  }
});
test("category cards filter photo, list and navigation with original numbers and explicit reset", () => {
  const sample = legacySurvey();
  const samplePlants = sample.plants;
  const survey = {
    ...sample,
    plants: Array.from({ length: 20 }, (_, i) => ({
      ...samplePlants[i % samplePlants.length],
      id: `region-${i}`,
    })),
  };
  try {
    render(
      React.createElement(SurveyWorkspace, {
        survey,
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    const inv = document.querySelector<HTMLButtonElement>(
      ".ecosystem-counts .status-invasive",
    )!;
    fireEvent.click(inv);
    assert.equal(inv.getAttribute("aria-pressed"), "true");
    const expected = survey.plants.filter((p) =>
      samplePlants.slice(0, 2).some((s) => s.plantId === p.plantId),
    );
    assert.equal(
      document.querySelectorAll(".plant-box").length,
      expected.length,
    );
    assert.ok(
      Array.from(document.querySelectorAll(".plant-box")).every((b) =>
        b.classList.contains("status-invasive"),
      ),
    );
    assert.equal(
      document.querySelectorAll(".rw-plant-page > button").length,
      6,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next plants" }));
    assert.equal(
      document.querySelector(".rw-plant-page b")!.textContent,
      String(survey.plants.indexOf(expected[6]) + 1),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear filter · Show all plants" }),
    );
    assert.equal(document.querySelectorAll(".plant-box").length, 20);
    assert.equal(inv.getAttribute("aria-pressed"), "false");
    fireEvent.click(inv);
    fireEvent.click(inv);
    assert.equal(document.querySelectorAll(".plant-box").length, 20);
  } finally {
    cleanup();
  }
});
test("guest homepage opens sample workspace without sign-in and tools stay inline", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: false, accounts: false });
  try {
    render(React.createElement(NativeYardApp));
    await screen.findByRole("heading", { name: /Your yard.*world worth/i });
    fireEvent.click(
      screen.getByRole("button", {
        name: `Open example: ${currentSamples[0].title}`,
      }),
    );
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    assert.ok(screen.getByText(/Illustrative sample survey/i));
    assert.equal(
      screen.getAllByRole("button", { name: /^Select plant \d+:/ }).length,
      exampleSurvey().plants.length,
    );
    fireEvent.click(
      reviewControl("manual"),
    );
    assert.ok(screen.getByRole("heading", { name: "Compare plant matches" }));
    assert.equal(screen.queryByRole("dialog"), null);
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "native" },
    });
    fireEvent.change(screen.getByLabelText("Search plants"), {
      target: { value: "hydrangea" },
    });
    assert.ok(
      screen.getByRole("button", { name: /Use Smooth hydrangea as match/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Use Smooth hydrangea as match/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm plant match" }));
    await waitFor(() =>
      assert.ok(screen.getByRole("heading", { name: /^Smooth hydrangea$/i })),
    );
    fireEvent.click(
      reviewControl("leaf"),
    );
    assert.equal(screen.queryByLabelText("Gemini API key"), null);
    assert.ok(screen.getByLabelText("Upload a leaf photo"));
    assert.ok(screen.getByLabelText("Take a leaf photo"));
    assert.equal(screen.queryByRole("dialog"), null);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("reviewing an uncertain species updates identity and reconciles counts", () => {
  let survey = exampleSurvey();
  const index = survey.plants.findIndex((p) => !p.reviewed && p.plantId);
  const expected = summary(survey).reviewed + 1;
  function Harness() {
    const [s, setS] = React.useState(survey);
    return React.createElement(SurveyWorkspace, {
      survey: s,
      onChange: (next) => {
        survey = next;
        setS(next);
      },
      onScan: () => {},
      onSave: () => {},
      onPlan: () => {},
      signedIn: false,
      busy: false,
    });
  }
  try {
    render(React.createElement(Harness));
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`^Select plant ${index + 1}:`),
      }),
    );
    fireEvent.click(
      (() => { reviewControl("manual"); return within(screen.getByRole("dialog")).getByRole("button", { name: "Select this match" }); })(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm plant match" }));
    assert.equal(summary(survey).reviewed, expected);
    assert.equal(
      summary(survey).assessed + summary(survey).counts.unverified,
      survey.plants.length,
    );
  } finally {
    cleanup();
  }
});

test("photo upload surfaces provider failure and never substitutes sample results", async () => {
  dom.window.history.replaceState(null, "", "/");
  const original = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: false, accounts: false });
    if (String(url) === "/api/analyze") {
      posts++;
      assert.equal(options?.method, "POST");
      return Response.json(
        { error: "Live identification is not configured." },
        { status: 503 },
      );
    }
    throw new Error("Unexpected request");
  };
  try {
    render(React.createElement(NativeYardApp));
    await screen.findByRole("heading", { name: /Your yard.*world worth/i });
    fireEvent.click(
      screen.getByRole("button", { name: "Scan a plant or yard" }),
    );
    const file = new dom.window.File(["jpeg"], "yard.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
      target: { files: [file] },
    });
    await screen.findByText("Live identification is not configured.");
    assert.equal(posts, 1);
    assert.ok(
      screen.getByRole("heading", { name: "What’s growing out there?" }),
    );
    assert.equal(screen.queryByText("ILLUSTRATIVE SAMPLE SURVEY"), null);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("upload validates MIME and ZIP before contacting the provider", async () => {
  dom.window.history.replaceState(null, "", "/?view=scan");
  const original = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = async (url) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: true, accounts: false });
    posts++;
    throw new Error("Must not call provider");
  };
  try {
    render(React.createElement(NativeYardApp));
    await screen.findByRole("heading", { name: "What’s growing out there?" });
    fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
      target: {
        files: [
          new dom.window.File(["pdf"], "wrong.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    await screen.findByText(
      "Choose a JPEG, PNG, WebP, or compatible camera photo.",
    );
    fireEvent.change(screen.getByLabelText("New Jersey ZIP code"), {
      target: { value: "99999" },
    });
    fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
      target: {
        files: [
          new dom.window.File(["jpeg"], "yard.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    assert.match((await screen.findByRole("alert")).textContent!, /Enter a valid New Jersey ZIP code/);
    assert.equal(posts, 0);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("successful photo upload and leaf refinement use server configuration", async () => {
  dom.window.history.replaceState(null, "", "/?view=scan");
  const original = globalThis.fetch;
  const { catalog } = await import("../lib/survey");
  const s = exampleSurvey();
  s.source = "upload";
  s.plants = s.plants.slice(0, 2).map((p) => ({ ...p, reviewed: false }));
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: true, accounts: false });
    if (String(url) === "/api/analyze") {
      assert.equal(
        new Headers(options?.headers).has("x-gemini-api-key"),
        false,
      );
      requests++;
      return Response.json(s);
    }
    if (String(url) === "/api/identify-macro") {
      assert.equal(
        new Headers(options?.headers).has("x-gemini-api-key"),
        false,
      );
      const p = catalog.find((p) => p.commonName === "Oakleaf Hydrangea")!;
      return Response.json({
        method: "gemini",
        traits: { margin: "Lobed" },
        candidates: [
          {
            plantId: p.id,
            scientificName: p.scientificName,
            commonName: p.commonName,
            clue: "Lobed leaves",
            confidence: 0.9,
          },
        ],
      });
    }
    throw new Error("Unexpected request");
  };
  try {
    render(React.createElement(NativeYardApp));
    await screen.findByRole("heading", { name: "What’s growing out there?" });
    assert.equal(screen.queryByLabelText("Gemini API key"), null);
    assert.equal(screen.queryByText("Identification settings"), null);
    fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
      target: {
        files: [
          new dom.window.File(["jpeg"], "yard.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    assert.equal(requests, 1);
    assert.ok(screen.getByLabelText(/Yard ecosystem score .* out of 100/));
    fireEvent.click(
      reviewControl("leaf"),
    );
    fireEvent.change(screen.getByLabelText("Upload a leaf photo"), {
      target: {
        files: [
          new dom.window.File(["leaf"], "leaf.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    await screen.findByText("Lobed leaves");
    fireEvent.click(screen.getByRole("button", { name: "Select this match" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm plant match" }));
    await screen.findByRole("heading", { name: /^Oakleaf hydrangea$/i });
    assert.equal(screen.queryByRole("dialog"), null);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("guest can return to a reviewed survey after optional sign-in prompt", async () => {
  dom.window.history.replaceState(null, "", "/?view=analysis");
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: false, accounts: true, google: true });
  const { appServices } = await import("../lib/app-services");
  const uploaded = {
    ...exampleSurvey(), source: "upload" as const, id: "reviewed-guest-upload",
    photo: "/reviewed-guest-upload.jpg", sampleId: undefined,
    plants: exampleSurvey().plants.map((plant) => ({ ...plant, reviewed: true })),
  };
  const services = {
    ...appServices,
    auth: { ...appServices.auth, currentUser: async () => null, subscribe: () => () => {} },
    drafts: { ...appServices.drafts, readDraft: async () => uploaded, keepDraft: async () => {} },
  };
  try {
    render(React.createElement(NativeYardApp, { services }));
    await screen.findByRole("heading", { name: "Improve your yard’s ecosystem." });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to save" }));
    await screen.findByRole("heading", { name: "Let’s keep it growing." });
    assert.equal(
      (
        screen.getByRole("button", {
          name: /Continue with Google/,
        }) as HTMLButtonElement
      ).disabled,
      false,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Return to my survey" }),
    );
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    assert.equal(screen.getByAltText("Survey photo with numbered plant regions").getAttribute("src"), uploaded.photo);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("printing invokes the browser print flow and report includes every region", () => {
  const before = dom.window.print;
  let prints = 0;
  dom.window.print = () => {
    prints++;
  };
  try {
    const s = exampleSurvey();
    render(
      React.createElement(SurveyWorkspace, {
        survey: s,
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));
    assert.equal(prints, 1);
    const report = screen
      .getByRole("heading", { name: "Ecological transformation report" })
      .closest("section")!;
    assert.equal(
      report.querySelectorAll(":scope > article").length,
      s.plants.length,
    );
  } finally {
    cleanup();
    dom.window.print = before;
  }
});
test("browser-compatible images are resized and converted to JPEG before upload", async () => {
  const { compressPhoto } = await import("../lib/photo-upload");
  const originalImage = globalThis.Image;
  const create = dom.window.document.createElement.bind(dom.window.document);
  let dimensions = [0, 0];
  const FakeImage = class {
    naturalWidth = 4000;
    naturalHeight = 2000;
    width = 4000;
    height = 2000;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  };
  Object.defineProperty(globalThis, "Image", {
    value: FakeImage,
    writable: true,
    configurable: true,
  });
  dom.window.document.createElement = ((tag: string) => {
    if (tag !== "canvas") return create(tag);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: "", fillRect() {}, drawImage() {} }),
      toBlob(callback: (b: Blob) => void, type: string) {
        dimensions = [canvas.width, canvas.height];
        callback(new Blob(["jpeg bytes"], { type }));
      },
    };
    return canvas;
  }) as typeof document.createElement;
  try {
    const result = await compressPhoto(
      new File(["source"], "iphone.png", { type: "image/png" }),
    );
    assert.equal(result.type, "image/jpeg");
    assert.equal(result.name, "iphone.jpg");
    assert.deepEqual(dimensions, [1600, 800]);
  } finally {
    dom.window.document.createElement = create;
    Object.defineProperty(globalThis, "Image", {
      value: originalImage,
      writable: true,
      configurable: true,
    });
  }
});
test("upload busy state keeps native picker invisible, blocks duplicate requests, and cancels cleanly", async () => {
  dom.window.history.replaceState(null, "", "/?view=scan");
  const original = globalThis.fetch;
  const fs = await import("node:fs");
  const style = dom.window.document.createElement("style");
  style.textContent = fs.readFileSync(
    new URL("../app/journey.css", import.meta.url),
    "utf8",
  );
  dom.window.document.head.append(style);
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: true, accounts: false });
    requests++;
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Cancelled", "AbortError")),
        { once: true },
      );
    });
  };
  try {
    render(React.createElement(NativeYardApp));
    await screen.findByRole("heading", { name: "What’s growing out there?" });
    const input = screen.getByLabelText(
      "Upload a plant or yard photo",
    ) as HTMLInputElement;
    const photo = new dom.window.File(["jpeg"], "mixed-shrubs.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(input, { target: { files: [photo] } });
    await screen.findByRole("status", { name: "" }).catch(() => null);
    await screen.findByText("Finding plants in your photo…");
    assert.equal(input.disabled, true);
    assert.equal(dom.window.getComputedStyle(input).opacity, "0");
    assert.ok(screen.getByText("mixed-shrubs.jpg"));
    fireEvent.change(input, { target: { files: [photo] } });
    assert.equal(requests, 1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    await screen.findByText("Photo analysis cancelled.");
    assert.equal(input.disabled, false);
    assert.equal(
      screen.queryByRole("heading", {
        name: "Improve your yard’s ecosystem.",
      }),
      null,
    );
  } finally {
    cleanup();
    style.remove();
    globalThis.fetch = original;
  }
});
test("redesigned navigator stays compact and exposes every plant through jump navigation", () => {
  try {
    const s = exampleSurvey();
    s.plants = Array.from({ length: 10 }, (_, i) => ({
      ...s.plants[i % s.plants.length],
      id: `dense-${i}`,
    }));
    render(
      React.createElement(SurveyWorkspace, {
        survey: s,
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    assert.equal(document.querySelectorAll(".rw-plant-page>button").length, 6);
    assert.equal(
      (screen.getByLabelText("Jump to a plant") as HTMLSelectElement).options
        .length,
      s.plants.length,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next plants" }));
    assert.equal(document.querySelectorAll(".rw-plant-page>button").length, 4);
    fireEvent.change(screen.getByLabelText("Jump to a plant"), {
      target: { value: s.plants[0].id },
    });
    assert.ok(screen.getByText(`PLANT 1 OF ${s.plants.length}`));
  } finally {
    cleanup();
  }
});
test("manual matching opens a full-width workspace and can compare without losing the selected region", () => {
  try {
    const s = exampleSurvey();
    render(
      React.createElement(SurveyWorkspace, {
        survey: s,
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    fireEvent.click(
      reviewControl("manual"),
    );
    assert.equal(screen.queryByRole("complementary", { name: "Selected plant details" }), null);
    assert.ok(document.querySelector(".rw-tool-workspace"));
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("Search plants"), {
      target: { value: "smoketree" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    assert.ok(screen.getByText("CURRENT SUGGESTION"));
    assert.ok(screen.getByText("POSSIBLE NEW MATCH"));
    fireEvent.click(
      screen.getByRole("button", { name: "Back to plant profile" }),
    );
    assert.ok(screen.getByText(`PLANT 1 OF ${s.plants.length}`));
  } finally {
    cleanup();
  }
});
test("smoketree panel distinguishes a provisional identity from category and exposes seasonal actions", () => {
  try {
    const s = exampleSurvey();
    s.plants = [
      {
        ...s.plants[0],
        plantId: undefined,
        suggestion: "Smoketree",
        scientificName: "Cotinus coggygria",
        reviewed: false,
        candidates: [],
      },
    ];
    render(
      React.createElement(SurveyWorkspace, {
        survey: s,
        onChange: () => {},
        onScan: () => {},
        onSave: () => {},
        onPlan: () => {},
        signedIn: false,
        busy: false,
      }),
    );
    assert.ok(screen.getByRole("heading", { name: "Smoketree" }));
    assert.ok(screen.getByText("Unverified suggestion"));
    fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Ecology" }));
    assert.ok(screen.getByRole("heading", { name: "Why this category?" }));
    fireEvent.click(screen.getByRole("tab", { name: "Growing & seasons" }));
    assert.ok(screen.getByText("Late winter, if rejuvenation is needed"));
    assert.ok(screen.getByText(/Confirm the identity before/));
    assert.equal(screen.queryByText("Reviewed identity"), null);
  } finally {
    cleanup();
  }
});
test("plant crop uses exactly the same percentage bounds as the mapped rectangle", async () => {
  const { RegionPhoto } = await import("../components/plant-photos");
  const create = document.createElement.bind(document);
  let args: unknown[] = [];
  document.createElement = ((tag: string, ...rest: unknown[]) => {
    if (tag !== "canvas") return create(tag, rest[0] as ElementCreationOptions);
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (...values: unknown[]) => {
          args = values;
        },
      }),
      toDataURL: () => "data:image/jpeg;base64,TEST",
    };
  }) as typeof document.createElement;
  try {
    const p = {
      ...exampleSurvey().plants[0],
      box: { x: 20, y: 10, w: 30, h: 40 },
    };
    render(React.createElement(RegionPhoto, { photo: "/test.jpg", plant: p }));
    const image = document.querySelector(".rw-crop-source") as HTMLImageElement;
    Object.defineProperty(image, "naturalWidth", { value: 1000 });
    Object.defineProperty(image, "naturalHeight", { value: 500 });
    fireEvent.load(image);
    assert.deepEqual(args.slice(1), [200, 50, 300, 200, 0, 0, 300, 200]);
    assert.ok(screen.getByAltText("Your photographed plant region"));
  } finally {
    cleanup();
    document.createElement = create;
  }
});
test("provider reference image shows contributor and license alongside the species example", async () => {
  const { ReferenceImage } = await import("../components/plant-photos");
  try {
    render(
      React.createElement(ReferenceImage, {
        name: "Barberry",
        scientificName: "Provider-only fixture taxon",
        photos: [
          {
            url: "https://bs.plantnet.org/image/m/test",
            author: "Reference contributor",
            license: "CC BY-SA 4.0",
            licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
            attributionUrl: "https://example.test/reference-photo",
            source: "PlantNet",
          },
        ],
      }),
    );
    assert.equal(
      (screen.getByAltText("Reference specimen: Barberry") as HTMLImageElement)
        .src,
      "https://bs.plantnet.org/image/m/test",
    );
    assert.equal(screen.getByRole("link", { name: "Photo: Reference contributor · Pl@ntNet" }).getAttribute("href"), "https://example.test/reference-photo");
    assert.ok(screen.getAllByRole("link", { name: "CC BY-SA 4.0" }).length > 0);
  } finally {
    cleanup();
  }
});

test("sample gallery offers the exact three reference yards and opens each selected sample", async () => {
  const { SampleGallery } = await import("../components/sample-gallery");
  const { sampleYards } = await import("../lib/sample-yards");
  let selected = "";
  try {
    render(
      React.createElement(SampleGallery, {
        onExample: (id) => {
          selected = id;
        },
      }),
    );
    assert.equal(document.querySelectorAll(".sample-card").length, 3);
    assert.ok(screen.getByText(/Pick a sample yard/));
    for (const sample of sampleYards) {
      fireEvent.click(
        screen.getByRole("button", { name: `Open example: ${sample.title}` }),
      );
      assert.equal(selected, sample.id);
      assert.ok(document.querySelector(`a[href="${sample.sourceUrl}"]`));
    }
  } finally {
    cleanup();
  }
});

test("a provisional dashboard score appears before review and category colours coordinate both selection directions", () => {
  let s = legacySurvey();
  function Harness() {
    const [survey, setSurvey] = React.useState(s);
    return React.createElement(SurveyWorkspace, {
      survey,
      onChange: (next) => {
        s = next;
        setSurvey(next);
      },
      onScan: () => {},
      onSave: () => {},
      onPlan: () => {},
      signedIn: false,
      busy: false,
    });
  }
  try {
    render(React.createElement(Harness));
    assert.ok(
      screen.getByLabelText(
        `Yard ecosystem score ${summary(s).score} out of 100`,
      ),
    );
    assert.ok(screen.getByText("Provisional estimate"));
    const boxes = () =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".plant-box"));
    const rows = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(".rw-plant-page>button"),
      );
    assert.ok(boxes()[0].classList.contains("status-invasive"));
    assert.ok(rows()[0].classList.contains("status-invasive"));
    fireEvent.click(boxes()[5]);
    assert.equal(rows()[5].getAttribute("aria-pressed"), "true");
    assert.ok(rows()[5].classList.contains("status-keystone"));
    fireEvent.click(rows()[0]);
    assert.equal(boxes()[0].getAttribute("aria-pressed"), "true");
    fireEvent.click(
      reviewControl("manual"),
    );
    fireEvent.change(screen.getByLabelText("Search plants"), {
      target: { value: "Northern Red Oak" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "all" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Use Northern red oak as match/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm plant match" }));
    assert.ok(summary(s).score! > summary(legacySurvey()).score!);
    assert.ok(boxes()[0].classList.contains("status-keystone"));
    assert.ok(rows()[0].classList.contains("status-keystone"));
  } finally {
    cleanup();
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function identityUser(id: string) {
  return {
    id,
    aud: "authenticated",
    app_metadata: {},
    user_metadata: { full_name: `${id} gardener` },
    created_at: "2024-01-01T00:00:00Z",
    email: `${id}@example.test`,
  } as unknown as import("../lib/app-services").User;
}
function identityData(id: string) {
  const saved = {
    ...legacySurvey(),
    source: "upload" as const,
    id: `${id}-scan`,
    areaId: `${id}-area`,
    photoPath: `${id}/private.jpg`,
    revision: undefined,
    photo: `/private-${id}.jpg`,
  };
  return {
    properties: [
      {
        id: `${id}-property`,
        name: `Private ${id} home`,
        zip: "07645",
        yard_areas: [
          {
            id: `${id}-area`,
            property_id: `${id}-property`,
            name: `${id} garden`,
          },
        ],
      },
    ],
    surveys: [saved],
    tasks: [],
  };
}
async function identityServices(
  initial: import("../lib/app-services").User | null,
) {
  const { appServices } = await import("../lib/app-services");
  let current = initial;
  let listener: (
    next: import("../lib/app-services").User | null,
  ) => void = () => {};
  const cleared: (string | undefined)[] = [];
  const kept: { survey: import("../lib/survey").Survey; ownerId?: string }[] =
    [];
  const services: import("../lib/app-services").AppServices = {
    ...appServices,
    account: {
      ...appServices.account,
      loadAccount: async () => identityData(current?.id || "guest"),
    },
    auth: {
      currentUser: async () => current,
      subscribe: (callback) => {
        listener = callback;
        return () => {};
      },
      signIn: async () => {
        throw new Error("OAuth could not start");
      },
      signOut: async () => {
        current = null;
        listener(null);
      },
    },
    drafts: {
      readDraft: async () => null,
      keepDraft: async (survey, ownerId) => {
        kept.push({ survey, ownerId });
      },
      clearDraft: async (ownerId) => {
        cleared.push(ownerId);
      },
    },
  };
  return {
    services,
    cleared,
    kept,
    emit(next: typeof initial) {
      current = next;
      listener(next);
    },
  };
}

test("account switch clears private photos immediately and ignores a late previous-owner save", async () => {
  const { act } = await import("@testing-library/react");
  const before = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
  dom.window.history.replaceState(null, "", "/?view=properties");
  const h = await identityServices(identityUser("A"));
  const saveA =
    deferred<
      Awaited<
        ReturnType<
          import("../lib/app-services").AppServices["account"]["saveSurvey"]
        >
      >
    >();
  const loadB = deferred<ReturnType<typeof identityData>>();
  let loads = 0;
  h.services.account.loadAccount = async () =>
    ++loads === 1 ? identityData("A") : loadB.promise;
  h.services.account.saveSurvey = async () => saveA.promise;
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", { name: "My properties." });
    fireEvent.click(
      screen.getByRole("button", { name: "Open latest survey →" }),
    );
    assert.equal(
      document.querySelector(".rw-photo > img")?.getAttribute("src"),
      "/private-A.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save survey" }));
    await act(async () => {
      h.emit(identityUser("B"));
    });
    assert.equal(document.querySelector('img[src="/private-A.jpg"]'), null);
    assert.equal(screen.queryByText("Private A home"), null);
    await act(async () => {
      saveA.resolve(identityData("A").surveys[0]);
      loadB.resolve(identityData("B"));
    });
    await screen.findByRole("heading", {
      name: "That saved location is unavailable",
    });
    assert.equal(document.querySelector('img[src="/private-A.jpg"]'), null);
    assert.equal(loads, 2);
    assert.deepEqual(h.cleared, ["A"]);
    await act(async () => {
      dom.window.history.replaceState(null, "", "/?view=properties");
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: "B garden" });
    assert.equal(
      (screen.getByLabelText("Property") as HTMLSelectElement).value,
      "B-property",
    );
    await act(async () => {
      h.emit(null);
    });
    await screen.findByRole("heading", { name: /Your yard.*world worth/i });
    assert.equal(screen.queryByText("Private B home"), null);
    assert.ok(h.cleared.includes("B"));
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("auth events outrank late initialization and previous-owner account loads", async () => {
  const { act } = await import("@testing-library/react");
  const before = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
  dom.window.history.replaceState(null, "", "/?view=properties");
  const h = await identityServices(identityUser("A"));
  const initial = deferred<import("../lib/app-services").User | null>();
  const accountA = deferred<ReturnType<typeof identityData>>();
  h.services.auth.currentUser = () => initial.promise;
  let owner = "A",
    loads = 0;
  h.services.account.loadAccount = () => {
    loads++;
    return owner === "A"
      ? accountA.promise
      : Promise.resolve(identityData("B"));
  };
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await act(async () => {
      h.emit(identityUser("A"));
    });
    await waitFor(() => assert.equal(loads, 1));
    owner = "B";
    await act(async () => {
      h.emit(identityUser("B"));
    });
    await screen.findByRole("heading", { name: "B garden" });
    await act(async () => {
      accountA.resolve(identityData("A"));
      initial.resolve(identityUser("A"));
    });
    assert.equal(screen.queryByRole("heading", { name: "A garden" }), null);
    assert.equal(
      (screen.getByLabelText("Property") as HTMLSelectElement).value,
      "B-property",
    );
    assert.equal(loads, 2);
    fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "B private edit" } });
    await act(async () => {
      h.emit(identityUser("C"));
    });
    await waitFor(() =>
      assert.equal(
        (screen.getByLabelText("Name") as HTMLInputElement).value,
        "C gardener",
      ),
    );
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("an anonymous unsaved scan survives OAuth failure and guest-to-account transition", async () => {
  const { act } = await import("@testing-library/react");
  const before = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
  dom.window.history.replaceState(null, "", "/?view=analysis&resume=1");
  const h = await identityServices(null);
  const guest = {
    ...exampleSurvey(),
    source: "upload" as const,
    id: "anonymous-scan",
    photo: "/guest-photo.jpg",
  };
  h.services.drafts.readDraft = async () => guest;
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to save" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/ }),
    );
    await screen.findByText("OAuth could not start");
    assert.equal(h.kept.at(-1)?.survey.id, guest.id);
    assert.equal(h.kept.at(-1)?.ownerId, undefined);
    fireEvent.click(
      screen.getByRole("button", { name: "Return to my survey" }),
    );
    assert.equal(
      document.querySelector(".rw-photo > img")?.getAttribute("src"),
      guest.photo,
    );
    await act(async () => {
      h.emit(identityUser("A"));
    });
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    assert.equal(
      document.querySelector(".rw-photo > img")?.getAttribute("src"),
      guest.photo,
    );
    assert.equal(h.cleared.length, 0);
    assert.equal(h.kept.at(-1)?.ownerId, "A");
    await act(async () => {
      h.emit(identityUser("B"));
    });
    await screen.findByRole("heading", { name: "Start with a photo." });
    assert.equal(document.querySelector('img[src="/guest-photo.jpg"]'), null);
    assert.ok(h.cleared.includes("A"));
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("stored drafts enforce owner boundaries, expire safely, and preserve anonymous pending scans", async () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const rows = new Map<string, unknown>();
  const request = (work: () => unknown) => {
    const req = {
      result: undefined as unknown,
      onsuccess: null as (() => void) | null,
    };
    queueMicrotask(() => {
      req.result = work();
      req.onsuccess?.();
    });
    return req;
  };
  const factory = {
    open: () => {
      const open = {
        result: undefined as unknown,
        onsuccess: null as (() => void) | null,
      };
      queueMicrotask(() => {
        open.result = {
          close() {},
          transaction() {
            const tx = {
              oncomplete: null as (() => void) | null,
              objectStore: () => ({
                get: (key: string) =>
                  request(() => structuredClone(rows.get(key))),
                put: (value: unknown, key: string) =>
                  request(() => {
                    rows.set(key, structuredClone(value));
                    return key;
                  }),
                delete: (key: string) =>
                  request(() => {
                    rows.delete(key);
                  }),
              }),
            };
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          },
        };
        open.onsuccess?.();
      });
      return open;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    value: factory,
    configurable: true,
  });
  try {
    const { keepDraft, readDraft, clearDraft } =
      await import("../lib/account/draft");
    const a = identityData("A").surveys[0],
      b = identityData("B").surveys[0];
    await keepDraft(a, "A");
    assert.equal(await readDraft("B"), null);
    assert.equal(await readDraft(), null);
    assert.equal((await readDraft("A"))?.id, a.id);
    await keepDraft(b, "B");
    await clearDraft("A");
    assert.equal((await readDraft("B"))?.id, b.id);
    const anonymous = { ...exampleSurvey(), source: "upload" as const };
    await keepDraft(anonymous);
    assert.equal((await readDraft("B"))?.id, anonymous.id);
    assert.equal((await readDraft())?.id, anonymous.id);
    await clearDraft("A");
    assert.equal((await readDraft())?.id, anonymous.id);
    await clearDraft("A", anonymous.id);
    assert.equal(await readDraft(), null);
    await assert.rejects(keepDraft(a), /requires its owner/);
    rows.set("pending", { survey: a, expires: Date.now() + 10000 });
    assert.equal(await readDraft("A"), null);
    assert.equal(rows.has("pending"), false);
    rows.set("pending", { survey: anonymous, expires: Date.now() - 1 });
    assert.equal(await readDraft(), null);
    assert.equal(rows.has("pending"), false);
  } finally {
    if (before) Object.defineProperty(globalThis, "indexedDB", before);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});

test("creating a property and area continues saving the pending scan into the newly selected scope", async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
  dom.window.history.replaceState(null, "", "/?view=analysis&resume=1");
  const h = await identityServices(identityUser("A"));
  const pending = {
    ...exampleSurvey(),
    source: "upload" as const,
    id: "pending-new-home",
    zip: "07645",
    photo: "/pending-photo.jpg",
  };
  const data: {
    properties: import("../lib/account/repository").Property[];
    surveys: import("../lib/survey").Survey[];
    tasks: import("../lib/account/repository").RoadTask[];
  } = { properties: [], surveys: [], tasks: [] };
  let savedArea = "";
  h.services.drafts.readDraft = async () => pending;
  h.services.account.loadAccount = async () => structuredClone(data);
  h.services.account.addProperty = async (name, zip) => {
    data.properties.push({ id: "new-home", name, zip, yard_areas: [] });
    return "new-home";
  };
  h.services.account.addArea = async (propertyId, name) => {
    data.properties[0].yard_areas.push({
      id: "new-border",
      property_id: propertyId,
      name,
    });
    return "new-border";
  };
  h.services.account.saveSurvey = async (survey, areaId, expectedOwnerId) => {
    assert.equal(expectedOwnerId, "A");
    assert.equal(survey.id, pending.id);
    assert.equal(survey.photo, pending.photo);
    savedArea = areaId;
    const saved = {
      ...survey,
      areaId,
      photoPath: `A/${survey.id}.jpg`,
      revision: undefined,
    };
    data.surveys = [saved];
    return saved;
  };
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save survey" }));
    await screen.findByRole("heading", { name: "My properties." });
    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Our garden" },
    });
    fireEvent.change(screen.getByLabelText("NJ ZIP code"), {
      target: { value: "07645" },
    });
    fireEvent.click(screen.getByLabelText("Add property only"));
    fireEvent.click(screen.getByRole("button", { name: "Create property" }));
    await waitFor(() =>
      assert.equal(
        (screen.getByLabelText("Property") as HTMLSelectElement).value,
        "new-home",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add yard area" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New border" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create area" }));
    await screen.findByText("Survey saved to Our garden / New border.");
    assert.equal(savedArea, "new-border");
    assert.equal(
      (screen.getByLabelText("Yard area") as HTMLSelectElement).value,
      "new-border",
    );
    assert.equal(
      document.querySelector(".rw-photo > img")?.getAttribute("src"),
      pending.photo,
    );
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("yard scope is explicit, keeps background regions visible, and gates planning independently of identity", () => {
  const source = {
    ...legacySurvey(),
    source: "upload" as const,
    plants: legacySurvey()
      .plants.slice(0, 3)
      .map((plant, index) => ({
        ...plant,
        reviewed: index === 0,
        yardScope: undefined,
      })),
  };
  let latest: import("../lib/survey").Survey = source,
    changes = 0,
    plans = 0;
  function Harness() {
    const [survey, setSurvey] =
      React.useState<import("../lib/survey").Survey>(source);
    return React.createElement(SurveyWorkspace, {
      survey,
      onChange: (next) => {
        latest = next;
        changes++;
        setSurvey(next);
      },
      onScan: () => {},
      onSave: () => {},
      onPlan: () => {
        plans++;
      },
      signedIn: true,
      busy: false,
    });
  }
  const select = (index: number) => {
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".plant-box")[index]);
    if (screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: "Close plant details" }));
  };
  try {
    render(React.createElement(Harness));
    assert.equal(changes, 0);
    assert.ok(latest.plants.every((plant) => plant.yardScope === undefined));
    assert.ok(screen.getByText("Photo estimate"));
    assert.ok(screen.getByLabelText(/Photo ecosystem score .* out of 100/));
    if (!screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Native options" }));
    const pendingPlan = screen.getAllByRole("button", {
      name: "Plan this replacement",
    }) as HTMLButtonElement[];
    assert.ok(
      pendingPlan.length > 0 && pendingPlan.every((button) => button.disabled),
    );
    if (screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: "Close plant details" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore to yard" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from yard" }));
    assert.equal(latest.plants[0].yardScope, "background");
    assert.equal(document.querySelectorAll(".plant-box").length, 3);
    assert.equal(
      document.querySelectorAll(".plant-box.rw-scope-background").length,
      1,
    );
    assert.equal(summary(latest).total, 2);
    assert.ok(screen.getAllByText(/Background plants are context only/).length);
    select(1);
    fireEvent.click(screen.getByRole("button", { name: "Restore to yard" }));
    assert.ok(screen.getByText("Yard estimate"));
    assert.deepEqual(summary(latest).scope, {
      yard: 1,
      background: 1,
      unconfirmed: 1,
    });
    assert.equal(summary(latest).total, 1);
    assert.equal(latest.plants[1].reviewed, false);
    assert.ok(screen.getByText("PLANT 2 OF 3"));
    assert.equal(
      (screen.getByLabelText("Jump to a plant") as HTMLSelectElement).options
        .length,
      3,
    );
    assert.ok(
      screen.getByText(/Based on 1 confirmed yard regions out of 3 regions/),
    );
    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        ".ecosystem-counts .status-invasive",
      )!,
    );
    assert.equal(document.querySelectorAll(".plant-box").length, 1);
    assert.equal(document.querySelector(".plant-box > span")?.textContent, "2");
    assert.equal(
      document.querySelectorAll(".rw-plant-page > button").length,
      1,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear filter · Show all plants" }),
    );
    assert.equal(document.querySelectorAll(".plant-box").length, 3);
    select(0);
    if (!screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: /View plant details/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Native options" }));
    const backgroundPlan = screen.getAllByRole("button", {
      name: "Plan this replacement",
    })[0] as HTMLButtonElement;
    fireEvent.click(backgroundPlan);
    assert.equal(plans, 0);
    assert.equal(backgroundPlan.disabled, true);
    fireEvent.click(screen.getByRole("button", { name: "Restore to yard" }));
    const yardPlan = screen.getAllByRole("button", {
      name: "Plan this replacement",
    })[0] as HTMLButtonElement;
    assert.equal(yardPlan.disabled, false);
    fireEvent.click(yardPlan);
    assert.equal(plans, 1);
    // Membership remains independent of identity review.
    for (let index = 0; index < 3; index++) {
      select(index);
      if (screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: "Close plant details" }));
    if (screen.queryByRole("button", { name: "Restore to yard" })) fireEvent.click(screen.getByRole("button", { name: "Restore to yard" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from yard" }));
    }
    assert.equal(summary(latest).score, null);
    assert.ok(screen.getByLabelText("Yard ecosystem score not available"));
    assert.equal(document.querySelectorAll(".plant-box").length, 3);
    assert.ok(screen.getByText("PLANT 3 OF 3"));
    assert.deepEqual(
      latest.plants.map((plant) => plant.reviewed),
      [true, false, false],
    );
    assert.ok(screen.getByText(/No plants are marked in your yard/));
  } finally {
    cleanup();
  }
});

test("saved yard ZIP follows front/back scans and changes with the selected property", async () => {
  const { within, act } = await import("@testing-library/react");
  const before = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
  dom.window.history.replaceState(null, "", "/?view=properties");
  const h = await identityServices(identityUser("A"));
  const data = identityData("A");
  data.surveys = [];
  data.properties[0].yard_areas = [
    { id: "front", property_id: "A-property", name: "Front garden" },
    { id: "back", property_id: "A-property", name: "Back garden" },
  ];
  data.properties.push({
    id: "B-property",
    name: "Other yard",
    zip: "07960",
    yard_areas: [
      { id: "other-area", property_id: "B-property", name: "Other border" },
    ],
  });
  h.services.account.loadAccount = async () => structuredClone(data);
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", { name: "My properties." });
    for (const area of ["Front garden", "Back garden"]) {
      const card = screen
        .getByRole("heading", { name: area })
        .closest("article")!;
      fireEvent.click(
        within(card).getByRole("button", { name: "Add baseline photo" }),
      );
      const location = screen.getByLabelText("Scan location");
      assert.match(location.textContent!, new RegExp(area));
      assert.match(location.textContent!, /ZIP 07645/);
      assert.equal(screen.queryByLabelText("New Jersey ZIP code"), null);
      await act(async () => {
        dom.window.history.replaceState(null, "", "/?view=properties");
        dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
      });
    }
    fireEvent.change(screen.getByLabelText("Property"), {
      target: { value: "B-property" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan a plant or yard" }));
    assert.match(
      screen.getByLabelText("Scan location").textContent!,
      /Other yard.*ZIP 07960/,
    );
    assert.equal(screen.queryByLabelText("New Jersey ZIP code"), null);
    await act(async () => {
      dom.window.history.replaceState(null, "", "/?view=properties");
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    });
    fireEvent.change(screen.getByLabelText("Property"), {
      target: { value: "A-property" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan a plant or yard" }));
    assert.match(
      screen.getByLabelText("Scan location").textContent!,
      /ZIP 07645/,
    );
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("a one-scan ZIP override does not change the saved yard and detaches its save destination", async () => {
  const before = globalThis.fetch;
  dom.window.history.replaceState(null, "", "/?view=properties");
  const h = await identityServices(identityUser("A"));
  const data = identityData("A");
  data.surveys = [];
  h.services.account.loadAccount = async () => structuredClone(data);
  let requestedZip = "",
    saves = 0;
  h.services.account.saveSurvey = async () => {
    saves++;
    throw new Error("An unrelated scan must not be saved automatically.");
  };
  globalThis.fetch = async (url, options) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: true, accounts: true });
    assert.equal(String(url), "/api/analyze");
    requestedZip = String((options!.body as FormData).get("zip"));
    return Response.json({
      ...exampleSurvey(),
      id: "elsewhere-scan",
      source: "upload",
      zip: requestedZip,
    });
  };
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", { name: "My properties." });
    fireEvent.click(screen.getByRole("button", { name: "Add baseline photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Change location" }));
    fireEvent.change(screen.getByLabelText("New Jersey ZIP code"), {
      target: { value: "07960" },
    });
    assert.ok(screen.getByText(/This is a separate scan from Private A home/));
    assert.equal(data.properties[0].zip, "07645");
    fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
      target: {
        files: [
          new dom.window.File(["photo"], "elsewhere.jpg", {
            type: "image/jpeg",
          }),
        ],
      },
    });
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    assert.equal(requestedZip, "07960");
    assert.equal(
      (screen.getByLabelText("Property") as HTMLSelectElement).value,
      "",
    );
    assert.equal(
      (screen.getByLabelText("Yard area") as HTMLSelectElement).value,
      "",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save survey" }));
    await screen.findByRole("heading", { name: "My properties." });
    assert.equal(saves, 0);
    assert.equal(data.properties[0].zip, "07645");
    fireEvent.click(screen.getByRole("button", { name: "Scan a plant or yard" }));
    assert.equal(
      (screen.getByLabelText("New Jersey ZIP code") as HTMLInputElement).value,
      "",
    );
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("profile ZIP fallback requires actual valid metadata and never masks an invalid selected yard", async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
  try {
    for (const scenario of [
      { metadata: { default_zip: "07960" }, expected: "07960" },
      {
        metadata: { zip: "not-a-zip", preferred_zip: "07030" },
        expected: "07030",
      },
      { metadata: {}, expected: "" },
    ]) {
      dom.window.history.replaceState(null, "", "/?view=scan");
      const user = identityUser("A");
      user.user_metadata = scenario.metadata;
      const h = await identityServices(user);
      h.services.account.loadAccount = async () => ({
        properties: [],
        surveys: [],
        tasks: [],
      });
      render(React.createElement(NativeYardApp, { services: h.services }));
      await screen.findByRole("heading", { name: "What’s growing out there?" });
      if (scenario.expected) {
        assert.match(
          screen.getByLabelText("Scan location").textContent!,
          new RegExp(`Saved profile location.*ZIP ${scenario.expected}`),
        );
        assert.equal(screen.queryByLabelText("New Jersey ZIP code"), null);
      } else
        assert.equal(
          (screen.getByLabelText("New Jersey ZIP code") as HTMLInputElement)
            .value,
          "",
        );
      cleanup();
    }
    dom.window.history.replaceState(null, "", "/?view=scan");
    const user = identityUser("A");
    user.user_metadata.default_zip = "07960";
    const h = await identityServices(user);
    const data = identityData("A");
    data.properties[0].zip = "10001";
    h.services.account.loadAccount = async () => data;
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", { name: "What’s growing out there?" });
    assert.equal(
      (screen.getByLabelText("New Jersey ZIP code") as HTMLInputElement).value,
      "",
    );
    assert.ok(screen.getByText(/This property needs a valid NJ ZIP/));
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

test("guest-entered ZIP persists between scans and is used only in the scan request", async () => {
  const before = globalThis.fetch;
  dom.window.history.replaceState(null, "", "/?view=scan");
  const h = await identityServices(null);
  let requestedZip = "";
  globalThis.fetch = async (url, options) => {
    if (String(url) === "/api/capabilities")
      return Response.json({ vision: true, accounts: true });
    requestedZip = String((options!.body as FormData).get("zip"));
    return Response.json({
      ...exampleSurvey(),
      source: "upload",
      zip: requestedZip,
    });
  };
  try {
    render(React.createElement(NativeYardApp, { services: h.services }));
    await screen.findByRole("heading", { name: "What’s growing out there?" });
    fireEvent.change(screen.getByLabelText("New Jersey ZIP code"), {
      target: { value: "07030" },
    });
    fireEvent.change(screen.getByLabelText("Upload a plant or yard photo"), {
      target: {
        files: [
          new dom.window.File(["photo"], "guest.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    await screen.findByRole("heading", {
      name: "Improve your yard’s ecosystem.",
    });
    assert.equal(requestedZip, "07030");
    fireEvent.click(screen.getByRole("button", { name: "New photo" }));
    assert.equal(
      (screen.getByLabelText("New Jersey ZIP code") as HTMLInputElement).value,
      "07030",
    );
  } finally {
    cleanup();
    globalThis.fetch = before;
  }
});

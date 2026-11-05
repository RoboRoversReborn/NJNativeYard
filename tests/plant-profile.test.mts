import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
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
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, fireEvent } =
  await import("@testing-library/react");
const {
  PlantStory,
  PlantGrowingDetails,
  PlantSeasonalInterest,
  plantProfileSummary,
} = await import("../components/plant-profile");
const { SurveyWorkspace } = await import("../components/survey-workspace");
const { catalog, exactPlant, exampleSurvey } = await import("../lib/survey");
const { plantGuidance } = await import("../lib/plant-guidance");

test("recognition-only cautions remain visible in details and print without becoming planting advice", async () => {
  const { PlantCautions } = await import("../components/plant-profile");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SurveyPrintReport } =
    await import("../components/survey-print-report");
  const plant = exactPlant("Actaea pachypoda")!;
  try {
    render(React.createElement(PlantCautions, { plant }));
    assert.ok(screen.getByLabelText("Source-reported plant cautions"));
    assert.ok(screen.getByText("High"));
    assert.ok(
      document.querySelector(`a[href="${plant.horticulture!.source.url}"]`),
    );
    const s = exampleSurvey();
    s.source = "upload";
    s.plants = [
      {
        ...s.plants[0],
        plantId: plant.id,
        scientificName: plant.scientificName,
        yardScope: "background",
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(SurveyPrintReport, { survey: s }),
    );
    assert.match(html, /Source-listed toxicity/);
    assert.match(html, /Background context/);
    assert.equal(plant.landscapeContext!.recommendation, "recognition-only");
  } finally {
    cleanup();
  }
});

test("plant control instructions stay behind identity review while observation remains available", async () => {
  const { PlantNextActions } = await import("../components/plant-next-actions");
  const { curatedPlantActions } = await import("../lib/plant-actions");
  const plant = exactPlant("Berberis thunbergii")!;
  const control = curatedPlantActions(plant.id).find(
    (a) => a.kind === "control",
  )!;
  assert.ok(control);
  try {
    const view = render(
      React.createElement(PlantNextActions, { plant, reviewed: false }),
    );
    assert.equal(screen.queryByText(control.detail), null);
    assert.ok(screen.getByText(/Confirm this plant’s identity/));
    view.rerender(
      React.createElement(PlantNextActions, { plant, reviewed: true }),
    );
    assert.ok(screen.getByText(control.detail));
  } finally {
    cleanup();
  }
});

test("plant source citations stay unique for Smoketree and every catalog profile", () => {
  const smoke = exactPlant("Cotinus coggygria")!;
  const sources = plantGuidance(smoke).sources;
  assert.equal(
    sources.filter(
      (s) => s.url === "https://plants.ces.ncsu.edu/plants/cotinus-coggygria/",
    ).length,
    1,
  );
  for (const plant of catalog) {
    const refs = plantGuidance(plant).sources;
    assert.equal(new Set(refs.map((s) => s.url)).size, refs.length, plant.id);
  }
});

test("print resolves scientific-name-only regions through the same profile lookup as analysis", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SurveyPrintReport } =
    await import("../components/survey-print-report");
  const plant = exactPlant("Quercus alba")!;
  const survey = exampleSurvey();
  survey.plants = [
    {
      ...survey.plants[0],
      plantId: undefined,
      scientificName: plant.scientificName,
      suggestion: plant.commonName,
    },
  ];
  const html = renderToStaticMarkup(
    React.createElement(SurveyPrintReport, { survey }),
  );
  assert.ok(html.includes(plant.commonName));
  assert.ok(html.includes("Light:"));
  assert.ok(html.includes(plant.horticulture!.source.url));
});

test("source-backed profile presents recognition, seasons, growing facts and exact source links", () => {
  const plant = exactPlant("Quercus alba")!;
  const data = plant.horticulture!;
  try {
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PlantStory, { plant }),
        React.createElement(PlantGrowingDetails, { plant }),
        React.createElement(PlantSeasonalInterest, { plant }),
      ),
    );
    assert.ok(screen.getByRole("heading", { name: "What to look for" }));
    assert.ok(screen.getByRole("heading", { name: "A little more to notice" }));
    assert.ok(
      document.body.textContent!.includes(data.attributes.LeafShape[0]),
    );
    assert.ok(document.body.textContent!.includes(data.attributes.Width[0]));
    assert.ok(document.querySelector(`a[href="${data.source.url}"]`));
    assert.match(plantProfileSummary(plant), /tree/);
    assert.ok(document.querySelector(".plant-more-facts"));
    assert.ok(document.querySelector(".plant-wildlife"));
    assert.doesNotMatch(document.body.textContent!, /rather than a count of wildlife/);
    assert.ok(document.querySelector('.plant-profile-source summary'));
  } finally {
    cleanup();
  }
});

test("unmatched horticulture remains explicit without inventing a growing guide", () => {
  const plant = catalog.find((p) => !p.horticulture)!;
  try {
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PlantStory, { plant }),
        React.createElement(PlantGrowingDetails, { plant }),
        React.createElement(PlantSeasonalInterest, { plant }),
      ),
    );
    assert.ok(
      screen.getByText(
        /detailed horticultural reference has not yet been matched/,
      ),
    );
    assert.equal(
      screen.queryByLabelText("Source-backed growing conditions"),
      null,
    );
    assert.equal(document.querySelector(".plant-profile-source"), null);
  } finally {
    cleanup();
  }
});

test("next action checks a suggested invasive before opening replacement planning", () => {
  try {
    render(
      React.createElement(SurveyWorkspace, {
        accountsAvailable: true,
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
      screen.getByRole("button", { name: "Check a possible invasive" }),
    );
    const profile = screen.getByRole("dialog");
    assert.ok(profile.querySelector('section[data-plant-topic="recognition"]'));
    assert.ok(profile.querySelector('section[data-plant-topic="alternatives"]'));
    assert.equal(profile.querySelectorAll("details.rw-rich-topic").length, 0);
    const photo = document.querySelector(".rw-photo")!;
    assert.ok(
      photo.compareDocumentPosition(
        document.querySelector(".ecosystem-score-details")!,
      ) & 4,
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Native alternatives & yard plan",
      })[0],
    );
    for (const button of screen.queryAllByRole("button", {
      name: "Plan this replacement",
    })) {
      assert.equal((button as HTMLButtonElement).disabled, true);
      assert.ok(button.getAttribute("aria-describedby"));
    }
  } finally {
    cleanup();
  }
});

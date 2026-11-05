import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { plantExplanation, botanicalTermHelp } from "../lib/plant-explanations";
import type { ExplanationTopic } from "../lib/plant-explanations";
import { catalog, exactPlant } from "../lib/survey";

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
const { render, screen, within, cleanup, fireEvent } =
  await import("@testing-library/react");
const { PlantStory, PlantGrowingDetails, PlantSeasonalInterest } =
  await import("../components/plant-profile");
const topics: ExplanationTopic[] = [
  "recognition",
  "growing",
  "habitat",
  "seasonal",
];

test("each disclosure uses exactly the documented source values without mutating profiles or inventing missing fields", () => {
  for (const plant of catalog) {
    for (const topic of topics) {
      const explanation = plantExplanation(plant, topic);
      if (!plant.horticulture) {
        assert.equal(explanation, null);
        continue;
      }
      assert.ok(explanation);
      assert.equal(explanation.source.url, plant.horticulture.source.url);
      assert.equal(
        explanation.source.checkedOn,
        plant.horticulture.source.checkedOn,
      );
      assert.equal(explanation.sourceTaxon, plant.horticulture.sourceTaxon);
      for (const fact of explanation.facts) {
        assert.deepEqual(fact.values, [
          ...new Set(plant.horticulture.attributes[fact.field]),
        ]);
        assert.ok(fact.label);
      }
    }
  }
  const plant = exactPlant("Quercus alba")!;
  const explanation = plantExplanation(plant, "recognition")!;
  explanation.facts[0].values[0] = "Changed";
  assert.notEqual(
    plantExplanation(plant, "recognition")!.facts[0].values[0],
    "Changed",
  );
  assert.deepEqual(
    botanicalTermHelp({
      field: "Attracts",
      label: "Wildlife",
      values: ["Opposite"],
    }),
    [],
  );
});

test("independent disclosures retain full source facts, accessible focus and close-up action without alternate reading modes", () => {
  const plant = exactPlant("Quercus alba")!;
  const before = JSON.stringify(plant);
  let closeups = 0;
  try {
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PlantStory, {
          plant,
          onCloseUp: () => {
            closeups++;
          },
        }),
        React.createElement(PlantGrowingDetails, { plant }),
        React.createElement(PlantSeasonalInterest, { plant }),
      ),
    );
    const recognition = screen.getByRole("region", {
      name: "What to look for",
    });
    const growing = screen.getByRole("region", {
      name: "A place where it can fit",
    });
    const button = within(recognition).getByRole("button", {
      name: "Explore details",
    });
    const body = document.getElementById(
      button.getAttribute("aria-controls")!,
    )!;
    const facts = () =>
      Array.from(body.querySelectorAll(".plant-depth-source-value")).map(
        (el) => el.textContent,
      );
    const sourceFacts = plantExplanation(plant, "recognition")!.facts.map(
      (fact) => fact.values.join(" · "),
    );
    assert.equal(body.hidden, true);
    assert.deepEqual(facts(), sourceFacts);
    button.focus();
    fireEvent.click(button);
    assert.equal(document.activeElement, button);
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(body.hidden, false);
    assert.deepEqual(facts(), sourceFacts);
    assert.ok(sourceFacts.length > 10);
    assert.equal(
      within(growing)
        .getByRole("button", { name: "Explore details" })
        .getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      screen.queryByRole("button", { name: /Simplify|Show full explanation/ }),
      null,
    );
    assert.equal(body.hasAttribute("data-reading-depth"), false);
    assert.equal(within(recognition).queryByText(/Compare these botanical features together/), null);
    const sourceDisclosure = within(recognition).getByText("Plant source").closest("details")!;
    fireEvent.click(sourceDisclosure.querySelector("summary")!);
    assert.ok(within(recognition).getByRole("link", { name: /NC State Extension/ }));
    const glossary = within(recognition)
      .getByText("Botanical terms in this section")
      .closest("details")!;
    assert.equal(glossary.open, false);
    fireEvent.click(
      within(recognition).getByText("Botanical terms in this section"),
    );
    assert.ok(within(recognition).getByText("The leaf edge has no teeth."));
    assert.ok(
      within(recognition).getByRole("link", {
        name: /Oregon State University botanical glossary/,
      }),
    );
    fireEvent.click(button);
    assert.equal(body.hidden, true);
    assert.deepEqual(facts(), sourceFacts);
    fireEvent.click(
      screen.getByRole("button", { name: "Compare a leaf or flower close-up" }),
    );
    assert.equal(closeups, 1);
    assert.equal(JSON.stringify(plant), before);
  } finally {
    cleanup();
  }
});

test("full details keep genus limits, source cautions, seasonal uncertainty and source values", () => {
  const genus = catalog.find(
    (plant) => plant.horticulture?.taxonScope === "genus",
  )!;
  const caution = exactPlant("Actaea pachypoda")!;
  try {
    const view = render(React.createElement(PlantStory, { plant: genus }));
    const recognition = screen.getByRole("region", {
      name: "What to look for",
    });
    fireEvent.click(
      within(recognition).getByRole("button", { name: "Explore details" }),
    );
    assert.ok(within(recognition).getByText("Genus-level reference."));
    view.rerender(React.createElement(PlantGrowingDetails, { plant: caution }));
    assert.ok(screen.getByLabelText("Source-reported plant cautions"));
    const growing = screen.getByRole("region", {
      name: "Conditions in the reference",
    });
    fireEvent.click(
      within(growing).getByRole("button", { name: "Explore details" }),
    );
    assert.ok(
      within(screen.getByLabelText("Source-reported plant cautions")).getByText(
        "High",
      ),
    );
    assert.ok(screen.getByText(caution.landscapeContext!.note));
    assert.equal(screen.queryByRole("button", { name: /Plan/ }), null);
    view.rerender(
      React.createElement(PlantSeasonalInterest, {
        plant: exactPlant("Vaccinium corymbosum")!,
      }),
    );
    const seasonal = screen.getByRole("region", {
      name: "A little more to notice",
    });
    fireEvent.click(
      within(seasonal).getByRole("button", { name: "Explore details" }),
    );
    assert.equal(within(seasonal).queryByText(/not an NJ-specific calendar/), null);
    assert.equal(within(seasonal).queryByText(/timing in your NJ yard can vary/), null);
    assert.equal(
      seasonal.querySelector(
        '[data-source-field="FlowerBloomTime"] .plant-depth-source-value',
      )?.textContent,
      "Spring",
    );
    assert.equal(
      seasonal.querySelector(
        '[data-source-field="FruitDisplayTime"] .plant-depth-source-value',
      )?.textContent,
      "Summer",
    );
  } finally {
    cleanup();
  }
});

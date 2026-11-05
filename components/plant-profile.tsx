"use client";
import { useId, useState, type ReactNode } from "react";
import { Flower2, Leaf, Sun } from "lucide-react";
import type { Plant } from "@/lib/types";
import { plantStory } from "@/lib/plant-stories";
import {
  plantExplanation,
  botanicalTermHelp,
  BOTANICAL_TERM_SOURCE,
  type ExplanationFact,
  type PlantExplanation,
} from "@/lib/plant-explanations";

function values(plant: Plant, ...keys: string[]) {
  return [
    ...new Set(
      keys.flatMap((key) => plant.horticulture?.attributes[key] || []),
    ),
  ];
}
function list(words: string[]) {
  return new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(words);
}
function ExplanationFacts({ facts }: { facts: ExplanationFact[] }) {
  return facts.length ? (
    <dl className="plant-trait-grid plant-depth-facts">
      {facts.map((fact) => (
        <div key={fact.field} data-source-field={fact.field}>
          <dt>{fact.label}</dt>
          <dd>
            <span className="plant-depth-source-value">
              {fact.values.join(" · ")}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="plant-profile-missing">Not documented in this profile.</p>
  );
}

function PlantExplanationView({
  plant,
  explanation,
  title,
  summary,
  className = "",
  inline = false,
}: {
  plant: Plant;
  explanation: PlantExplanation;
  icon: ReactNode;
  title?: string;
  summary?: ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const bodyId = `${id}-body`,
    headingId = `${id}-heading`;
  const summaryFacts = explanation.facts.filter((fact) =>
    explanation.summaryFields.includes(fact.field),
  );
  const terms = [
    ...new Map(
      explanation.facts
        .flatMap(botanicalTermHelp)
        .map((term) => [term.term, term]),
    ).values(),
  ];
  return (
    <section
      className={`plant-explanation ${className}`}
      aria-labelledby={headingId}
      data-explanation-topic={explanation.topic}
    >
      <div className="plant-section-title">
        <h3 id={headingId}>{title || explanation.title}</h3>
      </div>
      {plant.horticulture?.taxonScope === "genus" && <p className="micro">Genus-level reference.</p>}
      <div className="plant-explanation-summary" hidden={expanded || inline}>
        {summary ||
          (summaryFacts.length ? (
            <ExplanationFacts facts={summaryFacts} />
          ) : (
            <p className="plant-profile-missing">
              {explanation.topic === "habitat"
                ? "Wildlife associations are not documented in this profile."
                : "Not documented in this profile."}
            </p>
          ))}
      </div>
      {!inline && (
        <div className="plant-depth-controls">
          <button
            type="button"
            className="secondary"
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-describedby={headingId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide details" : "Explore details"}
          </button>
        </div>
      )}
      <div
        className="plant-more-facts plant-explanation-panel"
        id={bodyId}
        hidden={!expanded && !inline}
      >
        <ExplanationFacts facts={explanation.facts} />
        {terms.length > 0 && (
          <details className="plant-term-glossary">
            <summary>Botanical terms in this section</summary>
            <dl>
              {terms.map((note) => (
                <div key={note.term}>
                  <dt>{note.term}</dt>
                  <dd>{note.meaning}</dd>
                </div>
              ))}
            </dl>
            <p className="plant-term-source">
              <a
                href={BOTANICAL_TERM_SOURCE.url}
                target="_blank"
                rel="noreferrer"
              >
                {BOTANICAL_TERM_SOURCE.label} ↗
              </a>

            </p>
          </details>
        )}
      </div>
      <PlantHorticultureSource plant={plant} />

    </section>
  );
}
export function PlantHorticultureSource({ plant, plain = false }: { plant: Plant; plain?: boolean }) {
  const data = plant.horticulture;
  if (!data) return null;
  const credit = <>
    <a href={data.source.url} target="_blank" rel="noreferrer">{data.source.label} ↗</a>
    <span>Profile: {data.sourceTaxon} · Checked {data.source.checkedOn}</span>
    {data.taxonScope === "genus" && <span>Genus-level reference: individual species and cultivars can differ.</span>}
  </>;
  return plain ? <p className="plant-profile-source">{credit}</p> : <details className="plant-profile-source">
    <summary>Plant source{data.taxonScope === "genus" ? " · genus-level" : ""}</summary>{credit}
  </details>;
}
export function plantProfileSummary(plant: Plant) {
  const story = plantStory(plant);
  if (story) return story.opening;
  if (!plant.horticulture) return plant.description;
  const types = values(plant, "PlantType").filter((v) =>
      /^(tree|shrub|vine|fern|grass|herb|bulb|succulent|ground cover)$/i.test(
        v,
      ),
    ),
    forms = values(plant, "GrowthHabit"),
    foliage = values(plant, "LeafCharacteristics"),
    bloom = values(plant, "FlowerBloomTime"),
    colours = values(plant, "FlowerColor");
  const kind =
    types[0]?.toLowerCase() ||
    (values(plant, "PlantType").some((t) => /herbaceous/i.test(t))
      ? "herbaceous plant"
      : "plant");
  const opening = `${plant.commonName} is ${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind}.`;
  return (
    opening +
    (forms.length
      ? ` Its recorded form is ${list(forms.map((s) => s.toLowerCase()))}.`
      : "") +
    (foliage.length
      ? ` Foliage is ${list(foliage.map((s) => s.toLowerCase()))}.`
      : "") +
    (bloom.length
      ? ` Flowering is reported in ${list(bloom.map((s) => s.toLowerCase()))}${colours.length ? `, with ${list(colours.map((s) => s.toLowerCase()))} flowers` : ""}.`
      : "")
  );
}
export function PlantStory({
  plant,
  onCloseUp,
  narrativeOnly = false,
}: {
  plant: Plant;
  onCloseUp?: () => void;
  narrativeOnly?: boolean;
}) {
  const story = plantStory(plant);
  if (!plant.horticulture)
    return (
      <>
        <p>{plant.description}</p>
        <p className="plant-profile-missing">
          A detailed horticultural reference has not yet been matched to this
          profile. Check the species or cultivar before relying on its care
          notes.
        </p>
      </>
    );
  return (
    <section
      className="plant-story"
      aria-label="Plant appearance and recognition"
    >
      <p>{plantProfileSummary(plant)}</p>
      {!narrativeOnly && story && (
        <aside className="plant-discovery-prompt">
          <strong>Take a closer look</strong>
          <p>{story.recognitionCue}</p>
          <p>{story.nextObservation}</p>
          {onCloseUp && (
            <button className="secondary" onClick={onCloseUp}>
              Compare a leaf or flower close-up
            </button>
          )}
        </aside>
      )}
      {!narrativeOnly && (
        <PlantExplanationView
          key={`${plant.id}:recognition`}
          plant={plant}
          explanation={plantExplanation(plant, "recognition")!}
          icon={<Leaf size={16} aria-hidden="true" />}
        />
      )}
    </section>
  );
}

export function PlantGrowingDetails({
  plant,
  inline = false,
  includeHabitat = true,
}: {
  plant: Plant;
  inline?: boolean;
  includeHabitat?: boolean;
}) {
  const growing = plantExplanation(plant, "growing");
  const habitat = plantExplanation(plant, "habitat");
  if (!growing || !habitat) return null;
  return (
    <section
      className="plant-growing-details"
      aria-label="Source-backed growing conditions"
    >
      {plant.landscapeContext && (
        <aside className="plant-site-context">
          <strong>
            {plant.landscapeContext.recommendation === "recognition-only"
              ? "Learn about this plant"
              : "Before choosing a spot"}
          </strong>
          <p>{plant.landscapeContext.note}</p>
          {plant.landscapeContext.recommendation === "site-conditioned" &&
            plant.landscapeContext.gardenSettings.length > 0 && (
              <small>
                Source-listed settings:{" "}
                {plant.landscapeContext.gardenSettings.join(" · ")}
              </small>
            )}
          <a
            href={plant.landscapeContext.source.url}
            target="_blank"
            rel="noreferrer"
          >
            {plant.landscapeContext.source.label} ↗
          </a>
        </aside>
      )}
      <PlantCautions plant={plant} />
      <PlantExplanationView
        key={`${plant.id}:growing`}
        plant={plant}
        explanation={growing}
        inline={inline}
        title={
          plant.landscapeContext?.recommendation === "recognition-only"
            ? "Conditions in the reference"
            : "A place where it can fit"
        }
        icon={<Sun size={16} aria-hidden="true" />}
      />
      {includeHabitat && habitat.facts.length > 0 && (
        <PlantExplanationView
          key={`${plant.id}:habitat`}
          plant={plant}
          explanation={habitat}
          inline={inline}
          className="plant-wildlife"
          icon={<Leaf size={16} aria-hidden="true" />}
        />
      )}
    </section>
  );
}

export function PlantCautions({ plant }: { plant: Plant }) {
  const caution = plant.sourceCautions;
  const fields = [
    ["Poison Severity", "Source-listed toxicity"],
    ["Causes Contact Dermatitis", "Skin irritation reported"],
    ["Poison Part", "Plant parts listed"],
  ];
  const entries = fields.flatMap(([key, label]) =>
    caution?.facts[key]?.length ? [{ label, values: caution.facts[key] }] : [],
  );
  if (!caution || !entries.length) return null;
  return (
    <aside
      className="plant-source-cautions"
      aria-label="Source-reported plant cautions"
    >
      <h3>What to know before handling</h3>
      <dl>
        {entries.map(({ label, values }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{values.join(" · ")}</dd>
          </div>
        ))}
      </dl>
      <a href={caution.source.url} target="_blank" rel="noreferrer">
        {caution.source.label} ↗
      </a>
    </aside>
  );
}

export function PlantSeasonalInterest({
  plant,
  inline = false,
}: {
  plant: Plant;
  inline?: boolean;
}) {
  if (!plant.horticulture) return null;
  const entries = [
    {
      label: "Flowers",
      timing: values(plant, "FlowerBloomTime"),
      detail: values(plant, "FlowerColor"),
    },
    {
      label: "Fruit & seeds",
      timing: values(plant, "FruitDisplayTime"),
      detail: values(plant, "FruitType", "FruitColor"),
    },
    {
      label: "Autumn foliage",
      timing: values(plant, "LeafFallColor").length ? ["Autumn"] : [],
      detail: values(plant, "LeafFallColor"),
    },
  ].filter((e) => e.timing.length);
  const explanation = plantExplanation(plant, "seasonal")!;
  return entries.length ? (
    <section
      className="plant-seasonal-interest"
      aria-label="Seasonal plant interest"
    >
      <PlantExplanationView
        key={`${plant.id}:seasonal`}
        plant={plant}
        explanation={explanation}
        inline={inline}
        icon={<Flower2 size={16} aria-hidden="true" />}
        summary={
          <div className="plant-season-cards">
            {entries.map((entry) => (
              <article key={entry.label}>
                <span>{entry.label}</span>
                <strong>{entry.timing.join(" · ")}</strong>
                {entry.detail.length > 0 && <p>{entry.detail.join(" · ")}</p>}
              </article>
            ))}
          </div>
        }
      />
    </section>
  ) : null;
}

export function PlantRecognitionCues({
  plant,
  onCloseUp,
}: {
  plant: Plant;
  onCloseUp?: () => void;
}) {
  const story = plantStory(plant);
  return story ? (
    <aside className="plant-discovery-prompt">
      <strong>Take a closer look</strong>
      <p>{story.recognitionCue}</p>
      <p>{story.nextObservation}</p>
      {onCloseUp && (
        <button className="secondary" onClick={onCloseUp}>
          Compare a leaf or flower close-up
        </button>
      )}
    </aside>
  ) : (
    <p>
      Detailed identifying features are unavailable for this match.
    </p>
  );
}
export function PlantBotanicalTraits({ plant }: { plant: Plant }) {
  const explanation = plantExplanation(plant, "recognition");
  return explanation ? (
    <PlantExplanationView
      plant={plant}
      explanation={explanation}
      title="Botanical features"
      icon={<Leaf size={16} aria-hidden="true" />}
      inline
    />
  ) : (
    <p>Detailed botanical traits have not been matched to this profile.</p>
  );
}
export function PlantHabitatDetails({ plant }: { plant: Plant }) {
  const explanation = plantExplanation(plant, "habitat");
  return explanation ? (
    <PlantExplanationView
      plant={plant}
      explanation={explanation}
      icon={<Leaf size={16} aria-hidden="true" />}
      inline
    />
  ) : (
    <p>Wildlife and habitat associations are not documented in this profile.</p>
  );
}
/** Plain complete content for print: no collapsed UI or display preference can omit a fact. */
export function PlantCompleteReference({ plant }: { plant: Plant }) {
  return (
    <>
      {(["recognition", "growing", "habitat", "seasonal"] as const).map(
        (topic) => {
          const explanation = plantExplanation(plant, topic);
          if (!explanation) return null;
          const terms = [
            ...new Map(
              explanation.facts
                .flatMap(botanicalTermHelp)
                .map((term) => [term.term, term]),
            ).values(),
          ];
          return (
            <section key={topic}>
              <h4>{explanation.title}</h4>
              <ExplanationFacts facts={explanation.facts} />
              {terms.length > 0 && (
                <>
                  <h5>Botanical terms</h5>
                  <dl>
                    {terms.map((term) => (
                      <div key={term.term}>
                        <dt>{term.term}</dt>
                        <dd>{term.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                  <a href={BOTANICAL_TERM_SOURCE.url}>
                    {BOTANICAL_TERM_SOURCE.label}
                  </a>
                </>
              )}
              <PlantHorticultureSource plant={plant} plain />
            </section>
          );
        },
      )}
    </>
  );
}

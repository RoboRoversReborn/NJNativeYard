import { ArrowUpRight, Leaf } from "lucide-react";
import { summary, scoreContributions, SCORE_WEIGHTS, assessmentScope, pendingPlantLabel, regionStatus, type Survey } from "@/lib/survey";
import type { PlantStatus } from "@/lib/types";
const labels = {
  keystone: "Keystone natives",
  native: "Other natives",
  "non-native": "Non-native",
  invasive: "Invasive",
  unverified: "Needs review",
};
const explanations = {
  keystone: "Strong native food-web support",
  native: "Other plants native to NJ",
  "non-native": "Introduced plants",
  invasive: "Listed ecological concern",
  unverified: "Identity or NJ role needs checking",
};
const points = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(1)}`;
export function EcosystemScore({
  survey,
  onCategory,
  onImprove = () => {},
  activeCategory = null,
  onReset,
  improveLabel = "Find my next improvement",
  variant = "full",
}: {
  survey: Survey;
  onCategory: (status: PlantStatus | "unverified") => void;
  onImprove?: () => void;
  activeCategory?: PlantStatus | "unverified" | null;
  onReset?: () => void;
  improveLabel?: string;
  variant?: "full" | "summary" | "filters";
}) {
  const stats = summary(survey),
    composition = scoreContributions(survey),
    selected = composition.entries.find((e) => e.status === activeCategory);
  const pending = assessmentScope(survey).plants.filter((plant) => regionStatus(plant) === "unverified");
  const statusPending = pending.filter((plant) => pendingPlantLabel(plant) === "NJ status pending").length;
  const identityPending = pending.length - statusPending;
  const scopeLabel =
    stats.assessmentScope === "photo"
      ? "Photo estimate"
      : stats.assessmentScope === "yard"
        ? "Yard estimate"
        : "Illustrative yard estimate";
  const scoreLabel =
    stats.assessmentScope === "photo"
      ? "Photo ecosystem score"
      : "Yard ecosystem score";
  return (
    <section
      className={`ecosystem-dashboard ecosystem-compact ${variant === "filters" ? "ecosystem-filters" : ""}`}
      aria-label={
        variant === "filters"
          ? "Plant mix and category filters"
          : stats.assessmentScope === "photo"
            ? "Photo ecosystem assessment"
            : "Yard ecosystem assessment"
      }
    >
      {variant !== "filters" && (
        <div className="ecosystem-score-main">
          <div
            className="ecosystem-score-number"
            aria-label={`${scoreLabel} ${stats.score === null ? "not available" : `${stats.score} out of 100`}`}
            style={{
              background:
                stats.score === null
                  ? "#355569"
                  : `conic-gradient(#35c9a0 ${stats.score}%, #355569 0)`,
            }}
          >
            <div className="ecosystem-score-inner">
              <strong>{stats.score ?? "—"}</strong>
              <span>/100</span>
            </div>
          </div>
          <div className="ecosystem-score-copy">
            <p className="eyebrow">{scopeLabel}</p>
            <h2>{stats.grade}</h2>
            <span
              className={`assessment-state ${stats.provisional ? "provisional" : "reviewed"}`}
            >
              {!stats.total && survey.source === "upload"
                ? "No included yard plants"
                : stats.provisional
                  ? "Provisional estimate"
                  : "Identities reviewed"}
            </span>
            <p className="ecosystem-brief">
              {stats.total} included plant regions · {stats.assessed} with NJ
              categories · {stats.reviewed} identities checked
            </p>
          </div>
          <button className="primary" onClick={onImprove}>
            {improveLabel}
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      {variant !== "filters" && survey.source === "upload" && (
        <div
          className="assessment-yard-scope"
          aria-label="Plant region yard scope"
        >
          <div className="assessment-scope-counts">
            <span>
              <strong>{stats.scope.yard}</strong> In my yard
            </span>
            <span>
              <strong>{stats.scope.background}</strong> Background
            </span>
            <span>
              <strong>{stats.scope.unconfirmed}</strong> Not sure
            </span>
          </div>
          <p>
            {stats.assessmentScope === "photo"
              ? `Yard boundaries aren’t confirmed. This photo estimate includes ${stats.total} unconfirmed regions; background is excluded. Mark plants in your yard to start a yard estimate.`
              : !stats.total
                ? "No plants are marked in your yard. Background plants remain available to explore and are excluded from the yard estimate."
                : `Based on ${stats.total} confirmed yard regions out of ${survey.plants.length} regions in this photo. Background and ${stats.scope.unconfirmed} unconfirmed regions are excluded.`}
          </p>
        </div>
      )}
      {variant !== "summary" && (
        <>
          <div className="ecosystem-composition">
            <div className="composition-heading">
              <h3>Share of included plant regions</h3>
              <span>
                {stats.total} regions in this estimate · select a category to
                filter
              </span>
            </div>
            <div
              className="composition-track"
              role="group"
              aria-label="Share of included plant regions by category"
            >
              {composition.entries
                .filter((e) => e.count > 0)
                .map((e) => (
                  <button
                    key={e.status}
                    className={`status-${e.status} ${activeCategory && activeCategory !== e.status ? "composition-dim" : ""}`}
                    style={{ flex: e.count }}
                    aria-label={`${labels[e.status]}: ${Math.round(e.regionShare)}% of ${survey.source === "upload" ? "included" : "detected"} plant regions`}
                    aria-pressed={activeCategory === e.status}
                    onClick={() => onCategory(e.status)}
                  >
                    <span>
                      {e.regionShare >= 10
                        ? `${Math.round(e.regionShare)}%`
                        : ""}
                    </span>
                  </button>
                ))}
              {!stats.total && <span>No included plant regions</span>}
            </div>
          </div>
          <div
            className="ecosystem-counts"
            role="group"
            aria-label="Filter plants by ecological category"
          >
            {Object.entries(stats.counts).filter(([key]) => key !== "unverified").map(([key, count]) => (
              <button
                key={key}
                className={`status-${key}`}
                aria-pressed={activeCategory === key}
                onClick={() => onCategory(key as PlantStatus | "unverified")}
                disabled={!count}
              >
                <span className="ecosystem-count-icon">
                  <Leaf size={14} />
                </span>
                <strong>{count}</strong>
                <small className="category-share">
                  {stats.total ? Math.round((count / stats.total) * 100) : 0}%
                </small>
                <span className="category-label">
                  {labels[key as keyof typeof labels]}
                </span>
                <small className="category-gloss">
                  {explanations[key as keyof typeof explanations]}
                </small>
              </button>
            ))}
          </div>
          {pending.length > 0 && <div className="ecosystem-pending-review" aria-label="Pending verification">
            <div><strong>Needs review · {pending.length}</strong><p>{[statusPending ? `${statusPending} NJ status pending` : null, identityPending ? `${identityPending} Plant not identified` : null].filter(Boolean).join(" · ")}</p><small>Awaiting classification, separate from the four ecological categories.</small></div>
            <button className="text-button" aria-pressed={activeCategory === "unverified"} onClick={() => onCategory("unverified")}>Review pending plants</button>
          </div>}
          {selected && activeCategory && (
            <div className="ecosystem-filter-state" role="status">
              <span>
                Showing {labels[activeCategory].toLowerCase()} ·{" "}
                {selected?.count || 0} included regions ·{" "}
                <strong>{points(selected.points)} score points</strong>
              </span>
              <button className="text-button" onClick={onReset}>
                Clear filter · Show all plants
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function EcosystemScoreDetails({
  survey,
  activeCategory = null,
}: {
  survey: Survey;
  activeCategory?: PlantStatus | "unverified" | null;
}) {
  const stats = summary(survey),
    composition = scoreContributions(survey),
    selected = composition.entries.find((e) => e.status === activeCategory);
  let position = 0;
  const steps = [
    ...composition.entries
      .filter((e) => e.status !== "unverified")
      .map((e) => ({
        label: e.status === "invasive" ? "Invasive weight" : labels[e.status],
        value: e.points,
        status: e.status,
      })),
    {
      label: "Shared native bonuses",
      value: composition.bonuses,
      status: "keystone",
    },
    {
      label: "Display floor / rounding / limit",
      value: composition.adjustment,
      status: "unverified",
    },
  ].map((step) => {
    const start = position;
    position += step.value;
    return { ...step, start, end: position };
  });
  const minimum = Math.min(0, ...steps.map((s) => s.end)),
    maximum = Math.max(1, ...steps.map((s) => s.end)),
    span = maximum - minimum;
  return (
    <details className="ecosystem-score-details">
      <summary>
        Understand your estimate <span>Score impact & method</span>
      </summary>
      <div className="score-details-body">
        <p>
          Plant percentages use the {stats.total} regions included in this
          estimate, not land area.
          {survey.source === "upload" &&
            (stats.assessmentScope === "photo"
              ? " This is photo context until you mark plants in your yard; background is excluded."
              : " Only regions marked ‘In my yard’ contribute; background and unconfirmed regions are excluded.")}{" "}
          The ecosystem estimate uses distinct species with an assessed NJ
          category. Plants awaiting classification earn no native points.
        </p>
        {selected && (
          <div
            className={`category-impact status-${selected.status}`}
            aria-label="Selected category score contribution"
          >
            <div
              className="category-impact-ring"
              style={{
                background: `conic-gradient(var(--status) ${selected.regionShare}%, #e4eaf0 0)`,
              }}
              aria-hidden="true"
            >
              <span>
                {Math.round(selected.regionShare)}
                <small>%</small>
              </span>
            </div>
            <div className="category-impact-copy">
              <span className="eyebrow">{labels[selected.status]}</span>
              <h3>
                {selected.count} of {stats.total} included plant regions
              </h3>
              <p>{explanations[selected.status]}</p>
            </div>
            <div className="category-impact-score">
              <strong>{points(selected.points)}</strong>
              <span>
                score points{selected.status === "invasive" ? " · invasive weight" : selected.status === "non-native" ? " · non-native weight" : ""}
              </span>
            </div>
          </div>
        )}
        {stats.score !== null && (
          <div className="score-waterfall" aria-label="Score impact in points">
            <div className="score-waterfall-heading">
              <strong>How the points add up</strong>
              <span>{stats.score}/100 total</span>
            </div>
            {steps
              .filter((s) => Math.abs(s.value) > 0.001)
              .map((step) => (
                <div
                  className={`score-waterfall-row status-${step.status}`}
                  key={step.label}
                >
                  <span>{step.label}</span>
                  <div className="score-waterfall-track" aria-hidden="true">
                    <i
                      className="score-zero-line"
                      style={{ left: `${(-minimum / span) * 100}%` }}
                    />
                    <i
                      className={step.value < 0 ? "score-step-negative" : ""}
                      style={{
                        left: `${((Math.min(step.start, step.end) - minimum) / span) * 100}%`,
                        width: `${(Math.abs(step.value) / span) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{points(step.value)}</strong>
                </div>
              ))}
          </div>
        )}
        {stats.rawScore !== null && <p>Raw signed index: {stats.rawScore.toFixed(1)}. The displayed index is limited to 0–100; the display floor adds no ecological credit.</p>}
        <details className="score-formula">
          <summary>How this estimate works</summary>
          <p>
            Each distinct assessed species contributes once: keystone native
            {SCORE_WEIGHTS.keystone}, other NJ native {SCORE_WEIGHTS.native}, non-native {SCORE_WEIGHTS["non-native"]}, invasive {SCORE_WEIGHTS.invasive}. Average those
            signed points, add 5
            for any keystone and 5 for at least three distinct native species,
            then limit the result to 0–100. Repeated boxes for the same species
            add no bonus.
          </p>

        </details>
      </div>
    </details>
  );
}

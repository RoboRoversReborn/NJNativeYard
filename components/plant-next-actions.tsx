import type { Plant } from "@/lib/types";
import { curatedPlantActions } from "@/lib/plant-actions";

export function PlantNextActions({
  plant,
  reviewed,
  onReview,
}: {
  plant: Plant;
  reviewed: boolean;
  onReview?: () => void;
}) {
  const actions = curatedPlantActions(plant.id);
  if (!actions.length) return null;
  return (
    <section
      className="plant-next-actions"
      aria-label="Plant-specific seasonal next steps"
    >
      <h3>Next steps for {plant.commonName}</h3>
      <p className="plant-action-scope">
        Use the plant’s stage and local conditions. Source seasons are guidance,
        not fixed New Jersey dates.
      </p>
      <div className="rw-action-list">
        {actions.map((action) => {
          const gated =
            action.kind === "control" &&
            action.identificationRequired &&
            !reviewed;
          return (
            <article
              className={`plant-action-${action.kind}`}
              key={`${action.source.url}:${action.title}`}
            >
              <span className="plant-action-kind">
                {action.kind === "observe"
                  ? "Notice"
                  : action.kind === "care"
                    ? "Care"
                    : "Control"}
              </span>
              <div>
                <small>{action.season}</small>
                <h3>{action.title}</h3>
                {gated ? (
                  <>
                    <p>
                      Confirm this plant’s identity before using the
                      species-specific control instructions.
                    </p>
                    {onReview && (
                      <button className="secondary" onClick={onReview}>
                        Review this plant match
                      </button>
                    )}
                  </>
                ) : (
                  <p>{action.detail}</p>
                )}
                {action.identificationRequired && !reviewed && !gated && (
                  <p className="plant-action-condition">
                    Use this care advice only if the plant match is correct.
                  </p>
                )}
                <a
                  className="plant-action-source"
                  href={action.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {action.source.label} ↗
                </a>
                <p className="plant-action-scope">{action.scope}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

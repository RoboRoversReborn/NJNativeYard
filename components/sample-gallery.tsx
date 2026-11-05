import { ArrowUpRight, ScanLine } from "lucide-react";
import { sampleYards, type SampleYard } from "@/lib/sample-yards";
import { summary } from "@/lib/survey";
export function SampleCredit({ sample }: { sample: SampleYard }) {
  return (
    <span className="sample-photo-credit">
      <a
        className="sample-credit"
        href={sample.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        {sample.imageKind === "generated-illustration"
          ? "Generated garden illustration · authored sample plant map"
          : sample.credit}
      </a>
      {sample.licenseUrl && (
        <>
          {" "}
          ·{" "}
          <a
            className="sample-credit"
            href={sample.licenseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Photo license
          </a>
        </>
      )}
    </span>
  );
}
export function SampleGallery({
  onExample,
  disabled = false,
}: {
  onExample: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <section
      className="sample-gallery ny-section"
      id="examples"
      tabIndex={-1}
      aria-labelledby="sample-heading"
    >
      <div className="sample-gallery-heading">
        <div>
          <p className="eyebrow">TRY IT FIRST · NO UPLOAD NEEDED</p>
          <h2 id="sample-heading">
            Three yards.
            <br />
            <em>Plenty of possibilities.</em>
          </h2>
        </div>
        <p>
          Pick a sample yard. See its ecosystem score, explore the plants, and
          discover the small changes that could make a difference.
        </p>
      </div>
      <div className="sample-cards">
        {sampleYards.map((sample) => {
          const stats = summary(sample);
          return (
            <article className="sample-card" key={sample.id}>
              <button
                className="sample-photo-button"
                disabled={disabled}
                onClick={() => onExample(sample.id)}
                aria-label={`Explore ${sample.title}`}
              >
                <img src={sample.photo} alt={sample.title} loading="lazy" />
                <span className="sample-preview-score">
                  <strong>{stats.score ?? "—"}</strong>/100{" "}
                  <small>Sample ecosystem score</small>
                </span>
                <span className="sample-photo-action">
                  <ScanLine size={16} /> Explore this garden{" "}
                  <ArrowUpRight size={16} />
                </span>
              </button>
              <div className="sample-card-body">
                <h3>{sample.title}</h3>
                <p>{sample.description}</p>
                <div className="sample-card-footer">
                  <span>{sample.plants.length} plants to explore</span>
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() => onExample(sample.id)}
                    aria-label={`Open example: ${sample.title}`}
                  >
                    Explore this garden <ArrowUpRight size={15} />
                  </button>
                </div>
                <SampleCredit sample={sample} />
              </div>
            </article>
          );
        })}
      </div>
      <p className="sample-explainer">
        Illustrative samples. Try the same dashboard and plant-review tools
        you’ll use with your own yard.
      </p>
    </section>
  );
}

"use client";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  Compass,
  Leaf,
  ScanLine,
  Sprout,
} from "lucide-react";
import { SampleCredit } from "./sample-gallery";
import { sampleYards } from "@/lib/sample-yards";
import { summary } from "@/lib/survey";

export function JourneyHome({
  onScan,
  onExample,
  onExamples,
  onSignIn,
  accountsAvailable = false,
  signedIn = false,
}: {
  onScan: () => void;
  onExample: (id: string) => void;
  onExamples?: () => void;
  onSignIn: () => void;
  accountsAvailable?: boolean;
  signedIn?: boolean;
}) {
  const heroSample =
    sampleYards.find((sample) => sample.id === "side-yard") || sampleYards[0];
  return (
    <div className="home-experience">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-field-stamp">
            <Compass size={13} aria-hidden="true" />
            <span>LAT 40°13′N · ECOREGION 64/84 · NJ NATIVE HABITAT ARCHIVE</span>
          </div>
          <p className="eyebrow">
            <span className="home-live-dot" /> NATURE STARTS RIGHT OUTSIDE
          </p>
          <h1 id="home-title">
            Your yard.
            <br />
            <em>
              A world worth <br />
              knowing.
            </em>
          </h1>
          <p className="home-intro">
            Most suburban yards feed surprisingly little wildlife. Take a quick photo
            of your property. We identify what is growing in your soil, flag invasive
            plants, and recommend one high-impact swap that brings songbirds and
            pollinators back.
          </p>
          <div className="actions">
            <button className="primary" onClick={onScan}>
              <Camera size={18} /> Scan a plant or yard{" "}
              <ArrowUpRight size={17} />
            </button>
            <a
              className="home-how-link"
              href={onExamples ? "/?view=examples" : "#examples"}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                  return;
                if (onExamples) {
                  event.preventDefault();
                  onExamples();
                  return;
                }
                const examples = document.getElementById("examples");
                if (!examples) return;
                event.preventDefault();
                examples.focus({ preventScroll: true });
                examples.scrollIntoView({ behavior: "smooth", block: "start" });
                window.history.replaceState(
                  {
                    ...window.history.state,
                    scrollY: examples.getBoundingClientRect().top + window.scrollY,
                  },
                  "",
                  `${window.location.pathname}${window.location.search}#examples`,
                );
              }}
            >
              Explore an example <ArrowRight size={17} />
            </a>
          </div>
          <div className="home-reassurance">
            <span>
              <Check size={14} /> No account to start
            </span>
            <span>
              <Check size={14} /> Made for New Jersey
            </span>
            <span>
              <Check size={14} /> Douglas Tallamy Keystone Science
            </span>
          </div>
        </div>
        <figure className="home-field-view">
          <div className="home-plate-badge" aria-hidden="true">
            <span>PLATE 01</span>
            <small>IN SITU HABITAT</small>
          </div>
          <img
            src={heroSample.photo}
            alt={`${heroSample.imageKind === "generated-illustration" ? "Generated garden illustration" : "Illustrative garden photo"}: ${heroSample.title}`}
            fetchPriority="high"
          />
          <figcaption>
            <span className="home-field-kicker">
              <Leaf size={15} /> LIVING HABITAT
            </span>
            <strong>
              A place for life
              <br />
              to take root.
            </strong>
            <span className="home-field-caption">
              Field sample · {heroSample.title}
            </span>
            <SampleCredit sample={heroSample} />
          </figcaption>
        </figure>
      </section>

      <section
        className="home-discovery"
        id="how"
        aria-labelledby="home-how-title"
      >
        <div className="home-discovery-heading">
          <p className="eyebrow">SIMPLE FIELD AUDIT</p>
          <h2 id="home-how-title">
            From “what’s that?”
            <br />
            <em>to “what’s next?”</em>
          </h2>
        </div>
        <ol
          className="home-discovery-steps"
          aria-label="Meet your yard → Follow your curiosity → Make one useful change"
        >
          {[
            {
              Icon: ScanLine,
              title: "Meet your yard",
              copy: "Snap a photo of any bed. We spot the plants you have, flag troublesome invasives, and calculate a baseline score out of 100.",
            },
            {
              Icon: Leaf,
              title: "Follow your curiosity",
              copy: "Learn what each plant actually supports. See which caterpillars rely on its leaves and whether it crowds out local flora.",
            },
            {
              Icon: Sprout,
              title: "Make one useful change",
              copy: "No need to dig up your whole lawn. We suggest a targeted native replacement matched to your soil type and sun exposure.",
            },
          ].map(({ Icon, title, copy }, index) => (
            <li key={title}>
              <div className="home-discovery-step-top">
                <span>0{index + 1}</span>
                <Icon size={22} />
                <ArrowRight
                  className="home-discovery-arrow"
                  size={20}
                  aria-hidden="true"
                />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-sample-studio"
        id="examples"
        tabIndex={-1}
        aria-labelledby="sample-heading"
      >
        <div className="home-studio-heading">
          <div>
            <p className="eyebrow">FIELD WORKSPACES</p>
            <h2 id="sample-heading">
              Three yards.
              <br />
              <em>Three starting points.</em>
            </h2>
          </div>
          <p>
            Browse three real New Jersey planting layouts. Inspect their plant
            profiles and see how native choices shift the score before auditing
            your own yard.
          </p>
        </div>
        <div className="home-yard-cards">
          {sampleYards.map((sample) => {
            const stats = summary(sample);
            const meta = sample.id === "front-yard"
              ? { region: "Piedmont Glacial Till", soil: "Silt Loam · Sun & Partial Shade", plate: "SPECIMEN A" }
              : sample.id === "back-yard"
              ? { region: "Highlands Understory", soil: "Acidic Rocky Soil · Canopy Shade", plate: "SPECIMEN B" }
              : { region: "Inner Coastal Plain", soil: "Sandy Loam · Full Sun Corridor", plate: "SPECIMEN C" };
            return (
              <article className={`home-yard-card home-yard-card--${sample.id}`} key={sample.id}>
                <button
                  className="home-yard-photo"
                  aria-label={`Explore ${sample.title}`}
                  onClick={() => onExample(sample.id)}
                >
                  <img src={sample.photo} alt={sample.title} loading="lazy" />
                  <span className="home-yard-tag-badge">{meta.plate}</span>
                  <span className="home-yard-score">
                    <strong>{stats.score ?? "—"}</strong>
                    <span>
                      /100<small>Sample score</small>
                    </span>
                  </span>
                  <span className="home-yard-open" aria-hidden="true">
                    <ArrowUpRight size={21} />
                  </span>
                </button>
                <div className="home-yard-copy">
                  <div className="home-yard-meta-line">
                    <span className="home-yard-region-label">{meta.region}</span>
                    <span className="home-yard-soil-label">{meta.soil}</span>
                  </div>
                  <h3>{sample.title}</h3>
                  <p>{sample.description}</p>
                  <div className="home-yard-footer">
                    <span>{sample.plants.length} plants to explore</span>
                    <button
                      className="text-button"
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
        <p className="home-sample-note">
          These examples use reference maps to illustrate the workspace. When
          you upload your own photo, you review and verify each plant candidate
          before saving.
        </p>
        <div className="home-account-invitation">
          <div>
            <strong>Keep your yard's progress on record.</strong>
            <p>
              {signedIn
                ? "Open your saved properties, photo history, and annual roadmaps to pick your next project."
                : accountsAvailable
                  ? "Create a profile to save photos, track plant removals, and see your habitat score climb year over year."
                  : "Account saving is unavailable right now. You can still explore, scan and print your findings as a guest."}
            </p>
          </div>
          <button className="secondary" onClick={onSignIn}>
            {signedIn ? "Open my yards" : "Sign in / create a profile"}{" "}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

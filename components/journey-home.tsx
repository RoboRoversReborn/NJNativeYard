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
            The plants outside your door shape the life around them. Grounded in
            New Jersey native flora and keystone ecology, learn what is growing
            in your soil and uncover one high-impact change that welcomes life back.
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
              <Leaf size={15} /> MORE THAN SOMETHING GREEN
            </span>
            <strong>
              A place for life
              <br />
              to take root.
            </strong>
            <span className="home-field-caption">
              Illustrative sample · {heroSample.title}
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
          <p className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p>
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
              copy: "Start with a photo. Get suggested plant matches and a first, provisional ecosystem score.",
            },
            {
              Icon: Leaf,
              title: "Follow your curiosity",
              copy: "Look closer at a leaf or flower. Discover a plant’s role, its seasonal story and the life associated with it.",
            },
            {
              Icon: Sprout,
              title: "Make one useful change",
              copy: "Explore a native option or a seasonal care step that suits your space. Start small, with what you’ve learned.",
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
            <p className="eyebrow">TAKE A LOOK AROUND</p>
            <h2 id="sample-heading">
              Three yards.
              <br />
              <em>Three starting points.</em>
            </h2>
          </div>
          <p>
            Open a sample, meet its plants and explore a next step. This is the
            same workspace you’ll use for your own yard.
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
          Illustrative plant matches and scores. Your own photo starts a fresh
          assessment, with identities to review.
        </p>
        <div className="home-account-invitation">
          <div>
            <strong>Your yard has a story. Keep it growing.</strong>
            <p>
              {signedIn
                ? "Open your saved yards, photos and annual plans to choose your next useful step."
                : accountsAvailable
                  ? "A profile lets you save photos and plans, then compare your yard’s assessments over time."
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

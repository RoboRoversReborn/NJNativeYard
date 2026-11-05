"use client";
import { useState } from "react";
import { catalog, matchesPlantSearch, category as plantCategory } from "@/lib/survey";
import { profileStatus, nativePlantingOption } from "@/lib/nj-evidence";
import {
  PlantGrowingDetails,
  PlantSeasonalInterest,
  plantProfileSummary,
} from "./plant-profile";
import { ReferenceImage } from "./plant-photos";
const categories = {
  keystone: "Keystone native",
  native: "Other NJ native",
  "non-native": "Non-native",
  invasive: "Invasive",
  unverified: "NJ status pending",
};
export function PlantCatalog() {
  const [category, setCategory] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const chosen = catalog.find((p) => p.id === selected);
  const matches = catalog.filter(
    (p) =>
      (category === "all" || profileStatus(p) === category) &&
      matchesPlantSearch(p, search),
  );
  if (chosen)
    return (
      <section className="catalog-detail">
        <button className="text-button" onClick={() => setSelected(null)}>
          ← Back to filtered catalog
        </button>
        <p className="eyebrow">NEW JERSEY PLANT PROFILE</p>
        <h1>{chosen.commonName}</h1>
        <p>
          <i>{chosen.scientificName}</i> · {profileStatus(chosen) === "unverified" ? plantCategory(chosen).label : categories[profileStatus(chosen)]}
        </p>
        <ReferenceImage
          name={chosen.commonName}
          scientificName={chosen.scientificName}
          variant="detail"
        />
        <p>{plantProfileSummary(chosen)}</p>
        <p className="notice">
          {chosen.njEvidence?.note}{" "}
          {nativePlantingOption(chosen)
            ? "A possible native planting option; check the documented site and space requirements."
            : "Included for recognition and research. Catalog inclusion is not a planting recommendation."}
        </p>
        <PlantGrowingDetails plant={chosen} />
        <PlantSeasonalInterest plant={chosen} />
      </section>
    );
  return (
    <section className="plant-catalog">
      <p className="eyebrow">LEARN WHAT GROWS AROUND YOU</p>
      <h1>Explore New Jersey plants</h1>
      <p>
        {catalog.length} source-linked profiles for recognition and garden
        research. Native status, garden suitability and identity confidence are
        separate questions.
      </p>
      <div
        className="category-filters"
        aria-label="Filter catalog by NJ category"
      >
        <button
          aria-pressed={category === "all"}
          onClick={() => {
            setCategory("all");
            setPage(0);
          }}
        >
          All profiles
        </button>
        {Object.entries(categories).filter(([key]) => key !== "unverified").map(([key, name]) => (
          <button
            key={key}
            className={`status-${key}`}
            aria-pressed={category === key}
            onClick={() => {
              setCategory(key);
              setPage(0);
            }}
          >
            {name} · {catalog.filter((p) => profileStatus(p) === key).length}
          </button>
        ))}
      </div>
      <button className="text-button catalog-pending-filter" aria-pressed={category === "unverified"} onClick={() => { setCategory("unverified"); setPage(0); }}>Review status pending · {catalog.filter(p => profileStatus(p) === "unverified").length}</button>
      <label>
        Search catalog
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Common or scientific name"
        />
      </label>
      {(category !== "all" || search) && (
        <button
          className="secondary"
          onClick={() => {
            setCategory("all");
            setSearch("");
            setPage(0);
          }}
        >
          Clear filters
        </button>
      )}
      <p role="status">{matches.length} matching profiles</p>
      <div className="catalog-grid">
        {matches.slice(page * 18, page * 18 + 18).map((p) => (
          <article key={p.id}>
            <ReferenceImage
              name={p.commonName}
              scientificName={p.scientificName}
              variant="card"
            />
            <h2>{p.commonName}</h2>
            <p>
              <i>{p.scientificName}</i>
            </p>
            <p>{profileStatus(p) === "unverified" ? plantCategory(p).label : categories[profileStatus(p)]}</p>
            <button
              className="secondary"
              onClick={() => {
                setSelected(p.id);
                window.scrollTo({ top: 0 });
              }}
            >
              Explore {p.commonName}
            </button>
          </article>
        ))}
      </div>
      {!matches.length && (
        <p>
          No profiles match these filters. Clear them to explore the catalog.
        </p>
      )}
      {matches.length > 18 && (
        <nav aria-label="Catalog pages">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.ceil(matches.length / 18)}
          </span>
          <button
            disabled={(page + 1) * 18 >= matches.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

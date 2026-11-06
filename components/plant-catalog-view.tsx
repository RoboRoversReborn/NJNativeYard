"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Edit3,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Sprout,
  Leaf,
  AlertTriangle,
  RotateCw,
  Eye,
  X,
} from "lucide-react";
import type { CuratedPlant } from "@/lib/curated-plant-types";
import type { AppUser } from "@/lib/firebase/auth-user";
import { getCuratedPlants, isCurator } from "@/lib/curated-plants-service";
import { CuratedPlantEditor } from "./curated-plant-editor";

export function PlantCatalogView({
  user,
  onBack,
}: {
  user?: AppUser | null;
  onBack?: () => void;
}) {
  const [plants, setPlants] = useState<CuratedPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Editor Modal State
  const [editingPlant, setEditingPlant] = useState<CuratedPlant | null | undefined>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Detail Modal State
  const [selectedPlant, setSelectedPlant] = useState<CuratedPlant | null>(null);

  const curatorActive = isCurator(user);

  async function loadData(force = false) {
    setLoading(true);
    setError("");
    try {
      const data = await getCuratedPlants(force);
      setPlants(data);
    } catch (err) {
      setError("Could not load curated flora repository.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPlants = useMemo(() => {
    return plants.filter((plant) => {
      if (statusFilter !== "all" && plant.status !== statusFilter) return false;
      if (typeFilter !== "all") {
        if (typeFilter === "Tree" && plant.type !== "Tree") return false;
        if (typeFilter === "Shrub" && plant.type !== "Shrub") return false;
        if (typeFilter === "Perennial" && plant.type !== "Perennial") return false;
        if (typeFilter === "Other" && ["Tree", "Shrub", "Perennial"].includes(plant.type || "")) return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchesCommon = plant.commonName.toLowerCase().includes(q);
        const matchesSci = plant.scientificName.toLowerCase().includes(q);
        const matchesFamily = plant.family?.toLowerCase().includes(q);
        if (!matchesCommon && !matchesSci && !matchesFamily) return false;
      }
      return true;
    });
  }, [plants, query, statusFilter, typeFilter]);

  function handleOpenCreate() {
    setEditingPlant(null);
    setIsEditorOpen(true);
  }

  function handleOpenEdit(p: CuratedPlant, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setEditingPlant(p);
    setIsEditorOpen(true);
  }

  function handlePlantSaved(saved: CuratedPlant) {
    setPlants((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev].sort((a, b) => a.commonName.localeCompare(b.commonName));
    });
    if (selectedPlant?.id === saved.id) {
      setSelectedPlant(saved);
    }
  }

  return (
    <div className="curator-catalog-page">
      <header className="curator-catalog-header">
        <div className="curator-header-copy">
          <div className="curator-header-stamp">
            <span>BOTANICAL FLORA REPOSITORY</span>
            <span className="dot" />
            <span>LIVE CLOUD FIRESTORE</span>
          </div>
          <h1>Curated New Jersey Plant Catalog</h1>
          <p>
            Authentic botanical profiles, photo vouchers, and ecological keystone metrics.
            Backed by live Firebase Firestore and Cloud Storage.
          </p>
        </div>

        <div className="curator-header-actions">
          {curatorActive && (
            <div className="curator-status-badge">
              <ShieldCheck size={16} />
              <span>Curator Role: {user?.email || "Admin"}</span>
            </div>
          )}
          {curatorActive && (
            <button className="primary curator-add-trigger" onClick={handleOpenCreate}>
              <Plus size={18} /> Add New Species
            </button>
          )}
          <button className="curator-refresh-btn" onClick={() => void loadData(true)} title="Refresh database">
            <RotateCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {/* Search & Filter Toolbar */}
      <section className="curator-toolbar" aria-label="Catalog search and filters">
        <div className="curator-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by scientific name, common name, or family..."
          />
          {query && (
            <button className="curator-clear-search" onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="curator-filter-chips">
          <span className="curator-filter-label">Status:</span>
          {[
            { id: "all", label: "All" },
            { id: "keystone", label: "Keystone Native" },
            { id: "native", label: "Native" },
            { id: "non-native", label: "Non-Native" },
            { id: "invasive", label: "Invasive" },
          ].map((chip) => (
            <button
              key={chip.id}
              className={`curator-chip${statusFilter === chip.id ? " is-active" : ""}`}
              onClick={() => setStatusFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="curator-filter-chips">
          <span className="curator-filter-label">Growth:</span>
          {[
            { id: "all", label: "All Forms" },
            { id: "Tree", label: "Trees" },
            { id: "Shrub", label: "Shrubs" },
            { id: "Perennial", label: "Perennials" },
            { id: "Other", label: "Grasses & Ferns" },
          ].map((chip) => (
            <button
              key={chip.id}
              className={`curator-chip${typeFilter === chip.id ? " is-active" : ""}`}
              onClick={() => setTypeFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {/* Results Count */}
      <div className="curator-count-bar">
        <span>Showing {filteredPlants.length} of {plants.length} curated New Jersey species</span>
        {loading && <span className="curator-loading-note">Syncing with Firestore...</span>}
      </div>

      {/* Grid of Plants */}
      <div className="curator-plant-grid">
        {filteredPlants.map((plant) => {
          const primaryPhoto = plant.photos?.find((p) => p.isPrimary) || plant.photos?.[0];
          return (
            <article
              className={`curator-plant-card curator-plant-card--${plant.status}`}
              key={plant.id}
              onClick={() => setSelectedPlant(plant)}
            >
              <div className="curator-card-media">
                {primaryPhoto ? (
                  <img src={primaryPhoto.thumbnailUrl || primaryPhoto.url} alt={plant.commonName} loading="lazy" />
                ) : (
                  <div className="curator-card-placeholder">
                    <Leaf size={32} />
                  </div>
                )}
                <span className={`curator-status-tag status-${plant.status}`}>
                  {plant.status === "keystone"
                    ? "Keystone Native"
                    : plant.status === "native"
                    ? "NJ Native"
                    : plant.status === "invasive"
                    ? "Invasive"
                    : "Non-Native"}
                </span>
                {primaryPhoto?.organ && (
                  <span className="curator-organ-tag">{primaryPhoto.organ}</span>
                )}
              </div>

              <div className="curator-card-content">
                <div className="curator-card-titles">
                  <h3>{plant.commonName}</h3>
                  <em>{plant.scientificName}</em>
                  {plant.family && <small className="curator-family">{plant.family}</small>}
                </div>

                <div className="curator-card-badges">
                  {plant.lepidoptera ? (
                    <span className="curator-badge lepidoptera" title="Lepidoptera caterpillar host species count">
                      <Sprout size={12} /> Hosts {plant.lepidoptera} caterpillars
                    </span>
                  ) : null}
                  {plant.sun && <span className="curator-badge sun">{plant.sun}</span>}
                  {plant.moisture && <span className="curator-badge moisture">{plant.moisture}</span>}
                </div>

                <p className="curator-card-desc">
                  {plant.description || "Botanical record indexed in live Cloud Firestore."}
                </p>

                <div className="curator-card-footer">
                  <span className="curator-photo-count">
                    {plant.photos?.length || 0} photo vouchers
                  </span>
                  <div className="curator-card-buttons">
                    <button
                      type="button"
                      className="curator-view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlant(plant);
                      }}
                    >
                      <Eye size={14} /> View
                    </button>
                    {curatorActive && (
                      <button
                        type="button"
                        className="curator-edit-btn"
                        onClick={(e) => handleOpenEdit(plant, e)}
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Detail Viewer Modal */}
      {selectedPlant && (
        <div className="curator-modal-backdrop" onClick={() => setSelectedPlant(null)}>
          <div className="curator-detail-modal" onClick={(e) => e.stopPropagation()}>
            <header className="curator-detail-header">
              <div>
                <span className={`curator-status-tag status-${selectedPlant.status}`}>
                  {selectedPlant.status.toUpperCase()}
                </span>
                <h2>{selectedPlant.commonName}</h2>
                <em>{selectedPlant.scientificName}</em>
              </div>
              <button className="curator-close" onClick={() => setSelectedPlant(null)}>
                <X size={20} />
              </button>
            </header>

            <div className="curator-detail-body">
              {/* Photo Gallery */}
              <div className="curator-detail-gallery">
                {selectedPlant.photos?.map((ph, idx) => (
                  <figure className="curator-detail-photo" key={ph.id || idx}>
                    <img src={ph.url} alt={selectedPlant.commonName} />
                    <figcaption>
                      <strong>{ph.organ || "Specimen"}</strong>
                      <small>{ph.author} · {ph.license}</small>
                      {ph.citation && <small className="citation">{ph.citation}</small>}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {/* Botanical Traits */}
              <div className="curator-detail-traits">
                <h3>Botanical & Ecological Profile</h3>
                <dl className="curator-trait-dl">
                  <div>
                    <dt>Growth Habit</dt>
                    <dd>{selectedPlant.type} ({selectedPlant.growthHabit || "Standard"})</dd>
                  </div>
                  <div>
                    <dt>Sunlight</dt>
                    <dd>{selectedPlant.sun || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt>Soil Moisture</dt>
                    <dd>{selectedPlant.moisture || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt>Mature Height</dt>
                    <dd>{selectedPlant.height || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt>Bloom Characteristics</dt>
                    <dd>{selectedPlant.bloom || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt>Deer Resistance</dt>
                    <dd>{selectedPlant.deerResistance || "Moderate"}</dd>
                  </div>
                  <div>
                    <dt>Caterpillars Hosted</dt>
                    <dd>{selectedPlant.lepidoptera ? `${selectedPlant.lepidoptera} species` : "Unrecorded"}</dd>
                  </div>
                </dl>

                {selectedPlant.description && (
                  <div className="curator-detail-description">
                    <h4>Ecological Significance</h4>
                    <p>{selectedPlant.description}</p>
                  </div>
                )}

                {/* Sources */}
                {selectedPlant.sources && selectedPlant.sources.length > 0 && (
                  <div className="curator-detail-sources">
                    <h4>Verified Citations & Sources</h4>
                    <ul>
                      {selectedPlant.sources.map((src) => (
                        <li key={src.id}>
                          <strong>{src.title}</strong>
                          {src.url && (
                            <a href={src.url} target="_blank" rel="noopener noreferrer">
                              Visit source <ExternalLink size={12} />
                            </a>
                          )}
                          {src.notes && <small>{src.notes}</small>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <footer className="curator-detail-footer">
              {curatorActive && (
                <button
                  type="button"
                  className="primary curator-edit-btn"
                  onClick={() => {
                    const target = selectedPlant;
                    setSelectedPlant(null);
                    handleOpenEdit(target);
                  }}
                >
                  <Edit3 size={15} /> Edit This Species
                </button>
              )}
              <button type="button" className="secondary" onClick={() => setSelectedPlant(null)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && user && (
        <CuratedPlantEditor
          plant={editingPlant}
          user={user}
          onClose={() => setIsEditorOpen(false)}
          onSaved={handlePlantSaved}
        />
      )}
    </div>
  );
}

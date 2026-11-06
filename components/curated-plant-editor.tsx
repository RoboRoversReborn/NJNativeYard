"use client";

import React, { useState } from "react";
import {
  X,
  Camera,
  Check,
  Upload,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { CuratedPlant, CuratedPhoto, CuratedSource, PlantOrgan } from "@/lib/curated-plant-types";
import type { AppUser } from "@/lib/firebase/auth-user";
import { saveCuratedPlant, uploadPlantPhoto } from "@/lib/curated-plants-service";

export function CuratedPlantEditor({
  plant,
  user,
  onClose,
  onSaved,
}: {
  plant?: CuratedPlant | null;
  user: AppUser;
  onClose: () => void;
  onSaved: (saved: CuratedPlant) => void;
}) {
  const isNew = !plant;
  const [activeTab, setActiveTab] = useState<"overview" | "photos" | "ecology" | "sources">("overview");

  // Form State
  const [id, setId] = useState(plant?.id || "");
  const [commonName, setCommonName] = useState(plant?.commonName || "");
  const [scientificName, setScientificName] = useState(plant?.scientificName || "");
  const [family, setFamily] = useState(plant?.family || "");
  const [status, setStatus] = useState<"keystone" | "native" | "non-native" | "invasive">(plant?.status || "native");
  const [type, setType] = useState(plant?.type || "Shrub");
  const [growthHabit, setGrowthHabit] = useState(plant?.growthHabit || "SHRUB");
  const [sun, setSun] = useState(plant?.sun || "Full sun–part shade");
  const [moisture, setMoisture] = useState(plant?.moisture || "Medium");
  const [height, setHeight] = useState(plant?.height || "");
  const [bloom, setBloom] = useState(plant?.bloom || "");
  const [deerResistance, setDeerResistance] = useState(plant?.deerResistance || "MODERATE");
  const [lepidoptera, setLepidoptera] = useState<number | string>(plant?.lepidoptera ?? plant?.lepidopteraCount ?? "");
  const [specialistBeeSupport, setSpecialistBeeSupport] = useState(Boolean(plant?.specialistBeeSupport));
  const [description, setDescription] = useState(plant?.description || "");

  // Photos & Sources
  const [photos, setPhotos] = useState<CuratedPhoto[]>(plant?.photos || []);
  const [sources, setSources] = useState<CuratedSource[]>(plant?.sources || []);

  // New photo upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOrgan, setUploadOrgan] = useState<PlantOrgan>("flower");
  const [uploadAuthor, setUploadAuthor] = useState(user.user_metadata?.full_name || "");
  const [uploadLicense, setUploadLicense] = useState("CC BY-SA 4.0");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // New source state
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceNotes, setNewSourceNotes] = useState("");

  // Save status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Auto-slugify scientific name if new
  function handleScientificNameChange(val: string) {
    setScientificName(val);
    if (isNew && !id) {
      setId(val.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  async function handlePhotoUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    const targetPlantId = id.trim() || plant?.id;
    if (!targetPlantId) {
      setUploadError("Please provide an ID / scientific name first.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadPlantPhoto(
        targetPlantId,
        uploadFile,
        {
          organ: uploadOrgan,
          author: uploadAuthor.trim(),
          license: uploadLicense,
          isPrimary: photos.length === 0,
        },
        user,
      );
      setPhotos(result.plant.photos);
      setUploadFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  }

  function handleSetPrimaryPhoto(photoId: string) {
    setPhotos((current) =>
      current.map((p) => ({
        ...p,
        isPrimary: p.id === photoId,
      })),
    );
  }

  function handleRemovePhoto(photoId: string) {
    setPhotos((current) => current.filter((p) => p.id !== photoId));
  }

  function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceTitle.trim()) return;
    const newSource: CuratedSource = {
      id: `source-${Date.now()}`,
      title: newSourceTitle.trim(),
      url: newSourceUrl.trim() || undefined,
      notes: newSourceNotes.trim() || undefined,
      verifiedAt: new Date().toISOString(),
    };
    setSources((prev) => [...prev, newSource]);
    setNewSourceTitle("");
    setNewSourceUrl("");
    setNewSourceNotes("");
  }

  function handleRemoveSource(sourceId: string) {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!scientificName.trim() || !commonName.trim()) {
      setError("Scientific name and common name are required.");
      return;
    }
    const finalId = id.trim() || scientificName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const plantDoc: CuratedPlant = {
      id: finalId,
      scientificName: scientificName.trim(),
      commonName: commonName.trim(),
      family: family.trim() || undefined,
      status,
      njStatus: status === "keystone" ? "NATIVE_KEYSTONE" : status === "native" ? "NATIVE" : status === "invasive" ? "INVASIVE_REGULATED" : "NON_NATIVE_BENIGN",
      type,
      growthHabit,
      sun,
      moisture,
      height: height.trim() || undefined,
      bloom: bloom.trim() || undefined,
      deerResistance,
      lepidoptera: lepidoptera !== "" ? Number(lepidoptera) : undefined,
      specialistBeeSupport,
      description: description.trim() || undefined,
      photos,
      sources,
      createdAt: plant?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastEditedBy: {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.full_name || user.email || "Curator",
      },
    };

    setSaving(true);
    try {
      const saved = await saveCuratedPlant(plantDoc, user);
      setSuccess(true);
      setTimeout(() => {
        onSaved(saved);
        onClose();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save species to Firestore.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="curator-modal-backdrop" onClick={onClose}>
      <div className="curator-modal" onClick={(e) => e.stopPropagation()}>
        <header className="curator-modal-header">
          <div className="curator-title-group">
            <span className="curator-eyebrow">
              <ShieldCheck size={14} /> CURATOR REPOSITORY ACCESS
            </span>
            <h2>{isNew ? "Add New Botanical Species" : `Edit: ${plant.scientificName}`}</h2>
            <small>{isNew ? "Create a new verified plant entry in Cloud Firestore" : `Common Name: ${plant.commonName}`}</small>
          </div>
          <button className="curator-close" onClick={onClose} aria-label="Close editor">
            <X size={20} />
          </button>
        </header>

        <nav className="curator-tabs">
          <button
            type="button"
            className={activeTab === "overview" ? "is-active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            Overview & Taxonomy
          </button>
          <button
            type="button"
            className={activeTab === "ecology" ? "is-active" : ""}
            onClick={() => setActiveTab("ecology")}
          >
            Horticulture & Ecology
          </button>
          <button
            type="button"
            className={activeTab === "photos" ? "is-active" : ""}
            onClick={() => setActiveTab("photos")}
          >
            Photos & Specimens ({photos.length})
          </button>
          <button
            type="button"
            className={activeTab === "sources" ? "is-active" : ""}
            onClick={() => setActiveTab("sources")}
          >
            Citations & Sources ({sources.length})
          </button>
        </nav>

        <form onSubmit={handleSave} className="curator-body">
          {error && (
            <div className="curator-alert is-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {success && (
            <div className="curator-alert is-success">
              <Check size={16} /> Successfully saved to Cloud Firestore!
            </div>
          )}

          {activeTab === "overview" && (
            <div className="curator-tab-pane">
              <div className="curator-form-grid">
                <label>
                  <span>Scientific Name (Botanical Binomial) *</span>
                  <input
                    value={scientificName}
                    onChange={(e) => handleScientificNameChange(e.target.value)}
                    placeholder="e.g. Quercus alba"
                    required
                  />
                </label>
                <label>
                  <span>Common Name *</span>
                  <input
                    value={commonName}
                    onChange={(e) => setCommonName(e.target.value)}
                    placeholder="e.g. White Oak"
                    required
                  />
                </label>
                <label>
                  <span>Botanical Family</span>
                  <input
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    placeholder="e.g. Fagaceae"
                  />
                </label>
                <label>
                  <span>Unique Identifier (Slug) *</span>
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="e.g. quercus-alba"
                    disabled={!isNew}
                    required
                  />
                </label>
              </div>

              <div className="curator-form-grid">
                <label>
                  <span>Ecological Status *</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="keystone">Keystone Native (Pivotal ecological host)</option>
                    <option value="native">Native (Indigenous to New Jersey)</option>
                    <option value="non-native">Non-Native (Low ecological risk)</option>
                    <option value="invasive">Invasive (Displaces local flora)</option>
                  </select>
                </label>
                <label>
                  <span>Plant Type / Stratum</span>
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setGrowthHabit(e.target.value === "Tree" ? "CANOPY_TREE" : e.target.value.toUpperCase());
                    }}
                  >
                    <option value="Tree">Canopy / Understory Tree</option>
                    <option value="Shrub">Woody Shrub</option>
                    <option value="Perennial">Herbaceous Perennial</option>
                    <option value="Grass">Native Grass / Sedge</option>
                    <option value="Fern">Fern</option>
                    <option value="Vine">Climbing Vine</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Ecological Description & Wildlife Value</span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the plant's ecological role, habitat significance, wildlife feeding relationships, and typical New Jersey distribution..."
                />
              </label>
            </div>
          )}

          {activeTab === "ecology" && (
            <div className="curator-tab-pane">
              <div className="curator-form-grid">
                <label>
                  <span>Sunlight Requirement</span>
                  <input
                    value={sun}
                    onChange={(e) => setSun(e.target.value)}
                    placeholder="e.g. Full sun–part shade"
                  />
                </label>
                <label>
                  <span>Soil Moisture</span>
                  <input
                    value={moisture}
                    onChange={(e) => setMoisture(e.target.value)}
                    placeholder="e.g. Moist, well-drained loam"
                  />
                </label>
                <label>
                  <span>Mature Height / Spread</span>
                  <input
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 50–80 ft"
                  />
                </label>
                <label>
                  <span>Bloom Period / Flower Traits</span>
                  <input
                    value={bloom}
                    onChange={(e) => setBloom(e.target.value)}
                    placeholder="e.g. White panicles in July"
                  />
                </label>
                <label>
                  <span>Deer Resistance</span>
                  <select
                    value={deerResistance}
                    onChange={(e) => setDeerResistance(e.target.value)}
                  >
                    <option value="HIGH">High (Rarely damaged by deer)</option>
                    <option value="MODERATE">Moderate (Occasionally browsed)</option>
                    <option value="LOW">Low (Favored deer forage)</option>
                  </select>
                </label>
                <label>
                  <span>Lepidoptera Caterpillar Species Hosted</span>
                  <input
                    type="number"
                    value={lepidoptera}
                    onChange={(e) => setLepidoptera(e.target.value)}
                    placeholder="e.g. 534 (Tallamy metric)"
                  />
                </label>
              </div>

              <div className="curator-checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={specialistBeeSupport}
                    onChange={(e) => setSpecialistBeeSupport(e.target.checked)}
                  />
                  <span>Provides pollen/nectar for specialized native bee species</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === "photos" && (
            <div className="curator-tab-pane">
              <div className="curator-photo-upload-box">
                <h4>
                  <Camera size={16} /> Upload New Botanical Reference Image
                </h4>
                <p>Images are uploaded directly to Firebase Cloud Storage and attached to this species.</p>

                {uploadError && <p className="curator-inline-error">{uploadError}</p>}

                <div className="curator-upload-controls">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <div className="curator-upload-meta-grid">
                    <label>
                      <span>Organ Depicted:</span>
                      <select
                        value={uploadOrgan}
                        onChange={(e) => setUploadOrgan(e.target.value as PlantOrgan)}
                      >
                        <option value="habit">Full Habit / Landscape</option>
                        <option value="flower">Flower / Inflorescence</option>
                        <option value="leaf">Leaf / Foliage</option>
                        <option value="bark">Bark / Stem</option>
                        <option value="fruit">Fruit / Seedhead</option>
                      </select>
                    </label>
                    <label>
                      <span>Photographer / Author:</span>
                      <input
                        value={uploadAuthor}
                        onChange={(e) => setUploadAuthor(e.target.value)}
                        placeholder="Author name"
                      />
                    </label>
                    <label>
                      <span>License:</span>
                      <select
                        value={uploadLicense}
                        onChange={(e) => setUploadLicense(e.target.value)}
                      >
                        <option value="CC BY-SA 4.0">CC BY-SA 4.0</option>
                        <option value="CC BY 4.0">CC BY 4.0</option>
                        <option value="Public Domain">Public Domain / CC0</option>
                        <option value="Copyrighted with Permission">Copyrighted (Permission Granted)</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="curator-upload-btn"
                    disabled={!uploadFile || uploading}
                    onClick={handlePhotoUpload}
                  >
                    <Upload size={15} /> {uploading ? "Uploading to Firebase..." : "Upload Image to Storage"}
                  </button>
                </div>
              </div>

              <div className="curator-photos-grid">
                {photos.map((photo, idx) => (
                  <div className={`curator-photo-card${photo.isPrimary ? " is-primary" : ""}`} key={photo.id || idx}>
                    <img src={photo.thumbnailUrl || photo.url} alt={commonName} />
                    <div className="curator-photo-meta">
                      <span className="curator-organ-badge">{photo.organ || "Specimen"}</span>
                      {photo.isPrimary && <span className="curator-primary-badge">PRIMARY</span>}
                      {photo.verificationStatus === "unverified" ? (
                        <span className="curator-unverified-tag" style={{ position: "static", alignSelf: "flex-start", margin: "2px 0" }}>
                          Unverified
                        </span>
                      ) : (
                        <span className="curator-staged-tag" style={{ position: "static", alignSelf: "flex-start", margin: "2px 0" }}>
                          Verified
                        </span>
                      )}
                      <small>{photo.author || "Unknown author"}</small>
                      <small className="curator-license">{photo.license || "Attributed"}</small>
                      <div className="curator-photo-actions">
                        {photo.verificationStatus === "unverified" && (
                          <button
                            type="button"
                            className="curator-text-action"
                            style={{ color: "#2b4c35", fontWeight: 700 }}
                            onClick={() => {
                              setPhotos((prev) =>
                                prev.map((p) =>
                                  p.id === photo.id ? { ...p, verificationStatus: "verified" } : p
                                )
                              );
                            }}
                          >
                            Mark Verified
                          </button>
                        )}
                        {!photo.isPrimary && (
                          <button
                            type="button"
                            className="curator-text-action"
                            onClick={() => handleSetPrimaryPhoto(photo.id)}
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          className="curator-delete-action"
                          onClick={() => handleRemovePhoto(photo.id)}
                          title="Remove photo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "sources" && (
            <div className="curator-tab-pane">
              <div className="curator-sources-list">
                <h4>Verified Authority Sources & Citations</h4>
                {sources.map((src) => (
                  <div className="curator-source-item" key={src.id}>
                    <div className="curator-source-info">
                      <strong>{src.title}</strong>
                      {src.url && (
                        <a href={src.url} target="_blank" rel="noopener noreferrer">
                          {src.url} <ExternalLink size={12} />
                        </a>
                      )}
                      {src.notes && <p>{src.notes}</p>}
                    </div>
                    <button
                      type="button"
                      className="curator-delete-action"
                      onClick={() => handleRemoveSource(src.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="curator-add-source-form">
                <h5>
                  <Plus size={15} /> Add Authority Reference
                </h5>
                <div className="curator-form-grid">
                  <label>
                    <span>Source Title / Organization *</span>
                    <input
                      value={newSourceTitle}
                      onChange={(e) => setNewSourceTitle(e.target.value)}
                      placeholder="e.g. Rutgers NJAES Fact Sheet FS1140"
                    />
                  </label>
                  <label>
                    <span>Documentation Link (URL)</span>
                    <input
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <label>
                  <span>Citation Note</span>
                  <input
                    value={newSourceNotes}
                    onChange={(e) => setNewSourceNotes(e.target.value)}
                    placeholder="Specific regional notes, page number, or conservation list status..."
                  />
                </label>
                <button
                  type="button"
                  className="curator-add-btn"
                  onClick={handleAddSource}
                  disabled={!newSourceTitle.trim()}
                >
                  Add Source Reference
                </button>
              </div>
            </div>
          )}

          <footer className="curator-modal-footer">
            <button type="button" className="curator-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="curator-save-btn" disabled={saving}>
              <Sparkles size={16} /> {saving ? "Saving to Cloud Firestore..." : "Save Species to Live Database"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

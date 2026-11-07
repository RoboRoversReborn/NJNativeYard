"use client";

import React, { useState } from "react";
import {
  X,
  Eye,
  ShieldCheck,
  Award,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  Leaf,
  Info,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import type { PublicYard, PublicYardArea, PublicYardPlant } from "@/lib/leaderboard-types";

export function PublicYardModal({
  yard,
  onClose,
}: {
  yard: PublicYard;
  onClose: () => void;
}) {
  const [selectedAreaId, setSelectedAreaId] = useState<string>(
    yard.areas[0]?.id || "all"
  );
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const currentArea = yard.areas.find((a) => a.id === selectedAreaId) || yard.areas[0];

  const allPlants: PublicYardPlant[] = yard.areas.flatMap((a) => a.plants);
  const displayedPlants = (selectedAreaId === "all" ? allPlants : currentArea?.plants || []).filter(
    (p) => filterStatus === "all" || p.status === filterStatus
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-title"
      className="lb-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lb-modal-dialog">
        {/* Read-Only Notice Banner */}
        <div className="lb-modal-notice">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Eye style={{ width: 16, height: 16, color: "#92400e", flexShrink: 0 }} />
            <span>
              <strong>Public Community Showcase (Read-Only)</strong> — Published habitat record for inspiration. Modifications restricted to owner.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lb-modal-close-btn"
            aria-label="Close showcase modal"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="lb-modal-body">
          {/* Header Card */}
          <div className="lb-modal-header">
            <div className="lb-modal-user-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={yard.coverPhotoUrl || "/samples/mixed-garden-starting-v4.png"}
                alt={yard.yardName}
                width={56}
                height={56}
                className="lb-modal-avatar"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/samples/mixed-garden-starting-v4.png";
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "#dcfce7", color: "#166534" }}>
                    Verified NJ Yard
                  </span>
                  <span style={{ fontSize: 12, color: "#6c786e" }}>
                    Published {new Date(yard.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                </div>
                <h1 id="showcase-title" style={{ fontFamily: "var(--font-fraunces, Georgia, serif)", fontSize: 24, fontWeight: 800, color: "#1a221b", margin: "2px 0 0" }}>
                  {yard.yardName}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#5c685e" }}>
                  <span style={{ fontWeight: 600, color: "#1a221b" }}>{yard.gardenerAlias}</span>
                  <span>•</span>
                  <span>{yard.townOrCounty}</span>
                </div>
              </div>
            </div>

            {/* Score Pill / Badge */}
            <div className="lb-modal-score-badge">
              <div className="lb-modal-score-num">{yard.score}</div>
              <div className="lb-modal-score-lbl">Habitat Score</div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="lb-modal-metrics">
            <div className="lb-modal-metric-card">
              <span className="lb-modal-metric-lbl">Native Species</span>
              <div className="lb-modal-metric-val">{yard.nativeSpeciesCount}</div>
            </div>

            <div className="lb-modal-metric-card">
              <span className="lb-modal-metric-lbl">Keystone Genera</span>
              <div className="lb-modal-metric-val" style={{ color: "#92400e" }}>{yard.keystoneCount}</div>
            </div>

            <div className="lb-modal-metric-card">
              <span className="lb-modal-metric-lbl">Invasive Species</span>
              <div className="lb-modal-metric-val" style={{ color: yard.invasiveCount === 0 ? "#166534" : "#991b1b" }}>
                {yard.invasiveCount}
              </div>
            </div>

            <div className="lb-modal-metric-card">
              <span className="lb-modal-metric-lbl">Yard Areas</span>
              <div className="lb-modal-metric-val">{yard.areas.length}</div>
            </div>
          </div>


          {/* Earned Badges Section */}
          {yard.badges && yard.badges.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-700" />
                Earned Ecological Badges
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {yard.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-start gap-3 p-3 bg-white border border-stone-200/80 rounded-xl shadow-xs"
                  >
                    <span className="text-2xl shrink-0 p-1 bg-stone-100 rounded-lg">{badge.icon}</span>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-stone-900 block">{badge.label}</span>
                      <p className="text-[11px] text-stone-600 leading-tight">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plant Inventory Section */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-800" />
                <h2 className="text-base font-bold text-stone-900">Documented Flora Inventory</h2>
                <span className="text-xs font-semibold px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                  {displayedPlants.length} plants
                </span>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "all", label: "All" },
                  { id: "keystone", label: "Keystone" },
                  { id: "native", label: "Native" },
                  { id: "invasive", label: "Invasive" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterStatus(f.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      filterStatus === f.id
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Area Tabs */}
            {yard.areas.length > 1 && (
              <div className="flex items-center gap-2 border-b border-stone-200 overflow-x-auto pb-1 text-sm">
                <button
                  type="button"
                  onClick={() => setSelectedAreaId("all")}
                  className={`pb-2 px-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                    selectedAreaId === "all"
                      ? "border-emerald-800 text-emerald-900"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  All Areas ({allPlants.length})
                </button>
                {yard.areas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedAreaId(area.id)}
                    className={`pb-2 px-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
                      selectedAreaId === area.id
                        ? "border-emerald-800 text-emerald-900"
                        : "border-transparent text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {area.name} ({area.plants.length})
                  </button>
                ))}
              </div>
            )}

            {/* Plants Grid */}
            {displayedPlants.length === 0 ? (
              <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
                <Info className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                <p className="text-sm">No plants match the selected filter in this area.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedPlants.map((plant, idx) => (
                  <div
                    key={`${plant.id}-${idx}`}
                    className="p-3.5 bg-white border border-stone-200 rounded-xl shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            plant.status === "keystone"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : plant.status === "native"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : plant.status === "invasive"
                              ? "bg-rose-100 text-rose-900 border border-rose-300"
                              : "bg-stone-100 text-stone-700 border border-stone-300"
                          }`}
                        >
                          {plant.status === "keystone" ? "★ Keystone Native" : plant.status}
                        </span>
                        {plant.type && (
                          <span className="text-[11px] text-stone-500">{plant.type}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-stone-900 text-sm leading-snug">
                        {plant.commonName}
                      </h3>
                      <p className="text-xs italic text-stone-500 mt-0.5">
                        {plant.scientificName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="lb-modal-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6c786e" }}>
            <ShieldCheck style={{ width: 16, height: 16, color: "#244b34" }} />
            <span>Community data verified against the New Jersey Native Plant Catalog.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lb-modal-back-btn"
          >
            Back to Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}

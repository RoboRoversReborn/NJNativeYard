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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#FDFBF7] text-stone-900 rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Read-Only Notice Banner */}
        <div className="bg-amber-950/5 border-b border-amber-900/10 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <Eye className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Public Community Showcase (Read-Only)</strong> — You are viewing this yard's published habitat record. Modifications are restricted to the owner.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-200/50 text-stone-500 hover:text-stone-800 transition-colors"
            aria-label="Close showcase modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-stone-200">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-800/10 text-emerald-900 border border-emerald-800/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Verified NJ Yard
                </span>
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Published {new Date(yard.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
              </div>
              <h1 id="showcase-title" className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-stone-900">
                {yard.yardName}
              </h1>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-stone-600">
                <span className="flex items-center gap-1 text-stone-800 font-medium">
                  <UserCheck className="w-4 h-4 text-stone-500" />
                  {yard.gardenerAlias}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-stone-400" />
                  {yard.townOrCounty}
                </span>
              </div>
            </div>

            {/* Score Pill / Badge */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between bg-stone-100/80 border border-stone-200/80 rounded-xl px-4 py-3 shrink-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Habitat Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono text-emerald-900">{yard.score}</span>
                <span className="text-xs font-semibold text-stone-500">/ 100</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full mt-1">
                {yard.tier}
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
              <span className="text-xs text-stone-500 block">Native Species</span>
              <span className="text-2xl font-bold text-stone-900 font-mono mt-0.5 block">
                {yard.nativeSpeciesCount}
              </span>
              <span className="text-[11px] text-stone-500">Documented in yard</span>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
              <span className="text-xs text-stone-500 block">Keystone Genera</span>
              <span className="text-2xl font-bold text-amber-900 font-mono mt-0.5 block">
                {yard.keystoneCount}
              </span>
              <span className="text-[11px] text-amber-800/80">Caterpillar host anchors</span>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
              <span className="text-xs text-stone-500 block">Invasive Species</span>
              <span className={`text-2xl font-bold font-mono mt-0.5 block ${yard.invasiveCount === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {yard.invasiveCount}
              </span>
              <span className="text-[11px] text-stone-500">
                {yard.invasiveCount === 0 ? "Zero invasives detected" : "Targeted for removal"}
              </span>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
              <span className="text-xs text-stone-500 block">Yard Areas</span>
              <span className="text-2xl font-bold text-stone-900 font-mono mt-0.5 block">
                {yard.areas.length}
              </span>
              <span className="text-[11px] text-stone-500">Surveyed planting zones</span>
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
        <div className="bg-stone-100/90 border-t border-stone-200 px-6 py-3.5 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Community data verified against the New Jersey Native Plant Catalog.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm rounded-xl transition-colors shadow-xs"
          >
            Back to Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}

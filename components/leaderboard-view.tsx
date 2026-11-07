"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Award,
  Sparkles,
  MapPin,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Leaf,
  Globe,
  Lock,
  Unlock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { PublicYard, LeaderboardSortBy } from "@/lib/leaderboard-types";
import {
  getLeaderboardYards,
  publishYardToLeaderboard,
  unpublishYardFromLeaderboard,
  autoPublishPilotYards,
} from "@/lib/leaderboard-service";
import { PublicYardModal } from "./public-yard-modal";
import type { Property } from "@/lib/account/repository";
import type { Survey } from "@/lib/survey";
import type { AppUser } from "@/lib/firebase/auth-user";

const NJ_COUNTIES = [
  "All New Jersey",
  "Atlantic",
  "Bergen",
  "Burlington",
  "Camden",
  "Cape May",
  "Cumberland",
  "Essex",
  "Gloucester",
  "Hudson",
  "Hunterdon",
  "Mercer",
  "Middlesex",
  "Monmouth",
  "Morris",
  "Ocean",
  "Passaic",
  "Salem",
  "Somerset",
  "Sussex",
  "Union",
  "Warren",
];

export function LeaderboardView({
  user,
  properties = [],
  surveys = [],
  onNavigateHome,
}: {
  user?: AppUser | null;
  properties?: Property[];
  surveys?: Survey[];
  onNavigateHome?: () => void;
}) {
  const [yards, setYards] = useState<PublicYard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCounty, setSelectedCounty] = useState("All New Jersey");
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>("score");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYard, setSelectedYard] = useState<PublicYard | null>(null);
  const [togglingPropertyId, setTogglingPropertyId] = useState<string | null>(null);
  const [toggleNotice, setToggleNotice] = useState<string>("");

  // Auto-publish pilot yards and load leaderboard
  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      if (user && properties.length > 0) {
        // Pilot phase: auto-publish properties with surveys by default
        await autoPublishPilotYards(properties, surveys, user);
      }
      const data = await getLeaderboardYards({
        county: selectedCounty === "All New Jersey" ? undefined : selectedCounty,
        sortBy,
        search: searchQuery || undefined,
      });
      if (active) {
        setYards(data);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [user, properties, surveys, selectedCounty, sortBy, searchQuery]);

  // Aggregate community stats
  const totalNativeSpecies = yards.reduce((sum, y) => sum + y.nativeSpeciesCount, 0);
  const avgScore = yards.length > 0 ? Math.round(yards.reduce((sum, y) => sum + y.score, 0) / yards.length) : 0;

  // Check if current user has a yard on the leaderboard
  const userPropertiesWithSurveys = properties.filter((p) =>
    surveys.some((s) => p.yard_areas.some((a) => a.id === s.areaId))
  );

  async function handleTogglePublish(property: Property, isCurrentlyPublished: boolean) {
    if (!user) return;
    setTogglingPropertyId(property.id);
    setToggleNotice("");

    try {
      if (isCurrentlyPublished) {
        await unpublishYardFromLeaderboard(property.id, user.id);
        setToggleNotice(`"${property.name}" unpublished from community leaderboard.`);
      } else {
        const propSurveys = surveys.filter((s) =>
          property.yard_areas.some((a) => a.id === s.areaId)
        );
        await publishYardToLeaderboard(property, propSurveys, user);
        setToggleNotice(`"${property.name}" published to community leaderboard!`);
      }

      // Refresh list
      const refreshed = await getLeaderboardYards({
        county: selectedCounty === "All New Jersey" ? undefined : selectedCounty,
        sortBy,
        search: searchQuery || undefined,
      });
      setYards(refreshed);
    } catch (err: any) {
      setToggleNotice(`Error updating visibility: ${err.message}`);
    } finally {
      setTogglingPropertyId(null);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-emerald-950 to-stone-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-stone-800">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Trophy className="w-3.5 h-3.5" />
            New Jersey Native Yard Leaderboard
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-stone-50">
            Rewilding New Jersey, Yard by Yard
          </h1>
          <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
            Gamifying habitat restoration across the Garden State. Celebrate your native plant sanctuary, inspire your neighbors, and explore verified yards anchoring local ecosystems.
          </p>

          {/* Aggregate Community Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-stone-800/80 max-w-lg">
            <div>
              <span className="text-xs text-stone-400 block">Ranked Yards</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">{yards.length}</span>
            </div>
            <div>
              <span className="text-xs text-stone-400 block">Native Plant Detections</span>
              <span className="text-2xl font-bold font-mono text-stone-100">{totalNativeSpecies}+</span>
            </div>
            <div>
              <span className="text-xs text-stone-400 block">Avg Habitat Score</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{avgScore} / 100</span>
            </div>
          </div>
        </div>

        <div className="absolute right-[-40px] bottom-[-40px] opacity-10 pointer-events-none select-none">
          <Trophy className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* User Yard Standing & Privacy Controls */}
      {user && userPropertiesWithSurveys.length > 0 && (
        <div className="bg-[#FDFBF7] border border-stone-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Your Yard Status & Privacy Controls
              </span>
              <p className="text-xs text-stone-600">
                During the pilot phase, yards with surveys are published by default to encourage community exchange. You can unpublish anytime to keep your yard private.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {userPropertiesWithSurveys.map((prop) => {
                const isPublished = yards.some((y) => y.id === prop.id && y.published);
                const isBusy = togglingPropertyId === prop.id;

                return (
                  <div
                    key={prop.id}
                    className="flex items-center gap-2.5 bg-white border border-stone-200 px-3.5 py-2 rounded-xl text-xs"
                  >
                    <span className="font-semibold text-stone-800">{prop.name}</span>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTogglePublish(prop, isPublished)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        isPublished
                          ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                          : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                      }`}
                    >
                      {isBusy ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isPublished ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Published (Click to Unpublish)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-stone-500" />
                          <span>Private (Click to Publish)</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {toggleNotice && (
            <p className="text-xs text-emerald-800 mt-2 font-medium animate-in fade-in">
              {toggleNotice}
            </p>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by yard name, gardener, town, or plant..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-800/20 text-stone-900"
          />
        </div>

        {/* County Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 whitespace-nowrap hidden sm:inline">County:</span>
          <select
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-800/20"
          >
            {NJ_COUNTIES.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>

          {/* Sort By Selector */}
          <span className="text-xs text-stone-500 whitespace-nowrap hidden sm:inline">Rank by:</span>
          <div className="inline-flex rounded-xl bg-stone-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSortBy("score")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                sortBy === "score" ? "bg-white text-stone-900 shadow-xs font-bold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Score
            </button>
            <button
              type="button"
              onClick={() => setSortBy("species")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                sortBy === "species" ? "bg-white text-stone-900 shadow-xs font-bold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Native Species
            </button>
            <button
              type="button"
              onClick={() => setSortBy("keystone")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                sortBy === "keystone" ? "bg-white text-stone-900 shadow-xs font-bold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Keystone
            </button>
          </div>
        </div>
      </div>

      {/* Podium for Top 3 (if no search filter applied and >= 3 yards) */}
      {!searchQuery && selectedCounty === "All New Jersey" && yards.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* #2 Silver (left on desktop) */}
          <div
            onClick={() => setSelectedYard(yards[1])}
            className="cursor-pointer group order-2 md:order-1 bg-white border-2 border-stone-200 hover:border-stone-400 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-bold font-mono text-sm shadow-xs">
                  #2
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                  Silver Habitat
                </span>
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900 group-hover:text-emerald-900 transition-colors">
                  {yards[1].yardName}
                </h3>
                <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {yards[1].townOrCounty}
                </p>
                <p className="text-xs text-stone-600 font-medium mt-1">
                  Gardener: {yards[1].gardenerAlias}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 block">Score</span>
                <span className="text-2xl font-bold font-mono text-stone-900">{yards[1].score}</span>
              </div>
              <span className="text-xs font-medium text-emerald-800 group-hover:underline flex items-center gap-0.5">
                View Yard <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* #1 Gold (center on desktop, slightly taller) */}
          <div
            onClick={() => setSelectedYard(yards[0])}
            className="cursor-pointer group order-1 md:order-2 bg-gradient-to-b from-amber-50/50 to-white border-2 border-amber-300 hover:border-amber-400 rounded-2xl p-6 shadow-md transition-all hover:shadow-lg flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider shadow-xs">
              Statewide Leader
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-400 text-amber-950 font-black font-mono text-base shadow-sm">
                  #1
                </span>
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-stone-900 group-hover:text-amber-900 transition-colors">
                  {yards[0].yardName}
                </h3>
                <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {yards[0].townOrCounty}
                </p>
                <p className="text-xs text-stone-700 font-medium mt-1">
                  Gardener: {yards[0].gardenerAlias}
                </p>
              </div>

              {/* Badges preview */}
              {yards[0].badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {yards[0].badges.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className="text-xs px-2 py-0.5 bg-amber-100/80 text-amber-900 rounded-md font-medium"
                    >
                      {b.icon} {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-amber-200/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold block">Top Habitat Score</span>
                <span className="text-3xl font-black font-mono text-amber-950">{yards[0].score}</span>
              </div>
              <span className="text-xs font-semibold text-amber-900 group-hover:underline flex items-center gap-0.5">
                Inspect Showcase <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* #3 Bronze (right on desktop) */}
          <div
            onClick={() => setSelectedYard(yards[2])}
            className="cursor-pointer group order-3 md:order-3 bg-white border-2 border-stone-200 hover:border-stone-400 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-900 font-bold font-mono text-sm shadow-xs">
                  #3
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  Bronze Habitat
                </span>
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900 group-hover:text-emerald-900 transition-colors">
                  {yards[2].yardName}
                </h3>
                <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {yards[2].townOrCounty}
                </p>
                <p className="text-xs text-stone-600 font-medium mt-1">
                  Gardener: {yards[2].gardenerAlias}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 block">Score</span>
                <span className="text-2xl font-bold font-mono text-stone-900">{yards[2].score}</span>
              </div>
              <span className="text-xs font-medium text-emerald-800 group-hover:underline flex items-center gap-0.5">
                View Yard <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table / Rows */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-800" />
            Ranked Yard Standings
          </h2>
          <span className="text-xs text-stone-500">
            Showing {yards.length} {yards.length === 1 ? "yard" : "yards"}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-500 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-800" />
            <p className="text-sm">Loading community leaderboard...</p>
          </div>
        ) : yards.length === 0 ? (
          <div className="p-12 text-center text-stone-500 space-y-2">
            <Trophy className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-sm font-medium">No yards match your search criteria.</p>
            <p className="text-xs text-stone-400">Try adjusting your county or search filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {yards.map((yard, index) => {
              const rank = index + 1;
              const isTopThree = rank <= 3;

              return (
                <div
                  key={yard.id}
                  onClick={() => setSelectedYard(yard)}
                  className="px-6 py-4 hover:bg-stone-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Rank Badge */}
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-mono text-sm font-bold shrink-0 ${
                        rank === 1
                          ? "bg-amber-400 text-amber-950 shadow-xs"
                          : rank === 2
                          ? "bg-slate-200 text-slate-800"
                          : rank === 3
                          ? "bg-amber-700/20 text-amber-900"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {rank}
                    </span>

                    {/* Yard Info */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-stone-900 text-sm truncate group-hover:text-emerald-900 transition-colors">
                          {yard.yardName}
                        </h3>
                        {yard.badges.slice(0, 2).map((b) => (
                          <span
                            key={b.id}
                            title={b.description}
                            className="hidden sm:inline-block text-xs"
                          >
                            {b.icon}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-x-3 text-xs text-stone-500">
                        <span>By {yard.gardenerAlias}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          {yard.townOrCounty}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Metrics & CTA */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="hidden sm:block text-right">
                      <span className="text-xs font-semibold text-stone-800 block">
                        {yard.nativeSpeciesCount} native species
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {yard.keystoneCount} keystone genera
                      </span>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <span className="text-xl font-bold font-mono text-emerald-900 block leading-none">
                        {yard.score}
                      </span>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider">Score</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedYard(yard);
                      }}
                      className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Showcase
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Public Read-Only Yard Detail Modal */}
      {selectedYard && (
        <PublicYardModal
          yard={selectedYard}
          onClose={() => setSelectedYard(null)}
        />
      )}
    </div>
  );
}

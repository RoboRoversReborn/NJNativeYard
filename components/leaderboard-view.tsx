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
  Medal,
  Crown,
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
        setToggleNotice(`"${property.name}" set to Private.`);
      } else {
        const propSurveys = surveys.filter((s) =>
          property.yard_areas.some((a) => a.id === s.areaId)
        );
        await publishYardToLeaderboard(property, propSurveys, user);
        setToggleNotice(`"${property.name}" set to Public on Leaderboard!`);
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
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-emerald-950 to-stone-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-stone-800">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Trophy className="w-3.5 h-3.5" />
            NJ Native Yard Leaderboard
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-stone-50">
            Garden State Habitat Rankings
          </h1>
          <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
            Gamifying habitat restoration across New Jersey. Track high-scoring yards, explore native plant inventories, and inspect top ecological sanctuaries.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-stone-800/80 max-w-lg">
            <div>
              <span className="text-xs text-stone-400 block">Ranked Yards</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">{yards.length}</span>
            </div>
            <div>
              <span className="text-xs text-stone-400 block">Native Flora Found</span>
              <span className="text-2xl font-bold font-mono text-stone-100">{totalNativeSpecies}+</span>
            </div>
            <div>
              <span className="text-xs text-stone-400 block">Average Score</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{avgScore} / 100</span>
            </div>
          </div>
        </div>

        <div className="absolute right-[-40px] bottom-[-40px] opacity-10 pointer-events-none select-none">
          <Trophy className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Simplified Privacy Control: Yes/No Toggle Switch */}
      {user && userPropertiesWithSurveys.length > 0 && (
        <div className="bg-[#FAF8F5] border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Your Yard Privacy Settings
              </span>
              <p className="text-xs text-stone-600">
                Choose whether your yard appears on the public leaderboard. Street address and private details are never shared.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {userPropertiesWithSurveys.map((prop) => {
                const isPublished = yards.some((y) => y.id === prop.id && y.published);
                const isBusy = togglingPropertyId === prop.id;

                return (
                  <div
                    key={prop.id}
                    className="flex items-center gap-3 bg-white border border-stone-200 px-3.5 py-2 rounded-xl shadow-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-stone-900 text-xs block truncate max-w-[130px]">
                        {prop.name}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Public on Leaderboard:{" "}
                        <strong className={isPublished ? "text-emerald-700" : "text-stone-600"}>
                          {isPublished ? "Yes" : "No"}
                        </strong>
                      </span>
                    </div>

                    {/* Simple Yes/No Switch Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPublished}
                      aria-label={`Toggle public leaderboard visibility for ${prop.name}`}
                      disabled={isBusy}
                      onClick={() => handleTogglePublish(prop, isPublished)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:ring-offset-1 ${
                        isPublished ? "bg-emerald-700" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isPublished ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {toggleNotice && (
            <p className="text-xs text-emerald-800 mt-2 font-medium">
              {toggleNotice}
            </p>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
        {/* Search */}
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

        {/* County Filter */}
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

          {/* Sort Selector */}
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
              Species
            </button>
            <button
              type="button"
              onClick={() => setSortBy("keystone")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                sortBy === "keystone" ? "bg-white text-stone-900 shadow-xs font-bold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Keystones
            </button>
          </div>
        </div>
      </div>

      {/* Gaming Leaderboard Table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Community Standings
            </h2>
          </div>
          <span className="text-xs text-stone-500">
            {yards.length} {yards.length === 1 ? "yard" : "yards"} listed • Click any row to inspect details
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-500 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-800" />
            <p className="text-sm">Loading leaderboard rankings...</p>
          </div>
        ) : yards.length === 0 ? (
          <div className="p-12 text-center text-stone-500 space-y-2">
            <Trophy className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-sm font-medium">No yards match your search criteria.</p>
            <p className="text-xs text-stone-400">Try adjusting your county filter or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/40 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th scope="col" className="py-3 px-4 text-center w-16">Rank</th>
                  <th scope="col" className="py-3 px-4">Yard & Gardener</th>
                  <th scope="col" className="py-3 px-4 text-center">Score</th>
                  <th scope="col" className="py-3 px-4 text-center">Native Species</th>
                  <th scope="col" className="py-3 px-4 text-center">Keystones</th>
                  <th scope="col" className="py-3 px-4 text-center">Invasives</th>
                  <th scope="col" className="py-3 px-4">Badges</th>
                  <th scope="col" className="py-3 px-4 text-right">Showcase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {yards.map((yard, index) => {
                  const rank = index + 1;
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;
                  const thumbnail = yard.coverPhotoUrl || "/samples/mixed-garden-starting-v4.png";

                  return (
                    <tr
                      key={yard.id}
                      onClick={() => setSelectedYard(yard)}
                      className={`cursor-pointer group transition-colors ${
                        isGold
                          ? "bg-amber-50/30 hover:bg-amber-50/60"
                          : isSilver
                          ? "bg-slate-50/30 hover:bg-slate-50/60"
                          : isBronze
                          ? "bg-amber-900/5 hover:bg-amber-900/10"
                          : "hover:bg-emerald-50/40"
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          {isGold ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 text-amber-950 font-black font-mono text-sm shadow-xs border border-amber-300">
                              #1
                            </span>
                          ) : isSilver ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-bold font-mono text-sm shadow-xs border border-slate-300">
                              #2
                            </span>
                          ) : isBronze ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-900 font-bold font-mono text-sm shadow-xs border border-amber-300/40">
                              #3
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-stone-100 text-stone-600 font-bold font-mono text-xs">
                              {rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Yard & Image Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Yard Small Thumbnail */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbnail}
                            alt={yard.yardName}
                            className="w-12 h-12 rounded-xl object-cover border border-stone-200/90 shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/samples/mixed-garden-starting-v4.png";
                            }}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-stone-900 group-hover:text-emerald-900 transition-colors block truncate max-w-[220px] sm:max-w-xs">
                              {yard.yardName}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                              <span className="font-medium text-stone-700">{yard.gardenerAlias}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-stone-500 truncate">
                                <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                                {yard.townOrCounty}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Habitat Score */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xl font-black font-mono text-emerald-950 leading-none">
                            {yard.score}
                          </span>
                          <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded-full mt-1">
                            {yard.score >= 80 ? "Thriving" : yard.score >= 50 ? "Growing" : "Developing"}
                          </span>
                        </div>
                      </td>

                      {/* Native Species */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="inline-flex items-center gap-1 font-semibold text-stone-800">
                          <Leaf className="w-3.5 h-3.5 text-emerald-700" />
                          {yard.nativeSpeciesCount}
                        </span>
                      </td>

                      {/* Keystone Count */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-900">
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                          {yard.keystoneCount}
                        </span>
                      </td>

                      {/* Invasives Count */}
                      <td className="py-3 px-4 text-center font-mono">
                        {yard.invasiveCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                            <ShieldCheck className="w-3 h-3" />
                            0
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            {yard.invasiveCount}
                          </span>
                        )}
                      </td>

                      {/* Badges Preview */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {yard.badges.slice(0, 3).map((b) => (
                            <span
                              key={b.id}
                              title={`${b.label}: ${b.description}`}
                              className="text-sm px-1.5 py-0.5 bg-stone-100 rounded-md border border-stone-200/60"
                            >
                              {b.icon}
                            </span>
                          ))}
                          {yard.badges.length > 3 && (
                            <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-1 py-0.5 rounded-md">
                              +{yard.badges.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedYard(yard);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 rounded-xl transition-all shadow-xs group-hover:border-emerald-500"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-700" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

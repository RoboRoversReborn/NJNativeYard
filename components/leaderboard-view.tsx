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
  Leaf,
  Globe,
  Lock,
  Unlock,
  CheckCircle2,
  RefreshCw,
  Sprout,
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

// Reference-inspired pastel card styling per rank
const ROW_THEMES = [
  { bg: "bg-[#E6F7F2] hover:bg-[#D9F3EC] border-[#BDEBDC] text-emerald-950", rankColor: "text-emerald-900" }, // Mint (#001)
  { bg: "bg-[#FFF1E4] hover:bg-[#FFE7D4] border-[#FEDBBD] text-amber-950", rankColor: "text-amber-900" },     // Peach (#002)
  { bg: "bg-[#FFEBE5] hover:bg-[#FFDDD4] border-[#FDC4B5] text-orange-950", rankColor: "text-orange-900" },   // Coral (#003)
  { bg: "bg-[#FDF0F6] hover:bg-[#FCE1EF] border-[#F8C8DF] text-pink-950", rankColor: "text-pink-900" },        // Rose (#004)
  { bg: "bg-[#F3EEFD] hover:bg-[#E9E0FA] border-[#D9C6F6] text-purple-950", rankColor: "text-purple-900" },    // Lavender (#005)
  { bg: "bg-[#F0F5FA] hover:bg-[#E2EDF7] border-[#C8DCF0] text-sky-950", rankColor: "text-sky-900" },          // Sky (#006)
  { bg: "bg-[#F7F5F0] hover:bg-[#EFECE3] border-[#E2DED4] text-stone-900", rankColor: "text-stone-800" },      // Sand (#007+)
];

const BADGE_LEGEND = [
  { icon: "🏆", title: "Keystone Champion", desc: "2+ Keystone Genera" },
  { icon: "🐝", title: "Bee Haven", desc: "4+ Native Flower Species" },
  { icon: "🛡️", title: "Invasive Free", desc: "0 Invasive Plants Found" },
  { icon: "🌳", title: "Canopy Restorer", desc: "Native Tree Canopy" },
  { icon: "💯", title: "Century Habitat", desc: "Score 100+ Showcase" },
];

function formatRank(rank: number): string {
  return rank.toString().padStart(3, "0");
}

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

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      if (user && properties.length > 0) {
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
      {/* Title Header Matching Reference Style: Clean, No Giant Banners */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/70">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-stone-900">
            Native Yard Goals Leaderboard
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Tracking New Jersey residential habitat restoration, species diversity, and ecological achievements.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-stone-100 px-4 py-2 rounded-full border border-stone-200 text-xs font-bold text-stone-800 tracking-wider shadow-xs">
          <Sprout className="w-4 h-4 text-emerald-700" />
          <span>NATIVEYARD NJ</span>
        </div>
      </div>

      {/* Simplified Privacy Control: Yes/No Toggle Switch */}
      {user && userPropertiesWithSurveys.length > 0 && (
        <div className="bg-[#FAF8F5] border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                My Yard Public Visibility
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

      {/* Tabular Layout Wrapped with Horizontal Scroll Support */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px] space-y-3">
          {/* Black Header Pill Exactly Matching Reference Image */}
          <div className="bg-black text-white rounded-2xl px-6 sm:px-8 py-3.5 shadow-md grid grid-cols-12 items-center text-xs font-bold uppercase tracking-wider">
            <div className="col-span-4">Name</div>
            <div className="col-span-2 text-center">Rank</div>
            <div className="col-span-3">Location</div>
            <div className="col-span-1 text-center">Score</div>
            <div className="col-span-2 text-right">Badges</div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-stone-500 space-y-3 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-800" />
              <p className="text-sm">Loading leaderboard rankings...</p>
            </div>
          ) : yards.length === 0 ? (
            <div className="p-12 text-center text-stone-500 space-y-2 bg-white rounded-2xl border border-stone-200">
              <Trophy className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-sm font-medium">No yards match your search criteria.</p>
              <p className="text-xs text-stone-400">Try adjusting your county filter or search query.</p>
            </div>
          ) : (
            /* Floating Pastel Card Rows Matching Reference Design */
            <div className="space-y-3">
              {yards.map((yard, index) => {
                const rank = index + 1;
                const theme = ROW_THEMES[Math.min(index, ROW_THEMES.length - 1)];
                const thumbnail = yard.coverPhotoUrl || "/samples/mixed-garden-starting-v4.png";

                return (
                  <div
                    key={yard.id}
                    onClick={() => setSelectedYard(yard)}
                    className={`group rounded-2xl px-6 sm:px-8 py-3.5 border transition-all duration-200 shadow-xs hover:shadow-md hover:scale-[1.006] cursor-pointer grid grid-cols-12 items-center gap-2 ${theme.bg}`}
                  >
                    {/* Column 1: Small Circular Avatar (40x40) + Yard Name & Gardener */}
                    <div className="col-span-4 flex items-center gap-3.5 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnail}
                        alt={yard.yardName}
                        width={40}
                        height={40}
                        style={{
                          width: "40px",
                          height: "40px",
                          minWidth: "40px",
                          minHeight: "40px",
                          maxWidth: "40px",
                          maxHeight: "40px",
                          objectFit: "cover",
                          borderRadius: "9999px",
                        }}
                        className="w-10 h-10 rounded-full object-cover shadow-xs border-2 border-white/80 shrink-0 group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/samples/mixed-garden-starting-v4.png";
                        }}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-sm block truncate text-stone-900 group-hover:text-emerald-950">
                          {yard.yardName}
                        </span>
                        <span className="text-xs text-stone-600 block truncate">
                          {yard.gardenerAlias}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: Rank (Formatted like 001, 002, 003...) */}
                    <div className="col-span-2 text-center">
                      <span className={`font-mono font-black text-base tracking-wider ${theme.rankColor}`}>
                        {formatRank(rank)}
                      </span>
                    </div>

                    {/* Column 3: Location / County */}
                    <div className="col-span-3 text-xs font-medium text-stone-700 flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{yard.townOrCounty}</span>
                    </div>

                    {/* Column 4: Score */}
                    <div className="col-span-1 text-center">
                      <span className="font-mono font-black text-lg text-stone-900 block leading-tight">
                        {yard.score}
                      </span>
                    </div>

                    {/* Column 5: Badges (Circular Badges Matching Reference) */}
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      {yard.badges.slice(0, 4).map((b) => (
                        <span
                          key={b.id}
                          title={`${b.label}: ${b.description}`}
                          className="w-8 h-8 rounded-full bg-white/95 border border-stone-200/60 shadow-xs flex items-center justify-center text-sm shrink-0 hover:scale-110 transition-transform"
                        >
                          {b.icon}
                        </span>
                      ))}
                      {yard.badges.length > 4 && (
                        <span className="text-[11px] font-bold text-stone-600 bg-white/80 px-2 py-1 rounded-full shadow-xs">
                          +{yard.badges.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Badge Legend Card (Exactly Matching Reference Image) */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3 text-center sm:text-left">
          Community Ecological Badges & Achievements
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {BADGE_LEGEND.map((badge) => (
            <div
              key={badge.title}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/50"
            >
              <div className="w-9 h-9 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-base shrink-0">
                {badge.icon}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-stone-900 block truncate leading-tight">
                  {badge.title}
                </span>
                <span className="text-[11px] text-stone-500 block truncate leading-tight mt-0.5">
                  {badge.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
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

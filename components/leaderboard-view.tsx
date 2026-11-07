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
    <div className="lb-container">
      {/* Title Header Matching Reference Style: Clean, No Giant Banners */}
      <div className="lb-header">
        <div className="lb-title-wrap">
          <h1 className="lb-title">
            Native Yard Goals Leaderboard
          </h1>
          <p className="lb-subtitle">
            Tracking New Jersey residential habitat restoration, species diversity, and ecological achievements.
          </p>
        </div>

        <div className="lb-brand-badge">
          <Sprout style={{ width: 16, height: 16, color: "#244b34" }} />
          <span>NATIVEYARD NJ</span>
        </div>
      </div>

      {/* Simplified Privacy Control: Yes/No Toggle Switch */}
      {user && userPropertiesWithSurveys.length > 0 && (
        <div className="lb-privacy-card">
          <div className="lb-privacy-info">
            <span className="lb-privacy-title">
              <ShieldCheck style={{ width: 16, height: 16, color: "#244b34" }} />
              My Yard Public Visibility
            </span>
            <p className="lb-privacy-desc">
              Choose whether your yard appears on the public leaderboard. Street address and private details are never shared.
            </p>
          </div>

          <div className="lb-privacy-actions">
            {userPropertiesWithSurveys.map((prop) => {
              const isPublished = yards.some((y) => y.id === prop.id && y.published);
              const isBusy = togglingPropertyId === prop.id;

              return (
                <div key={prop.id} className="lb-privacy-item">
                  <div>
                    <span className="lb-privacy-prop-name">
                      {prop.name}
                    </span>
                    <span className="lb-privacy-prop-sub">
                      Public on Leaderboard:{" "}
                      <strong style={{ color: isPublished ? "#244b34" : "#6c786e" }}>
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
                    className="lb-toggle-btn"
                  >
                    <span className="lb-toggle-thumb" />
                  </button>
                </div>
              );
            })}
          </div>
          {toggleNotice && (
            <p style={{ fontSize: 12, color: "#244b34", fontWeight: 600, margin: 0 }}>
              {toggleNotice}
            </p>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="lb-controls">
        <div className="lb-search-wrap">
          <Search className="lb-search-icon" style={{ width: 16, height: 16 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by yard name, gardener, town, or plant..."
            className="lb-search-input"
          />
        </div>

        <div className="lb-filters-wrap">
          <span className="lb-filter-label">County:</span>
          <select
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            className="lb-select"
          >
            {NJ_COUNTIES.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>

          <span className="lb-filter-label">Rank by:</span>
          <div className="lb-sort-group">
            <button
              type="button"
              onClick={() => setSortBy("score")}
              aria-pressed={sortBy === "score"}
              className="lb-sort-btn"
            >
              Score
            </button>
            <button
              type="button"
              onClick={() => setSortBy("species")}
              aria-pressed={sortBy === "species"}
              className="lb-sort-btn"
            >
              Species
            </button>
            <button
              type="button"
              onClick={() => setSortBy("keystone")}
              aria-pressed={sortBy === "keystone"}
              className="lb-sort-btn"
            >
              Keystones
            </button>
          </div>
        </div>
      </div>

      {/* Semantic Tabular Layout (Strictly enforced rows and columns) */}
      <div className="lb-table-wrapper">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="lb-col-name">Name</th>
              <th className="lb-col-rank">Rank</th>
              <th className="lb-col-location">Location</th>
              <th className="lb-col-score">Score</th>
              <th className="lb-col-badges">Badges</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "48px 20px" }}>
                  <RefreshCw style={{ width: 24, height: 24, color: "#244b34", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                  <p style={{ marginTop: 12, color: "#586358", fontSize: 14 }}>Loading leaderboard rankings...</p>
                </td>
              </tr>
            ) : yards.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "48px 20px" }}>
                  <Trophy style={{ width: 32, height: 32, color: "#8c978e", margin: "0 auto 8px" }} />
                  <p style={{ fontWeight: 700, color: "#1a221b", margin: 0 }}>No yards match your search criteria.</p>
                  <p style={{ fontSize: 12, color: "#8c978e", marginTop: 4 }}>Try adjusting your county filter or search query.</p>
                </td>
              </tr>
            ) : (
              yards.map((yard, index) => {
                const rank = index + 1;
                const rowClass =
                  rank === 1 ? "lb-row-rank-1" :
                  rank === 2 ? "lb-row-rank-2" :
                  rank === 3 ? "lb-row-rank-3" :
                  rank === 4 ? "lb-row-rank-4" :
                  rank === 5 ? "lb-row-rank-5" :
                  rank === 6 ? "lb-row-rank-6" :
                  "lb-row-rank-default";
                const thumbnail = yard.coverPhotoUrl || "/samples/mixed-garden-starting-v4.png";

                return (
                  <tr
                    key={yard.id}
                    onClick={() => setSelectedYard(yard)}
                    className={rowClass}
                  >
                    {/* Column 1: Small Circular Avatar (40x40) + Yard Name & Gardener */}
                    <td className="lb-col-name">
                      <div className="lb-name-cell">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnail}
                          alt={yard.yardName}
                          width={40}
                          height={40}
                          className="lb-avatar"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/samples/mixed-garden-starting-v4.png";
                          }}
                        />
                        <div className="lb-name-info">
                          <span className="lb-yard-name">{yard.yardName}</span>
                          <span className="lb-gardener-alias">{yard.gardenerAlias}</span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Rank (Formatted like 001, 002, 003...) */}
                    <td className="lb-col-rank">
                      <span className="lb-rank-num">{formatRank(rank)}</span>
                    </td>

                    {/* Column 3: Location / County */}
                    <td className="lb-col-location">
                      <div className="lb-location-cell">
                        <MapPin style={{ width: 14, height: 14, color: "#78857a", flexShrink: 0 }} />
                        <span>{yard.townOrCounty}</span>
                      </div>
                    </td>

                    {/* Column 4: Score */}
                    <td className="lb-col-score">
                      <span className="lb-score-cell">{yard.score}</span>
                    </td>

                    {/* Column 5: Badges (Circular Badges Matching Reference) */}
                    <td className="lb-col-badges">
                      <div className="lb-badges-cell">
                        {yard.badges.slice(0, 4).map((b) => (
                          <span
                            key={b.id}
                            title={`${b.label}: ${b.description}`}
                            className="lb-badge-icon"
                          >
                            {b.icon}
                          </span>
                        ))}
                        {yard.badges.length > 4 && (
                          <span className="lb-badge-more">
                            +{yard.badges.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Badge Legend Card (Matching Reference Image) */}
      <div className="lb-legend-card">
        <div className="lb-legend-heading">
          Community Ecological Badges & Achievements
        </div>
        <div className="lb-legend-grid">
          {BADGE_LEGEND.map((badge) => (
            <div key={badge.title} className="lb-legend-item">
              <div className="lb-legend-icon">
                {badge.icon}
              </div>
              <div>
                <span className="lb-legend-title block">
                  {badge.title}
                </span>
                <span className="lb-legend-desc block">
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

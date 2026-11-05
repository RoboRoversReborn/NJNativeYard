/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  CalendarDays,
  Check,
  CircleAlert,
  Droplets,
  FileText,
  Info,
  Leaf,
  MapPin,
  ScanLine,
  Sparkles,
  Sun,
  Trash2,
  TreePine,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { ScoreRing } from "./score-ring";
import { StatusBadge } from "./status-badge";
import {
  getPlant,
  getStatusMeta,
  NJ_STATUS_META,
  rebuildAudit,
} from "@/lib/plants";
import type { Audit, Detection, NjPlantStatus } from "@/lib/types";

type AuditViewProps = {
  audit: Audit;
  photo: string;
  onAuditChange: (audit: Audit) => void;
  onReport: () => void;
  onReset: () => void;
  onHome: () => void;
};

const NJ_STATUS_ORDER: NjPlantStatus[] = [
  "NATIVE_KEYSTONE",
  "NATIVE",
  "NON_NATIVE_BENIGN",
  "INVASIVE_REGULATED",
  "INVASIVE_WATCHLIST",
];

export function AuditView({
  audit,
  photo,
  onAuditChange,
  onReport,
  onReset,
  onHome,
}: AuditViewProps) {
  const [selectedId, setSelectedId] = useState(
    audit.detections.find((detection) => getPlant(detection.plantId)?.status === "invasive")
      ?.id ??
      audit.detections[0]?.id ??
      "",
  );

  const selectedDetection =
    audit.detections.find((detection) => detection.id === selectedId) ??
    audit.detections[0];
  const selectedPlant = selectedDetection
    ? getPlant(selectedDetection.plantId)
    : undefined;

  const sortedDetections = useMemo(() => {
    const rank: Record<string, number> = {
      invasive: 0,
      "non-native": 1,
      keystone: 2,
      native: 3,
    };
    return [...audit.detections].sort((a, b) => {
      const plantA = getPlant(a.plantId);
      const plantB = getPlant(b.plantId);
      return (rank[plantA?.status ?? "native"] ?? 4) - (rank[plantB?.status ?? "native"] ?? 4);
    });
  }, [audit.detections]);

  const invasiveCount = audit.detections.filter(
    (detection) => getPlant(detection.plantId)?.status === "invasive",
  ).length;
  const highPrioritySwaps = audit.swaps.filter((swap) => swap.priority === "high");
  const swapNames = selectedPlant
    ? (selectedPlant.swapIds ?? [])
        .slice(0, 3)
        .map((id) => getPlant(id)?.commonName)
        .filter(Boolean)
    : [];

  function updateDetections(next: Detection[]) {
    onAuditChange(rebuildAudit(audit, next));
  }

  function removeDetection(detectionId: string) {
    if (audit.detections.length <= 1) return;
    const next = audit.detections.filter((detection) => detection.id !== detectionId);
    updateDetections(next);
    setSelectedId(next[0]?.id ?? "");
  }

  function confirmMatch(detectionId: string, plantId: string) {
    const next = audit.detections.map((detection) =>
      detection.id === detectionId
        ? {
            ...detection,
            plantId,
            needsReview: false,
            topMatches: undefined,
            confidence: Math.max(detection.confidence, 0.76),
          }
        : detection,
    );
    updateDetections(next);
  }

  return (
    <div className="min-h-screen bg-[#f4f1e6] text-[#1d2a21]">
      <header className="app-header no-print">
        <div className="container-shell flex h-16 items-center justify-between gap-4">
          <button type="button" onClick={onHome} aria-label="Back to NativeYard home">
            <Brand />
          </button>

          <div className="hidden items-center gap-1 rounded-full border border-[#d8d3bf] bg-[#fbfaf4] p-1 text-[0.68rem] font-bold sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#7a806e]">
              <Check className="h-3.5 w-3.5 text-[#3f7d45]" />
              Photo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#163f2c] px-3 py-1.5 text-[#f7f4e9]">
              <ScanLine className="h-3.5 w-3.5 text-[#d7f27a]" />
              Yard audit
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#9a9f91]">
              <FileText className="h-3.5 w-3.5" />
              Report
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="hidden items-center gap-1.5 rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-3.5 py-2 text-[0.72rem] font-bold text-[#5d6b60] transition hover:border-[#b9b4a2] hover:text-[#163f2c] sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              New audit
            </button>
            <button
              type="button"
              onClick={onReport}
              className="btn btn-dark px-4 py-2 text-[0.72rem]"
            >
              View report
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container-shell pb-16 pt-7 sm:pt-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow text-[#6b7a68]">Yard audit · {formatDate(audit.createdAt)}</p>
              <span className="rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#8b9182]">
                {audit.demoMode ? "Demo analysis" : "Live analysis"}
              </span>
            </div>
            <h1 className="mt-2 font-display text-[clamp(2.5rem,5.2vw,4.2rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-[#163f2c]">
              Your yard, decoded.
            </h1>
            <p className="mt-3 max-w-[39rem] text-[0.92rem] leading-6 text-[#5d6b60]">
              Tap any plant in the photo to inspect its ecological role. The
              report turns the red flags into a prioritized removal and native
              replacement plan.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-3 py-2 text-[0.7rem] font-semibold text-[#5d6b60]">
              <MapPin className="h-3.5 w-3.5 text-[#3f7d45]" />
              {audit.location.city}
              {audit.location.county && audit.location.county !== "New Jersey"
                ? `, ${audit.location.county} County`
                : ""}
              {audit.location.state ? `, ${audit.location.state}` : ""} ·{" "}
              {audit.location.zip}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-3 py-2 text-[0.7rem] font-semibold text-[#5d6b60]">
              <Leaf className="h-3.5 w-3.5 text-[#3f7d45]" />
              Zone {audit.location.zone}
              {audit.location.province ? ` · ${audit.location.province}` : ` · ${audit.location.ecoregion}`}
            </span>
          </div>
        </div>

        {(audit.demoMode || audit.notice) && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e2d4ae] bg-[#faf1dc] px-4 py-3 text-[0.76rem] leading-5 text-[#7b6228]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong className="font-bold">
                {audit.demoMode ? "Sample yard audit." : "Analysis note."}
              </strong>{" "}
              {audit.notice ??
                "This sample uses a representative New Jersey plant set so you can explore the full audit and report. Upload your own photo to run live identification."}
            </p>
          </div>
        )}

        {(audit.reviewCount ?? 0) > 0 && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[#e7d09b] bg-[#fdf6e6] px-4 py-3 text-[0.76rem] leading-5 text-[#7b6228]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong className="font-bold">
                {audit.reviewCount} low-confidence{" "}
                {audit.reviewCount === 1 ? "match needs" : "matches need"} a
                quick check.
              </strong>{" "}
              Tap the highlighted box, compare the leaf or flower shape, then
              confirm the right NJ species or remove it from the audit.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-[1.6rem] border border-[#d5cfbd] bg-[#fbfaf4] shadow-[0_18px_45px_rgba(45,61,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e0d1] px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#163f2c] text-[#d7f27a]">
                    <ScanLine className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[0.76rem] font-bold text-[#263b2b]">
                      {audit.detections.length} plants detected
                    </p>
                    <p className="text-[0.64rem] text-[#8b9182]">
                      Tap a box to inspect · {audit.location.ecoregion}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {NJ_STATUS_ORDER.map((status) => (
                    <span
                      key={status}
                      className="inline-flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#7a806e]"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: NJ_STATUS_META[status].color }}
                      />
                      {NJ_STATUS_META[status].short}
                    </span>
                  ))}
                </div>
              </div>

              <div className="audit-photo">
                <img src={photo} alt="Yard photo with detected plants highlighted" />
                <div className="audit-photo__vignette" />

                {audit.detections.map((detection, index) => {
                  const plant = getPlant(detection.plantId);
                  if (!plant) return null;
                  const meta = getStatusMeta(plant);
                  const selected = detection.id === selectedDetection?.id;
                  const needsReview =
                    detection.needsReview ||
                    detection.confidence < 0.75;

                  return (
                    <button
                      key={detection.id}
                      type="button"
                      className={`detection-box ${selected ? "is-selected" : ""} ${
                        needsReview ? "needs-review" : ""
                      }`}
                      style={{
                        left: `${detection.box.x}%`,
                        top: `${detection.box.y}%`,
                        width: `${detection.box.w}%`,
                        height: `${detection.box.h}%`,
                        borderColor: meta.color,
                        background: selected ? `${meta.color}2e` : `${meta.color}12`,
                      }}
                      onClick={() => setSelectedId(detection.id)}
                      title={`${plant.commonName} · ${meta.label}${
                        needsReview ? " · low confidence" : ""
                      }`}
                      aria-label={`${plant.commonName}, ${meta.label}, ${Math.round(
                        detection.confidence * 100,
                      )}% confidence${needsReview ? ", needs review" : ""}`}
                    >
                      <span
                        className="detection-box__number"
                        style={{ background: meta.color }}
                      >
                        {index + 1}
                      </span>
                      {needsReview && (
                        <span className="detection-box__review" aria-hidden="true">
                          ?
                        </span>
                      )}
                      <span className="detection-box__label">
                        {plant.commonName}
                      </span>
                    </button>
                  );
                })}

                <div className="audit-photo__hint">
                  <Sparkles className="h-3.5 w-3.5" />
                  Tap any plant box
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Invasive plants",
                  value: invasiveCount,
                  detail: "Prioritize removal",
                  tone: "bad",
                },
                {
                  label: "Native swaps",
                  value: audit.swaps.length,
                  detail: "Ready in the report",
                  tone: "good",
                },
                {
                  label: "Keystone hosts",
                  value: audit.metrics.find((metric) => metric.label === "Keystone species")?.value ?? "0",
                  detail: "Preserve and celebrate",
                  tone: "good",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[#d9d4c4] bg-[#fbfaf4] px-4 py-3.5"
                >
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.11em] text-[#8b9182]">
                    {item.label}
                  </p>
                  <p
                    className={`mt-1 font-display text-[1.55rem] font-semibold leading-none ${
                      item.tone === "bad" ? "text-[#b6533d]" : "text-[#3f7d45]"
                    }`}
                  >
                    {item.value}
                  </p>
                  <p className="mt-1 text-[0.64rem] text-[#8b9182]">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-[1.6rem] bg-[#163f2c] p-5 text-[#f7f4e9] shadow-[0_18px_45px_rgba(22,63,44,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-[0.61rem] text-[#a9c67a]">
                    Yard biodiversity score
                  </p>
                  <p className="mt-1 font-display text-[1.5rem] font-semibold leading-none">
                    {audit.scoreLabel}
                  </p>
                  <p className="mt-2 max-w-[15rem] text-[0.68rem] leading-5 text-[#c7d3bd]">
                    Based on native cover, invasive pressure, host genera, and
                    keystone presence.
                  </p>
                </div>
                <ScoreRing score={audit.score} size={104} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4">
                {audit.metrics.map((metric) => (
                  <div key={metric.label}>
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#a9b59e]">
                      {metric.label}
                    </p>
                    <p
                      className={`mt-0.5 font-display text-[1.25rem] font-semibold leading-none ${
                        metric.tone === "bad"
                          ? "text-[#f0a38e]"
                          : metric.tone === "warn"
                            ? "text-[#f2d18d]"
                            : "text-[#d7f27a]"
                      }`}
                    >
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {selectedPlant && selectedDetection && (
              <section className="rounded-[1.6rem] border border-[#d5cfbd] bg-[#fbfaf4] p-5">
                <div className="flex items-start justify-between gap-3">
                  <StatusBadge
                    status={selectedPlant.status}
                    njStatus={selectedPlant.njStatus}
                  />
                  <span
                    className={`rounded-full px-2 py-1 text-[0.6rem] font-bold ${
                      selectedDetection.confidence < 0.75
                        ? "bg-[#fdf1d6] text-[#8a6420]"
                        : "bg-[#f1eee2] text-[#7a806e]"
                    }`}
                  >
                    {Math.round(selectedDetection.confidence * 100)}% match
                  </span>
                </div>

                <h2 className="mt-3 font-display text-[1.7rem] font-semibold leading-[1.02] tracking-[-0.035em] text-[#163f2c]">
                  {selectedPlant.commonName}
                </h2>
                <p className="text-[0.74rem] italic text-[#8b9182]">
                  {selectedPlant.scientificName}
                </p>
                <p className="mt-3 text-[0.8rem] leading-6 text-[#5d6b60]">
                  {selectedPlant.description}
                </p>

                {(selectedDetection.needsReview ||
                  selectedDetection.confidence < 0.75) && (
                  <div className="mt-3 rounded-xl border border-[#e7d09b] bg-[#fdf6e6] px-3 py-3 text-[0.7rem] leading-5 text-[#7b6228]">
                    <p className="flex items-center gap-1.5 font-bold">
                      <CircleAlert className="h-4 w-4 shrink-0" />
                      Low confidence — check the leaf or flower shape
                    </p>
                    {selectedDetection.topMatches?.filter(
                      (match) =>
                        match.plantId && match.plantId !== selectedDetection.plantId,
                    ).length ? (
                      <>
                        <p className="mt-1">Is it one of these New Jersey matches?</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedDetection.topMatches
                            .filter(
                              (match) =>
                                match.plantId &&
                                match.plantId !== selectedDetection.plantId,
                            )
                            .map((match) => (
                              <button
                                key={match.plantId}
                                type="button"
                                onClick={() =>
                                  confirmMatch(selectedDetection.id, match.plantId!)
                                }
                                className="rounded-full border border-[#d8c28c] bg-white/70 px-2.5 py-1 text-[0.64rem] font-bold text-[#6f5720] transition hover:border-[#b99a55] hover:bg-white"
                              >
                                {match.commonName ?? match.scientificName} ·{" "}
                                {Math.round(match.confidence * 100)}%
                              </button>
                            ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-1">
                        Compare the leaf, flower, and growth habit before acting
                        on this match.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { icon: Sun, label: "Light", value: selectedPlant.sun },
                    { icon: Droplets, label: "Water", value: selectedPlant.moisture },
                    { icon: CalendarDays, label: "Bloom", value: selectedPlant.bloom },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-[#e4dfd0] bg-[#f7f4e9] px-2.5 py-2"
                    >
                      <p className="flex items-center gap-1 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-[#9a9f91]">
                        <item.icon className="h-3 w-3" />
                        {item.label}
                      </p>
                      <p className="mt-1 text-[0.64rem] font-semibold leading-4 text-[#425445]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedPlant.lepidoptera ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#edf3e3] px-3 py-2.5 text-[0.7rem] font-semibold text-[#3f7d45]">
                    <Bug className="h-4 w-4 shrink-0" />
                    Hosts {selectedPlant.lepidoptera}+ caterpillar species in NJ
                  </div>
                ) : selectedPlant.status !== "native" &&
                  selectedPlant.status !== "keystone" ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#faf1dc] px-3 py-2.5 text-[0.7rem] font-semibold text-[#8a6420]">
                    <Bug className="h-4 w-4 shrink-0" />
                    Hosts few or no New Jersey caterpillars
                  </div>
                ) : null}

                {selectedPlant.status === "invasive" && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fae8e1] px-3 py-2.5 text-[0.7rem] leading-5 text-[#9c4634]">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <strong>
                        {selectedPlant.njStatus === "INVASIVE_WATCHLIST"
                          ? "Watchlist priority."
                          : "High removal priority."}
                      </strong>{" "}
                      {selectedDetection.note ?? "Spreads into nearby habitat."}
                    </span>
                  </div>
                )}

                {selectedPlant.status === "keystone" && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#e7f2d8] px-3 py-2.5 text-[0.7rem] leading-5 text-[#3f7d45]">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <strong>Keep this one.</strong> Add native companions around
                      it to extend the bloom and cover sequence.
                    </span>
                  </div>
                )}

                {swapNames.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[#d9d4c4] bg-[#f7f4e9] px-3 py-2.5">
                    <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[#8b9182]">
                      Native swap matches
                    </p>
                    <p className="mt-1 text-[0.72rem] font-semibold leading-5 text-[#425445]">
                      {swapNames.join(" · ")}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeDetection(selectedDetection.id)}
                  disabled={audit.detections.length <= 1}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#d8d3bf] bg-[#fbfaf4] px-3 py-2 text-[0.68rem] font-bold text-[#7a806e] transition hover:border-[#c2b9a2] hover:text-[#5d4a3a] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {audit.detections.length <= 1
                    ? "Keep at least one plant in the audit"
                    : "Not a plant? Remove from audit"}
                </button>

                <button
                  type="button"
                  onClick={onReport}
                  className="mt-4 inline-flex w-full items-center justify-between rounded-xl bg-[#163f2c] px-3.5 py-3 text-[0.74rem] font-bold text-[#f7f4e9] transition hover:bg-[#22553b]"
                >
                  See the full plan
                  <ArrowRight className="h-4 w-4 text-[#d7f27a]" />
                </button>
              </section>
            )}

            <section className="rounded-[1.6rem] border border-[#d5cfbd] bg-[#fbfaf4]">
              <div className="flex items-center justify-between border-b border-[#e5e0d1] px-4 py-3">
                <p className="text-[0.74rem] font-bold text-[#263b2b]">
                  Plants in this frame
                </p>
                <span className="text-[0.62rem] font-semibold text-[#8b9182]">
                  {audit.detections.length} found
                </span>
              </div>
              <div className="max-h-[22rem] overflow-y-auto p-2">
                {sortedDetections.map((detection, index) => {
                  const plant = getPlant(detection.plantId);
                  if (!plant) return null;
                  const selected = detection.id === selectedDetection?.id;
                  return (
                    <button
                      key={detection.id}
                      type="button"
                      onClick={() => setSelectedId(detection.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                        selected ? "bg-[#edf3e3]" : "hover:bg-[#f4f1e6]"
                      }`}
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold text-white"
                        style={{ background: getStatusMeta(plant).color }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.74rem] font-bold text-[#263b2b]">
                          {plant.commonName}
                          {(detection.needsReview || detection.confidence < 0.75) && (
                            <span
                              className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#fdf1d6] align-middle text-[0.55rem] font-bold text-[#8a6420]"
                              title="Low confidence — review this match"
                            >
                              ?
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[0.62rem] italic text-[#9a9f91]">
                          {plant.scientificName}
                        </span>
                      </span>
                      <StatusBadge
                        status={plant.status}
                        njStatus={plant.njStatus}
                        short
                        className="shrink-0"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-[1.8rem] bg-[#163f2c] p-5 text-[#f7f4e9] sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow text-[#a9c67a]">The next move</p>
              <h2 className="mt-2 max-w-[35rem] font-display text-[clamp(1.9rem,3.5vw,2.9rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
                Turn {highPrioritySwaps.length || invasiveCount} problem plants
                into habitat anchors.
              </h2>
              <p className="mt-3 max-w-[38rem] text-[0.84rem] leading-6 text-[#c7d3bd]">
                The report sequences removal, names the native replacements, and
                gives you a planting window. Start with the highest-spread
                species and work outward.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] font-semibold text-[#d6ddcc]">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#d7f27a]" />
                  Removal protocols
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#d7f27a]" />
                  1-to-1 native swaps
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#d7f27a]" />
                  Nursery + calendar
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onReport}
              className="btn btn-lime justify-center px-5 py-3.5"
            >
              Build my transformation plan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[0.64rem] text-[#8b9182]">
          <span className="inline-flex items-center gap-1.5">
            <TreePine className="h-3.5 w-3.5 text-[#3f7d45]" />
            Native status is calibrated to{" "}
            {audit.location.province ?? audit.location.ecoregion} (Zone{" "}
            {audit.location.zone}) using NJ flora snapshot{" "}
            {audit.dataVersion ?? "1.0.0"}.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5" />
            Not a substitute for a site visit or professional identification.
          </span>
        </div>
      </main>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Today";
  }
}

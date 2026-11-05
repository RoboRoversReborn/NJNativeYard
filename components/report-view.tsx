/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  Waves,
} from "lucide-react";
import { Brand } from "./brand";
import { ScoreRing } from "./score-ring";
import { StatusBadge } from "./status-badge";
import { getNurseries, getPlant, getPlants } from "@/lib/plants";
import type { Audit } from "@/lib/types";

type ReportViewProps = {
  audit: Audit;
  photo: string;
  onBack: () => void;
  onReset: () => void;
  onHome: () => void;
};

const CALENDAR = [
  {
    season: "Fall",
    months: "Sep 15 – Oct 31",
    title: "The best planting window",
    copy: "Install trees, shrubs, and perennials while soil is warm and rain is reliable. Water deeply at planting.",
    icon: Leaf,
  },
  {
    season: "Spring",
    months: "Mar 15 – May 15",
    title: "Fill the gaps",
    copy: "Add plugs and container plants after the last frost. Focus on groundcover and early-blooming perennials.",
    icon: Sprout,
  },
  {
    season: "Summer",
    months: "Jun – Aug",
    title: "Water & watch",
    copy: "One inch of water per week for the first year. Remove invasive resprouts before they set seed.",
    icon: Sun,
  },
  {
    season: "Winter",
    months: "Nov – Feb",
    title: "Leave the leaves",
    copy: "Keep stems and fallen leaves for overwintering insects. Plan next year's swaps and order bareroot plants.",
    icon: Waves,
  },
];

export function ReportView({
  audit,
  photo,
  onBack,
  onReset,
  onHome,
}: ReportViewProps) {
  const invasiveDetections = audit.detections.filter(
    (detection) => getPlant(detection.plantId)?.status === "invasive",
  );
  const swapCards = audit.swaps.slice(0, 6);
  const nurseries = getNurseries(audit.location.county).slice(0, 4);
  const date = formatDate(audit.createdAt);

  return (
    <div className="min-h-screen bg-[#e9e5d7] text-[#1d2a21]">
      <header className="report-toolbar no-print">
        <div className="container-shell flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onHome} aria-label="Back to home">
              <Brand />
            </button>
            <span className="hidden h-5 w-px bg-[#d0cbb9] sm:block" />
            <button
              type="button"
              onClick={onBack}
              className="hidden items-center gap-1.5 text-[0.72rem] font-bold text-[#5d6b60] transition hover:text-[#163f2c] sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to audit
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="hidden rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-3.5 py-2 text-[0.72rem] font-bold text-[#5d6b60] transition hover:border-[#b9b4a2] hover:text-[#163f2c] sm:inline-flex"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-dark px-4 py-2 text-[0.72rem]"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          </div>
        </div>
        <div className="container-shell pb-3 text-right text-[0.62rem] text-[#8b9182] sm:hidden">
          Choose &ldquo;Save as PDF&rdquo; in the print dialog.
        </div>
      </header>

      <main className="report-wrap container-shell py-7 sm:py-10">
        <article className="report-paper">
          <div className="report-paper__accent" />

          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#e5e0d1] pb-6">
            <div>
              <p className="eyebrow text-[#6b7a68]">
                NativeYard NJ ecological audit
              </p>
              <h1 className="mt-2 max-w-[34rem] font-display text-[clamp(2.1rem,4vw,3.4rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[#163f2c]">
                A plan to turn your New Jersey yard into habitat.
              </h1>
            </div>
            <div className="text-left text-[0.68rem] leading-5 text-[#8b9182] sm:text-right">
              <p className="font-bold uppercase tracking-[0.1em] text-[#5d6b60]">
                Prepared {date}
              </p>
              <p className="mt-1">
                {audit.location.city}
                {audit.location.county &&
                audit.location.county !== "New Jersey"
                  ? `, ${audit.location.county} County`
                  : ""}
                {audit.location.state ? `, ${audit.location.state}` : ""} ·{" "}
                {audit.location.zip}
              </p>
              <p>
                Zone {audit.location.zone}
                {audit.location.province
                  ? ` · ${audit.location.province}`
                  : ` · ${audit.location.ecoregion}`}
              </p>
              <p>{audit.location.ecoregionCode}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-[#e0dac9] bg-[#f7f4e9] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow text-[0.59rem] text-[#7a806e]">
                  Yard biodiversity score
                </p>
                <span className="rounded-full bg-[#e7efdc] px-2.5 py-1 text-[0.56rem] font-bold uppercase tracking-[0.09em] text-[#3f7d45]">
                  {audit.scoreLabel}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <ScoreRing score={audit.score} size={112} tone="light" />
                <div className="min-w-[9rem] flex-1">
                  <p className="font-display text-[1.65rem] font-semibold leading-none text-[#163f2c]">
                    {audit.scoreLabel}
                  </p>
                  <p className="mt-2 text-[0.72rem] leading-5 text-[#5d6b60]">
                    {audit.summary}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#e2ddce] pt-3 sm:grid-cols-4">
                {audit.metrics.map((metric) => (
                  <div key={metric.label}>
                    <p className="text-[0.52rem] font-bold uppercase tracking-[0.08em] text-[#9a9f91]">
                      {metric.label}
                    </p>
                    <p
                      className={`mt-0.5 font-display text-[1.1rem] font-semibold leading-none ${
                        metric.tone === "bad"
                          ? "text-[#b6533d]"
                          : metric.tone === "warn"
                            ? "text-[#a87a2c]"
                            : "text-[#3f7d45]"
                      }`}
                    >
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[13rem] overflow-hidden rounded-2xl border border-[#d9d2bc]">
              <img
                src={photo}
                alt="Audited yard"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10291d]/65 to-transparent" />
              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                <p className="text-[0.65rem] font-semibold leading-5 text-[#f7f4e9]">
                  {audit.detections.length} plants identified across{" "}
                  {audit.location.ecoregion}.
                </p>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d7f27a] text-[#163f2c]">
                  <TreePine className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>

          <section className="report-section">
            <SectionHeading
              number="01"
              kicker="Immediate action"
              title="Invasive removal protocols"
            />
            <p className="mt-3 max-w-[44rem] text-[0.8rem] leading-6 text-[#5d6b60]">
              Work highest-spread species first. Remove fruit before it ripens,
              bag viable material, and expect a second pass for resprouts. Check
              local rules before using any herbicide, and never apply near water.
            </p>

            {invasiveDetections.length ? (
              <div className="mt-5 space-y-3">
                {invasiveDetections.map((detection, index) => {
                  const plant = getPlant(detection.plantId);
                  if (!plant) return null;
                  return (
                    <article
                      key={detection.id}
                      className="print-break rounded-2xl border border-[#e4c9bd] bg-[#fdf7f3] p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#b6533d] text-[0.68rem] font-bold text-white">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <h3 className="font-display text-[1.3rem] font-semibold leading-none tracking-[-0.025em] text-[#163f2c]">
                              {plant.commonName}
                            </h3>
                            <p className="mt-1 text-[0.7rem] italic text-[#9a9f91]">
                              {plant.scientificName}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status="invasive" njStatus={plant.njStatus} />
                      </div>

                      <p className="mt-3 rounded-xl bg-[#fae8e1] px-3 py-2.5 text-[0.72rem] leading-5 text-[#8f3f2e]">
                        <strong className="font-bold">Risk:</strong>{" "}
                        {plant.description}
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <ProtocolItem label="Method" value={plant.removal?.method} />
                        <ProtocolItem label="Timing" value={plant.removal?.timing} />
                        <ProtocolItem label="Safety" value={plant.removal?.safety} />
                        <ProtocolItem label="Disposal" value={plant.removal?.disposal} />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[#c9d9b7] bg-[#edf3e3] p-4 text-[0.8rem] leading-6 text-[#3f7d45]">
                <strong className="font-bold">No invasive plants detected.</strong>{" "}
                That is a strong starting point. Keep monitoring edges and
                disturbed soil, where invasives usually establish first.
              </div>
            )}
          </section>

          <section className="report-section">
            <SectionHeading
              number="02"
              kicker="The rebuild"
              title="Keystone replacement blueprint"
            />
            <p className="mt-3 max-w-[44rem] text-[0.8rem] leading-6 text-[#5d6b60]">
              Each swap matches the removed plant&apos;s light, moisture, and
              visual role—then adds more food-web value. Plant in groups of three
              or five for a stronger ecological signal.
            </p>

            <div className="mt-5 grid gap-3">
              {swapCards.map((swap, index) => {
                const from = getPlant(swap.fromPlantId);
                const targets = getPlants(swap.toPlantIds);
                if (!from || !targets.length) return null;

                return (
                  <article
                    key={swap.id}
                    className="print-break rounded-2xl border border-[#d9d4c4] bg-[#fbfaf4] p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#8b9182]">
                        Swap {String(index + 1).padStart(2, "0")} ·{" "}
                        {swap.areaSqFt} sq ft
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.56rem] font-bold uppercase tracking-[0.09em] ${
                          swap.priority === "high"
                            ? "bg-[#fae8e1] text-[#b6533d]"
                            : "bg-[#faf1dc] text-[#a87a2c]"
                        }`}
                      >
                        {swap.priority === "high" ? "High priority" : "Optional upgrade"}
                      </span>
                    </div>

                    <div className="mt-3 grid items-center gap-3 sm:grid-cols-[1fr_auto_1.25fr]">
                      <div className="rounded-xl border border-[#e4dfd0] bg-[#f7f4e9] px-3 py-2.5">
                        <p className="text-[0.54rem] font-bold uppercase tracking-[0.1em] text-[#b6533d]">
                          Remove
                        </p>
                        <p className="mt-1 text-[0.82rem] font-bold text-[#263b2b]">
                          {from.commonName}
                        </p>
                        <p className="text-[0.62rem] italic text-[#9a9f91]">
                          {from.scientificName}
                        </p>
                      </div>
                      <span className="hidden h-8 w-8 place-items-center rounded-full bg-[#e7efdc] text-[#3f7d45] sm:grid">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                      <div className="rounded-xl border border-[#c9d9b7] bg-[#edf3e3] px-3 py-2.5">
                        <p className="text-[0.54rem] font-bold uppercase tracking-[0.1em] text-[#3f7d45]">
                          Plant instead
                        </p>
                        <p className="mt-1 text-[0.82rem] font-bold leading-5 text-[#263b2b]">
                          {targets.map((target) => target.commonName).join(" + ")}
                        </p>
                        <p className="text-[0.62rem] italic text-[#6d8064]">
                          {targets.map((target) => target.scientificName).join(" · ")}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[0.74rem] leading-5 text-[#5d6b60]">
                      <strong className="font-bold text-[#3f7d45]">Eco gain:</strong>{" "}
                      {swap.ecoGain}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {targets.map((target) => (
                        <span
                          key={target.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#e0dac9] bg-white px-2.5 py-1 text-[0.6rem] font-semibold text-[#5d6b60]"
                        >
                          <Leaf className="h-3 w-3 text-[#3f7d45]" />
                          {target.sun} · {target.moisture}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e0d1] pt-2.5 text-[0.62rem] text-[#8b9182]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-[#a87a2c]" />
                        {swap.season}
                      </span>
                      <span className="font-semibold text-[#5d6b60]">
                        Effort: {swap.effort}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="report-section">
            <SectionHeading
              number="03"
              kicker="Make it real"
              title="Local nursery & planting calendar"
            />
            <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#d9d4c4] bg-[#fbfaf4] p-4">
                <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#5d6b60]">
                  <Sprout className="h-4 w-4 text-[#3f7d45]" />
                  Verified New Jersey native nurseries
                </p>
                <div className="mt-3 divide-y divide-[#e5e0d1]">
                  {nurseries.map((nursery) => (
                    <a
                      key={nursery.id}
                      href={nursery.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-[0.76rem] font-bold text-[#263b2b] group-hover:text-[#3f7d45]">
                          {nursery.name}
                        </p>
                        <p className="text-[0.62rem] text-[#8b9182]">
                          {nursery.location}
                          {!["statewide", "regional"].includes(
                            nursery.county.toLowerCase(),
                          )
                            ? ` · ${nursery.county} County`
                            : ""}
                        </p>
                        <p className="mt-1 text-[0.65rem] leading-5 text-[#5d6b60]">
                          {nursery.note}
                        </p>
                      </div>
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a8ad9e] transition group-hover:text-[#3f7d45]" />
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-[0.58rem] leading-4 text-[#9a9f91]">
                  Local leads nearest {audit.location.county ?? "New Jersey"}{" "}
                  first. Call ahead for inventory and hours, and ask for plants
                  grown from regional seed or local ecotypes. Nursery list last
                  verified {nurseries[0]?.lastVerified ?? "2026-11-01"}.
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9d4c4] bg-[#fbfaf4] p-4">
                <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#5d6b60]">
                  <CalendarDays className="h-4 w-4 text-[#a87a2c]" />
                  Your planting year
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {CALENDAR.map((item) => (
                    <div
                      key={item.season}
                      className="rounded-xl border border-[#e4dfd0] bg-[#f7f4e9] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#5d6b60]">
                          <item.icon className="h-3.5 w-3.5 text-[#3f7d45]" />
                          {item.season}
                        </p>
                        <span className="text-[0.55rem] font-semibold text-[#9a9f91]">
                          {item.months}
                        </span>
                      </div>
                      <p className="mt-1 text-[0.7rem] font-bold text-[#263b2b]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[0.62rem] leading-5 text-[#5d6b60]">
                        {item.copy}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="report-section print-break">
            <div className="rounded-2xl bg-[#163f2c] p-5 text-[#f7f4e9] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-[#a9c67a]">First 30 days</p>
                  <h2 className="mt-2 font-display text-[1.7rem] font-semibold leading-none tracking-[-0.035em]">
                    A small, doable start.
                  </h2>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d7f27a] text-[#163f2c]">
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  "Bag and remove invasive seed heads before they ripen.",
                  "Cut ivy at the base of each tree; let the upper vines dry.",
                  "Order native plugs or bareroot shrubs for fall planting.",
                  "Sheet-mulch the cleared bed and water deeply once a week.",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                  >
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#d7f27a] text-[#163f2c]">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <p className="text-[0.68rem] leading-5 text-[#d6ddcc]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <footer className="mt-6 border-t border-[#e5e0d1] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[0.62rem] font-semibold text-[#7a806e]">
                <ShieldCheck className="h-4 w-4 text-[#3f7d45]" />
                NJ native status calibrated to{" "}
                {audit.location.province ?? audit.location.ecoregion}, Zone{" "}
                {audit.location.zone}.
              </div>
              <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#7a806e]">
                <MapPin className="h-3.5 w-3.5 text-[#a87a2c]" />
                {audit.location.zip}
              </span>
            </div>
            <p className="mt-3 text-[0.56rem] leading-4 text-[#9a9f91]">
              This report is ecological guidance, not a substitute for a site
              visit, professional plant identification, or local regulation.
              Invasive status and removal rules are specific to New Jersey.
              Confirm removal and herbicide rules with your county extension
              office. Never apply herbicides near waterways or without following
              the label. Keep leaves, stems, and bare soil covered to protect
              overwintering insects. Sources: Native Plant Society of New Jersey
              county lists; Jersey-Friendly Yards / Barnegat Bay Partnership;
              NJDEP and NJDA invasive species lists; National Wildlife
              Federation keystone plant research; Doug Tallamy, Nature&apos;s
              Best Hope; EPA Level III/IV ecoregions. Local flora snapshot{" "}
              {audit.dataVersion ?? "1.0.0"}.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Brand />
              <span className="text-[0.56rem] uppercase tracking-[0.12em] text-[#a8ad9e]">
                NativeYard NJ · New Jersey ecological transformation report
              </span>
            </div>
          </footer>
        </article>

        <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-3 text-[0.66rem] text-[#7a806e]">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-bold transition hover:text-[#163f2c]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the interactive audit
          </button>
          <span className="inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Download PDF opens your browser&apos;s print dialog.
          </span>
        </div>
      </main>
    </div>
  );
}

function SectionHeading({
  number,
  kicker,
  title,
}: {
  number: string;
  kicker: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#163f2c] text-[0.62rem] font-bold text-[#d7f27a]">
        {number}
      </span>
      <div>
        <p className="eyebrow text-[0.57rem] text-[#8b9182]">{kicker}</p>
        <h2 className="mt-0.5 font-display text-[1.65rem] font-semibold leading-none tracking-[-0.035em] text-[#163f2c] sm:text-[1.9rem]">
          {title}
        </h2>
      </div>
    </div>
  );
}

function ProtocolItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-[#ead9d0] bg-white/60 px-3 py-2.5">
      <p className="text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[#b06a57]">
        {label}
      </p>
      <p className="mt-1 text-[0.66rem] leading-5 text-[#5d6b60]">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Today";
  }
}

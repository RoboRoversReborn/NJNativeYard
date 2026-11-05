/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bird,
  Bug,
  Camera,
  Check,
  ChevronRight,
  FileText,
  Flower2,
  Leaf,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TreePine,
  UploadCloud,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { StatusBadge } from "./status-badge";
import {
  buildSamplePreview,
  isNjZip,
  NJ_DATA_VERSION,
  regionForZip,
} from "@/lib/plants";

type LandingPageProps = {
  photo: string | null;
  zip: string;
  error: string;
  isSample: boolean;
  onPhoto: (file: File) => void;
  onSample: () => void;
  onClearPhoto: () => void;
  onZip: (value: string) => void;
  onStart: () => void;
};

export function LandingPage({
  photo,
  zip,
  error,
  isSample,
  onPhoto,
  onSample,
  onClearPhoto,
  onZip,
  onStart,
}: LandingPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const region = regionForZip(zip);
  const zipInvalid = zip.length === 5 && !isNjZip(zip);
  const sample = useMemo(() => buildSamplePreview(zip), [zip]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f7f4e9] text-[#1d2a21]">
      <header className="site-header no-print">
        <div className="container-shell flex h-[4.5rem] items-center justify-between gap-6">
          <Brand />
          <nav className="hidden items-center gap-7 text-[0.84rem] font-semibold text-[#425445] lg:flex">
            <a className="nav-link" href="#how-it-works">
              How it works
            </a>
            <a className="nav-link" href="#verdicts">
              Plant verdicts
            </a>
            <a className="nav-link" href="#keystone">
              Why native
            </a>
            <a className="nav-link" href="#audit">
              The report
            </a>
          </nav>
          <a
            href="#audit"
            className="btn btn-dark hidden text-[0.78rem] sm:inline-flex"
          >
            Start a free audit
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="#audit"
            className="btn btn-dark text-[0.76rem] sm:hidden"
          >
            Start audit
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-glow hero-glow--one" />
          <div className="hero-glow hero-glow--two" />
          <div className="container-shell relative z-10 grid items-start gap-12 py-10 sm:py-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:py-20">
            <div className="max-w-[39rem]">
              <div className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8d3bf] bg-[#fbfaf4]/80 px-3 py-1.5 text-[#425445] backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6c9a62] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3f7d45]" />
                </span>
                A New Jersey yard audit for the living world
              </div>

              <h1 className="font-display text-[clamp(3.15rem,6.7vw,5.65rem)] font-semibold leading-[0.91] tracking-[-0.055em] text-[#163f2c]">
                See your yard
                <br />
                through{" "}
                <span className="italic text-[#4f7c4a]">nature&apos;s</span>
                <br />
                eyes.
              </h1>

              <p className="mt-6 max-w-[34rem] text-[1.03rem] leading-7 text-[#536257] sm:text-[1.12rem] sm:leading-8">
                One photo. A New Jersey plant-by-plant audit that separates the
                keystone natives from the regulated invasives—then hands you a
                practical plan for a yard that feeds pollinators, birds, and
                caterpillars.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-[0.78rem] font-semibold text-[#56665a]">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#3f7d45]" />
                  No account needed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#3f7d45]" />
                  NJ ecoregion-calibrated
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#3f7d45]" />
                  Actionable PDF
                </span>
              </div>

              <div className="upload-card mt-8" id="audit">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow text-[#6b7a68]">Start your free audit</p>
                    <h2 className="mt-1 font-display text-[1.6rem] font-semibold tracking-[-0.03em] text-[#163f2c]">
                      What&apos;s growing out there?
                    </h2>
                  </div>
                  <span className="rounded-full border border-[#d8d3bf] bg-[#f4f1e6] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#7a806e]">
                    New Jersey beta
                  </span>
                </div>

                <div
                  className={`dropzone mt-4 ${dragging ? "is-dragging" : ""} ${
                    photo ? "has-photo" : ""
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) onPhoto(file);
                  }}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload a yard photo"
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onPhoto(file);
                      event.target.value = "";
                    }}
                  />

                  {photo ? (
                    <>
                      <img
                        src={photo}
                        alt="Selected yard preview"
                        className="dropzone__preview"
                      />
                      <div className="dropzone__overlay">
                        <div className="flex items-center gap-2 rounded-full bg-[#f7f4e9]/95 px-3 py-1.5 text-[0.72rem] font-bold text-[#163f2c] shadow-sm">
                          <Check className="h-3.5 w-3.5 text-[#3f7d45]" />
                          {isSample ? "Sample yard loaded" : "Photo ready to audit"}
                        </div>
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-full bg-[#163f2c]/80 text-[#f7f4e9] backdrop-blur transition hover:bg-[#163f2c]"
                          onClick={(event) => {
                            event.stopPropagation();
                            onClearPhoto();
                          }}
                          aria-label="Remove photo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center px-5 py-7 text-center">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e7efdc] text-[#3f7d45]">
                        <UploadCloud className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-[0.88rem] font-bold text-[#263b2b]">
                        Drop a yard photo here
                      </p>
                      <p className="mt-1 text-[0.76rem] leading-5 text-[#7a806e]">
                        Or tap to choose a camera photo. Wide shots work best.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[0.72rem]">
                  <button
                    type="button"
                    onClick={onSample}
                    className="inline-flex items-center gap-1.5 font-bold text-[#3f7d45] underline decoration-[#b9d19a] decoration-2 underline-offset-4 transition hover:text-[#163f2c]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Try a sample yard
                  </button>
                  <span className="text-[#8b9182]">
                    JPEG, PNG, WEBP or HEIC · up to 12 MB
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  <label className="zip-field flex-1">
                    <MapPin className="h-4 w-4 shrink-0 text-[#6b7a68]" />
                    <span className="sr-only">ZIP code</span>
                    <input
                      name="yard-location-code"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={zip}
                      onChange={(event) =>
                        onZip(event.target.value.replace(/\D/g, "").slice(0, 5))
                      }
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="NJ ZIP"
                      aria-label="Yard ZIP code"
                    />
                    <span className="whitespace-nowrap text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[#8b9182]">
                      {region.county && region.county !== "New Jersey"
                        ? `${region.county} County`
                        : `Zone ${region.zone}`}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={onStart}
                    className="btn btn-lime justify-center px-5 py-3 text-[0.82rem] sm:min-w-[10.5rem]"
                  >
                    Audit my yard
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>

                {zipInvalid ? (
                  <p className="mt-2 rounded-xl bg-[#fae8e1] px-3 py-2 text-[0.76rem] font-semibold text-[#a34832]">
                    NativeYard NJ is calibrated for New Jersey ZIP codes
                    (07000–08999). Try 07645 for the sample region.
                  </p>
                ) : region.notice ? (
                  <p className="mt-2 rounded-xl bg-[#faf1dc] px-3 py-2 text-[0.72rem] font-semibold leading-5 text-[#7b6228]">
                    {region.notice}
                  </p>
                ) : null}

                {error ? (
                  <p className="mt-2 rounded-xl bg-[#fae8e1] px-3 py-2 text-[0.76rem] font-semibold text-[#a34832]">
                    {error}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-[0.68rem] text-[#8b9182]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Photos stay in your session. No account or email required.
                  </p>
                )}
              </div>
            </div>

            <div className="hero-visual relative mx-auto w-full max-w-[39rem] lg:mt-10">
              <div className="hero-photo relative overflow-hidden rounded-[2rem] border border-[#d9d2bc] bg-[#dfe7d3] shadow-[0_28px_80px_rgba(45,61,42,0.2)]">
                <Image
                  src="/images/yard-demo.jpg"
                  alt="A lush backyard garden with a patio, trees, and flowering shrubs"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10291d]/65 via-transparent to-[#10291d]/10" />

                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/20 bg-[#10291d]/70 px-3 py-1.5 text-[0.63rem] font-bold uppercase tracking-[0.13em] text-[#f7f4e9] backdrop-blur">
                  <ScanLine className="h-3.5 w-3.5 text-[#d7f27a]" />
                  Sample yard scan
                </div>

                <div className="absolute right-4 top-[18%] detection-chip detection-chip--invasive">
                  <span className="detection-chip__dot" />
                  Norway maple
                  <span className="detection-chip__status">Invasive</span>
                </div>
                <div className="absolute left-[8%] top-[34%] detection-chip detection-chip--native sm:left-[32%] sm:top-[50%]">
                  <span className="detection-chip__dot" />
                  Catawba rhododendron
                  <span className="detection-chip__status">Native</span>
                </div>
                <div className="absolute right-[8%] top-[44%] hidden detection-chip detection-chip--keystone sm:right-[6%] sm:top-[56%] sm:flex">
                  <span className="detection-chip__dot" />
                  Goldenrod
                  <span className="detection-chip__status">Keystone</span>
                </div>

                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-[#f7f4e9]/95 p-4 shadow-xl backdrop-blur sm:inset-x-5 sm:bottom-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="eyebrow text-[0.59rem] text-[#7a806e]">
                        Yard biodiversity score
                      </p>
                      <p className="mt-1 font-display text-[1.65rem] font-semibold leading-none text-[#163f2c]">
                        {sample.score}
                        <span className="text-[0.9rem] font-normal text-[#8b9182]">/100</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-[#faf1dc] px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#a87a2c]">
                      {sample.scoreLabel}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2dfd0]">
                    <div
                      className="h-full rounded-full bg-[#3f7d45]"
                      style={{ width: `${sample.score}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[0.66rem] font-semibold text-[#6b7a68]">
                    <span>{sample.detections.length} plants found</span>
                    <span>{sample.swaps.length} native swaps</span>
                    <span className="inline-flex items-center gap-1 text-[#3f7d45]">
                      View report <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -left-3 top-[30%] hidden rotate-[-4deg] rounded-2xl border border-[#d8d3bf] bg-[#fbfaf4] px-3.5 py-3 shadow-lg sm:block">
                <p className="flex items-center gap-1.5 text-[0.61rem] font-bold uppercase tracking-[0.1em] text-[#7a806e]">
                  <Bug className="h-3.5 w-3.5 text-[#3f7d45]" />
                  Caterpillar hosts
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-[#163f2c]">
                  {sample.hostGenera} genera
                </p>
              </div>

              <div className="absolute -right-3 top-[30%] hidden rotate-[3deg] rounded-2xl border border-[#d8d3bf] bg-[#fbfaf4] px-3.5 py-3 shadow-lg sm:block">
                <p className="flex items-center gap-1.5 text-[0.61rem] font-bold uppercase tracking-[0.1em] text-[#7a806e]">
                  <Bird className="h-3.5 w-3.5 text-[#a87a2c]" />
                  Invasive load
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-[#b6533d]">
                  {sample.invasiveShare}%
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#ddd8c7] bg-[#f0ecdf]">
          <div className="container-shell grid grid-cols-2 gap-x-6 gap-y-7 py-8 sm:grid-cols-4 sm:py-10">
            {[
              ["40M", "acres of lawn across the U.S."],
              ["96%", "of land birds feed insects to young"],
              ["500+", "caterpillar species on one white oak"],
              ["1 photo", "to start your yard's transition"],
            ].map(([stat, label]) => (
              <div key={label}>
                <p className="font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-[#163f2c] sm:text-[2.2rem]">
                  {stat}
                </p>
                <p className="mt-1 max-w-[12rem] text-[0.72rem] leading-5 text-[#6b7a68]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="section-pad">
          <div className="container-shell">
            <div className="max-w-[42rem]">
              <p className="eyebrow text-[#6b7a68]">How it works</p>
              <h2 className="mt-3 font-display text-[clamp(2.4rem,4.4vw,3.7rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-[#163f2c]">
                A yard audit in three acts.
              </h2>
              <p className="mt-4 max-w-[35rem] text-[0.98rem] leading-7 text-[#5d6b60]">
                No plant taxonomy degree required. NativeYard reads the photo,
                matches species to your New Jersey physiographic province, and
                turns the results into a plan you can actually do this weekend.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: Camera,
                  title: "Snap your yard",
                  copy: "Take one wide photo from a corner or upload a panorama. Include trees, hedges, beds, and the ground layer.",
                  color: "#3f7d45",
                },
                {
                  step: "02",
                  icon: ScanLine,
                  title: "Read the ecology",
                  copy: "We tag each plant as a NJ keystone native, native, low-risk non-native, regulated invasive, or watchlist invasive—calibrated to your ZIP and physiographic province.",
                  color: "#a87a2c",
                },
                {
                  step: "03",
                  icon: FileText,
                  title: "Get the plan",
                  copy: "Download a prioritized removal protocol and a 1-to-1 native swap blueprint, with planting windows and local nursery leads.",
                  color: "#b6533d",
                },
              ].map((item) => (
                <article
                  key={item.step}
                  className="group rounded-[1.6rem] border border-[#d9d4c4] bg-[#fbfaf4] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(45,61,42,0.09)]"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-full"
                      style={{ background: `${item.color}16`, color: item.color }}
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-[1.55rem] font-semibold text-[#d6d2c2]">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[#163f2c]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[0.84rem] leading-6 text-[#667368]">
                    {item.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="verdicts" className="section-pad border-y border-[#ddd8c7] bg-[#f0ecdf]">
          <div className="container-shell">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="eyebrow text-[#6b7a68]">Every plant gets a verdict</p>
                <h2 className="mt-3 font-display text-[clamp(2.35rem,4vw,3.4rem)] font-semibold leading-[1] tracking-[-0.045em] text-[#163f2c]">
                  Not all green is good.
                </h2>
              </div>
              <p className="max-w-[35rem] text-[0.94rem] leading-7 text-[#5d6b60] lg:justify-self-end">
                A plant can be beautiful, well-behaved, and still ecologically
                empty. NativeYard separates visual appeal from habitat value so
                you can make trade-offs with your eyes open.
              </p>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  status: "keystone" as const,
                  title: "NJ keystone native",
                  copy: "Supports 90%+ of local caterpillar species. These are the plants that hold the New Jersey food web together.",
                  action: "Preserve & celebrate",
                  icon: TreePine,
                },
                {
                  status: "native" as const,
                  title: "New Jersey native",
                  copy: "Occurred here before European settlement. Good habitat value and adapted to local rainfall and soils.",
                  action: "Preserve",
                  icon: Leaf,
                },
                {
                  status: "non-native" as const,
                  title: "Non-native, low risk",
                  copy: "An introduced ornamental that is not currently listed as invasive in NJ. Fine to keep, but an optional upgrade.",
                  action: "Optional swap",
                  icon: Flower2,
                },
                {
                  status: "invasive" as const,
                  title: "NJ regulated invasive",
                  copy: "Spreads aggressively, displaces native flora, and degrades habitat. Removal is the highest-leverage action.",
                  action: "Prioritize removal",
                  icon: Bug,
                },
              ].map((item) => (
                <article
                  key={item.status}
                  className="rounded-[1.4rem] border border-[#d9d4c4] bg-[#fbfaf4] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <StatusBadge status={item.status} />
                    <item.icon className="h-5 w-5 text-[#a8ad9e]" />
                  </div>
                  <h3 className="mt-4 font-display text-[1.22rem] font-semibold tracking-[-0.025em] text-[#163f2c]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[0.8rem] leading-6 text-[#667368]">
                    {item.copy}
                  </p>
                  <p className="mt-4 border-t border-[#e4dfd0] pt-3 text-[0.66rem] font-bold uppercase tracking-[0.11em] text-[#7a806e]">
                    {item.action}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="keystone" className="section-pad">
          <div className="container-shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.8rem] border border-[#d9d2bc]">
                <Image
                  src="/images/garden-lush.jpg"
                  alt="A dense garden with layers of foliage and flowers"
                  fill
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10291d]/55 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                  <p className="max-w-[16rem] font-display text-[1.35rem] leading-tight text-[#f7f4e9]">
                    Plant the plants that feed the most mouths.
                  </p>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d7f27a] text-[#163f2c]">
                    <Leaf className="h-4 w-4" />
                  </span>
                </div>
              </div>
              <div className="absolute -right-3 -top-3 hidden rounded-2xl border border-[#d8d3bf] bg-[#fbfaf4] px-4 py-3 shadow-lg sm:block">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.11em] text-[#7a806e]">
                  Native plant power
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-[#163f2c]">
                  90% of caterpillars
                </p>
              </div>
            </div>

            <div>
              <p className="eyebrow text-[#6b7a68]">Why native, why now</p>
              <h2 className="mt-3 font-display text-[clamp(2.35rem,4.2vw,3.55rem)] font-semibold leading-[0.99] tracking-[-0.045em] text-[#163f2c]">
                A pollinator garden is a food web, not a flower bed.
              </h2>
              <p className="mt-4 text-[0.96rem] leading-7 text-[#5d6b60]">
                Most caterpillars can eat only a few native plant lineages.
                Replace those plants with exotic ornamentals and the insects
                disappear—followed by the birds that need them. Keystone natives
                do the heaviest lifting.
              </p>

              <div className="mt-6 space-y-2.5">
                {[
                  {
                    name: "White Oak",
                    latin: "Quercus alba",
                    value: "500+",
                    label: "caterpillar species",
                    icon: TreePine,
                  },
                  {
                    name: "Wrinkleleaf Goldenrod",
                    latin: "Solidago rugosa",
                    value: "115+",
                    label: "caterpillar species",
                    icon: Flower2,
                  },
                  {
                    name: "Highbush Blueberry",
                    latin: "Vaccinium corymbosum",
                    value: "211+",
                    label: "caterpillar species",
                    icon: Leaf,
                  },
                ].map((plant) => (
                  <div
                    key={plant.name}
                    className="flex items-center gap-4 rounded-2xl border border-[#d9d4c4] bg-[#fbfaf4] px-4 py-3.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7efdc] text-[#3f7d45]">
                      <plant.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.85rem] font-bold text-[#263b2b]">
                        {plant.name}
                      </p>
                      <p className="text-[0.7rem] italic text-[#8b9182]">
                        {plant.latin}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[1.15rem] font-semibold leading-none text-[#3f7d45]">
                        {plant.value}
                      </p>
                      <p className="mt-1 text-[0.6rem] uppercase tracking-[0.08em] text-[#8b9182]">
                        {plant.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="#audit"
                className="mt-6 inline-flex items-center gap-2 text-[0.82rem] font-bold text-[#3f7d45] underline decoration-[#b9d19a] decoration-2 underline-offset-4 transition hover:text-[#163f2c]"
              >
                See what your yard is missing
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 sm:px-6 lg:px-8">
          <div className="container-shell relative overflow-hidden rounded-[2rem] bg-[#163f2c] px-6 py-12 text-[#f7f4e9] sm:px-10 sm:py-16">
            <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#d7f27a]/15 blur-2xl" />
            <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#a9c67a]/10 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="eyebrow text-[#a9c67a]">Your yard is habitat</p>
                <h2 className="mt-3 max-w-[42rem] font-display text-[clamp(2.4rem,4.6vw,4.1rem)] font-semibold leading-[0.96] tracking-[-0.05em]">
                  The smallest patch can be part of the biggest recovery.
                </h2>
                <p className="mt-4 max-w-[34rem] text-[0.95rem] leading-7 text-[#d6ddcc]">
                  Start with one photo and one swap. NativeYard shows you where
                  the ecological leverage is—and what to plant in its place.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <a href="#audit" className="btn btn-lime px-5 py-3.5">
                  Run a free yard audit
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <p className="text-[0.68rem] text-[#a9b59e]">
                  No account. No email. Just your yard.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ddd8c7] bg-[#f0ecdf]">
        <div className="container-shell flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden text-[0.68rem] text-[#8b9182] sm:inline">
              A working MVP for New Jersey native-yard transitions.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.68rem] text-[#7a806e]">
            <span>Built for New Jersey · Zone 6b</span>
            <span className="hidden h-3 w-px bg-[#d0cbb9] sm:block" />
            <span>Local NJ flora snapshot v{NJ_DATA_VERSION}</span>
          </div>
        </div>
        <div className="container-shell pb-6 text-[0.62rem] leading-5 text-[#9a9f91]">
          Ecological references: Native Plant Society of New Jersey county
          lists; Jersey-Friendly Yards / Barnegat Bay Partnership; NJDEP and NJDA
          invasive species lists; National Wildlife Federation keystone plant
          research; Doug Tallamy, Nature&apos;s Best Hope; EPA Level III/IV
          ecoregions. Sample photo via Pexels. Always verify plant ID and local
          regulations with your county extension office before removing or
          planting.
        </div>
      </footer>
    </div>
  );
}

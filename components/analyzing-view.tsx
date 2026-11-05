/* eslint-disable @next/next/no-img-element */
"use client";

import { Check, Loader2, ScanLine, Sparkles } from "lucide-react";
import { Brand } from "./brand";

const STEPS = [
  "Detecting plant forms",
  "Matching regional flora",
  "Scoring habitat value",
  "Building your plan",
];

export function AnalyzingView({
  photo,
  step,
}: {
  photo: string;
  step: number;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4e9] text-[#1d2a21]">
      <header className="site-header no-print">
        <div className="container-shell flex h-[4.5rem] items-center justify-between">
          <Brand />
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#5d6b60]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3f7d45]" />
            Analyzing
          </span>
        </div>
      </header>

      <main className="container-shell grid min-h-[calc(100vh-4.5rem)] items-center gap-10 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="max-w-[31rem]">
          <div className="eyebrow mb-4 inline-flex items-center gap-2 rounded-full border border-[#d8d3bf] bg-[#fbfaf4] px-3 py-1.5 text-[#425445]">
            <ScanLine className="h-3.5 w-3.5 text-[#3f7d45]" />
            Reading the living layers
          </div>
          <h1 className="font-display text-[clamp(2.7rem,5.5vw,4.6rem)] font-semibold leading-[0.93] tracking-[-0.055em] text-[#163f2c]">
            Your yard is
            <br />
            telling us
            <br />
            <span className="italic text-[#4f7c4a]">something.</span>
          </h1>
          <p className="mt-5 max-w-[27rem] text-[0.94rem] leading-7 text-[#5d6b60]">
            We&apos;re separating foliage from flowers, matching each plant to
            your New Jersey physiographic province, and looking for the species
            that carry the local food web.
          </p>

          <div className="mt-8 space-y-2.5">
            {STEPS.map((label, index) => {
              const complete = index < step;
              const active = index === step;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                    active
                      ? "border-[#c9d9b7] bg-[#edf3e3]"
                      : complete
                        ? "border-[#e0dac9] bg-[#fbfaf4]"
                        : "border-[#e5e0d1] bg-[#f7f4e9] opacity-60"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      complete
                        ? "bg-[#3f7d45] text-white"
                        : active
                          ? "bg-[#d7f27a] text-[#163f2c]"
                          : "bg-[#e5e0d1] text-[#9a9f91]"
                    }`}
                  >
                    {complete ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : active ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span className="text-[0.6rem] font-bold">{index + 1}</span>
                    )}
                  </span>
                  <span
                    className={`text-[0.78rem] font-semibold ${
                      active || complete ? "text-[#263b2b]" : "text-[#8b9182]"
                    }`}
                  >
                    {label}
                  </span>
                  {active && (
                    <span className="ml-auto text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#3f7d45]">
                      In progress
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 flex items-center gap-2 text-[0.66rem] text-[#8b9182]">
            <Sparkles className="h-3.5 w-3.5 text-[#a87a2c]" />
            Live ID runs on your uploaded photo. The sample yard is
            illustrative and never painted over your own image.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[40rem]">
          <div className="scan-frame relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-[#d5cfbd] bg-[#dfe7d3] shadow-[0_30px_80px_rgba(45,61,42,0.18)]">
            <img
              src={photo}
              alt="Yard being analyzed"
              className="h-full w-full object-cover"
            />
            <div className="scan-frame__wash" />
            <div className="scan-frame__grid" />
            <div className="scan-line" />
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/20 bg-[#10291d]/75 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#f7f4e9] backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d7f27a]" />
              Scanning canopy, beds & ground layer
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#10291d]/70 px-3.5 py-2.5 text-[0.64rem] font-semibold text-[#f7f4e9] backdrop-blur">
              <span>Photo in session only</span>
              <span className="text-[#d7f27a]">NJ province match running</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-3 hidden rotate-[3deg] rounded-2xl border border-[#d8d3bf] bg-[#fbfaf4] px-4 py-3 shadow-lg sm:block">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#8b9182]">
              Expected time
            </p>
            <p className="mt-1 font-display text-xl font-semibold text-[#163f2c]">
              ~20 seconds
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Printer,
  X,
} from "lucide-react";
import { SurveyPrintReport } from "./survey-print-report";
import { EcosystemScore, EcosystemScoreDetails } from "./ecosystem-score";
import {
  PlantStory,
  PlantGrowingDetails,
  PlantSeasonalInterest,
  PlantRecognitionCues,
  PlantBotanicalTraits,
  PlantHabitatDetails,
  PlantHorticultureSource,
  plantProfileSummary,
} from "./plant-profile";
import { SampleCredit } from "./sample-gallery";
import { sampleYardById } from "@/lib/sample-yards";
import { RegionPhoto, ReferenceImage, ProfileImages, ReferenceCredits } from "./plant-photos";
import { compressPhoto, photoResponse } from "@/lib/photo-upload";
import {
  SCORE_VERSION,
  SCORE_WEIGHTS,
  summary,
  catalog,
  category,
  assessmentScope,
  exactPlant,
  plantById,
  regionStatus,
  pendingPlantLabel,
  resolvedPlant,
  matchesPlantSearch,
  type Candidate,
  type Survey,
  type SurveyPlant,
} from "@/lib/survey";
import { plantGuidance } from "@/lib/plant-guidance";
import { plantStory } from "@/lib/plant-stories";
import { curatedPlantActions } from "@/lib/plant-actions";
import { SaveToast } from "./save-toast";
import { PlantDisclaimer } from "./plant-disclaimer";
import { plantDisplayNote } from "@/lib/plant-display-note";
import { PlantNextActions } from "./plant-next-actions";
import {
  nativePlantingOption,
  NJ_EVIDENCE_SOURCES,
  profileStatus,
} from "@/lib/nj-evidence";
import type { Plant, PlantStatus } from "@/lib/types";
import { SPECIES_REFERENCE_VERSION } from "@/lib/species-reference-version";
import { canonicalReferenceTaxon } from "@/lib/taxon-names";

const PROFILE_TABS = [
  ["overview", "Overview"],
  ["growing", "Growing & seasons"],
  ["wildlife", "Ecology"],
  ["options", "Native options"],
  ["evidence", "Evidence & sources"],
] as const;
type ProfileTab = (typeof PROFILE_TABS)[number][0];
const TOPIC_TAB: Record<string, ProfileTab> = {
  about: "overview", recognition: "evidence", growing: "growing",
  ecology: "wildlife", seasonal: "growing", alternatives: "options", sources: "evidence",
};
function DetailTopic({
  topic,
  title,
  activeTab,
  children,
}: {
  topic: string;
  title: string;
  activeTab: ProfileTab;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <section
      className="rw-rich-topic"
      data-plant-topic={topic}
      hidden={TOPIC_TAB[topic] !== activeTab}
      aria-labelledby={`plant-topic-${topic}-summary`}
    >
      <h3 id={`plant-topic-${topic}-summary`} tabIndex={-1}>{title}</h3>
      <div className="rw-rich-content">{children}</div>
    </section>
  );
}
type Props = {
  survey: Survey;
  onChange: (s: Survey) => void;
  onScan: () => void;
  onSave: () => void;
  onPlan: (from: string, to: string) => void;
  signedIn: boolean;
  accountsAvailable?: boolean;
  saveError?: string;
  busy: boolean;
};
export function SurveyWorkspace({
  survey,
  onChange,
  onScan,
  onSave,
  onPlan,
  signedIn,
  accountsAvailable = false,
  saveError,
  busy,
}: Props) {
  const [selected, setSelected] = useState(survey.plants[0]?.id || ""),
    [view, setView] = useState<"overview" | "manual" | "leaf">("overview"),
    [profileOpen, setProfileOpen] = useState(false),
    [profileTab, setProfileTab] = useState<ProfileTab>("overview"),
    [reviewOpen, setReviewOpen] = useState(false),
    [navPage, setNavPage] = useState(0),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("suggested"),
    [categoryFilter, setCategoryFilter] = useState<
      PlantStatus | "unverified" | null
    >(null),
    [inspect, setInspect] = useState<string | null>(null),
    [showBoxes, setShowBoxes] = useState(true),
    [leafBusy, setLeafBusy] = useState(false),
    [leafError, setLeafError] = useState(""),
    [retryLeafFile, setRetryLeafFile] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [leafResult, setLeafResult] = useState<{
      id: string;
      candidates: Candidate[];
      traits?: Record<string, unknown>;
    } | null>(null);
  const previousView = useRef(view);
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  const toolHeading = useRef<HTMLHeadingElement>(null);
  const profileDialog = useRef<HTMLDialogElement>(null);
  const profileBody = useRef<HTMLDivElement>(null);
  function resetProfileScroll() { if (profileBody.current) profileBody.current.scrollTop = 0; }
  const profileOpener = useRef<HTMLElement | null>(null);
  const profileScroll = useRef(0);
  useEffect(() => {
    const dialog = profileDialog.current;
    if (!profileOpen || !dialog) return;
    const fallbackHeading = detailsHeading.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    resetProfileScroll();
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close plant details"]')?.focus();
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      document.body.style.overflow = previousOverflow;
      if (profileOpener.current?.isConnected)
        profileOpener.current.focus({ preventScroll: true });
      else if (fallbackHeading?.isConnected) fallbackHeading.focus({ preventScroll: true });
      window.scrollTo({ top: profileScroll.current, behavior: "auto" });
    };
  }, [profileOpen]);
  function openProfile(opener?: HTMLElement) {
    if (!profileOpen) {
      setProfileTab("overview");
      setReviewOpen(false);
      profileOpener.current = opener || document.activeElement as HTMLElement;
      profileScroll.current = window.scrollY;
    }
    setProfileOpen(true);
  }
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    const heading =
      view === "overview" ? detailsHeading.current : toolHeading.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [view]);
  const visiblePlants = categoryFilter
    ? assessmentScope(survey).plants.filter(
        (p) => regionStatus(p) === categoryFilter,
      )
    : survey.plants;
  const navPosition = Math.min(
    navPage,
    Math.max(0, Math.ceil(visiblePlants.length / 6) - 1),
  );
  const d =
      visiblePlants.find((p) => p.id === selected) ||
      visiblePlants[0] ||
      survey.plants[0],
    index = survey.plants.indexOf(d),
    plant = d ? resolvedPlant(d) : undefined,
    guide = plant ? plantGuidance(plant) : null;
  const attemptedReferences = useRef(new Set<string>());
  const [referencePass, setReferencePass] = useState(0);
  useEffect(() => {
    const missing = survey.plants.filter(region => {
      const profile = resolvedPlant(region);
      return canonicalReferenceTaxon(region.scientificName) && (!profile || profile.apiOnly) &&
        (region.externalProfile?.referenceVersion !== SPECIES_REFERENCE_VERSION ||
          !(Date.parse(region.externalProfile?.referenceExpiresAt || "") > Date.now())) &&
        !attemptedReferences.current.has(region.id + ":" + region.scientificName);
    }).slice(0, 4);
    if (!missing.length) return;
    const controller = new AbortController();
    Promise.all(missing.map(async region => {
      try {
        const response = await fetch(`/api/species-reference?name=${encodeURIComponent(region.scientificName)}`, { signal: controller.signal });
        const result = response.ok ? await response.json() : null;
        return { region, profile: result?.profile as Plant | undefined };
      } catch { return { region, profile: undefined }; }
    })).then(results => {
      if (controller.signal.aborted) return;
      for (const {region} of results) attemptedReferences.current.add(region.id + ":" + region.scientificName);
      const profiles = new Map(results.filter(result => result.profile).map(result => [result.region.id, result.profile!]));
      setReferencePass(pass => pass + 1);
      if (profiles.size) onChange({ ...survey, plants: survey.plants.map(region => profiles.has(region.id) ? { ...region, externalProfile: profiles.get(region.id) } : region) });
    });
    return () => controller.abort();
  }, [survey, onChange, referencePass]);
  const headerStatus = plant ? profileStatus(plant) : "unverified";
  const headerCategory = headerStatus === "unverified" ? pendingPlantLabel(d)
    : headerStatus === "keystone" ? "Keystone" : headerStatus === "native" ? "Native" : headerStatus === "invasive" ? "Invasive" : "Non-native";
  const headerColor = "var(--status)";
  const headerBackground = "var(--status)";
  const story = plant ? plantStory(plant) : undefined;
  const scopedUpload = survey.source === "upload";
  const regionInYard = !scopedUpload || d.yardScope === "yard";
  const learningFacts = plant?.apiOnly ? plant.referenceDetails?.facts : plant?.horticulture?.taxonScope !== "genus" ? plant?.horticulture?.attributes : undefined;
  const notice = learningFacts?.Attracts?.length
    ? `The reference describes associations with ${learningFacts.Attracts.join(", ")}.`
    : learningFacts?.FruitDisplayTime?.length
      ? `Fruit display is reported in ${learningFacts.FruitDisplayTime.join(", ")} in the general reference.`
      : learningFacts?.FlowerBloomTime?.length
        ? `The reference reports flowering in ${learningFacts.FlowerBloomTime.join(", ")}.`
        : story?.recognitionCue;
  const recognitionOnly = plant?.landscapeContext?.recommendation === "recognition-only";
  const handlingNotes = plant?.sourceCautions?.facts;
  const materialCaution = handlingNotes?.["Poison Severity"]?.some((value) => /medium|high|severe/i.test(value))
    ? `Source-listed toxicity: ${handlingNotes["Poison Severity"].join(", ")}.`
    : handlingNotes?.["Causes Contact Dermatitis"]?.some((value) => /yes|true/i.test(value))
      ? "The source reports skin irritation on contact."
      : undefined;
  const nextAction = plant && d.reviewed && regionInYard && !recognitionOnly && profileStatus(plant) !== "unverified"
    ? curatedPlantActions(plant.id).find((action) => action.kind === "observe" || action.kind === "care")
    : undefined;
  const nextStep = plant?.apiOnly
    ? "Compare the documented traits with this plant. Plan care only after confirming the match and site conditions."
    : !plant || !d.reviewed
    ? story?.nextObservation || "Compare a clear leaf or flower photo with the possible matches."
    : recognitionOnly
      ? story?.nextObservation || "Compare its documented features and record what you see; this profile supports identification."
      : !regionInYard
        ? "Check its growing requirements and confirm whether this plant belongs to your yard before planning a change."
        : nextAction?.detail || story?.nextObservation || "Look at its documented growing requirements before choosing a next step.";
  const scopeName = (region: SurveyPlant) =>
    region.yardScope === "background"
      ? "Background"
      : region.yardScope === "yard"
        ? "In my yard"
        : "Not sure";
  const refined = leafResult?.id === d?.id ? leafResult : null;
  const refs = d.candidates.find(
    (c) =>
      (plant && c.plantId === plant.id) ||
      c.scientificName === d.scientificName,
  )?.referencePhotos;
  const suggested = [
    ...new Map(
      [
        ...(plant ? [plant] : []),
        ...d.candidates
          .map((c) => plantById(c.plantId) || exactPlant(c.scientificName))
          .filter((p): p is Plant => !!p),
      ].map((p) => [p.id, p]),
    ).values(),
  ];
  const choices =
    filter === "suggested" && !search
      ? suggested
      : catalog.filter(
          (p) =>
            (filter === "suggested" ||
              filter === "all" ||
              (profileStatus(p) === filter &&
                ((filter !== "native" && filter !== "keystone") ||
                  nativePlantingOption(p)))) &&
            matchesPlantSearch(p, search),
        );
  const inspected = plantById(inspect || undefined);
  function update(patch: Partial<SurveyPlant>) {
    onChange({
      ...survey,
      revision: new Date().toISOString(),
      ...(patch.reviewed === true
        ? { reviewedAt: new Date().toISOString() }
        : {}),
      plants: survey.plants.map((p) =>
        p.id === d.id ? { ...p, ...patch } : p,
      ),
    });
  }
  const [pendingMatch, setPendingMatch] = useState<string | null>(null);
  function choose(id: string) {
    setPendingMatch(id);
    setView("overview");
    setInspect(null);
    setProfileOpen(false);
    setMessage("Match selected. Confirm plant match to apply it.");
  }
  function submitReview() {
    const id = pendingMatch || plant?.id;
    if (id) commitReview(id);
  }
  function commitReview(id: string) {
    const match = plantById(id) || refined?.candidates.find(c => c.externalProfile?.id === id)?.externalProfile || d.candidates.find(c => c.externalProfile?.id === id)?.externalProfile || (plant?.id === id ? plant : undefined);
    setCategoryFilter(null);
    if (!match) return;
    const chosenCandidate =
      refined?.candidates.find((c) => c.plantId === id || c.externalProfile?.id === id) ||
      d.candidates.find((c) => c.plantId === id || c.externalProfile?.id === id);
    update({
      confidence: chosenCandidate?.confidence,
      candidates: chosenCandidate
        ? [
            chosenCandidate,
            ...d.candidates.filter(
              (c) => c !== chosenCandidate && c.plantId !== id && c.externalProfile?.id !== id,
            ),
          ]
        : d.candidates,
      externalProfile: match.apiOnly ? match : undefined,
      plantId: match.apiOnly ? undefined : id,
      suggestion: match.commonName,
      scientificName: match.scientificName,
      reviewed: true,
    });
    setView("overview");
    setInspect(null);
    setPendingMatch(null);
    setMessage(survey.source === "sample" ? "Match confirmed · analysis updated in this sample preview." : "Match confirmed · analysis updated in this draft. Use Save survey to store it in your account; guest changes are not saved to an account.");
  }
  function select(id: string, reveal = false) {
    const i = visiblePlants.findIndex((p) => p.id === id);
    setSelected(id);
    setPendingMatch(null);
    setReviewOpen(false);
    setNavPage(Math.max(0, Math.floor(i / 6)));
    setView("overview");
    setInspect(null);
    setMessage("");
    if (reveal && window.matchMedia?.("(max-width: 900px)").matches)
      window.requestAnimationFrame(() => document.getElementById("plant-details")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function openTopic(topic: string, opener?: HTMLElement) {
    openProfile(opener);
    setProfileTab(TOPIC_TAB[topic] || "overview");
    window.setTimeout(() => {
      const target = document.getElementById(`plant-topic-${topic}-summary`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  }
  function clearCategory() {
    setCategoryFilter(null);
    setNavPage(0);
  }
  function changeCategory(status: PlantStatus | "unverified") {
    setCategoryFilter(categoryFilter === status ? null : status);
    const first = assessmentScope(survey).plants.find(
      (p) => regionStatus(p) === status,
    );
    if (first) select(first.id);
    setNavPage(0);
  }
  function openTool(next: "manual" | "leaf") {
    setLeafError("");
    setRetryLeafFile(null);
    setProfileOpen(false);
    setView(next);
    setPage(0);
    setSearch("");
    setFilter("suggested");
    setInspect(null);
    setMessage("");
    document
      .getElementById("review-top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function identify(file: File) {
    if (leafBusy) return;
    setRetryLeafFile(null);
    if (file.size > 12 * 1024 * 1024) {
      setLeafError("Photo must be smaller than 12 MB.");
      return;
    }
    if (file.type && !file.type.startsWith("image/") && file.type !== "application/octet-stream" && !/\.hei[cf]$/i.test(file.name)) {
      setLeafError("Choose an image file for leaf identification.");
      return;
    }
    setRetryLeafFile(file);
    setLeafBusy(true);
    setLeafError("");
    setMessage("");
    const id = d.id;
    try {
      const form = new FormData();
      form.set("file", await compressPhoto(file));
      form.set("hint", d.suggestion);
      const result = await photoResponse<{
        candidates: Candidate[];
        traits?: Record<string, unknown>;
      }>(await fetch("/api/identify-macro", { method: "POST", body: form }));
      setLeafResult({ id, ...result });
      setRetryLeafFile(null);
      setMessage(
        "Compare these possibilities with your plant before choosing a match.",
      );
    } catch (e) {
      setLeafError(e instanceof Error ? e.message : "Leaf identification failed.");
    } finally {
      setLeafBusy(false);
    }
  }
  const alternatives = (plant?.swapIds || [])
    .map(plantById)
    .filter((p): p is Plant => !!p && nativePlantingOption(p));
  const title = plant?.commonName || d.suggestion || "Unidentified plant";
  const nextCandidates = scopedUpload
    ? survey.plants.filter((p) => p.yardScope === "yard")
    : survey.plants;
  const unconfirmedRegion = scopedUpload
    ? survey.plants.find((p) => !p.yardScope)
    : undefined;
  const nextPlant =
    unconfirmedRegion ||
    nextCandidates.find((p) => regionStatus(p) === "invasive") ||
    nextCandidates.find((p) => !resolvedPlant(p)) ||
    nextCandidates.find((p) => regionStatus(p) === "non-native") ||
    nextCandidates[0] ||
    survey.plants[0];
  const nextProfile = resolvedPlant(nextPlant);
  const nextStatus = regionStatus(nextPlant);
  const nextKind = unconfirmedRegion
    ? "scope"
    : !nextProfile
      ? "leaf"
      : (nextStatus === "invasive" || nextStatus === "non-native") &&
          !nextPlant.reviewed
        ? "check"
        : (nextStatus === "invasive" || nextStatus === "non-native") &&
            nextProfile.swapIds?.some((id) => {
              const option = plantById(id);
              return option && nativePlantingOption(option);
            })
          ? "compare"
          : "learn";
  const nextLabel =
    nextKind === "scope"
      ? "Mark what’s in your yard"
      : scopedUpload && !nextCandidates.length
        ? "Explore background plants"
        : nextKind === "leaf"
          ? "Add a closer photo"
          : nextKind === "check"
            ? nextStatus === "invasive"
              ? "Check a possible invasive"
              : "Check this plant match"
            : nextKind === "compare"
              ? "Compare native options"
              : nextStatus === "unverified"
                ? "Explore this plant’s NJ status"
                : "Explore your plants";
  return (
    <section className="workspace-page review-workbench" id="review-top">
      {leafError && <SaveToast variant="error" message={leafError} onDismiss={() => setLeafError("")} />}
      <div className="rw-heading">
        <div>
          <p className="eyebrow">
            {survey.source === "sample"
              ? "ILLUSTRATIVE SAMPLE SURVEY"
              : "YOUR PHOTO · YOUR DISCOVERY"}
          </p>
          <h1>Improve your yard’s ecosystem.</h1>
          <p>
            {survey.zip} · {new Date(survey.createdAt).toLocaleDateString()} ·{" "}
            {survey.plants.length} plant regions in this photo
          </p>
        </div>
        <div className="actions">

          <button className="secondary" onClick={() => window.print()}>
            <Printer size={15} />
            Print report
          </button>
          <button className="secondary" onClick={onScan}>
            New photo
          </button>
          {survey.source !== "sample" && (signedIn || accountsAvailable) && (
            <button className="primary" disabled={busy} onClick={onSave}>
              {signedIn ? "Save survey" : "Sign in to save"}
            </button>
          )}
          {saveError && <p className="rw-save-error" role="alert">{saveError} Your changes remain here; retry Save survey when ready.</p>}
          {!signedIn && !accountsAvailable && (
            <p className="account-availability-note">
              Guest mode · print a report to keep a copy. Account saving is
              unavailable right now.
            </p>
          )}
        </div>
      </div>
      {survey.source === "sample" && (
        <p className="rw-sample-note">
          <strong>
            {sampleYardById(survey.sampleId)?.title || "Sample yard"}
          </strong>{" "}
          · Illustrative matches. Explore the same dashboard and review tools as
          your own yard. <a href="?view=examples">Browse sample yards →</a>
          {sampleYardById(survey.sampleId) && (
            <SampleCredit sample={sampleYardById(survey.sampleId)!} />
          )}
        </p>
      )}
      {survey.assessmentHistory?.at(-1)?.version &&
        survey.assessmentHistory.at(-1)!.version !== SCORE_VERSION && (
          <p className="notice">
            The current preview uses {SCORE_VERSION}. Your earlier saved
            assessment keeps its original formula and value. Saving adds a new
            assessment revision; it does not establish a garden change or permit
            a numeric comparison between formula versions.
          </p>
        )}
      <EcosystemScore
        survey={survey}
        variant="summary"
        improveLabel={nextLabel}
        activeCategory={categoryFilter}
        onReset={clearCategory}
        onCategory={changeCategory}
        onImprove={() => {
          setCategoryFilter(null);
          select(nextPlant.id);
          setNavPage(Math.floor(survey.plants.indexOf(nextPlant) / 6));
          if (nextKind === "leaf") {
            openTool("leaf");
            return;
          }
          if (nextKind === "compare") openTopic("alternatives");
          else if (nextKind === "check") openTopic("recognition");
          else if (nextKind === "learn") openTopic("ecology");
          document
            .getElementById("plant-details")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
      {message && (
        <p className="rw-message" role="status">
          {message}
        </p>
      )}
      {view === "overview" ? (
        <>
          <div className="rw-overview">
            <div className="rw-photo-column">
              <div className="rw-photo-toolbar">
                <div>
                  <strong>Your garden, mapped</strong>
                  <small>
                    Select a plant for its summary; open its full profile for details.
                  </small>
                <label>
                  <input
                    type="checkbox"
                    checked={showBoxes}
                    onChange={(e) => setShowBoxes(e.target.checked)}
                  />{" "}
                  All outlines
                </label>
                </div>
          <label className="rw-quick-select">Select plant
            <select value={d.id} onChange={(event) => { clearCategory(); select(event.target.value); }}>
              {survey.plants.map((region, i) => <option key={region.id} value={region.id}>{i + 1}. {resolvedPlant(region)?.commonName || region.suggestion} · {regionStatus(region)}{region.yardScope === "background" ? " · background" : ""}</option>)}
            </select>
          </label>
              </div>
              {scopedUpload && (
                <p className="rw-scope-map-note">
                  Dashed outlines mark background plants. All regions stay
                  available to explore.
                </p>
              )}
              <div className="survey-photo rw-photo">
                <img
                  src={survey.photo}
                  alt="Survey photo with numbered plant regions"
                />
                {visiblePlants.map((p) => {
                  const i = survey.plants.indexOf(p);
                  const match = resolvedPlant(p);
                  return (
                    <button
                      key={p.id}
                      aria-label={`Select plant ${i + 1}: ${`${match?.commonName || p.suggestion}, ${regionStatus(p)}, ${p.reviewed ? "reviewed" : "provisional"}${scopedUpload ? `, ${scopeName(p)}` : ""}`}`}
                      aria-pressed={p.id === d.id}
                      className={`plant-box status-${regionStatus(p)} ${p.yardScope === "background" ? "rw-scope-background" : ""} ${p.id === d.id ? "selected" : ""} ${!showBoxes && p.id !== d.id ? "rw-marker-only" : ""}`}
                      style={{
                        left: `${p.box.x}%`,
                        top: `${p.box.y}%`,
                        width: `${p.box.w}%`,
                        height: `${p.box.h}%`,
                      }}
                      onClick={() => select(p.id, true)}
                    >
                      <span>{i + 1}</span>
                    </button>
                  );
                })}
              </div>
              <EcosystemScore
                survey={survey}
                variant="filters"
                activeCategory={categoryFilter}
                onCategory={changeCategory}
                onReset={clearCategory}
              />
              <EcosystemScoreDetails
                survey={survey}
                activeCategory={categoryFilter}
              />
              <div className="rw-navigator">
                <div className="rw-navigator-head">
                  <h2>
                    Plants in this photo{" "}
                    <small>
                      {categoryFilter
                        ? `${visiblePlants.length} of ${survey.plants.length}`
                        : survey.plants.length}
                    </small>
                  </h2>
                  <label>
                    Jump to a plant
                    <select
                      value={d.id}
                      onChange={(e) => select(e.target.value)}
                    >
                      {visiblePlants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {survey.plants.indexOf(p) + 1}.{" "}
                          {plantById(p.plantId)?.commonName ||
                            p.suggestion ||
                            "Unidentified plant"}
                          {scopedUpload ? ` · ${scopeName(p)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {categoryFilter && (
                  <div className="rw-filter-bar">
                    <span>
                      {categoryFilter === "unverified"
                        ? "Needs review"
                        : categoryFilter === "keystone"
                          ? "Keystone natives"
                          : categoryFilter === "native"
                            ? "Other natives"
                            : categoryFilter}{" "}
                      · {visiblePlants.length} plants
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        setCategoryFilter(null);
                        setNavPage(0);
                      }}
                    >
                      Clear filter
                    </button>
                  </div>
                )}
                <div className="rw-plant-page">
                  {visiblePlants
                    .slice(navPosition * 6, navPosition * 6 + 6)
                    .map((p) => (
                      <button
                        key={p.id}
                        className={`status-${regionStatus(p)} ${p.id === d.id ? "active" : ""}`}
                        aria-pressed={p.id === d.id}
                        onClick={() => select(p.id, true)}
                      >
                        <b>{survey.plants.indexOf(p) + 1}</b>
                        <span>
                          <strong>
                            {plantById(p.plantId)?.commonName || p.suggestion}
                          </strong>
                          <small>
                            {regionStatus(p) === "unverified"
                              ? pendingPlantLabel(p)
                              : `${regionStatus(p) === "keystone" ? "Keystone native" : regionStatus(p)} · ${p.reviewed ? "Identity checked" : "Suggested match"}`}
                          </small>
                          {scopedUpload && (
                            <span
                              className={`rw-region-scope ${p.yardScope === "background" ? "background" : ""}`}
                            >
                              {scopeName(p)}
                            </span>
                          )}
                        </span>
                        {p.reviewed && <Check size={14} />}
                      </button>
                    ))}
                </div>
                {!visiblePlants.length && (
                  <p role="status">
                    No plants match this category. Clear the filter to see all
                    plants.
                  </p>
                )}
                <div className="rw-nav-footer">
                  <span>
                    Showing {visiblePlants.length ? navPosition * 6 + 1 : 0}–
                    {Math.min(navPosition * 6 + 6, visiblePlants.length)} of{" "}
                    {visiblePlants.length}
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      aria-label="Previous plants"
                      disabled={navPosition === 0}
                      onClick={() => setNavPage(navPosition - 1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next plants"
                      disabled={(navPosition + 1) * 6 >= visiblePlants.length}
                      onClick={() => setNavPage(navPosition + 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <aside
              className={`rw-details status-${headerStatus}`}
              id="plant-details"
              aria-label="Selected plant details"
            >
              <div className="rw-selected-nav">
                <button
                  className="icon-button"
                  aria-label="Previous plant"
                  disabled={visiblePlants.indexOf(d) <= 0}
                  onClick={() =>
                    select(visiblePlants[visiblePlants.indexOf(d) - 1].id)
                  }
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  PLANT {index + 1} OF {survey.plants.length}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next plant"
                  disabled={
                    visiblePlants.indexOf(d) < 0 ||
                    visiblePlants.indexOf(d) >= visiblePlants.length - 1
                  }
                  onClick={() =>
                    select(visiblePlants[visiblePlants.indexOf(d) + 1].id)
                  }
                >
                  <ChevronRight size={17} />
                </button>
              </div>
              <h2 ref={detailsHeading} tabIndex={-1} aria-live="polite">
                {title}
              </h2>
              <p className="latin">
                {plant?.scientificName ||
                  d.scientificName ||
                  "Identity to explore"}
              </p>
              <div className="rw-badges">
                <span
                  className={`badge status-${d.reviewed && plant ? profileStatus(plant) : "unverified"}`}
                >
                  {d.reviewed ? "Reviewed identity" : "Unverified suggestion"}
                </span>
                {plant && (
                  <span className={`badge status-${profileStatus(plant)}`}>
                    {category(plant).label}
                    {!d.reviewed ? " · if matched" : ""}
                  </span>
                )}
              </div>
              {scopedUpload && <div className="rw-yard-membership">
                <span>{scopeName(d)}</span> · <button className="text-button" onClick={() => update({ yardScope: d.yardScope === "yard" ? "background" : "yard" })}>{d.yardScope === "yard" ? "Remove from yard" : "Restore to yard"}</button>
                {d.yardScope === "background" && <small>Retained as background context; excluded from the yard score.</small>}
              </div>}
              {(!plant || profileStatus(plant) === "unverified" || !regionInYard) && <p className="rw-immediate-limit">
                {!plant ? "Not yet in our NJ catalog." : profileStatus(plant) === "unverified" ? (plant.apiOnly ? "Not yet in our NJ catalog." : "NJ status pending.") : "Yard membership unconfirmed; replacement planning is unavailable."}
              </p>}
              <div className="rw-selected-summary">
                {plant?.apiOnly && !plant.description && !plant.referenceDetails && <p className="micro">This plant isn’t fully catalogued yet. We have limited details for now.</p>}
                {plant?.apiOnly && plant.referenceDetails && <dl className="rw-facts">{Object.entries(plant.referenceDetails.facts).slice(0,4).map(([label,values]) => <div key={label}><dt>{label.replace(/([a-z])([A-Z])/g,"$1 $2")}</dt><dd>{values.join(" · ")}</dd></div>)}<a href={plant.referenceDetails.source.url} target="_blank" rel="noreferrer">Growing reference ↗</a></dl>}
                {plant?.apiOnly && <div>
                  {plant.description && <p>{plant.description}</p>}
                  {plant.referencePhoto && <figure><img style={{maxWidth:"100%", maxHeight:180, objectFit:"contain"}} src={plant.referencePhoto.url} alt={`Reference specimen: ${plant.commonName}`} /><figcaption>{plant.referencePhoto.attribution} · {plant.referencePhoto.license}</figcaption></figure>}
                  {plant.referenceSource && <a href={plant.referenceSource.url} target="_blank" rel="noreferrer">Species reference ↗</a>}
                  <p>Species reference · not a planting recommendation.</p>
                </div>}
                {story && <p><strong>Meet this plant:</strong> {!d.reviewed ? "If matched, " : ""}{story.opening}</p>}
                {learningFacts?.Light?.length && <p><strong>Growing conditions:</strong> {learningFacts.Light.join(" · ")}</p>}
                {learningFacts?.FlowerBloomTime?.length && <p><strong>Seasonal interest:</strong> Flowers reported in {learningFacts.FlowerBloomTime.join(", ")}.</p>}
                <p><strong>In this photo:</strong> {plant ? `${d.reviewed ? "Reviewed match" : "Possible match"}: ${plant.commonName}. ${plantProfileSummary(plant).split(/(?<=[.!?])\s+/)[0]}` : `${d.scientificName || d.suggestion} — not yet in our NJ catalog. Compare a leaf close-up to confirm the suggested identity.`}</p>
                {notice && <p><strong>Why look closer:</strong> {!d.reviewed ? "If this match is right, " : ""}{notice.charAt(0).toLowerCase() + notice.slice(1)}</p>}
                <p><strong>Try next:</strong> {nextStep}</p>
                {materialCaution && plant?.sourceCautions && <p><strong>Handling note{!d.reviewed ? " (if matched)" : ""}:</strong> {materialCaution} <a href={plant.sourceCautions.source.url} target="_blank" rel="noreferrer">Source ↗</a></p>}
              </div>
              <button className="primary rw-view-profile" onClick={(event) => openProfile(event.currentTarget)}>View plant details <ChevronRight size={17} /></button>
              <div className="rw-submit-review">
                {pendingMatch && <p>Selected match: <strong>{plantById(pendingMatch)?.commonName || refined?.candidates.find(c => c.externalProfile?.id === pendingMatch)?.commonName || d.candidates.find(c => c.externalProfile?.id === pendingMatch)?.commonName || (plant?.id === pendingMatch ? plant.commonName : "Plant match")}</strong></p>}
                <button className="primary" disabled={!pendingMatch && !plant} onClick={submitReview}>Confirm plant match</button>
              </div>
              <div className="rw-direct-match-actions" aria-label="Plant identification actions">
                <button className="secondary" onClick={() => openTool("leaf")}>Identify from a leaf photo</button>
                <button className="secondary" onClick={() => openTool("manual")}>Choose a different plant match</button>
              </div>
              <div className="rw-evidence-links">
                <button
                  className="text-button"
                  onClick={(event) => openTopic("recognition", event.currentTarget)}
                >
                  Sources
                </button>
                <button
                  className="text-button"
                  onClick={(event) => openTopic("ecology", event.currentTarget)}
                >
                  Why this category?
                </button>
                <button
                  className="text-button"
                  onClick={(event) => openTopic("alternatives", event.currentTarget)}
                >
                  Native alternatives & yard plan
                </button>
              </div>
              {alternatives.length > 0 && (signedIn || accountsAvailable) && (
                <button
                  className="secondary"
                  disabled={
                    !regionInYard ||
                    !d.reviewed ||
                    !plant ||
                    profileStatus(plant) === "unverified" ||
                    busy
                  }
                  onClick={(event) => openTopic("alternatives", event.currentTarget)}
                >
                  Add to yard plan
                </button>
              )}
            </aside>
          </div>
          <dialog
            ref={profileDialog}
            className={`rw-profile-dialog status-${headerStatus}`}
            aria-labelledby="rich-plant-details-title"
            aria-modal="true"
            onCancel={(event) => { event.preventDefault(); setProfileOpen(false); }}
            onClick={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setProfileOpen(false); }
              if (event.key !== "Tab") return;
              const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]',
              )].filter((node) => !node.closest('[hidden]') && node.tabIndex >= 0 &&
                (!node.closest('details:not([open])') || node.tagName === 'SUMMARY'));
              const first = controls[0], last = controls.at(-1);
              if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
                event.preventDefault(); last?.focus();
              } else if (!event.shiftKey && (document.activeElement === last || !event.currentTarget.contains(document.activeElement))) {
                event.preventDefault(); first?.focus();
              }
            }}
          >
            <div className="rw-profile-shell">
            <header className={`rw-profile-header status-${headerStatus}`} style={{ borderTopColor: headerColor, background: headerBackground }}>
              <div>
                <h2 id="rich-plant-details-title">{title}</h2>
                <p className="latin">{plant?.scientificName || d.scientificName || "Identity to explore"}</p>
                <div className="rw-profile-indicators">
                <div className="rw-profile-category" aria-label="Plant category" style={{ borderColor: "currentColor" }}>{headerCategory}{!d.reviewed && headerStatus !== "unverified" ? " · if matched" : ""}</div>
                <span className="rw-profile-status">{!plant ? "Not matched" : d.reviewed ? "Reviewed identity" : "Match not reviewed"}</span>
                </div>
              </div>
              <button className="icon-button" aria-label="Close plant details" onClick={() => setProfileOpen(false)}><X size={22} /></button>
            </header>
              <div className="rw-profile-tabs" role="tablist" aria-label="Plant profile sections">
                {PROFILE_TABS.map(([id, label], tabIndex) => (
                  <button key={id} id={`plant-profile-tab-${id}`} role="tab" aria-selected={profileTab === id} aria-controls="plant-profile-panel" tabIndex={profileTab === id ? 0 : -1}
                    onClick={() => { setProfileTab(id); resetProfileScroll(); }}
                    onKeyDown={(event) => {
                      const count = PROFILE_TABS.length;
                      const next = event.key === "ArrowRight" ? (tabIndex + 1) % count : event.key === "ArrowLeft" ? (tabIndex + count - 1) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : -1;
                      if (next < 0) return;
                      event.preventDefault();
                      const id = PROFILE_TABS[next][0]; setProfileTab(id);
                      document.getElementById(`plant-profile-tab-${id}`)?.focus();
                      resetProfileScroll();
                    }}>{label}</button>
                ))}
              </div>
            <div ref={profileBody} className="rw-profile-body" aria-label="Plant profile content">
            <div className="rw-review-match">
              <button className="text-button" aria-expanded={reviewOpen} aria-controls="plant-match-tools" onClick={() => setReviewOpen(!reviewOpen)}>Review plant match</button>
              {reviewOpen && <div id="plant-match-tools" className="rw-review-options">
                <div className="actions">
                  <button className="secondary" onClick={() => openTool("leaf")}>Use a leaf photo</button>
                  <button className="secondary" onClick={() => openTool("manual")}>Choose a plant match</button>
                  {plant && !d.reviewed ? <button className="secondary" onClick={() => choose(plant.id)}>Select this match</button> : d.reviewed ? <button className="text-button" onClick={() => update({ reviewed: false })}>Mark as needing review</button> : null}
                </div>
              </div>}
            </div>
            <div id="plant-profile-panel" role="tabpanel" aria-labelledby={`plant-profile-tab-${profileTab}`} tabIndex={0}>
              <div className="rw-profile-intro" hidden={profileTab !== "overview"}>
                <div>
                  {survey.source === "sample" && sampleYardById(survey.sampleId)?.imageKind === "generated-illustration" && <p className="micro">Generated garden illustration · authored sample plant map.</p>}
            <DetailTopic
              topic="about"
              activeTab={profileTab}
              title="About this plant"
            >
              <div className="rw-overview-actions" aria-label="Overview identification actions">
                <button className="secondary" onClick={() => openTool("leaf")}>Identify from a leaf photo</button>
                <button className="secondary" onClick={() => openTool("manual")}>Choose a different plant match</button>
              </div>
              {plant ? (
                <>
                  <PlantStory plant={plant} narrativeOnly />
                  {plant.apiOnly && plant.referencePhoto && <figure><img style={{maxWidth:"100%",maxHeight:300,objectFit:"contain"}} src={plant.referencePhoto.url} alt={`Reference specimen: ${plant.commonName}`} /><figcaption><a href={plant.referencePhoto.sourceUrl} target="_blank" rel="noreferrer">{plant.referencePhoto.attribution} · {plant.referencePhoto.license}</a></figcaption></figure>}
                  {plant.apiOnly && plant.referenceSource && <a href={plant.referenceSource.url} target="_blank" rel="noreferrer">Species description source ↗</a>}
                  {plant.apiOnly && plant.description && <p>{plant.description}</p>}
                  {notice && <p className="rw-learning-notice"><strong>What to notice:</strong> {!d.reviewed ? "If this match is correct, " : ""}{notice.charAt(0).toLowerCase() + notice.slice(1)}</p>}
                  <div className="rw-learning-next"><strong>Try this next</strong><p>{nextStep}</p>
                    {nextAction && <small>{nextAction.season} · <a href={nextAction.source.url} target="_blank" rel="noreferrer">{nextAction.source.label} ↗</a></small>}
                    {d.reviewed && !recognitionOnly && <button className="text-button" onClick={() => openTopic("growing")}>Explore growing requirements</button>}
                  </div>
                  {plant.horticulture && <PlantHorticultureSource plant={plant} />}
                </>
              ) : (
                <div className="rw-unknown">
                  <Leaf size={22} />
                  <p>This plant isn’t fully catalogued yet. We have limited details for now.</p>
                  {plantDisplayNote(d.note) && <p>{plantDisplayNote(d.note)}</p>}
                </div>
              )}
            </DetailTopic>
                </div>
                <ProfileImages key={`${survey.id}:${d.id}:${plant?.id}`} photo={survey.photo} plant={d} sample={survey.source === "sample"} name={title} scientificName={plant?.scientificName || d.scientificName} photos={refs} />
              </div>

            <DetailTopic
              topic="recognition"
              activeTab={profileTab}
              title="Possible matches"
            >
              {plantDisplayNote(d.note) && <p>{plantDisplayNote(d.note)}</p>}
              {plant && (
                <PlantRecognitionCues
                  plant={plant}
                />
              )}
              {d.candidates.length ? (
                <ul>
                  {d.candidates.map((candidate, i) => (
                    <li key={`${candidate.scientificName}-${i}`}>
                      <strong>{candidate.commonName}</strong> ·{" "}
                      <em>{candidate.scientificName}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No other plant matches are listed.</p>
              )}
              {plant && <PlantHorticultureSource plant={plant} />}
            </DetailTopic>
            <DetailTopic
              topic="growing"
              activeTab={profileTab}
              title="Growing conditions & botanical traits"
            >
              {plant?.apiOnly ? (plant.referenceDetails ? <dl className="rw-facts">{Object.entries(plant.referenceDetails.facts).map(([label, values]) => <div key={label}><dt>{label.replace(/([a-z])([A-Z])/g,"$1 $2")}</dt><dd>{values.join(" · ")}</dd></div>)}<a href={plant.referenceDetails.source.url} target="_blank" rel="noreferrer">Source ↗</a></dl> : null) : plant ? (
                <>
                  <dl className="rw-facts">
                    <div>
                      <dt>Light</dt>
                      <dd>{plant.sun}</dd>
                    </div>
                    <div>
                      <dt>Moisture</dt>
                      <dd>{plant.moisture}</dd>
                    </div>
                    <div>
                      <dt>Mature size</dt>
                      <dd>{plant.height}</dd>
                    </div>
                    <div>
                      <dt>Seasonal interest</dt>
                      <dd>{plant.bloom}</dd>
                    </div>
                  </dl>
                  <PlantBotanicalTraits plant={plant} />
                  <PlantGrowingDetails
                    plant={plant}
                    inline
                    includeHabitat={false}
                  />
                </>
              ) : (
                null
              )}
            </DetailTopic>
            <DetailTopic
              topic="ecology"
              activeTab={profileTab}
              title="Ecology & local category"
            >
              {plant && guide ? (
                <>
                  <div className={`rw-why status-${profileStatus(plant)}`}>
                    <h3>Why this category?</h3>
                    <p>{guide.why}</p>
                  </div>
                  {plant.njEvidence && (
                    <div className="rw-evidence-note">
                      <strong>
                        {plant.njEvidence.sources.length
                          ? "NJ source evidence"
                          : "NJ status needs a source check"}
                      </strong>
                      <p>{plant.njEvidence.note}</p>
                      {plant.njEvidence.ecoregions.length > 0 && (
                        <p>
                          NJ ecoregions in the source:{" "}
                          {plant.njEvidence.ecoregions.join(" · ")}
                        </p>
                      )}
                      <small>
                        Reference check: {plant.njEvidence.checkedOn}.
                        Growing-condition sources and available next steps
                        appear in their own topics.
                      </small>
                    </div>
                  )}
                  <PlantHabitatDetails plant={plant} />
                  <h4>How this plant relates to your score</h4>
                  <p>{profileStatus(plant) === "unverified" ? "An unresolved NJ category earns no native credit." : `The category weight is ${SCORE_WEIGHTS[plant.status]} points, counted once per distinct identified species. The estimate averages species weights and applies shared keystone and native-diversity bonuses.`} Your current included composition estimate is {summary(survey).score ?? "not available"}{summary(survey).score !== null ? "/100" : ""}.</p>
                </>
              ) : (
                <p>
                  A reliable NJ category and ecological role need a
                  species-level match and regional evidence.
                </p>
              )}
            </DetailTopic>
            <DetailTopic
              topic="seasonal"
              activeTab={profileTab}
              title="Seasonal observations & care"
            >
              {guide && !plant?.apiOnly ? (
                <>
                  {plant && <PlantSeasonalInterest plant={plant} inline />}
                  <p className="rw-conditional">
                    {d.reviewed
                      ? "Suggested next steps for this matched species."
                      : "Confirm the identity before pruning, removal, or replacement."}
                  </p>
                  {plant && (
                    <PlantNextActions
                      plant={plant}
                      reviewed={d.reviewed}
                      onReview={() => openTopic("recognition")}
                    />
                  )}
                  <details
                    className="rw-general-actions"
                    open
                  >
                    <summary>General care principles</summary>
                    <div className="rw-action-list">
                      {guide.actions.map((a, i) => (
                        <article key={a.title}>
                          <b>{i + 1}</b>
                          <div>
                            <small>{a.season}</small>
                            <h3>{a.title}</h3>
                            <p>{a.detail}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                  {plant?.removal && d.reviewed && (
                    <details className="rw-sources" open>
                      <summary>
                        Earlier control notes · reference check pending
                      </summary>
                      <p>
                        These stored method, timing and disposal notes were not
                        revalidated by the horticultural reference update. Check
                        the current species-specific NJ guide before acting.
                      </p>
                      {Object.entries(plant.removal).map(([k, v]) => (
                        <p key={k}>
                          <strong>{k}: </strong>
                          {v}
                        </p>
                      ))}
                    </details>
                  )}
                </>
              ) : (
                null
              )}
            </DetailTopic>
            <DetailTopic
              topic="alternatives"
              activeTab={profileTab}
              title="Native alternatives & yard plan"
            >
              {
                <>
                  {plant &&
                  (profileStatus(plant) === "native" ||
                    profileStatus(plant) === "keystone") ? (
                    <>
                      <h3>Keep the native layer growing.</h3>
                      <p>
                        Retain healthy established plants. Look for
                        complementary native species with different heights and
                        flowering seasons.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3>Native options for the same garden role</h3>
                      <p>
                        Match light, soil moisture, and mature size before
                        planning a replacement.
                      </p>
                      {!signedIn && !accountsAvailable && (
                        <>
                          <p className="account-availability-note">
                            Compare options freely. Account saving is
                            unavailable right now; a printed report can keep
                            your options together.
                          </p>
                          <button
                            className="secondary"
                            onClick={() => window.print()}
                          >
                            Print native options
                          </button>
                        </>
                      )}
                      {alternatives.map((p) => (
                        <article className="rw-native-option" key={p.id}>
                          <strong>{p.commonName}</strong>
                          <em>{p.scientificName}</em>
                          <p>
                            {p.sun} · {p.moisture}
                          </p>
                          {(signedIn || accountsAvailable) && (
                            <button
                              className="secondary"
                              disabled={
                                !regionInYard ||
                                !d.reviewed ||
                                !plant ||
                                profileStatus(plant) === "unverified" ||
                                busy
                              }
                              aria-describedby={
                                !regionInYard ||
                                !d.reviewed ||
                                (plant && profileStatus(plant) === "unverified")
                                  ? `plan-note-${p.id}`
                                  : undefined
                              }
                              onClick={() => onPlan(title, p.id)}
                            >
                              Plan this replacement
                            </button>
                          )}
                          {(signedIn || accountsAvailable) &&
                            (!regionInYard ||
                              !d.reviewed ||
                              (plant &&
                                profileStatus(plant) === "unverified")) && (
                              <p id={`plan-note-${p.id}`} className="micro">
                                {!regionInYard
                                  ? d.yardScope === "background"
                                    ? "Background plants are context only. Plan replacements only for plants in your yard."
                                    : "Mark this plant ‘In my yard’ before planning a replacement."
                                  : !d.reviewed
                                    ? "Confirm the plant’s identity before adding a replacement to your yard plan."
                                    : "The NJ category still needs a source check before this replacement can be planned."}
                              </p>
                            )}
                        </article>
                      ))}
                      {!alternatives.length && (
                        <p>
                          No curated replacement is available for this match
                          yet. Browse the native filter in the plant library.
                        </p>
                      )}
                    </>
                  )}
                </>
              }
            </DetailTopic>
            <DetailTopic
              topic="sources"
              activeTab={profileTab}
              title="Sources & photo credits"
            >
              {plant ? (
                <>
                  <PlantHorticultureSource plant={plant} />
                  {guide?.sources.map((source) => (
                    <p key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label} ↗
                      </a>
                    </p>
                  ))}
                  {plant.njEvidence?.sources.map((source) => (
                    <p key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label} ↗
                      </a>
                    </p>
                  ))}
                </>
              ) : (
                <p>A species-level profile source has not yet been matched.</p>
              )}
              <ReferenceCredits
                scientificName={plant?.scientificName || d.scientificName}
                photos={refs}
              />
              {survey.source === "sample" &&
                sampleYardById(survey.sampleId) && (
                  <SampleCredit sample={sampleYardById(survey.sampleId)!} />
                )}

            </DetailTopic>
            </div>
            <PlantDisclaimer />
            </div>
            </div>
          </dialog>
        </>
      ) : (
        <div className="rw-tool-workspace">
          <div className="rw-tool-heading">
            <button
              className="text-button"
              onClick={() => {
                setView("overview");
                setInspect(null);
                setMessage("");
                openProfile();
              }}
            >
              <ArrowLeft size={16} />
              Back to plant profile
            </button>
            <div>
              <p className="eyebrow">
                PLANT {index + 1} · {title}
              </p>
              <h2 ref={toolHeading} tabIndex={-1}>
                {view === "manual"
                  ? "Compare plant matches"
                  : "Leaf photo identification"}
              </h2>
              <p>
                {view === "manual"
                  ? "Explore possible identities beside your own plant. Choose a match only after comparing its features."
                  : "Add a clear leaf or flower photo from this exact plant, then compare the suggestions."}
              </p>
            </div>
          </div>
          <div className="rw-tool-context">
            <RegionPhoto key={`tool:${d.id}`} photo={survey.photo} plant={d} />
            <div>
              <span className="eyebrow">YOUR PHOTOGRAPHED PLANT</span>
              <strong>{title}</strong>
              <em>{d.scientificName}</em>
              <p>
                {d.reviewed
                  ? "Current reviewed match"
                  : "The initial name is a suggestion. A different match may fit the leaves, stems, and growth habit better."}
              </p>
            </div>
          </div>
          {view === "manual" ? (
            <>
              {inspected ? (
                <>
                  <div className="rw-comparison">
                    <section>
                      <span className="eyebrow">CURRENT SUGGESTION</span>
                      <h3>{title}</h3>
                      <ReferenceImage
                        key={`current:${d.id}`}
                        name={title}
                        scientificName={
                          plant?.scientificName || d.scientificName
                        }
                        photos={refs}
                      />
                      <p>
                        {(plant && plantProfileSummary(plant)) ||
                          "No species-level catalog profile for the current suggestion."}
                      </p>
                      {plant && <p>{plantGuidance(plant).why}</p>}
                    </section>
                    <section>
                      <span className="eyebrow">POSSIBLE NEW MATCH</span>
                      <h3>{inspected.commonName}</h3>
                      <ReferenceImage
                        key={`inspect:${inspected.id}`}
                        name={inspected.commonName}
                        scientificName={inspected.scientificName}
                      />
                      <p>{plantProfileSummary(inspected)}</p>
                      <p>{plantGuidance(inspected).why}</p>
                      <div className="actions">
                        <button
                          className="primary"
                          onClick={() => choose(inspected.id)}
                        >
                          Use {inspected.commonName} as match
                        </button>
                        <button
                          className="secondary"
                          onClick={() => setInspect(null)}
                        >
                          Back to results
                        </button>
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <>
                  <div className="rw-search-bar">
                    <label>
                      Search plants
                      <input
                        placeholder="Common or scientific name"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(0);
                        }}
                      />
                    </label>
                    <label>
                      Category
                      <select
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(0);
                        }}
                      >
                        {[
                          "suggested",
                          "all",
                          "keystone",
                          "native",
                          "non-native",
                          "invasive",
                          "unverified",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {v === "suggested"
                              ? "Possible matches"
                              : v === "all"
                                ? "All catalog plants"
                                : v === "keystone"
                                  ? "Keystone natives"
                                  : v === "unverified"
                                    ? "NJ status pending"
                                    : v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span>{choices.length} results</span>
                  </div>
                  <details className="rw-catalog-sources">
                    <summary>
                      About the NJ plant catalog · {catalog.length} profiles
                    </summary>
                    <p>
                      {
                        catalog.filter((p) => profileStatus(p) !== "unverified")
                          .length
                      }{" "}
                      profiles have an assessed NJ category;{" "}
                      {
                        catalog.filter((p) => profileStatus(p) === "unverified")
                          .length
                      }{" "}
                      need a taxon or regional-status check.{" "}
                      {catalog.filter((p) => p.horticulture).length} have
                      matched horticultural references. Native filters exclude
                      NJDEP conservation-sensitive entries. Recognition profiles
                      also include non-native yard plants.
                    </p>
                    {Object.values(NJ_EVIDENCE_SOURCES).map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.title} ↗
                      </a>
                    ))}
                  </details>
                  {!choices.length && (
                    <p className="rw-empty">
                      No catalog candidates here yet. Choose All catalog plants
                      or search a name.
                    </p>
                  )}
                  <div className="rw-results-grid">
                    {choices.slice(page * 6, page * 6 + 6).map((p) => (
                      <article key={p.id}>
                        <ReferenceImage
                          name={p.commonName}
                          scientificName={p.scientificName}
                          photos={
                            d.candidates.find((c) => c.plantId === p.id)
                              ?.referencePhotos
                          }
                        />
                        <div className="rw-result-copy">
                          <span className={`badge status-${profileStatus(p)}`}>
                            {category(p).label}
                          </span>
                          <h3>{p.commonName}</h3>
                          <em>{p.scientificName}</em>
                          <p>{plantProfileSummary(p)}</p>
                          <div className="actions">
                            <button
                              className="secondary"
                              onClick={() => setInspect(p.id)}
                            >
                              Compare
                            </button>
                            <button
                              className="primary"
                              aria-label={`Use ${p.commonName} as match`}
                              onClick={() => choose(p.id)}
                            >
                              Use this match
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="rw-results-pagination">
                    <span>
                      {choices.length
                        ? `${page * 6 + 1}–${Math.min(page * 6 + 6, choices.length)} of ${choices.length}`
                        : "0 results"}
                    </span>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous results
                      </button>
                      <button
                        className="secondary"
                        disabled={(page + 1) * 6 >= choices.length}
                        onClick={() => setPage(page + 1)}
                      >
                        Next results
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="rw-leaf-upload">
                {leafError && <div><p id="leaf-upload-error">{leafError} Choose another photo or retry with a clearer image.</p>{retryLeafFile && <button className="secondary" disabled={leafBusy} onClick={() => void identify(retryLeafFile)}>Retry leaf photo</button>}</div>}
                <div className="actions">
                  <label
                    className="primary file-label"
                    aria-disabled={leafBusy}
                  >
                    <Camera size={16} />
                    Take leaf photo
                    <input
                      type="file"
                      aria-label="Take a leaf photo"
                      aria-describedby={leafError ? "leaf-upload-error" : undefined}
                      accept="image/*"
                      capture="environment"
                      disabled={leafBusy}
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void identify(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label
                    className="secondary file-label"
                    aria-disabled={leafBusy}
                  >
                    Upload leaf photo
                    <input
                      type="file"
                      aria-label="Upload a leaf photo"
                      aria-describedby={leafError ? "leaf-upload-error" : undefined}
                      accept="image/*"
                      disabled={leafBusy}
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void identify(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p>
                  Include leaf edges, veins, and stem arrangement.
                </p>
                {leafBusy && <p role="status">Inspecting your close-up…</p>}
              </div>
              {refined?.traits && (
                <details className="rw-sources">
                  <summary>Photo details</summary>
                  {Object.entries(refined.traits).map(([k, v]) => (
                    <p key={k}>
                      {k.replace(/([A-Z])/g, " $1")}:{" "}
                      {Array.isArray(v) ? v.join(" · ") : String(v)}
                    </p>
                  ))}
                </details>
              )}
              <div className="rw-results-grid">
                {refined?.candidates.map((c, i) => (
                  <article key={`${c.scientificName}:${i}`}>
                    <ReferenceImage
                      name={c.commonName}
                      scientificName={c.scientificName}
                      photos={c.referencePhotos}
                    />
                    <div className="rw-result-copy">
                      <h3>{c.commonName}</h3>
                      <em>{c.scientificName}</em>
                      {plantDisplayNote(c.clue) && <p>{plantDisplayNote(c.clue)}</p>}
                      {c.plantId || c.externalProfile ? (
                        <button
                          className="primary"
                          onClick={() => choose(c.plantId || c.externalProfile!.id)}
                        >
                          Select this match
                        </button>
                      ) : (
                        <p>
                          No local species profile yet. Keep this plant
                          unverified or search the catalog.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <SurveyPrintReport survey={survey} />
    </section>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppUser as User } from "@/lib/firebase/auth-user";
import { Camera, Leaf, LoaderCircle, Sprout, X } from "lucide-react";
import { UploadProgress } from "./upload-progress";
import { sampleYardById } from "@/lib/sample-yards";
import { MyGarden } from "./my-garden";
import { AreaOverview } from "./area-overview";
import { PersonalHeaderNav } from "./personal-header-nav";
import { AreaBaseline } from "./area-baseline";
import { PlantCatalog } from "./plant-catalog";
import { PlantCatalogView } from "./plant-catalog-view";
import { TeamManagementView } from "./team-management-view";
import { LeaderboardView } from "./leaderboard-view";
import { isCurator } from "@/lib/curated-plants-service";
import { CaptureContext } from "./capture-context";
import { SaveToast } from "./save-toast";
import { ObservationCompare } from "./observation-compare";
import { PlantDisclaimer } from "./plant-disclaimer";
import { JourneyHome } from "./journey-home";
import { SampleGallery } from "./sample-gallery";
import { SurveyWorkspace } from "./survey-workspace";
import {
  PropertiesView,
  ProfileView,
  RoadmapView,
  Scope,
  SignIn,
} from "./account-views";
import { appServices, type AppServices } from "@/lib/app-services";
import { type Property, type RoadTask } from "@/lib/account/repository";
import {
  exampleSurvey,
  plantById,
  refreshSampleSurvey,
  withScoreSnapshot,
  type Survey,
} from "@/lib/survey";
import { isNjZip } from "@/lib/nj-data";
import { compressPhoto, photoResponse } from "@/lib/photo-upload";
function autoPlanSignature(ownerId:string,property:Property,records:Survey[]) {
  const year=new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone:"America/New_York"}).format(new Date());
  const areas=new Set(property.yard_areas.map(area=>area.id));
  return JSON.stringify([ownerId,property.id,year,[...areas].sort(),records.filter(item=>item.photoPath&&item.source==="upload"&&item.areaId&&areas.has(item.areaId)).map(item=>[item.id,item.createdAt,item.revision,item.reviewedAt,item.plants.map(region=>[region.scientificName,region.plantId,region.reviewed,region.yardScope])]).sort()]);
}
type View =
  | "examples"
  | "explore"
  | "team"
  | "leaderboard"
  | "welcome"
  | "compare"
  | "home"
  | "scan"
  | "analysis"
  | "signin"
  | "properties"
  | "roadmap"
  | "profile";
export function NativeYardApp({
  services = appServices,
}: {
  services?: AppServices;
}) {
  const uploadController = useRef<AbortController | null>(null);
  const [scanMode, setScanMode] = useState<"yard" | "plant">("yard");
  const [uploadPhase, setUploadPhase] = useState<"preparing" | "analysing">(
    "preparing",
  );
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadErrorNotice, setUploadErrorNotice] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      uploadController.current?.abort();
      uploadController.current = null;
    },
    [],
  );
  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    },
    [uploadPreview],
  );
  const [view, setView] = useState<View>("home"),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [survey, setSurvey] = useState<Survey | null>(null),
    [guestZip, setGuestZip] = useState("07645"),
    [busy, setBusy] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [message, setMessage] = useState(""),
    [capabilities, setCapabilities] = useState<{
      vision: boolean;
      accounts: boolean;
      google?: boolean;
      qa?: boolean;
      email?: boolean;
      emailDeliveryRestricted?: boolean;
    }>({
      vision: false,
      accounts: false,
    }),
    [properties, setProperties] = useState<Property[]>([]),
    [surveys, setSurveys] = useState<Survey[]>([]),
    [tasks, setTasks] = useState<RoadTask[]>([]),
    [propertyId, setPropertyId] = useState(""),
    [areaId, setAreaId] = useState("");
  const [sampleSurvey, setSampleSurvey] = useState<Survey | null>(null);
  const [areaTab, setAreaTab] = useState<"overview" | "surveys" | undefined>();
  const [pair, setPair] = useState({ before: "", after: "" });
  const [routeError, setRouteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saveDestination, setSaveDestination] = useState(0);
  const [planErrors, setPlanErrors] = useState<Record<string,string>>({});
  const [planRefresh, setPlanRefresh] = useState(0);
  const planAttempts = useRef(new Set<string>());
  const plansInFlight = useRef(new Set<string>());
  const queuedPlans = useRef(new Map<string,string>());
  useEffect(() => {
    if (!saveDestination) return;
    document.getElementById("main-content")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [saveDestination]);
  const [signOutChoice, setSignOutChoice] = useState(false);
  const [creationMode, setCreationMode] = useState<
    "property" | "area" | undefined
  >();
  const [locationOverride, setLocationOverride] = useState<{
    key: string;
    zip: string;
    editing: boolean;
    elsewhere?: boolean;
  } | null>(null);
  const identity = useRef({
    ownerId: null as string | null,
    generation: 0,
    initialized: false,
  });
  const surveyRef = useRef<Survey | null>(survey);
  const viewRef = useRef<View>(view);
  const pendingSave = useRef(false);
  const [savingPending, setSavingPending] = useState(false);
  const [authGeneration, setAuthGeneration] = useState(0);
  const setSavePending = useCallback((pending: boolean) => {
    pendingSave.current = pending;
    setSavingPending(pending);
  }, []);
  const accountData = useRef<{
    properties: Property[];
    surveys: Survey[];
    tasks: RoadTask[];
  }>({ properties: [], surveys: [], tasks: [] });
  const currentIdentity = useCallback(
    (generation: number, ownerId = identity.current.ownerId) =>
      identity.current.generation === generation &&
      identity.current.ownerId === ownerId,
    [],
  );
  const changeSurvey = useCallback((next: Survey | null) => {
    surveyRef.current = next;
    setSurvey(next);
  }, []);
  const showView = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);
  const refresh = useCallback(
    async (generation = identity.current.generation) => {
      const ownerId = identity.current.ownerId;
      if (!ownerId || !currentIdentity(generation, ownerId)) return;
      const data = await services.account.loadAccount();
      if (!currentIdentity(generation, ownerId)) return;
      accountData.current = data;
      setProperties(data.properties);
      setSurveys(data.surveys);
      setTasks(data.tasks);
      setPropertyId((current) =>
        data.properties.some((p) => p.id === current)
          ? current
          : data.properties[0]?.id || "",
      );
      setAreaId((current) =>
        data.properties.some((p) => p.yard_areas.some((a) => a.id === current))
          ? current
          : "",
      );
      return data;
    },
    [services, currentIdentity],
  );
  const abandonUpload = useCallback(() => {
    const controller = uploadController.current;
    if (!controller) return;
    uploadController.current = null;
    controller.abort();
    setBusy(false);
    setUploadPreview(null);
  }, []);
  const navigate = useCallback(
    (
      next: View,
      preserveUpload = false,
      scope?: {
        property?: string;
        area?: string;
        survey?: string;
        before?: string;
        after?: string;
        tab?: string;
        sample?: string;
      },
    ) => {
      if (!preserveUpload) abandonUpload();
      setSampleSurvey(scope?.sample && sampleYardById(scope.sample)
        ? exampleSurvey("07645", scope.sample) : null);
      showView(next);
      setMessage("");
      setSaveError("");
      setSaveNotice("");
      setUploadError("");
      setUploadErrorNotice(false);
      setUploadFile(null);
      window.history.replaceState(
        { ...window.history.state, scrollY: window.scrollY },
        "",
      );
      const query = new URLSearchParams({ view: next });
      if (
        ["properties", "roadmap", "scan", "analysis", "compare"].includes(next)
      ) {
        const selected = scope || { property: propertyId, area: areaId };
        Object.entries(selected).forEach(([key, value]) => {
          if (value) query.set(key, value);
        });
      }
      setRouteError("");
      window.history.pushState({ scrollY: 0 }, "", `/?${query}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [abandonUpload, showView, propertyId, areaId],
  );
  useEffect(() => {
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const initialGeneration = identity.current.generation;
    const views = [
      "home",
      "welcome",
      "examples",
      "explore",
      "team",
      "leaderboard",
      "compare",
      "scan",
      "analysis",
      "signin",
      "properties",
      "roadmap",
      "profile",
    ];
    async function loadSession(
      next: User | null,
      generation: number,
      initial: boolean,
      resumeDraft: boolean,
    ) {
      const valid = () =>
        active && currentIdentity(generation, next?.id || null);
      try {
        const stored = resumeDraft
          ? await services.drafts.readDraft(next?.id).catch(() => null)
          : null;
        if (!valid()) return;
        const params = new URLSearchParams(location.search);
        const requested = params.get("view") as View;
        const requestedSample = requested === "analysis" ? params.get("sample") : null;
        if (requested === "analysis" && params.has("sample")) {
          if (requestedSample && sampleYardById(requestedSample))
            setSampleSurvey(exampleSurvey("07645", requestedSample));
          else setRouteError("This example is unavailable. Choose another example.");
        }
        const draft =
          !surveyRef.current &&
          stored &&
          (requested === "analysis" || params.has("resume"))
            ? refreshSampleSurvey(stored)
            : null;
        if (draft?.source === "upload") changeSurvey(draft);
        if (initial) {
          showView(
            location.hash === "#examples" && ["home", "welcome", "examples"].includes(requested || "home")
              ? "examples"
              : draft
              ? "analysis"
              : views.includes(requested)
                ? requested
                : next
                  ? "home"
                  : "home",
          );
          if (params.get("logout") === "local")
            setMessage(
              "Signed out on this browser. Remote session revocation could not be confirmed; reconnect and sign in again if you need to verify it.",
            );
          if (params.has("error"))
            setMessage("Sign-in could not be completed. Please try again.");
        }
        if (next) {
          const account = await refresh(generation);
          if (!valid() || !account) return;
          const routeProperty = params.get("property"),
            routeArea = params.get("area"),
            routeSurvey = params.get("survey");
          const selected = account.properties.find(
            (p) => p.id === routeProperty,
          );
          const owner = routeArea
            ? account.properties.find((p) =>
                p.yard_areas.some((a) => a.id === routeArea),
              )
            : selected;
          if (
            (routeProperty && !selected) ||
            (routeArea &&
              (!owner || (routeProperty && owner.id !== routeProperty)))
          ) {
            setRouteError(
              "This property or area is unavailable in your account.",
            );
          } else if (routeProperty || routeArea) {
            setPropertyId((owner || selected)!.id);
            setAreaId(routeArea || "");
          }
          if (routeSurvey) {
            const saved = account.surveys.find((s) => s.id === routeSurvey);
            if (!saved || (routeArea && saved.areaId !== routeArea))
              setRouteError(
                "This saved survey is unavailable in the selected area.",
              );
            else changeSurvey(saved);
          }
          setAreaTab(
            params.get("tab") === "surveys"
              ? "surveys"
              : params.get("tab") === "overview"
                ? "overview"
                : undefined,
          );
          setPair({
            before: params.get("before") || "",
            after: params.get("after") || "",
          });
          const area = surveyRef.current?.areaId;
          if (area) {
            const owner = account.properties.find((p) =>
              p.yard_areas.some((a) => a.id === area),
            );
            if (owner) {
              setPropertyId(owner.id);
              setAreaId(area);
            }
          }
        }
      } catch (e) {
        if (valid())
          setMessage(
            e instanceof Error
              ? e.message
              : "Account data could not be loaded.",
          );
      } finally {
        if (valid()) setReady(true);
      }
    }
    function acceptIdentity(next: User | null) {
      if (!active) return;
      const previous = identity.current;
      const ownerId = next?.id || null;
      if (previous.initialized && previous.ownerId === ownerId) {
        setUser(next);
        return;
      }
      const initial = !previous.initialized;
      const generation = previous.generation + 1;
      identity.current = { ownerId, generation, initialized: true };
      setAuthGeneration(generation);
      abandonUpload();
      setUploadPreview(null);
      setUploadName("");
      setUploadFile(null);
      setUploadError("");
      setUploadErrorNotice(false);
      if (previous.ownerId) setGuestZip("07645");
      setLocationOverride(null);
      setBusy(false);
      setMessage("");
      setSaveError("");
      setSaveNotice("");
      setPlanErrors({});
      planAttempts.current.clear();
      setReady(false);
      accountData.current = { properties: [], surveys: [], tasks: [] };
      setProperties([]);
      setSurveys([]);
      setTasks([]);
      setPropertyId("");
      setAreaId("");
      // Only a genuinely anonymous scan may cross the guest-to-account boundary.
      const current = surveyRef.current;
      const keepAnonymous =
        !previous.ownerId && !current?.areaId && !current?.photoPath;
      if (!keepAnonymous) {
        changeSurvey(null);
        setSavePending(false);
      }
      if (previous.ownerId) {
        void services.drafts.clearDraft(previous.ownerId).catch(() => {});
        if (current && !current.areaId && !current.photoPath)
          void services.drafts
            .clearDraft(previous.ownerId, current.id)
            .catch(() => {});
      } else if (ownerId && current) {
        // Claim the guest scan promptly so a later account switch cannot resume it anonymously.
        void services.drafts.keepDraft(current, ownerId).catch(() => {});
      }
      setUser(next);
      if (!initial) {
        if (next && viewRef.current === "signin")
          showView(surveyRef.current ? "analysis" : "properties");
        else if (
          !next &&
          (["properties", "roadmap", "profile"].includes(viewRef.current) ||
            (viewRef.current === "analysis" && !surveyRef.current))
        )
          showView("home");
      }
      // Auth listener notification: load outside it.
      const timer = setTimeout(() => {
        timers.delete(timer);
        void loadSession(
          next,
          generation,
          initial,
          initial || !previous.ownerId,
        );
      }, 0);
      timers.add(timer);
    }
    const unsubscribe = services.auth.subscribe(acceptIdentity);
    void services.auth
      .currentUser()
      .then((next) => {
        if (
          active &&
          identity.current.generation === initialGeneration &&
          !identity.current.initialized
        )
          acceptIdentity(next);
      })
      .catch(() => {
        if (active && identity.current.generation === initialGeneration) {
          acceptIdentity(null);
          setMessage(
            "Account session could not be verified. You can still explore as a guest.",
          );
        }
      });
    void fetch("/api/capabilities")
      .then((r) => r.json())
      .then((cap) => {
        if (active) setCapabilities(cap);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Some services could not be reached. You can still explore an example.",
          );
      });
    const back = () => {
      abandonUpload();
      const requested = new URLSearchParams(location.search).get(
        "view",
      ) as View;
      const params = new URLSearchParams(location.search);
      const data = accountData.current;
      const p = params.get("property"),
        a = params.get("area"),
        id = params.get("survey");
      const owner = data.properties.find((row) =>
        a ? row.yard_areas.some((area) => area.id === a) : row.id === p,
      );
      const requestedSample = requested === "analysis" ? params.get("sample") : null;
      setSampleSurvey(requestedSample && sampleYardById(requestedSample)
        ? exampleSurvey("07645", requestedSample) : null);
      setRouteError(requested === "analysis" && params.has("sample") &&
        (!requestedSample || !sampleYardById(requestedSample))
        ? "This example is unavailable. Choose another example." : "");
      if (
        identity.current.ownerId &&
        ((p && !data.properties.some((row) => row.id === p)) ||
          (a && (!owner || (p && owner.id !== p))))
      )
        setRouteError("This property or area is unavailable in your account.");
      else if (owner) {
        setPropertyId(owner.id);
        setAreaId(a || "");
      } else if (!a && !id && ["properties", "home"].includes(requested)) {
        setAreaId("");
      }
      if (id && identity.current.ownerId) {
        const saved = data.surveys.find(
          (row) => row.id === id && (!a || row.areaId === a),
        );
        if (saved) changeSurvey(saved);
        else setRouteError("This survey is unavailable in the selected area.");
      }
      setAreaTab(
        params.get("tab") === "surveys"
          ? "surveys"
          : params.get("tab") === "overview"
            ? "overview"
            : undefined,
      );
      setPair({
        before: params.get("before") || "",
        after: params.get("after") || "",
      });
      showView(location.hash === "#examples" && ["home", "welcome", "examples"].includes(requested || "home")
        ? "examples" : views.includes(requested) ? requested : "home");
      setTimeout(() => {
        const target = location.hash === "#examples" ? document.getElementById("examples") : null;
        if (target) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "start" });
        } else window.scrollTo({ top: window.history.state?.scrollY || 0 });
      }, 0);
    };
    window.addEventListener("popstate", back);
    return () => {
      active = false;
      identity.current = {
        ...identity.current,
        generation: identity.current.generation + 1,
        initialized: false,
      };
      for (const timer of timers) clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("popstate", back);
    };
  }, [
    refresh,
    services,
    abandonUpload,
    changeSurvey,
    showView,
    currentIdentity,
    setSavePending,
  ]);
  useEffect(() => {
    if (!survey || survey.source !== "upload" || (survey.photoPath && !survey.revision)) return;
    const { generation, ownerId } = identity.current;
    const id = setTimeout(() => {
      if (currentIdentity(generation, ownerId))
        void services.drafts
          .keepDraft(survey, ownerId || undefined)
          .catch(() => {});
    }, 500);
    return () => clearTimeout(id);
  }, [survey, services, user, currentIdentity]);
  useEffect(() => {
    if (!ready || location.hash !== "#examples") return;
    const timer = setTimeout(() => {
      const target = document.getElementById("examples");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start" });
    }, 0);
    return () => clearTimeout(timer);
  }, [ready, view]);
  const currentProperty = properties.find((p) => p.id === propertyId);
  const selectedArea = currentProperty?.yard_areas.find((a) => a.id === areaId);
  // The profile currently edits name only; use a ZIP only when metadata actually contains one.
  const profileZip =
    [
      user?.user_metadata?.default_zip,
      user?.user_metadata?.zip,
      user?.user_metadata?.preferred_zip,
    ]
      .find(
        (value): value is string =>
          typeof value === "string" && isNjZip(value.trim()),
      )
      ?.trim() || "";
  const locationKey = user ? `${user.id}:${propertyId}` : "guest";
  const activeLocationOverride =
    locationOverride?.key === locationKey ? locationOverride : null;
  const savedLocationZip = currentProperty
    ? isNjZip(currentProperty.zip)
      ? currentProperty.zip
      : ""
    : propertyId
      ? ""
      : profileZip;
  const zip = user
    ? (activeLocationOverride?.zip ?? savedLocationZip)
    : guestZip;
  const editingLocation =
    !user || !!activeLocationOverride?.editing || !isNjZip(zip);
  const detachedLocation =
    !!user &&
    (!!activeLocationOverride?.elsewhere ||
      (!!currentProperty && zip !== currentProperty.zip));
  function editLocation(value: string) {
    const nextZip = value.replace(/\D/g, "").slice(0, 5);
    if (!user) setGuestZip(nextZip);
    else {
      setLocationOverride({
        key: locationKey,
        zip: nextZip,
        editing: true,
        elsewhere: activeLocationOverride?.elsewhere,
      });
      if (currentProperty && nextZip !== currentProperty.zip) setAreaId("");
    }
  }
  function beginScan() {
    setLocationOverride(null);
    navigate("scan");
  }
  function scanElsewhere(value = "") {
    if (!user) return;
    setPropertyId("");
    setAreaId("");
    setLocationOverride({
      key: `${user.id}:`,
      zip: value,
      editing: true,
      elsewhere: true,
    });
  }

  async function signIn() {
    const { generation, ownerId } = identity.current;
    setBusy(true);
    try {
      if (surveyRef.current)
        await services.drafts.keepDraft(
          surveyRef.current,
          ownerId || undefined,
        );
      if (!currentIdentity(generation, ownerId)) return;
      await services.auth.signIn();
    } catch (e) {
      if (currentIdentity(generation, ownerId))
        setMessage(
          e instanceof Error ? e.message : "Google sign-in could not start.",
        );
    } finally {
      if (currentIdentity(generation, ownerId)) setBusy(false);
    }
  }
  async function signOut(discard = false) {
    if (signingOut) return;
    const draft = surveyRef.current;
    if (
      !discard &&
      draft?.source === "upload" &&
      (!draft.photoPath || draft.revision)
    ) {
      setSignOutChoice(true);
      return;
    }
    setSignOutChoice(false);
    const { generation, ownerId } = identity.current;
    setSigningOut(true);
    abandonUpload();
    setBusy(true);
    try {
      const logoutResult = await services.auth.signOut();
      // Some adapters do not emit an auth event; the subscription remains authoritative.
      if (currentIdentity(generation, ownerId)) {
        identity.current = {
          ownerId: null,
          generation: generation + 1,
          initialized: true,
        };
        setAuthGeneration(generation + 1);
        abandonUpload();
        setUploadPreview(null);
        setUploadName("");
        setGuestZip("07645");
        setLocationOverride(null);
        changeSurvey(null);
        setSavePending(false);
        accountData.current = { properties: [], surveys: [], tasks: [] };
        setProperties([]);
        setSurveys([]);
        setTasks([]);
        setPropertyId("");
        setAreaId("");
        setUser(null);
        setBusy(false);
        navigate("home");
      }
      if (ownerId) await services.drafts.clearDraft(ownerId).catch(() => {});
      if (logoutResult && logoutResult.reloadRequired)
        window.location.replace(
          logoutResult.remoteRevoked
            ? "/?view=welcome"
            : "/?view=welcome&logout=local",
        );
    } catch {
      if (currentIdentity(generation, ownerId))
        setMessage("Sign-out could not be completed. Please try again.");
    } finally {
      setSigningOut(false);
      if (currentIdentity(generation, ownerId)) setBusy(false);
    }
  }
  async function sendEmailCode(email: string) {
    const generation = identity.current.generation;
    if (!services.auth.sendEmailCode)
      throw new Error("Email sign-in is unavailable.");
    setBusy(true);
    try {
      await services.auth.sendEmailCode(email);
    } finally {
      if (currentIdentity(generation)) setBusy(false);
    }
  }
  async function verifyEmailCode(email: string, code: string) {
    const generation = identity.current.generation;
    if (!services.auth.verifyEmailCode)
      throw new Error("Email sign-in is unavailable.");
    setBusy(true);
    try {
      await services.auth.verifyEmailCode(email, code);
      if (currentIdentity(generation) && identity.current.ownerId)
        navigate("properties");
    } finally {
      if (currentIdentity(generation)) setBusy(false);
    }
  }
  async function analyze(file: File) {
    if (uploadController.current) return;
    setUploadFile(file);
    setUploadName(file.name);
    setUploadError("");
    setUploadErrorNotice(false);
    const reportError = (detail: string) => {
      setUploadError(detail);
      setUploadErrorNotice(true);
    };
    if (file.size > 12 * 1024 * 1024) {
      reportError("Photo must be smaller than 12 MB. Choose a smaller photo.");
      return;
    }
    if (file.type && !file.type.startsWith("image/") && file.type !== "application/octet-stream" && !/\.hei[cf]$/i.test(file.name)) {
      reportError("Choose a JPEG, PNG, WebP, or compatible camera photo.");
      return;
    }
    if (!isNjZip(zip)) {
      reportError("Enter a valid New Jersey ZIP code, then retry this photo.");
      return;
    }
    if (detachedLocation) scanElsewhere(zip);
    const controller = new AbortController();
    uploadController.current = controller;
    let timedOut = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    setBusy(true);
    setUploadPhase("preparing");
    setUploadName(file.name);
    setUploadPreview(null);
    setMessage("");
    try {
      const compressed = await compressPhoto(file);
      if (controller.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      try {
        setUploadPreview(URL.createObjectURL(compressed));
      } catch {
        /* Preview is optional; file upload remains available. */
      }
      setUploadPhase("analysing");
      deadline = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 75000);
      const form = new FormData();
      form.set("file", compressed);
      form.set("zip", zip);
      form.set("mode", scanMode);
      const r = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await photoResponse<Survey>(r);
      if (controller.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      if (!data.plants?.length || !data.photo)
        throw new Error("No plant regions were returned. Try another photo.");
      if (uploadController.current !== controller) return;
      changeSurvey({ ...data, plants: data.plants.map((plant) => ({ ...plant, yardScope: plant.yardScope ?? "yard" })) });
      navigate("analysis", true);
    } catch (e) {
      if (uploadController.current !== controller) return;
      if (controller.signal.aborted && !timedOut) {
        setMessage("Photo analysis cancelled.");
      } else {
        reportError(
          timedOut
            ? "The yard scan took too long. Please retry; no partial single-plant result was substituted."
            : e instanceof Error
              ? e.message
              : "Photo analysis failed. Please retry this photo.",
        );
      }
    } finally {
      if (deadline) clearTimeout(deadline);
      if (uploadController.current === controller) {
        uploadController.current = null;
        setBusy(false);
      }
    }
  }
  function example(sampleId = "front-yard") {
    if (!sampleYardById(sampleId)) return;
    navigate("analysis", false, { sample: sampleId });
  }
  function open(s: Survey) {
    const ownerId = identity.current.ownerId || user?.id;
    const cleanPhotoPath = s.photoPath ? s.photoPath.replace(/^\/+/, "") : "";
    if (
      cleanPhotoPath &&
      (!ownerId ||
        (!cleanPhotoPath.startsWith(`${ownerId}/`) &&
          !cleanPhotoPath.startsWith(`surveys/${ownerId}/`)))
    )
      return;
    const allProps =
      accountData.current.properties.length > 0
        ? accountData.current.properties
        : properties;
    s = refreshSampleSurvey(s);
    const property = allProps.find((p) =>
      p.yard_areas.some((a) => a.id === s.areaId),
    );
    if (property) setPropertyId(property.id);
    setLocationOverride(null);
    setAreaId(s.areaId || "");
    changeSurvey(s);
    navigate("analysis", false, {
      property: property?.id,
      area: s.areaId,
      survey: s.photoPath ? s.id : undefined,
    });
  }
  async function saveToArea(
    draft: Survey,
    targetProperty: Property,
    targetArea: string,
    generation: number,
  ) {
    const ownerId = identity.current.ownerId;
    if (!ownerId || !currentIdentity(generation, ownerId)) return;
    const area = targetProperty.yard_areas.find((a) => a.id === targetArea);
    if (!area) return;
    if (
      !draft.areaId &&
      draft.source === "upload" &&
      (!isNjZip(targetProperty.zip) || draft.zip !== targetProperty.zip)
    ) {
      setSavePending(true);
      navigate("properties");
      setMessage(
        `This photo was scanned for ZIP ${draft.zip}. Choose a property with that ZIP, or scan again using ${targetProperty.name}’s saved location. Its saved ZIP has not changed.`,
      );
      return;
    }
    setBusy(true);
    setSaveError("");
    setSaveNotice("");
    let committed = false;
    try {
      const saved = await services.account.saveSurvey(
        withScoreSnapshot(draft),
        targetArea,
        ownerId,
      );
      if (!currentIdentity(generation, ownerId)) return;
      changeSurvey(saved);
      committed = true;
      setSavePending(false);
      const savedSurveys = [...accountData.current.surveys.filter((s) => s.id !== saved.id), saved];
      accountData.current = { ...accountData.current, surveys: savedSurveys };
      setSurveys(savedSurveys);
      setPropertyId(targetProperty.id);
      setAreaId(targetArea);
      navigate("analysis", false, {
        property: targetProperty.id,
        area: targetArea,
        survey: saved.id,
      });
      setSaveNotice(`Survey saved to ${targetProperty.name} / ${area.name}.`);
      setSaveDestination((previous) => previous + 1);
      void initializePlan(targetProperty.id,autoPlanSignature(ownerId,targetProperty,savedSurveys));
      await services.drafts.clearDraft(ownerId, draft.id).catch(() => {});
      await refresh(generation);
    } catch (e) {
      if (currentIdentity(generation, ownerId))
        if (committed) setMessage("Your survey was saved, but the account list could not refresh. Reload account data to see the saved record.");
        else setSaveError(e instanceof Error ? e.message : "Survey could not be saved.");
    } finally {
      if (currentIdentity(generation, ownerId)) setBusy(false);
    }
  }
  async function save() {
    const draft = surveyRef.current;
    if (!draft) return;
    if (!user) {
      if (capabilities.accounts) {
        setSavePending(true);
        navigate("signin");
      } else
        setMessage(
          "Account saving is unavailable right now. Print a report to keep a copy.",
        );
      return;
    }
    if (!selectedArea || !currentProperty) {
      setSavePending(true);
      navigate("properties");
      setMessage(
        "Your survey is still here. Choose a property and yard area, or add one, to finish saving it.",
      );
      return;
    }
    await saveToArea(
      draft,
      currentProperty,
      areaId,
      identity.current.generation,
    );
  }
  function scopeCreated(createdProperty: string, createdArea?: string) {
    const property = accountData.current.properties.find(
      (p) => p.id === createdProperty,
    );
    if (!property) return;
    setPropertyId(createdProperty);
    setLocationOverride(null);
    setAreaId(createdArea || "");
    setCreationMode(undefined);
    navigate("properties", false, {
      property: createdProperty,
      area: createdArea,
    });
    if (pendingSave.current && surveyRef.current) {
      if (createdArea)
        void saveToArea(
          surveyRef.current,
          property,
          createdArea,
          identity.current.generation,
        );
      else
        setMessage(
          "Property added. Add a yard area to finish saving your survey.",
        );
    }
  }
  function scanArea(targetArea: string) {
    const property = accountData.current.properties.find((p) =>
      p.yard_areas.some((a) => a.id === targetArea),
    );
    if (!property) return;
    setPropertyId(property.id);
    setLocationOverride(null);
    setAreaId(targetArea);
    setSavePending(false);
    navigate("scan", false, { property: property.id, area: targetArea });
  }
  async function plan(from: string, to: string) {
    const { generation, ownerId } = identity.current;
    if (!user || !ownerId) {
      if (capabilities.accounts) navigate("signin");
      else
        setMessage(
          "Account saving is unavailable right now. You can compare native options and print a report.",
        );
      return;
    }
    if (!selectedArea || !survey) {
      setMessage(
        "Select the property and yard area that this replacement belongs to before adding it to your yard plan.",
      );
      return;
    }
    const linked = accountData.current.surveys.some(
      (saved) => saved.id === survey.id && saved.areaId === areaId,
    );
    setBusy(true);
    try {
      await services.account.putTask({
        property_id: propertyId,
        yard_area_id: areaId,
        title: `Replace ${from} with ${plantById(to)?.commonName}`,
        notes:
          "Confirm growing conditions, mature size, and the removal approach before planting.",
        replacement_id: to,
        done: false,
        plan_year: new Date().getFullYear(),
        completed_at: null,
        survey_id: linked ? survey.id : null,
      });
      if (!currentIdentity(generation, ownerId)) return;
      await refresh(generation);
      if (!currentIdentity(generation, ownerId)) return;
      navigate("roadmap");
      setMessage("Replacement added to this yard area’s plan.");
    } catch (e) {
      if (currentIdentity(generation, ownerId))
        setMessage(
          e instanceof Error ? e.message : "Could not plan this replacement.",
        );
    } finally {
      if (currentIdentity(generation, ownerId)) setBusy(false);
    }
  }
  const displayedSurvey = sampleSurvey || survey;
  const renderGeneration = authGeneration;
  const scopedRefresh = () => refresh(renderGeneration);
  const accountError = (error: string) => {
    if (currentIdentity(renderGeneration)) setMessage(error);
  };
  const scopedCreated = (createdProperty: string, createdArea?: string) => {
    if (currentIdentity(renderGeneration))
      scopeCreated(createdProperty, createdArea);
  };
  const propertyAreaIds = new Set(
    currentProperty?.yard_areas.map((area) => area.id) || [],
  );
  const propertySurveys = surveys.filter(
    (saved) => saved.areaId && propertyAreaIds.has(saved.areaId),
  );
  const initializePlan = useCallback(async function runAutoPlan(target: string, signature: string) {
    const ownerId=identity.current.ownerId, generation=identity.current.generation;
    const key=`${ownerId}/${target}`;
    if (!ownerId || !services.account.ensureAutoYardPlan || planAttempts.current.has(signature)) return;
    if(plansInFlight.current.has(key)){queuedPlans.current.set(key,signature);return;}
    plansInFlight.current.add(key);planAttempts.current.add(signature);
    try {
      const rows=await services.account.ensureAutoYardPlan(target);
      if (!currentIdentity(generation,ownerId)) return;
      const merged=[...accountData.current.tasks.filter(task=>task.property_id!==target),...rows];
      accountData.current={...accountData.current,tasks:merged};setTasks(merged);
      setPlanErrors(previous=>{const next={...previous};delete next[target];return next;});
    } catch(error) {
      if(currentIdentity(generation,ownerId))setPlanErrors(previous=>({...previous,[target]:error instanceof Error?error.message:"The automatic yard plan could not update."}));
    } finally {
      plansInFlight.current.delete(key);
      if(currentIdentity(generation,ownerId)){
        setPlanRefresh(value=>value+1);
        const queued=queuedPlans.current.get(key);queuedPlans.current.delete(key);
        if(queued)void runAutoPlan(target,queued);
      }
    }
  },[services,currentIdentity]);
  useEffect(()=>{
    if(!ready || !user || !currentProperty) return;
    const signature=autoPlanSignature(user.id,currentProperty,propertySurveys);
    void initializePlan(currentProperty.id,signature);
  },[ready,user,currentProperty,propertySurveys,initializePlan,planRefresh]);
  function retryPlan(){ planAttempts.current.clear();setPlanRefresh(value=>value+1); }
  const accountView = ["properties", "roadmap", "profile", "compare"].includes(
    view,
  );
  const contentView = routeError
    ? "unavailable"
    : accountView && !user
      ? "signin"
      : view === "home" && user
        ? "garden"
        : view === "welcome"
          ? "home"
          : view;
  return (
      <div className="ny-app">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="ny-header">
          <div className="ny-header-inner">
            <button
              className="ny-brand"
              onClick={() => navigate("home")}
              aria-label="NativeYard home"
            >
              <Sprout />
              <span>
                NativeYard<small>GROW A LITTLE CLOSER TO NATURE</small>
              </span>
            </button>
            {user ? <PersonalHeaderNav user={user}
              active={view === "welcome" ? "home" : view === "explore" ? "explore" : view === "leaderboard" ? "leaderboard" : view === "team" ? "team" : contentView === "garden" || ["properties","analysis","scan","roadmap","compare"].includes(view) ? "yard" : null}
              onHome={()=>navigate("welcome")}
              onYard={()=>{setAreaId("");navigate("home");}}
              onLeaderboard={()=>navigate("leaderboard")}
              onExplore={()=>navigate("explore")}
              onTeam={isCurator(user) ? () => navigate("team") : undefined}
              onSettings={()=>navigate("profile")} onSignOut={()=>void signOut()} signingOut={signingOut} /> : (
              <nav aria-label="Main navigation">
                <button aria-current={view === "leaderboard" ? "page" : undefined} onClick={()=>navigate("leaderboard")}>Leaderboard</button>
                <button aria-current={view === "explore" ? "page" : undefined} onClick={()=>navigate("explore")}>Flora Catalog</button>
                <button aria-current={view === "examples" ? "page" : undefined} onClick={()=>navigate("examples")}>Examples</button>
<>
                  <button
                    onClick={() => {
                      if (view !== "home") navigate("home");
                      setTimeout(
                        () =>
                          document
                            .getElementById("how")
                            ?.scrollIntoView({ behavior: "smooth" }),
                        100,
                      );
                    }}
                  >
                    How it works
                  </button>
                  <button
                    className="nav-signin"
                    onClick={() => navigate("signin")}
                  >
                    Sign in / create profile <span>↗</span>
                  </button>
                </>
              </nav>
            )}
          </div>
        </header>
        {uploadError && uploadErrorNotice && <SaveToast
          variant="error"
          message={`Photo upload failed: ${uploadError}`}
          onDismiss={() => setUploadErrorNotice(false)}
        />}
        {saveNotice && <SaveToast message={saveNotice} onDismiss={() => setSaveNotice("")} />}
        {signOutChoice && (
          <div className="unsaved-backdrop">
            <section
              className="unsaved-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="unsaved-title"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSignOutChoice(false);
                if (e.key === "Tab") {
                  const controls = [
                    ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button:not(:disabled)",
                    ),
                  ];
                  const first = controls[0],
                    last = controls.at(-1);
                  if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                  }
                }
              }}
            >
              <h2 id="unsaved-title">Save your survey before signing out?</h2>
              <p>
                Save keeps your changes in the selected area. Discard signs out
                and clears this account’s local draft. Cancel returns to your
                work.
              </p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    await save();
                    const current = surveyRef.current;
                    if (current?.photoPath && !current.revision)
                      await signOut(true);
                  }}
                >
                  Save, then sign out
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void signOut(true)}
                >
                  Discard and sign out
                </button>
                <button
                  className="secondary"
                  autoFocus
                  onClick={() => setSignOutChoice(false)}
                >
                  Cancel
                </button>
              </div>
            </section>
          </div>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className={`ny-container ${contentView === "home" ? "home-container" : ""}`}
        >
          {message && (
            <div className="global-message" role="status">
              <span>{message}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {saveError && contentView !== "analysis" && <p role="alert">{saveError} Your survey is still here. Retry saving after checking the selected property and yard area.</p>}
          {!ready ? (
            <div className="loading-state">
              <LoaderCircle className="spin" /> Opening your garden…
            </div>
          ) : (
            <>
              {(view === "examples" || sampleSurvey) && (
                <nav aria-label="Example navigation" className="garden-breadcrumbs">
                  <button className="text-button" onClick={() => navigate("examples")}>
                    Examples
                  </button>
                  {sampleSurvey && <span>/ {sampleYardById(sampleSurvey.sampleId)?.title || "Illustrative garden"}</span>}
                </nav>
              )}
              {user && !sampleSurvey && !["home", "welcome", "examples", "explore", "team", "leaderboard"].includes(view) && (
                <nav aria-label="Breadcrumb" className="garden-breadcrumbs">
                  <button
                    className="text-button"
                    onClick={() => navigate("home")}
                  >
                    My garden
                  </button>
                  {currentProperty && (
                    <>
                      <span>/</span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setAreaId("");
                          setAreaTab("overview");
                          navigate("properties", false, {
                            property: propertyId,
                            tab: "overview",
                          });
                        }}
                      >
                        {currentProperty.name}
                      </button>
                    </>
                  )}
                  {selectedArea && (
                    <>
                      <span>/</span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setAreaTab("overview");
                          navigate("properties", false, {
                            property: propertyId,
                            area: areaId,
                            tab: "overview",
                          });
                        }}
                      >
                        {selectedArea.name}
                      </button>
                    </>
                  )}
                  <span>
                    /{" "}
                    {view === "profile"
                      ? "Account"
                      : view === "analysis"
                        ? "Survey"
                        : view === "roadmap"
                          ? "Yard plan"
                          : view === "compare"
                            ? "Compare"
                            : "Observations"}
                  </span>
                </nav>
              )}
              {user &&
                selectedArea &&
                ["properties", "compare", "roadmap"].includes(view) && (
                  <nav aria-label="Area navigation" className="area-tabs">
                    {(
                      ["overview", "surveys", "compare", "roadmap"] as const
                    ).map((tab) => (
                      <button
                        key={tab}
                        aria-current={
                          tab === view ||
                          (view === "properties" && areaTab === tab)
                            ? "page"
                            : undefined
                        }
                        onClick={() => {
                          if (tab === "overview" || tab === "surveys") {
                            setAreaTab(tab);
                            navigate("properties", false, {
                              property: propertyId,
                              area: areaId,
                              tab,
                            });
                          } else navigate(tab);
                        }}
                      >
                        {
                          {
                            overview: "Overview",
                            surveys: "Surveys",
                            compare: "Compare",
                            roadmap: "Yard plan",
                          }[tab]
                        }
                      </button>
                    ))}
                  </nav>
                )}
              {user && !sampleSurvey && ["properties", "roadmap", "analysis"].includes(view) && (
                <details className="saved-scope-summary" open={view !== "analysis" || !survey?.photoPath ? true : undefined}>
                  <summary>{view === "analysis" && survey?.photoPath ? `Saved to ${currentProperty?.name || "your property"} / ${selectedArea?.name || "your yard area"} · View location` : "Property and yard area"}</summary>
                <Scope
                  properties={properties}
                  propertyId={propertyId}
                  areaId={areaId}
                  allAreas={view !== "analysis"}
                  locked={view === "analysis" && !!survey?.areaId}
                  onProperty={(id) => {
                    setPropertyId(id);
                    setLocationOverride(null);
                    setAreaId("");
                    navigate(view, false, { property: id });
                  }}
                  onArea={(id) => {
                    setAreaId(id);
                    navigate(view, false, { property: propertyId, area: id });
                  }}
                />
                </details>
              )}
              {user && planErrors[propertyId] && contentView!=="roadmap" && <aside className="auto-plan-feedback"><p>Your saved data is unchanged. {planErrors[propertyId]}</p><button className="secondary" onClick={retryPlan}>Retry automatic yard plan</button></aside>}
              {routeError && (
                <section role="alert">
                  <h1>{routeError.startsWith("This example") ? "That example is unavailable" : "That saved location is unavailable"}</h1>
                  <p>{routeError}</p>
                  <button onClick={() => navigate(routeError.startsWith("This example") ? "examples" : "home")}>
                    {routeError.startsWith("This example") ? "Choose another example" : "Back to My garden"}
                  </button>
                </section>
              )}
              {!routeError && contentView === "garden" && user && (
                <MyGarden
                  properties={properties}
                  propertyId={propertyId}
                  areaId={areaId}
                  surveys={surveys}
                  tasks={tasks}
                  displayName={user.user_metadata?.full_name ?? undefined}
                  onSelectProperty={(id) => {
                    setPropertyId(id);
                    setAreaId("");
                  }}
                  onOpenArea={(p, a) => {
                    setAreaTab("overview");
                    setPropertyId(p);
                    setAreaId(a);
                    navigate("properties", false, {
                      property: p,
                      area: a,
                      tab: "overview",
                    });
                  }}
                  onOpenSurvey={open}
                  onAddPhoto={(_p, a) => scanArea(a)}
                  onOpenPlan={(p, a) => {
                    setPropertyId(p);
                    setAreaId(a || "");
                    navigate("roadmap", false, { property: p, area: a });
                  }}
                  onAddProperty={() => {
                    setCreationMode("property");
                    navigate("properties");
                  }}
                  onAddArea={(p) => {
                    setPropertyId(p);
                    setCreationMode("area");
                    navigate("properties", false, { property: p });
                  }}
                />
              )}
              {!routeError && contentView === "compare" && user && (
                <ObservationCompare
                  key={`${user.id}/${areaId}/${pair.before}/${pair.after}`}
                  surveys={propertySurveys.filter((s) => s.areaId === areaId)}
                  beforeId={pair.before}
                  afterId={pair.after}
                  reviewerId={user.id}
                  onPair={(before, after) => {
                    setPair({ before, after });
                    navigate("compare", false, {
                      property: propertyId,
                      area: areaId,
                      before,
                      after,
                    });
                  }}
                  onOpen={open}
                  onSaveEvidence={async (saved, evidence) => {
                    const generation = identity.current.generation,
                      ownerId = identity.current.ownerId;
                    if (!ownerId || !saved.areaId)
                      throw new Error("Sign in first");
                    await services.account.saveSurvey(
                      {
                        ...saved,
                        comparisonEvidenceHistory: [
                          ...(saved.comparisonEvidenceHistory || []),
                          evidence,
                        ],
                      },
                      saved.areaId,
                      ownerId,
                    );
                    await refresh(generation);
                  }}
                />
              )}
              {contentView === "examples" && <SampleGallery onExample={example} />}
              {contentView === "explore" && (
                <PlantCatalogView
                  user={user}
                  onBack={() => navigate(user ? "home" : "welcome")}
                  onOpenTeam={() => navigate("team")}
                />
              )}
              {contentView === "leaderboard" && (
                <LeaderboardView
                  user={user}
                  properties={properties}
                  surveys={surveys}
                  onNavigateHome={() => navigate(user ? "home" : "welcome")}
                />
              )}
              {contentView === "home" && (
                <JourneyHome
                  accountsAvailable={capabilities.accounts}
                  signedIn={!!user}
                  onScan={beginScan}
                  onExample={example}
                  onExamples={() => navigate("examples")}
                  onSignIn={() => navigate(user ? "properties" : "signin")}
                />
              )}
              {contentView === "scan" && (
                <section className="scan-page">
                  <p className="eyebrow">
                    ONE PLANT. A GARDEN BED. YOUR WHOLE YARD.
                  </p>
                  <h1>What’s growing out there?</h1>
                  <p className="intro">
                    Start with a well-lit photo. We’ll mark plant regions so you
                    can explore and refine each match.
                  </p>
                  <div className="scan-card">
                    <Leaf size={35} />
                    <h2>Let’s take a closer look.</h2>
                    {user && !editingLocation ? (
                      <div
                        className="notice scan-location-summary"
                        aria-label="Scan location"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 14,
                          textAlign: "left",
                        }}
                      >
                        <span>
                          <strong>
                            {currentProperty
                              ? `${currentProperty.name}${selectedArea ? ` · ${selectedArea.name}` : ""}`
                              : "Saved profile location"}
                          </strong>
                          <small style={{ display: "block", marginTop: 4 }}>
                            ZIP {zip} ·{" "}
                            {currentProperty
                              ? "From this property’s saved location"
                              : "From your saved profile metadata"}
                          </small>
                        </span>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            setLocationOverride({
                              key: locationKey,
                              zip,
                              editing: true,
                            })
                          }
                        >
                          Change location
                        </button>
                      </div>
                    ) : (
                      <div className="scan-location-editor">
                        {user && (
                          <p className="micro">
                            {currentProperty
                              ? `${currentProperty.name}${selectedArea ? ` · ${selectedArea.name}` : ""}`
                              : "Location for this scan"}
                            {currentProperty && !isNjZip(currentProperty.zip)
                              ? " · This property needs a valid NJ ZIP."
                              : ""}
                          </p>
                        )}
                        <label className="zip-field">
                          New Jersey ZIP code
                          <input
                            value={zip}
                            inputMode="numeric"
                            maxLength={5}
                            disabled={busy}
                            onChange={(e) => editLocation(e.target.value)}
                          />
                        </label>
                        {user && (
                          <>
                            <p className="micro">
                              {detachedLocation
                                ? `This is a separate scan${currentProperty ? ` from ${currentProperty.name}` : ""}. Saving will ask where it belongs; stored property locations stay unchanged.`
                                : "This ZIP is for this scan. Saved locations stay unchanged."}
                            </p>
                            {isNjZip(savedLocationZip) &&
                              !activeLocationOverride?.elsewhere && (
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => setLocationOverride(null)}
                                >
                                  Use saved{" "}
                                  {currentProperty ? "yard" : "profile"} ZIP
                                </button>
                              )}
                          </>
                        )}
                      </div>
                    )}
                    {user && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => scanElsewhere()}
                      >
                        Scan somewhere else
                      </button>
                    )}
                    <fieldset className="scan-mode" disabled={busy}>
                      <legend>What are you scanning?</legend>
                      <label>
                        <input
                          type="radio"
                          name="scan-mode"
                          value="yard"
                          checked={scanMode === "yard"}
                          onChange={() => setScanMode("yard")}
                        />{" "}
                        Whole yard or garden bed
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="scan-mode"
                          value="plant"
                          checked={scanMode === "plant"}
                          onChange={() => setScanMode("plant")}
                        />{" "}
                        One plant
                      </label>
                    </fieldset>
                    <div className="actions">
                      <label
                        className="primary file-label"
                        aria-disabled={busy}
                      >
                        <Camera size={18} /> Take a photo
                        <input
                          type="file"
                          aria-label="Take a plant or yard photo"
                          aria-describedby={uploadError ? "photo-upload-error" : undefined}
                          aria-invalid={Boolean(uploadError)}
                          accept="image/*"
                          capture="environment"
                          disabled={busy}
                          onChange={(e) => {
                            if (e.target.files?.[0])
                              void analyze(e.target.files[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <label
                        className="secondary file-label"
                        aria-disabled={busy}
                      >
                        Upload a photo
                        <input
                          type="file"
                          aria-label="Upload a plant or yard photo"
                          aria-describedby={uploadError ? "photo-upload-error" : undefined}
                          aria-invalid={Boolean(uploadError)}
                          accept="image/*"
                          disabled={busy}
                          onChange={(e) => {
                            if (e.target.files?.[0])
                              void analyze(e.target.files[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {uploadError && (
                      <div id="photo-upload-error" className="upload-error">
                        <p><strong>Photo upload failed.</strong> {uploadError}</p>
                        <p className="micro">Selected photo: {uploadName}. Your scan settings are still here.</p>
                        {uploadFile && <button type="button" className="secondary" disabled={busy} onClick={() => void analyze(uploadFile)}>Retry this photo</button>}
                      </div>
                    )}
                    <p className="micro">
                      Up to 12 MB · JPEG, PNG, WebP · Use your camera’s
                      compatible JPEG format for best results.
                    </p>
                    {busy && (
                      <UploadProgress
                        phase={uploadPhase}
                        name={uploadName}
                        preview={uploadPreview}
                        onCancel={() => uploadController.current?.abort()}
                      />
                    )}
                    {!capabilities.vision && (
                      <p className="notice">
                        Live identification is temporarily unavailable. You can
                        explore the full review experience with the sample yard.
                      </p>
                    )}
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        document
                          .getElementById("examples")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Explore 3 sample yards →
                    </button>
                  </div>
                  <p className="micro">
                    Guest surveys stay in this browser unless you choose to save
                    them to your account. A temporary draft is kept for up to 24
                    hours to protect your work during sign-in.
                  </p>
                  <SampleGallery onExample={example} disabled={busy} />
                </section>
              )}
              {contentView === "analysis" &&
                (displayedSurvey ? (
                  <>
                    {displayedSurvey.source === "upload" && (
                      <CaptureContext
                        key={`context/${displayedSurvey.id}/${saveDestination}`}
                        survey={displayedSurvey}
                        previous={surveys}
                        actorId={user?.id || "guest"}
                        onChange={changeSurvey}
                      />
                    )}
                    <SurveyWorkspace
                      key={displayedSurvey.id}
                      survey={displayedSurvey}
                      onChange={(next) => {
                        if (currentIdentity(renderGeneration)) {
                          if (sampleSurvey) setSampleSurvey(next);
                          else changeSurvey(next);
                        }
                      }}
                      onScan={beginScan}
                      onSave={() => { if (!sampleSurvey) void save(); }}
                      onPlan={(from, to) => { if (!sampleSurvey) void plan(from, to); }}
                      signedIn={!!user}
                      accountsAvailable={capabilities.accounts}
                      busy={busy}
                      saveError={saveError}
                    />
                  </>
                ) : (
                  <div className="empty-state">
                    <h1>Start with a photo.</h1>
                    <button className="primary" onClick={beginScan}>
                      Scan a plant or yard
                    </button>
                  </div>
                ))}
              {contentView === "signin" && (
                <SignIn
                  returnToSurvey={
                    survey ? () => navigate("analysis") : undefined
                  }
                  configured={capabilities.google ?? capabilities.accounts}
                  emailConfigured={
                    !!capabilities.email &&
                    !!services.auth.sendEmailCode &&
                    !!services.auth.verifyEmailCode
                  }
                  emailDeliveryRestricted={capabilities.emailDeliveryRestricted}
                  qaConfigured={capabilities.qa}
                  onSendEmailCode={sendEmailCode}
                  onVerifyEmailCode={verifyEmailCode}
                  onSignIn={() => void signIn()}
                  onScan={beginScan}
                  busy={busy}
                />
              )}
              {contentView === "properties" &&
                user &&
                savingPending &&
                survey && (
                  <div className="notice">
                    <p>
                      Your survey is ready to save. Choose a yard area above or
                      add one below.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        selectedArea ? void save() : navigate("analysis")
                      }
                    >
                      {selectedArea
                        ? "Save survey to this area"
                        : "Return to my survey"}
                    </button>
                  </div>
                )}
              {contentView === "properties" && user && areaId && (
                <AreaBaseline
                  key={`${user.id}/${areaId}`}
                  areaId={areaId}
                  surveys={propertySurveys}
                  onOpen={open}
                />
              )}
              {contentView === "properties" && user && (currentProperty && selectedArea ? (
                <AreaOverview property={currentProperty} area={selectedArea} surveys={propertySurveys} tasks={tasks}
                  section={areaTab} onOpenSurvey={open} onUpload={()=>scanArea(selectedArea.id)}
                  onOpenPlan={()=>navigate("roadmap",false,{property:propertyId,area:areaId})}
                  onBack={()=>{setAreaId("");setAreaTab("overview");navigate("properties",false,{property:propertyId,tab:"overview"});}}
                  onSwitchArea={next=>{setAreaId(next);setAreaTab("overview");navigate("properties",false,{property:propertyId,area:next,tab:"overview"});}} />
              ) : (
                <PropertiesView
                  key={user.id}
                  section={areaTab}
                  initialAdding={creationMode}
                  onCompare={() => navigate("compare")}
                  properties={properties}
                  propertyId={propertyId}
                  areaId={areaId}
                  surveys={surveys}
                  onOpen={(saved) => {
                    if (currentIdentity(renderGeneration)) open(saved);
                  }}
                  onScan={beginScan}
                  onScanArea={(id) => {
                    if (currentIdentity(renderGeneration)) scanArea(id);
                  }}
                  onScopeCreated={scopedCreated}
                  onRoadmap={() => navigate("roadmap")}
                  onRefresh={scopedRefresh}
                  onError={accountError}
                  repository={services.account}
                />
              ))}
              {contentView === "roadmap" && user && (
                <RoadmapView
                  property={currentProperty}
                  planError={planErrors[propertyId]}
                  onRetry={retryPlan}
                  onScan={()=> areaId ? scanArea(areaId) : beginScan()}
                  surveys={propertySurveys}
                  onOpenSurvey={(saved) => {
                    if (currentIdentity(renderGeneration)) open(saved);
                  }}
                  key={`${user.id}/${propertyId}/${areaId}`}
                  propertyId={propertyId}
                  areaId={areaId}
                  tasks={tasks}
                  onRefresh={scopedRefresh}
                  onError={accountError}
                  repository={services.account}
                  busy={busy}
                />
              )}
              {contentView === "profile" && user && (
                <ProfileView
                  key={user.id}
                  user={user}
                  onRoadmap={() => navigate("roadmap")}
                  onProperties={() => navigate("home")}
                  onPublicHome={() => navigate("welcome")}
                  onSignOut={() => void signOut()}
                  onError={accountError}
                  repository={services.account}
                />
              )}
              {contentView === "team" && user && (
                <TeamManagementView
                  user={user}
                  onBack={() => navigate("home")}
                  onGoToCatalog={() => navigate("explore")}
                />
              )}
            </>
          )}
        </main>
        <footer className="ny-footer">
          <span>
            <Sprout size={16} /> NativeYard · Get curious. Grow native.
          </span>
          <span>Made for New Jersey</span>
          <PlantDisclaimer />
        </footer>
      </div>
  );
}

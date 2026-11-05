import {
  isFirebaseConfigured,
  getFirebaseDb,
  getFirebaseAuth,
} from "../firebase/client";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  setDoc,
} from "firebase/firestore";

export type AreaBaseline = {
  areaId: string;
  propertyId: string;
  baselineSurveyId: string | null;
};
export type AreaBaselineEvent = {
  id: string;
  area_id: string;
  property_id: string;
  owner_user_id: string;
  actor_user_id: string | null;
  actor_type: "owner" | "system";
  event_type: "selected" | "replaced" | "cleared";
  occurred_at: string;
  reason: string;
  before_survey_id: string | null;
  after_survey_id: string | null;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
};

export async function loadAreaBaseline(areaId: string): Promise<AreaBaseline> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Account baselines are not configured.");
  }
  const snap = await getDoc(doc(db, "yard_areas", areaId));
  if (!snap.exists()) {
    throw new Error(
      "The area baseline could not be loaded. Check the selected area and try again.",
    );
  }
  const data = snap.data();
  return {
    areaId: snap.id,
    propertyId: data.propertyId || data.property_id || "",
    baselineSurveyId: data.baseline_survey_id || data.baselineSurveyId || null,
  };
}

export async function loadBaselineEvents(
  areaId: string,
): Promise<AreaBaselineEvent[]> {
  const db = getFirebaseDb();
  if (!db) return [];

  const snap = await getDocs(
    query(collection(db, "ny_area_baseline_events"), where("area_id", "==", areaId)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as AreaBaselineEvent), id: d.id }));
}

export async function setAreaBaseline(
  areaId: string,
  surveyId: string | null,
  reason: string,
): Promise<void> {
  if (!reason.trim() || reason.trim().length > 1000)
    throw new Error("Give a reason of 1 to 1000 characters.");

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in to view or choose your area baseline.");
  }
  if (!db) {
    throw new Error("Account baselines are not configured.");
  }

  await updateDoc(doc(db, "yard_areas", areaId), {
    baseline_survey_id: surveyId,
  });

  const eventId = crypto.randomUUID();
  await setDoc(doc(db, "ny_area_baseline_events", eventId), {
    id: eventId,
    area_id: areaId,
    owner_user_id: user.uid,
    actor_user_id: user.uid,
    actor_type: "owner",
    event_type: surveyId ? "selected" : "cleared",
    occurred_at: new Date().toISOString(),
    reason: reason.trim(),
    after_survey_id: surveyId,
  });
}

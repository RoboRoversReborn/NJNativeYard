import { withScoreSnapshot, type Survey } from "../survey";
import { generateAutoYardPlan } from "../auto-yard-plan";
import {
  isFirebaseConfigured,
  getFirebaseDb,
  getFirebaseAuth,
  getFirebaseStorage,
} from "../firebase/client";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { updateProfile } from "firebase/auth";

export type Area = { id: string; property_id: string; name: string };
export type Property = {
  id: string;
  name: string;
  zip: string;
  address?: string;
  yard_areas: Area[];
};
export type RoadTask = {
  id: string;
  property_id: string;
  yard_area_id: string | null;
  title: string;
  notes: string;
  replacement_id: string | null;
  done: boolean;
  updated_at: string;
  created_at?: string;
  plan_year?: number | null;
  season?: "Spring" | "Summer" | "Autumn" | "Winter" | "Any season" | null;
  completed_at?: string | null;
  survey_id?: string | null;
  stage?: "Review" | "Plan" | "Do" | "Revisit" | null;
  auto_key?: string | null;
  due_start?: string | null;
  due_end?: string | null;
  source_details?: string | null;
};

export async function loadAccount(): Promise<{
  properties: Property[];
  surveys: Survey[];
  tasks: RoadTask[];
}> {
  if (!isFirebaseConfigured()) {
    return { properties: [], surveys: [], tasks: [] };
  }

  const auth = getFirebaseAuth();
  const firestore = getFirebaseDb();
  const storage = getFirebaseStorage();
  const user = auth?.currentUser;

  if (!user) {
    return { properties: [], surveys: [], tasks: [] };
  }
  if (!firestore || !storage) {
    throw new Error("Firebase database or storage is not configured.");
  }

  const [propsSnap, areasSnap, surveysSnap, tasksSnap] = await Promise.all([
    getDocs(query(collection(firestore, "properties"), where("userId", "==", user.uid))),
    getDocs(query(collection(firestore, "yard_areas"), where("userId", "==", user.uid))),
    getDocs(query(collection(firestore, "ny_surveys"), where("userId", "==", user.uid))),
    getDocs(query(collection(firestore, "ny_roadmap_tasks"), where("userId", "==", user.uid))),
  ]);

  const areasByProperty = new Map<string, Area[]>();
  for (const d of areasSnap.docs) {
    const data = d.data();
    const propertyId = data.propertyId || data.property_id || "";
    const area: Area = {
      id: d.id,
      property_id: propertyId,
      name: data.name || "",
    };
    const list = areasByProperty.get(propertyId) || [];
    list.push(area);
    areasByProperty.set(propertyId, list);
  }

  const properties: Property[] = propsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || "",
      zip: data.zip || "",
      address: data.address,
      yard_areas: areasByProperty.get(d.id) || [],
    };
  });

  const surveys: Survey[] = await Promise.all(
    surveysSnap.docs.map(async (d) => {
      const row = d.data();
      let photoUrl = row.photo_url || row.payload?.photo || "";
      if (!photoUrl && row.photo_path) {
        try {
          photoUrl = await getDownloadURL(ref(storage, row.photo_path));
        } catch {
          photoUrl = "";
        }
      }
      return {
        ...(row.payload || {}),
        id: d.id,
        areaId: row.yard_area_id || row.areaId || row.payload?.areaId,
        createdAt: row.created_at || row.payload?.createdAt,
        photoPath: row.photo_path || row.photoPath || row.payload?.photoPath,
        photo: photoUrl,
      } as Survey;
    }),
  );

  const tasks: RoadTask[] = tasksSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      property_id: data.property_id,
      yard_area_id: data.yard_area_id ?? null,
      title: data.title || "",
      notes: data.notes || "",
      replacement_id: data.replacement_id ?? null,
      done: Boolean(data.done),
      updated_at: data.updated_at || new Date().toISOString(),
      created_at: data.created_at,
      plan_year: data.plan_year ?? null,
      season: data.season ?? null,
      completed_at: data.completed_at ?? null,
      survey_id: data.survey_id ?? null,
      stage: data.stage ?? null,
      auto_key: data.auto_key ?? null,
      due_start: data.due_start ?? null,
      due_end: data.due_end ?? null,
      source_details: data.source_details ?? null,
    };
  });

  return { properties, surveys, tasks };
}

export async function addProperty(
  name: string,
  zip: string,
  id = crypto.randomUUID(),
) {
  name = name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter a property name of 1–100 characters.");
  if (!/^0[78]\d{3}$/.test(zip))
    throw new Error("Enter a New Jersey ZIP code.");

  const auth = getFirebaseAuth();
  const firestore = getFirebaseDb();
  const user = auth?.currentUser;
  if (!user) throw new Error("Please sign in first.");
  if (!firestore) throw new Error("Firebase database not configured.");

  await setDoc(doc(firestore, "properties", id), {
    id,
    userId: user.uid,
    name,
    zip,
    created_at: new Date().toISOString(),
  }, { merge: true });
  return id;
}

export async function addArea(
  propertyId: string,
  name: string,
  id = crypto.randomUUID(),
) {
  name = name.trim();
  if (!propertyId || !name || name.length > 100)
    throw new Error(
      "Select a property and enter an area name of 1–100 characters.",
    );

  const auth = getFirebaseAuth();
  const firestore = getFirebaseDb();
  const user = auth?.currentUser;
  if (!user) throw new Error("Please sign in first.");
  if (!firestore) throw new Error("Firebase database not configured.");

  await setDoc(doc(firestore, "yard_areas", id), {
    id,
    propertyId,
    userId: user.uid,
    name,
    created_at: new Date().toISOString(),
  }, { merge: true });
  return id;
}

export async function saveSurvey(
  survey: Survey,
  areaId: string,
  expectedOwnerId?: string,
) {
  if (survey.areaId && survey.areaId !== areaId)
    throw new Error(
      "This survey belongs to another yard area. Open that area to save your review.",
    );

  const auth = getFirebaseAuth();
  const firestore = getFirebaseDb();
  const storage = getFirebaseStorage();
  let user: { uid: string } | null | undefined = auth?.currentUser;

  if (!user) {
    try {
      const { createClient } = await import("./client.js");
      const client = createClient();
      if (client) {
        const { data } = await client.auth.getUser();
        if (data?.user) {
          user = { uid: data.user.id };
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!user) throw new Error("Sign in to save.");
  if (expectedOwnerId && user.uid !== expectedOwnerId)
    throw new Error(
      "Your account changed before saving. Return to your own survey and try again.",
    );
  if (!areaId) throw new Error("Select a yard area before saving.");
  if (!firestore || !storage)
    throw new Error("Firebase database or storage not configured.");

  let photoPath = survey.photoPath;
  const cleanPath = photoPath ? photoPath.replace(/^\/+/, "") : "";
  if (cleanPath && !cleanPath.startsWith(`surveys/${user.uid}/`) && !cleanPath.startsWith(`${user.uid}/`))
    throw new Error("This saved photo belongs to another account.");

  let photoUrl = survey.photo;
  if (!photoPath) {
    const photoResponse = await fetch(survey.photo);
    if (!photoResponse.ok) throw new Error("Survey photo could not be read.");
    const blob = await photoResponse.blob();
    photoPath = `${user.uid}/${survey.id}.jpg`;
    const storageRef = ref(storage, photoPath);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    photoUrl = await getDownloadURL(storageRef);
  }

  survey = withScoreSnapshot({ ...survey, savedAt: new Date().toISOString() });
  const {
    photo: _photo,
    photoPath: _path,
    revision: _revision,
    ...payload
  } = survey;
  void _photo;
  void _path;
  void _revision;

  await setDoc(doc(firestore, "ny_surveys", survey.id), {
    id: survey.id,
    yard_area_id: areaId,
    userId: user.uid,
    photo_path: photoPath,
    photo_url: photoUrl,
    payload: {
      ...payload,
      photo: photoUrl,
      photoPath,
      areaId,
    },
    created_at: survey.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { merge: true });

  return { ...survey, areaId, photoPath, photo: photoUrl, revision: undefined };
}

export async function putTask(
  task: Omit<RoadTask, "id" | "updated_at"> & { id?: string },
) {
  if (!task.property_id || !task.title.trim())
    throw new Error("Choose a property and enter a task title.");
  if (
    task.plan_year != null &&
    (!Number.isInteger(task.plan_year) ||
      task.plan_year < 2000 ||
      task.plan_year > 2200)
  )
    throw new Error("Choose a valid plan year.");
  if (task.stage != null && !["Review", "Plan", "Do", "Revisit"].includes(task.stage))
    throw new Error("Choose Review, Plan, Do or Revisit as the task stage.");

  const auth = getFirebaseAuth();
  const firestore = getFirebaseDb();
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in to save tasks.");
  if (!firestore) throw new Error("Firebase database not configured.");

  const id = task.id || crypto.randomUUID();
  await setDoc(doc(firestore, "ny_roadmap_tasks", id), {
    id,
    property_id: task.property_id,
    yard_area_id: task.yard_area_id ?? null,
    userId: user.uid,
    title: task.title.trim(),
    notes: task.notes || "",
    replacement_id: task.replacement_id ?? null,
    done: Boolean(task.done),
    plan_year: task.plan_year ?? null,
    stage: task.stage ?? null,
    season: task.season ?? null,
    survey_id: task.survey_id ?? null,
    completed_at: task.done ? (task.completed_at ?? new Date().toISOString()) : null,
    ...(task.auto_key !== undefined ? { auto_key: task.auto_key } : {}),
    ...(task.due_start !== undefined ? { due_start: task.due_start } : {}),
    ...(task.due_end !== undefined ? { due_end: task.due_end } : {}),
    ...(task.source_details !== undefined ? { source_details: task.source_details } : {}),
    updated_at: new Date().toISOString(),
    created_at: task.created_at || new Date().toISOString(),
  }, { merge: true });
}

export async function ensureAutoYardPlan(propertyId: string, now = new Date()): Promise<RoadTask[]> {
  const account = await loadAccount();
  const property = account.properties.find(p => p.id === propertyId);
  if (!property) throw new Error("Choose a property owned by this account.");
  const generated = generateAutoYardPlan(property, account.surveys, now);

  const auth = getFirebaseAuth();
  const firestore = getFirebaseDb();
  const user = auth?.currentUser;
  if (!user || !firestore) throw new Error("Account storage is not configured.");

  const existingKeys = new Set(
    account.tasks
      .filter(t => t.property_id === propertyId && t.auto_key)
      .map(t => t.auto_key)
  );

  for (const item of generated) {
    if (item.auto_key && !existingKeys.has(item.auto_key)) {
      const id = crypto.randomUUID();
      await setDoc(doc(firestore, "ny_roadmap_tasks", id), {
        ...item,
        id,
        userId: user.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }
  }

  const updatedAccount = await loadAccount();
  return updatedAccount.tasks.filter(t => t.property_id === propertyId);
}

export async function saveProfile(
  fullName: string,
) {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in first.");
  await updateProfile(user, { displayName: fullName });
}

export async function renameProperty(id: string, name: string) {
  name = name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter a property name of 1–100 characters.");

  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Firebase database not configured.");
  await updateDoc(doc(firestore, "properties", id), { name });
}

export async function renameArea(id: string, name: string) {
  name = name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter an area name of 1–100 characters.");

  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Firebase database not configured.");
  await updateDoc(doc(firestore, "yard_areas", id), { name });
}

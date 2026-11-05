import { createClient } from "./client";
import { withScoreSnapshot, type Survey } from "../survey";
import { generateAutoYardPlan } from "../auto-yard-plan";
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
const db = () => {
  const client = createClient();
  if (!client) throw new Error("Account storage is not configured.");
  return client;
};
export async function loadAccount() {
  const client = db();
  const [p, s, t] = await Promise.all([
    client
      .from("properties")
      .select("id,name,zip,address,yard_areas(id,property_id,name)")
      .order("created_at"),
    client
      .from("ny_surveys")
      .select("*")
      .order("created_at", { ascending: false }),
    client.from("ny_roadmap_tasks").select("*").order("created_at"),
  ]);
  for (const r of [p, s, t])
    if (r.error)
      throw new Error(
        "Account storage could not be loaded. Verify the Supabase connection and apply supabase/schema.sql.",
      );
  const surveys = await Promise.all(
    (s.data || []).map(async (row) => {
      const { data, error: photoError } = await client.storage
        .from("nativeyard-surveys")
        .createSignedUrl(row.photo_path, 3600);
      return {
        ...row.payload,
        id: row.id,
        areaId: row.yard_area_id,
        createdAt: row.created_at,
        photoPath: row.photo_path,
        photo: photoError ? "" : data?.signedUrl || "",
      } as Survey;
    }),
  );
  return {
    properties: p.data as Property[],
    surveys,
    tasks: t.data as RoadTask[],
  };
}
export async function addProperty(
  name: string,
  zip: string,
  id = crypto.randomUUID(),
) {
  const client = db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Please sign in first.");
  name = name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter a property name of 1–100 characters.");
  if (!/^0[78]\d{3}$/.test(zip))
    throw new Error("Enter a New Jersey ZIP code.");
  const { data, error } = await client
    .from("properties")
    .upsert({ id, user_id: user.id, name, zip }, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
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
  const { data, error } = await db()
    .from("yard_areas")
    .upsert({ id, property_id: propertyId, name }, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
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
  const client = db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Sign in to save.");
  if (expectedOwnerId && user.id !== expectedOwnerId)
    throw new Error(
      "Your account changed before saving. Return to your own survey and try again.",
    );
  let photoPath = survey.photoPath;
  if (photoPath && !photoPath.startsWith(`${user.id}/`))
    throw new Error("This saved photo belongs to another account.");
  if (!areaId) throw new Error("Select a yard area before saving.");
  if (!photoPath) {
    const photoResponse = await fetch(survey.photo);
    if (!photoResponse.ok) throw new Error("Survey photo could not be read.");
    const blob = await photoResponse.blob();
    photoPath = `${user.id}/${survey.id}.jpg`;
    const { error } = await client.storage
      .from("nativeyard-surveys")
      .upload(photoPath, blob, { contentType: "image/jpeg", upsert: true });
    if (error)
      throw new Error(
        "Photo could not be saved. Check the private storage bucket and its access policies.",
      );
  }
  survey = withScoreSnapshot({...survey,savedAt:new Date().toISOString()});
  const {
    photo: _photo,
    photoPath: _path,
    revision: _revision,
    ...payload
  } = survey;
  void _photo;
  void _path;
  void _revision;
  const { error } = await client.from("ny_surveys").upsert({
    id: survey.id,
    yard_area_id: areaId,
    photo_path: photoPath,
    payload,
    created_at: survey.createdAt,
    updated_at: new Date().toISOString(),
  });
  if (error)
    throw new Error("Survey could not be saved. Check database setup.");
  return { ...survey, areaId, photoPath, revision: undefined };
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
  const { error } = await db()
    .from("ny_roadmap_tasks")
    .upsert({
      id: task.id || crypto.randomUUID(),
      property_id: task.property_id,
      yard_area_id: task.yard_area_id,
      title: task.title.trim(),
      notes: task.notes,
      replacement_id: task.replacement_id,
      done: task.done,
      plan_year: task.plan_year ?? null,
      stage: task.stage ?? null,
      season: task.season ?? null,
      survey_id: task.survey_id ?? null,
      completed_at: task.done ? (task.completed_at ?? null) : null,
      ...(task.auto_key !== undefined ? { auto_key: task.auto_key } : {}),
      ...(task.due_start !== undefined ? { due_start: task.due_start } : {}),
      ...(task.due_end !== undefined ? { due_end: task.due_end } : {}),
      ...(task.source_details !== undefined ? { source_details: task.source_details } : {}),
      updated_at: new Date().toISOString(),
    });
  if (error)
    throw new Error(
      "Task could not be saved. Check the selected scope and account database setup.",
    );
}
/** RLS-scoped ordinary user client; duplicates never rewrite task edits or completion history. */
export async function ensureAutoYardPlan(propertyId: string, now = new Date()): Promise<RoadTask[]> {
  const account = await loadAccount();
  const property = account.properties.find(p => p.id === propertyId);
  if (!property) throw new Error("Choose a property owned by this account.");
  const generated = generateAutoYardPlan(property, account.surveys, now);
  const client = db();
  if (generated.length) {
    const { error } = await client.from("ny_roadmap_tasks").upsert(generated, { onConflict: "property_id,auto_key", ignoreDuplicates: true });
    if (error) throw new Error("The automatic yard plan could not be saved. Check the account database migration.");
  }
  const { data, error } = await client.from("ny_roadmap_tasks").select("*").eq("property_id", propertyId).order("created_at");
  if (error) throw new Error("The automatic yard plan could not be loaded.");
  return data as RoadTask[];
}
export async function saveProfile(
  fullName: string,
) {
  const client = db();
  const { error } = await client.auth.updateUser({
    data: {
      full_name: fullName,
    },
  });
  if (error) throw error;
}

export async function renameProperty(id: string, name: string) {
  name = name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter a property name of 1–100 characters.");
  const { error } = await db()
    .from("properties")
    .update({ name })
    .eq("id", id)
    .select("id")
    .single();
  if (error)
    throw new Error(
      "Property could not be renamed. Check your access and connection.",
    );
}
export async function renameArea(id: string, name: string) {
  name = name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter an area name of 1–100 characters.");
  const { error } = await db()
    .from("yard_areas")
    .update({ name })
    .eq("id", id)
    .select("id")
    .single();
  if (error)
    throw new Error(
      "Yard area could not be renamed. Check your access and connection.",
    );
}

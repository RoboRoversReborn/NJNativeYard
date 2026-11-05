import { createClient } from "./client";
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
async function signedInClient() {
  const client = createClient();
  if (!client) throw new Error("Account baselines are not configured.");
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new Error("Sign in to view or choose your area baseline.");
  return client;
}
export async function loadAreaBaseline(areaId: string): Promise<AreaBaseline> {
  const client = await signedInClient();
  const { data, error } = await client
    .from("yard_areas")
    .select("id,property_id,baseline_survey_id")
    .eq("id", areaId)
    .single();
  if (error || !data)
    throw new Error(
      "The area baseline could not be loaded. Check the selected area and try again.",
    );
  return {
    areaId: data.id,
    propertyId: data.property_id,
    baselineSurveyId: data.baseline_survey_id,
  };
}
export async function loadBaselineEvents(
  areaId: string,
): Promise<AreaBaselineEvent[]> {
  const client = await signedInClient();
  const { data, error } = await client
    .from("ny_area_baseline_events")
    .select(
      "id,area_id,property_id,owner_user_id,actor_user_id,actor_type,event_type,occurred_at,reason,before_survey_id,after_survey_id,before_state,after_state",
    )
    .eq("area_id", areaId)
    .order("occurred_at", { ascending: false });
  if (error)
    throw new Error(
      "Baseline history could not be loaded. Your selected baseline has not been changed.",
    );
  return (data || []) as AreaBaselineEvent[];
}
export async function setAreaBaseline(
  areaId: string,
  surveyId: string | null,
  reason: string,
): Promise<void> {
  if (!reason.trim() || reason.trim().length > 1000)
    throw new Error("Give a reason of 1 to 1000 characters.");
  const client = await signedInClient();
  const { error } = await client.rpc("ny_set_area_baseline", {
    p_area_id: areaId,
    p_survey_id: surveyId,
    p_reason: reason.trim(),
  });
  if (error)
    throw new Error(
      "Baseline could not be saved. Choose a real uploaded photo from this area and try again.",
    );
}

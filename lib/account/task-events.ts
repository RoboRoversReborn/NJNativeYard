import { createClient } from "./client";
import type { RoadTask } from "./repository";
export type TaskStage = "Review" | "Plan" | "Do" | "Revisit";
export type TaskStateSnapshot = RoadTask & { stage?: TaskStage | null };
export type TaskEvent = {
  id: string;
  task_id: string;
  property_id: string;
  yard_area_id: string | null;
  owner_user_id: string;
  actor_user_id: string | null;
  actor_type: "owner" | "system";
  event_type: "created" | "completed" | "reopened" | "edited";
  occurred_at: string;
  changed_fields: string[];
  before_state: TaskStateSnapshot | null;
  after_state: TaskStateSnapshot;
};
export async function loadTaskEvents(
  propertyId: string,
  taskId?: string,
): Promise<TaskEvent[]> {
  if (!propertyId) return [];
  const client = createClient();
  if (!client) throw new Error("Account history is not configured.");
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) throw new Error("Sign in to view your task history.");
  let query = client
    .from("ny_task_events")
    .select(
      "id,task_id,property_id,yard_area_id,owner_user_id,actor_user_id,actor_type,event_type,occurred_at,changed_fields,before_state,after_state",
    )
    .eq("property_id", propertyId)
    .order("occurred_at", { ascending: false });
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error)
    throw new Error(
      "Task history could not be loaded. Your saved tasks have not been changed; try again.",
    );
  return (data || []) as TaskEvent[];
}
export function taskEventLabel(
  event: Pick<TaskEvent, "event_type" | "changed_fields">,
): string {
  if (event.event_type === "created") return "Task created";
  if (event.event_type === "completed") return "Marked complete";
  if (event.event_type === "reopened") return "Completion undone";
  if (event.changed_fields.length === 1 && event.changed_fields[0] === "notes")
    return "Notes edited";
  if (event.changed_fields.length === 1 && event.changed_fields[0] === "stage")
    return "Stage changed";
  return "Task edited";
}

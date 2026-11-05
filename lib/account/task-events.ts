import {
  isFirebaseConfigured,
  getFirebaseDb,
  getFirebaseAuth,
} from "../firebase/client";
import { collection, query, where, getDocs } from "firebase/firestore";
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

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in to view your task history.");
  if (!db) throw new Error("Account history is not configured.");

  const q = taskId
    ? query(
        collection(db, "ny_task_events"),
        where("property_id", "==", propertyId),
        where("task_id", "==", taskId),
      )
    : query(
        collection(db, "ny_task_events"),
        where("property_id", "==", propertyId),
      );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as TaskEvent), id: d.id }));
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

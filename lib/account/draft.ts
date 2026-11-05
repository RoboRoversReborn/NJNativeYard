import type { Survey } from "../survey";

type DraftEnvelope = { survey: Survey; expires: number; ownerId?: string };
const privateSurvey = (survey?: Survey) =>
  !!(survey?.areaId || survey?.photoPath);

async function store(
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest,
) {
  return new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open("nativeyard-drafts", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("drafts");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("drafts", mode);
      const req = work(tx.objectStore("drafts"));
      tx.oncomplete = () => {
        resolve(req.result);
        db.close();
      };
      tx.onerror = () => {
        reject(tx.error);
        db.close();
      };
      tx.onabort = () => {
        reject(tx.error || new Error("Draft storage cancelled."));
        db.close();
      };
    };
  });
}

export function keepDraft(survey: Survey, ownerId?: string) {
  if (privateSurvey(survey) && !ownerId)
    return Promise.reject(
      new Error("An account-owned draft requires its owner."),
    );
  return store("readwrite", (s) =>
    s.put(
      {
        survey,
        expires: Date.now() + 86400000,
        ...(ownerId ? { ownerId } : {}),
      },
      "pending",
    ),
  );
}

export async function readDraft(ownerId?: string): Promise<Survey | null> {
  let survey: Survey | null = null;
  await store("readwrite", (s) => {
    const req = s.get("pending");
    req.onsuccess = () => {
      const row = req.result as DraftEnvelope | undefined;
      if (!row) return;
      if (
        !row.survey ||
        typeof row.survey !== "object" ||
        typeof row.survey.photo !== "string" ||
        !Array.isArray(row.survey.plants) ||
        !Number.isFinite(row.expires) ||
        row.expires <= Date.now() ||
        (!row.ownerId && privateSurvey(row.survey))
      ) {
        s.delete("pending");
        return;
      }
      if (row.ownerId && row.ownerId !== ownerId) return;
      survey = row.survey;
    };
    return req;
  });
  return survey;
}

/** Identity cleanup preserves anonymous drafts; successful saves can clear their exact pending survey. */
export function clearDraft(ownerId?: string, surveyId?: string) {
  return store("readwrite", (s) => {
    const req = s.get("pending");
    req.onsuccess = () => {
      const row = req.result as DraftEnvelope | undefined;
      const matchesOwner =
        ownerId === undefined ||
        row?.ownerId === ownerId ||
        (row && !row.ownerId && (privateSurvey(row.survey) || !!surveyId));
      if (matchesOwner && (!surveyId || row?.survey.id === surveyId))
        s.delete("pending");
    };
    return req;
  });
}

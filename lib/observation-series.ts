import type { Survey } from "./survey";
import {
  compareObservations,
  comparisonFingerprint,
} from "./observation-comparison";
/** Contiguous comparable observations only. Unknown or mismatched rows break a series. */
export function comparableObservationSeries(surveys: Survey[]): Survey[][] {
  const rows = surveys
    .filter((s) => s.source === "upload")
    .sort((a, b) =>
      (a.capture?.capturedAt || a.createdAt).localeCompare(
        b.capture?.capturedAt || b.createdAt,
      ),
    );
  const series: Survey[][] = [];
  let current: Survey[] = [];
  for (const row of rows) {
    const before = current.at(-1);
    if (!before) {
      current = [row];
      continue;
    }
    const evidence = row.comparisonEvidenceHistory?.findLast(
      (e) =>
        e.beforeSurveyId === before.id &&
        e.afterSurveyId === row.id &&
        e.beforeFingerprint === comparisonFingerprint(before) &&
        e.afterFingerprint === comparisonFingerprint(row),
    );
    if (compareObservations(before, row, evidence).eligible) current.push(row);
    else {
      if (current.length >= 3) series.push(current);
      current = [row];
    }
  }
  if (current.length >= 3) series.push(current);
  return series;
}

/** datetime-local uses browser-local clock digits, not an ISO UTC substring. */
export function captureTimeInput(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Preserve an unchanged original instant, including seconds and DST-fold offset. */
export function captureTimeFromInput(
  value: string,
  original?: string,
): string | undefined {
  if (!value) return undefined;
  if (original && captureTimeInput(original) === value) return original;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Enter a valid local capture date.");
  return date.toISOString();
}

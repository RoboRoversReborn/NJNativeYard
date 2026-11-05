/** Keep observation notes, without repeating recognition-system boilerplate. */
export function plantDisplayNote(note?: string): string | undefined {
  if (!note) return undefined;
  const text = note.split(/(?<=[.!?;])\s+/).filter((part) =>
    !/cached google|initial AI|AI suggestion|visual suggestion|NJ.*catalog|provider|pipeline|prompt.version|model.version|not independently verified|authored.*plant|intended species/i.test(part),
  ).join(" ").trim();
  return text || undefined;
}

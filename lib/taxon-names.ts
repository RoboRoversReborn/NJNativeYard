/** Exact reference names only; never discard qualifiers or resolve a parent taxon. */
export function canonicalReferenceTaxon(name: string): string | undefined {
  const normalized = name.normalize("NFKC").trim()
    .replace(/×/g, " × ")
    .replace(/\s+/g, " ")
    .replace(/\bssp\./gi, "subsp.");
  const match = /^([a-z][a-z-]+) (?:(x|×) )?([a-z][a-z-]+)(?: (subsp\.|var\.) ([a-z][a-z-]+))?$/i.exec(normalized);
  if (!match) return undefined;
  const [, genus, hybrid, epithet, rank, infra] = match;
  // These placeholders describe an unresolved identity, not an exact species.
  if ([epithet, infra].some(part => part && /^(?:sp|spp|species|unknown|unidentified)$/i.test(part))) return undefined;
  return [genus[0].toUpperCase() + genus.slice(1).toLowerCase(), hybrid ? "×" : undefined,
    epithet.toLowerCase(), rank?.toLowerCase(), infra?.toLowerCase()].filter(Boolean).join(" ");
}

/** The ASCII hybrid marker matches classifier and catalog keys without losing it. */
export function referenceTaxonKey(name: string): string | undefined {
  return canonicalReferenceTaxon(name)?.toLowerCase().replace(/×/g, "x");
}

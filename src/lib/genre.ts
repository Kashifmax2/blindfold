/**
 * Genre helpers shared by the browser and the server.
 *
 * Nothing here is magic: an ID3 tag wins, otherwise we look for keywords in
 * the title/artist. The result is a suggestion the admin can still edit.
 */

const RULES: Array<[RegExp, string]> = [
  [/hip[- ]?hop|rap\b|trap\b|drill\b|grime/, "Hip-Hop"],
  [/edm|electro|house|techno|dubstep|drum ?(and|&) ?bass|dnb|trance|synth|garage|bass/, "Electronic"],
  [/r ?& ?b|rnb|soul|funk|motown/, "R&B"],
  [/lofi|lo-fi|chill|ambient|study|sleep|relax/, "Chill"],
  [/rock|metal|punk|grunge|indie|alternative/, "Rock"],
  [/jazz|blues|swing/, "Jazz"],
  [/classical|piano|orchestra|symphon|instrumental/, "Classical"],
  [/latin|reggaeton|salsa|bachata|cumbia/, "Latin"],
  [/bollywood|hindi|desi|punjabi|urdu|filmi|indian/, "Bollywood"],
  [/folk|country|acoustic|singer-songwriter/, "Folk"],
  [/pop\b|dance ?pop|k-?pop/, "Pop"],
];

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase())
    .trim();
}

/** A single ID3/`genre` value -> a tidy label. */
export function normaliseGenre(raw?: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  for (const [pattern, label] of RULES) {
    if (pattern.test(lower)) return label;
  }
  return titleCase(value) || null;
}

/**
 * Prefer the file's own genre tag; otherwise look for a keyword in the
 * title/artist. Returns null when there is nothing sensible to say.
 */
export function guessGenre(
  tags: Array<string | undefined | null>,
  ...text: Array<string | undefined | null>
): string | null {
  for (const tag of tags) {
    const clean = (tag ?? "").trim();
    // Numeric ID3 genre codes ("17") are not useful to a human.
    if (!clean || /^\d+$/.test(clean)) continue;
    const label = normaliseGenre(clean);
    if (label) return label;
  }

  const haystack = text
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();

  for (const [pattern, label] of RULES) {
    if (pattern.test(haystack)) return label;
  }
  return null;
}

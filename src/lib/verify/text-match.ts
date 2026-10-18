/**
 * Evaluates text presence in code using unicode NFKC normalization,
 * whitespace collapsing, and case-insensitivity.
 * The LLM only transcribes; CODE decides whether required text is present.
 */
export function normalizeTextForMatching(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function checkTextContainsInCode(
  transcribedText: string,
  requiredKeyword: string
): { found: boolean; normalizedObserved: string; normalizedTarget: string } {
  const normTranscribed = normalizeTextForMatching(transcribedText);
  const normTarget = normalizeTextForMatching(requiredKeyword);

  const found = normTranscribed.includes(normTarget);
  return {
    found,
    normalizedObserved: normTranscribed,
    normalizedTarget: normTarget,
  };
}


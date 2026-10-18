import { CriterionDefinition, SubmissionData, VerifierVerdict } from "./types";
import { evaluateDeterministicCriterion } from "./deterministic";
import { evaluateRubricCriterion } from "./llm";

export * from "./types";
export * from "./deterministic";
export * from "./llm";

/**
 * Run end-to-end verification across all acceptance criteria.
 * HARD RULE: Deterministic checks run in pure code; LLM cannot override them.
 */
export async function verifySubmission(
  criteriaList: CriterionDefinition[],
  submission: SubmissionData
): Promise<VerifierVerdict> {
  const perCriteriaResults = [];

  for (const crit of criteriaList) {
    if (crit.type === "deterministic") {
      const result = evaluateDeterministicCriterion(crit, submission);
      perCriteriaResults.push(result);
    } else {
      const result = await evaluateRubricCriterion(crit, submission);
      perCriteriaResults.push(result);
    }
  }

  // Calculate overall verdict
  const hardFailures = perCriteriaResults.filter((r) => r.isHardCheck && !r.passed);
  const softFailures = perCriteriaResults.filter((r) => !r.isHardCheck && !r.passed);

  const overallPassed = hardFailures.length === 0 && softFailures.length === 0;

  // Average confidence across all criteria
  const totalConfidence = perCriteriaResults.reduce((sum, r) => sum + r.confidence, 0);
  const avgConfidence = perCriteriaResults.length > 0 ? totalConfidence / perCriteriaResults.length : 0.0;

  // If hard failures exist, confidence is severely penalized
  const confidence = hardFailures.length > 0 ? Math.min(avgConfidence, 0.2) : avgConfidence;

  let reasoning = "";
  if (overallPassed) {
    reasoning = `All ${perCriteriaResults.length} criteria successfully satisfied.`;
  } else if (hardFailures.length > 0) {
    reasoning = `Failed ${hardFailures.length} mandatory hard criteria: ${hardFailures.map((f) => f.name).join(", ")}.`;
  } else {
    reasoning = `Failed ${softFailures.length} soft criteria: ${softFailures.map((f) => f.name).join(", ")}.`;
  }

  return {
    overallPassed,
    confidence: Number(confidence.toFixed(4)),
    reasoning,
    perCriteriaResults,
  };
}

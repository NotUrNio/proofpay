import { CriterionDefinition, CriterionEvaluation, SubmissionData } from "./types";
import imageSize from "image-size";

/**
 * Run deterministic code checks.
 * HARD RULE: These checks execute strictly in code. LLM can never override them.
 */
export function evaluateDeterministicCriterion(
  criterion: CriterionDefinition,
  submission: SubmissionData
): CriterionEvaluation {
  const spec = criterion.ruleSpec;
  const reasons: string[] = [];
  let passed = true;

  // 1. Dimensions check (e.g. 1080x1080)
  if (spec.width !== undefined || spec.height !== undefined) {
    let actualWidth = submission.imageDimensions?.width;
    let actualHeight = submission.imageDimensions?.height;

    // If buffer is available and dimensions not precalculated, inspect via image-size
    if ((!actualWidth || !actualHeight) && submission.fileBuffer) {
      try {
        const dimensions = imageSize(submission.fileBuffer);
        actualWidth = dimensions.width;
        actualHeight = dimensions.height;
      } catch (err) {
        passed = false;
        reasons.push("Could not parse image header dimensions");
      }
    }

    if (spec.width !== undefined && actualWidth !== spec.width) {
      passed = false;
      reasons.push(`Width mismatch: expected ${spec.width}px, got ${actualWidth ?? "unknown"}px`);
    }

    if (spec.height !== undefined && actualHeight !== spec.height) {
      passed = false;
      reasons.push(`Height mismatch: expected ${spec.height}px, got ${actualHeight ?? "unknown"}px`);
    }

    if (passed && spec.width && spec.height) {
      reasons.push(`Exact dimensions verified: ${spec.width}x${spec.height}px`);
    }
  }

  // 2. File size check (e.g. <= 2MB)
  if (spec.maxSizeBytes !== undefined) {
    const size = submission.fileSizeBytes ?? (submission.fileBuffer ? submission.fileBuffer.length : 0);
    if (size > spec.maxSizeBytes) {
      passed = false;
      reasons.push(
        `File size ${size} bytes exceeds maximum allowed ${spec.maxSizeBytes} bytes (${(
          spec.maxSizeBytes /
          (1024 * 1024)
        ).toFixed(1)}MB)`
      );
    } else {
      reasons.push(`File size ${size} bytes is within limit (${spec.maxSizeBytes} bytes)`);
    }
  }

  // 3. MIME type check (e.g. "image/png")
  if (spec.mimeType !== undefined) {
    if (submission.mimeType !== spec.mimeType) {
      passed = false;
      reasons.push(`MIME type mismatch: expected ${spec.mimeType}, got ${submission.mimeType ?? "unknown"}`);
    } else {
      reasons.push(`MIME type verified: ${spec.mimeType}`);
    }
  }

  // 4. Required keywords in submission text or extracted caption
  if (spec.requiredKeywords && spec.requiredKeywords.length > 0) {
    const text = (submission.textContent || "").toLowerCase();
    for (const kw of spec.requiredKeywords) {
      if (!text.includes(kw.toLowerCase())) {
        passed = false;
        reasons.push(`Missing required text: "${kw}"`);
      } else {
        reasons.push(`Found required text: "${kw}"`);
      }
    }
  }

  return {
    criterionId: criterion.id,
    name: criterion.name,
    isHardCheck: criterion.isHardCheck,
    passed,
    confidence: passed ? 1.0 : 0.0,
    reason: reasons.join("; "),
    evidence: reasons.join(", "),
  };
}

import { z } from "zod";

export const CriterionEvaluationSchema = z.object({
  criterionId: z.string(),
  name: z.string(),
  isHardCheck: z.boolean().default(true),
  passed: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  evidence: z.string().default(""),
});

export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;

export const VerifierVerdictSchema = z.object({
  overallPassed: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  perCriteriaResults: z.array(CriterionEvaluationSchema),
});

export type VerifierVerdict = z.infer<typeof VerifierVerdictSchema>;

export interface SubmissionData {
  textContent?: string;
  fileBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  imageDimensions?: { width: number; height: number };
}

export interface CriterionDefinition {
  id: string;
  name: string;
  type: "deterministic" | "llm_rubric";
  isHardCheck: boolean;
  ruleSpec: {
    width?: number;
    height?: number;
    mimeType?: string;
    maxSizeBytes?: number;
    requiredKeywords?: string[];
    rubricPrompt?: string;
  };
}

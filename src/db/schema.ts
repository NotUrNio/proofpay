import { pgTable, text, timestamp, boolean, numeric, jsonb, uuid, varchar, bigserial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. Jobs Table
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  clientEmail: varchar("client_email", { length: 255 }).notNull(),
  freelancerEmail: varchar("freelancer_email", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: varchar("status", { length: 50 }).default("CREATED").notNull(), // CREATED, FUNDED, SUBMITTED, VERIFYING, VERIFIED, SETTLED, DISPUTED, REJECTED, MANUAL_REVIEW
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Acceptance Criteria Table (deterministic or llm_rubric)
export const criteria = pgTable("criteria", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'deterministic' | 'llm_rubric'
  name: varchar("name", { length: 255 }).notNull(),
  ruleSpec: jsonb("rule_spec").notNull(), // JSON e.g. { width: 1080, height: 1080, mimeType: "image/png", maxSizeBytes: 2097152, requiredText: "SUMMER SALE" }
  isHardCheck: boolean("is_hard_check").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Submissions Table
export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  fileUrl: text("file_url"),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSizeBytes: numeric("file_size_bytes", { precision: 12, scale: 0 }),
  textContent: text("text_content"),
  metadata: jsonb("metadata").default({}), // width, height, hash, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. AI & Deterministic Verdicts Table
export const verdicts = pgTable("verdicts", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").references(() => submissions.id).notNull(),
  overallPassed: boolean("overall_passed").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0000 - 1.0000
  reasoning: text("reasoning").notNull(),
  perCriteriaResults: jsonb("per_criteria_results").notNull(), // [{ criterionId, passed, reason, confidence, evidence }]
  rawLlmOutput: jsonb("raw_llm_output"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Payment Mandates Table (Signed Intent Mandate)
export const mandates = pgTable("mandates", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  maxAmount: numeric("max_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  payeeEmail: varchar("payee_email", { length: 255 }).notNull(),
  scope: text("scope").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  signature: text("signature").notNull(), // HMAC-SHA256 signature
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Payments Table (Funding & Payouts)
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'FUNDING' | 'PAYOUT'
  paypalId: varchar("paypal_id", { length: 255 }), // Order ID, Capture ID, or Payout Item ID
  senderBatchId: varchar("sender_batch_id", { length: 255 }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'PENDING', 'COMPLETED', 'FAILED', 'BLOCKED', 'REFUNDED'
  isMock: boolean("is_mock").default(false).notNull(),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 7. System Policies Table
export const policies = pgTable("policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  maxDailyPayoutAmount: numeric("max_daily_payout_amount", { precision: 10, scale: 2 }).default("1000.00").notNull(),
  maxJobPayoutAmount: numeric("max_job_payout_amount", { precision: 10, scale: 2 }).default("500.00").notNull(),
  minConfidenceThreshold: numeric("min_confidence_threshold", { precision: 5, scale: 4 }).default("0.8500").notNull(),
  requireHumanReviewIfAmbiguous: boolean("require_human_review_if_ambiguous").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 8. Human Approvals Queue Table
export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  submissionId: uuid("submission_id").references(() => submissions.id).notNull(),
  policyId: uuid("policy_id").references(() => policies.id),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(), // 'PENDING', 'APPROVED', 'REJECTED'
  reason: text("reason").notNull(),
  reviewerEmail: varchar("reviewer_email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 9. Append-Only Audit Ledger Table
// HARD RULE: Only INSERT operations are allowed. No update or delete helpers.
export const ledgerEvents = pgTable("ledger_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceNumber: bigserial("sequence_number", { mode: "number" }),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(), // 'JOB_CREATED', 'JOB_FUNDED', 'WORK_SUBMITTED', 'VERIFICATION_COMPLETED', 'GUARD_EVALUATED', 'PAYOUT_INITIATED', 'PAYOUT_CONFIRMED', etc.
  previousState: varchar("previous_state", { length: 50 }),
  newState: varchar("new_state", { length: 50 }).notNull(),
  payload: jsonb("payload").notNull(),
  isMock: boolean("is_mock").default(false).notNull(),
  actor: varchar("actor", { length: 255 }).notNull(), // 'CLIENT', 'FREELANCER', 'VERIFIER', 'GUARD', 'PAYPAL_WEBHOOK', 'ADMIN'
  signatureOrHash: text("signature_or_hash"), // SHA256 integrity hash of prior event + current event
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. Idempotency Keys Table
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: varchar("key", { length: 255 }).primaryKey(),
  scope: varchar("scope", { length: 100 }).notNull(), // e.g. 'paypal_payout', 'paypal_order'
  responseHash: text("response_hash"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type Criterion = typeof criteria.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Verdict = typeof verdicts.$inferSelect;
export type Mandate = typeof mandates.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;

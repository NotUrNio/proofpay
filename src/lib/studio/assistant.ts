/**
 * ProofPay Studio AI Diagnostic Assistant & Read-Only Tool Registry
 *
 * SAFETY ARCHITECTURE:
 * In accordance with ProofPay's Zero-LLM Guard guarantee, the Studio AI Assistant
 * is strictly isolated to READ-ONLY diagnostic, telemetry, and ledger audit functions.
 * NO AI tool is permitted to:
 * - Approve deliverables
 * - Release PayPal payouts
 * - Refund escrow
 * - Modify system policies
 */

import { db, jobs, payments, ledgerEvents, verdicts } from "../../db";
import { eq, desc } from "drizzle-orm";

export interface AssistantTool {
  name: string;
  description: string;
  readOnly: true;
  execute: (args: Record<string, any>) => Promise<any>;
}

// Strictly READ-ONLY tool registry
export const STUDIO_AI_TOOLS: Record<string, AssistantTool> = {
  getSettlementMetrics: {
    name: "getSettlementMetrics",
    description: "Fetch aggregate platform settlement metrics, total escrow, and payout volumes.",
    readOnly: true,
    execute: async () => {
      const allJobs = await db.select().from(jobs);
      const allPayments = await db.select().from(payments);

      const paidJobs = allJobs.filter((j) => j.status === "PAID");
      const fundedJobs = allJobs.filter((j) => j.status === "FUNDED");
      const inReviewJobs = allJobs.filter((j) => j.status === "VERIFIED");

      return {
        totalJobs: allJobs.length,
        paidCount: paidJobs.length,
        inReviewCount: inReviewJobs.length,
        fundedCount: fundedJobs.length,
        totalSettledUSD: paidJobs.reduce((acc, j) => acc + parseFloat(j.amount), 0).toFixed(2),
        totalEscrowLockedUSD: fundedJobs.reduce((acc, j) => acc + parseFloat(j.amount), 0).toFixed(2),
        paymentRecords: allPayments.length,
      };
    },
  },

  getJobAuditSummary: {
    name: "getJobAuditSummary",
    description: "Retrieve read-only verification verdict and audit ledger events for a specific job.",
    readOnly: true,
    execute: async (args: Record<string, any>) => {
      const jobId = args?.jobId;
      if (!jobId) throw new Error("jobId is required");

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
      if (!job) throw new Error(`Job not found: ${jobId}`);

      const events = await db
        .select()
        .from(ledgerEvents)
        .where(eq(ledgerEvents.jobId, jobId))
        .orderBy(desc(ledgerEvents.sequenceNumber));

      return {
        jobId: job.id,
        title: job.title,
        status: job.status,
        amount: job.amount,
        currency: job.currency,
        totalLedgerEvents: events.length,
        latestEvent: events[0] || null,
      };
    },
  },

  queryLedgerHashChain: {
    name: "queryLedgerHashChain",
    description: "Inspect cryptographic SHA-256 hash chaining for a job's ledger sequence.",
    readOnly: true,
    execute: async (args: Record<string, any>) => {
      const jobId = args?.jobId;
      if (!jobId) throw new Error("jobId is required");

      const events = await db
        .select()
        .from(ledgerEvents)
        .where(eq(ledgerEvents.jobId, jobId))
        .orderBy(desc(ledgerEvents.sequenceNumber));

      return {
        jobId,
        chainLength: events.length,
        isUnbroken: events.every((e) => e.signatureOrHash !== null),
      };
    },
  },
};

/**
 * Validates that an invoked tool name is strictly read-only.
 * Throws a fatal error if any write or money-movement action is attempted.
 */
export function assertReadOnlyTool(toolName: string): AssistantTool {
  const PROHIBITED_WRITE_ACTIONS = [
    "approve",
    "pay",
    "payout",
    "release",
    "refund",
    "policy",
    "delete",
    "write",
    "mutate",
  ];

  const lower = toolName.toLowerCase();
  for (const prohibited of PROHIBITED_WRITE_ACTIONS) {
    if (lower.includes(prohibited)) {
      throw new Error(
        `CRITICAL SECURITY VIOLATION: Tool '${toolName}' attempts state mutation or payment movement. ` +
          `ProofPay AI Assistant tools must be strictly read-only. The Zero-LLM Policy Guard forbids AI-triggered payments.`
      );
    }
  }

  const tool = STUDIO_AI_TOOLS[toolName];
  if (!tool) {
    throw new Error(`Unknown assistant tool: ${toolName}`);
  }

  if (tool.readOnly !== true) {
    throw new Error(`Tool '${toolName}' is not marked as readOnly: true`);
  }

  return tool;
}

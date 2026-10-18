import { sql } from "drizzle-orm";
import { db } from "./index";

export async function ensureDatabaseSchema() {
  // Create all 10 tables if they do not exist
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      client_email VARCHAR(255) NOT NULL,
      freelancer_email VARCHAR(255) NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
      status VARCHAR(50) DEFAULT 'CREATED' NOT NULL, -- CREATED, FUNDED, SUBMITTED, VERIFYING, VERIFIED, SETTLED, DISPUTED, REJECTED, MANUAL_REVIEW
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS criteria (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) NOT NULL,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      rule_spec JSONB NOT NULL,
      is_hard_check BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) NOT NULL,
      file_url TEXT,
      mime_type VARCHAR(100),
      file_size_bytes NUMERIC(12, 0),
      text_content TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS verdicts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id UUID REFERENCES submissions(id) NOT NULL,
      overall_passed BOOLEAN NOT NULL,
      confidence NUMERIC(5, 4) NOT NULL,
      reasoning TEXT NOT NULL,
      per_criteria_results JSONB NOT NULL,
      raw_llm_output JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS mandates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) NOT NULL,
      max_amount NUMERIC(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
      payee_email VARCHAR(255) NOT NULL,
      scope TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      signature TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) NOT NULL,
      type VARCHAR(20) NOT NULL,
      paypal_id VARCHAR(255),
      sender_batch_id VARCHAR(255),
      amount NUMERIC(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
      status VARCHAR(50) NOT NULL,
      is_mock BOOLEAN DEFAULT false NOT NULL,
      raw_response JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      max_daily_payout_amount NUMERIC(10, 2) DEFAULT 1000.00 NOT NULL,
      max_job_payout_amount NUMERIC(10, 2) DEFAULT 500.00 NOT NULL,
      min_confidence_threshold NUMERIC(5, 4) DEFAULT 0.8500 NOT NULL,
      require_human_review_if_ambiguous BOOLEAN DEFAULT true NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) NOT NULL,
      submission_id UUID REFERENCES submissions(id) NOT NULL,
      policy_id UUID REFERENCES policies(id),
      status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
      reason TEXT NOT NULL,
      reviewer_email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS ledger_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      previous_state VARCHAR(50),
      new_state VARCHAR(50) NOT NULL,
      payload JSONB NOT NULL,
      is_mock BOOLEAN DEFAULT false NOT NULL,
      actor VARCHAR(255) NOT NULL,
      signature_or_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS idempotency_keys (
      key VARCHAR(255) PRIMARY KEY,
      scope VARCHAR(100) NOT NULL,
      response_hash TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    `CREATE OR REPLACE FUNCTION prevent_ledger_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'APPEND-ONLY VIOLATION: ledger_events rows cannot be updated, deleted, or truncated';
    END;
    $$ LANGUAGE plpgsql;`,
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_ledger_update_delete'
      ) THEN
        CREATE TRIGGER trg_prevent_ledger_update_delete
        BEFORE UPDATE OR DELETE ON ledger_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_ledger_modification();
      END IF;
    END $$;`,
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_ledger_truncate'
      ) THEN
        CREATE TRIGGER trg_prevent_ledger_truncate
        BEFORE TRUNCATE ON ledger_events
        FOR EACH STATEMENT
        EXECUTE FUNCTION prevent_ledger_modification();
      END IF;
    END $$;`
  ];

  for (const statement of ddlStatements) {
    await db.execute(sql.raw(statement));
  }
}

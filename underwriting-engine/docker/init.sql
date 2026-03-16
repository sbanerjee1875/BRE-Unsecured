-- ============================================================
-- docker/init.sql — Underwriting Engine Database Schema
-- ============================================================

-- ── Audit Log Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id            UUID PRIMARY KEY,
  application_id      VARCHAR(100) NOT NULL,
  decision            VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVE','DECLINE','REFER')),
  total_score         INTEGER,
  score_band          VARCHAR(20),
  bureau_score        INTEGER,
  bureau_behaviour    INTEGER,
  income_foir         INTEGER,
  employer_demo       INTEGER,
  alternate_behav     INTEGER,
  fraud_risk          INTEGER,
  hard_gates_json     JSONB,
  soft_flags_json     JSONB,
  api_call_log_json   JSONB,
  masked_pan          VARCHAR(20),
  masked_mobile       VARCHAR(20),
  channel_id          VARCHAR(20),
  processing_time_ms  INTEGER,
  engine_version      VARCHAR(20),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_application_id ON audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_decision ON audit_logs(decision);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- ── Applications Table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  application_id      VARCHAR(100) PRIMARY KEY,
  channel             VARCHAR(20) NOT NULL,
  decision            VARCHAR(20),
  decision_code       VARCHAR(50),
  score_total         INTEGER,
  approved_amount     DECIMAL(12,2),
  interest_rate       DECIMAL(5,2),
  tenure_months       INTEGER,
  emi_amount          DECIMAL(10,2),
  processing_fee      DECIMAL(10,2),
  offer_valid_till    TIMESTAMPTZ,
  foir_post_loan      DECIMAL(5,4),
  employer_category   VARCHAR(10),
  pin_code            VARCHAR(6),
  pin_tier            VARCHAR(10),
  state_name          VARCHAR(100),
  bureau_source       VARCHAR(20),
  aa_available        BOOLEAN DEFAULT FALSE,
  sms_available       BOOLEAN DEFAULT FALSE,
  appography_avail    BOOLEAN DEFAULT FALSE,
  processing_time_ms  INTEGER,
  audit_id            UUID REFERENCES audit_logs(audit_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_decision ON applications(decision);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_score ON applications(score_total);

-- ── Negative PIN Codes Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS negative_pin_codes (
  pin_code        VARCHAR(6) PRIMARY KEY,
  reason          VARCHAR(200),
  npa_rate        DECIMAL(5,2),
  fraud_score     INTEGER,
  state_name      VARCHAR(100),
  tier            VARCHAR(10),
  added_by        VARCHAR(100),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE
);

-- Sample negative PINs for testing
INSERT INTO negative_pin_codes (pin_code, reason, npa_rate, tier, state_name)
VALUES
  ('999999', 'Test negative PIN', 25.0, 'TIER_3', 'Test State'),
  ('110001', 'High fraud incidents', 12.5, 'TIER_1', 'Delhi')
ON CONFLICT DO NOTHING;

-- ── PIN Risk Master ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pin_risk_master (
  pin_code        VARCHAR(6) PRIMARY KEY,
  city_name       VARCHAR(100),
  state_name      VARCHAR(100),
  tier            VARCHAR(10) NOT NULL DEFAULT 'TIER_2',
  npa_rate        DECIMAL(5,2) DEFAULT 3.0,
  state_risk_score INTEGER DEFAULT 50,
  is_negative     BOOLEAN DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Rule Versions Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS rule_versions (
  rule_id         SERIAL PRIMARY KEY,
  rule_file       VARCHAR(200) NOT NULL,
  version         VARCHAR(20) NOT NULL,
  checksum        VARCHAR(64),
  deployed_by     VARCHAR(100),
  deployed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE,
  notes           TEXT
);

-- ── Consent Ledger Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_ledger (
  consent_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  VARCHAR(100) NOT NULL,
  consent_type    VARCHAR(50) NOT NULL,
  consent_token   TEXT NOT NULL,
  consented_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  device_id       VARCHAR(64),
  ip_address      INET,
  consent_version VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_consent_application ON consent_ledger(application_id);

-- ── Employer Master ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employer_master (
  employer_id     SERIAL PRIMARY KEY,
  employer_name   VARCHAR(300) NOT NULL,
  cin_number      VARCHAR(21),
  category        VARCHAR(10) NOT NULL,
  is_listed       BOOLEAN DEFAULT FALSE,
  is_psu          BOOLEAN DEFAULT FALSE,
  employee_band   VARCHAR(20),
  company_age     INTEGER,
  aliases         TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employer_name ON employer_master USING gin(to_tsvector('english', employer_name));

-- Sample employers
INSERT INTO employer_master (employer_name, category, is_listed, company_age)
VALUES
  ('State Bank of India', 'CAT_A', TRUE, 70),
  ('Tata Consultancy Services', 'CAT_B', TRUE, 55),
  ('Infosys Limited', 'CAT_B', TRUE, 43),
  ('Indian Railways', 'CAT_A', FALSE, 100),
  ('BPCL', 'CAT_A', TRUE, 50)
ON CONFLICT DO NOTHING;

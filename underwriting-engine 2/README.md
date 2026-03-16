# Personal Loan Underwriting Engine
### Node.js + TypeScript + GoRules ZEN Engine

---

## Quick Start

```bash
# 1. Clone and install
cp .env.example .env
npm install

# 2. Run with Docker (includes Postgres + Redis + Mock APIs)
docker-compose up

# 3. Or run locally (needs Postgres + Redis running)
npm run dev

# 4. Run tests
npm test

# 5. Build for production
npm run build && npm start
```

---

## Architecture

```
POST /v1/underwrite
        │
        ▼
┌─────────────────────────────────────────────────────┐
│              UnderwritingPipeline                    │
│                                                      │
│  Phase 1 ── KYC (PAN + Aadhaar)          [seq]      │
│  Phase 2 ── Bureau + AA + App + SMS      [parallel] │
│  Phase 3 ── Telecom + Location + Fraud   [parallel] │
│  Phase 4 ── FOIR Calculation             [sync]     │
│  Phase 5 ── Hard Gates (ZEN Engine)      [sync]     │
│  Phase 6 ── Scorecard (ZEN Engine)       [sync]     │
│  Phase 7 ── Offer Generation (ZEN)       [sync]     │
│  Phase 8 ── Audit Log                    [async]    │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
underwriting-engine/
├── src/
│   ├── index.ts                        # Express app entry point
│   ├── types/index.ts                  # All TypeScript types
│   ├── routes/
│   │   └── underwriting.routes.ts      # REST endpoints
│   ├── modules/
│   │   ├── underwriting.pipeline.ts    # Master orchestrator
│   │   ├── rule-engine.module.ts       # ZEN Engine wrapper
│   │   ├── foir.module.ts              # FOIR calculator
│   │   └── audit.module.ts             # Audit logger
│   ├── integrations/
│   │   ├── base-api-client.ts          # Retry + circuit breaker
│   │   ├── bureau.integration.ts       # CIBIL + Experian
│   │   └── data-sources.integration.ts # KYC, AA, SMS, App, Location...
│   ├── middleware/index.ts             # Auth, rate-limit, logging
│   └── utils/
│       ├── logger.ts                   # Winston logger
│       └── masking.ts                  # PII masking + validator
│
├── rules/                              # ZEN Engine JDM files
│   ├── hard-gates/hard-gates.json      # 14 hard gate rules
│   ├── scorecard/scorecard.json        # 6-module 1000pt scorecard
│   └── offer/offer.json               # Loan offer + pricing engine
│
├── tests/
│   └── underwriting.test.ts            # Jest test suite
│
├── docker/
│   ├── Dockerfile                      # Multi-stage production build
│   ├── init.sql                        # PostgreSQL schema
│   └── mock-server.js                  # Local API mock server
│
├── docker-compose.yml
├── .env.example
├── tsconfig.json
└── package.json
```

---

## API Reference

### POST /v1/underwrite

**Headers:**
```
Authorization: Bearer <jwt>
Content-Type: application/json
X-Correlation-Id: <uuid>  (optional)
```

**Request Body:** (see `sample-request.json`)

**Response — APPROVE:**
```json
{
  "applicationId": "PL-2024-...",
  "decision": "APPROVE",
  "decisionCode": "700-799",
  "decisionReason": "AUTO_APPROVED_PRIME",
  "scorecard": {
    "moduleScores": {
      "bureauScore": 220,
      "bureauBehaviour": 165,
      "incomeFoir": 120,
      "employerDemographics": 65,
      "alternateBehavioural": 150,
      "fraudRisk": 45,
      "total": 765
    },
    "scoreBand": "700-799"
  },
  "offer": {
    "approvedAmount": 500000,
    "maxEligibleAmount": 750000,
    "interestRate": 12.50,
    "rateType": "REDUCING_BALANCE",
    "tenure": 36,
    "emi": 16734,
    "processingFee": 5000,
    "offerValidTill": "2024-04-15T..."
  },
  "foirSummary": { "foirPostLoan": 0.43, "foirBreached": false },
  "processingTimeMs": 4823
}
```

**Response — DECLINE:**
```json
{
  "decision": "DECLINE",
  "decisionCode": "R-HG-002",
  "decisionReason": "DPD 90+ found in bureau history",
  "hardGatesTriggered": [{ "ruleId": "R-HG-002", "triggered": true }]
}
```

---

## Hot-Reloading Rules

Rules live in `/rules/*.json` — credit policy teams can update them without a deployment:

```bash
# After editing a rule file:
curl -X POST http://localhost:3000/v1/rules/reload \
  -H "Authorization: Bearer <token>"
```

---

## Environment Variables

See `.env.example` for the full list of 40+ configurable variables covering:
- All 20 API endpoint URLs, keys, and timeouts
- Business config (base rate, max FOIR, loan limits)
- Infrastructure (DB, Redis, JWT)
- Rule engine (directory, reload interval)

---

## API Integrations (20 APIs)

| API ID  | Provider              | Type      | Mandatory |
|---------|-----------------------|-----------|-----------|
| API-001 | CIBIL TransUnion      | Bureau    | YES       |
| API-002 | CIBIL Income Est.     | Bureau    | YES       |
| API-003 | Experian India        | Bureau    | Fallback  |
| API-004 | NSDL PAN KYC          | KYC       | YES       |
| API-005 | UIDAI Aadhaar eKYC    | KYC       | YES       |
| API-006 | Finvu AA (SAHAMATI)   | Financial | YES       |
| API-007 | Perfios Bank Stmt     | Financial | YES       |
| API-008 | NSDL ITR Verify       | Financial | Optional  |
| API-009 | IDfy Appography       | Alternate | YES       |
| API-010 | Finarkein SMS         | Alternate | YES       |
| API-011 | TRAI MNP / Telecom    | Alternate | YES       |
| API-012 | Location / Google     | Alternate | YES       |
| API-013 | PIN Risk (Internal)   | Risk      | YES       |
| API-014 | Karza Employer        | Verify    | YES       |
| API-015 | NPCI NACH             | Verify    | YES       |
| API-016 | Fraud Blacklist       | Risk      | YES       |
| API-017 | Decision Engine       | Internal  | YES       |
| API-018 | Pricing Engine        | Internal  | YES       |
| API-019 | Consent Ledger        | Compliance| YES       |
| API-020 | Audit Log             | Compliance| YES       |

---

## Compliance

- **DPDP Act 2023**: PAN/mobile masked in all logs; raw SMS not stored
- **RBI AA**: Full SAHAMATI consent artefact flow implemented
- **CIBIL**: Signed consent token in every report request
- **Audit**: Immutable append-only log per decision; 7yr retention
- **UIDAI**: Aadhaar used only for OTP eKYC; biometric not used

// ============================================================
// docker/mock-server.js
// Local mock server for all internal + sandbox external APIs
// Runs on port 4000 — simulates realistic responses
// ============================================================

const http = require('http');

const PORT = 4000;

// ── Mock Response Library ─────────────────────────────────────

const mockResponses = {

  // PIN Risk API (API-013)
  '/v1/pinRisk/:pin': (pin) => ({
    pinCode: pin,
    tier: pin.startsWith('4') ? 'TIER_1' : pin.startsWith('6') ? 'TIER_2' : 'TIER_3',
    isNegative: pin === '999999',
    npaRate: 3.2,
    stateRiskScore: 45,
    city: 'Mumbai',
    state: 'Maharashtra',
  }),

  // Fraud Blacklist (API-016)
  '/v1/check': () => ({
    panBlacklisted: false,
    deviceBlacklisted: false,
    deviceAppCount7Days: 0,
    deviceRisk: 'LOW',
    panFraudFlag: false,
    mobileFraudFlag: false,
  }),

  // Audit Log (API-020)
  '/v1/audit': () => ({ status: 'ok', auditId: randomUuid() }),

  // Consent Ledger (API-019)
  '/v1/consent': () => ({ status: 'ok', consentId: randomUuid() }),

  // Location Profile (API-012)
  '/v1/locationProfile': () => ({
    homeStable: true,
    officeMatch: true,
    nighttimeConsistent: true,
    velocityFlag: false,
    homeLat: 19.0760,
    homeLng: 72.8777,
  }),

  // Employer Verification (API-014)
  '/v1/employer/verify': (body) => ({
    verified: true,
    category: body?.employerName?.toLowerCase().includes('infosys') || 
               body?.employerName?.toLowerCase().includes('tcs') ? 'MNC' : 'UNLISTED',
    cinNumber: 'U72200MH1995PLC084781',
    companyAgeYears: 25,
    employeeCountBand: '10001+',
    isListed: true,
  }),

  // SMS Analysis (API-010)
  '/v1/smsAnalysis': () => ({
    salaryCredits: { monthsDetected: 6, stdDeviation: 1200 },
    emiDebits: { count: 4, avgAmount: 8500 },
    creditCardPayments: { count: 6 },
    loanEnquiries: { last30Days: 1 },
    utilityPayments: { count: 11 },
    bounces: { count: 0 },
    internationalTxns: { count: 2 },
  }),

  // Telecom / WhatsApp (API-011)
  '/v1/mobileVintage': () => ({
    activationDate: new Date(Date.now() - 48 * 30 * 24 * 3600 * 1000).toISOString(),
    mnpHistory: [],
    whatsappVintageMonths: 36,
    isWhatsappBusiness: false,
    hasProfilePhoto: true,
    displayNameMatch: true,
    daysSinceActive: 1,
  }),

  // Appography (API-009)
  '/v1/deviceSignals': () => ({
    fintechApps: 3,
    lendingApps: 1,
    bankingApps: 3,
    investmentApps: ['zerodha', 'groww'],
    insuranceApps: ['policybazaar'],
    ecommerceVintageDays: 730,
    rideShareApps: ['uber'],
    professionalApps: ['linkedin'],
    daysSinceOsUpdate: 15,
    gamblingApps: [],
  }),

  // PAN KYC (API-004)
  '/pan/verify': (body) => ({
    status: 'VALID',
    panStatus: 'ACTIVE',
    name: 'RAHUL SHARMA',
    dobMatch: true,
    nameMatch: true,
  }),

  // Aadhaar eKYC (API-005)
  '/otp/verify': () => ({ authenticated: true }),

  // Bank Statement (Perfios API-007)
  '/v1/bankStatement': () => ({
    status: 'PROCESSED',
    monthlySummary: [],
  }),

  // Default 404
  'default': () => ({ error: 'Mock endpoint not found' }),
};

// ── HTTP Server ────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    const url = req.url || '';
    const method = req.method;

    console.log(`[MOCK] ${method} ${url}`);

    let parsedBody = {};
    try { parsedBody = JSON.parse(body); } catch (e) {}

    let responseData;

    // Route matching
    if (url.match(/^\/v1\/pinRisk\/(\d{6})/)) {
      const pin = url.split('/').pop();
      responseData = mockResponses['/v1/pinRisk/:pin'](pin);
    } else if (url.includes('/v1/check')) {
      responseData = mockResponses['/v1/check']();
    } else if (url.includes('/v1/audit')) {
      responseData = mockResponses['/v1/audit']();
    } else if (url.includes('/v1/consent')) {
      responseData = mockResponses['/v1/consent']();
    } else if (url.includes('/v1/locationProfile')) {
      responseData = mockResponses['/v1/locationProfile']();
    } else if (url.includes('/v1/employer/verify') || url.includes('/employer/verify')) {
      responseData = mockResponses['/v1/employer/verify'](parsedBody);
    } else if (url.includes('/v1/smsAnalysis')) {
      responseData = mockResponses['/v1/smsAnalysis']();
    } else if (url.includes('/v1/mobileVintage')) {
      responseData = mockResponses['/v1/mobileVintage']();
    } else if (url.includes('/v1/deviceSignals')) {
      responseData = mockResponses['/v1/deviceSignals']();
    } else if (url.includes('/pan/verify')) {
      responseData = mockResponses['/pan/verify'](parsedBody);
    } else if (url.includes('/otp/verify')) {
      responseData = mockResponses['/otp/verify']();
    } else {
      responseData = { status: 'ok', message: `Mock response for ${url}` };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });
});

server.listen(PORT, () => {
  console.log(`✅ Mock API Server running on port ${PORT}`);
  console.log(`   Simulating: PIN Risk, Fraud, Audit, Location, Employer, SMS, Telecom, Appography, KYC`);
});

function randomUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

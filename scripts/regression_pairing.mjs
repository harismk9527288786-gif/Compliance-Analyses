import fs from 'fs';
import path from 'path';

const MTC_F316_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
const MDS_F316_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-ASS-ASTM-A182-F316-NACE-XX-001-[N1157]-REV A.pdf';
const MDS_F6A_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-MSS-ASTM-A182-F6a-NACE-XX-001-[N1157]-REV A.pdf';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runPairingRegression() {
  console.log('===============================================================');
  console.log('RUNNING PAIRING & REQUIREMENT CROSS-CONTAMINATION REGRESSION');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@apexvalves.com', password: 'password123' }),
  });
  assert(loginRes.ok, 'Login succeeded with HTTP 200');
  const cookie = loginRes.headers.get('set-cookie');

  // Helper to upload document
  async function uploadDoc(filePath, type) {
    const formData = new FormData();
    const filename = path.basename(filePath);
    const buf = fs.readFileSync(filePath);
    formData.append('file', new Blob([buf]), filename);
    formData.append('type', type);
    formData.append('userId', 'usr-admin-1');

    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Failed to upload ${filename}: ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    return json.document;
  }

  console.log('\n--- UPLOADING TEST DOCUMENTS ---');
  const mtcF316Doc = await uploadDoc(MTC_F316_PATH, 'mtc');
  console.log(`Uploaded F316 MTC -> ID: ${mtcF316Doc.id}`);
  const mdsF316Doc = await uploadDoc(MDS_F316_PATH, 'mds');
  console.log(`Uploaded F316 MDS -> ID: ${mdsF316Doc.id}`);
  const mdsF6aDoc = await uploadDoc(MDS_F6A_PATH, 'mds');
  console.log(`Uploaded F6a MDS -> ID: ${mdsF6aDoc.id}`);

  // ===============================================================
  // TEST SUITE 1: PAIR A (F316 MTC + F316 MDS)
  // ===============================================================
  console.log('\n--- TEST PAIR A: F316 MTC + F316 MDS ---');
  const pairARes = await fetch(`${BASE_URL}/api/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      mtcDocumentId: mtcF316Doc.id,
      mdsDocumentId: mdsF316Doc.id,
    }),
  });
  assert(pairARes.ok, `Pair A created analysis HTTP ${pairARes.status}`);
  const pairA = await pairARes.json();
  const analysisA = pairA.analysis;
  const findingsA = pairA.findings;

  // Identity assertions
  assert(
    analysisA.materialGrade.includes('F316') && !analysisA.materialGrade.includes('F6a'),
    `Analysis material grade is F316 ("${analysisA.materialGrade}") and NOT F6a`
  );
  assert(
    analysisA.heats && analysisA.heats.includes('FK2407-061'),
    `Heat number extracted is "FK2407-061" (actual: ${JSON.stringify(analysisA.heats)})`
  );
  assert(
    !analysisA.heats.includes('IMP004774'),
    `Heat number is NEVER Contract/POI identifier "IMP004774"`
  );
  assert(
    analysisA.compatibilityStatus === 'COMPATIBLE',
    `Compatibility status is COMPATIBLE`
  );

  // Requirement isolation assertions
  const niFinding = findingsA.find((f) => f.field === 'Ni');
  assert(niFinding !== undefined, 'Nickel requirement is present in findings');
  if (niFinding) {
    assert(
      niFinding.status === 'PASS',
      `Nickel evaluated to PASS (supplier: ${niFinding.supplierRawValue}, req: ${niFinding.requirementText})`
    );
    assert(
      !niFinding.requirementText.includes('0.50'),
      `Nickel requirement is F316 (10-14%) and NOT F6a (max 0.50%)`
    );
  }

  const crFinding = findingsA.find((f) => f.field === 'Cr');
  assert(crFinding !== undefined, 'Chromium requirement is present in findings');
  if (crFinding) {
    assert(
      crFinding.status === 'PASS',
      `Chromium evaluated to PASS (supplier: ${crFinding.supplierRawValue}, req: ${crFinding.requirementText})`
    );
    assert(
      !crFinding.requirementText.includes('13.50'),
      `Chromium requirement is F316 (16-18%) and NOT F6a (11.50-13.50%)`
    );
  }

  const yieldFinding = findingsA.find((f) => f.field === 'yieldStrength');
  assert(yieldFinding !== undefined, 'Yield strength requirement is present in findings');
  if (yieldFinding) {
    assert(
      yieldFinding.status === 'PASS',
      `Yield strength evaluated to PASS (supplier: ${yieldFinding.supplierRawValue}, req: ${yieldFinding.requirementText})`
    );
    assert(
      !yieldFinding.requirementText.includes('275'),
      `Yield strength requirement is F316 (min 205 MPa) and NOT F6a (min 275 MPa)`
    );
  }

  const tensileFinding = findingsA.find((f) => f.field === 'tensileStrength');
  assert(tensileFinding !== undefined, 'Tensile strength requirement is present in findings');
  if (tensileFinding) {
    assert(
      tensileFinding.status === 'PASS',
      `Tensile strength evaluated to PASS (supplier: ${tensileFinding.supplierRawValue}, req: ${tensileFinding.requirementText})`
    );
  }

  const elongFinding = findingsA.find((f) => f.field === 'elongation');
  assert(elongFinding !== undefined, 'Elongation requirement is present in findings');
  if (elongFinding) {
    assert(
      elongFinding.status === 'PASS',
      `Elongation evaluated to PASS (supplier: ${elongFinding.supplierRawValue})`
    );
  }

  const roaFinding = findingsA.find((f) => f.field === 'reductionOfArea');
  assert(roaFinding !== undefined, 'Reduction of Area requirement is present in findings');
  if (roaFinding) {
    assert(
      roaFinding.status === 'PASS',
      `Reduction of Area evaluated to PASS (supplier: ${roaFinding.supplierRawValue})`
    );
  }

  const hardFinding = findingsA.find((f) => f.field === 'hardness');
  assert(hardFinding !== undefined, 'Hardness requirement is present in findings');
  if (hardFinding) {
    assert(
      hardFinding.status === 'PASS',
      `Hardness evaluated to PASS (supplier: ${hardFinding.supplierRawValue}, req: ${hardFinding.requirementText})`
    );
    assert(
      !hardFinding.requirementText.includes('143'),
      `Hardness requirement is F316 (<= 237 HBW / 22 HRC) and NOT F6a (143-207 HBW)`
    );
  }

  const htFinding = findingsA.find((f) => f.field === 'heatTreatmentCondition');
  assert(htFinding !== undefined, 'Heat Treatment requirement is present in findings');
  if (htFinding) {
    assert(
      htFinding.status === 'PASS',
      `Heat treatment evaluated to PASS (supplier: ${htFinding.supplierRawValue})`
    );
    assert(
      !htFinding.requirementText.toLowerCase().includes('class 1 anneal'),
      `Heat treatment requirement is F316 Solution Anneal and NOT F6a Class 1 Anneal/N&T`
    );
  }

  // ===============================================================
  // TEST SUITE 2: PAIR C (F316 MTC + F6a MDS — HARD COMPATIBILITY GATE)
  // ===============================================================
  console.log('\n--- TEST PAIR C: F316 MTC + F6a MDS (COMPATIBILITY GATE) ---');
  const pairCRes = await fetch(`${BASE_URL}/api/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      mtcDocumentId: mtcF316Doc.id,
      mdsDocumentId: mdsF6aDoc.id,
    }),
  });
  assert(pairCRes.status === 201, `Pair C handled cleanly by server (status ${pairCRes.status})`);
  const pairC = await pairCRes.json();
  const analysisC = pairC.analysis;
  const findingsC = pairC.findings;

  assert(
    analysisC.status === 'rejected',
    `Analysis status is REJECTED for incompatible pair`
  );
  assert(
    analysisC.compatibilityStatus === 'MISMATCH',
    `Analysis compatibilityStatus is MISMATCH`
  );
  assert(
    analysisC.reviewRequiredCount === 1 && analysisC.deviationCount === 0 && analysisC.passCount === 0,
    `Only 1 REVIEW_REQUIRED finding created, 0 deviations, 0 passes (evaluation blocked)`
  );
  assert(
    findingsC.length === 1 && findingsC[0].field === 'materialSpecificationCompatibility',
    `Single finding is materialSpecificationCompatibility`
  );
  assert(
    findingsC[0].status === 'REVIEW_REQUIRED',
    `Finding status is REVIEW_REQUIRED`
  );
  assert(
    findingsC[0].reason.includes('Specification Incompatibility'),
    `Finding reason clearly notes specification incompatibility`
  );

  // ===============================================================
  // TEST SUITE 3: NONEXISTENT / BOGUS REQUIREMENT SET ID (NO SILENT FALLBACK)
  // ===============================================================
  console.log('\n--- TEST PAIR E: NONEXISTENT REQUIREMENT SET (404 ERROR) ---');
  const bogusReqRes = await fetch(`${BASE_URL}/api/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      mtcDocumentId: mtcF316Doc.id,
      requirementSetId: 'reqset-bogus-nonexistent-99999',
    }),
  });
  assert(
    bogusReqRes.status === 404,
    `Nonexistent requirementSetId returns 404 (actual: ${bogusReqRes.status}) without falling back to pilot data`
  );

  // ===============================================================
  // TEST SUITE 4: NONEXISTENT MTC DOCUMENT ID (NO SILENT FALLBACK)
  // ===============================================================
  console.log('\n--- TEST PAIR F: NONEXISTENT MTC DOCUMENT (404 ERROR) ---');
  const bogusMtcRes = await fetch(`${BASE_URL}/api/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      mtcDocumentId: 'doc-bogus-nonexistent-88888',
      mdsDocumentId: mdsF316Doc.id,
    }),
  });
  assert(
    bogusMtcRes.status === 404,
    `Nonexistent mtcDocumentId returns 404 (actual: ${bogusMtcRes.status}) without falling back to pilot data`
  );

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPairingRegression().catch((err) => {
  console.error('Fatal error during pairing regression test:', err);
  process.exit(1);
});

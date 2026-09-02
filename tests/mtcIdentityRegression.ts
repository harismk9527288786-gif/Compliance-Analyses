/**
 * Regression Test: MTC Identity Extraction & Data Isolation
 * 
 * Tests that:
 * 1. extractMTCIdentity does NOT hardcode any specific supplier as a default
 * 2. Wenzhou Winway MTC is correctly identified
 * 3. Western Forge MTC is correctly identified (only when in document text)
 * 4. Empty/scanned documents do NOT return a real company name
 * 5. Two different MTCs cannot contaminate each other's identity fields
 * 6. The filename is used as secondary extraction signal
 */

import { extractMTCIdentity } from '../server/gemini';

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail?: string;
}

function assertEqual(actual: any, expected: any, field: string): { passed: boolean; detail: string } {
  const passed = actual === expected;
  return {
    passed,
    detail: passed
      ? `✓ ${field}: "${actual}"`
      : `✗ ${field}: expected "${expected}", got "${actual}"`,
  };
}

function assertNotEqual(actual: any, notExpected: any, field: string): { passed: boolean; detail: string } {
  const passed = actual !== notExpected;
  return {
    passed,
    detail: passed
      ? `✓ ${field}: "${actual}" (correctly not "${notExpected}")`
      : `✗ ${field}: got "${actual}" which should NOT be "${notExpected}"`,
  };
}

export function runMTCIdentityRegressionTests(): TestResult[] {
  const results: TestResult[] = [];

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: Wenzhou Winway MTC with full document text
  // ─────────────────────────────────────────────────────────────────
  {
    const docText = `
WENZHOU WINWAY MECHANICAL & ELECTRICAL EQUIPMENT CO., LTD.
Material Test Certificate EN 10204 3.1
TC No.: WW2604133-3
MTC No.: WW2604133-A3
Production No.: WW2604-133
Contract No.: IMP004774
Heat No.: FK2407-061
Material: ASTM A182 F316
    `.trim();
    const filename = 'WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
    const identity = extractMTCIdentity(docText, filename);

    const supplierCheck = assertEqual(
      identity.supplierName,
      'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      'supplierName'
    );
    results.push({
      name: 'TC-REGR-01: Wenzhou Winway supplier extraction',
      passed: supplierCheck.passed,
      expected: 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      actual: String(identity.supplierName),
      detail: supplierCheck.detail,
    });

    const heatCheck = assertEqual(identity.heatNumber, 'FK2407-061', 'heatNumber');
    results.push({
      name: 'TC-REGR-02: FK2407-061 heat number extraction',
      passed: heatCheck.passed,
      expected: 'FK2407-061',
      actual: identity.heatNumber,
      detail: heatCheck.detail,
    });

    const tcCheck = assertEqual(identity.mtcNumber, 'WW2604133-3', 'mtcNumber');
    results.push({
      name: 'TC-REGR-03: TC number WW2604133-3 extraction',
      passed: tcCheck.passed,
      expected: 'WW2604133-3',
      actual: identity.mtcNumber,
      detail: tcCheck.detail,
    });

    const gradeCheck = assertEqual(identity.materialGrade, 'ASTM A182 F316', 'materialGrade');
    results.push({
      name: 'TC-REGR-04: Material grade ASTM A182 F316 extraction',
      passed: gradeCheck.passed,
      expected: 'ASTM A182 F316',
      actual: identity.materialGrade,
      detail: gradeCheck.detail,
    });

    const poCheck = assertEqual(identity.poNumber, 'IMP004774', 'poNumber');
    results.push({
      name: 'TC-REGR-05A: Contract/PO number IMP004774 extraction',
      passed: poCheck.passed,
      expected: 'IMP004774',
      actual: String(identity.poNumber),
      detail: poCheck.detail,
    });

    const prodCheck = assertEqual(identity.productionNumber, 'WW2604-133', 'productionNumber');
    results.push({
      name: 'TC-REGR-05B: Production number WW2604-133 extraction',
      passed: prodCheck.passed,
      expected: 'WW2604-133',
      actual: String(identity.productionNumber),
      detail: prodCheck.detail,
    });

    const confCheck = assertEqual(identity.isConfident, true, 'isConfident');
    results.push({
      name: 'TC-REGR-05: Wenzhou Winway MTC is confident',
      passed: confCheck.passed,
      expected: 'true',
      actual: String(identity.isConfident),
      detail: confCheck.detail,
    });
  }


  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Empty/scanned document must NOT return Western Forge
  // ─────────────────────────────────────────────────────────────────
  {
    const identity = extractMTCIdentity('', 'scanned-document.pdf');

    const supplierCheck = assertNotEqual(
      identity.supplierName,
      'Western Forge & Flange Co.',
      'supplierName on empty doc'
    );
    results.push({
      name: 'TC-REGR-06: Empty doc does NOT return Western Forge',
      passed: supplierCheck.passed,
      expected: 'NOT "Western Forge & Flange Co."',
      actual: String(identity.supplierName),
      detail: supplierCheck.detail,
    });

    const confCheck = assertEqual(identity.isConfident, false, 'isConfident on empty');
    results.push({
      name: 'TC-REGR-07: Empty doc is not confident',
      passed: confCheck.passed,
      expected: 'false',
      actual: String(identity.isConfident),
      detail: confCheck.detail,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Western Forge MTC is only identified when in document text
  // ─────────────────────────────────────────────────────────────────
  {
    const docText = `
Western Forge & Flange Co.
TC No.: WW2606229-3
Heat No.: A228
Material: ASTM A105N
    `.trim();
    const identity = extractMTCIdentity(docText, 'WW2606229-3.pdf');

    const supplierCheck = assertEqual(identity.supplierName, 'Western Forge & Flange Co.', 'supplierName');
    results.push({
      name: 'TC-REGR-08: Western Forge correctly identified from doc text',
      passed: supplierCheck.passed,
      expected: 'Western Forge & Flange Co.',
      actual: String(identity.supplierName),
      detail: supplierCheck.detail,
    });

    const heatCheck = assertEqual(identity.heatNumber, 'A228', 'heatNumber');
    results.push({
      name: 'TC-REGR-09: Heat A228 extraction for Western Forge',
      passed: heatCheck.passed,
      expected: 'A228',
      actual: identity.heatNumber,
      detail: heatCheck.detail,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Two evaluations must NOT contaminate each other
  // ─────────────────────────────────────────────────────────────────
  {
    const docTextA = `
WENZHOU WINWAY MECHANICAL & ELECTRICAL EQUIPMENT CO., LTD.
TC No.: WW2604133-3
Heat No.: FK2407-061
Material: ASTM A182 F316
    `.trim();

    const docTextB = `
Western Forge & Flange Co.
TC No.: WW2606229-3
Heat No.: A228
Material: ASTM A105N
    `.trim();

    // Extract A then B then A again
    const identityA1 = extractMTCIdentity(docTextA, 'winway-mtc.pdf');
    const identityB = extractMTCIdentity(docTextB, 'western-forge-mtc.pdf');
    const identityA2 = extractMTCIdentity(docTextA, 'winway-mtc.pdf');

    // Verify A1 supplier
    const a1Supplier = assertEqual(
      identityA1.supplierName,
      'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      'A1 supplierName'
    );
    results.push({
      name: 'TC-REGR-10: Evaluation A (first) supplier = Wenzhou Winway',
      passed: a1Supplier.passed,
      expected: 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      actual: String(identityA1.supplierName),
      detail: a1Supplier.detail,
    });

    // Verify B supplier
    const bSupplier = assertEqual(
      identityB.supplierName,
      'Western Forge & Flange Co.',
      'B supplierName'
    );
    results.push({
      name: 'TC-REGR-11: Evaluation B supplier = Western Forge',
      passed: bSupplier.passed,
      expected: 'Western Forge & Flange Co.',
      actual: String(identityB.supplierName),
      detail: bSupplier.detail,
    });

    // Verify A2 supplier (must NOT be Western Forge from B)
    const a2Supplier = assertEqual(
      identityA2.supplierName,
      'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      'A2 supplierName'
    );
    results.push({
      name: 'TC-REGR-12: Evaluation A (re-read) supplier = Wenzhou Winway (no leakage from B)',
      passed: a2Supplier.passed,
      expected: 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      actual: String(identityA2.supplierName),
      detail: a2Supplier.detail,
    });

    // Verify heats didn't leak
    const a2Heat = assertEqual(identityA2.heatNumber, 'FK2407-061', 'A2 heatNumber');
    results.push({
      name: 'TC-REGR-13: Heat isolation — A re-read has FK2407-061 not A228',
      passed: a2Heat.passed,
      expected: 'FK2407-061',
      actual: identityA2.heatNumber,
      detail: a2Heat.detail,
    });

    const bHeat = assertEqual(identityB.heatNumber, 'A228', 'B heatNumber');
    results.push({
      name: 'TC-REGR-14: Heat isolation — B has A228 not FK2407-061',
      passed: bHeat.passed,
      expected: 'A228',
      actual: identityB.heatNumber,
      detail: bHeat.detail,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: Supplier from filename when doc text is empty
  // ─────────────────────────────────────────────────────────────────
  {
    // This simulates a scanned PDF where text extraction fails
    // but the filename contains 'Wenzhou Winway' indicator
    const identityFromFilename = extractMTCIdentity(
      '',
      'WW2604-133 IMP004774 Wenzhou Winway F316.pdf'
    );

    // The filename search should find "Wenzhou Winway"
    // Note: the current regex checks combinedSearchText which includes filename
    const filenameSupplierFound =
      identityFromFilename.supplierName === 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd';

    results.push({
      name: 'TC-REGR-15: Supplier extracted from filename when doc text empty',
      passed: filenameSupplierFound,
      expected: 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
      actual: String(identityFromFilename.supplierName),
      detail: filenameSupplierFound
        ? '✓ Supplier found via filename'
        : `✗ Supplier from filename: "${identityFromFilename.supplierName}"`,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: Third-party supplier with generic Manufacturer label
  // ─────────────────────────────────────────────────────────────────
  {
    const docText = `
Manufacturer: ACME Steel Industries Ltd.
TC No.: ACME-2024-001
Heat No.: H1234-567
Grade: ASTM A350 LF2
    `.trim();
    const identity = extractMTCIdentity(docText, 'acme-mtc.pdf');

    const supplierCheck = assertEqual(identity.supplierName, 'ACME Steel Industries Ltd.', 'supplierName');
    results.push({
      name: 'TC-REGR-16: Generic Manufacturer label extraction',
      passed: supplierCheck.passed,
      expected: 'ACME Steel Industries Ltd.',
      actual: String(identity.supplierName),
      detail: supplierCheck.detail,
    });
  }

  return results;
}

// CLI runner
const results = runMTCIdentityRegressionTests();
console.log('\n═══════════════════════════════════════════════════════');
console.log('  MTC IDENTITY EXTRACTION REGRESSION TEST SUITE');
console.log('═══════════════════════════════════════════════════════\n');


  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (r.detail) console.log(`   ${r.detail}`);
    if (r.passed) passed++;
    else failed++;
  }

  console.log(`\n───────────────────────────────────────────────────────`);
  console.log(`  ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log(`───────────────────────────────────────────────────────\n`);

  if (failed > 0) process.exit(1);

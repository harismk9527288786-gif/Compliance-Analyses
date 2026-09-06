import { evaluateCompliance } from '../src/engine/rules';
import { PILOT_MDS_REQUIREMENT_SET } from '../src/engine/pilotData';
import { formatExportSupplierValue } from '../src/utils/exportUtils';
import assert from 'assert';

console.log('Testing Quality Report Export Mapping...');

const realMtcCert: any = {
  id: 'cert-real-test',
  documentId: 'doc-real-test',
  mtcNumber: 'WW2604133-3',
  supplierName: 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
  issueDate: '2026-05-25',
  materialGrade: 'ASTM A182 F316',
  standard: 'ASTM A182/A182M-21',
  heats: ['FK2407-061'],
  evidenceItems: [
    { field: 'C', rawValue: '0.018 %', normalizedValue: 0.018, unit: '%', category: 'chemical' },
    { field: 'Si', rawValue: '0.367 %', normalizedValue: 0.367, unit: '%', category: 'chemical' },
    { field: 'Mn', rawValue: '0.950 %', normalizedValue: 0.950, unit: '%', category: 'chemical' },
    { field: 'P', rawValue: '0.036 %', normalizedValue: 0.036, unit: '%', category: 'chemical' },
    { field: 'S', rawValue: '0.0008 %', normalizedValue: 0.0008, unit: '%', category: 'chemical' },
    { field: 'Cr', rawValue: '16.320 %', normalizedValue: 16.32, unit: '%', category: 'chemical' },
    { field: 'Ni', rawValue: '10.070 %', normalizedValue: 10.07, unit: '%', category: 'chemical' },
    { field: 'Mo', rawValue: '2.037 %', normalizedValue: 2.037, unit: '%', category: 'chemical' },
    { field: 'N', rawValue: '0.052 %', normalizedValue: 0.052, unit: '%', category: 'chemical' },
    { field: 'Ni+2Mo', rawValue: '14.144', normalizedValue: 14.144, category: 'chemical' },
    { field: 'PREN', rawValue: '23.87', normalizedValue: 23.87, category: 'chemical' },
    { field: 'yieldStrength', rawValue: '232 MPa', normalizedValue: 232, unit: 'MPa', category: 'mechanical' },
    { field: 'tensileStrength', rawValue: '523 MPa', normalizedValue: 523, unit: 'MPa', category: 'mechanical' },
    { field: 'elongation', rawValue: '42 %', normalizedValue: 42, unit: '%', category: 'mechanical' },
    { field: 'reductionOfArea', rawValue: '68 %', normalizedValue: 68, unit: '%', category: 'mechanical' },
    { field: 'hardness', rawValue: '173, 175, 179 HBW', normalizedValue: 179, unit: 'HBW', category: 'hardness' },
    { field: 'forgingRatio', rawValue: '>4:1', normalizedValue: 4, unit: ':1', category: 'mechanical' },
    { field: 'heatTreatmentCondition', rawValue: 'Solution Annealed, 1040°C, 2h, Water Cooling', category: 'heat_treatment' },
    { field: 'heatTreatmentSoaking', rawValue: '2 hours, water cooling below 260°C.', category: 'heat_treatment' },
    { field: 'intergranularCorrosion', rawValue: 'ASTM A262 Practice E satisfactory', category: 'general' },
    { field: 'visualExamination', rawValue: '100% accessible forged surfaces visual examination satisfactory', category: 'nde' },
    { field: 'radioactiveContamination', rawValue: 'Free from radioactive contamination', category: 'general' },
    { field: 'naceCompliance', rawValue: 'NACE MR0175 / ISO 15156', category: 'general' },
    { field: 'mescStandardRevision', rawValue: 'MESC SPE 77/302:2021', category: 'general' },
    { field: 'weldRepair', rawValue: 'Without weld repair', category: 'certification' },
    { field: 'en10204Type', rawValue: 'EN 10204 3.1', category: 'certification' },
  ]
};

import { extractMDSIdentity, generateRequirementsForMDS } from '../server/gemini';

const mdsFilename = 'MESC_SPE_77-302_ASTM_A182_F316_Rev_A.pdf';
const mdsIdentity = extractMDSIdentity('', mdsFilename);
const requirements = generateRequirementsForMDS(mdsIdentity, mdsFilename) as any[];

const findings = evaluateCompliance({
  analysisId: 'test-analysis',
  requirements,
  certificate: realMtcCert,
});

assert.strictEqual(findings.length, 27, 'Should evaluate all 27 requirements');

findings.forEach((f, idx) => {
  const mappedSupplier = formatExportSupplierValue(f);
  assert(mappedSupplier.length <= 40, `Supplier value too long: ${mappedSupplier}`);
  assert(!mappedSupplier.includes('\n'), `Supplier value contains newline: ${mappedSupplier}`);
  assert(!mappedSupplier.includes('MATERIAL TEST REPORT'), `Supplier value contains OCR dump: ${mappedSupplier}`);
  console.log(
    (idx + 1).toString().padStart(2) + '. ' +
    f.displayName.padEnd(35) + ' | ' +
    'Supplier: ' + mappedSupplier.padEnd(25) + ' | ' +
    'Status: ' + f.status
  );
});

// Test raw OCR dump handling
const dummyFindingWithDump: any = {
  field: 'C',
  category: 'chemical',
  supplierRawValue: '材质测试报告 MATERIAL TEST REPORT EN 10204 Type 3.1 证书号 TC No.: WW2604133-3 日期 DATE: 2026-5-25 页数 PAGE ： 1 OF 1 制造商 Manufacturer ： WENZHOU WINWAY MECHANICAL & ELECTRICAL EQUIPMENT CO., LTD 客户 Client ： HAWA VALVE INDIA PVT. LTD. C: 0.018%',
  supplierNormalizedValue: 0.018,
  supplierUnit: '%',
  status: 'PASS',
};
const cleanedVal = formatExportSupplierValue(dummyFindingWithDump);
assert.strictEqual(cleanedVal, '0.018 %', 'Should clean OCR dump to parameter-specific number');

// Test missing NDE gap
const ndeGapFinding: any = {
  field: 'ndeExamination',
  category: 'nde',
  status: 'DOCUMENTATION_GAP',
  supplierRawValue: 'NOT IDENTIFIED IN MTC',
};
assert.strictEqual(formatExportSupplierValue(ndeGapFinding), 'Not Reported', 'Documentation gap should format cleanly as Not Reported');

console.log('All Quality Report export mapping tests PASSED successfully!');

// ---------------------------------------------------------------------------
// Regression test for the "Supplier Technical Clarification & Concession
// Action Items" data-mapping bug: a REVIEW_REQUIRED finding whose `reason`
// (or upstream evidence.rawValue) has been corrupted into a full document
// dump must NEVER be rendered verbatim into a clarification item description.
// ---------------------------------------------------------------------------
import { buildClarificationDescription } from '../src/utils/sanitize';

const documentDumpReason = '材质测试报告 MATERIAL TEST REPORT EN 10204 Type 3.1 证书号 TC No.: WW2604133-3 制造商 Manufacturer： WENZHOU WINWAY MECHANICAL & ELECTRICAL EQUIPMENT CO., LTD 客户 Client： HAWA VALVE INDIA PVT. LTD. Chemical Composition C: 0.018% Si: 0.367% Mn: 0.950% Mechanical Property Yield Strength 232 MPa Tensile Strength 523 MPa Remarks: Visual, dimensional, weld and radioactive inspections satisfactory. IGC test as per ASTM A262 satisfactory. We hereby certify that the material was manufactured, tested and inspected in accordance with the above specification and found to be satisfactory. Signed: QC Manager';

const htSoakingReviewFinding: any = {
  id: 'finding-htSoak-1',
  displayName: 'Heat Treatment Soaking Period',
  field: 'heatTreatmentSoaking',
  category: 'heat_treatment',
  heatNo: 'FK2407-061',
  requirementText: 'Soaking period must be documented with ruling thickness basis (60 min/inch criterion).',
  requirementClause: 'MDS-HT-04',
  supplierRawValue: '2 hours, water cooling below 260°C.',
  status: 'REVIEW_REQUIRED',
  reason: documentDumpReason, // simulates a corrupted/garbled extraction producing a full document dump
};

const item01Description = buildClarificationDescription(htSoakingReviewFinding);
assert(!item01Description.includes('MATERIAL TEST REPORT'), 'Item 01 description must not contain the raw MTC document dump');
assert(!item01Description.includes('Chemical Composition'), 'Item 01 description must not contain unrelated chemical composition content');
assert(!item01Description.includes('Manufacturer'), 'Item 01 description must not leak manufacturer/signature block content');
assert(item01Description.includes('Manual review required'), 'Item 01 description must explicitly state manual review is required when the reason cannot be trusted');
assert(item01Description.includes('Heat Treatment Soaking Period'), 'Item 01 description must still name the specific parameter');
assert(item01Description.length < 400, `Item 01 description must be bounded/concise, got ${item01Description.length} chars`);
console.log('Clarification item description (sanitized):', item01Description);

// A well-formed, clean reason should pass through as a concise, specific narrative.
const cleanDeviationFinding: any = {
  id: 'finding-mesc-1',
  displayName: 'MESC SPE 77/302 Standard Revision',
  field: 'mescStandardRevision',
  category: 'general',
  heatNo: 'FK2407-061',
  requirementText: 'MESC SPE 77/302:2021',
  requirementClause: 'MDS-STD-01',
  supplierRawValue: 'MESC SPE 77/302:2022',
  status: 'DEVIATION',
  reason: 'Reported standard revision "MESC SPE 77/302:2022" does not match specified requirement "MESC SPE 77/302:2021".',
};
const devDescription = buildClarificationDescription(cleanDeviationFinding);
assert(devDescription.includes('MESC SPE 77/302 Standard Revision'), 'Clean deviation description should retain parameter name');
assert(devDescription.includes('2022'), 'Clean deviation description should retain the actual supplier-reported value');
assert(!devDescription.includes('Manual review required'), 'A clean, well-formed reason should not be replaced by the fallback');
console.log('Clarification item description (clean deviation):', devDescription);

console.log('All clarification-item data-mapping regression tests PASSED successfully!');

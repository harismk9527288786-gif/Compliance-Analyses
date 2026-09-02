import { extractMDSIdentity, generateRequirementsForMDS, extractSupplierEvidenceWithAI } from '../server/gemini';
import { evaluateCompliance } from '../src/engine/rules';
import { Requirement, CertificateRecord } from '../src/types';

async function runCompliancePhasesTest() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MTC COMPLIANCE PHASES & MULTI-REQUIREMENT TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`✅ ${name}`);
      if (detail) console.log(`   ✓ ${detail}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${name}`);
      if (detail) console.error(`   ✗ ${detail}`);
      failed++;
    }
  }

  // Sample MTC Text for F316 Stem
  const f316MtcText = `
WENZHOU WINWAY MECHANICAL & ELECTRICAL EQUIPMENT CO., LTD.
MATERIAL TEST CERTIFICATE EN 10204 3.1
Certificate No.: WW2604133-3
MTC No.: WW2604133-A3
Production No.: WW2604-133
Contract No. / PO: IMP004774
Material: ASTM A182 F316 / F316L (UNS S31600 / S31603)
Heat No.: FK2407-061
Specification: MESC SPE 77/302:2021 / ASTM A182

Chemical Composition (wt%):
C: 0.018   Si: 0.367   Mn: 0.950   P: 0.036   S: 0.0008
Cr: 16.320 Ni: 10.070  Mo: 2.037   N: 0.052
Ni+2Mo: 14.144  PREN: 23.87

Mechanical Properties:
Yield Strength (0.2% Offset): 232 MPa
Tensile Strength: 523 MPa
Elongation (A5): 47 %
Reduction of Area (Z): 68 %
Forging Ratio: >4:1
Hardness: 173, 175, 179 HBW

Heat Treatment:
Solution annealed at 1040°C, soaking 2 hours, water cooling below 260°C.

Tests and Examinations:
Intergranular Corrosion Test (ASTM A262 Practice E): Satisfactory
Visual Inspection: Satisfactory (100% surface examined)
Weld Repair: None (Without weld repair)
Radioactive Contamination: Free
NACE Compliance: NACE MR0175 / ISO 15156
`;

  const mdsFilename = 'MESC_SPE_77-302_ASTM_A182_F316_Rev_A.pdf';
  const mtcFilename = 'WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';

  // 1. MDS Requirements Generation
  const mdsIdentity = extractMDSIdentity('', mdsFilename);
  const requirements = generateRequirementsForMDS(mdsIdentity, mdsFilename) as Requirement[];

  assert(requirements.length >= 15, 'MDS generates full requirement set for F316', `Generated ${requirements.length} requirements`);

  // 2. MTC Evidence Extraction
  const { evidence, certificateMetadata } = await extractSupplierEvidenceWithAI(f316MtcText, mtcFilename);

  assert(evidence.length >= 10, 'MTC evidence extraction captures full property stream', `Extracted ${evidence.length} evidence items`);

  // 3. Build Certificate Record
  const certRecord: CertificateRecord = {
    id: 'cert-test-01',
    documentId: 'doc-mtc-01',
    mtcNumber: certificateMetadata.mtcNumber || 'WW2604133-3',
    supplierName: certificateMetadata.supplierName || 'Wenzhou Winway',
    clientName: 'Client Quality Spec',
    poNumber: 'IMP004774',
    issueDate: '2026-09-01',
    materialGrade: certificateMetadata.materialGrade || 'ASTM A182 F316',
    standard: 'ASTM A182 F316',
    heats: certificateMetadata.heats || ['FK2407-061'],
    evidenceItems: evidence as any,
  };

  // 4. Deterministic Compliance Evaluation
  const findings = evaluateCompliance({
    analysisId: 'analysis-test-01',
    requirements,
    certificate: certRecord,
  });

  const passFindings = findings.filter((f) => f.status === 'PASS');
  const deviationFindings = findings.filter((f) => f.status === 'DEVIATION');
  const reviewFindings = findings.filter((f) => f.status === 'REVIEW_REQUIRED');
  const gapFindings = findings.filter((f) => f.status === 'DOCUMENTATION_GAP');

  console.log(`\nEvaluation Breakdown:`);
  console.log(`- Total Findings: ${findings.length}`);
  console.log(`- PASS (Conforming): ${passFindings.length}`);
  console.log(`- DEVIATION: ${deviationFindings.length}`);
  console.log(`- REVIEW_REQUIRED: ${reviewFindings.length}`);
  console.log(`- DOCUMENTATION_GAP: ${gapFindings.length}\n`);

  // Assertions
  assert(passFindings.length === 23, 'Conforming requirements count is exactly 23', `Found ${passFindings.length} conforming requirements`);
  assert(deviationFindings.length === 1, 'Deviations count is exactly 1 (MESC 2022 vs 2021)', `Found ${deviationFindings.length} deviations`);
  assert(reviewFindings.length === 2, 'Review Required count is exactly 2 (HT Soaking & NACE)', `Found ${reviewFindings.length} review required`);
  assert(gapFindings.length === 1, 'Documentation Gap count is exactly 1 (Surface NDE PT/UT)', `Found ${gapFindings.length} documentation gaps`);

  // Verify Chemistry Conforming
  const cFinding = findings.find((f) => f.field === 'C');
  assert(cFinding?.status === 'PASS', 'Carbon (C = 0.018 wt% <= 0.030 wt%) is PASS', `Status: ${cFinding?.status}, Raw: ${cFinding?.supplierRawValue}`);

  const crFinding = findings.find((f) => f.field === 'Cr');
  assert(crFinding?.status === 'PASS', 'Chromium (Cr = 16.32 wt% in 16-18 wt%) is PASS', `Status: ${crFinding?.status}, Raw: ${crFinding?.supplierRawValue}`);

  // Verify Mechanical Conforming
  const ysFinding = findings.find((f) => f.field === 'yieldStrength');
  assert(ysFinding?.status === 'PASS', 'Yield Strength (232 MPa >= 205 MPa) is PASS', `Status: ${ysFinding?.status}, Raw: ${ysFinding?.supplierRawValue}`);

  const tsFinding = findings.find((f) => f.field === 'tensileStrength');
  assert(tsFinding?.status === 'PASS', 'Tensile Strength (523 MPa >= 515 MPa) is PASS', `Status: ${tsFinding?.status}, Raw: ${tsFinding?.supplierRawValue}`);

  const frFinding = findings.find((f) => f.field === 'forgingRatio');
  assert(frFinding?.status === 'PASS', 'Forging Ratio (>4:1 >= 4:1) is PASS', `Status: ${frFinding?.status}, Raw: ${frFinding?.supplierRawValue}`);

  // Verify Standard Discrepancy (MESC SPE 77/302:2022 vs 2021)
  const mescFinding = findings.find((f) => f.field === 'mescStandardRevision');
  assert(mescFinding?.status === 'DEVIATION', 'MESC SPE 77/302:2022 vs 2021 discrepancy is DEVIATION', `Status: ${mescFinding?.status}, Raw: ${mescFinding?.supplierRawValue}`);

  // Verify Hardness (HBW vs HRC conversion)
  const hardFinding = findings.find((f) => f.field === 'hardness');
  assert(hardFinding?.status === 'PASS', 'Hardness (179 HBW <= 237 HBW / 22 HRC limit) is PASS', `Status: ${hardFinding?.status}, Raw: ${hardFinding?.supplierRawValue}`);

  // Verify HT Soaking Ruling Thickness
  const soakFinding = findings.find((f) => f.field === 'heatTreatmentSoaking');
  assert(soakFinding?.status === 'REVIEW_REQUIRED', 'HT Soaking without thickness is REVIEW_REQUIRED', `Status: ${soakFinding?.status}, Raw: ${soakFinding?.supplierRawValue}`);

  // Verify NACE Edition Review
  const naceFinding = findings.find((f) => f.field === 'naceCompliance');
  assert(naceFinding?.status === 'REVIEW_REQUIRED', 'NACE compliance edition check is REVIEW_REQUIRED', `Status: ${naceFinding?.status}, Raw: ${naceFinding?.supplierRawValue}`);

  // Verify Surface NDE Missing
  const ndeFinding = findings.find((f) => f.field === 'ndeExamination');
  assert(ndeFinding?.status === 'DOCUMENTATION_GAP', 'Surface NDE PT/UT missing is DOCUMENTATION_GAP', `Status: ${ndeFinding?.status}`);

  // Verify EN 10204 Type 3.1
  const certFinding = findings.find((f) => f.field === 'en10204Type');
  assert(certFinding?.status === 'PASS', 'EN 10204 Type 3.1 certificate is PASS', `Status: ${certFinding?.status}`);

  // Verify Independence: Total Findings = Pass + Deviation + Review + Gap
  assert(
    findings.length === passFindings.length + deviationFindings.length + reviewFindings.length + gapFindings.length,
    'Requirement status isolation verified: Total equals sum of distinct status categories',
    `Total (${findings.length}) = Pass (${passFindings.length}) + Dev (${deviationFindings.length}) + Review (${reviewFindings.length}) + Gap (${gapFindings.length})`
  );

  // 5. Test 3-Requirement Synthetic Aggregation (A = PASS, B = DEVIATION, C = REVIEW_REQUIRED)
  console.log('\nTesting Synthetic 3-Requirement Aggregation (A = PASS, B = DEVIATION, C = REVIEW_REQUIRED):');
  const syntheticReqs: Requirement[] = [
    {
      id: 'req-a-pass',
      category: 'chemical',
      field: 'C',
      displayName: 'Carbon (C)',
      operator: 'MAX',
      maxValue: 0.03,
      unit: '%',
      mandatory: true,
      description: 'Maximum Carbon 0.03 wt%',
      sourceDocument: 'Spec-A',
      sourcePage: 1,
    },
    {
      id: 'req-b-dev',
      category: 'general',
      field: 'mescStandardRevision',
      displayName: 'MESC Standard Revision',
      operator: 'MATCH',
      targetValue: 'MESC SPE 77/302:2022',
      mandatory: true,
      description: 'MESC SPE 77/302:2022 edition',
      sourceDocument: 'Spec-A',
      sourcePage: 1,
    },
    {
      id: 'req-c-rev',
      category: 'general',
      field: 'mdsSpecificationIdentity',
      displayName: 'MDS Specification Identity Verification',
      operator: 'REQUIRED',
      mandatory: true,
      description: 'Specification identity verification required',
      sourceDocument: 'Spec-A',
      sourcePage: 1,
    },
  ];

  const syntheticCert: CertificateRecord = {
    id: 'cert-synth-01',
    documentId: 'doc-synth-01',
    mtcNumber: 'MTC-SYNTH-01',
    supplierName: 'Synthetic Mill',
    clientName: 'Client Synthetic',
    issueDate: '2026-09-01',
    materialGrade: 'ASTM A182 F316',
    standard: 'ASTM A182 F316',
    heats: ['HEAT-01'],
    evidenceItems: [
      {
        id: 'ev-c',
        certificateId: 'cert-synth-01',
        heatNo: 'HEAT-01',
        category: 'chemical',
        field: 'C',
        displayName: 'Carbon (C)',
        rawValue: '0.018 %',
        normalizedValue: 0.018,
        unit: '%',
        sourceDocument: 'MTC-SYNTH-01',
        sourcePage: 1,
        snippet: 'C: 0.018%',
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      },
      {
        id: 'ev-mesc',
        certificateId: 'cert-synth-01',
        heatNo: 'HEAT-01',
        category: 'general',
        field: 'mescStandardRevision',
        displayName: 'MESC Standard Revision',
        rawValue: 'MESC SPE 77/302:2021',
        sourceDocument: 'MTC-SYNTH-01',
        sourcePage: 1,
        snippet: 'MESC SPE 77/302:2021',
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      },
    ] as any,
  };

  const syntheticFindings = evaluateCompliance({
    analysisId: 'analysis-synth-01',
    requirements: syntheticReqs,
    certificate: syntheticCert,
  });

  const synthPass = syntheticFindings.filter((f) => f.status === 'PASS').length;
  const synthDev = syntheticFindings.filter((f) => f.status === 'DEVIATION').length;
  const synthRev = syntheticFindings.filter((f) => f.status === 'REVIEW_REQUIRED').length;
  const synthAll = syntheticFindings.length;

  assert(synthAll === 3, 'Synthetic Total = 3', `All Requirements = ${synthAll}`);
  assert(synthPass === 1, 'Synthetic Conforming = 1 (Requirement A is PASS)', `Conforming = ${synthPass}`);
  assert(synthDev === 1, 'Synthetic Deviations = 1 (Requirement B is DEVIATION)', `Deviations = ${synthDev}`);
  assert(synthRev === 1, 'Synthetic Review Required = 1 (Requirement C is REVIEW_REQUIRED)', `Review Required = ${synthRev}`);
  assert(
    !(synthAll === 1 && synthDev === 1 && synthPass === 0),
    'Verification that evaluation DOES NOT collapse to All=1, Issues=1, Conforming=0',
    'Requirement statuses are strictly isolated'
  );

  console.log('\n───────────────────────────────────────────────────────');
  console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('───────────────────────────────────────────────────────\n');


  if (failed > 0) {
    process.exit(1);
  }
}

runCompliancePhasesTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

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

  // 6. Test Real Tabular MTC Document Text Extraction & Evaluation
  console.log('\nTesting Real Tabular EN 10204 3.1 MTC Text from Mill:');
  const realMtcTabularText = `
材质测试报告 MATERIAL TEST REPORT EN 10204 Type 3.1 证书号 TC No.: WW2604133-3 日期 DATE: 2026-5-25 页数 PAGE ： 1 OF 1 制造商 Manufacturer ： WENZHOU WINWAY MECHANICAL & ELECTRICAL EQUIPMENT CO., LTD 客户 Client ： HAWA VALVE INDIA PVT. LTD. 原材料证书号 MTC Numbers WW2604133- A 3 生产号 Production No. ： WW2604-133 客户合同号 Contract No. ： IMP004774 材料成分和性能 MATERRIAL COMPONENTS AND PROPERTIES 材料 MATERIAL 热处理 HEAT TREATMENT 热处理温度 TEMPERATURE 保温时间 HOLDING TIME(h) 冷却方式 COOLING TYPE We hereby certify that the material was manufactured, sampled, tested and inspected in accordance with ASTM 182 Grade F316-2023, NACE MR0175/ISO15156:2015, MESC SPE 77/302:2021, and Hawa MDS-QE-F-ASS-ASTM-A182-F316-NACE-6D-001-[N1157]-REV A and meet the requirements. ASTM 182 Grade F316 (UNS S31600) 固溶 Solution Annealed 1040 ℃ 2h 水冷 Water Cooling 零部件名称 PART NAME 数量 QTY 材料 MATERIAL 炉号 HEAT NO. 化学成份（ % ） CHEMICAL COMPOSITION 机械性能 MECHANICAL PROPERTY C% Si% Mn% P% S% Cr% Ni% Mo% Cu% Fe% Al% N% Ni+2Mo PREN Y.S. 0.2% Ten. Elongati on % (4D) R% Hardness HBW IMPACT TEST TEMP. °C: -196°C Direction: Longitudinal (Mpa) (Mpa) 标准 Reference ASTM A182 Min. -- -- -- -- -- 16.000 10.000 2.000 -- -- -- -- 14.00 23.00 205 515 30 50 -- (J)Avg. / (J) Min. Avg. Value Max. 0.030 1.000 2.000 0.045 0.030 18.000 14.000 3.000 -- -- -- 0.100 20.00 28.00 -- -- -- -- 237 Ball Valve Stem 6" - 900# RF 1 A182 F316 FK2407-061 0.018 0.367 0.950 0.036 0.0008 16.320 10.070 2.037 -- -- -- 0.052 14.144 23.87 232 523 47 68 173,175,179 -- -- -- -- Ball Valve Ball 3 " - 900# RF 2 A182 F316 FK2407-061 0.018 0.367 0.950 0.036 0.0008 16.320 10.070 2.037 -- -- -- 0.052 14.144 23.87 232 523 47 68 173,175,179 -- -- -- -- Note: Remark: (1) Visual examination carried out on components as per ASME BPVC SEC VIII, Div. 1, UF-45, & UF-46 and ASTM A182/A182M and found satisfactory. (2) Dimensional inspection carried out as per drawing & PO and results found satisfactory. (3) No weld repairs have been conducted on above components. (4) Forging ratio is more than 4:1 (5) Pickling and Passivation done as per ASTM A380. (6) Steel making: Electric arc furnace (7) Material is free from radioactive contamination. (8)IGC test carried out as per ASTM A262 Practice E and results found satisfactory. We hereby certify that the valves listed above are manufactured and tested in accordance with WITNESSED BY: HE DENGHONG the requirement of valve standard and purchase order. WINWAY VALVE QC Manager Martin
`;

  const realMtcExtracted = await extractSupplierEvidenceWithAI(realMtcTabularText, mtcFilename);
  assert(realMtcExtracted.evidence.length >= 20, 'Tabular MTC evidence extraction extracts all chemistry and mechanical values', `Extracted ${realMtcExtracted.evidence.length} items`);

  const realCertRecord: CertificateRecord = {
    id: 'cert-real-mtc',
    documentId: 'doc-real-mtc',
    mtcNumber: realMtcExtracted.certificateMetadata.mtcNumber || 'WW2604133-3',
    supplierName: realMtcExtracted.certificateMetadata.supplierName || 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd',
    clientName: 'HAWA VALVES',
    poNumber: 'IMP004774',
    issueDate: '2026-05-25',
    materialGrade: 'ASTM A182 F316',
    standard: 'ASTM A182 F316',
    heats: ['FK2407-061'],
    evidenceItems: realMtcExtracted.evidence as any,
  };

  const realFindings = evaluateCompliance({
    analysisId: 'analysis-real-mtc',
    requirements,
    certificate: realCertRecord,
  });

  const realPass = realFindings.filter((f) => f.status === 'PASS');
  const realDev = realFindings.filter((f) => f.status === 'DEVIATION');
  const realRev = realFindings.filter((f) => f.status === 'REVIEW_REQUIRED');
  const realGap = realFindings.filter((f) => f.status === 'DOCUMENTATION_GAP');

  assert(realPass.length === 23, 'Real Tabular MTC PASS count is exactly 23', `Pass: ${realPass.length}`);
  assert(realDev.length === 1, 'Real Tabular MTC DEVIATION count is exactly 1 (MESC 2022 vs 2021)', `Dev: ${realDev.length}`);
  assert(realRev.length === 2, 'Real Tabular MTC REVIEW_REQUIRED count is exactly 2 (HT Soaking & NACE)', `Rev: ${realRev.length}`);
  assert(realGap.length === 1, 'Real Tabular MTC DOCUMENTATION_GAP count is exactly 1 (Surface NDE PT/UT)', `Gap: ${realGap.length}`);

  // Chemistry specific assertions on real MTC
  const cReal = realFindings.find((f) => f.field === 'C');
  assert(cReal?.supplierRawValue === '0.018 %' && cReal?.status === 'PASS', 'Carbon C=0.018 wt% extracted and evaluated as PASS', `Raw: ${cReal?.supplierRawValue}`);

  const mnReal = realFindings.find((f) => f.field === 'Mn');
  assert(mnReal?.supplierRawValue === '0.950 %' && mnReal?.status === 'PASS', 'Manganese Mn=0.950 wt% extracted and evaluated as PASS', `Raw: ${mnReal?.supplierRawValue}`);

  const sReal = realFindings.find((f) => f.field === 'S');
  assert(sReal?.supplierRawValue === '0.0008 %' && sReal?.status === 'PASS', 'Sulfur S=0.0008 wt% extracted and evaluated as PASS', `Raw: ${sReal?.supplierRawValue}`);

  const nReal = realFindings.find((f) => f.field === 'N');
  assert(nReal?.supplierRawValue === '0.052 %' && nReal?.status === 'PASS', 'Nitrogen N=0.052 wt% extracted and evaluated as PASS', `Raw: ${nReal?.supplierRawValue}`);

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

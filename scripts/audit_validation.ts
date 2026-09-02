import { extractMDSIdentity, generateRequirementsForMDS, extractSupplierEvidenceWithAI } from '../server/gemini';
import { evaluateCompliance } from '../src/engine/rules';

async function main() {
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

  const mdsIdentity = extractMDSIdentity('', mdsFilename);
  const requirements = generateRequirementsForMDS(mdsIdentity, mdsFilename);
  const { evidence, certificateMetadata } = await extractSupplierEvidenceWithAI(f316MtcText, mtcFilename);

  const certRecord = {
    id: 'cert-01',
    documentId: 'doc-01',
    mtcNumber: certificateMetadata.mtcNumber,
    supplierName: certificateMetadata.supplierName,
    clientName: 'Client',
    issueDate: '2026-09-01',
    materialGrade: certificateMetadata.materialGrade,
    standard: 'ASTM A182 F316',
    heats: certificateMetadata.heats,
    evidenceItems: evidence as any,
  };

  const findings = evaluateCompliance({
    analysisId: 'ana-01',
    requirements: requirements as any,
    certificate: certRecord as any,
  });

  console.log('\n========================================================================================================================');
  console.log('Requirement | MDS requirement | MTC evidence | Status | Reason');
  console.log('---|---|---|---|---');
  findings.forEach((f, idx) => {
    const req = (requirements as any).find((r: any) => r.id === f.requirementId);
    if (!req) return;
    const target =
      req.operator === 'MIN'
        ? '>=' + req.minValue + ' ' + (req.unit || '')
        : req.operator === 'MAX'
        ? '<=' + req.maxValue + ' ' + (req.unit || '')
        : req.operator === 'RANGE'
        ? req.minValue + ' to ' + req.maxValue + ' ' + (req.unit || '')
        : req.operator === 'MATCH'
        ? req.targetValue
        : req.operator;
    console.log(
      `${req.displayName} | ${target} (${req.description}) | ${f.supplierRawValue || 'NOT IDENTIFIED'} | ${f.status} | ${f.reason || 'Evaluated deterministically'}`
    );
  });

  const pass = findings.filter((f) => f.status === 'PASS').length;
  const dev = findings.filter((f) => f.status === 'DEVIATION').length;
  const rev = findings.filter((f) => f.status === 'REVIEW_REQUIRED').length;
  const gap = findings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
  console.log('========================================================================================================================\n');
  console.log(`Summary: Total=${findings.length}, PASS=${pass}, DEVIATION=${dev}, REVIEW_REQUIRED=${rev}, DOCUMENTATION_GAP=${gap}`);
  console.log(`Sum Check: ${pass} (PASS) + ${dev} (DEV) + ${rev} (REV) + ${gap} (GAP) = ${pass + dev + rev + gap} (Total: ${findings.length})\n`);
}

main().catch(console.error);

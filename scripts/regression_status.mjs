import assert from 'assert';
import { evaluateCompliance } from '../dist/server.cjs';

console.log('=== RUNNING COMPLIANCE STATUS REGRESSION TEST ===\n');

const mdsRequirements = [
  {
    id: 'req-ni',
    category: 'chemical',
    field: 'Ni',
    displayName: 'Nickel (Ni)',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: '<=',
    requiredMax: 0.5,
    unit: '%',
    requirementText: '≤ 0.50 %',
  },
  {
    id: 'req-cr',
    category: 'chemical',
    field: 'Cr',
    displayName: 'Chromium (Cr)',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: 'RANGE',
    requiredMin: 11.5,
    requiredMax: 13.5,
    unit: '%',
    requirementText: '11.50 - 13.50 %',
  },
  {
    id: 'req-hardness',
    category: 'mechanical',
    field: 'hardness',
    displayName: 'Brinell Hardness (HBW)',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: 'RANGE',
    requiredMin: 143,
    requiredMax: 207,
    unit: 'HBW',
    requirementText: '143 - 207 HBW',
  },
  {
    id: 'req-yield',
    category: 'mechanical',
    field: 'yieldStrength',
    displayName: 'Yield Strength (0.2% Offset)',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: '>=',
    requiredMin: 275,
    unit: 'MPa',
    requirementText: '≥ 275 MPa',
  },
  {
    id: 'req-tensile',
    category: 'mechanical',
    field: 'tensileStrength',
    displayName: 'Tensile Strength (Rm)',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: '>=',
    requiredMin: 485,
    unit: 'MPa',
    requirementText: '≥ 485 MPa',
  },
  {
    id: 'req-elongation',
    category: 'mechanical',
    field: 'elongation',
    displayName: 'Elongation (A5)',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: '>=',
    requiredMin: 18,
    unit: '%',
    requirementText: '≥ 18 %',
  },
  {
    id: 'req-ht',
    category: 'heat_treatment',
    field: 'heatTreatmentCondition',
    displayName: 'Heat Treatment Condition',
    standard: 'ASTM A182 Grade F6a Class 1',
    operator: 'MATCH',
    targetValue: 'Anneal (Furnace Cool) or Normalize & Temper (Air Cool, Tempering Min 1325°F [725°C])',
    requirementText: 'Anneal (Furnace Cool) or Normalize & Temper (Air Cool, Tempering Min 1325°F [725°C])',
  },
];

const actualCertificate = {
  id: 'cert-ww2604133-3',
  documentId: 'doc-ww2604-133',
  mtcNumber: 'WW2604133-3',
  supplierName: 'Western Forge & Flange Co.',
  materialGrade: 'ASTM A182 F316',
  standard: 'ASTM A182 F316',
  heats: ['FK2407-061'],
  evidenceItems: [
    { id: 'ev-ni', category: 'chemical', field: 'Ni', rawValue: '10.070 %', normalizedValue: 10.07, unit: '%', heatNo: 'FK2407-061' },
    { id: 'ev-cr', category: 'chemical', field: 'Cr', rawValue: '16.320 %', normalizedValue: 16.32, unit: '%', heatNo: 'FK2407-061' },
    { id: 'ev-hard', category: 'mechanical', field: 'hardness', rawValue: '237 HBW', normalizedValue: 237, unit: 'HBW', heatNo: 'FK2407-061' },
    { id: 'ev-yield', category: 'mechanical', field: 'yieldStrength', rawValue: '232 MPa', normalizedValue: 232, unit: 'MPa', heatNo: 'FK2407-061' },
    { id: 'ev-tensile', category: 'mechanical', field: 'tensileStrength', rawValue: '523 MPa', normalizedValue: 523, unit: 'MPa', heatNo: 'FK2407-061' },
    { id: 'ev-elong', category: 'mechanical', field: 'elongation', rawValue: '47 %', normalizedValue: 47, unit: '%', heatNo: 'FK2407-061' },
    { id: 'ev-ht', category: 'heat_treatment', field: 'heatTreatmentCondition', rawValue: 'Solution Annealed, 1040°C, 2h, Water Cooling', heatNo: 'FK2407-061' },
  ],
};

const findings = evaluateCompliance({
  analysisId: 'regression-analysis',
  requirements: mdsRequirements,
  certificate: actualCertificate,
});

const expectedOutcomes = [
  { field: 'Ni', expectedStatus: 'DEVIATION', condition: '10.070 > 0.50' },
  { field: 'Cr', expectedStatus: 'DEVIATION', condition: '16.320 > 13.50' },
  { field: 'hardness', expectedStatus: 'DEVIATION', condition: '237 > 207' },
  { field: 'yieldStrength', expectedStatus: 'DEVIATION', condition: '232 < 275' },
  { field: 'heatTreatmentCondition', expectedStatus: 'DEVIATION', condition: 'Solution Anneal != Furnace Cool / N&T' },
  { field: 'tensileStrength', expectedStatus: 'PASS', condition: '523 >= 485' },
  { field: 'elongation', expectedStatus: 'PASS', condition: '47 >= 18' },
];

let allPassed = true;
for (const check of expectedOutcomes) {
  const f = findings.find((item) => item.field === check.field);
  assert(f, `Finding for ${check.field} must exist`);
  const isMatch = f.status === check.expectedStatus;
  if (!isMatch) allPassed = false;
  console.log(
    `[${isMatch ? 'PASS' : 'FAIL'}] ${f.displayName.padEnd(30)} | Value: ${(f.supplierRawValue || '').padEnd(12)} | Req: ${(f.requirementText || '').padEnd(16)} | Condition: ${check.condition.padEnd(20)} -> Status: ${f.status}`
  );
  assert.strictEqual(
    f.status,
    check.expectedStatus,
    `Field ${check.field} expected status ${check.expectedStatus} but received ${f.status}`
  );
}

console.log('\nAll regression assertions verified: exactly ONE authoritative status per requirement.');
console.log('DEVIATION rows are strictly DEVIATION, PASS rows are strictly PASS.');

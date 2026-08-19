/**
 * Metallurgical Carbon Equivalent (CE) Engine
 * Implements IIW and ASTM A105 formula:
 * CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15
 */

export interface ChemistryElements {
  C?: number;
  Mn?: number;
  P?: number;
  S?: number;
  Si?: number;
  Cr?: number;
  Mo?: number;
  Ni?: number;
  Cu?: number;
  V?: number;
  Nb?: number;
  Ti?: number;
  Al?: number;
  N?: number;
  [key: string]: number | undefined;
}

export interface CECalculationResult {
  calculatedCE: number;
  formula: string;
  elementsUsed: ChemistryElements;
  breakdown: string;
  isCompliantWithLimit: boolean;
  maxLimit: number;
  reportedCE?: number;
  discrepancyWithReported?: number;
  isDiscrepancySignificant: boolean;
}

/**
 * Calculates Carbon Equivalent using standard ASTM A105 / IIW formula
 */
export function calculateCarbonEquivalent(
  chemistry: ChemistryElements,
  maxLimit: number = 0.43,
  reportedCE?: number
): CECalculationResult {
  const c = chemistry.C || 0;
  const mn = chemistry.Mn || 0;
  const cr = chemistry.Cr || 0;
  const mo = chemistry.Mo || 0;
  const v = chemistry.V || 0;
  const ni = chemistry.Ni || 0;
  const cu = chemistry.Cu || 0;

  const mnPart = mn / 6;
  const crMoVPart = (cr + mo + v) / 5;
  const niCuPart = (ni + cu) / 15;

  const rawCE = c + mnPart + crMoVPart + niCuPart;
  const calculatedCE = Math.round(rawCE * 1000) / 1000;

  const formula = 'CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15';
  const breakdown = `${c.toFixed(3)} + (${mn.toFixed(3)}/6) + ((${cr.toFixed(3)}+${mo.toFixed(3)}+${v.toFixed(3)})/5) + ((${ni.toFixed(3)}+${cu.toFixed(3)})/15) = ${calculatedCE.toFixed(3)}`;

  const isCompliantWithLimit = calculatedCE <= maxLimit;

  let discrepancyWithReported: number | undefined = undefined;
  let isDiscrepancySignificant = false;

  if (reportedCE !== undefined && !isNaN(reportedCE)) {
    discrepancyWithReported = Math.abs(calculatedCE - reportedCE);
    // Flag if discrepancy > 0.015
    isDiscrepancySignificant = discrepancyWithReported > 0.015;
  }

  return {
    calculatedCE,
    formula,
    elementsUsed: { C: c, Mn: mn, Cr: cr, Mo: mo, V: v, Ni: ni, Cu: cu },
    breakdown,
    isCompliantWithLimit,
    maxLimit,
    reportedCE,
    discrepancyWithReported,
    isDiscrepancySignificant,
  };
}

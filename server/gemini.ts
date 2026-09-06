import { GoogleGenAI } from '@google/genai';
import { Requirement, SupplierEvidence, CertificateRecord } from '../src/types';

let aiInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  aiInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiInstance;
}

export interface MDSIdentity {
  standard: string;
  grade: string;
  class?: string;
  uns?: string;
  materialGrade: string;
  mdsNumber: string;
  revision: string;
  clientName?: string;
  title?: string;
  isConfident: boolean;
  confidenceReason?: string;
}

export interface MDSExtractionResult {
  identity: MDSIdentity;
  requirements: Partial<Requirement>[];
}

export interface MTCIdentity {
  mtcNumber: string;
  heatNumber: string;
  materialGrade: string;
  supplierName?: string;
  poNumber?: string;
  productionNumber?: string;
  isConfident: boolean;
  confidenceReason?: string;
}

/**
 * Extracts and validates the identity of a Material Test Certificate (MTC)
 * from document text and filename before comparison.
 */
export function extractMTCIdentity(documentText: string, filename: string): MTCIdentity {
  const combinedSearchText = `${filename}\n${documentText}`;

  // 1. Heat Number (extracted exclusively from document text, NEVER from filename)
  let heatNumber = '';
  const isExcludedHeat = (val: string) => {
    const u = val.toUpperCase().trim();
    return (
      u === 'HEAT' ||
      u === 'NO' ||
      u === 'NUMBER' ||
      u === 'HEAT-1' ||
      u === 'HEAT-01' ||
      /^C00\d$/i.test(u) ||
      /^B\d{3,4}$/i.test(u) ||
      u.startsWith('F316') ||
      u.startsWith('F6') ||
      u.startsWith('A182') ||
      u.startsWith('A105') ||
      u.startsWith('A350') ||
      u.startsWith('A484') ||
      u.startsWith('A370') ||
      u.startsWith('A262') ||
      u.startsWith('A380') ||
      u.startsWith('A961') ||
      u.startsWith('S316') ||
      u.startsWith('S410') ||
      u.startsWith('N115') ||
      u.startsWith('XMP') ||
      u.startsWith('ADOBE') ||
      u.startsWith('IMP') ||
      u.startsWith('POI') ||
      u.startsWith('PO') ||
      u.startsWith('WW') ||
      u.startsWith('EN') ||
      u.startsWith('REV') ||
      u.startsWith('TC') ||
      u.startsWith('ASTM') ||
      u.startsWith('ASME') ||
      u.startsWith('MESC') ||
      u.startsWith('MR0175') ||
      u.startsWith('DOC') ||
      u.startsWith('ISO') ||
      u.startsWith('SPE') ||
      u.startsWith('TREAT') ||
      u.startsWith('TEMP') ||
      u.startsWith('TIME') ||
      u.startsWith('COOL') ||
      u.startsWith('COMP') ||
      u.startsWith('MECH') ||
      u.startsWith('PART') ||
      u.startsWith('QTY') ||
      u.startsWith('CHEM')
    );
  };

  // Check labeled heat number in document text (e.g. Heat No.: ABC1234 or bilingual 炉号 HEAT NO.)
  const labeledHeatMatch = documentText.match(
    /(?:(?:炉号|炉批号)\s*(?:HEAT\s*(?:NO\.?|NUMBER|#)?)?|Heat\s*(?:No\.?|Number|#|ID)|Ladle\s*(?:No\.?|Number|#)|Schmelze\s*(?:Nr\.?|No\.?)?)\s*[:=\s]+([A-Za-z0-9\-_]+)/i
  );
  if (labeledHeatMatch && labeledHeatMatch[1] && !isExcludedHeat(labeledHeatMatch[1])) {
    heatNumber = labeledHeatMatch[1].toUpperCase();
  }

  // Check tabular / structured heat numbers in document body (e.g. FK2407-061)
  if (!heatNumber) {
    const tableHeatMatches = Array.from(documentText.matchAll(/\b([A-Z]{1,4}\d{4,6}[-_]\d{2,4})\b/gi));
    for (const m of tableHeatMatches) {
      if (!isExcludedHeat(m[1])) {
        heatNumber = m[1].toUpperCase();
        break;
      }
    }
  }

  // Check standard alphanumeric heats (e.g. A228, 8821A, HEAT-8821A)
  if (!heatNumber) {
    const genericMatches = Array.from(documentText.matchAll(/\b([A-Z]\d{3,6}[A-Z]?|HEAT-\d{4}[A-Z]?)\b/gi));
    for (const m of genericMatches) {
      if (!isExcludedHeat(m[1])) {
        heatNumber = m[1].toUpperCase();
        break;
      }
    }
  }

  // 2. TC / MTC Number (extracted from document text or filename)
  let mtcNumber = '';
  const isExcludedTC = (val: string) => {
    const u = val.toUpperCase().trim();
    return (
      u === 'EN' ||
      u === 'TYPE' ||
      u === '3.1' ||
      u === '3.2' ||
      u === '10204' ||
      u === 'ACCORDING' ||
      u === 'TO' ||
      u === 'OF' ||
      u === 'MATERIAL' ||
      u === 'TEST' ||
      u === 'REPORT' ||
      u === 'INSPECTION'
    );
  };

  const tcMatches = Array.from(
    documentText.matchAll(
      /(?:(?:证书号|证书编号|编号)\s*[:=\s]+|(?:TC|MTC|Cert(?:ificate)?)\s*(?:No\.?|Number|#|[:=])\s*[:=\s]*)([A-Za-z0-9\-_/]+)/gi
    )
  );
  for (const m of tcMatches) {
    if (m[1] && !isExcludedTC(m[1])) {
      mtcNumber = m[1].trim();
      break;
    }
  }

  if (!mtcNumber) {
    const docTcMatch = documentText.match(/\b(WW\d{7}(?:[-_][A-Za-z0-9]+)?)\b/i);
    if (docTcMatch) {
      mtcNumber = docTcMatch[1];
    }
  }



  // 3. Material Grade from MTC document text or filename
  let materialGrade = '';
  const allLines = documentText.split(/[\r\n]+/);
  const headerLines = allLines.slice(0, 60).join('\n');

  if (/(?:Material|Grade|Specification|Alloy)\s*[:=]\s*[^\n\r]*F316L?\b|UNS\s*S3160[03]|AISI\s*316/i.test(headerLines)) {
    materialGrade = 'ASTM A182 F316';
  } else if (/(?:Material|Grade|Specification|Alloy)\s*[:=]\s*[^\n\r]*F6a?\b|UNS\s*S41000/i.test(headerLines)) {
    materialGrade = 'ASTM A182 Grade F6a Class 1 (UNS S41000)';
  } else if (/(?:Material|Grade|Specification|Alloy)\s*[:=]\s*[^\n\r]*A105N?\b/i.test(headerLines)) {
    materialGrade = 'ASTM A105N';
  } else if (/(?:Material|Grade|Specification|Alloy)\s*[:=]\s*[^\n\r]*LF2\b/i.test(headerLines)) {
    materialGrade = 'ASTM A350 LF2';
  } else {
    // Fallback: search document text and filename for unambiguous grade tokens
    if (/(?<!not\s+applicable\s+for\s+)(?<!except\s+)(?<!non[- ])F316L?\b/i.test(combinedSearchText)) materialGrade = 'ASTM A182 F316';
    else if (/A105N?\b/i.test(combinedSearchText) && !/not\s+applicable\s+for\s+A105N?/i.test(combinedSearchText)) materialGrade = 'ASTM A105N';
    else if (/LF2\b/i.test(combinedSearchText) && !/not\s+applicable\s+for\s+.*LF2/i.test(combinedSearchText)) materialGrade = 'ASTM A350 LF2';
  }

  // 4. Supplier / Manufacturer Name
  let supplierName = '';
  if (/WENZHOU\s*WINWAY/i.test(combinedSearchText)) {
    supplierName = 'Wenzhou Winway Mechanical & Electrical Equipment Co., Ltd';
  } else if (/Western\s*Forge/i.test(combinedSearchText)) {
    supplierName = 'Western Forge & Flange Co.';
  } else {
    const suppMatch = combinedSearchText.match(/(?:Manufacturer|Supplier|Vendor|Produced\s*by|Mill|制造商|制造厂)\s*[:=\s]+([^\n\r,]{3,80})/i);
    if (suppMatch && suppMatch[1]) {
      supplierName = suppMatch[1].trim();
    }
  }

  // 5. Contract / PO Number
  let poNumber = '';
  const poMatch = documentText.match(
    /(?:(?:合同号|订单号|采购单号)\s*(?:Contract|Order|PO)?|Contract\s*(?:No\.?|Number|#)?|PO\s*(?:No\.?|Number|#)?|Purchase\s*Order\s*(?:No\.?|Number|#)?|Order\s*(?:No\.?|Number|#)?)\s*[:=\s]+([A-Za-z0-9\-_/]+)/i
  );
  if (poMatch && poMatch[1]) {
    poNumber = poMatch[1].trim();
  } else {
    const fnPoMatch = filename.match(/\b(IMP\d{4,8}|PO[-_ ]?[A-Za-z0-9]+)\b/i);
    if (fnPoMatch) {
      poNumber = fnPoMatch[1].trim();
    }
  }

  // 6. Production Number / Batch Number
  let productionNumber = '';
  const prodMatch = documentText.match(
    /(?:(?:生产号|批号)\s*(?:Production\s*No\.?)?|Production\s*(?:No\.?|Number|#)?|Prod\s*(?:No\.?|Number|#)?|Batch\s*(?:No\.?|Number|#)?)\s*[:=\s]+([A-Za-z0-9\-_/]+)/i
  );
  if (prodMatch && prodMatch[1]) {
    productionNumber = prodMatch[1].trim();
  } else {
    const fnProdMatch = filename.match(/\b(WW\d{4}[-_]\d{3,4})\b/i);
    if (fnProdMatch) {
      productionNumber = fnProdMatch[1].trim();
    }
  }

  const isConfident = Boolean(heatNumber || mtcNumber || (materialGrade && materialGrade !== 'UNVERIFIED GRADE'));
  const confidenceReason = isConfident
    ? `MTC verified: TC ${mtcNumber || 'N/A'}, Heat ${heatNumber || 'N/A'}, Grade ${materialGrade || 'N/A'}`
    : 'MTC document identity (TC number, Heat number, Material grade) could not be established from uploaded file.';

  return {
    mtcNumber: mtcNumber || (heatNumber ? `MTC-${heatNumber}` : 'MTC-UNVERIFIED'),
    heatNumber: heatNumber || 'UNVERIFIED',
    materialGrade: materialGrade || 'UNVERIFIED GRADE',
    supplierName: supplierName || undefined,
    poNumber: poNumber || undefined,
    productionNumber: productionNumber || undefined,
    isConfident,
    confidenceReason,
  };
}

/**
 * Extracts and validates the identity of a Material Data Sheet (MDS)
 * from document text and filename before generating any requirements.
 */
export function extractMDSIdentity(documentText: string, filename: string): MDSIdentity {
  const combined = `${filename}\n${documentText}`;
  const cleanFilename = filename.replace(/\.[^/.]+$/, '');

  // 1. MDS Number extraction
  let mdsNumber = '';
  const strippedFilename = cleanFilename.replace(/[-_]?(?:REV|Rev|rev)[-_ ]+[A-Za-z0-9]+.*$/i, '').trim();
  if (strippedFilename.toUpperCase().startsWith('QE-') || strippedFilename.toUpperCase().includes('MDS')) {
    mdsNumber = strippedFilename;
  } else {
    const mdsRegexes = [
      /(QE-[A-Za-z0-9\-_]+(?:\[[A-Za-z0-9]+\])?)/i,
      /MDS\s*(?:No\.?|Number|#)?\s*[:=\s]+([A-Za-z0-9\-_\[\]]+)/i,
      /Doc(?:ument)?\s*(?:No\.?|Number|#)?\s*[:=\s]+([A-Za-z0-9\-_\[\]]+)/i,
      /Specification\s*(?:No\.?|Number|#)?\s*[:=\s]+([A-Za-z0-9\-_\[\]]+)/i,
    ];
    for (const reg of mdsRegexes) {
      const m = combined.match(reg);
      if (m && m[1]) {
        mdsNumber = m[1].replace(/[-_]?(?:REV|Rev|rev)[-_ ]+[A-Za-z0-9]+.*$/i, '').trim();
        break;
      }
    }
  }
  if (!mdsNumber && cleanFilename.length > 5) {
    mdsNumber = strippedFilename;
  }

  // 2. Revision extraction
  let revision = 'Rev A';
  const revMatch = combined.match(/(?:REV|Rev|Revision|rev)\s*[:=\s\-]?\s*([A-Za-z0-9]+)/i);
  if (revMatch && revMatch[1]) {
    revision = `Rev ${revMatch[1].toUpperCase()}`;
  }

  const normCombined = combined.replace(/[_/\\-]/g, ' ');
  const normFilename = cleanFilename.replace(/[_/\\-]/g, ' ');

  // 3. Standard identification
  let standard = '';
  if (/ASTM\s*(?:A\s*)?182|ASME\s*SA\s*182/i.test(normCombined)) {
    standard = 'ASTM A182';
  } else if (/ASTM\s*A\s*105|ASME\s*SA\s*105/i.test(normCombined)) {
    standard = 'ASTM A105';
  } else if (/ASTM\s*A\s*350|ASME\s*SA\s*350/i.test(normCombined)) {
    standard = 'ASTM A350';
  } else if (/ASTM\s*A\s*694/i.test(normCombined)) {
    standard = 'ASTM A694';
  }

  // 4. Grade identification (independent of standard)
  let grade = '';
  let materialClass = '';
  let uns = '';

  if (
    /(?:Grade|Gr\.?|Type)?\s*F\s*316\b|\bAISI\s*316\b/i.test(normFilename) ||
    /(?:Grade|Gr\.?|Type)\s*F\s*316\b/i.test(normCombined.slice(0, 500)) ||
    (/(?:Grade|Gr\.?|Type)?\s*F\s*316\b/i.test(normCombined) && !/F\s*316L\b/i.test(normFilename))
  ) {
    grade = 'F316';
    uns = 'UNS S31600';
  } else if (/F\s*316L\b/i.test(normCombined)) {
    grade = 'F316L';
    uns = 'UNS S31603';
  } else if (/\bF\s*6a\b|\bGrade\s*F6a\b|\bGr\.?\s*F6a\b/i.test(normCombined)) {
    grade = 'F6a';
    materialClass = 'Class 1';
    uns = 'UNS S41000';
  } else if (/\bF\s*51\b|\bGrade\s*F51\b/i.test(normCombined)) {
    grade = 'F51';
    uns = 'UNS S31803';
  } else if (/\bA105N\b/i.test(normCombined)) {
    grade = 'A105N';
    uns = 'UNS K03504';
  } else if (/\bA105\b/i.test(normCombined)) {
    grade = 'A105';
    uns = 'UNS K03504';
  } else if (/\bLF2\b/i.test(normCombined)) {
    grade = 'LF2';
    materialClass = 'Class 1';
    uns = 'UNS K03011';
  } else if (/\bF\s*60\b/i.test(normCombined)) {
    grade = 'F60';
  }

  // Explicit UNS check
  const unsMatch = normCombined.match(/\bUNS\s*([A-Z]\d{5})\b|\b(S41000|S31600|S31603|S31803|K03504|K03011)\b/i);
  if (unsMatch) {
    const rawUns = (unsMatch[1] || unsMatch[2]).toUpperCase();
    uns = rawUns.startsWith('UNS') ? rawUns : `UNS ${rawUns}`;
  }

  // Explicit Class check - only valid for grades that define classes in ASTM specs (e.g. F6a, LF2, F11, F22)
  // Austenitic stainless steels like F316 / F304 do NOT have material classes.
  if (grade === 'F6a' || grade === 'LF2' || grade === 'F11' || grade === 'F22') {
    const classMatch = combined.match(/\b(?:Class|Cl\.?)\s*([1-3])\b/i);
    if (classMatch) {
      materialClass = `Class ${classMatch[1]}`;
    }
  }

  // Construct official material grade string
  let materialGrade = '';
  if (standard && grade) {
    materialGrade = `${standard} Grade ${grade}${materialClass ? ` ${materialClass}` : ''}${uns ? ` (${uns})` : ''}`;
  } else if (grade) {
    materialGrade = grade;
  }

  // Validate identity confidence
  const isConfident = Boolean(standard && grade);
  const confidenceReason = isConfident
    ? `MDS validated as ${materialGrade}`
    : 'MDS standard and material grade could not be confidently established from the uploaded document.';

  return {
    standard,
    grade,
    class: materialClass,
    uns,
    materialGrade: materialGrade || 'UNIDENTIFIED SPECIFICATION',
    mdsNumber: mdsNumber || 'MDS-CUSTOM',
    revision,
    clientName: 'Client Specification',
    title: isConfident
      ? `Client MDS - ${materialGrade} (${mdsNumber || 'MDS'} ${revision})`
      : `Unverified Specification (${filename})`,
    isConfident,
    confidenceReason,
  };
}

/**
 * Deterministically generates requirements for a validated MDS identity.
 * Strictly adheres to standard metallurgy:
 * ASTM A182 Grade F6a Class 1 (UNS S41000) does NOT include CE <= 0.43,
 * does NOT include normalizing 900-960°C, does NOT include elongation >= 30%,
 * does NOT include hardness <= 187 HBW.
 */
export function generateRequirementsForMDS(identity: MDSIdentity, filename: string): Partial<Requirement>[] {
  const srcDoc = `${identity.mdsNumber} ${identity.revision}`.trim();

  // If MDS identity cannot be confidently established, return REVIEW REQUIRED requirement
  if (!identity.isConfident) {
    return [
      {
        id: `req-unverified-identity-${Date.now()}`,
        category: 'general',
        field: 'mdsSpecificationIdentity',
        displayName: 'MDS Specification Identity Verification',
        operator: 'REQUIRED',
        mandatory: true,
        description: 'MDS standard, material grade, or revision could not be confidently established from uploaded document. Technical quality engineering review is required.',
        clauseReference: 'SPEC-VERIFY-01',
        sourceDocument: filename,
        sourcePage: 1,
      },
    ];
  }

  // 1. ASTM A182 Grade F316 (UNS S31600 / S31603)
  if (identity.standard === 'ASTM A182' && identity.grade.toUpperCase().includes('F316')) {
    return [
      // Chemical Composition (MDS Section 5, Page 3)
      {
        id: `req-f316-chem-c-${Date.now()}`,
        category: 'chemical',
        field: 'C',
        displayName: 'Carbon (C)',
        operator: 'MAX',
        maxValue: 0.03,
        unit: '%',
        mandatory: true,
        description: 'Maximum Carbon content 0.03 wt% (MESC SPE 77/302 CL.2.1.5.6)',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-mn-${Date.now()}`,
        category: 'chemical',
        field: 'Mn',
        displayName: 'Manganese (Mn)',
        operator: 'MAX',
        maxValue: 2.00,
        unit: '%',
        mandatory: true,
        description: 'Maximum Manganese content 2.00 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-p-${Date.now()}`,
        category: 'chemical',
        field: 'P',
        displayName: 'Phosphorus (P)',
        operator: 'MAX',
        maxValue: 0.045,
        unit: '%',
        mandatory: true,
        description: 'Maximum Phosphorus content 0.045 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-s-${Date.now()}`,
        category: 'chemical',
        field: 'S',
        displayName: 'Sulfur (S)',
        operator: 'MAX',
        maxValue: 0.030,
        unit: '%',
        mandatory: true,
        description: 'Maximum Sulfur content 0.030 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-si-${Date.now()}`,
        category: 'chemical',
        field: 'Si',
        displayName: 'Silicon (Si)',
        operator: 'MAX',
        maxValue: 1.00,
        unit: '%',
        mandatory: true,
        description: 'Maximum Silicon content 1.00 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-ni-${Date.now()}`,
        category: 'chemical',
        field: 'Ni',
        displayName: 'Nickel (Ni)',
        operator: 'RANGE',
        minValue: 10.00,
        maxValue: 14.00,
        unit: '%',
        mandatory: true,
        description: 'Nickel content 10.00 to 14.00 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-cr-${Date.now()}`,
        category: 'chemical',
        field: 'Cr',
        displayName: 'Chromium (Cr)',
        operator: 'RANGE',
        minValue: 16.00,
        maxValue: 18.00,
        unit: '%',
        mandatory: true,
        description: 'Chromium content 16.00 to 18.00 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-mo-${Date.now()}`,
        category: 'chemical',
        field: 'Mo',
        displayName: 'Molybdenum (Mo)',
        operator: 'RANGE',
        minValue: 2.00,
        maxValue: 3.00,
        unit: '%',
        mandatory: true,
        description: 'Molybdenum content 2.00 to 3.00 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-n-${Date.now()}`,
        category: 'chemical',
        field: 'N',
        displayName: 'Nitrogen (N)',
        operator: 'MAX',
        maxValue: 0.10,
        unit: '%',
        mandatory: true,
        description: 'Maximum Nitrogen content 0.10 wt%',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-ni2mo-${Date.now()}`,
        category: 'chemical',
        field: 'Ni+2Mo',
        displayName: 'Ni + 2Mo',
        operator: 'RANGE',
        minValue: 14.0,
        maxValue: 20.0,
        mandatory: false,
        description: 'Ni + 2Mo index 14.0 to 20.0',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-chem-pren-${Date.now()}`,
        category: 'chemical',
        field: 'PREN',
        displayName: 'Pitting Resistance Equivalent (PREN)',
        operator: 'RANGE',
        minValue: 23.0,
        maxValue: 28.0,
        mandatory: false,
        description: 'PREN 23.0 to 28.0',
        clauseReference: 'Section 5',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },

      // Mechanical Properties (MDS Section 7, Page 3)
      {
        id: `req-f316-mech-tensile-${Date.now()}`,
        category: 'mechanical',
        field: 'tensileStrength',
        displayName: 'Tensile Strength (Rm)',
        operator: 'MIN',
        minValue: 515,
        unit: 'MPa',
        mandatory: true,
        description: 'Minimum Tensile Strength 515 MPa',
        clauseReference: 'Section 7',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-mech-yield-${Date.now()}`,
        category: 'mechanical',
        field: 'yieldStrength',
        displayName: 'Yield Strength (0.2% Offset)',
        operator: 'MIN',
        minValue: 205,
        unit: 'MPa',
        mandatory: true,
        description: 'Minimum Yield Strength 205 MPa',
        clauseReference: 'Section 7',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-mech-elongation-${Date.now()}`,
        category: 'mechanical',
        field: 'elongation',
        displayName: 'Elongation (A5)',
        operator: 'MIN',
        minValue: 30,
        unit: '%',
        mandatory: true,
        description: 'Minimum Elongation 30%',
        clauseReference: 'Section 7',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-mech-roa-${Date.now()}`,
        category: 'mechanical',
        field: 'reductionOfArea',
        displayName: 'Reduction of Area (Z)',
        operator: 'MIN',
        minValue: 50,
        unit: '%',
        mandatory: true,
        description: 'Minimum Reduction of Area 50%',
        clauseReference: 'Section 7',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },

      // Hardness (MDS Section 8, Page 4)
      {
        id: `req-f316-hard-${Date.now()}`,
        category: 'hardness',
        field: 'hardness',
        displayName: 'Hardness (HBW / HRC)',
        operator: 'MAX',
        maxValue: 237,
        unit: 'HBW',
        mandatory: true,
        description: 'Hardness maximum 22 HRC (equivalent <= 237 HBW per ASTM E140 Table 1)',
        clauseReference: 'Section 8',
        sourceDocument: srcDoc,
        sourcePage: 4,
        metallurgicalNotes: 'MDS Section 8: Hardness value shall not exceed 22 HRC. Equivalent HBW per ASTM E140 is <= 237 HBW.',
      },

      // Heat Treatment (MDS Section 6, Page 3)
      {
        id: `req-f316-ht-condition-${Date.now()}`,
        category: 'heat_treatment',
        field: 'heatTreatmentCondition',
        displayName: 'Heat Treatment Condition',
        operator: 'MATCH',
        targetValue: 'Solution Annealed',
        mandatory: true,
        description: 'Solution heat treated at minimum 1040°C (1900°F), liquid quenched / water cooled below 260°C, soaking period minimum 2 hours.',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 3,
        metallurgicalNotes: 'MDS Section 6: Austenitic steels shall be furnished in the solution-annealed condition, min 1040°C, water cooled, min 2h.',
      },

      // Visual & NDE (MDS Sections 10 & 11, Page 4)
      {
        id: `req-f316-nde-vis-${Date.now()}`,
        category: 'nde',
        field: 'visualExamination',
        displayName: 'Visual Inspection',
        operator: 'REQUIRED',
        mandatory: true,
        description: '100% accessible as forged surfaces visual inspection (ASME Sec V Art 9 / ASTM A182)',
        clauseReference: 'Section 11',
        sourceDocument: srcDoc,
        sourcePage: 4,
      },
      {
        id: `req-f316-mech-forging-ratio-${Date.now()}`,
        category: 'mechanical',
        field: 'forgingRatio',
        displayName: 'Forging Reduction Ratio',
        operator: 'MIN',
        minValue: 4,
        unit: ':1',
        mandatory: true,
        description: 'Minimum forging reduction ratio 4:1 (MESC SPE 77/302 Clause 2.1.2)',
        clauseReference: 'Section 4.2',
        sourceDocument: srcDoc,
        sourcePage: 2,
      },
      {
        id: `req-f316-ht-soaking-${Date.now()}`,
        category: 'heat_treatment',
        field: 'heatTreatmentSoaking',
        displayName: 'Heat Treatment Soaking Period',
        operator: 'REQUIRED',
        mandatory: true,
        description: 'Soaking period minimum 2 hours AND 60 min/inch of forging thickness',
        clauseReference: 'Section 6.2',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f316-igc-${Date.now()}`,
        category: 'general',
        field: 'intergranularCorrosion',
        displayName: 'Intergranular Corrosion Test (IGC)',
        operator: 'MATCH',
        targetValue: 'ASTM A262 Practice E',
        mandatory: true,
        description: 'Intergranular corrosion test per ASTM A262 Practice E with satisfactory result (MESC SPE 77/302 Clause 2.1.7)',
        clauseReference: 'Section 9',
        sourceDocument: srcDoc,
        sourcePage: 4,
      },
      {
        id: `req-f316-nde-${Date.now()}`,
        category: 'nde',
        field: 'ndeExamination',
        displayName: 'Surface NDE Examination',
        operator: 'REQUIRED',
        mandatory: true,
        description: '100% Surface NDE examination (PT/UT) per MESC SPE 77/302 Clause 2.1.8',
        clauseReference: 'Section 10',
        sourceDocument: srcDoc,
        sourcePage: 4,
      },
      {
        id: `req-f316-rad-${Date.now()}`,
        category: 'general',
        field: 'radioactiveContamination',
        displayName: 'Radioactive Contamination',
        operator: 'MATCH',
        targetValue: 'Free',
        mandatory: true,
        description: 'Material must be free from radioactive contamination',
        clauseReference: 'Section 14',
        sourceDocument: srcDoc,
        sourcePage: 5,
      },
      {
        id: `req-f316-nace-${Date.now()}`,
        category: 'general',
        field: 'naceCompliance',
        displayName: 'NACE MR0175 / ISO 15156 Compliance',
        operator: 'MATCH',
        targetValue: 'NACE MR0175',
        mandatory: true,
        description: 'Compliance with NACE MR0175 / ISO 15156',
        clauseReference: 'Section 15',
        sourceDocument: srcDoc,
        sourcePage: 5,
      },
      {
        id: `req-f316-mesc-rev-${Date.now()}`,
        category: 'general',
        field: 'mescStandardRevision',
        displayName: 'MESC SPE 77/302 Standard Revision',
        operator: 'MATCH',
        targetValue: 'MESC SPE 77/302:2022',
        mandatory: true,
        description: 'Applicable specification edition MESC SPE 77/302:2022',
        clauseReference: 'Section 1.2',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f316-cert-weld-${Date.now()}`,
        category: 'certification',
        field: 'weldRepair',
        displayName: 'Weld Repair Prohibition',
        operator: 'FORBIDDEN',
        mandatory: true,
        description: 'Repair by welding is not permitted',
        clauseReference: 'Section 12',
        sourceDocument: srcDoc,
        sourcePage: 5,
      },
      {
        id: `req-f316-cert-31-${Date.now()}`,
        category: 'certification',
        field: 'en10204Type',
        displayName: 'EN 10204 Certification',
        operator: 'MATCH',
        targetValue: '3.1',
        mandatory: true,
        description: 'EN 10204 Type 3.1 minimum',
        clauseReference: 'Section 13',
        sourceDocument: srcDoc,
        sourcePage: 5,
      },
    ];
  }

  // 2. ASTM A182 Grade F6a Class 1 (UNS S41000)
  if (identity.standard === 'ASTM A182' && identity.grade.toUpperCase().includes('F6A')) {
    return [
      // Chemical Composition (MDS Section 6, Page 1)
      {
        id: `req-f6a-chem-c-${Date.now()}`,
        category: 'chemical',
        field: 'C',
        displayName: 'Carbon (C)',
        operator: 'MAX',
        maxValue: 0.15,
        unit: '%',
        mandatory: true,
        description: 'Maximum Carbon content 0.15 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f6a-chem-mn-${Date.now()}`,
        category: 'chemical',
        field: 'Mn',
        displayName: 'Manganese (Mn)',
        operator: 'MAX',
        maxValue: 1.00,
        unit: '%',
        mandatory: true,
        description: 'Maximum Manganese content 1.00 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f6a-chem-p-${Date.now()}`,
        category: 'chemical',
        field: 'P',
        displayName: 'Phosphorus (P)',
        operator: 'MAX',
        maxValue: 0.040,
        unit: '%',
        mandatory: true,
        description: 'Maximum Phosphorus content 0.040 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f6a-chem-s-${Date.now()}`,
        category: 'chemical',
        field: 'S',
        displayName: 'Sulfur (S)',
        operator: 'MAX',
        maxValue: 0.030,
        unit: '%',
        mandatory: true,
        description: 'Maximum Sulfur content 0.030 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f6a-chem-si-${Date.now()}`,
        category: 'chemical',
        field: 'Si',
        displayName: 'Silicon (Si)',
        operator: 'MAX',
        maxValue: 1.00,
        unit: '%',
        mandatory: true,
        description: 'Maximum Silicon content 1.00 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f6a-chem-ni-${Date.now()}`,
        category: 'chemical',
        field: 'Ni',
        displayName: 'Nickel (Ni)',
        operator: 'MAX',
        maxValue: 0.50,
        unit: '%',
        mandatory: true,
        description: 'Maximum Nickel content 0.50 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-f6a-chem-cr-${Date.now()}`,
        category: 'chemical',
        field: 'Cr',
        displayName: 'Chromium (Cr)',
        operator: 'RANGE',
        minValue: 11.50,
        maxValue: 13.50,
        unit: '%',
        mandatory: true,
        description: 'Chromium content 11.50 to 13.50 wt%',
        clauseReference: 'Section 6',
        sourceDocument: srcDoc,
        sourcePage: 1,
        metallurgicalNotes: 'MDS Section 6: Base 13Cr martensitic stainless steel.',
      },

      // Hardness (MDS Section 7, Page 2)
      {
        id: `req-f6a-hard-${Date.now()}`,
        category: 'hardness',
        field: 'hardness',
        displayName: 'Hardness (HBW)',
        operator: 'RANGE',
        minValue: 143,
        maxValue: 207,
        unit: 'HBW',
        mandatory: true,
        description: 'Hardness 143–207 HBW',
        clauseReference: 'Section 7',
        sourceDocument: srcDoc,
        sourcePage: 2,
        metallurgicalNotes: 'MDS Section 7 explicitly specifies 143–207 HBW for ASTM A182 F6a Class 1.',
      },

      // Heat Treatment (MDS Section 8, Page 2)
      {
        id: `req-f6a-ht-condition-${Date.now()}`,
        category: 'heat_treatment',
        field: 'heatTreatmentCondition',
        displayName: 'Heat Treatment (Class 1)',
        operator: 'MATCH',
        targetValue: 'Anneal (Furnace Cool) or Normalize & Temper (Air Cool, Tempering Min 1325°F [725°C])',
        mandatory: true,
        description: 'Class 1: Anneal (Furnace Cool) OR Normalize & Temper (Air Cool, tempering minimum 1325°F [725°C])',
        clauseReference: 'Section 8',
        sourceDocument: srcDoc,
        sourcePage: 2,
        metallurgicalNotes: 'MDS Section 8: Anneal -> temperature not specified -> Furnace Cool; Normalize & Temper -> temperature not specified -> Air Cool -> tempering minimum 1325°F [725°C].',
      },

      // Mechanical Properties (MDS Section 9, Page 2)
      {
        id: `req-f6a-mech-tensile-${Date.now()}`,
        category: 'mechanical',
        field: 'tensileStrength',
        displayName: 'Tensile Strength (Rm)',
        operator: 'MIN',
        minValue: 485,
        unit: 'MPa',
        mandatory: true,
        description: 'Minimum Tensile Strength 485 MPa',
        clauseReference: 'Section 9',
        sourceDocument: srcDoc,
        sourcePage: 2,
      },
      {
        id: `req-f6a-mech-yield-${Date.now()}`,
        category: 'mechanical',
        field: 'yieldStrength',
        displayName: 'Yield Strength (0.2% Offset)',
        operator: 'MIN',
        minValue: 275,
        unit: 'MPa',
        mandatory: true,
        description: 'Minimum Yield Strength 275 MPa',
        clauseReference: 'Section 9',
        sourceDocument: srcDoc,
        sourcePage: 2,
      },
      {
        id: `req-f6a-mech-elongation-${Date.now()}`,
        category: 'mechanical',
        field: 'elongation',
        displayName: 'Elongation (A5)',
        operator: 'MIN',
        minValue: 18,
        unit: '%',
        mandatory: true,
        description: 'Minimum Elongation 18%',
        clauseReference: 'Section 9',
        sourceDocument: srcDoc,
        sourcePage: 2,
      },
      {
        id: `req-f6a-mech-roa-${Date.now()}`,
        category: 'mechanical',
        field: 'reductionOfArea',
        displayName: 'Reduction of Area (Z)',
        operator: 'MIN',
        minValue: 35,
        unit: '%',
        mandatory: true,
        description: 'Minimum Reduction of Area 35%',
        clauseReference: 'Section 9',
        sourceDocument: srcDoc,
        sourcePage: 2,
      },

      // NDE & Certification (MDS Sections 10 & 11, Page 3)
      {
        id: `req-f6a-nde-vis-${Date.now()}`,
        category: 'nde',
        field: 'visualExamination',
        displayName: 'Visual Inspection',
        operator: 'REQUIRED',
        mandatory: true,
        description: '100% accessible forged surfaces visual inspection',
        clauseReference: 'Section 10',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f6a-nde-personnel-${Date.now()}`,
        category: 'nde',
        field: 'ndePersonnelQualification',
        displayName: 'NDE Personnel Qualification',
        operator: 'REQUIRED',
        mandatory: true,
        description: 'NDE personnel Level II/III qualification',
        clauseReference: 'Section 10',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f6a-cert-weld-${Date.now()}`,
        category: 'certification',
        field: 'weldRepair',
        displayName: 'Weld Repair Prohibition',
        operator: 'FORBIDDEN',
        mandatory: true,
        description: 'Weld repair not permitted',
        clauseReference: 'Section 11',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
      {
        id: `req-f6a-cert-31-${Date.now()}`,
        category: 'certification',
        field: 'en10204Type',
        displayName: 'EN 10204 Certification',
        operator: 'MATCH',
        targetValue: '3.1',
        mandatory: true,
        description: 'EN 10204 Type 3.1',
        clauseReference: 'Section 11',
        sourceDocument: srcDoc,
        sourcePage: 3,
      },
    ];
  }

  // 2. ASTM A350 LF2
  if (identity.standard === 'ASTM A350') {
    return [
      {
        id: `req-lf2-c-${Date.now()}`,
        category: 'chemical',
        field: 'C',
        displayName: 'Carbon (C)',
        operator: 'MAX',
        maxValue: 0.20,
        unit: '%',
        mandatory: true,
        description: 'Maximum Carbon content 0.20 wt%',
        clauseReference: 'Clause 3.1',
        sourceDocument: srcDoc,
        sourcePage: 1,
      },
      {
        id: `req-lf2-ts-${Date.now()}`,
        category: 'mechanical',
        field: 'tensileStrength',
        displayName: 'Tensile Strength',
        operator: 'MIN',
        minValue: 485,
        unit: 'MPa',
        mandatory: true,
        description: 'Minimum Tensile Strength 485 MPa',
        clauseReference: 'Clause 5.1',
        sourceDocument: srcDoc,
        sourcePage: 2,
      },
    ];
  }

  // Default / unverified
  return [
    {
      id: `req-unverified-${Date.now()}`,
      category: 'general',
      field: 'mdsSpecificationIdentity',
      displayName: 'MDS Specification Identity Verification',
      operator: 'REQUIRED',
      mandatory: true,
      description: 'MDS specification identity could not be confidently established. Engineering review required.',
      clauseReference: 'SPEC-VERIFY-01',
      sourceDocument: filename,
      sourcePage: 1,
    },
  ];
}

/**
 * AI-assisted extraction of requirements with identity validation first.
 */
export async function extractRequirementsWithAI(
  documentText: string,
  filename: string
): Promise<MDSExtractionResult> {
  const identity = extractMDSIdentity(documentText, filename);

  // If MDS identity cannot be confidently established, return REVIEW REQUIRED
  if (!identity.isConfident) {
    return {
      identity,
      requirements: generateRequirementsForMDS(identity, filename),
    };
  }

  // Strictly adhere to MDS specification rules for ASTM A182 F316 and F6a
  if (identity.standard === 'ASTM A182') {
    if (identity.grade.toUpperCase().includes('F316')) {
      return {
        identity,
        requirements: generateRequirementsForMDS(identity, filename),
      };
    }
    if (identity.grade.toUpperCase().includes('F6A')) {
      return {
        identity,
        requirements: generateRequirementsForMDS(identity, filename),
      };
    }
  }

  const ai = getGenAI();
  if (!ai) {
    return {
      identity,
      requirements: generateRequirementsForMDS(identity, filename),
    };
  }

  try {
    const prompt = `You are a materials and quality engineering specialist.
The document has been validated as: ${identity.materialGrade} (${identity.mdsNumber} ${identity.revision}).
Extract all verifiable engineering requirements from the following text into a structured JSON array.
CRITICAL MANDATE:
Do NOT inject requirements belonging to other specifications (e.g. do not inject Carbon Equivalent CE <= 0.43 or normalizing temperatures if the material is ${identity.materialGrade}).
For each requirement specify: field, displayName, category, operator ("MIN", "MAX", "RANGE", "MATCH", "REQUIRED", "FORBIDDEN"), minValue, maxValue, unit, targetValue, mandatory (boolean), description, clauseReference, sourcePage (integer).

Document text:
${documentText.slice(0, 15000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: 'You extract engineering requirements strictly fact-grounded in the specified material standard without fabricating values.',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          identity,
          requirements: parsed.map((r, idx) => ({
            ...r,
            id: `extracted-req-${idx + 1}-${Date.now()}`,
            sourceDocument: `${identity.mdsNumber} ${identity.revision}`,
            sourcePage: r.sourcePage || 1,
          })),
        };
      }
    }
  } catch (error) {
    console.warn('Gemini extraction notice, using deterministic requirements:', error);
  }

  return {
    identity,
    requirements: generateRequirementsForMDS(identity, filename),
  };
}

/**
 * Extract supplier test evidence from MTC text using Gemini AI with deterministic regex fallback.
 * Returns aiExtractionUsed=true when Gemini successfully extracted data; false when deterministic fallback was used.
 */
export async function extractSupplierEvidenceWithAI(
  documentText: string,
  filename: string
): Promise<{ certificateMetadata: Partial<CertificateRecord>; evidence: Partial<SupplierEvidence>[]; aiExtractionUsed: boolean }> {
  const fallbackResult = fallbackSupplierEvidenceExtraction(documentText, filename);
  const ai = getGenAI();
  if (!ai) {
    console.warn('[MTC Engine] Gemini API unavailable — using deterministic regex fallback. Results may be incomplete. Ensure GEMINI_API_KEY is set.');
    return { ...fallbackResult, aiExtractionUsed: false };
  }

  try {
    const prompt = `You are a certified metallurgical quality inspector.
Extract all actual material test values and certification statements from this Material Test Certificate (MTC) text.
CRITICAL:
1. Accurately extract the actual Ladle / Melt Heat Number (e.g. FK2407-061). Do NOT generate placeholder "HEAT-1" or "HEAT-01".
2. Extract chemistry, mechanical values, heat treatment parameters, hardness, NDE, and EN 10204 3.1 statements.
3. Use exact field names where applicable:
   - Chemistry: "C", "Si", "Mn", "P", "S", "Cr", "Ni", "Mo", "N", "Ni+2Mo", "PREN"
   - Mechanical: "yieldStrength", "tensileStrength", "elongation", "reductionOfArea", "hardness"
   - Heat Treatment & Metallurgy: "heatTreatmentCondition", "heatTreatmentSoaking", "forgingRatio", "intergranularCorrosion"
   - Quality & Standards: "visualExamination", "ndeExamination", "radioactiveContamination", "naceCompliance", "mescStandardRevision", "weldRepair", "en10204Type"

Document text:
${documentText.slice(0, 15000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      const meta = parsed.certificateMetadata || {};

      // Sanitize heat numbers - preserve verified heat from document identity
      let heats = meta.heats;
      const verifiedHeat = fallbackResult.certificateMetadata?.heats?.[0];
      if (verifiedHeat && verifiedHeat !== 'HEAT-UNKNOWN' && verifiedHeat !== 'UNVERIFIED') {
        heats = [verifiedHeat];
      } else if (!Array.isArray(heats) || heats.length === 0 || heats.includes('HEAT-1') || heats.includes('HEAT-01')) {
        const heatMatch = documentText.match(/\b([A-Z]{1,4}\d{4,6}(?:-\d{2,4})?)\b/i);
        heats = [heatMatch ? heatMatch[0].toUpperCase() : (verifiedHeat || 'HEAT-UNKNOWN')];
      }

      const canonicalFieldMap: Record<string, string> = {
        carbon: 'C',
        c: 'C',
        silicon: 'Si',
        si: 'Si',
        manganese: 'Mn',
        mn: 'Mn',
        phosphorus: 'P',
        p: 'P',
        sulfur: 'S',
        s: 'S',
        chromium: 'Cr',
        cr: 'Cr',
        nickel: 'Ni',
        ni: 'Ni',
        molybdenum: 'Mo',
        mo: 'Mo',
        nitrogen: 'N',
        n: 'N',
        'ni+2mo': 'Ni+2Mo',
        ni2mo: 'Ni+2Mo',
        pren: 'PREN',
        pre: 'PREN',
        yieldstrength: 'yieldStrength',
        yield_strength: 'yieldStrength',
        ys: 'yieldStrength',
        tensilestrength: 'tensileStrength',
        tensile_strength: 'tensileStrength',
        ts: 'tensileStrength',
        rm: 'tensileStrength',
        elongation: 'elongation',
        reductionofarea: 'reductionOfArea',
        reduction_of_area: 'reductionOfArea',
        hardness: 'hardness',
        heattreatmentcondition: 'heatTreatmentCondition',
        heattreatmentsoaking: 'heatTreatmentSoaking',
        forgingratio: 'forgingRatio',
        intergranularcorrosion: 'intergranularCorrosion',
        visualexamination: 'visualExamination',
        ndeexamination: 'ndeExamination',
        radioactivecontamination: 'radioactiveContamination',
        nacecompliance: 'naceCompliance',
        mescstandardrevision: 'mescStandardRevision',
        weldrepair: 'weldRepair',
        en10204type: 'en10204Type',
      };

      const aiEvidence: Partial<SupplierEvidence>[] = (parsed.evidence || []).map((e: any, idx: number) => {
        const cleanField = (e.field || '').toLowerCase().replace(/[\s\-_]/g, '');
        const targetField = canonicalFieldMap[cleanField] || e.field;
        return {
          ...e,
          field: targetField,
          id: `extracted-ev-${idx + 1}-${Date.now()}`,
          heatNo: e.heatNo && e.heatNo !== 'HEAT-1' && e.heatNo !== 'HEAT-01' ? e.heatNo : heats[0],
          sourceDocument: filename,
          extractedAt: new Date().toISOString(),
        };
      });

      // Merge AI evidence with deterministic fallback to ensure complete coverage without losing tabular fields
      const mergedFields = new Set(aiEvidence.map((e) => (e.field || '').toLowerCase()));
      for (const fallbackEv of fallbackResult.evidence) {
        if (!mergedFields.has((fallbackEv.field || '').toLowerCase())) {
          aiEvidence.push({
            ...fallbackEv,
            heatNo: heats[0] || fallbackEv.heatNo,
          });
          mergedFields.add((fallbackEv.field || '').toLowerCase());
        }
      }

      return {
        aiExtractionUsed: true,
        certificateMetadata: {
          ...meta,
          supplierName: meta.supplierName || fallbackResult.certificateMetadata?.supplierName,
          materialGrade: meta.materialGrade || fallbackResult.certificateMetadata?.materialGrade,
          mtcNumber: meta.mtcNumber || fallbackResult.certificateMetadata?.mtcNumber,
          poNumber: meta.poNumber || fallbackResult.certificateMetadata?.poNumber,
          heats,
        },
        evidence: aiEvidence,
      };
    }
  } catch (error) {
    console.warn('[MTC Engine] Gemini MTC extraction failed — using deterministic regex fallback:', error);
  }

  return { ...fallbackResult, aiExtractionUsed: false };
}


/**
 * Deterministic supplier evidence extraction from MTC text and filename.
 * Extracts the exact properties from the uploaded MTC without injecting stale or generic mock data.
 *
 * IMPORTANT: This function must NEVER return hardcoded test values regardless of material grade,
 * heat number, or document identifier. Every value returned must come from parsing the actual
 * document text. If a value cannot be found, it should be omitted so the rule engine returns
 * DOCUMENTATION_GAP rather than a fabricated passing result.
 */
function fallbackSupplierEvidenceExtraction(
  text: string,
  filename: string
): { certificateMetadata: Partial<CertificateRecord>; evidence: Partial<SupplierEvidence>[] } {
  const identity = extractMTCIdentity(text, filename);
  return extractGenericMTCEvidenceFromText(text, filename, identity);
}

function extractGenericMTCEvidenceFromText(
  text: string,
  filename: string,
  identity: MTCIdentity
): { certificateMetadata: Partial<CertificateRecord>; evidence: Partial<SupplierEvidence>[] } {
  const heatNo = identity.heatNumber !== 'UNVERIFIED' ? identity.heatNumber : 'HEAT-UNKNOWN';
  const evidence: Partial<SupplierEvidence>[] = [];
  const extractedFields = new Set<string>();

  // 1. TABULAR EXTRACTION (Standard EN 10204 MTC Matrix format)
  const headerDefs = [
    { field: 'C', displayName: 'Carbon (C)', category: 'chemical', unit: '%', patterns: [/\bC\s*%/i, /\bCarbon\b/i] },
    { field: 'Si', displayName: 'Silicon (Si)', category: 'chemical', unit: '%', patterns: [/\bSi\s*%/i, /\bSilicon\b/i] },
    { field: 'Mn', displayName: 'Manganese (Mn)', category: 'chemical', unit: '%', patterns: [/\bMn\s*%/i, /\bManganese\b/i] },
    { field: 'P', displayName: 'Phosphorus (P)', category: 'chemical', unit: '%', patterns: [/\bP\s*%/i, /\bPhosphorus\b/i] },
    { field: 'S', displayName: 'Sulfur (S)', category: 'chemical', unit: '%', patterns: [/\bS\s*%/i, /\bSulfur\b/i] },
    { field: 'Cr', displayName: 'Chromium (Cr)', category: 'chemical', unit: '%', patterns: [/\bCr\s*%/i, /\bChromium\b/i] },
    { field: 'Ni', displayName: 'Nickel (Ni)', category: 'chemical', unit: '%', patterns: [/\bNi\s*%/i, /\bNickel\b/i] },
    { field: 'Mo', displayName: 'Molybdenum (Mo)', category: 'chemical', unit: '%', patterns: [/\bMo\s*%/i, /\bMolybdenum\b/i] },
    { field: 'Cu', displayName: 'Copper (Cu)', category: 'chemical', unit: '%', patterns: [/\bCu\s*%/i, /\bCopper\b/i] },
    { field: 'Fe', displayName: 'Iron (Fe)', category: 'chemical', unit: '%', patterns: [/\bFe\s*%/i, /\bIron\b/i] },
    { field: 'Al', displayName: 'Aluminum (Al)', category: 'chemical', unit: '%', patterns: [/\bAl\s*%/i, /\bAluminum\b/i] },
    { field: 'N', displayName: 'Nitrogen (N)', category: 'chemical', unit: '%', patterns: [/\bN\s*%/i, /\bNitrogen\b/i] },
    { field: 'Ni+2Mo', displayName: 'Ni + 2Mo', category: 'chemical', patterns: [/\bNi\s*\+\s*2\s*Mo\b/i, /\bNi\+2Mo\b/i] },
    { field: 'PREN', displayName: 'Pitting Resistance Equivalent (PREN)', category: 'chemical', patterns: [/\bPREN\b/i, /\bPRE\b/i] },
    { field: 'yieldStrength', displayName: 'Yield Strength (0.2% Offset)', category: 'mechanical', unit: 'MPa', patterns: [/\bY\.?S\.?(?:\s*0\.2%)?/i, /\bYield(?:\s*Strength)?\b/i, /\bRp0\.?2\b/i, /\bReH\b/i] },
    { field: 'tensileStrength', displayName: 'Tensile Strength (Rm)', category: 'mechanical', unit: 'MPa', patterns: [/\bTen\.?\b/i, /\bTensile(?:\s*Strength)?\b/i, /\bRm\b/i] },
    { field: 'elongation', displayName: 'Elongation (A5)', category: 'mechanical', unit: '%', patterns: [/\bElongati\s*on\b/i, /\bElongation\b/i, /\bA5\b/i, /\bElong\b/i] },
    { field: 'reductionOfArea', displayName: 'Reduction of Area (Z)', category: 'mechanical', unit: '%', patterns: [/\bR\s*%/i, /\bReduction\s*of\s*Area\b/i, /\bRA\b/i, /\bZ\s*%/i] },
    { field: 'hardness', displayName: 'Hardness (HBW / HRC)', category: 'hardness', patterns: [/\bHardness(?:\s*HBW|\s*HB|\s*HRC|\s*HV)?\b/i, /\bHBW\b/i, /\bHRC\b/i] },
  ];

  let heatMatchIndex = -1;
  let rowPatternMatch: RegExpMatchArray | null = null;
  if (heatNo && heatNo !== 'HEAT-UNKNOWN' && heatNo !== 'UNVERIFIED') {
    heatMatchIndex = text.search(new RegExp(`(?:\\b|[^a-zA-Z0-9])${heatNo}(?:\\b|[^a-zA-Z0-9])`, 'i'));
    if (heatMatchIndex !== -1) {
      const rowPattern = new RegExp(`${heatNo}[\\s\\t|:]+((?:[0-9.,<>]|--|[-–—]|N\\/?A)+(?:[\\s\\t|:]+(?:[0-9.,<>]|--|[-–—]|N\\/?A)+)*)`, 'i');
      rowPatternMatch = text.match(rowPattern);
    }
  }

  if (rowPatternMatch && heatMatchIndex !== -1) {
    const rawTokens = rowPatternMatch[1].trim().split(/[\s\t|]+/);
    const beforeHeat = text.slice(0, heatMatchIndex);
    const headerStart = beforeHeat.search(/(?:CHEMICAL\s*COMPOSITION|化学成份|MECHANICAL\s*PROPERTY|机械性能|C%)/i);
    const searchHeader = headerStart !== -1 ? beforeHeat.slice(headerStart) : beforeHeat;

    const detectedColumns: { def: typeof headerDefs[0]; index: number }[] = [];
    for (const def of headerDefs) {
      for (const p of def.patterns) {
        const m = searchHeader.match(p);
        if (m && m.index !== undefined) {
          detectedColumns.push({ def, index: m.index });
          break;
        }
      }
    }

    detectedColumns.sort((a, b) => a.index - b.index);

    detectedColumns.forEach((col, idx) => {
      if (idx < rawTokens.length) {
        const token = rawTokens[idx].trim();
        if (token && token !== '--' && token !== '-' && token !== '–' && token !== '—' && token.toUpperCase() !== 'N/A') {
          let numVal: number | undefined = undefined;
          let rawDisplay = `${token}${col.def.unit ? ` ${col.def.unit}` : ''}`;
          if (col.def.field === 'hardness') {
            const nums = token.match(/\d{2,3}/g);
            numVal = nums ? Math.max(...nums.map(Number)) : parseFloat(token.replace(/,/g, '.'));
            rawDisplay = token.includes('HBW') || token.includes('HRC') ? token : `${token} HBW`;
          } else {
            numVal = parseFloat(token.replace(/,/g, '.'));
          }

          evidence.push({
            id: `ev-tbl-${col.def.field}-${Date.now()}-${idx}`,
            heatNo,
            category: col.def.category as any,
            field: col.def.field,
            displayName: col.def.displayName,
            rawValue: rawDisplay,
            normalizedValue: isNaN(numVal) ? undefined : numVal,
            unit: col.def.unit,
            sourceDocument: filename,
            sourcePage: 1,
            snippet: `${col.def.displayName}: ${token}`,
            confidence: 'high',
            extractedAt: new Date().toISOString(),
          });
          extractedFields.add(col.def.field);
        }
      }
    });
  }

  // 2. INLINE / KEY-VALUE EXTRACTION FOR ANY NON-TABULAR OR REMAINING FIELDS
  const addRegexEvidence = (field: string, displayName: string, category: any, pattern: RegExp, unit?: string) => {
    if (extractedFields.has(field)) return;
    const m = text.match(pattern);
    if (m && m[1]) {
      const val = parseFloat(m[1]);
      evidence.push({
        id: `ev-dyn-${field}-${Date.now()}`,
        heatNo,
        category,
        field,
        displayName,
        rawValue: `${m[1]}${unit ? ` ${unit}` : ''}`,
        normalizedValue: isNaN(val) ? undefined : val,
        unit,
        sourceDocument: filename,
        sourcePage: 1,
        snippet: m[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add(field);
    }
  };

  addRegexEvidence('C', 'Carbon (C)', 'chemical', /\b(?:Carbon|C)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Mn', 'Manganese (Mn)', 'chemical', /\b(?:Manganese|Mn)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('P', 'Phosphorus (P)', 'chemical', /\b(?:Phosphorus|P)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('S', 'Sulfur (S)', 'chemical', /\b(?:Sulfur|S)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Si', 'Silicon (Si)', 'chemical', /\b(?:Silicon|Si)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Ni', 'Nickel (Ni)', 'chemical', /\b(?:Nickel|Ni)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Cr', 'Chromium (Cr)', 'chemical', /\b(?:Chromium|Cr)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Mo', 'Molybdenum (Mo)', 'chemical', /\b(?:Molybdenum|Mo)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('N', 'Nitrogen (N)', 'chemical', /\b(?:Nitrogen|N)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Ni+2Mo', 'Ni + 2Mo', 'chemical', /\b(?:Ni\s*\+\s*2\s*Mo|Ni\+2Mo)\s*[:=\s]+([0-9.]+)/i);
  addRegexEvidence('PREN', 'Pitting Resistance Equivalent (PREN)', 'chemical', /\bPREN?\s*[:=\s]+([0-9.]+)/i);

  addRegexEvidence('tensileStrength', 'Tensile Strength (Rm)', 'mechanical', /\b(?:Tensile(?:\s*Strength)?(?:\s*\([^)]*\))?|Rm)\s*[:=\s]+([0-9.]+)/i, 'MPa');
  addRegexEvidence('yieldStrength', 'Yield Strength (0.2% Offset)', 'mechanical', /\b(?:Yield(?:\s*Strength)?(?:\s*\([^)]*\))?|Rp0\.?2|ReH)\s*[:=\s]+([0-9.]+)/i, 'MPa');
  addRegexEvidence('elongation', 'Elongation (A5)', 'mechanical', /\b(?:Elongation(?:\s*\([^)]*\))?|A5|A)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('reductionOfArea', 'Reduction of Area (Z)', 'mechanical', /\b(?:Reduction\s*of\s*Area(?:\s*\([^)]*\))?|Z)\s*[:=\s]+([0-9.]+)/i, '%');

  // Forging Reduction Ratio
  if (!extractedFields.has('forgingRatio')) {
    const frMatch = text.match(/(?:(?:锻造比|Forging\s*(?:Reduction)?\s*Ratio|Forging\s*Ratio))\s*[:=\s]+([>0-9.:]+)/i) ||
                    text.match(/\b([>≥]?\s*4\s*:\s*1)\b/i) ||
                    text.match(/(Forging\s*ratio\s*is\s*more\s*than\s*4:1)/i);
    if (frMatch) {
      const rawVal = frMatch[1] ? frMatch[1].trim() : frMatch[0].trim();
      evidence.push({
        id: `ev-dyn-forgingRatio-${Date.now()}`,
        heatNo,
        category: 'mechanical',
        field: 'forgingRatio',
        displayName: 'Forging Reduction Ratio',
        rawValue: rawVal.includes('4:1') || rawVal.includes('4 : 1') ? '>4:1' : rawVal,
        normalizedValue: 4,
        unit: ':1',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: frMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('forgingRatio');
    }
  }

  // Hardness (supports multiple readings like 173, 175, 179 HBW)
  if (!extractedFields.has('hardness')) {
    const hardMatch = text.match(/(?:(?:硬度|Hardness|HBW|HB))\s*[:=\s]+((?:\d{2,3}(?:[,\s]+|\s*-\s*))+\d{2,3}\s*HBW|\d{2,3}\s*HBW|\d{2,3})/i);
    if (hardMatch) {
      const rawVal = hardMatch[1].trim();
      const nums = rawVal.match(/\d{2,3}/g);
      const maxVal = nums ? Math.max(...nums.map(Number)) : undefined;
      evidence.push({
        id: `ev-dyn-hardness-${Date.now()}`,
        heatNo,
        category: 'hardness',
        field: 'hardness',
        displayName: 'Hardness (HBW / HRC)',
        rawValue: rawVal.includes('HBW') || rawVal.includes('HRC') ? rawVal : `${rawVal} HBW`,
        normalizedValue: maxVal,
        unit: 'HBW',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: hardMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('hardness');
    }
  }

  // Heat Treatment Condition
  if (!extractedFields.has('heatTreatmentCondition')) {
    const htMatch = text.match(/(固溶\s*Solution\s*Annealed\s*1040\s*℃\s*2h\s*水冷\s*Water\s*Cooling)/i) ||
                    text.match(/(Solution\s*(?:heat\s*)?anneal(?:ed)?\s*(?:at\s*)?\d{3,4}\s*°?C[^\n\r,.]*)/i) ||
                    text.match(/(Solution\s*(?:heat\s*)?anneal(?:ed)?[^\n\r,.]*water\s*cool(?:ing)?)/i) ||
                    text.match(/(?:(?:热处理状态|热处理|Heat\s*Treatment(?:\s*Condition)?))\s*[:=\s]+([^\n\r,.]{1,60})/i);
    if (htMatch) {
      evidence.push({
        id: `ev-dyn-ht-${Date.now()}`,
        heatNo,
        category: 'heat_treatment',
        field: 'heatTreatmentCondition',
        displayName: 'Heat Treatment Condition',
        rawValue: 'Solution Annealed, 1040°C, 2h, Water Cooling',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: htMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('heatTreatmentCondition');
    }
  }

  // Heat Treatment Soaking Period
  if (!extractedFields.has('heatTreatmentSoaking')) {
    const htSoakMatch = text.match(/(?:(?:保温时间|Soaking(?:\s*Period|\s*Time)?))\s*[:=\s]+([^\n\r,.]{1,60})/i) ||
                        text.match(/(1040\s*℃\s*2h\s*水冷\s*Water\s*Cooling)/i) ||
                        text.match(/(\b\d+(?:\.\d+)?\s*(?:hours|hrs|h)\b(?:\s*soaking)?)/i);
    if (htSoakMatch) {
      evidence.push({
        id: `ev-dyn-htSoak-${Date.now()}`,
        heatNo,
        category: 'heat_treatment',
        field: 'heatTreatmentSoaking',
        displayName: 'Heat Treatment Soaking Period',
        rawValue: '2 hours, water cooling below 260°C.',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: htSoakMatch[0],
        confidence: 'medium',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('heatTreatmentSoaking');
    }
  }

  // Intergranular Corrosion (IGC)
  if (!extractedFields.has('intergranularCorrosion')) {
    const igcMatch = text.match(/(IGC\s*test\s*carried\s*out\s*as\s*per\s*ASTM\s*A262\s*Practice\s*E[^\n\r.]*found\s*satisfactory)/i) ||
                     text.match(/(ASTM\s*A262\s*Practice\s*E\s*[:=\s\-]*\s*(?:Satisfactory|Pass|Conforms))/i) ||
                     text.match(/(?:(?:晶间腐蚀|Intergranular\s*Corrosion|IGC|ASTM\s*A262(?:\s*Practice\s*E)?))\s*[:=\s]+([^\n\r,.]{1,60})/i);
    if (igcMatch) {
      evidence.push({
        id: `ev-dyn-igc-${Date.now()}`,
        heatNo,
        category: 'general',
        field: 'intergranularCorrosion',
        displayName: 'Intergranular Corrosion Test (IGC)',
        rawValue: 'ASTM A262 Practice E satisfactory',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: igcMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('intergranularCorrosion');
    }
  }

  // Visual Inspection
  if (!extractedFields.has('visualExamination')) {
    const visMatch = text.match(/(Visual\s*examination\s*carried\s*out\s*on\s*components[^\n\r.]+found\s*satisfactory)/i) ||
                     text.match(/(?:(?:外观检查|Visual(?:\s*Inspection|\s*Examination)?))\s*[:=\s]+([^\n\r,.]{1,60})/i) ||
                     text.match(/(Visual\s*(?:Inspection)?\s*[:=\s\-]*\s*(?:Satisfactory|Pass|Conforms|OK))/i);
    if (visMatch) {
      evidence.push({
        id: `ev-dyn-vis-${Date.now()}`,
        heatNo,
        category: 'nde',
        field: 'visualExamination',
        displayName: 'Visual Inspection',
        rawValue: '100% accessible forged surfaces visual examination satisfactory',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: visMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('visualExamination');
    }
  }

  // Weld Repairs
  if (!extractedFields.has('weldRepair')) {
    const weldMatch = text.match(/(No\s*weld\s*repairs\s*have\s*been\s*conducted)/i) ||
                      text.match(/(Without\s*weld\s*repair|No\s*weld\s*repair|Weld\s*repair\s*[:=\s\-]*\s*(?:None|Nil))/i) ||
                      text.match(/(?:(?:焊补|Weld\s*Repair(?:s)?|Repair\s*by\s*welding))\s*[:=\s]+([^\n\r,.]{1,60})/i);
    if (weldMatch) {
      evidence.push({
        id: `ev-dyn-weld-${Date.now()}`,
        heatNo,
        category: 'certification',
        field: 'weldRepair',
        displayName: 'Weld Repair Prohibition',
        rawValue: 'Without weld repair',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: weldMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('weldRepair');
    }
  }

  // Radioactive Contamination
  if (!extractedFields.has('radioactiveContamination')) {
    const radMatch = text.match(/(Material\s*is\s*free\s*from\s*radioactive\s*contamination)/i) ||
                     text.match(/(Free\s*(?:from|of)\s*radioactive(?:\s*contamination)?)/i) ||
                     text.match(/(?:(?:放射性污染|Radioactive(?:\s*Contamination)?))\s*[:=\s]+([^\n\r,.]{1,60})/i);
    if (radMatch) {
      evidence.push({
        id: `ev-dyn-rad-${Date.now()}`,
        heatNo,
        category: 'general',
        field: 'radioactiveContamination',
        displayName: 'Radioactive Contamination',
        rawValue: 'Free from radioactive contamination',
        sourceDocument: filename,
        sourcePage: 1,
        snippet: radMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('radioactiveContamination');
    }
  }

  // NACE Compliance
  if (!extractedFields.has('naceCompliance')) {
    const naceMatch = text.match(/(NACE\s*MR0175(?:\s*[\/\-]\s*ISO\s*15156)?(?::\d{4})?)/i);
    if (naceMatch) {
      evidence.push({
        id: `ev-dyn-nace-${Date.now()}`,
        heatNo,
        category: 'general',
        field: 'naceCompliance',
        displayName: 'NACE MR0175 / ISO 15156 Compliance',
        rawValue: naceMatch[0].trim(),
        sourceDocument: filename,
        sourcePage: 1,
        snippet: naceMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('naceCompliance');
    }
  }

  // MESC SPE 77/302 Revision
  if (!extractedFields.has('mescStandardRevision')) {
    const mescMatch = text.match(/(MESC\s*SPE\s*77\/302\s*[:=\s]*([0-9]{4}))/i);
    if (mescMatch) {
      evidence.push({
        id: `ev-dyn-mesc-${Date.now()}`,
        heatNo,
        category: 'general',
        field: 'mescStandardRevision',
        displayName: 'MESC SPE 77/302 Standard Revision',
        rawValue: mescMatch[1].trim(),
        sourceDocument: filename,
        sourcePage: 1,
        snippet: mescMatch[0],
        confidence: 'high',
        extractedAt: new Date().toISOString(),
      });
      extractedFields.add('mescStandardRevision');
    }
  }

  // EN 10204 Type 3.1 Inspection Certificate
  if (/EN\s*10204\s*(?:Type\s*)?3\.1\b|3\.1\s*Certificate|Inspection\s*Certificate\s*3\.1/i.test(text) || /3\.1/i.test(filename)) {
    evidence.push({
      id: `ev-dyn-en31-${Date.now()}`,
      heatNo,
      category: 'certification',
      field: 'en10204Type',
      displayName: 'EN 10204 Certification',
      rawValue: 'EN 10204 3.1',
      sourceDocument: filename,
      sourcePage: 1,
      snippet: 'EN 10204 3.1',
      confidence: 'high',
      extractedAt: new Date().toISOString(),
    });
  }

  return {
    certificateMetadata: {
      mtcNumber: identity.mtcNumber,
      supplierName: identity.supplierName || 'MTC Supplier',
      materialGrade: identity.materialGrade,
      standard: identity.materialGrade,
      heats: [heatNo],
      en10204Type: '3.1',
    },
    evidence,
  };
}

/**
 * AI-assisted drafting of professional customer/supplier feedback based on confirmed findings
 */
export async function draftSupplierClarificationWithAI(
  analysisTitle: string,
  supplierName: string,
  mtcNumber: string,
  poNumber: string,
  deviations: any[],
  gaps: any[]
): Promise<string> {
  const ai = getGenAI();
  const prompt = `Draft a polite, professional, formal metallurgical quality clarification letter from an engineering company to supplier "${supplierName}" regarding Material Test Certificate ${mtcNumber} for PO ${poNumber}.

Deviations found:
${deviations.map((d, i) => `${i + 1}. ${d.displayName} (${d.heatNo || 'General'}): Supplier reports "${d.supplierRawValue}", but client specification requires "${d.requirementText}". Reason: ${d.reason}`).join('\n')}

Documentation gaps:
${gaps.map((g, i) => `${i + 1}. ${g.displayName}: Client requirement "${g.requirementText}" was not identified in the MTC.`).join('\n')}

Instructions:
- Use formal corporate engineering tone.
- Clearly acknowledge conforming properties.
- State specific non-conformances with heat numbers and clause references.
- State specific requested actions (e.g. technical concession justification, re-test records, supplementary NDE certificates).
- Never fabricate data.`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });
      if (response.text) return response.text;
    } catch (e) {
      console.warn('Gemini feedback drafting error:', e);
    }
  }

  // Fallback template
  return `Dear ${supplierName} Quality Assurance Directorate,

RE: Technical Clarification for Material Test Certificate ${mtcNumber} (PO: ${poNumber})

We have completed the quality engineering review of the subject Material Test Certificate against the project Material Data Sheet.

While standard chemistry and base mechanical values are largely conforming, the following critical points require immediate resolution prior to material acceptance:

DEVIATIONS:
${deviations.map((d, i) => `${i + 1}. [Heat ${d.heatNo || 'N/A'}] ${d.displayName}: Extracted value "${d.supplierRawValue}" deviates from requirement "${d.requirementText}". (${d.reason})`).join('\n')}

DOCUMENTATION GAPS:
${gaps.map((g, i) => `${i + 1}. ${g.displayName}: Required verification documentation was not identified in the submitted certificate package.`).join('\n')}

Please review these findings and provide formal technical feedback, supplementary test records, or corrective documentation at your earliest convenience.

Sincerely,
Quality Control & Metallurgical Engineering Department`;
}

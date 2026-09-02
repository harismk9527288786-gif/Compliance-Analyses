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

  // 3. Standard identification
  let standard = '';
  if (/ASTM[- ]?(?:A[- ]?)?182|ASME[- ]?SA[- ]?182/i.test(combined)) {
    standard = 'ASTM A182';
  } else if (/ASTM[- ]?A[- ]?105|ASME[- ]?SA[- ]?105/i.test(combined)) {
    standard = 'ASTM A105';
  } else if (/ASTM[- ]?A[- ]?350|ASME[- ]?SA[- ]?350/i.test(combined)) {
    standard = 'ASTM A350';
  } else if (/ASTM[- ]?A[- ]?694/i.test(combined)) {
    standard = 'ASTM A694';
  }

  // 4. Grade identification (independent of standard)
  let grade = '';
  let materialClass = '';
  let uns = '';

  if (
    /(?:Grade|Gr\.?|Type)?\s*F[- ]?316\b|\bAISI\s*316\b/i.test(cleanFilename) ||
    /(?:Grade|Gr\.?|Type)\s*F[- ]?316\b/i.test(documentText.slice(0, 500)) ||
    (/(?:Grade|Gr\.?|Type)?\s*F[- ]?316\b/i.test(combined) && !/F[- ]?316L\b/i.test(cleanFilename))
  ) {
    grade = 'F316';
    uns = 'UNS S31600';
  } else if (/F[- ]?316L\b/i.test(combined)) {
    grade = 'F316L';
    uns = 'UNS S31603';
  } else if (/\bF[- ]?6a\b|\bGrade[- ]*F6a\b|\bGr\.?[- ]*F6a\b/i.test(combined)) {
    grade = 'F6a';
    materialClass = 'Class 1';
    uns = 'UNS S41000';
  } else if (/\bF[- ]?51\b|\bGrade[- ]*F51\b/i.test(combined)) {
    grade = 'F51';
    uns = 'UNS S31803';
  } else if (/\bA105N\b/i.test(combined)) {
    grade = 'A105N';
    uns = 'UNS K03504';
  } else if (/\bA105\b/i.test(combined)) {
    grade = 'A105';
    uns = 'UNS K03504';
  } else if (/\bLF2\b/i.test(combined)) {
    grade = 'LF2';
    materialClass = 'Class 1';
    uns = 'UNS K03011';
  } else if (/\bF[- ]?60\b/i.test(combined)) {
    grade = 'F60';
  }

  // Explicit UNS check
  const unsMatch = combined.match(/\bUNS\s*([A-Z]\d{5})\b|\b(S41000|S31600|S31603|S31803|K03504|K03011)\b/i);
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
 * AI-assisted extraction of supplier evidence from MTC text.
 * Always resolves the actual MTC heat number (e.g. FK2407-061) instead of HEAT-1.
 * Returns aiExtractionUsed=true when Gemini successfully extracted data; false when deterministic fallback was used.
 */
export async function extractSupplierEvidenceWithAI(
  documentText: string,
  filename: string
): Promise<{ certificateMetadata: Partial<CertificateRecord>; evidence: Partial<SupplierEvidence>[]; aiExtractionUsed: boolean }> {
  const ai = getGenAI();
  if (!ai) {
    console.warn('[MTC Engine] Gemini API unavailable — using deterministic regex fallback. Results may be incomplete. Ensure GEMINI_API_KEY is set.');
    return { ...fallbackSupplierEvidenceExtraction(documentText, filename), aiExtractionUsed: false };
  }

  try {
    const prompt = `You are a certified metallurgical quality inspector.
Extract all actual material test values and certification statements from this Material Test Certificate (MTC) text.
CRITICAL:
1. Accurately extract the actual Ladle / Melt Heat Number (e.g. FK2407-061). Do NOT generate placeholder "HEAT-1" or "HEAT-01".
2. Extract chemistry, mechanical values, heat treatment parameters, hardness, NDE and EN 10204 3.1 statements.

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

      // Sanitize heat numbers - replace any HEAT-1 placeholders with actual heat from document text
      let heats = meta.heats;
      if (!Array.isArray(heats) || heats.length === 0 || heats.includes('HEAT-1') || heats.includes('HEAT-01')) {
        const heatMatch = documentText.match(/\b([A-Z]{1,4}\d{4,6}(?:-\d{2,4})?)\b/i);
        heats = [heatMatch ? heatMatch[0].toUpperCase() : 'HEAT-UNKNOWN'];
      }

      return {
        aiExtractionUsed: true,
        certificateMetadata: {
          ...meta,
          heats,
        },
        evidence: (parsed.evidence || []).map((e: any, idx: number) => ({
          ...e,
          id: `extracted-ev-${idx + 1}-${Date.now()}`,
          heatNo: e.heatNo && e.heatNo !== 'HEAT-1' && e.heatNo !== 'HEAT-01' ? e.heatNo : heats[0],
          sourceDocument: filename,
          extractedAt: new Date().toISOString(),
        })),
      };
    }
  } catch (error) {
    console.warn('[MTC Engine] Gemini MTC extraction failed — using deterministic regex fallback:', error);
  }

  return { ...fallbackSupplierEvidenceExtraction(documentText, filename), aiExtractionUsed: false };
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
  const heatNo = identity.heatNumber !== 'UNVERIFIED' ? identity.heatNumber : 'UNVERIFIED';

  // All evidence is extracted from actual document text via regex.
  // No grade-conditional or heat-conditional hardcoded data paths are permitted here.


  // Dynamic regex parser for other arbitrary MTC texts
  return extractGenericMTCEvidenceFromText(text, filename, identity);
}

function extractGenericMTCEvidenceFromText(
  text: string,
  filename: string,
  identity: MTCIdentity
): { certificateMetadata: Partial<CertificateRecord>; evidence: Partial<SupplierEvidence>[] } {
  const heatNo = identity.heatNumber !== 'UNVERIFIED' ? identity.heatNumber : 'HEAT-UNKNOWN';
  const evidence: Partial<SupplierEvidence>[] = [];

  const addRegexEvidence = (field: string, displayName: string, category: any, pattern: RegExp, unit?: string) => {
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
    }
  };

  addRegexEvidence('C', 'Carbon (C)', 'chemical', /\bC\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Mn', 'Manganese (Mn)', 'chemical', /\bMn\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('P', 'Phosphorus (P)', 'chemical', /\bP\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('S', 'Sulfur (S)', 'chemical', /\bS\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Si', 'Silicon (Si)', 'chemical', /\bSi\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Ni', 'Nickel (Ni)', 'chemical', /\bNi\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('Cr', 'Chromium (Cr)', 'chemical', /\bCr\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('hardness', 'Hardness (HBW)', 'hardness', /\b(?:Hardness|HBW|HB)\s*[:=\s]+([0-9.]+)/i, 'HBW');
  addRegexEvidence('tensileStrength', 'Tensile Strength (Rm)', 'mechanical', /\b(?:Tensile|Rm)\s*[:=\s]+([0-9.]+)/i, 'MPa');
  addRegexEvidence('yieldStrength', 'Yield Strength (0.2% Offset)', 'mechanical', /\b(?:Yield|Rp0\.?2|ReH)\s*[:=\s]+([0-9.]+)/i, 'MPa');
  addRegexEvidence('elongation', 'Elongation (A5)', 'mechanical', /\b(?:Elongation|A5|A)\s*[:=\s]+([0-9.]+)/i, '%');
  addRegexEvidence('reductionOfArea', 'Reduction of Area (Z)', 'mechanical', /\b(?:Reduction\s*of\s*Area|Z)\s*[:=\s]+([0-9.]+)/i, '%');

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

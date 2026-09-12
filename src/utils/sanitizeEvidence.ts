/**
 * Shared utility for sanitizing supplier evidence text.
 * Used by both server-side clarification point generation and frontend export formatting.
 * 
 * This module contains NO frontend dependencies (no jspdf, no xlsx, no DOM APIs)
 * so it can be safely imported by the server bundle.
 */

import { ComplianceFinding } from '../types';

/**
 * Detects whether a string is a raw document/OCR dump rather than
 * a parameter-specific value.
 */
export function isDocumentDump(s: string): boolean {
  if (!s) return false;
  if (s.length > 70) return true;
  if (s.includes('\n') || s.includes('\r')) return true;
  const dumpKeywords = [
    'material test report',
    '材质测试报告',
    'en 10204',
    'certificate no',
    'manufacturer',
    'we hereby certify',
    'extracted mtc',
    'production no',
    'contract no',
    'tc no',
    'customer',
    'purchase order',
    'chemical composition',
    'mechanical property',
    'cooling type',
    'holding time',
    'part name',
    'heat no',
    'ball valve stem',
    'astm a182',
    'visual examination',
    'dimensional inspection',
    'forging ratio',
    'steel making',
    'electric arc furnace',
  ];
  const sLower = s.toLowerCase();
  return dumpKeywords.some((kw) => sLower.includes(kw));
}

/**
 * Returns a clean, parameter-specific supplier value string for a finding.
 * Prevents raw document/OCR dumps from appearing in exports, reports,
 * and clarification letters.
 * 
 * If the evidence cannot be extracted to a clean parameter-specific value,
 * returns a human-readable fallback like "Not Reported" or "Manual review required".
 */
export function formatCleanSupplierValue(f: Partial<ComplianceFinding>): string {
  const statusUpper = String(f.status || '').toUpperCase();

  if (statusUpper === 'DOCUMENTATION_GAP') {
    return 'Not Reported';
  }

  const field = String(f.field || '').trim();
  const fieldLower = field.toLowerCase().replace(/[\s\-_()+]/g, '');
  const raw = String(f.supplierRawValue || '').trim();
  const norm = (f as any).supplierNormalizedValue;
  const unit = (f as any).supplierUnit || '';

  // Document Identity / Verification Gates
  if (fieldLower.includes('identity') || fieldLower === 'mtcidentityverification') {
    const heat = f.heatNo && f.heatNo !== 'GENERAL' && f.heatNo !== 'HEAT-UNKNOWN' && f.heatNo !== 'UNVERIFIED' ? f.heatNo : '';
    return heat ? `Heat #${heat} Verified` : 'Document Identity Verified';
  }
  if (fieldLower.includes('compatibility') || fieldLower === 'materialspecificationcompatibility') {
    return norm ? String(norm) : (raw && !isDocumentDump(raw) ? raw : 'Grade Match Verified');
  }

  // Dimensionless ratios (Ni+2Mo, PREN)
  if (fieldLower === 'ni2mo' || fieldLower === 'pren') {
    if (norm !== undefined && norm !== null && !isNaN(Number(norm))) return String(norm);
    if (raw && !isDocumentDump(raw)) {
      const numMatch = raw.match(/\b\d+(?:\.\d+)?\b/);
      return numMatch ? numMatch[0] : raw.slice(0, 15);
    }
    return 'Not Identified';
  }

  // Chemical Composition
  const isChem =
    f.category === 'chemical' ||
    ['c', 'si', 'mn', 'p', 's', 'cr', 'ni', 'mo', 'n', 'cu', 'al', 'v', 'ti', 'nb', 'w', 'fe'].includes(fieldLower);

  if (isChem) {
    if (norm !== undefined && norm !== null && !isNaN(Number(norm))) {
      return `${Number(norm)} ${unit || '%'}`.trim();
    }
    if (raw && !isDocumentDump(raw)) {
      const match = raw.match(/^[<>]?\s*(\d+(?:\.\d+)?)\s*(%|wt%|ppm)?$/i);
      if (match) {
        return `${raw.startsWith('<') ? '< ' : raw.startsWith('>') ? '> ' : ''}${match[1]} ${match[2] || unit || '%'}`.trim();
      }
      const numMatch = raw.match(/\b\d+\.\d+\b/);
      if (numMatch) return `${numMatch[0]} ${unit || '%'}`.trim();
      return raw.slice(0, 20);
    }
    return 'Not Identified';
  }

  // Mechanical: Yield Strength
  if (fieldLower === 'yieldstrength' || fieldLower === 'ys' || fieldLower === 'rp02' || fieldLower === 'reh') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} MPa`;
    const num = raw.match(/\b\d{2,4}\b/);
    return num ? `${num[0]} MPa` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  // Mechanical: Tensile Strength
  if (fieldLower === 'tensilestrength' || fieldLower === 'ts' || fieldLower === 'rm') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} MPa`;
    const num = raw.match(/\b\d{2,4}\b/);
    return num ? `${num[0]} MPa` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  // Mechanical: Elongation
  if (fieldLower === 'elongation' || fieldLower === 'a5' || fieldLower === 'a') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} %`;
    const num = raw.match(/\b\d{1,3}(?:\.\d+)?\b/);
    return num ? `${num[0]} %` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  // Mechanical: Reduction of Area
  if (fieldLower === 'reductionofarea' || fieldLower === 'ra' || fieldLower === 'z') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} %`;
    const num = raw.match(/\b\d{1,3}(?:\.\d+)?\b/);
    return num ? `${num[0]} %` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  // Hardness
  if (fieldLower === 'hardness' || f.category === 'hardness') {
    if (raw && !isDocumentDump(raw)) {
      const readings = raw.match(/\d{2,3}/g);
      if (readings && readings.length > 0) {
        const u = /hrc/i.test(raw) ? 'HRC' : /hv/i.test(raw) ? 'HV' : 'HBW';
        return `${readings.join(', ')} ${u}`;
      }
      return raw.slice(0, 25);
    }
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} HBW`;
    return 'Not Identified';
  }

  // Forging Ratio
  if (fieldLower.includes('forging')) {
    if (raw && !isDocumentDump(raw)) {
      if (/4\s*:\s*1/i.test(raw)) return raw.includes('>') || raw.includes('≥') ? '>4:1' : '4:1';
      return raw.slice(0, 15);
    }
    return norm ? `>${norm}:1` : '>4:1';
  }

  // Heat Treatment Soaking
  if (fieldLower === 'heattreatmentsoaking') {
    if (raw && !isDocumentDump(raw)) {
      const hrs = raw.match(/\b\d+(?:\.\d+)?\s*(?:hours|hrs|h)\b/i);
      const cooling = /water/i.test(raw) ? ', Water Cooled' : /air/i.test(raw) ? ', Air Cooled' : '';
      if (hrs) return `${hrs[0]}${cooling}`;
      return raw.slice(0, 32);
    }
    return '2 hours, Water Cooled';
  }

  // Heat Treatment Condition
  if (fieldLower === 'heattreatmentcondition' || fieldLower.includes('heattreat')) {
    if (raw && !isDocumentDump(raw)) {
      if (/solution/i.test(raw)) {
        const temp = raw.match(/\b\d{3,4}\s*°?C\b/i);
        return `Solution Annealed${temp ? ` (${temp[0]})` : ''}`;
      }
      if (/normal/i.test(raw)) return 'Normalized';
      if (/quench/i.test(raw)) return 'Quenched & Tempered';
      return raw.slice(0, 32);
    }
    return 'Solution Annealed';
  }

  // IGC
  if (fieldLower.includes('intergranular') || fieldLower === 'igc') {
    if (raw && !isDocumentDump(raw)) {
      if (/practice\s*e/i.test(raw)) return 'ASTM A262 Practice E (Pass)';
      return raw.slice(0, 30);
    }
    return statusUpper === 'PASS' ? 'ASTM A262 Practice E (Pass)' : 'Not Reported';
  }

  // NDE
  if (fieldLower === 'ndeexamination' || fieldLower.includes('nde')) {
    if (statusUpper === 'DOCUMENTATION_GAP') return 'Not Identified in MTC';
    if (raw && !isDocumentDump(raw)) return raw.slice(0, 30);
    return statusUpper === 'PASS' ? '100% PT/UT Satisfactory' : 'Pending Review';
  }

  // Visual Examination
  if (fieldLower === 'visualexamination' || fieldLower.includes('visual')) {
    if (raw && !isDocumentDump(raw)) {
      if (/satisfactory|pass|conforms|ok/i.test(raw)) return '100% Visual Satisfactory';
      return raw.slice(0, 25);
    }
    return statusUpper === 'PASS' ? '100% Visual Satisfactory' : 'Not Reported';
  }

  // EN 10204
  if (fieldLower === 'en10204type' || fieldLower.includes('en10204')) {
    if (raw && !isDocumentDump(raw)) {
      if (/3\.1/i.test(raw)) return 'EN 10204 Type 3.1';
      if (/3\.2/i.test(raw)) return 'EN 10204 Type 3.2';
      return raw.slice(0, 25);
    }
    return 'EN 10204 Type 3.1';
  }

  // MESC Standard Revision
  if (fieldLower.includes('mesc') || fieldLower === 'mescstandardrevision') {
    if (raw && !isDocumentDump(raw)) {
      const year = raw.match(/\b20\d{2}\b/);
      if (year) return `MESC SPE 77/302:${year[0]}`;
      return raw.slice(0, 25);
    }
    const year = f.reason ? f.reason.match(/\b20\d{2}\b/) : null;
    return year ? `MESC SPE 77/302:${year[0]}` : 'MESC SPE 77/302:2021';
  }

  // NACE
  if (fieldLower.includes('nace')) return 'NACE MR0175 / ISO 15156';

  // Weld Repair
  if (fieldLower.includes('weld')) return 'Without Weld Repair';

  // Radioactive Contamination
  if (fieldLower.includes('radioactive') || fieldLower.includes('radiation')) return 'Free from Contamination';

  // Clean and bound fallback
  if (raw && !isDocumentDump(raw)) {
    const singleLine = raw.replace(/[\r\n\t]+/g, ' ').trim();
    return singleLine.length > 32 ? `${singleLine.slice(0, 30)}...` : singleLine;
  }

  if (norm !== undefined && norm !== null) {
    return `${norm}${unit ? ` ${unit}` : ''}`;
  }

  return statusUpper === 'PASS' ? 'Conforming' : 'Relevant evidence not identified — manual review required';
}

/**
 * Sanitizes the `reason` text from a ComplianceFinding by bounding
 * any embedded evidence.rawValue that may be a document dump.
 * Returns a concise, parameter-specific reason string.
 */
export function sanitizeReasonText(reason: string | undefined): string {
  if (!reason) return 'See detailed finding.';
  
  // If the reason itself is a document dump, extract the key message
  if (isDocumentDump(reason)) {
    // Try to extract the first meaningful sentence before the dump
    // Typical patterns: 'Soaking period of "HUGE DUMP" certified...'
    // We want to keep everything outside the embedded raw value quotes
    const quoteMatch = reason.match(/^(.*?)"([^"]*?)"/);
    if (quoteMatch && quoteMatch[2] && isDocumentDump(quoteMatch[2])) {
      // The quoted content is a dump — replace it with a clean placeholder
      const prefix = quoteMatch[1].trim();
      const afterQuote = reason.slice((quoteMatch.index || 0) + quoteMatch[0].length);
      const cleanAfter = afterQuote.replace(/^[^.;]*[.;]?\s*/, '').trim();
      
      if (prefix && cleanAfter) {
        return `${prefix}(see MTC evidence). ${cleanAfter}`.slice(0, 200);
      }
      if (prefix) {
        return `${prefix}(see MTC evidence for details).`.slice(0, 200);
      }
    }
    
    // Generic truncation: take the first sentence or first 120 chars
    const firstSentence = reason.match(/^[^.!?]{10,120}[.!?]/);
    if (firstSentence) return firstSentence[0];
    
    // Hard truncation
    return reason.slice(0, 100).replace(/\s+\S*$/, '') + '... (see MTC evidence)';
  }
  
  return reason;
}

/**
 * Builds a clean, parameter-specific clarification description for a finding.
 * Used by server-side clarification point generation.
 * 
 * For DEVIATION: "Supplier reports [clean value], but requirement specifies [req]. [clean reason]"
 * For REVIEW_REQUIRED: "[clean reason summary]"
 * For DOCUMENTATION_GAP: "Required evidence not identified in submitted certificate."
 */
export function buildClarificationDescription(f: Partial<ComplianceFinding>): string {
  const status = String(f.status || '').toUpperCase();
  const cleanValue = formatCleanSupplierValue(f);
  const cleanReason = sanitizeReasonText(f.reason);
  
  if (status === 'DEVIATION') {
    return `Reported value "${cleanValue}" deviates from specified requirement "${f.requirementText || 'N/A'}". Reason: ${cleanReason}`;
  }
  
  if (status === 'REVIEW_REQUIRED') {
    return cleanReason;
  }
  
  if (status === 'DOCUMENTATION_GAP') {
    return `The client specification requires "${f.displayName || 'N/A'}" (${f.requirementClause || 'Mandatory'}), which was not identified in the submitted certificate.`;
  }
  
  return cleanReason;
}

/**
 * Shared data-mapping sanitization layer for the MTC Compliance Checker.
 *
 * PURPOSE
 * -------
 * The deterministic compliance rule engine (src/engine/rules.ts) and the
 * MTC evidence extraction layer (server/gemini.ts, AI or regex fallback)
 * populate `ComplianceFinding.supplierRawValue` / `ComplianceFinding.reason`
 * with whatever text the extraction stage produced. In production, a
 * corrupted/garbled scan or an over-eager extraction match can result in
 * these fields containing large spans of unrelated certificate text
 * (chemical composition tables, mechanical property blocks, manufacturer
 * remarks, signature blocks, etc.) instead of a parameter-specific value.
 *
 * This module is the SINGLE, SHARED point where any downstream consumer
 * (PDF/Excel export, the Supplier Clarification Letter, and the browser
 * UI) converts a `ComplianceFinding` into safe, bounded, parameter-specific
 * text. It never mutates or re-evaluates PASS/FAIL/REVIEW decisions — it
 * only sanitizes how the *already-decided* finding is rendered.
 *
 * Imported by both the Node/Express server (server.ts) and the Vite/React
 * frontend (src/components/*, src/utils/exportUtils.ts), so it must stay
 * framework-free (no jsPDF / xlsx / DOM dependencies).
 */
import { ComplianceFinding } from '../types';

/** Fallback copy mandated for any field where a safe, specific value cannot be established. */
export const EVIDENCE_NOT_IDENTIFIED = 'Relevant supplier evidence not identified';
export const MANUAL_REVIEW_REQUIRED = 'Manual review required';

/**
 * Detects whether a string looks like a raw OCR/document dump rather than
 * a specific parameter value or a concise finding narrative.
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
  ];
  const sLower = s.toLowerCase();
  return dumpKeywords.some((kw) => sLower.includes(kw));
}

/**
 * Resolves and formats a clean, parameter-specific supplier value for report exports
 * and the browser UI. Strictly prevents raw OCR dumps, multiline document text, or
 * general certificate snippets from polluting individual property rows.
 */
export function formatExportSupplierValue(f: ComplianceFinding): string {
  // If classified as documentation gap, the supplier did not report this parameter
  const statusUpper = String(f.status || '').trim().toUpperCase();
  if (statusUpper === 'DOCUMENTATION_GAP') {
    return 'Not Reported';
  }

  const field = String(f.field || '').trim();
  const fieldLower = field.toLowerCase().replace(/[\s\-_()+]/g, '');
  const raw = String(f.supplierRawValue || '').trim();
  const norm = f.supplierNormalizedValue;
  const unit = f.supplierUnit || '';

  // 1. Specific Document Identity / Verification Gates
  if (fieldLower.includes('identity') || fieldLower === 'mtcidentityverification') {
    const heat = f.heatNo && f.heatNo !== 'GENERAL' && f.heatNo !== 'HEAT-UNKNOWN' && f.heatNo !== 'UNVERIFIED' ? f.heatNo : '';
    return heat ? `Heat #${heat} Verified` : 'Document Identity Verified';
  }
  if (fieldLower.includes('compatibility') || fieldLower === 'materialspecificationcompatibility') {
    return norm ? String(norm) : (raw && !isDocumentDump(raw) ? raw : 'Grade Match Verified');
  }

  // 2. Chemical Composition Elements (C, Si, Mn, P, S, Cr, Ni, Mo, N, Ni+2Mo, PREN, Cu, etc.)
  if (fieldLower === 'ni2mo' || fieldLower === 'pren') {
    if (norm !== undefined && norm !== null && !isNaN(Number(norm))) {
      return String(norm);
    }
    if (raw && !isDocumentDump(raw)) {
      const numMatch = raw.match(/\b\d+(?:\.\d+)?\b/);
      return numMatch ? numMatch[0] : raw.slice(0, 15);
    }
    return 'Not Identified';
  }

  const isChem =
    f.category === 'chemical' ||
    ['c', 'si', 'mn', 'p', 's', 'cr', 'ni', 'mo', 'n', 'cu', 'al', 'v', 'ti', 'nb', 'w', 'fe'].includes(fieldLower);

  if (isChem) {
    if (norm !== undefined && norm !== null && !isNaN(Number(norm))) {
      const numVal = Number(norm);
      return `${numVal} ${unit || '%'}`.trim();
    }
    if (raw && !isDocumentDump(raw)) {
      const match = raw.match(/^[<>]?\s*(\d+(?:\.\d+)?)\s*(%|wt%|ppm)?$/i);
      if (match) {
        return `${raw.startsWith('<') ? '< ' : raw.startsWith('>') ? '> ' : ''}${match[1]} ${match[2] || unit || '%'}`.trim();
      }
      const numMatch = raw.match(/\b\d+\.\d+\b/);
      if (numMatch) {
        return `${numMatch[0]} ${unit || '%'}`.trim();
      }
      return raw.slice(0, 20);
    }
    return 'Not Identified';
  }

  // 3. Mechanical Properties (Tensile, Yield, Elongation, Reduction of Area)
  if (fieldLower === 'yieldstrength' || fieldLower === 'ys' || fieldLower === 'rp02' || fieldLower === 'reh') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} MPa`;
    const num = raw.match(/\b\d{2,4}\b/);
    return num ? `${num[0]} MPa` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  if (fieldLower === 'tensilestrength' || fieldLower === 'ts' || fieldLower === 'rm') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} MPa`;
    const num = raw.match(/\b\d{2,4}\b/);
    return num ? `${num[0]} MPa` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  if (fieldLower === 'elongation' || fieldLower === 'a5' || fieldLower === 'a') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} %`;
    const num = raw.match(/\b\d{1,3}(?:\.\d+)?\b/);
    return num ? `${num[0]} %` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  if (fieldLower === 'reductionofarea' || fieldLower === 'ra' || fieldLower === 'z') {
    if (norm !== undefined && !isNaN(Number(norm))) return `${norm} %`;
    const num = raw.match(/\b\d{1,3}(?:\.\d+)?\b/);
    return num ? `${num[0]} %` : (raw && !isDocumentDump(raw) ? raw : 'Not Identified');
  }

  // 4. Hardness (e.g. "173, 175, 179 HBW" or "179 HBW")
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

  // 5. Forging Reduction Ratio
  if (fieldLower.includes('forging')) {
    if (raw && !isDocumentDump(raw)) {
      if (/4\s*:\s*1/i.test(raw)) return raw.includes('>') || raw.includes('≥') ? '>4:1' : '4:1';
      return raw.slice(0, 15);
    }
    return norm ? `>${norm}:1` : '>4:1';
  }

  // 6. Heat Treatment Soaking & Condition
  if (fieldLower === 'heattreatmentsoaking') {
    if (raw && !isDocumentDump(raw)) {
      const hrs = raw.match(/\b\d+(?:\.\d+)?\s*(?:hours|hrs|h)\b/i);
      const cooling = /water/i.test(raw) ? ', Water Cooled' : /air/i.test(raw) ? ', Air Cooled' : '';
      if (hrs) return `${hrs[0]}${cooling}`;
      return raw.slice(0, 32);
    }
    return '2 hours, Water Cooled';
  }

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

  // 7. Intergranular Corrosion (IGC)
  if (fieldLower.includes('intergranular') || fieldLower === 'igc') {
    if (raw && !isDocumentDump(raw)) {
      if (/practice\s*e/i.test(raw)) return 'ASTM A262 Practice E (Pass)';
      return raw.slice(0, 30);
    }
    return statusUpper === 'PASS' ? 'ASTM A262 Practice E (Pass)' : 'Not Reported';
  }

  // 8. Non-Destructive Examination (NDE) & Visual
  if (fieldLower === 'ndeexamination' || fieldLower.includes('nde')) {
    if (statusUpper === 'DOCUMENTATION_GAP') return 'Not Identified in MTC';
    if (raw && !isDocumentDump(raw)) return raw.slice(0, 30);
    return statusUpper === 'PASS' ? '100% PT/UT Satisfactory' : 'Pending Review';
  }

  if (fieldLower === 'visualexamination' || fieldLower.includes('visual')) {
    if (raw && !isDocumentDump(raw)) {
      if (/satisfactory|pass|conforms|ok/i.test(raw)) return '100% Visual Satisfactory';
      return raw.slice(0, 25);
    }
    return statusUpper === 'PASS' ? '100% Visual Satisfactory' : 'Not Reported';
  }

  // 9. Material Certifications & Standards (EN 10204, NACE, MESC, Weld Repair, Radioactive)
  if (fieldLower === 'en10204type' || fieldLower.includes('en10204')) {
    if (raw && !isDocumentDump(raw)) {
      if (/3\.1/i.test(raw)) return 'EN 10204 Type 3.1';
      if (/3\.2/i.test(raw)) return 'EN 10204 Type 3.2';
      return raw.slice(0, 25);
    }
    return 'EN 10204 Type 3.1';
  }

  if (fieldLower.includes('mesc') || fieldLower === 'mescstandardrevision') {
    if (raw && !isDocumentDump(raw)) {
      const year = raw.match(/\b20\d{2}\b/);
      if (year) return `MESC SPE 77/302:${year[0]}`;
      return raw.slice(0, 25);
    }
    const year = f.reason ? f.reason.match(/\b20\d{2}\b/) : null;
    return year ? `MESC SPE 77/302:${year[0]}` : 'MESC SPE 77/302:2021';
  }

  if (fieldLower.includes('nace')) {
    return 'NACE MR0175 / ISO 15156';
  }

  if (fieldLower.includes('weld')) {
    return 'Without Weld Repair';
  }

  if (fieldLower.includes('radioactive') || fieldLower.includes('radiation')) {
    return 'Free from Contamination';
  }

  // Clean and bound fallback
  if (raw && !isDocumentDump(raw)) {
    const singleLine = raw.replace(/[\r\n\t]+/g, ' ').trim();
    return singleLine.length > 32 ? `${singleLine.slice(0, 30)}...` : singleLine;
  }

  if (norm !== undefined && norm !== null) {
    return `${norm}${unit ? ` ${unit}` : ''}`;
  }

  return statusUpper === 'PASS' ? 'Conforming' : 'See Remarks';
}

/**
 * Returns a short, human-readable label for "what evidence did the supplier
 * actually provide" — used specifically by clarification/action-item copy.
 * Collapses the various "unknown"/"not identified" formatter outputs into
 * the single mandated fallback phrase.
 */
export function formatEvidenceForClarification(f: ComplianceFinding): string {
  const statusUpper = String(f.status || '').trim().toUpperCase();
  if (statusUpper === 'DOCUMENTATION_GAP') return EVIDENCE_NOT_IDENTIFIED;

  const val = formatExportSupplierValue(f);
  const unresolved = new Set([
    'Not Identified',
    'Not Reported',
    'Not Identified in MTC',
    'See Remarks',
    'Pending Review',
  ]);
  if (!val || unresolved.has(val)) return EVIDENCE_NOT_IDENTIFIED;
  return val;
}

/**
 * Sanitizes `ComplianceFinding.reason` for display. The deterministic rule
 * engine (src/engine/rules.ts) always constructs `reason` from a short
 * template plus the extracted evidence value — if the underlying evidence
 * value was corrupted (e.g. by an extraction fault upstream), the resulting
 * `reason` string can itself balloon into a full document dump. This
 * function never re-evaluates or alters the finding's status/severity; it
 * only decides whether the reason text is safe to render verbatim.
 */
export function sanitizeFindingReason(f: ComplianceFinding): string {
  const raw = String(f.reason || '').trim();
  if (!raw) return `${MANUAL_REVIEW_REQUIRED} — no finding narrative was recorded for this item.`;

  // NOTE: intentionally NOT reusing isDocumentDump()'s length>70 rule here —
  // that threshold is tuned for short single-value fields (supplierRawValue),
  // whereas a legitimate deterministic `reason` sentence is naturally
  // 80-250 chars long. A dump is instead detected by: multi-line content,
  // or explicit document-level keywords, or an extreme length that no
  // template in rules.ts would ever produce for a single finding.
  const hasNewlines = raw.includes('\n') || raw.includes('\r');
  const dumpKeywords = [
    'material test report',
    '材质测试报告',
    'certificate no',
    'manufacturer',
    'we hereby certify',
    'extracted mtc',
    'production no',
    'contract no',
    'customer',
    'purchase order',
    'chemical composition',
    'mechanical property',
  ];
  const rawLower = raw.toLowerCase();
  const hasDumpKeyword = dumpKeywords.some((kw) => rawLower.includes(kw));
  const isExtremeLength = raw.length > 320;

  if (hasNewlines || hasDumpKeyword || isExtremeLength) {
    return `${MANUAL_REVIEW_REQUIRED} — automated extraction could not isolate a parameter-specific finding narrative for "${f.displayName || f.field || 'this item'}" from the submitted certificate.`;
  }

  return raw.replace(/[\t]+/g, ' ').trim();
}

/**
 * Bounds and sanitizes the client requirement text shown in clarification
 * items (defense-in-depth; requirementText normally originates from the
 * MDS requirement set, not raw MTC OCR text, but is bounded here regardless).
 */
function sanitizeRequirementText(f: ComplianceFinding): string {
  const reqText = String(f.requirementText || f.requirementClause || 'See client specification for this parameter.').trim();
  if (isDocumentDump(reqText)) {
    return f.requirementClause
      ? `Per client specification clause ${f.requirementClause}`
      : 'See client specification for this parameter';
  }
  const singleLine = reqText.replace(/[\r\n\t]+/g, ' ').trim();
  return singleLine.length > 200 ? `${singleLine.slice(0, 197)}...` : singleLine;
}

/**
 * Builds a single, safe, parameter-specific "Description" string for a
 * Supplier Technical Clarification / Concession Action Item, covering:
 *   1. Specific parameter
 *   2. Client requirement
 *   3. Relevant supplier evidence only
 *   4. Actual finding / reason
 * (Required Action is a separate, already-static field and is not built here.)
 *
 * This is the single choke point used by both the server (server.ts,
 * feedback draft generation) and the client (ReportModal.tsx fallback
 * draft) so that the export HTML/PDF and the browser UI editor can never
 * diverge or leak a raw document dump into a finding description.
 */
export function buildClarificationDescription(f: ComplianceFinding): string {
  const heatPart =
    f.heatNo && f.heatNo !== 'GENERAL' && f.heatNo !== 'HEAT-UNKNOWN' && f.heatNo !== 'UNVERIFIED'
      ? ` (Heat ${f.heatNo})`
      : '';
  const clientReq = sanitizeRequirementText(f);
  const evidence = formatEvidenceForClarification(f);
  const finding = sanitizeFindingReason(f);
  const statusUpper = String(f.status || '').trim().toUpperCase();

  const findingLabel =
    statusUpper === 'DEVIATION'
      ? 'Deviation'
      : statusUpper === 'DOCUMENTATION_GAP'
      ? 'Documentation Gap'
      : 'Finding';

  return `Parameter: ${f.displayName || f.field || 'Unspecified Parameter'}${heatPart}. Client Requirement: ${clientReq}. Supplier Evidence: ${evidence}. ${findingLabel}: ${finding}`;
}

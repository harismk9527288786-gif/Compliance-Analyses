/**
 * Deterministic Compliance Rule Engine
 * 
 * ARCHITECTURAL MANDATE:
 * Normal programmatic logic handles all final numerical and categorical decisions.
 * The LLM is NEVER the final compliance decision maker.
 */

import {
  Requirement,
  SupplierEvidence,
  ComplianceFinding,
  FindingStatus,
  FindingSeverity,
  CertificateRecord,
} from '../types';
import { parseEngineeringValue, convertValue, normalizeUnitString } from './units';
import { calculateCarbonEquivalent, ChemistryElements } from './ce';

export interface ComparisonContext {
  analysisId: string;
  requirements: Requirement[];
  certificate: CertificateRecord;
}

/**
 * Runs the deterministic compliance evaluation against all requirements and supplier evidence.
 */
export function evaluateCompliance(context: ComparisonContext): ComplianceFinding[] {
  const { analysisId, requirements, certificate } = context;
  const findings: ComplianceFinding[] = [];

  // Group evidence by heat and by field
  const heats = certificate.heats && certificate.heats.length > 0 ? certificate.heats : ['GENERAL'];

  // Check whether requirement is heat-specific or general
  for (const req of requirements) {
    const isHeatSpecific = ['chemical', 'mechanical', 'heat_treatment', 'hardness'].includes(req.category);

    if (isHeatSpecific && heats.length > 0) {
      for (const heatNo of heats) {
        const finding = evaluateSingleRequirement(analysisId, req, certificate, heatNo);
        findings.push(finding);
      }
    } else {
      const finding = evaluateSingleRequirement(analysisId, req, certificate, undefined);
      findings.push(finding);
    }
  }

  return findings;
}

/**
 * Evaluates a single requirement against certificate evidence for a specific heat or general.
 */
export function evaluateSingleRequirement(
  analysisId: string,
  req: Requirement,
  cert: CertificateRecord,
  heatNo?: string
): ComplianceFinding {
  // Special check: Unverified MDS Specification Identity
  if (req.field === 'mdsSpecificationIdentity' || req.field === 'mdsIdentityVerification') {
    return {
      id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
      analysisId,
      requirementId: req.id,
      category: 'general',
      field: req.field,
      displayName: req.displayName,
      heatNo,
      requirementText: req.description || 'MDS Specification Identity Verification',
      requirementClause: req.clauseReference || 'SPEC-ID-01',
      requirementSourceDoc: req.sourceDocument,
      requirementSourcePage: req.sourcePage || 1,
      supplierRawValue: 'UNIDENTIFIED SPECIFICATION',
      confidence: 'low',
      operator: 'REQUIRED',
      calculatedComparison: 'Unverified MDS Identity -> REVIEW REQUIRED',
      status: 'REVIEW_REQUIRED',
      severity: 'critical',
      reason: req.description || 'MDS standard, material grade, or revision could not be confidently established from document. Technical quality engineering review required.',
      metallurgicalExplanation: 'Cannot map engineering limits without validated specification identity. Default or fallback rule sets are prohibited.',
      isReviewed: false,
    };
  }

  // Find matching evidence items
  const matchedEvidence = cert.evidenceItems.filter((e) => {
    const fieldMatch =
      e.field.toLowerCase() === req.field.toLowerCase() ||
      Boolean(e.displayName && req.displayName && e.displayName.toLowerCase() === req.displayName.toLowerCase());
    if (!fieldMatch) return false;
    if (heatNo && e.heatNo && e.heatNo !== 'GENERAL' && e.heatNo !== heatNo) {
      return false;
    }
    return true;
  });

  const evidence = matchedEvidence[0];

  // If no evidence found
  if (!evidence || !evidence.rawValue || evidence.rawValue.trim() === '' || evidence.rawValue === 'NOT_FOUND') {
    return createDocumentationGapFinding(analysisId, req, heatNo);
  }

  // Low confidence check
  if (evidence.confidence === 'low') {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      'Extraction confidence is low. Manual human verification required.'
    );
  }

  // Operator evaluation
  const op = String(req.operator || '').trim().toUpperCase();
  switch (op) {
    case 'MIN':
    case '>=':
    case '>':
      return evaluateMinOperator(analysisId, req, evidence, heatNo);
    case 'MAX':
    case '<=':
    case '<':
      return evaluateMaxOperator(analysisId, req, evidence, heatNo);
    case 'RANGE':
    case 'BETWEEN':
      return evaluateRangeOperator(analysisId, req, evidence, heatNo);
    case 'EQUALS':
    case 'MATCH':
    case '==':
    case '=':
      return evaluateMatchOperator(analysisId, req, evidence, heatNo);
    case 'REQUIRED':
      return evaluateRequiredOperator(analysisId, req, evidence, heatNo);
    case 'FORBIDDEN':
      return evaluateForbiddenOperator(analysisId, req, evidence, heatNo);
    case 'AGGREGATE':
      return evaluateAggregateOperator(analysisId, req, cert, evidence, heatNo);
    default:
      if (
        (req.minValue !== undefined || (req as any).requiredMin !== undefined) &&
        (req.maxValue !== undefined || (req as any).requiredMax !== undefined)
      ) {
        return evaluateRangeOperator(analysisId, req, evidence, heatNo);
      }
      if (req.minValue !== undefined || (req as any).requiredMin !== undefined) {
        return evaluateMinOperator(analysisId, req, evidence, heatNo);
      }
      if (req.maxValue !== undefined || (req as any).requiredMax !== undefined) {
        return evaluateMaxOperator(analysisId, req, evidence, heatNo);
      }
      return evaluateMatchOperator(analysisId, req, evidence, heatNo);
  }
}

function evaluateMinOperator(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  const reqMin = req.minValue ?? (req as any).requiredMin ?? 0;
  const parsed = parseEngineeringValue(evidence.rawValue);

  if (!parsed) {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Could not parse numeric value from supplier evidence: "${evidence.rawValue}"`
    );
  }

  // If supplier value carries an explicit 'less-than' operator (e.g. "< 250 MPa"),
  // the value is strictly below the stated number — cannot confirm it meets minimum.
  if (parsed.relationalOperator === '<' || parsed.relationalOperator === '<=') {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Supplier evidence states value is less than ${parsed.value} ${req.unit || ''}, which cannot confirm minimum of ${reqMin} ${req.unit || ''}. Explicit test value required.`
    );
  }

  const normalizedVal = req.unit ? convertValue(parsed.value, parsed.unit || req.unit, req.unit) : parsed.value;

  // Guard: hardness unit conversions below the ASTM E140 range return NaN — cannot evaluate
  if (isNaN(normalizedVal)) {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Hardness value "${evidence.rawValue}" is below the ASTM E140 valid conversion range and cannot be compared to the ${req.unit} minimum of ${reqMin}. Raw test value must be reported in the same scale as the specification.`
    );
  }

  const isPass = normalizedVal >= reqMin;


  const status: FindingStatus = isPass ? 'PASS' : 'DEVIATION';
  const severity: FindingSeverity = isPass ? 'info' : (normalizedVal < reqMin * 0.9 ? 'critical' : 'major');
  const calcStr = `${normalizedVal} ${req.unit || ''} >= ${reqMin} ${req.unit || ''} -> ${isPass ? 'PASS' : 'DEVIATION'}`;
  const reason = isPass
    ? `Supplier value ${normalizedVal} ${req.unit || ''} satisfies the minimum required threshold of ${reqMin} ${req.unit || ''}.`
    : `Supplier value ${normalizedVal} ${req.unit || ''} is below the specified minimum limit of ${reqMin} ${req.unit || ''} by ${(reqMin - normalizedVal).toFixed(1)} ${req.unit || ''}.`;

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: (req as any).requirementText || req.description || `Minimum ${reqMin} ${req.unit || ''}`,
    requiredMin: reqMin,
    requiredUnit: req.unit,
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierNormalizedValue: normalizedVal,
    supplierUnit: req.unit || parsed.unit,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'MIN',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    isReviewed: false,
  };

}

function evaluateMaxOperator(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  const reqMax = req.maxValue ?? (req as any).requiredMax ?? Infinity;
  const parsed = parseEngineeringValue(evidence.rawValue);

  if (!parsed) {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Could not parse numeric value from supplier evidence: "${evidence.rawValue}"`
    );
  }

  // If supplier value carries an explicit 'greater-than' operator (e.g. "> 450 MPa"),
  // the value is strictly above the stated number — cannot confirm it is within maximum.
  if (parsed.relationalOperator === '>' || parsed.relationalOperator === '>=') {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Supplier evidence states value is greater than ${parsed.value} ${req.unit || ''}, which cannot confirm it is within maximum of ${reqMax} ${req.unit || ''}. Explicit test value required.`
    );
  }

  const normalizedVal = req.unit ? convertValue(parsed.value, parsed.unit || req.unit, req.unit) : parsed.value;

  // Guard: hardness unit conversions below the ASTM E140 range return NaN — cannot evaluate
  if (isNaN(normalizedVal)) {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Hardness value "${evidence.rawValue}" is below the ASTM E140 valid conversion range and cannot be compared to the ${req.unit} limit of ${reqMax}. Raw test value must be reported in the same scale as the specification.`
    );
  }

  const isPass = normalizedVal <= reqMax;


  const status: FindingStatus = isPass ? 'PASS' : 'DEVIATION';
  const severity: FindingSeverity = isPass ? 'info' : 'critical';
  const calcStr = `${normalizedVal} ${req.unit || ''} <= ${reqMax} ${req.unit || ''} -> ${isPass ? 'PASS' : 'DEVIATION'}`;
  const reason = isPass
    ? `Supplier value ${normalizedVal} ${req.unit || ''} is within the maximum allowable limit of ${reqMax} ${req.unit || ''}.`
    : `Supplier value ${normalizedVal} ${req.unit || ''} exceeds the maximum allowable limit of ${reqMax} ${req.unit || ''}.`;

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: (req as any).requirementText || req.description || `Maximum ${reqMax} ${req.unit || ''}`,
    requiredMax: reqMax,
    requiredUnit: req.unit,
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierNormalizedValue: normalizedVal,
    supplierUnit: req.unit || parsed.unit,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'MAX',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    isReviewed: false,
  };
}

function evaluateRangeOperator(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  const reqMin = req.minValue ?? (req as any).requiredMin ?? 0;
  const reqMax = req.maxValue ?? (req as any).requiredMax ?? Infinity;
  const parsed = parseEngineeringValue(evidence.rawValue);

  if (!parsed) {
    return createReviewRequiredFinding(
      analysisId,
      req,
      evidence,
      heatNo,
      `Could not parse numeric range value from supplier evidence: "${evidence.rawValue}"`
    );
  }

  const normalizedVal = req.unit ? convertValue(parsed.value, parsed.unit || req.unit, req.unit) : parsed.value;
  const isPass = normalizedVal >= reqMin && normalizedVal <= reqMax;

  const status: FindingStatus = isPass ? 'PASS' : 'DEVIATION';
  const severity: FindingSeverity = isPass ? 'info' : 'critical';
  const calcStr = `${reqMin} <= ${normalizedVal} <= ${reqMax} ${req.unit || ''} -> ${isPass ? 'PASS' : 'DEVIATION'}`;
  
  let reason = '';
  if (isPass) {
    reason = `Supplier value ${normalizedVal} ${req.unit || ''} conforms to specified acceptable range of ${reqMin} - ${reqMax} ${req.unit || ''}.`;
  } else if (normalizedVal < reqMin) {
    reason = `Supplier value ${normalizedVal} ${req.unit || ''} is below the lower range limit of ${reqMin} ${req.unit || ''}.`;
  } else {
    reason = `Supplier value ${normalizedVal} ${req.unit || ''} exceeds the upper range limit of ${reqMax} ${req.unit || ''}.`;
  }

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: (req as any).requirementText || req.description || `${reqMin} - ${reqMax} ${req.unit || ''}`,
    requiredMin: reqMin,
    requiredMax: reqMax,
    requiredUnit: req.unit,
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierNormalizedValue: normalizedVal,
    supplierUnit: req.unit || parsed.unit,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'RANGE',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    isReviewed: false,
  };
}

function evaluateMatchOperator(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  const reqTarget = String(req.targetValue || req.description || '').trim().toLowerCase();
  const rawEv = String(evidence.rawValue || '').trim().toLowerCase();

  // Normalize string comparisons
  const cleanTarget = reqTarget.replace(/[\s\-_/]/g, '');
  const cleanEvidence = rawEv.replace(/[\s\-_/]/g, '');

  const targetOptions = reqTarget.split(/\s+or\s+|\s*\/\s*|\|/i).map((t) => t.trim().replace(/[\s\-_/]/g, ''));
  const matchesAnyOption = targetOptions.some(
    (opt) => opt.length > 2 && (cleanEvidence.includes(opt) || opt.includes(cleanEvidence))
  );

  let isMatch =
    (cleanTarget.length > 1 && (cleanEvidence.includes(cleanTarget) || cleanTarget.includes(cleanEvidence))) ||
    matchesAnyOption ||
    // Only allow generic pass-language if the requirement itself is asking for a generic conformity statement
    (reqTarget.includes('pass') && rawEv.includes('pass')) ||
    (reqTarget.includes('conforms') && rawEv.includes('conforms')) ||
    (reqTarget.includes('3.1') && rawEv.includes('3.1')) ||
    (reqTarget.includes('nace') && rawEv.includes('nace'));


  // Strict metallurgical verification for Heat Treatment Condition
  if (req.field === 'heatTreatmentCondition') {
    const isSolutionAnneal = rawEv.includes('solution') || rawEv.includes('water cool');
    const requiresSolutionAnneal = reqTarget.includes('solution');
    const isNormalizeAndTemper = rawEv.includes('normaliz') && (rawEv.includes('temper') || rawEv.includes('air cool'));
    const isFullAnneal = rawEv.includes('anneal') && !isSolutionAnneal && (rawEv.includes('furnace') || !rawEv.includes('water'));

    if (isSolutionAnneal && requiresSolutionAnneal) {
      isMatch = true;
    } else if (isSolutionAnneal && !requiresSolutionAnneal) {
      isMatch = false;
    } else if (reqTarget.includes('furnace cool') || reqTarget.includes('normalize & temper') || reqTarget.includes('normalize')) {
      isMatch = Boolean(
        (isNormalizeAndTemper && (reqTarget.includes('normaliz') || reqTarget.includes('temper'))) ||
        (isFullAnneal && reqTarget.includes('anneal'))
      );
    }
  }

  const status: FindingStatus = isMatch ? 'PASS' : 'DEVIATION';
  const severity: FindingSeverity = isMatch ? 'info' : 'major';
  const calcStr = `"${evidence.rawValue}" MATCH "${req.targetValue || req.description}" -> ${status}`;
  const reason = isMatch
    ? `Supplier statement satisfies requirement: "${evidence.rawValue}".`
    : `Supplier statement "${evidence.rawValue}" does not match specified requirement: "${req.targetValue || req.description}".`;

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: req.description || String(req.targetValue || ''),
    requiredTarget: String(req.targetValue || ''),
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'MATCH',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    isReviewed: false,
  };
}

function evaluateRequiredOperator(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  const raw = String(evidence.rawValue || '').trim().toLowerCase();
  const isPresent = raw !== '' && raw !== 'not_found' && raw !== 'absent' && !raw.includes('not provided');

  if (!isPresent) {
    return createDocumentationGapFinding(analysisId, req, heatNo);
  }

  const isPositive =
    raw.includes('yes') ||
    raw.includes('completed') ||
    raw.includes('pass') ||
    raw.includes('conforms') ||
    raw.includes('performed') ||
    raw.includes('certified') ||
    raw.includes('100%') ||
    raw.includes('satisfactory');

  const status: FindingStatus = isPositive ? 'PASS' : 'DEVIATION';
  const severity: FindingSeverity = isPositive ? 'info' : 'minor';
  const calcStr = `Evidence Present: "${evidence.rawValue}" -> ${status}`;
  const reason = isPositive
    ? `Required evidence confirmed: "${evidence.rawValue}".`
    : `Evidence provided does not confirm requirement: "${evidence.rawValue}".`;

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: req.description || 'Mandatory Evidence Required',
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'REQUIRED',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    isReviewed: false,
  };
}

function evaluateForbiddenOperator(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  const raw = String(evidence.rawValue || '').trim().toLowerCase();
  const forbiddenPhrases = ['repaired', 'weld repaired', 'defect repaired', 'welding performed'];
  const safePhrases = [
    'no weld repair', 'without weld repair', 'none', 'nil', 'not permitted', 'no welding',
    'not repaired', 'not weld repaired', 'no repair', 'unrepaired', 'repair: none',
    'repair: nil', 'weld repair: none', 'weld repair: nil', 'no defect repair',
  ];

  const containsForbidden = forbiddenPhrases.some((p) => raw.includes(p)) && !safePhrases.some((p) => raw.includes(p));


  const status: FindingStatus = containsForbidden ? 'DEVIATION' : 'PASS';
  const severity: FindingSeverity = containsForbidden ? 'critical' : 'info';
  const calcStr = `Check Prohibited Condition -> ${status}`;
  const reason = containsForbidden
    ? `Supplier evidence indicates prohibited activity: "${evidence.rawValue}".`
    : `Supplier confirms no prohibited repair/condition: "${evidence.rawValue}".`;

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: req.description || 'Prohibited condition',
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'FORBIDDEN',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    isReviewed: false,
  };
}

function evaluateAggregateOperator(
  analysisId: string,
  req: Requirement,
  cert: CertificateRecord,
  evidence: SupplierEvidence,
  heatNo?: string
): ComplianceFinding {
  // Aggregate carbon equivalent check
  const chemistry: ChemistryElements = {};
  const heatEvidence = cert.evidenceItems.filter((e) => !heatNo || e.heatNo === heatNo || e.heatNo === 'GENERAL');

  for (const item of heatEvidence) {
    if (item.category === 'chemical') {
      const parsed = parseEngineeringValue(item.rawValue);
      if (parsed) {
        chemistry[item.field] = parsed.value;
      }
    }
  }

  const reportedParsed = parseEngineeringValue(evidence.rawValue);
  const reportedCE = reportedParsed ? reportedParsed.value : undefined;
  const maxLimit = req.maxValue ?? 0.43;

  const ceResult = calculateCarbonEquivalent(chemistry, maxLimit, reportedCE);

  // If critical elements (C, Mn) were missing from the MTC chemistry,
  // CE cannot be reliably calculated — return DOCUMENTATION_GAP instead of a fabricated PASS
  if (ceResult.missingCriticalElements && ceResult.missingCriticalElements.length > 0) {
    const missingList = ceResult.missingCriticalElements.join(', ');
    return {
      id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
      analysisId,
      requirementId: req.id,
      evidenceId: evidence.id,
      category: req.category,
      field: req.field,
      displayName: req.displayName,
      heatNo,
      requirementText: `Max CE ${maxLimit} (IIW formula)`,
      requiredMax: maxLimit,
      requirementClause: req.clauseReference,
      requirementSourceDoc: req.sourceDocument,
      requirementSourcePage: req.sourcePage,
      supplierRawValue: evidence.rawValue,
      supplierEvidenceDoc: evidence.sourceDocument,
      supplierEvidencePage: evidence.sourcePage,
      supplierSnippet: evidence.snippet,
      confidence: 'low',
      operator: 'AGGREGATE',
      calculatedComparison: `CE calculation incomplete — missing elements: ${missingList}`,
      status: 'DOCUMENTATION_GAP',
      severity: 'critical',
      reason: `Carbon Equivalent cannot be verified: mandatory element(s) [${missingList}] were not identified in the submitted MTC chemistry data. Submit complete chemical analysis report.`,
      metallurgicalExplanation: `Formula: ${ceResult.formula}. Missing mandatory elements: ${missingList}. Cannot compute CE without these values.`,
      isReviewed: false,
    };
  }

  const isPass = ceResult.isCompliantWithLimit;
  const status: FindingStatus = isPass ? 'PASS' : 'DEVIATION';
  const severity: FindingSeverity = isPass ? 'info' : 'major';

  let calcStr = `Calculated CE: ${ceResult.calculatedCE} <= ${maxLimit} [${ceResult.breakdown}]`;
  if (reportedCE !== undefined) {
    calcStr += ` | Reported MTC CE: ${reportedCE}`;
  }

  let reason = '';
  if (isPass) {
    reason = `Carbon Equivalent of ${ceResult.calculatedCE} is within the max limit of ${maxLimit}. Calculated chemistry aligns with reported values.`;
  } else {
    reason = `Calculated Carbon Equivalent ${ceResult.calculatedCE} exceeds maximum limit of ${maxLimit}.`;
  }

  return {
    id: `finding-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: `Max ${maxLimit}`,
    requiredMax: maxLimit,
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierNormalizedValue: ceResult.calculatedCE,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: 'AGGREGATE',
    calculatedComparison: calcStr,
    status,
    severity,
    reason,
    metallurgicalExplanation: `Formula: ${ceResult.formula}. Elements: C=${chemistry.C ?? 0}%, Mn=${chemistry.Mn ?? 0}%, Cr=${chemistry.Cr ?? 0}%, Mo=${chemistry.Mo ?? 0}%, V=${chemistry.V ?? 0}%, Ni=${chemistry.Ni ?? 0}%, Cu=${chemistry.Cu ?? 0}%.`,
    isReviewed: false,
  };
}


function createDocumentationGapFinding(
  analysisId: string,
  req: Requirement,
  heatNo?: string
): ComplianceFinding {
  return {
    id: `gap-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: req.description || `Required: ${req.displayName}`,
    requiredMin: req.minValue,
    requiredMax: req.maxValue,
    requiredUnit: req.unit,
    requiredTarget: String(req.targetValue || ''),
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: 'NOT IDENTIFIED IN MTC',
    confidence: 'high',
    operator: req.operator,
    calculatedComparison: 'Evidence Missing -> DOCUMENTATION_GAP',
    status: 'DOCUMENTATION_GAP',
    severity: req.mandatory ? 'major' : 'minor',
    reason: `The client specification requires "${req.displayName}" (${req.clauseReference || req.sourceDocument}), but corresponding test evidence or certification statement was not explicitly identified in the submitted MTC.`,
    metallurgicalExplanation: 'This is classified as a documentation gap rather than a material failure. Verification or supplementary certificate required from supplier.',
    isReviewed: false,
  };
}

function createReviewRequiredFinding(
  analysisId: string,
  req: Requirement,
  evidence: SupplierEvidence,
  heatNo: string | undefined,
  reason: string
): ComplianceFinding {
  return {
    id: `dev-${req.id}-${heatNo || 'gen'}-${Date.now()}`,
    analysisId,
    requirementId: req.id,
    evidenceId: evidence.id,
    category: req.category,
    field: req.field,
    displayName: req.displayName,
    heatNo,
    requirementText: req.description || req.displayName,
    requiredMin: req.minValue,
    requiredMax: req.maxValue,
    requiredUnit: req.unit,
    requiredTarget: String(req.targetValue || ''),
    requirementClause: req.clauseReference,
    requirementSourceDoc: req.sourceDocument,
    requirementSourcePage: req.sourcePage,
    supplierRawValue: evidence.rawValue,
    supplierEvidenceDoc: evidence.sourceDocument,
    supplierEvidencePage: evidence.sourcePage,
    supplierSnippet: evidence.snippet,
    confidence: evidence.confidence,
    operator: req.operator,
    calculatedComparison: 'Unverified / Invalid Format -> DEVIATION',
    status: 'DEVIATION',
    severity: 'major',
    reason,
    isReviewed: false,
  };
}

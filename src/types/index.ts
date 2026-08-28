export type UserRole =
  | 'ADMIN'
  | 'QUALITY_ENGINEER'
  | 'REVIEWER'
  | 'VIEWER'
  | 'admin'
  | 'qc_reviewer'
  | 'engineer'
  | 'viewer'
  | 'auditor';

export interface UserPermissions {
  canManageUsers: boolean;
  canManageRequirementSets: boolean;
  canUploadAndAnalyze: boolean;
  canReviewAndOverride: boolean;
  canApproveOrReject: boolean;
  canViewAuditTrail: boolean;
  isReadOnly: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  avatar?: string;
  lastLoginAt?: string | null;
  permissions?: UserPermissions;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  tier: string;
  requireMfa: boolean;
  allowExternalAi: boolean;
  retentionMonths: number;
  retentionDays?: number;
  retentionPolicy?: string;
}

export interface RetentionPolicyInfo {
  policyName: string;
  retentionDays: number;
  guaranteedUntilNotice: string;
  totalActiveRecords: number;
  storageTier: string;
  lastPurgeCheckAt: string;
  disclaimer: string;
}

export type DocumentType = 'mtc' | 'mds';

export interface DocumentRecord {
  id: string;
  type: DocumentType;
  filename: string;
  filesize: number;
  checksum: string;
  pageCount: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  organizationId: string;
  mimeType: string;
  contentSummary?: string;
  rawText?: string;
  isScanned?: boolean;
}

export type RequirementCategory =
  | 'chemical'
  | 'mechanical'
  | 'heat_treatment'
  | 'hardness'
  | 'nde'
  | 'certification'
  | 'dimensional'
  | 'general';

export type RuleOperator =
  | 'MIN'
  | 'MAX'
  | 'RANGE'
  | 'EQUALS'
  | 'MATCH'
  | 'REQUIRED'
  | 'FORBIDDEN'
  | 'PERCENT_UNIT'
  | 'AGGREGATE';

export interface Requirement {
  id: string;
  category: RequirementCategory;
  field: string;
  displayName: string;
  operator: RuleOperator;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  targetValue?: string | number;
  tolerance?: number;
  mandatory: boolean;
  description: string;
  clauseReference?: string;
  sourceDocument: string;
  sourcePage: number;
  metallurgicalNotes?: string;
}

export interface RequirementSet {
  id: string;
  clientName: string;
  materialGrade: string;
  mdsNumber: string;
  revision: string;
  title: string;
  effectiveDate: string;
  status: 'draft' | 'approved' | 'superseded';
  approvedBy?: string;
  approvedAt?: string;
  organizationId: string;
  requirements: Requirement[];
  sourceDocumentId?: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SupplierEvidence {
  id: string;
  certificateId: string;
  heatNo: string;
  partNo?: string;
  category: RequirementCategory;
  field: string;
  displayName: string;
  rawValue: string;
  normalizedValue?: number | string;
  unit?: string;
  sourceDocument: string;
  sourcePage: number;
  snippet?: string;
  confidence: ConfidenceLevel;
  extractedAt: string;
}

export interface CertificateRecord {
  id: string;
  documentId: string;
  mtcNumber: string;
  supplierName: string;
  clientName?: string;
  poNumber?: string;
  issueDate: string;
  materialGrade: string;
  standard: string;
  heats: string[];
  parts?: string[];
  productType?: string;
  certifiedBy?: string;
  en10204Type?: string;
  evidenceItems: SupplierEvidence[];
}

export type FindingStatus =
  | 'PASS'
  | 'DEVIATION'
  | 'DOCUMENTATION_GAP'
  | 'REVIEW_REQUIRED';

export type FindingSeverity = 'critical' | 'major' | 'minor' | 'info';

export interface ComplianceFinding {
  id: string;
  analysisId: string;
  requirementId: string;
  evidenceId?: string;
  category: RequirementCategory;
  field: string;
  displayName: string;
  heatNo?: string;
  partNo?: string;
  
  // Requirement summary
  requirementText: string;
  requiredMin?: number;
  requiredMax?: number;
  requiredUnit?: string;
  requiredTarget?: string;
  requirementClause?: string;
  requirementSourceDoc: string;
  requirementSourcePage: number;

  // Supplier Evidence summary
  supplierRawValue: string;
  supplierNormalizedValue?: number | string;
  supplierUnit?: string;
  supplierEvidenceDoc?: string;
  supplierEvidencePage?: number;
  supplierSnippet?: string;
  confidence: ConfidenceLevel;

  // Compliance evaluation
  operator: RuleOperator;
  calculatedComparison: string;
  status: FindingStatus;
  severity: FindingSeverity;
  reason: string;
  metallurgicalExplanation?: string;

  // Human Reviewer state
  isReviewed: boolean;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  originalStatus?: FindingStatus;
  reviewerDecision?: 'confirmed' | 'overridden' | 'marked_gap' | 'needs_clarification';
  overrideReason?: string;
  reviewerComment?: string;
  auditHistory?: FindingAuditEntry[];
}

export interface FindingAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  previousStatus?: FindingStatus;
  newStatus?: FindingStatus;
  reason?: string;
  comment?: string;
}

export type AnalysisStatus =
  | 'uploading'
  | 'processing'
  | 'ready_for_review'
  | 'review_in_progress'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface AnalysisRecord {
  id: string;
  organizationId: string;
  title: string;
  mtcDocumentId: string;
  mtcFilename: string;
  mdsDocumentId?: string;
  mdsFilename?: string;
  requirementSetId?: string;
  requirementSetTitle: string;
  materialGrade: string;
  mtcMaterialGrade?: string;
  mdsMaterialGrade?: string;
  mdsRevision?: string;
  compatibilityStatus?: 'COMPATIBLE' | 'MISMATCH' | 'REVIEW_REQUIRED';
  supplierName: string;
  clientName: string;
  poNumber?: string;
  mtcNumber: string;
  heats: string[];
  
  status: AnalysisStatus;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  
  passCount: number;
  deviationCount: number;
  documentationGapCount: number;
  reviewRequiredCount: number;
  totalFindings: number;
  
  reviewedCount: number;
  finalStatus?: 'APPROVED' | 'REJECTED' | 'CONDITIONAL_APPROVAL' | 'PENDING';
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;

  aiModelUsed?: string;
  /** False when Gemini AI was unavailable and deterministic regex fallback was used for evidence extraction.
   *  In that case the engineer should verify extracted values manually. */
  aiExtractionUsed?: boolean;
  ruleEngineVersion: string;


  expiresAt?: string;
  retentionDaysRemaining?: number;
}

export interface ExternalFeedbackDraft {
  id: string;
  analysisId: string;
  title: string;
  overallStatus: string;
  salutation: string;
  openingStatement: string;
  conformingSummary: string;
  clarificationPoints: {
    id: string;
    itemNumber: number;
    title: string;
    findingId: string;
    description: string;
    actionRequired: string;
  }[];
  closingStatement: string;
  status: 'draft' | 'approved' | 'sent';
  lastEditedBy?: string;
  lastEditedAt?: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  objectType: 'document' | 'analysis' | 'finding' | 'requirement_set' | 'report' | 'user' | 'auth' | 'invitation' | 'system';
  objectId: string;
  objectName?: string;
  timestamp: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export interface TestSuiteResult {
  id: string;
  title: string;
  description: string;
  status: 'passed' | 'failed';
  durationMs: number;
  expected: string;
  actual: string;
  details: string;
  category: string;
}

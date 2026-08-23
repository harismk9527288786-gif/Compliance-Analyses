import {
  User,
  Organization,
  DocumentRecord,
  RequirementSet,
  CertificateRecord,
  AnalysisRecord,
  ComplianceFinding,
  AuditEvent,
  ExternalFeedbackDraft,
} from '../src/types';
import { PILOT_MDS_REQUIREMENT_SET, PILOT_SUPPLIER_MTC } from '../src/engine/pilotData';
import { evaluateCompliance } from '../src/engine/rules';

// Pre-seeded Demo Organizations
export const ORGANIZATIONS: Organization[] = [
  {
    id: 'org-apex-01',
    name: 'Apex Valve & Flow Engineering Ltd.',
    code: 'APEX-VALVES',
    tier: 'Enterprise Quality Suite',
    requireMfa: true,
    allowExternalAi: true,
    retentionMonths: 24,
  },
  {
    id: 'org-global-02',
    name: 'Global Metallurgy & Inspection Corp',
    code: 'GMIC-QC',
    tier: 'Professional QC',
    requireMfa: false,
    allowExternalAi: true,
    retentionMonths: 12,
  },
];

// Pre-seeded Demo Users with explicit RBAC roles
export const USERS: User[] = [
  {
    id: 'user-lead-qc',
    name: 'Lead QC Inspector',
    email: 'qc.lead@apexvalves.com',
    role: 'qc_reviewer',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-materials-engineer',
    name: 'Materials Engineer (PE)',
    email: 'materials.engineer@apexvalves.com',
    role: 'engineer',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-quality-auditor',
    name: 'Quality Auditor',
    email: 'auditor@apexvalves.com',
    role: 'auditor',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-admin-system',
    name: 'System Administrator',
    email: 'admin@apexvalves.com',
    role: 'admin',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-viewer-guest',
    name: 'Client QA Observer',
    email: 'observer@clientaudit.com',
    role: 'viewer',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  },
];

// Client-partitioned data store structure (IP / Session Scoped)
export interface ClientScopeData {
  documents: Map<string, DocumentRecord>;
  requirementSets: Map<string, RequirementSet>;
  certificates: Map<string, CertificateRecord>;
  analyses: Map<string, AnalysisRecord>;
  findings: Map<string, ComplianceFinding[]>;
  feedbackDrafts: Map<string, ExternalFeedbackDraft>;
  auditLogs: AuditEvent[];
  lastSeenAt: string;
}

// In-Memory Database Store partitioned by Client IP / Session
class DatabaseStore {
  private scopes: Map<string, ClientScopeData> = new Map();

  /**
   * Resolves the persistent isolated data scope for a given client IP/session.
   * New IPs start with a clean state (0 analyses, 0 documents).
   */
  public getScope(clientKey: string): ClientScopeData {
    const key = (clientKey && clientKey.trim()) ? clientKey.trim() : '127.0.0.1';
    if (!this.scopes.has(key)) {
      this.scopes.set(key, {
        documents: new Map(),
        requirementSets: new Map(),
        certificates: new Map(),
        analyses: new Map(),
        findings: new Map(),
        feedbackDrafts: new Map(),
        auditLogs: [],
        lastSeenAt: new Date().toISOString(),
      });
    }
    const scope = this.scopes.get(key)!;
    scope.lastSeenAt = new Date().toISOString();
    return scope;
  }

  // --- Analyses ---
  public getAnalyses(clientKey: string, orgId?: string): AnalysisRecord[] {
    const scope = this.getScope(clientKey);
    const list = Array.from(scope.analyses.values());
    if (orgId) {
      return list
        .filter((a) => a.organizationId === orgId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAnalysis(clientKey: string, id: string): AnalysisRecord | undefined {
    return this.getScope(clientKey).analyses.get(id);
  }

  public setAnalysis(clientKey: string, id: string, analysis: AnalysisRecord) {
    this.getScope(clientKey).analyses.set(id, analysis);
  }

  public deleteAnalysis(clientKey: string, id: string) {
    const scope = this.getScope(clientKey);
    scope.analyses.delete(id);
    scope.findings.delete(id);
    scope.feedbackDrafts.delete(id);
  }

  public clearAllAnalyses(clientKey: string, orgId?: string) {
    const scope = this.getScope(clientKey);
    if (!orgId) {
      scope.analyses.clear();
      scope.findings.clear();
      scope.feedbackDrafts.clear();
    } else {
      for (const [id, analysis] of scope.analyses.entries()) {
        if (analysis.organizationId === orgId) {
          scope.analyses.delete(id);
          scope.findings.delete(id);
          scope.feedbackDrafts.delete(id);
        }
      }
    }
  }

  // --- Findings ---
  public getFindings(clientKey: string, analysisId: string): ComplianceFinding[] | undefined {
    return this.getScope(clientKey).findings.get(analysisId);
  }

  public setFindings(clientKey: string, analysisId: string, findings: ComplianceFinding[]) {
    this.getScope(clientKey).findings.set(analysisId, findings);
  }

  // --- External Feedback Drafts ---
  public getFeedbackDraft(clientKey: string, analysisId: string): ExternalFeedbackDraft | undefined {
    return this.getScope(clientKey).feedbackDrafts.get(analysisId);
  }

  public setFeedbackDraft(clientKey: string, analysisId: string, feedback: ExternalFeedbackDraft) {
    this.getScope(clientKey).feedbackDrafts.set(analysisId, feedback);
  }

  // --- Requirement Sets ---
  public getRequirementSets(clientKey: string, orgId?: string): RequirementSet[] {
    const scope = this.getScope(clientKey);
    const list = Array.from(scope.requirementSets.values());
    if (orgId) {
      return list.filter((r) => r.organizationId === orgId);
    }
    return list;
  }

  public getRequirementSet(clientKey: string, id: string): RequirementSet | undefined {
    const fromScope = this.getScope(clientKey).requirementSets.get(id);
    if (fromScope) return fromScope;
    if (id === PILOT_MDS_REQUIREMENT_SET.id) return PILOT_MDS_REQUIREMENT_SET;
    return undefined;
  }

  public setRequirementSet(clientKey: string, id: string, reqSet: RequirementSet) {
    this.getScope(clientKey).requirementSets.set(id, reqSet);
  }

  public deleteRequirementSet(clientKey: string, id: string) {
    this.getScope(clientKey).requirementSets.delete(id);
  }

  public clearAllRequirementSets(clientKey: string, orgId?: string) {
    const scope = this.getScope(clientKey);
    if (!orgId) {
      scope.requirementSets.clear();
    } else {
      for (const [id, r] of scope.requirementSets.entries()) {
        if (r.organizationId === orgId) {
          scope.requirementSets.delete(id);
        }
      }
    }
  }

  // --- Documents ---
  public getDocuments(clientKey: string, orgId?: string): DocumentRecord[] {
    const scope = this.getScope(clientKey);
    const list = Array.from(scope.documents.values());
    if (orgId) {
      return list.filter((d) => d.organizationId === orgId);
    }
    return list;
  }

  public getDocument(clientKey: string, id: string): DocumentRecord | undefined {
    return this.getScope(clientKey).documents.get(id);
  }

  public setDocument(clientKey: string, id: string, doc: DocumentRecord) {
    this.getScope(clientKey).documents.set(id, doc);
  }

  // --- Certificates ---
  public getCertificates(clientKey: string): CertificateRecord[] {
    return Array.from(this.getScope(clientKey).certificates.values());
  }

  public getCertificate(clientKey: string, id: string): CertificateRecord | undefined {
    const fromScope = this.getScope(clientKey).certificates.get(id);
    if (fromScope) return fromScope;
    if (id === PILOT_SUPPLIER_MTC.id) return PILOT_SUPPLIER_MTC;
    return undefined;
  }

  public setCertificate(clientKey: string, id: string, cert: CertificateRecord) {
    this.getScope(clientKey).certificates.set(id, cert);
  }

  // --- Audit Logs ---
  public getAuditLogs(clientKey: string, orgId?: string): AuditEvent[] {
    const scope = this.getScope(clientKey);
    if (orgId) {
      return scope.auditLogs.filter((a) => a.organizationId === orgId);
    }
    return scope.auditLogs;
  }

  public addAuditEvent(clientKey: string, event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const scope = this.getScope(clientKey);
    const newEvent: AuditEvent = {
      ...event,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    scope.auditLogs.unshift(newEvent);
    if (scope.auditLogs.length > 500) {
      scope.auditLogs.pop();
    }
    return newEvent;
  }

  /**
   * Loads standard reference specification templates on-demand for a client
   */
  public loadStandardTemplatesForClient(clientKey: string, userId: string = 'user-lead-qc'): RequirementSet[] {
    const scope = this.getScope(clientKey);
    const user = USERS.find((u) => u.id === userId) || USERS[0];

    // 1. Hawa Valves A105N MDS
    scope.requirementSets.set(PILOT_MDS_REQUIREMENT_SET.id, PILOT_MDS_REQUIREMENT_SET);

    // 2. Shell Global Solutions
    const shellReqSet: RequirementSet = {
      id: 'reqset-shell-a350lf2-rev-b',
      clientName: 'Shell Global Solutions',
      materialGrade: 'ASTM A350 LF2 Class 1',
      mdsNumber: 'DEP-31.40.20.37-Gen',
      revision: 'Rev B',
      title: 'Low Temperature Carbon Steel Forgings for Offshore Piping',
      effectiveDate: '2024-06-10',
      status: 'approved',
      approvedBy: user.id,
      approvedAt: new Date().toISOString(),
      organizationId: user.organizationId,
      requirements: [
        {
          id: 'shell-c-max',
          category: 'chemical',
          field: 'C',
          displayName: 'Carbon (C)',
          operator: 'MAX',
          maxValue: 0.20,
          unit: '%',
          mandatory: true,
          description: 'Max Carbon 0.20% for LTCS',
          clauseReference: 'DEP Section 4.2',
          sourceDocument: 'Shell DEP-31.40.20.37-Gen Rev B',
          sourcePage: 3,
        },
        {
          id: 'shell-impact',
          category: 'mechanical',
          field: 'charpyImpactEnergy',
          displayName: 'Charpy V-Notch Impact Energy at -46°C',
          operator: 'MIN',
          minValue: 27,
          unit: 'J',
          mandatory: true,
          description: 'Minimum average 27 Joules at -46°C',
          clauseReference: 'DEP Section 5.1',
          sourceDocument: 'Shell DEP-31.40.20.37-Gen Rev B',
          sourcePage: 4,
        },
        {
          id: 'shell-ce',
          category: 'chemical',
          field: 'CE',
          displayName: 'Carbon Equivalent (CE)',
          operator: 'AGGREGATE',
          maxValue: 0.40,
          unit: '',
          mandatory: true,
          description: 'CE max 0.40 for low temperature service',
          clauseReference: 'DEP Section 4.3',
          sourceDocument: 'Shell DEP-31.40.20.37-Gen Rev B',
          sourcePage: 3,
        },
      ],
    };
    scope.requirementSets.set(shellReqSet.id, shellReqSet);

    // 3. Saudi Aramco F316L
    const aramcoReqSet: RequirementSet = {
      id: 'reqset-aramco-f316l-rev-c',
      clientName: 'Saudi Aramco',
      materialGrade: 'ASTM A182 F316L',
      mdsNumber: '01-SAMSS-010',
      revision: 'Rev C',
      title: 'Austenitic Stainless Steel Forgings for Wet Sour Service',
      effectiveDate: '2024-11-20',
      status: 'approved',
      approvedBy: user.id,
      approvedAt: new Date().toISOString(),
      organizationId: user.organizationId,
      requirements: [
        {
          id: 'aramco-c',
          category: 'chemical',
          field: 'C',
          displayName: 'Carbon (C)',
          operator: 'MAX',
          maxValue: 0.030,
          unit: '%',
          mandatory: true,
          description: 'Extra low carbon max 0.030%',
          sourceDocument: '01-SAMSS-010 Rev C',
          sourcePage: 2,
        },
        {
          id: 'aramco-cr',
          category: 'chemical',
          field: 'Cr',
          displayName: 'Chromium (Cr)',
          operator: 'RANGE',
          minValue: 16.0,
          maxValue: 18.0,
          unit: '%',
          mandatory: true,
          description: 'Chromium 16.0 - 18.0%',
          sourceDocument: '01-SAMSS-010 Rev C',
          sourcePage: 2,
        },
        {
          id: 'aramco-ferrite',
          category: 'mechanical',
          field: 'ferriteNumber',
          displayName: 'Ferrite Content (FN)',
          operator: 'RANGE',
          minValue: 3,
          maxValue: 8,
          unit: 'FN',
          mandatory: true,
          description: 'Ferrite number 3 to 8 FN',
          sourceDocument: '01-SAMSS-010 Rev C',
          sourcePage: 4,
        },
      ],
    };
    scope.requirementSets.set(aramcoReqSet.id, aramcoReqSet);

    this.addAuditEvent(clientKey, {
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'CREATE_REQUIREMENT_SET',
      objectType: 'requirement_set',
      objectId: 'templates',
      objectName: 'Loaded Standard MDS Specification Templates',
      details: { count: 3 },
    });

    return Array.from(scope.requirementSets.values());
  }

  /**
   * Generates the Benchmark Pilot Case (Western Forge MTC vs Hawa Valves MDS)
   * specifically on-demand for a client session.
   */
  public loadPilotCaseForClient(clientKey: string, userId: string = 'user-lead-qc'): {
    analysis: AnalysisRecord;
    findings: ComplianceFinding[];
    feedbackDraft: ExternalFeedbackDraft;
  } {
    const scope = this.getScope(clientKey);
    const user = USERS.find((u) => u.id === userId) || USERS[0];
    const orgId = user.organizationId;

    // 1. Requirement Set
    scope.requirementSets.set(PILOT_MDS_REQUIREMENT_SET.id, PILOT_MDS_REQUIREMENT_SET);

    // 2. Documents
    const mdsDoc: DocumentRecord = {
      id: `doc-mds-${Date.now()}`,
      type: 'mds',
      filename: 'Hawa_Valves_MDS_QE-F-CS-ASTM-A105-NACE-001_RevA.pdf',
      filesize: 1420500,
      checksum: 'e89a74b88939c4d98ef732a9381e43b672a912c98a3194',
      pageCount: 5,
      uploadedBy: user.id,
      uploadedByName: user.name,
      uploadedAt: new Date().toISOString(),
      organizationId: orgId,
      mimeType: 'application/pdf',
      contentSummary: 'Material Data Sheet for ASTM A105N Carbon Steel Forgings for Sour Service',
    };
    scope.documents.set(mdsDoc.id, mdsDoc);

    const mtcDoc: DocumentRecord = {
      id: `doc-mtc-${Date.now()}`,
      type: 'mtc',
      filename: 'Western_Forge_MTC_WW2606229-3.pdf',
      filesize: 894320,
      checksum: 'b45d2994a34b219087c93814de658a12903fb9873a21',
      pageCount: 2,
      uploadedBy: user.id,
      uploadedByName: user.name,
      uploadedAt: new Date().toISOString(),
      organizationId: orgId,
      mimeType: 'application/pdf',
      contentSummary: 'Inspection Certificate 3.1 for ASTM A105N Flanges, Heats A228 & YBA',
    };
    scope.documents.set(mtcDoc.id, mtcDoc);

    // 3. Certificates
    scope.certificates.set(PILOT_SUPPLIER_MTC.id, PILOT_SUPPLIER_MTC);

    // 4. Pilot Analysis
    const pilotAnalysisId = `analysis-pilot-${Date.now()}`;
    const pilotFindings = evaluateCompliance({
      analysisId: pilotAnalysisId,
      requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
      certificate: PILOT_SUPPLIER_MTC,
    });

    const passCount = pilotFindings.filter((f) => f.status === 'PASS').length;
    const devCount = pilotFindings.filter((f) => f.status === 'DEVIATION').length;
    const gapCount = pilotFindings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;

    const pilotAnalysis: AnalysisRecord = {
      id: pilotAnalysisId,
      organizationId: orgId,
      title: 'Benchmark Review: Western Forge MTC WW2606229-3 vs Hawa MDS Rev A',
      mtcDocumentId: mtcDoc.id,
      mtcFilename: mtcDoc.filename,
      mdsDocumentId: mdsDoc.id,
      mdsFilename: mdsDoc.filename,
      requirementSetId: PILOT_MDS_REQUIREMENT_SET.id,
      requirementSetTitle: PILOT_MDS_REQUIREMENT_SET.title,
      materialGrade: 'ASTM A105N',
      supplierName: 'Western Forge & Flange Co.',
      clientName: 'Hawa Valves',
      poNumber: 'PO-774920',
      mtcNumber: 'WW2606229-3',
      heats: ['A228', 'YBA'],
      status: 'ready_for_review',
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: `${user.name} (${user.role.toUpperCase()})`,
      passCount,
      deviationCount: devCount,
      documentationGapCount: gapCount,
      reviewRequiredCount: 0,
      totalFindings: pilotFindings.length,
      reviewedCount: 0,
      ruleEngineVersion: 'MTC-CoreEngine v2.4.0',
      aiModelUsed: 'gemini-3.7-flash',
    };

    scope.analyses.set(pilotAnalysisId, pilotAnalysis);
    scope.findings.set(pilotAnalysisId, pilotFindings);

    // 5. Initial Feedback Draft
    const pilotFeedback: ExternalFeedbackDraft = {
      id: `feedback-${pilotAnalysisId}`,
      analysisId: pilotAnalysisId,
      title: 'Material Certificate Review & Technical Clarification Request',
      overallStatus: 'DEVIATIONS DETECTED',
      salutation: 'Dear Western Forge & Flange Co. Quality Directorate,',
      openingStatement:
        'The submitted Material Test Certificate (Ref: WW2606229-3) for PO #PO-774920 has been reviewed against Client Material Data Sheet QE-F-CS-ASTM-A105-NACE-001 Rev A (ASTM A105N).',
      conformingSummary:
        'The chemical composition, Carbon Equivalent (CE <= 0.43), tensile strength, yield strength, reduction of area, hardness (<= 187 HBW for sour service), forging reduction ratio (4.2:1), and absence of weld repair are conforming for Heat A228 and verified properties.',
      clarificationPoints: [
        {
          id: 'pilot-cl-1',
          itemNumber: 1,
          findingId: 'f-pilot-ht-temp-yba',
          title: 'Normalizing Temperature Below Specified Lower Limit (Heat YBA)',
          description:
            'Heat YBA records normalizing temperature at 890°C, which is below the mandatory client requirement of 900°C - 960°C.',
          actionRequired:
            'Please submit technical re-heat treatment authorization, or provide mechanical microstructural test records confirming complete austenitization at 890°C.',
        },
        {
          id: 'pilot-cl-2',
          itemNumber: 2,
          findingId: 'f-pilot-elong-yba',
          title: 'Elongation Below Specification Limit (Heat YBA)',
          description:
            'Reported elongation is 29% in 2 inches, whereas the client MDS specifies a minimum of 30% for sour service forging integrity.',
          actionRequired:
            'Please perform tensile re-test from the prolongation or forged coupon in accordance with ASTM A105 Section 8.2 and provide test report.',
        },
        {
          id: 'pilot-cl-3',
          itemNumber: 3,
          findingId: 'f-pilot-ut',
          title: 'Supplementary Ultrasonic Examination (UT) Certificate Missing',
          description:
            'Client specification MDS Clause 6.1 mandates 100% volumetric Ultrasonic Testing for Class 300+ forging components. No UT report was identified.',
          actionRequired:
            'Please provide formal Level II certified UT test certificate in accordance with ASME Section V Article 4 / ASTM A388.',
        },
        {
          id: 'pilot-cl-4',
          itemNumber: 4,
          findingId: 'f-pilot-mpt',
          title: 'Supplementary Magnetic Particle Examination (MPT) Certificate Missing',
          description:
            'Client specification MDS Clause 6.2 mandates 100% surface Magnetic Particle Examination. No MPT certificate was attached.',
          actionRequired:
            'Please provide formal Level II certified MT test certificate in accordance with ASME Section V Article 7 / ASTM A275.',
        },
      ],
      closingStatement:
        'Please furnish formal written clarification, concession requests, or revised inspection documents within 5 working days to avoid material dispatch hold.',
      status: 'draft',
    };
    scope.feedbackDrafts.set(pilotAnalysisId, pilotFeedback);

    // 6. Audit Log
    this.addAuditEvent(clientKey, {
      organizationId: orgId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'RUN_ANALYSIS',
      objectType: 'analysis',
      objectId: pilotAnalysisId,
      objectName: pilotAnalysis.title,
      details: {
        passCount,
        deviationCount: devCount,
        documentationGapCount: gapCount,
        total: pilotFindings.length,
      },
    });

    return {
      analysis: pilotAnalysis,
      findings: pilotFindings,
      feedbackDraft: pilotFeedback,
    };
  }
}

export const db = new DatabaseStore();

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
    id: 'user-zarique-shaikh',
    name: 'Zarique Shaikh',
    email: 'zarique.shaikh@apexvalves.com',
    role: 'qc_reviewer',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-marcus-vance',
    name: 'Marcus Vance, PE',
    email: 'marcus.vance@apexvalves.com',
    role: 'engineer',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-sarah-chen',
    name: 'Sarah Chen',
    email: 'sarah.chen@apexvalves.com',
    role: 'auditor',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-admin-system',
    name: 'Arthur Pendelton (Admin)',
    email: 'admin@apexvalves.com',
    role: 'admin',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-viewer-guest',
    name: 'David Miller (Client Observer)',
    email: 'david.miller@clientaudit.com',
    role: 'viewer',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  },
];

// In-Memory Database Store
class DatabaseStore {
  public documents: Map<string, DocumentRecord> = new Map();
  public requirementSets: Map<string, RequirementSet> = new Map();
  public certificates: Map<string, CertificateRecord> = new Map();
  public analyses: Map<string, AnalysisRecord> = new Map();
  public findings: Map<string, ComplianceFinding[]> = new Map();
  public feedbackDrafts: Map<string, ExternalFeedbackDraft> = new Map();
  public auditLogs: AuditEvent[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // If SEED_DEMO_DATA is explicitly set to 'false', start with a completely clean database (0 specs, 0 documents, 0 analyses)
    if (process.env.SEED_DEMO_DATA === 'false') {
      console.log('[DB] SEED_DEMO_DATA=false: Starting clean (0 requirement sets, 0 documents, 0 analyses).');
      return;
    }

    // 1. Requirement Sets
    this.requirementSets.set(PILOT_MDS_REQUIREMENT_SET.id, PILOT_MDS_REQUIREMENT_SET);

    // Additional requirement library items
    const shellReqSet: RequirementSet = {
      id: 'reqset-shell-a350lf2-rev-b',
      clientName: 'Shell Global Solutions',
      materialGrade: 'ASTM A350 LF2 Class 1',
      mdsNumber: 'DEP-31.40.20.37-Gen',
      revision: 'Rev B',
      title: 'Low Temperature Carbon Steel Forgings for Offshore Piping',
      effectiveDate: '2024-06-10',
      status: 'approved',
      approvedBy: 'user-marcus-vance',
      approvedAt: '2024-06-10T11:00:00Z',
      organizationId: 'org-apex-01',
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
    this.requirementSets.set(shellReqSet.id, shellReqSet);

    const aramcoReqSet: RequirementSet = {
      id: 'reqset-aramco-f316l-rev-c',
      clientName: 'Saudi Aramco',
      materialGrade: 'ASTM A182 F316L',
      mdsNumber: '01-SAMSS-010',
      revision: 'Rev C',
      title: 'Austenitic Stainless Steel Forgings for Wet Sour Service',
      effectiveDate: '2024-11-20',
      status: 'approved',
      approvedBy: 'user-marcus-vance',
      approvedAt: '2024-11-20T08:30:00Z',
      organizationId: 'org-apex-01',
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
    this.requirementSets.set(aramcoReqSet.id, aramcoReqSet);

    // 2. Documents
    const mdsDoc: DocumentRecord = {
      id: 'doc-mds-hawa-a105n',
      type: 'mds',
      filename: 'Hawa_Valves_MDS_QE-F-CS-ASTM-A105-NACE-001_RevA.pdf',
      filesize: 1420500,
      checksum: 'e89a74b88939c4d98ef732a9381e43b672a912c98a3194',
      pageCount: 5,
      uploadedBy: 'user-elena-rostova',
      uploadedByName: 'Elena Rostova',
      uploadedAt: '2025-02-10T10:00:00Z',
      organizationId: 'org-apex-01',
      mimeType: 'application/pdf',
      contentSummary: 'Material Data Sheet for ASTM A105N Carbon Steel Forgings for Sour Service',
    };
    this.documents.set(mdsDoc.id, mdsDoc);

    const mtcDoc: DocumentRecord = {
      id: 'doc-mtc-ww2606229-3',
      type: 'mtc',
      filename: 'Western_Forge_MTC_WW2606229-3.pdf',
      filesize: 894320,
      checksum: 'b45d2994a34b219087c93814de658a12903fb9873a21',
      pageCount: 2,
      uploadedBy: 'user-elena-rostova',
      uploadedByName: 'Elena Rostova',
      uploadedAt: '2025-02-10T10:05:00Z',
      organizationId: 'org-apex-01',
      mimeType: 'application/pdf',
      contentSummary: 'Inspection Certificate 3.1 for ASTM A105N Flanges, Heats A228 & YBA',
    };
    this.documents.set(mtcDoc.id, mtcDoc);

    // 3. Certificates
    this.certificates.set(PILOT_SUPPLIER_MTC.id, PILOT_SUPPLIER_MTC);

    // 4. Initial Pilot Analysis
    const pilotAnalysisId = 'analysis-pilot-ww2606229-3';
    const pilotFindings = evaluateCompliance({
      analysisId: pilotAnalysisId,
      requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
      certificate: PILOT_SUPPLIER_MTC,
    });

    const passCount = pilotFindings.filter((f) => f.status === 'PASS').length;
    const devCount = pilotFindings.filter((f) => f.status === 'DEVIATION').length;
    const gapCount = pilotFindings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
    const reqCount = pilotFindings.filter((f) => f.status === 'REVIEW_REQUIRED').length;

    const pilotAnalysis: AnalysisRecord = {
      id: pilotAnalysisId,
      organizationId: 'org-apex-01',
      title: 'Compliance Review: Western Forge MTC WW2606229-3 vs Hawa MDS Rev A',
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
      createdAt: '2025-02-10T10:10:00Z',
      createdBy: 'user-elena-rostova',
      createdByName: 'Elena Rostova (Lead QC Reviewer)',
      passCount,
      deviationCount: devCount,
      documentationGapCount: gapCount,
      reviewRequiredCount: reqCount,
      totalFindings: pilotFindings.length,
      reviewedCount: 0,
      ruleEngineVersion: 'MTC-CoreEngine v2.4.0',
      aiModelUsed: 'gemini-3.7-flash',
    };

    this.analyses.set(pilotAnalysisId, pilotAnalysis);
    this.findings.set(pilotAnalysisId, pilotFindings);

    // 5. Initial Feedback Draft for Pilot
    const pilotFeedback: ExternalFeedbackDraft = {
      id: `feedback-${pilotAnalysisId}`,
      analysisId: pilotAnalysisId,
      title: 'Material Certificate Review & Technical Clarification Request',
      overallStatus: 'REVIEW REQUIRED',
      salutation: 'Dear Western Forge & Flange Co. Quality Directorate,',
      openingStatement:
        'The submitted Material Test Certificate (Ref: WW2606229-3) for PO #PO-774920 has been reviewed against Client Material Data Sheet QE-F-CS-ASTM-A105-NACE-001 Rev A (ASTM A105N).',
      conformingSummary:
        'The chemical composition, Carbon Equivalent (CE <= 0.43), tensile strength, yield strength, reduction of area, hardness (<= 187 HBW for sour service), forging reduction ratio (4.2:1), and absence of weld repair are conforming for Heat A228 and verified properties.',
      clarificationPoints: [
        {
          id: 'point-1',
          itemNumber: 1,
          findingId: 'finding-req-ht-temp-YBA',
          title: 'Normalizing Heat Treatment Temperature Deviation (Heat YBA)',
          description:
            'Heat YBA lists a normalizing heat treatment temperature of 890°C, whereas client MDS Clause 4.2 strictly specifies a minimum normalizing range of 900–960°C.',
          actionRequired:
            'Please verify if re-normalizing within 900–960°C was conducted or provide technical concession justification.',
        },
        {
          id: 'point-2',
          itemNumber: 2,
          findingId: 'finding-req-mech-elongation-YBA',
          title: 'Tensile Ductility / Elongation Below Minimum (Heat YBA)',
          description:
            'Elongation for Heat YBA is reported as 29%, which is below the enhanced client ductility requirement of 30% specified in Clause 5.1.',
          actionRequired:
            'Please conduct re-testing per ASTM A105 Section 8 or clarify material disposition for items forged from Heat YBA.',
        },
        {
          id: 'point-3',
          itemNumber: 3,
          findingId: 'finding-req-nde-ut',
          title: 'Missing NDE Examination Evidence (100% UT & 100% MPT)',
          description:
            'The client MDS specifies mandatory 100% Ultrasonic Testing (UT per ASTM A388) and 100% Magnetic Particle Testing (MPT per ASTM A275). Explicit test reports were not attached to the MTC.',
          actionRequired:
            'Please submit the formal supplementary NDE examination test certificates for the subject order.',
        },
      ],
      closingStatement:
        'Please provide written clarification and supporting documentation for the above points to enable final material acceptance.',
      status: 'draft',
    };
    this.feedbackDrafts.set(pilotAnalysisId, pilotFeedback);

    // 6. Audit Trail Seed
    this.addAuditEvent({
      organizationId: 'org-apex-01',
      actorId: 'user-zarique-shaikh',
      actorName: 'Zarique Shaikh',
      actorRole: 'qc_reviewer',
      action: 'INGEST_DOCUMENT',
      objectType: 'document',
      objectId: mtcDoc.id,
      objectName: mtcDoc.filename,
      details: { checksum: mtcDoc.checksum, pages: mtcDoc.pageCount },
    });
    this.addAuditEvent({
      organizationId: 'org-apex-01',
      actorId: 'user-zarique-shaikh',
      actorName: 'Zarique Shaikh',
      actorRole: 'qc_reviewer',
      action: 'START_ANALYSIS',
      objectType: 'analysis',
      objectId: pilotAnalysisId,
      objectName: pilotAnalysis.title,
      details: {
        heats: ['A228', 'YBA'],
        mds: PILOT_MDS_REQUIREMENT_SET.mdsNumber,
        findingsCount: pilotFindings.length,
      },
    });
  }

  public addAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const fullEvent: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.auditLogs.unshift(fullEvent);
    return fullEvent;
  }

  public deleteAnalysis(id: string): boolean {
    const deleted = this.analyses.delete(id);
    this.findings.delete(id);
    this.feedbackDrafts.delete(id);
    return deleted;
  }

  public clearAllAnalyses(orgId?: string) {
    for (const [id, a] of Array.from(this.analyses.entries())) {
      if (!orgId || a.organizationId === orgId) {
        this.analyses.delete(id);
        this.findings.delete(id);
        this.feedbackDrafts.delete(id);
      }
    }
  }

  public deleteRequirementSet(id: string): boolean {
    return this.requirementSets.delete(id);
  }

  public clearAllRequirementSets(orgId?: string) {
    for (const [id, r] of Array.from(this.requirementSets.entries())) {
      if (!orgId || r.organizationId === orgId) {
        this.requirementSets.delete(id);
      }
    }
  }
}

export const db = new DatabaseStore();



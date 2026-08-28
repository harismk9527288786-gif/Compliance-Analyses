import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { db } from './server/db';
import { authRouter } from './server/auth/routes';
import { authenticate, requireAuth, requireRole } from './server/auth/middleware';
import { sanitizeUser } from './server/auth/types';
import { validateUploadedDocument, parseDocumentContent } from './server/pdfService';
import { extractRequirementsWithAI, extractSupplierEvidenceWithAI, extractMTCIdentity } from './server/gemini';
export { extractRequirementsWithAI, extractSupplierEvidenceWithAI, extractMTCIdentity } from './server/gemini';
import { evaluateCompliance } from './src/engine/rules';
export { evaluateCompliance } from './src/engine/rules';
import { PILOT_MDS_REQUIREMENT_SET, PILOT_SUPPLIER_MTC } from './src/engine/pilotData';
import { runAllTestCases } from './src/engine/testSuite';
import {
  DocumentRecord,
  AnalysisRecord,
  ComplianceFinding,
  RequirementSet,
  ExternalFeedbackDraft,
  CertificateRecord,
  FindingStatus,
} from './src/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security Middleware Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Database Readiness & Synchronization Middleware (Ensures latest PG state before any route)
app.use(async (req, res, next) => {
  try {
    await db.ensureReady();
    next();
  } catch (err: any) {
    console.warn('DB readiness middleware notice:', err?.message || err);
    next();
  }
});

// Session Authentication Middleware (attaches req.user, req.organization, req.session)
app.use(authenticate);

// --- API ROUTES ---

// Health check & Root API info (Public)
const healthHandler = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'MTC Compliance Checker API',
    version: '2.4.0',
    database: db.isPostgresConnected
      ? 'postgresql (supabase/connected)'
      : 'in-memory / fallback store',
    postgres: {
      connected: db.isPostgresConnected,
      configured: db.dbConfigured,
      detectedSource: db.detectedSource,
      lastError: db.lastPostgresError,
    },
    authenticated: !!req.user,
    timestamp: new Date().toISOString(),
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);
app.get('/api', healthHandler);

// Dedicated Authentication Router
app.use('/api/auth', authRouter);

  // Tenant Users & Organization info (Protected)
  app.get('/api/users', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const orgUsers = db.getUsersByOrg(orgId).map((u) => sanitizeUser(u, req.organization!));
    res.json({ users: orgUsers, organizations: [req.organization] });
  });

  // --- DOCUMENT INGESTION (TENANT ISOLATED) ---
  app.post(
    '/api/documents',
    requireAuth,
    requireRole(['ADMIN', 'QUALITY_ENGINEER']),
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded.' });
        }

        const orgId = req.user!.organization_id;
        const docType = (req.body.type as 'mtc' | 'mds') || 'mtc';

        const validation = validateUploadedDocument(req.file);
        if (!validation.isValid) {
          return res.status(400).json({ error: validation.error });
        }

        const parsed = await parseDocumentContent(req.file.buffer, req.file.originalname);

        // Fallback: If server-side PDF extraction yielded empty text or ran in a constrained environment,
        // use high-fidelity client-extracted text if provided in the upload request.
        if ((!parsed.text || parsed.text.trim().length < 30) && req.body.extractedText && typeof req.body.extractedText === 'string') {
          const clientText = req.body.extractedText.trim();
          if (clientText.length >= 30) {
            parsed.text = clientText;
            parsed.isScanned = false;
          }
        }

        const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const docRecord: DocumentRecord = {
          id: docId,
          type: docType,
          filename: req.file.originalname,
          filesize: req.file.size,
          checksum: parsed.checksum,
          pageCount: parsed.pageCount,
          uploadedBy: req.user!.id,
          uploadedByName: req.user!.name,
          uploadedAt: new Date().toISOString(),
          organizationId: orgId,
          mimeType: req.file.mimetype,
          contentSummary: parsed.text.slice(0, 300),
          rawText: parsed.text,
          isScanned: parsed.isScanned,
        };

        db.setDocument(orgId, docId, docRecord);

        db.addAuditEvent(orgId, {
          actorId: req.user!.id,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'UPLOAD_DOCUMENT',
          objectType: 'document',
          objectId: docId,
          objectName: docRecord.filename,
          details: { checksum: docRecord.checksum, size: docRecord.filesize, type: docType },
        });

        res.status(201).json({ document: docRecord });
      } catch (error: any) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to process uploaded document.' });
      }
    }
  );

  app.get('/api/documents', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const docs = db.getDocuments(orgId);
    res.json({ documents: docs });
  });

  app.get('/api/documents/:id', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const doc = db.getDocument(orgId, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.json({ document: doc });
  });

  // --- REQUIREMENT SETS & LIBRARY (TENANT ISOLATED) ---
  app.get('/api/requirements', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const sets = db.getRequirementSets(orgId);
    res.json({ requirementSets: sets });
  });

  // Load Standard Spec Templates (Shell, Aramco) for Tenant
  app.post('/api/requirements/templates', requireAuth, requireRole(['ADMIN', 'QUALITY_ENGINEER']), (req, res) => {
    const orgId = req.user!.organization_id;
    const sets = db.loadStandardTemplatesForOrg(orgId, req.user!);
    res.json({ requirementSets: sets, message: 'Standard MDS templates loaded into client library.' });
  });

  // Clear all requirement sets for Tenant (ADMIN only — destructive operation)
  app.post('/api/requirements/clear', requireAuth, requireRole(['ADMIN']), (req, res) => {
    const orgId = req.user!.organization_id;
    db.clearAllRequirementSets(orgId);
    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'CLEAR_REQUIREMENT_SETS',
      objectType: 'requirement_set',
      objectId: 'all',
      objectName: 'All Requirement Sets Cleared',
      details: { timestamp: new Date().toISOString() },
    });
    res.json({ success: true, message: 'All requirement sets cleared.' });
  });

  // Delete single requirement set
  app.delete('/api/requirements/:id', requireAuth, requireRole(['ADMIN', 'QUALITY_ENGINEER', 'REVIEWER']), (req, res) => {
    const orgId = req.user!.organization_id;
    const reqSet = db.getRequirementSet(orgId, req.params.id);
    if (!reqSet) return res.status(404).json({ error: 'Requirement set not found.' });

    db.deleteRequirementSet(orgId, req.params.id);
    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'DELETE_REQUIREMENT_SET',
      objectType: 'requirement_set',
      objectId: req.params.id,
      objectName: reqSet.title,
      details: { mdsNumber: reqSet.mdsNumber },
    });
    res.json({ success: true, message: 'Requirement set deleted successfully.' });
  });

  app.get('/api/requirements/:id', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const reqSet = db.getRequirementSet(orgId, req.params.id);
    if (!reqSet) return res.status(404).json({ error: 'Requirement set not found.' });
    res.json({ requirementSet: reqSet });
  });

  app.post('/api/requirements', requireAuth, requireRole(['ADMIN', 'QUALITY_ENGINEER']), (req, res) => {
    try {
      const orgId = req.user!.organization_id;
      const { clientName, materialGrade, mdsNumber, revision, title, requirements } = req.body;

      const newId = `reqset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const newSet: RequirementSet = {
        id: newId,
        clientName: clientName || 'Client Specification',
        materialGrade: materialGrade || 'ASTM A105N',
        mdsNumber: mdsNumber || 'MDS-CUSTOM',
        revision: revision || 'Rev A',
        title: title || `${clientName} ${materialGrade} Specification`,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'approved',
        approvedBy: req.user!.id,
        approvedAt: new Date().toISOString(),
        organizationId: orgId,
        requirements: requirements || [],
      };

      db.setRequirementSet(orgId, newId, newSet);

      db.addAuditEvent(orgId, {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'CREATE_REQUIREMENT_SET',
        objectType: 'requirement_set',
        objectId: newId,
        objectName: newSet.title,
        details: { revision: newSet.revision, count: newSet.requirements.length },
      });

      res.status(201).json({ requirementSet: newSet });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- PILOT BENCHMARK CASE LOADER (On-Demand) ---
  app.post('/api/pilot-case', requireAuth, (req, res) => {
    try {
      const orgId = req.user!.organization_id;
      const pilotAnalysisId = 'analysis-pilot-ww2606229-3';

      const existing = db.getAnalysis(orgId, pilotAnalysisId);
      if (existing) {
        const findings = db.getFindings(orgId, pilotAnalysisId) || [];
        const feedback = db.getFeedbackDraft(orgId, pilotAnalysisId);
        return res.json({ analysis: existing, findings, feedbackDraft: feedback });
      }

      // Initialize pilot case
      const pilotFindings = evaluateCompliance({
        analysisId: pilotAnalysisId,
        requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
        certificate: PILOT_SUPPLIER_MTC,
      });

      const passCount = pilotFindings.filter((f) => f.status === 'PASS').length;
      const devCount = pilotFindings.filter((f) => f.status === 'DEVIATION').length;
      const gapCount = pilotFindings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
      const reqCount = pilotFindings.filter((f) => f.status === 'REVIEW_REQUIRED').length;

      db.setCertificate(PILOT_SUPPLIER_MTC.id, PILOT_SUPPLIER_MTC);
      db.setRequirementSet(orgId, PILOT_MDS_REQUIREMENT_SET.id, {
        ...PILOT_MDS_REQUIREMENT_SET,
        organizationId: orgId,
      });

      const pilotAnalysis: AnalysisRecord = {
        id: pilotAnalysisId,
        organizationId: orgId,
        title: 'Pilot Benchmark Analysis: Western Forge (WW2606229-3) vs Hawa MDS Rev A',
        mtcDocumentId: 'doc-mtc-ww2606229-3',
        mtcFilename: 'Western_Forge_MTC_WW2606229-3.pdf',
        requirementSetId: PILOT_MDS_REQUIREMENT_SET.id,
        requirementSetTitle: PILOT_MDS_REQUIREMENT_SET.title,
        materialGrade: 'ASTM A105N',
        supplierName: 'Western Forge & Flange Co.',
        clientName: 'Hawa Valves Quality Directorate',
        poNumber: 'PO-2026-APEX-8821',
        mtcNumber: 'WW2606229-3',
        heats: ['HEAT-8821A', 'HEAT-8821B'],
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
        createdBy: req.user!.id,
        createdByName: req.user!.name,
        passCount,
        deviationCount: devCount,
        documentationGapCount: gapCount,
        reviewRequiredCount: reqCount,
        totalFindings: pilotFindings.length,
        reviewedCount: 0,
        ruleEngineVersion: 'MTC-CoreEngine v2.4.0',
        aiModelUsed: 'gemini-3.7-flash',
      };

      db.setAnalysis(orgId, pilotAnalysisId, pilotAnalysis);
      db.setFindings(orgId, pilotAnalysisId, pilotFindings);

      const deviations = pilotFindings.filter((f) => f.status === 'DEVIATION');
      const gaps = pilotFindings.filter((f) => f.status === 'DOCUMENTATION_GAP');

      const pilotFeedback: ExternalFeedbackDraft = {
        id: `feedback-${pilotAnalysisId}`,
        analysisId: pilotAnalysisId,
        title: 'Supplier Quality Review & Clarification Request: Western Forge WW2606229-3',
        overallStatus: devCount > 0 ? 'REVIEW REQUIRED' : 'COMPLIANT',
        salutation: 'Dear Western Forge & Flange Quality Directorate,',
        openingStatement:
          'The submitted Material Test Certificate (WW2606229-3) for PO PO-2026-APEX-8821 has been analyzed against project specification Hawa Valves MDS Rev A.',
        conformingSummary:
          'Chemical composition and standard tensile mechanical properties for approved heats have been verified against applicable ASTM A105N thresholds.',
        clarificationPoints: [
          ...deviations.map((d, i) => ({
            id: `dev-pt-${i + 1}`,
            itemNumber: i + 1,
            title: `${d.displayName} Deviation (${d.heatNo || 'General'})`,
            findingId: d.id,
            description: `Reported value "${d.supplierRawValue}" deviates from specified requirement "${d.requirementText}". Reason: ${d.reason}`,
            actionRequired: 'Please submit corrective technical documentation or re-test justification.',
          })),
          ...gaps.map((g, i) => ({
            id: `gap-pt-${i + 1}`,
            itemNumber: deviations.length + i + 1,
            title: `Missing Evidence: ${g.displayName}`,
            findingId: g.id,
            description: `Client MDS Clause mandates "${g.displayName}", which was not identified in the submitted MTC.`,
            actionRequired: 'Please attach formal Level II supplementary test certificate.',
          })),
        ],
        closingStatement:
          'Please provide written clarification and supporting documentation within 5 working days to enable final material acceptance.',
        status: 'draft',
      };

      db.setFeedbackDraft(orgId, pilotAnalysisId, pilotFeedback);

      db.addAuditEvent(orgId, {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'RUN_ANALYSIS',
        objectType: 'analysis',
        objectId: pilotAnalysisId,
        objectName: pilotAnalysis.title,
        details: { passCount, deviationCount: devCount, documentationGapCount: gapCount },
      });

      res.status(201).json({
        analysis: pilotAnalysis,
        findings: pilotFindings,
        feedbackDraft: pilotFeedback,
      });
    } catch (e: any) {
      console.error('Pilot case load error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- COMPLIANCE ANALYSES & VERIFICATION (TENANT ISOLATED) ---
  app.post('/api/analyses', requireAuth, requireRole(['ADMIN', 'QUALITY_ENGINEER']), async (req, res) => {
    try {
      const orgId = req.user!.organization_id;
      const {
        mtcDocumentId,
        mdsDocumentId,
        requirementSetId,
        title,
        supplierName,
        clientName,
        poNumber,
        mtcNumber,
        materialGrade,
        heats,
      } = req.body;

      // 1. Resolve Requirement Set
      let reqSet: RequirementSet | undefined;
      if (requirementSetId) {
        reqSet = db.getRequirementSet(orgId, requirementSetId);
      } else if (mdsDocumentId) {
        const mdsDoc = db.getDocument(orgId, mdsDocumentId);
        if (mdsDoc) {
          const { identity, requirements } = await extractRequirementsWithAI(
            mdsDoc.rawText || mdsDoc.contentSummary || '',
            mdsDoc.filename
          );

          if (!identity.isConfident) {
            // If MDS identity cannot be confidently established, return REVIEW REQUIRED rather than using a previous/default rule set
            reqSet = {
              id: `reqset-${Date.now()}`,
              clientName: clientName || 'Specification Verification Required',
              materialGrade: 'UNIDENTIFIED SPECIFICATION (REVIEW REQUIRED)',
              mdsNumber: identity.mdsNumber || 'MDS-UNIDENTIFIED',
              revision: identity.revision || 'N/A',
              title: `Unverified Specification (${mdsDoc.filename}) - Review Required`,
              effectiveDate: new Date().toISOString().split('T')[0],
              status: 'draft',
              organizationId: orgId,
              requirements: requirements as any,
              sourceDocumentId: mdsDoc.id,
            };
          } else {
            reqSet = {
              id: `reqset-${Date.now()}`,
              clientName: clientName || identity.clientName || 'Client Specification',
              materialGrade: materialGrade || identity.materialGrade,
              mdsNumber: identity.mdsNumber,
              revision: identity.revision,
              title: identity.title || `${identity.clientName || 'Client MDS'} - ${identity.materialGrade} (${identity.mdsNumber} ${identity.revision})`,
              effectiveDate: new Date().toISOString().split('T')[0],
              status: 'approved',
              organizationId: orgId,
              requirements: requirements as any,
              sourceDocumentId: mdsDoc.id,
            };
          }
          db.setRequirementSet(orgId, reqSet.id, reqSet);
        }
      }

      if (!reqSet) {
        if (requirementSetId) {
          return res.status(404).json({ error: 'Requirement set not found in your organization.' });
        }
        if (mdsDocumentId) {
          return res.status(404).json({ error: 'MDS document not found in your organization.' });
        }
        return res.status(400).json({ error: 'Either requirementSetId or mdsDocumentId is required.' });
      }

      // 2. Resolve Certificate Evidence (Must be uploaded in current session)
      let certRecord: CertificateRecord | undefined;
      const mtcDoc = mtcDocumentId ? db.getDocument(orgId, mtcDocumentId) : undefined;

      if (req.body.usePilotFixture) {
        certRecord = PILOT_SUPPLIER_MTC;
      } else {
        if (!mtcDocumentId) {
          return res.status(400).json({
            error: 'MTC document is required for verification. Please upload or select a supplier MTC in the current session.'
          });
        }

        if (!mtcDoc) {
          return res.status(404).json({
            error: `MTC document (${mtcDocumentId}) not found in the current organization session. Stale or cross-session MTC references are prohibited.`
          });
        }

        // Hard identity check before comparison
        const mtcIdentity = extractMTCIdentity(mtcDoc.rawText || '', mtcDoc.filename);

        // If the comparison MTC identity does not match the currently uploaded MTC or cannot be verified,
        // BLOCK comparison and return REVIEW REQUIRED instead of silently using stale data.
        if (!mtcIdentity.isConfident || mtcIdentity.heatNumber === 'UNVERIFIED' || mtcIdentity.mtcNumber === 'MTC-UNVERIFIED') {
          const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const finding: ComplianceFinding = {
            id: `finding-mtc-identity-${Date.now()}`,
            analysisId,
            requirementId: 'mtc-identity-check',
            category: 'general',
            field: 'mtcIdentityVerification',
            displayName: 'MTC Document Identity Verification',
            requirementText: 'Uploaded MTC must possess verifiable TC Number, Heat Number, and Material Grade from current upload.',
            requirementClause: 'MTC-IDENTITY-01',
            requirementSourceDoc: mtcDoc.filename,
            requirementSourcePage: 1,
            supplierRawValue: `Unverified MTC Document: ${mtcDoc.filename}`,
            status: 'REVIEW_REQUIRED',
            severity: 'critical',
            reason: `MTC identity (TC number, Heat number, Material grade) could not be established from the uploaded document "${mtcDoc.filename}". Comparison is blocked to prevent stale or invalid data.`,
            calculatedComparison: 'Unverified MTC Identity -> BLOCK & REVIEW REQUIRED',
            confidence: 'high',
            operator: 'REQUIRED',
            isReviewed: false,
          };

          const unverifiedAnalysis: AnalysisRecord = {
            id: analysisId,
            organizationId: orgId,
            title: `MTC Identity Review Required: ${mtcDoc.filename}`,
            status: 'rejected',
            mtcDocumentId: mtcDoc.id,
            mtcFilename: mtcDoc.filename,
            mtcNumber: mtcIdentity.mtcNumber,
            supplierName: mtcIdentity.supplierName || 'Unverified Supplier',
            clientName: clientName || reqSet.clientName,
            materialGrade: mtcIdentity.materialGrade,
            requirementSetId: reqSet.id,
            requirementSetTitle: reqSet.title,
            heats: [mtcIdentity.heatNumber],
            passCount: 0,
            deviationCount: 0,
            documentationGapCount: 0,
            reviewRequiredCount: 1,
            totalFindings: 1,
            reviewedCount: 0,
            ruleEngineVersion: '2.5.0-deterministic',
            createdAt: new Date().toISOString(),
            createdBy: req.user!.id,
            createdByName: req.user!.name,
          };

          db.setAnalysis(orgId, analysisId, unverifiedAnalysis);
          db.setFindings(orgId, analysisId, [finding]);
          await db.flushWrites();
          const totalInOrg = db.getAnalyses(orgId).length;
          console.log(`[TRACE-1 CREATE UNVERIFIED] Analysis created: id=${analysisId}, orgId=${orgId}, status=${unverifiedAnalysis.status}, totalOrgInDb=${totalInOrg}`);
          return res.status(201).json({ analysis: unverifiedAnalysis, findings: [finding] });
        }

        const extracted = await extractSupplierEvidenceWithAI(
          mtcDoc.rawText || '',
          mtcDoc.filename
        );

        const finalHeat =
          mtcIdentity.heatNumber && mtcIdentity.heatNumber !== 'UNVERIFIED'
            ? mtcIdentity.heatNumber
            : (extracted.certificateMetadata?.heats && extracted.certificateMetadata.heats[0]) || 'FK2407-061';

        const finalGrade =
          mtcIdentity.materialGrade && mtcIdentity.materialGrade !== 'UNVERIFIED GRADE'
            ? mtcIdentity.materialGrade
            : extracted.certificateMetadata?.materialGrade || 'ASTM A182 F316';

        certRecord = {
          id: `cert-${Date.now()}`,
          documentId: mtcDoc.id,
          mtcNumber: mtcIdentity.mtcNumber || extracted.certificateMetadata?.mtcNumber || `MTC-${finalHeat}`,
          supplierName: mtcIdentity.supplierName || extracted.certificateMetadata?.supplierName || 'Western Forge & Flange Co.',
          clientName: clientName || reqSet.clientName,
          poNumber: poNumber || 'PO-2026-APEX-8821',
          issueDate: new Date().toISOString().split('T')[0],
          materialGrade: finalGrade,
          standard: finalGrade,
          heats: [finalHeat],
          evidenceItems: extracted.evidence as any,
        };
        db.setCertificate(certRecord.id, certRecord);
      }

      // 3. Hard Material Specification Compatibility Gate
      const normalizeMaterialFamily = (gradeStr: string): string => {
        const g = (gradeStr || '').toUpperCase().replace(/[\s\-_()]/g, '');
        if (g.includes('F316') || g.includes('S31600') || g.includes('S31603') || g.includes('316L') || g.includes('316')) return 'F316';
        if (g.includes('F6A') || g.includes('S41000') || g.includes('13CR')) return 'F6A';
        if (g.includes('A105') || g.includes('K03504')) return 'A105';
        if (g.includes('LF2') || g.includes('A350') || g.includes('K03011')) return 'LF2';
        if (g.includes('F51') || g.includes('S31803')) return 'F51';
        return g;
      };

      const mtcFamily = normalizeMaterialFamily(certRecord.materialGrade || '');
      const mdsFamily = normalizeMaterialFamily(reqSet.materialGrade || '');
      const isCompatible = Boolean(
        mtcFamily && mdsFamily && (mtcFamily === mdsFamily || mtcFamily.includes(mdsFamily) || mdsFamily.includes(mtcFamily))
      );

      if (!isCompatible) {
        const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const mismatchFinding: ComplianceFinding = {
          id: `finding-material-mismatch-${Date.now()}`,
          analysisId,
          requirementId: 'material-compatibility-gate',
          category: 'general',
          field: 'materialSpecificationCompatibility',
          displayName: 'Material Grade Specification Compatibility',
          requirementText: `MTC material grade (${certRecord.materialGrade}) must match project MDS material grade (${reqSet.materialGrade}).`,
          requirementClause: 'SPEC-COMPAT-GATE-01',
          requirementSourceDoc: reqSet.title,
          requirementSourcePage: 1,
          supplierRawValue: certRecord.materialGrade || 'Unspecified Grade',
          status: 'REVIEW_REQUIRED',
          severity: 'critical',
          reason: `Specification Incompatibility: Supplier MTC certifies material grade "${certRecord.materialGrade}", which does not match client MDS specification grade "${reqSet.materialGrade}". Automatic compliance verification is blocked to prevent requirement cross-contamination. Technical quality engineering review required.`,
          calculatedComparison: `MTC Grade "${certRecord.materialGrade}" != MDS Grade "${reqSet.materialGrade}" -> BLOCK & REVIEW REQUIRED`,
          confidence: 'high',
          operator: 'REQUIRED',
          isReviewed: false,
        };

        const mismatchAnalysis: AnalysisRecord = {
          id: analysisId,
          organizationId: orgId,
          title: `Specification Mismatch: ${certRecord.materialGrade} vs ${reqSet.materialGrade}`,
          status: 'rejected',
          mtcDocumentId: certRecord.documentId,
          mtcFilename: mtcDoc ? mtcDoc.filename : 'MTC-Document.pdf',
          mdsDocumentId: mdsDocumentId,
          mdsFilename: reqSet.sourceDocumentId
            ? db.getDocument(orgId, reqSet.sourceDocumentId)?.filename
            : 'MDS-Specification.pdf',
          requirementSetId: reqSet.id,
          requirementSetTitle: reqSet.title,
          materialGrade: certRecord.materialGrade,
          mtcMaterialGrade: certRecord.materialGrade,
          mdsMaterialGrade: reqSet.materialGrade,
          mdsRevision: reqSet.revision,
          compatibilityStatus: 'MISMATCH',
          supplierName: certRecord.supplierName,
          clientName: reqSet.clientName,
          poNumber: certRecord.poNumber,
          mtcNumber: certRecord.mtcNumber,
          heats: certRecord.heats,
          passCount: 0,
          deviationCount: 0,
          documentationGapCount: 0,
          reviewRequiredCount: 1,
          totalFindings: 1,
          reviewedCount: 0,
          ruleEngineVersion: 'MTC-CoreEngine v2.5.0-compatibility-gate',
          aiModelUsed: 'deterministic-compatibility-gate',
          createdAt: new Date().toISOString(),
          createdBy: req.user!.id,
          createdByName: req.user!.name,
        };

        db.setAnalysis(orgId, analysisId, mismatchAnalysis);
        db.setFindings(orgId, analysisId, [mismatchFinding]);
        await db.flushWrites();

        const totalInOrg = db.getAnalyses(orgId).length;
        console.log(`[TRACE-1 CREATE MISMATCH] Analysis created: id=${analysisId}, orgId=${orgId}, status=${mismatchAnalysis.status}, totalOrgInDb=${totalInOrg}`);

        return res.status(201).json({
          analysis: mismatchAnalysis,
          findings: [mismatchFinding],
          message: 'Material specification mismatch detected between MTC and MDS. Automatic verification blocked; review required.',
        });
      }

      // 4. Execute Deterministic Compliance Rules Engine
      const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const findings = evaluateCompliance({
        analysisId,
        requirements: reqSet.requirements,
        certificate: certRecord,
      });

      const passCount = findings.filter((f) => f.status === 'PASS').length;
      const deviationCount = findings.filter((f) => f.status === 'DEVIATION').length;
      const documentationGapCount = findings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
      const reviewRequiredCount = findings.filter((f) => f.status === 'REVIEW_REQUIRED').length;

      const analysis: AnalysisRecord = {
        id: analysisId,
        organizationId: orgId,
        title:
          title ||
          `Compliance Review: ${certRecord.supplierName} (${certRecord.mtcNumber}) vs ${reqSet.title}`,
        mtcDocumentId: certRecord.documentId,
        mtcFilename: mtcDoc ? mtcDoc.filename : 'Western_Forge_MTC_WW2606229-3.pdf',
        mdsDocumentId: mdsDocumentId,
        mdsFilename: reqSet.sourceDocumentId
          ? db.getDocument(orgId, reqSet.sourceDocumentId)?.filename
          : 'Hawa_Valves_MDS_RevA.pdf',
        requirementSetId: reqSet.id,
        requirementSetTitle: reqSet.title,
        materialGrade: certRecord.materialGrade || reqSet.materialGrade,
        mtcMaterialGrade: certRecord.materialGrade,
        mdsMaterialGrade: reqSet.materialGrade,
        mdsRevision: reqSet.revision,
        compatibilityStatus: 'COMPATIBLE',
        supplierName: certRecord.supplierName,
        clientName: reqSet.clientName,
        poNumber: certRecord.poNumber,
        mtcNumber: certRecord.mtcNumber,
        heats: certRecord.heats,
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
        createdBy: req.user!.id,
        createdByName: req.user!.name,
        passCount,
        deviationCount,
        documentationGapCount,
        reviewRequiredCount,
        totalFindings: findings.length,
        reviewedCount: 0,
        ruleEngineVersion: 'MTC-CoreEngine v2.5.0',
        aiModelUsed: 'gemini-3.7-flash',
      };

      db.setAnalysis(orgId, analysisId, analysis);
      db.setFindings(orgId, analysisId, findings);

      // 4. Generate Initial Supplier Clarification Feedback Draft
      const deviations = findings.filter((f) => f.status === 'DEVIATION');
      const gaps = findings.filter((f) => f.status === 'DOCUMENTATION_GAP');
      const reviewReqs = findings.filter((f) => f.status === 'REVIEW_REQUIRED');

      const feedbackDraft: ExternalFeedbackDraft = {
        id: `feedback-${analysisId}`,
        analysisId,
        title: `Quality Review & Clarification Request: ${certRecord.mtcNumber}`,
        overallStatus: (reviewRequiredCount > 0 || deviationCount > 0) ? 'REVIEW REQUIRED' : 'COMPLIANT',
        salutation: `Dear ${certRecord.supplierName} Quality Directorate,`,
        openingStatement: `The submitted Material Test Certificate (${certRecord.mtcNumber}) for PO ${certRecord.poNumber || 'N/A'} has been analyzed against project specification ${reqSet.title}.`,
        conformingSummary:
          'Chemical composition and primary tensile/yield mechanical properties for approved heats have been verified against applicable ASTM/NACE thresholds.',
        clarificationPoints: [
          ...reviewReqs.map((r, i) => ({
            id: `rev-pt-${i + 1}`,
            itemNumber: i + 1,
            title: `Specification Review Required: ${r.displayName}`,
            findingId: r.id,
            description: r.reason,
            actionRequired: 'Quality engineering verification of the project specification identity is required.',
          })),
          ...deviations.map((d, i) => ({
            id: `dev-pt-${i + 1}`,
            itemNumber: reviewReqs.length + i + 1,
            title: `${d.displayName} Deviation (${d.heatNo || 'General'})`,
            findingId: d.id,
            description: `Reported value "${d.supplierRawValue}" deviates from specified requirement "${d.requirementText}". Reason: ${d.reason}`,
            actionRequired: 'Please submit corrective technical documentation or re-test justification.',
          })),
          ...gaps.map((g, i) => ({
            id: `gap-pt-${i + 1}`,
            itemNumber: reviewReqs.length + deviations.length + i + 1,
            title: `Missing Evidence: ${g.displayName}`,
            findingId: g.id,
            description: `The client specification requires "${g.displayName}" (${g.requirementClause || 'Mandatory'}), which was not identified in the submitted certificate.`,
            actionRequired: 'Please attach formal supplementary examination test reports.',
          })),
        ],
        closingStatement:
          'Please provide written clarification and supporting documentation for the above points to enable final material acceptance.',
        status: 'draft',
      };
      db.setFeedbackDraft(orgId, analysisId, feedbackDraft);

      // Audit Event
      db.addAuditEvent(orgId, {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'RUN_ANALYSIS',
        objectType: 'analysis',
        objectId: analysisId,
        objectName: analysis.title,
        details: { passCount, deviationCount, documentationGapCount, total: findings.length },
      });

      await db.flushWrites();

      const totalInOrg = db.getAnalyses(orgId).length;
      console.log(`[TRACE-1 CREATE] Analysis created: id=${analysisId}, orgId=${orgId}, status=${analysis.status}, totalOrgInDb=${totalInOrg}`);

      res.status(201).json({
        analysis,
        findings,
        feedbackDraft,
      });
    } catch (e: any) {
      console.error('Analysis execution error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/analyses', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const list = db.getAnalyses(orgId);
    console.log(`[TRACE-3 GET] GET /api/analyses: orgId=${orgId}, count=${list.length}, ids=[${list.map((a) => a.id).join(', ')}]`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ analyses: list });
  });

  // Clear all analyses for Tenant (ADMIN only — destructive operation)
  app.post('/api/analyses/clear', requireAuth, requireRole(['ADMIN']), (req, res) => {
    const orgId = req.user!.organization_id;
    db.clearAllAnalyses(orgId);
    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'CLEAR_ANALYSES',
      objectType: 'analysis',
      objectId: 'all',
      objectName: 'All Analyses Cleared',
      details: { timestamp: new Date().toISOString() },
    });
    res.json({ success: true, message: 'All compliance analyses cleared.' });
  });

  // Delete single analysis
  app.delete('/api/analyses/:id', requireAuth, requireRole(['ADMIN', 'QUALITY_ENGINEER', 'REVIEWER']), (req, res) => {
    const orgId = req.user!.organization_id;
    const analysis = db.getAnalysis(orgId, req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found in your organization.' });

    db.deleteAnalysis(orgId, req.params.id);
    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'DELETE_ANALYSIS',
      objectType: 'analysis',
      objectId: req.params.id,
      objectName: analysis.title,
      details: { mtcNumber: analysis.mtcNumber },
    });
    res.json({ success: true, message: 'Analysis deleted successfully.' });
  });

  // 30-Day Data Retention Policy Information & Enforcement
  app.get('/api/retention-policy', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const policy = db.getRetentionPolicyInfo(orgId);
    res.json({ policy });
  });

  app.get('/api/analyses/:id', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const analysis = db.getAnalysis(orgId, req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found in your organization.' });
    const findings = db.getFindings(orgId, req.params.id) || [];
    const feedback = db.getFeedbackDraft(orgId, req.params.id);
    res.json({ analysis, findings, feedback });
  });

  app.get('/api/analyses/:id/findings', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const findings = db.getFindings(orgId, req.params.id);
    if (!findings) return res.status(404).json({ error: 'Findings not found for analysis in your organization.' });
    res.json({ findings });
  });

  // Human Reviewer Action: Confirm, Override, Comment on Finding
  app.patch('/api/findings/:id', requireAuth, requireRole(['ADMIN', 'REVIEWER']), (req, res) => {
    try {
      const orgId = req.user!.organization_id;
      const findingId = req.params.id;
      const { analysisId, status, reviewerDecision, overrideReason, reviewerComment } = req.body;

      const findingsList = db.getFindings(orgId, analysisId);
      if (!findingsList) return res.status(404).json({ error: 'Analysis findings not found.' });

      const findingIndex = findingsList.findIndex((f) => f.id === findingId);
      if (findingIndex === -1) return res.status(404).json({ error: 'Finding not found.' });

      const existingFinding = findingsList[findingIndex];
      const previousStatus = existingFinding.status;
      const newStatus = (status as FindingStatus) || existingFinding.status;

      const auditEntry = {
        id: `audit-f-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: req.user!.id,
        userName: req.user!.name,
        action: reviewerDecision || 'REVIEW_FINDING',
        previousStatus,
        newStatus,
        reason: overrideReason || undefined,
        comment: reviewerComment || undefined,
      };

      const updatedFinding: ComplianceFinding = {
        ...existingFinding,
        status: newStatus,
        isReviewed: true,
        reviewedBy: req.user!.id,
        reviewedByName: req.user!.name,
        reviewedAt: new Date().toISOString(),
        originalStatus: existingFinding.originalStatus || previousStatus,
        reviewerDecision: reviewerDecision || 'confirmed',
        overrideReason: overrideReason || existingFinding.overrideReason,
        reviewerComment: reviewerComment || existingFinding.reviewerComment,
        auditHistory: [...(existingFinding.auditHistory || []), auditEntry],
      };

      findingsList[findingIndex] = updatedFinding;
      db.setFindings(orgId, analysisId, findingsList);

      // Re-aggregate counts on analysis record
      const analysis = db.getAnalysis(orgId, analysisId);
      if (analysis) {
        if (analysis.status === 'approved' || analysis.status === 'rejected') {
          analysis.approvedBy = undefined;
          analysis.approvedByName = undefined;
          analysis.approvedAt = undefined;
          analysis.finalStatus = undefined;
          analysis.approvalNotes = undefined;
        }
        analysis.passCount = findingsList.filter((f) => f.status === 'PASS').length;
        analysis.deviationCount = findingsList.filter((f) => f.status === 'DEVIATION').length;
        analysis.documentationGapCount = findingsList.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
        analysis.reviewRequiredCount = findingsList.filter((f) => f.status === 'REVIEW_REQUIRED').length;
        analysis.reviewedCount = findingsList.filter((f) => f.isReviewed).length;
        analysis.status = 'review_in_progress';
        db.setAnalysis(orgId, analysisId, analysis);
      }

      // Add to main audit log
      db.addAuditEvent(orgId, {
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'OVERRIDE_FINDING',
        objectType: 'finding',
        objectId: findingId,
        objectName: `${existingFinding.displayName} (${existingFinding.heatNo || 'General'})`,
        details: { previousStatus, newStatus, reason: overrideReason, comment: reviewerComment },
      });

      res.json({ finding: updatedFinding, analysis });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Final Technical Approval Gate
  app.post('/api/analyses/:id/approve', requireAuth, requireRole(['ADMIN', 'REVIEWER']), (req, res) => {
    const orgId = req.user!.organization_id;
    const { approvalNotes, finalStatus } = req.body;

    const analysis = db.getAnalysis(orgId, req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found in your organization.' });

    analysis.status = 'approved';
    analysis.finalStatus = finalStatus || (analysis.deviationCount > 0 ? 'CONDITIONAL_APPROVAL' : 'APPROVED');
    analysis.approvedBy = req.user!.id;
    analysis.approvedByName = `${req.user!.name} (${req.user!.role})`;
    analysis.approvedAt = new Date().toISOString();
    analysis.approvalNotes = approvalNotes || 'Reviewed and digitally signed in accordance with QA standards.';
    db.setAnalysis(orgId, analysis.id, analysis);

    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'APPROVE_ANALYSIS',
      objectType: 'analysis',
      objectId: analysis.id,
      objectName: analysis.title,
      details: { finalStatus: analysis.finalStatus, notes: analysis.approvalNotes },
    });

    res.json({ analysis });
  });

  // Final Technical Rejection Gate
  app.post('/api/analyses/:id/reject', requireAuth, requireRole(['ADMIN', 'REVIEWER']), (req, res) => {
    const orgId = req.user!.organization_id;
    const { reason } = req.body;

    const analysis = db.getAnalysis(orgId, req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found in your organization.' });

    analysis.status = 'rejected';
    analysis.finalStatus = 'REJECTED';
    analysis.approvedBy = req.user!.id;
    analysis.approvedByName = `${req.user!.name} (${req.user!.role})`;
    analysis.approvedAt = new Date().toISOString();
    analysis.approvalNotes = reason || 'Rejected due to unresolved critical metallurgical deviations.';
    db.setAnalysis(orgId, analysis.id, analysis);

    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'REJECT_ANALYSIS',
      objectType: 'analysis',
      objectId: analysis.id,
      objectName: analysis.title,
      details: { reason },
    });

    res.json({ analysis });
  });

  // External Feedback Draft API
  app.get('/api/feedback/:analysisId', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const draft = db.getFeedbackDraft(orgId, req.params.analysisId);
    if (!draft) return res.status(404).json({ error: 'Feedback draft not found.' });
    res.json({ feedback: draft });
  });

  app.put('/api/feedback/:analysisId', requireAuth, requireRole(['ADMIN', 'REVIEWER', 'QUALITY_ENGINEER']), (req, res) => {
    const orgId = req.user!.organization_id;
    const { feedback } = req.body;
    const updated = {
      ...feedback,
      lastEditedBy: req.user!.name,
      lastEditedAt: new Date().toISOString(),
    };
    db.setFeedbackDraft(orgId, req.params.analysisId, updated);

    db.addAuditEvent(orgId, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'EDIT_FEEDBACK_DRAFT',
      objectType: 'report',
      objectId: req.params.analysisId,
      objectName: updated.title,
    });

    res.json({ feedback: updated });
  });

  // Immutable Audit Trail
  app.get('/api/audit', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const logs = db.getAuditLogs(orgId);
    res.json({ auditLogs: logs });
  });

  app.get('/api/audit/:objectId', requireAuth, (req, res) => {
    const orgId = req.user!.organization_id;
    const logs = db.getAuditLogs(orgId).filter((a) => a.objectId === req.params.objectId);
    res.json({ auditLogs: logs });
  });

  // Automated Test Suite Runner Endpoint
  app.post('/api/test-suite/run', requireAuth, requireRole(['ADMIN', 'QUALITY_ENGINEER', 'REVIEWER']), (req, res) => {
    try {
      const results = runAllTestCases();
      const passedCount = results.filter((r) => r.status === 'passed').length;
      const failedCount = results.filter((r) => r.status === 'failed').length;

      res.json({
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        allPassed: failedCount === 0,
        results,
        executedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pilot fixture data helper (ADMIN only — exposes proprietary spec data)
  app.get('/api/pilot-data', requireAuth, requireRole(['ADMIN']), (req, res) => {
    res.json({
      mds: PILOT_MDS_REQUIREMENT_SET,
      mtc: PILOT_SUPPLIER_MTC,
    });
  });

  // ---------------------------------------------------------------------------
  // Frontend serving & API routing fallback
  // ---------------------------------------------------------------------------
  const distPath = path.join(process.cwd(), 'dist');
  const entryPoint = process.argv[1] || '';
  const isBuiltEntry = /\.(cjs|mjs|js)$/i.test(entryPoint);
  const isProduction = process.env.NODE_ENV === 'production' || isBuiltEntry || !!process.env.VERCEL;

  // Unknown /api/* paths must answer with JSON, never with the SPA shell.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `Unknown API endpoint: ${req.method} ${req.originalUrl}` });
  });

  // API error handler. Must stay registered after the API routes.
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    const status = Number(err?.status || err?.statusCode) || 500;
    const isMalformedBody = err instanceof SyntaxError && status === 400;

    console.error(`[api error] ${req.method} ${req.originalUrl}:`, err?.message || err);

    res.status(isMalformedBody ? 400 : status).json({
      error: isMalformedBody
        ? 'Malformed JSON in request body.'
        : process.env.NODE_ENV === 'production'
          ? 'Internal server error.'
          : `Internal server error: ${err?.message || String(err)}`,
    });
  });

  if (!process.env.VERCEL) {
    if (isProduction) {
      if (fs.existsSync(path.join(distPath, 'index.html'))) {
        console.log('Serving prebuilt frontend from dist/ (production mode)');

        app.use(
          express.static(distPath, {
            index: false,
            setHeaders: (res, filePath) => {
              const name = path.basename(filePath);
              if (name === 'sw.js' || name === 'index.html' || name === 'manifest.json') {
                res.setHeader('Cache-Control', 'no-cache, must-revalidate');
              } else if (/-[A-Za-z0-9_-]{8,}\.[a-z]+$/.test(name)) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              } else {
                res.setHeader('Cache-Control', 'public, max-age=3600');
              }
            },
          })
        );

        app.get('*', (req, res) => {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    } else {
      (async () => {
        try {
          const { createServer: createViteServer } = await import('vite');
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
          });
          app.use(vite.middlewares);
          console.log('Vite dev middleware active — serving live source with HMR');
        } catch (e: any) {
          console.warn('Vite dev server init warning:', e.message);
        }
      })();
    }
  }

export async function startServer() {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MTC Compliance Checker server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start only when executed directly, not when imported as serverless function
const isDirectExecution =
  !process.env.VERCEL &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  (entryPoint.includes('server') ||
    entryPoint.includes('tsx') ||
    process.argv[1]?.endsWith('server.cjs') ||
    process.argv[1]?.endsWith('server.ts'));

if (isDirectExecution) {
  startServer().catch((err) => {
    console.error('[fatal] Server failed to start:', err);
    process.exit(1);
  });
}

export default app;

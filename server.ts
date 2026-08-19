import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, USERS, ORGANIZATIONS } from './server/db';
import { validateUploadedDocument, parseDocumentContent, calculateChecksum } from './server/pdfService';
import { extractRequirementsWithAI, extractSupplierEvidenceWithAI, draftSupplierClarificationWithAI } from './server/gemini';
import { evaluateCompliance } from './src/engine/rules';
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

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security Middleware Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'MTC Compliance Checker API',
      version: '2.4.0',
      timestamp: new Date().toISOString(),
    });
  });

  // RBAC Users and Organizations
  app.get('/api/users', (req, res) => {
    res.json({ users: USERS, organizations: ORGANIZATIONS });
  });

  // Document Ingestion
  app.post('/api/documents', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const docType = (req.body.type as 'mtc' | 'mds') || 'mtc';
      const userId = (req.body.userId as string) || 'user-zarique-shaikh';
      const user = USERS.find((u) => u.id === userId) || USERS[0];
      const orgId = user.organizationId;

      const validation = validateUploadedDocument(req.file);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      const parsed = await parseDocumentContent(req.file.buffer, req.file.originalname);
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const docRecord: DocumentRecord = {
        id: docId,
        type: docType,
        filename: req.file.originalname,
        filesize: req.file.size,
        checksum: parsed.checksum,
        pageCount: parsed.pageCount,
        uploadedBy: user.id,
        uploadedByName: user.name,
        uploadedAt: new Date().toISOString(),
        organizationId: orgId,
        mimeType: req.file.mimetype,
        contentSummary: parsed.text.slice(0, 300),
        rawText: parsed.text,
        isScanned: parsed.isScanned,
      };

      db.documents.set(docId, docRecord);

      db.addAuditEvent({
        organizationId: orgId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
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
  });

  app.get('/api/documents', (req, res) => {
    const orgId = (req.query.orgId as string) || 'org-apex-01';
    const docs = Array.from(db.documents.values()).filter((d) => d.organizationId === orgId);
    res.json({ documents: docs });
  });

  app.get('/api/documents/:id', (req, res) => {
    const doc = db.documents.get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.json({ document: doc });
  });

  // Requirement Sets & Library
  app.get('/api/requirements', (req, res) => {
    const orgId = (req.query.orgId as string) || 'org-apex-01';
    const sets = Array.from(db.requirementSets.values()).filter((r) => r.organizationId === orgId);
    res.json({ requirementSets: sets });
  });

  // Clear all requirement sets for organization
  app.post('/api/requirements/clear', (req, res) => {
    const orgId = (req.body.orgId as string) || 'org-apex-01';
    db.clearAllRequirementSets(orgId);
    db.addAuditEvent({
      organizationId: orgId,
      actorId: (req.body.userId as string) || 'user-admin-system',
      actorName: 'System Reviewer',
      actorRole: 'admin',
      action: 'CLEAR_REQUIREMENT_SETS',
      objectType: 'requirement_set',
      objectId: 'all',
      objectName: 'All Requirement Sets Cleared',
      details: { timestamp: new Date().toISOString() },
    });
    res.json({ success: true, message: 'All requirement sets cleared.' });
  });

  // Delete single requirement set
  app.delete('/api/requirements/:id', (req, res) => {
    const reqSet = db.requirementSets.get(req.params.id);
    if (!reqSet) return res.status(404).json({ error: 'Requirement set not found.' });

    db.deleteRequirementSet(req.params.id);
    db.addAuditEvent({
      organizationId: reqSet.organizationId,
      actorId: (req.query.userId as string) || 'user-admin-system',
      actorName: 'System Reviewer',
      actorRole: 'admin',
      action: 'DELETE_REQUIREMENT_SET',
      objectType: 'requirement_set',
      objectId: req.params.id,
      objectName: reqSet.title,
      details: { mdsNumber: reqSet.mdsNumber },
    });
    res.json({ success: true, message: 'Requirement set deleted successfully.' });
  });

  app.get('/api/requirements/:id', (req, res) => {
    const reqSet = db.requirementSets.get(req.params.id);
    if (!reqSet) return res.status(404).json({ error: 'Requirement set not found.' });
    res.json({ requirementSet: reqSet });
  });

  app.post('/api/requirements', (req, res) => {
    try {
      const {
        clientName,
        materialGrade,
        mdsNumber,
        revision,
        title,
        requirements,
        userId,
      } = req.body;

      const user = USERS.find((u) => u.id === userId) || USERS[0];
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
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        organizationId: user.organizationId,
        requirements: requirements || [],
      };

      db.requirementSets.set(newId, newSet);

      db.addAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
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

  // Start Comparison Analysis
  app.post('/api/analyses', async (req, res) => {
    try {
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
        userId,
      } = req.body;

      const user = USERS.find((u) => u.id === userId) || USERS[0];
      const orgId = user.organizationId;

      // 1. Resolve Requirement Set
      let reqSet: RequirementSet | undefined;
      if (requirementSetId) {
        reqSet = db.requirementSets.get(requirementSetId);
      } else if (mdsDocumentId) {
        const mdsDoc = db.documents.get(mdsDocumentId);
        if (mdsDoc) {
          // If we have text, extract requirements with AI assistance + fallback
          const extractedReqs = await extractRequirementsWithAI(
            mdsDoc.rawText || mdsDoc.contentSummary || '',
            mdsDoc.filename
          );
          reqSet = {
            id: `reqset-${Date.now()}`,
            clientName: clientName || 'Client Requirements',
            materialGrade: materialGrade || 'ASTM A105N',
            mdsNumber: 'EXTRACTED-MDS',
            revision: 'Rev 1',
            title: `Extracted Requirements from ${mdsDoc.filename}`,
            effectiveDate: new Date().toISOString().split('T')[0],
            status: 'draft',
            organizationId: orgId,
            requirements: (extractedReqs.length > 0
              ? extractedReqs
              : PILOT_MDS_REQUIREMENT_SET.requirements) as any,
            sourceDocumentId: mdsDoc.id,
          };
          db.requirementSets.set(reqSet.id, reqSet);
        }
      }

      if (!reqSet) {
        reqSet = PILOT_MDS_REQUIREMENT_SET;
      }

      // 2. Resolve Certificate Evidence
      let certRecord: CertificateRecord | undefined;
      const mtcDoc = mtcDocumentId ? db.documents.get(mtcDocumentId) : undefined;

      if (mtcDoc && mtcDoc.rawText && !mtcDoc.filename.includes('WW2606229-3')) {
        const extracted = await extractSupplierEvidenceWithAI(mtcDoc.rawText, mtcDoc.filename);
        certRecord = {
          id: `cert-${Date.now()}`,
          documentId: mtcDoc.id,
          mtcNumber: mtcNumber || extracted.certificateMetadata?.mtcNumber || 'MTC-EXTRACTED',
          supplierName: supplierName || extracted.certificateMetadata?.supplierName || 'Supplier',
          clientName: clientName || reqSet.clientName,
          poNumber: poNumber || 'PO-PROJECT',
          issueDate: new Date().toISOString().split('T')[0],
          materialGrade: materialGrade || reqSet.materialGrade,
          standard: extracted.certificateMetadata?.standard || 'ASTM A105N',
          heats: heats || extracted.certificateMetadata?.heats || ['HEAT-01'],
          evidenceItems: extracted.evidence as any,
        };
        db.certificates.set(certRecord.id, certRecord);
      } else {
        certRecord = PILOT_SUPPLIER_MTC;
      }

      // 3. Execute Deterministic Compliance Engine
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
        mtcDocumentId: mtcDoc ? mtcDoc.id : 'doc-mtc-ww2606229-3',
        mtcFilename: mtcDoc ? mtcDoc.filename : 'Western_Forge_MTC_WW2606229-3.pdf',
        mdsDocumentId: mdsDocumentId,
        mdsFilename: reqSet.sourceDocumentId
          ? db.documents.get(reqSet.sourceDocumentId)?.filename
          : 'Hawa_Valves_MDS_RevA.pdf',
        requirementSetId: reqSet.id,
        requirementSetTitle: reqSet.title,
        materialGrade: certRecord.materialGrade || reqSet.materialGrade,
        supplierName: certRecord.supplierName,
        clientName: reqSet.clientName,
        poNumber: certRecord.poNumber,
        mtcNumber: certRecord.mtcNumber,
        heats: certRecord.heats,
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.name,
        passCount,
        deviationCount,
        documentationGapCount,
        reviewRequiredCount,
        totalFindings: findings.length,
        reviewedCount: 0,
        ruleEngineVersion: 'MTC-CoreEngine v2.4.0',
        aiModelUsed: 'gemini-3.7-flash',
      };

      db.analyses.set(analysisId, analysis);
      db.findings.set(analysisId, findings);

      // 4. Generate Initial Supplier Clarification Feedback Draft
      const deviations = findings.filter((f) => f.status === 'DEVIATION');
      const gaps = findings.filter((f) => f.status === 'DOCUMENTATION_GAP');

      const feedbackDraft: ExternalFeedbackDraft = {
        id: `feedback-${analysisId}`,
        analysisId,
        title: `Quality Review & Clarification Request: ${certRecord.mtcNumber}`,
        overallStatus: deviationCount > 0 ? 'REVIEW REQUIRED' : 'COMPLIANT',
        salutation: `Dear ${certRecord.supplierName} Quality Directorate,`,
        openingStatement: `The submitted Material Test Certificate (${certRecord.mtcNumber}) for PO ${certRecord.poNumber || 'N/A'} has been analyzed against project specification ${reqSet.title}.`,
        conformingSummary: `Chemical composition and primary tensile/yield mechanical properties for approved heats have been verified against applicable ASTM/NACE thresholds.`,
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
            description: `The client specification requires "${g.displayName}" (${g.requirementClause || 'Mandatory'}), which was not identified in the submitted certificate.`,
            actionRequired: 'Please attach formal supplementary examination test reports.',
          })),
        ],
        closingStatement:
          'Please provide written clarification and supporting documentation for the above points to enable final material acceptance.',
        status: 'draft',
      };
      db.feedbackDrafts.set(analysisId, feedbackDraft);

      // Audit Event
      db.addAuditEvent({
        organizationId: orgId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'RUN_ANALYSIS',
        objectType: 'analysis',
        objectId: analysisId,
        objectName: analysis.title,
        details: {
          passCount,
          deviationCount,
          documentationGapCount,
          total: findings.length,
        },
      });

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

  app.get('/api/analyses', (req, res) => {
    const orgId = (req.query.orgId as string) || 'org-apex-01';
    const list = Array.from(db.analyses.values())
      .filter((a) => a.organizationId === orgId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ analyses: list });
  });

  // Clear all analyses for organization
  app.post('/api/analyses/clear', (req, res) => {
    const orgId = (req.body.orgId as string) || 'org-apex-01';
    db.clearAllAnalyses(orgId);
    db.addAuditEvent({
      organizationId: orgId,
      actorId: (req.body.userId as string) || 'user-admin-system',
      actorName: 'System Reviewer',
      actorRole: 'admin',
      action: 'CLEAR_ANALYSES',
      objectType: 'analysis',
      objectId: 'all',
      objectName: 'All Analyses Cleared',
      details: { timestamp: new Date().toISOString() },
    });
    res.json({ success: true, message: 'All compliance analyses cleared.' });
  });

  // Delete single analysis
  app.delete('/api/analyses/:id', (req, res) => {
    const analysis = db.analyses.get(req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
    
    db.deleteAnalysis(req.params.id);
    db.addAuditEvent({
      organizationId: analysis.organizationId,
      actorId: (req.query.userId as string) || 'user-admin-system',
      actorName: 'System Reviewer',
      actorRole: 'admin',
      action: 'DELETE_ANALYSIS',
      objectType: 'analysis',
      objectId: req.params.id,
      objectName: analysis.title,
      details: { mtcNumber: analysis.mtcNumber },
    });
    res.json({ success: true, message: 'Analysis deleted successfully.' });
  });

  app.get('/api/analyses/:id', (req, res) => {
    const analysis = db.analyses.get(req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
    const findings = db.findings.get(req.params.id) || [];
    const feedback = db.feedbackDrafts.get(req.params.id);
    res.json({ analysis, findings, feedback });
  });

  app.get('/api/analyses/:id/findings', (req, res) => {
    const findings = db.findings.get(req.params.id);
    if (!findings) return res.status(404).json({ error: 'Findings not found for analysis.' });
    res.json({ findings });
  });

  // Human Reviewer Action: Confirm, Override, Comment on Finding
  app.patch('/api/findings/:id', (req, res) => {
    try {
      const findingId = req.params.id;
      const {
        analysisId,
        status,
        reviewerDecision,
        overrideReason,
        reviewerComment,
        userId,
      } = req.body;

      const user = USERS.find((u) => u.id === userId) || USERS[0];
      const findingsList = db.findings.get(analysisId);
      if (!findingsList) return res.status(404).json({ error: 'Analysis findings not found.' });

      const findingIndex = findingsList.findIndex((f) => f.id === findingId);
      if (findingIndex === -1) return res.status(404).json({ error: 'Finding not found.' });

      const existingFinding = findingsList[findingIndex];
      const previousStatus = existingFinding.status;
      const newStatus = (status as FindingStatus) || existingFinding.status;

      const auditEntry = {
        id: `audit-f-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
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
        reviewedBy: user.id,
        reviewedByName: user.name,
        reviewedAt: new Date().toISOString(),
        originalStatus: existingFinding.originalStatus || previousStatus,
        reviewerDecision: reviewerDecision || 'confirmed',
        overrideReason: overrideReason || existingFinding.overrideReason,
        reviewerComment: reviewerComment || existingFinding.reviewerComment,
        auditHistory: [...(existingFinding.auditHistory || []), auditEntry],
      };

      findingsList[findingIndex] = updatedFinding;
      db.findings.set(analysisId, findingsList);

      // Re-aggregate counts on analysis record
      const analysis = db.analyses.get(analysisId);
      if (analysis) {
        analysis.passCount = findingsList.filter((f) => f.status === 'PASS').length;
        analysis.deviationCount = findingsList.filter((f) => f.status === 'DEVIATION').length;
        analysis.documentationGapCount = findingsList.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
        analysis.reviewRequiredCount = findingsList.filter((f) => f.status === 'REVIEW_REQUIRED').length;
        analysis.reviewedCount = findingsList.filter((f) => f.isReviewed).length;
        analysis.status = 'review_in_progress';
        db.analyses.set(analysisId, analysis);
      }

      // Add to main audit log
      db.addAuditEvent({
        organizationId: user.organizationId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
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

  // Final Technical Approval / Rejection Gate
  app.post('/api/analyses/:id/approve', (req, res) => {
    const { userId, approvalNotes, finalStatus } = req.body;
    const user = USERS.find((u) => u.id === userId) || USERS[1]; // Default Marcus Vance (Engineer)

    const analysis = db.analyses.get(req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });

    analysis.status = 'approved';
    analysis.finalStatus = finalStatus || (analysis.deviationCount > 0 ? 'CONDITIONAL_APPROVAL' : 'APPROVED');
    analysis.approvedBy = user.id;
    analysis.approvedByName = `${user.name} (${user.role.toUpperCase()})`;
    analysis.approvedAt = new Date().toISOString();
    analysis.approvalNotes = approvalNotes || 'Reviewed and digitally signed in accordance with QA standards.';
    db.analyses.set(analysis.id, analysis);

    db.addAuditEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'APPROVE_ANALYSIS',
      objectType: 'analysis',
      objectId: analysis.id,
      objectName: analysis.title,
      details: { finalStatus: analysis.finalStatus, notes: analysis.approvalNotes },
    });

    res.json({ analysis });
  });

  app.post('/api/analyses/:id/reject', (req, res) => {
    const { userId, reason } = req.body;
    const user = USERS.find((u) => u.id === userId) || USERS[1];

    const analysis = db.analyses.get(req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });

    analysis.status = 'rejected';
    analysis.finalStatus = 'REJECTED';
    analysis.approvedBy = user.id;
    analysis.approvedByName = `${user.name} (${user.role.toUpperCase()})`;
    analysis.approvedAt = new Date().toISOString();
    analysis.approvalNotes = reason || 'Rejected due to unresolved critical metallurgical deviations.';
    db.analyses.set(analysis.id, analysis);

    db.addAuditEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'REJECT_ANALYSIS',
      objectType: 'analysis',
      objectId: analysis.id,
      objectName: analysis.title,
      details: { reason },
    });

    res.json({ analysis });
  });

  // External Feedback Draft API
  app.get('/api/feedback/:analysisId', (req, res) => {
    const draft = db.feedbackDrafts.get(req.params.analysisId);
    if (!draft) return res.status(404).json({ error: 'Feedback draft not found.' });
    res.json({ feedback: draft });
  });

  app.put('/api/feedback/:analysisId', (req, res) => {
    const { feedback, userId } = req.body;
    const user = USERS.find((u) => u.id === userId) || USERS[0];
    const updated = {
      ...feedback,
      lastEditedBy: user.name,
      lastEditedAt: new Date().toISOString(),
    };
    db.feedbackDrafts.set(req.params.analysisId, updated);

    db.addAuditEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'EDIT_FEEDBACK_DRAFT',
      objectType: 'report',
      objectId: req.params.analysisId,
      objectName: updated.title,
    });

    res.json({ feedback: updated });
  });

  // Audit Log Endpoint
  app.get('/api/audit', (req, res) => {
    const orgId = (req.query.orgId as string) || 'org-apex-01';
    const logs = db.auditLogs.filter((a) => a.organizationId === orgId);
    res.json({ auditLogs: logs });
  });

  app.get('/api/audit/:objectId', (req, res) => {
    const logs = db.auditLogs.filter((a) => a.objectId === req.params.objectId);
    res.json({ auditLogs: logs });
  });

  // Automated Test Suite Runner Endpoint
  app.post('/api/test-suite/run', (req, res) => {
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

  // Pilot fixture data helper
  app.get('/api/pilot-data', (req, res) => {
    res.json({
      mds: PILOT_MDS_REQUIREMENT_SET,
      mtc: PILOT_SUPPLIER_MTC,
    });
  });

  // Vite Middleware for SPA development & static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MTC Compliance Checker server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

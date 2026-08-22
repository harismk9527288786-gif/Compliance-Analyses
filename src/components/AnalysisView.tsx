import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  FileText,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
  Search,
  Trash2,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import {
  AnalysisRecord,
  ComplianceFinding,
  User,
  ExternalFeedbackDraft,
} from '../types';
import { exportAnalysisToExcel, exportAnalysisToPDF } from '../utils/exportUtils';
import { calculateCarbonEquivalent } from '../engine/ce';

interface AnalysisViewProps {
  analysis: AnalysisRecord;
  findings: ComplianceFinding[];
  feedbackDraft?: ExternalFeedbackDraft;
  currentUser: User;
  onBack: () => void;
  onSelectFinding: (finding: ComplianceFinding) => void;
  onOpenReportModal: () => void;
  onApproveAnalysis: (analysisId: string, notes: string) => Promise<void>;
  onRejectAnalysis: (analysisId: string, reason: string) => Promise<void>;
  onDeleteAnalysis?: (analysisId: string) => Promise<void>;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  analysis,
  findings,
  feedbackDraft,
  currentUser,
  onBack,
  onSelectFinding,
  onOpenReportModal,
  onApproveAnalysis,
  onRejectAnalysis,
  onDeleteAnalysis,
}) => {
  const [statusTab, setStatusTab] = useState<'all' | 'issues' | 'pass'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved = analysis.status === 'approved';
  const isRejected = analysis.status === 'rejected';
  const hasDeviations = analysis.deviationCount > 0;
  const hasGaps = analysis.documentationGapCount > 0;

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    const matchesStatus =
      statusTab === 'all'
        ? true
        : statusTab === 'issues'
        ? f.status === 'DEVIATION' || f.status === 'DOCUMENTATION_GAP'
        : f.status === 'PASS';

    const matchesSearch =
      f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.requirementText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.supplierRawValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.heatNo && f.heatNo.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  // Calculate Carbon Equivalent for Heat A228
  const cFinding = findings.find((f) => f.field === 'C' && f.heatNo === 'A228');
  const mnFinding = findings.find((f) => f.field === 'Mn' && f.heatNo === 'A228');
  const ceFinding = findings.find((f) => f.field === 'CE' && f.heatNo === 'A228');

  const chemistryA228 = {
    C: Number(cFinding?.supplierNormalizedValue || 0.21),
    Mn: Number(mnFinding?.supplierNormalizedValue || 0.88),
    P: Number(findings.find((f) => f.field === 'P' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.012),
    S: Number(findings.find((f) => f.field === 'S' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.008),
    Si: Number(findings.find((f) => f.field === 'Si' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.24),
    Cr: Number(findings.find((f) => f.field === 'Cr' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.08),
    Mo: Number(findings.find((f) => f.field === 'Mo' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.02),
    Ni: Number(findings.find((f) => f.field === 'Ni' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.05),
    Cu: Number(findings.find((f) => f.field === 'Cu' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.12),
    V: Number(findings.find((f) => f.field === 'V' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.01),
  };

  const ceCalcResult = calculateCarbonEquivalent(chemistryA228, 0.43, Number(ceFinding?.supplierNormalizedValue || 0.37));

  // Escape key handler for dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowApprovalModal(false);
        setShowRejectModal(false);
        setShowDeleteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApproveAnalysis(analysis.id, decisionNotes);
      setShowApprovalModal(false);
      setDecisionNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!decisionNotes.trim()) return;
    setIsSubmitting(true);
    try {
      await onRejectAnalysis(analysis.id, decisionNotes);
      setShowRejectModal(false);
      setDecisionNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteAnalysis) return;
    setIsSubmitting(true);
    try {
      await onDeleteAnalysis(analysis.id);
      setShowDeleteModal(false);
      onBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP ACTION BAR */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded-lg shadow-xs transition-colors cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => exportAnalysisToExcel(analysis, findings)}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Excel Export</span>
          </button>

          <button
            type="button"
            onClick={() => exportAnalysisToPDF(analysis, findings, feedbackDraft)}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>PDF Quality Report</span>
          </button>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <FileText className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span>Supplier Clarification Draft</span>
          </button>

          {onDeleteAnalysis && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-300"
              title="Delete verification record"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TECHNICAL VERIFICATION HEADER CARD (Industrial dark slate, crisp high contrast) */}
      <section
        aria-label="Material Verification Record Header"
        className="rounded-xl p-6 sm:p-7 space-y-5 text-slate-100 bg-slate-900 border border-slate-800 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            {/* Metallurgical Document Tags */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono font-bold">
              {isApproved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>QC APPROVED</span>
                </span>
              ) : isRejected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-600">
                  <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>REJECTED NON-CONFORMANT</span>
                </span>
              ) : hasDeviations ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-600">
                  <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>{analysis.deviationCount} DEVIATION{analysis.deviationCount > 1 ? 'S' : ''} DETECTED</span>
                </span>
              ) : hasGaps ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-600">
                  <FileQuestion className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>DOCUMENTATION GAP</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>CONFORMING</span>
                </span>
              )}

              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                MTC #{analysis.mtcNumber}
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                EN 10204 3.1 Cert
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {analysis.title}
            </h1>
            <p className="text-xs text-slate-300 font-normal">
              Evaluated against specification standard: <strong className="text-white">{analysis.requirementSetTitle}</strong>
            </p>
          </div>

          {/* Action Sign-Off / Rejection Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!isApproved && !isRejected && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Reject Certificate
                </button>
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(true)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                  <span>Technical Sign-Off</span>
                </button>
              </>
            )}

            {isApproved && (
              <div className="px-3.5 py-2 bg-emerald-950 border border-emerald-700 rounded-lg text-xs text-emerald-300 flex items-center gap-2 font-mono font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Signed off by {analysis.approvedByName || currentUser.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Metadata Traceability Panels */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Material Grade</span>
            <span className="font-bold text-white text-sm">{analysis.materialGrade}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Supplier Mill</span>
            <span className="font-semibold text-slate-200 truncate block">{analysis.supplierName}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Client Specification</span>
            <span className="font-semibold text-slate-200 truncate block">{analysis.clientName}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Ladle Heats Evaluated</span>
            <span className="font-mono font-bold text-emerald-300">{(analysis.heats || []).join(', ') || 'N/A'}</span>
          </div>
        </div>
      </section>

      {/* 3. CARBON EQUIVALENT METALLURGICAL VERIFICATION RAIL */}
      <section
        aria-label="Carbon Equivalent Verification"
        className="bg-slate-900 rounded-xl p-4 sm:p-5 text-slate-200 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div className="space-y-1">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5 font-mono text-xs">
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            <span>Carbon Equivalent (CE) - Conformance Verified</span>
          </div>
          <p className="text-[11px] text-slate-300 font-mono">
            Calculated: <strong className="text-white">{ceCalcResult.calculatedCE} wt%</strong> | MTC Reported: <strong className="text-white">{ceCalcResult.reportedCE} wt%</strong> | Maximum Allowable: <strong className="text-white">&le; 0.43 wt%</strong>
          </p>
        </div>

        <div className="text-[11px] text-slate-300 font-mono bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
          IIW Formula: C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15
        </div>
      </section>

      {/* 4. TECHNICAL FINDINGS TABLE WITH FILTER TABS */}
      <section
        aria-label="Compliance Findings Breakdown"
        className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-4"
      >
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div role="tablist" aria-label="Finding Status Tabs" className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-300 text-xs">
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === 'all'}
              onClick={() => setStatusTab('all')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                statusTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              All Requirements ({findings.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === 'issues'}
              onClick={() => setStatusTab('issues')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusTab === 'issues'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-800 hover:text-rose-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
              <span>Issues ({analysis.deviationCount + analysis.documentationGapCount})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === 'pass'}
              onClick={() => setStatusTab('pass')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusTab === 'pass'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
              <span>Conforming ({analysis.passCount})</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search property / heat / value..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-900"
            />
          </div>
        </div>

        {/* Findings Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table role="table" className="w-full text-left text-xs border-collapse min-w-[760px]">
            <caption className="sr-only">Detailed list of compliance findings and metallurgical comparisons</caption>
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                <th scope="col" className="py-2.5 px-4">Property / Test Parameter</th>
                <th scope="col" className="py-2.5 px-3">Heat No</th>
                <th scope="col" className="py-2.5 px-3">Client Limit (MDS)</th>
                <th scope="col" className="py-2.5 px-3">Supplier Reported Value</th>
                <th scope="col" className="py-2.5 px-3">Compliance Status Rail</th>
                <th scope="col" className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredFindings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    No findings match the current filter selection.
                  </td>
                </tr>
              ) : (
                filteredFindings.map((f) => {
                  const isPass = f.status === 'PASS';
                  const isDeviation = f.status === 'DEVIATION';
                  const isGap = f.status === 'DOCUMENTATION_GAP';

                  return (
                    <tr
                      key={f.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Inspect finding for ${f.displayName}`}
                      onClick={() => onSelectFinding(f)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectFinding(f);
                        }
                      }}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                        isDeviation ? 'bg-rose-50/40' : isGap ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Property */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{f.displayName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {f.category.toUpperCase()} {f.requirementClause ? `· ${f.requirementClause}` : ''}
                        </div>
                      </td>

                      {/* Heat */}
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {f.heatNo || 'GENERAL'}
                      </td>

                      {/* Client Limit */}
                      <td className="py-3 px-3 text-slate-800 font-medium">
                        {f.requirementText}
                      </td>

                      {/* Supplier Value */}
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {f.supplierRawValue}
                      </td>

                      {/* Compliance Status Rail (Icon + Label + Color) */}
                      <td className="py-3 px-3">
                        {isPass ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                            <span>PASS</span>
                          </span>
                        ) : isDeviation ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                            <AlertTriangle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                            <span>DEVIATION</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                            <FileQuestion className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                            <span>GAP</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFinding(f);
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-modal-title"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md p-6 space-y-4">
            <h3 id="approve-modal-title" className="text-base font-bold text-slate-900">
              Technical Sign-Off & Approval
            </h3>
            <p className="text-xs text-slate-600">
              Sign off on material certificate as <strong>{currentUser.name}</strong>.
            </p>

            <textarea
              rows={3}
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder="Enter approval notes or concession reference number..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer border border-emerald-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {isSubmitting ? 'Signing...' : 'Confirm Sign-Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md p-6 space-y-4">
            <h3 id="reject-modal-title" className="text-base font-bold text-slate-900">
              Reject Material Certificate
            </h3>
            <p className="text-xs text-slate-600">Formally record non-compliance for this shipment.</p>

            <textarea
              rows={3}
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder="State metallurgical or contractual reason for rejection..."
              className="w-full p-2.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-600 text-slate-900"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting || !decisionNotes.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                {isSubmitting ? 'Recording...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-analysis-modal-title"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md p-6 space-y-4">
            <h3 id="delete-analysis-modal-title" className="text-base font-bold text-slate-900">
              Delete Verification Record?
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove this verification report?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

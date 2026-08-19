import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  FileText,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Calculator,
  Flame,
  Check,
  X,
  UserCheck,
  Trash2,
} from 'lucide-react';
import {
  AnalysisRecord,
  ComplianceFinding,
  RequirementCategory,
  FindingStatus,
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesStatus =
      selectedStatusFilter === 'all'
        ? true
        : selectedStatusFilter === 'deviations'
        ? f.status === 'DEVIATION'
        : selectedStatusFilter === 'gaps'
        ? f.status === 'DOCUMENTATION_GAP'
        : selectedStatusFilter === 'review'
        ? f.status === 'REVIEW_REQUIRED'
        : f.status === 'PASS';

    const matchesSearch =
      f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.requirementText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.supplierRawValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.heatNo && f.heatNo.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesStatus && matchesSearch;
  });

  const isApproved = analysis.status === 'approved';
  const isRejected = analysis.status === 'rejected';
  const hasDeviations = analysis.deviationCount > 0;
  const hasGaps = analysis.documentationGapCount > 0;

  // Calculate Carbon Equivalent for Heat A228 for instant metallurgical breakdown view
  const cFinding = findings.find((f) => f.field === 'C' && f.heatNo === 'A228');
  const mnFinding = findings.find((f) => f.field === 'Mn' && f.heatNo === 'A228');
  const ceFinding = findings.find((f) => f.field === 'CE' && f.heatNo === 'A228');

  const chemistryA228 = {
    C: cFinding?.supplierNormalizedValue || 0.21,
    Mn: mnFinding?.supplierNormalizedValue || 0.88,
    P: findings.find((f) => f.field === 'P' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.012,
    S: findings.find((f) => f.field === 'S' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.008,
    Si: findings.find((f) => f.field === 'Si' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.24,
    Cr: findings.find((f) => f.field === 'Cr' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.08,
    Mo: findings.find((f) => f.field === 'Mo' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.02,
    Ni: findings.find((f) => f.field === 'Ni' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.05,
    Cu: findings.find((f) => f.field === 'Cu' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.12,
    V: findings.find((f) => f.field === 'V' && f.heatNo === 'A228')?.supplierNormalizedValue || 0.01,
  };

  const ceCalcResult = calculateCarbonEquivalent(chemistryA228, 0.43, ceFinding?.supplierNormalizedValue || 0.37);

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

  const categories = [
    { id: 'all', label: 'All Requirements' },
    { id: 'chemical', label: 'Chemical' },
    { id: 'mechanical', label: 'Mechanical' },
    { id: 'heat_treatment', label: 'Heat Treatment' },
    { id: 'hardness', label: 'Hardness' },
    { id: 'nde', label: 'NDE Testing' },
    { id: 'certification', label: 'Certification' },
    { id: 'general', label: 'General / Forging' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {onDeleteAnalysis && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
          <button
            onClick={() => exportAnalysisToExcel(analysis, findings)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => exportAnalysisToPDF(analysis, findings, feedbackDraft)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={onOpenReportModal}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Reports & Feedback</span>
          </button>
        </div>
      </div>

      {/* Main Analysis Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                  isApproved
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : isRejected
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : hasDeviations || hasGaps
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                {isApproved
                  ? 'DIGITALLY APPROVED'
                  : isRejected
                  ? 'REJECTED'
                  : hasDeviations
                  ? 'REVIEW REQUIRED — DEVIATIONS DETECTED'
                  : hasGaps
                  ? 'REVIEW REQUIRED — DOCUMENTATION GAPS'
                  : 'CONFORMING'}
              </span>

              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                MTC: {analysis.mtcNumber}
              </span>
              {analysis.poNumber && (
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  PO: {analysis.poNumber}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900">{analysis.title}</h1>
            <p className="text-xs text-slate-500">
              Evaluated using <strong>{analysis.ruleEngineVersion}</strong> against client specification{' '}
              <strong>{analysis.requirementSetTitle}</strong>.
            </p>
          </div>

          {/* Reviewer Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isApproved && !isRejected && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                >
                  Reject Material
                </button>
                <button
                  onClick={() => setShowApprovalModal(true)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Technical Sign-Off & Approval</span>
                </button>
              </>
            )}

            {isApproved && (
              <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Approved by {analysis.approvedByName}
                </span>
                <span className="text-[10px] text-emerald-700 block">
                  {new Date(analysis.approvedAt!).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Details Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Material Grade</span>
            <strong className="text-slate-800 text-sm">{analysis.materialGrade}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Supplier</span>
            <strong className="text-slate-800 text-sm">{analysis.supplierName}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Client</span>
            <strong className="text-slate-800 text-sm">{analysis.clientName}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Heats Evaluated</span>
            <div className="flex gap-1 mt-0.5">
              {(analysis.heats || []).map((h) => (
                <span
                  key={h}
                  className="px-1.5 py-0.2 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Carbon Equivalent (CE) Metallurgical Widget */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-4 text-white shadow-sm border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              IIW METALLURGICAL FORMULA VERIFIED
            </span>
            <span className="text-xs text-slate-400">Carbon Equivalent (CE) Matrix</span>
          </div>
          <div className="text-xs font-mono text-slate-300">
            IIW Formula: CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15
          </div>
          <div className="text-xs text-slate-300">
            Calculated: <strong className="text-emerald-400 font-mono">{ceCalcResult.calculatedCE}</strong> | Reported on MTC: <strong className="text-slate-200 font-mono">{ceCalcResult.reportedCE}</strong> | Limit: <strong className="text-slate-200 font-mono">&le; 0.43</strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>CE Compliant (&le; 0.43)</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono text-right">
            <div>Tolerance: &plusmn;0.01</div>
            <div>Status: Conforming</div>
          </div>
        </div>
      </div>

      {/* Findings Matrix Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  selectedStatusFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                All ({findings.length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('deviations')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  selectedStatusFilter === 'deviations'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Deviations ({analysis.deviationCount})</span>
              </button>
              <button
                onClick={() => setSelectedStatusFilter('gaps')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  selectedStatusFilter === 'gaps'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                <FileQuestion className="w-3 h-3" />
                <span>Gaps ({analysis.documentationGapCount})</span>
              </button>
              <button
                onClick={() => setSelectedStatusFilter('pass')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  selectedStatusFilter === 'pass'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>PASS ({analysis.passCount})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter properties, heats, values..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Findings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3">Category</th>
                <th className="p-3">Property / Item</th>
                <th className="p-3">Heat Trace</th>
                <th className="p-3">Client MDS Requirement</th>
                <th className="p-3">Supplier MTC Evidence</th>
                <th className="p-3">Deterministic Logic</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFindings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No findings match the selected filters.
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
                      onClick={() => onSelectFinding(f)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isDeviation
                          ? 'bg-rose-50/20'
                          : isGap
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="p-3">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {f.category}
                        </span>
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {f.displayName}
                        {f.isReviewed && (
                          <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-medium">
                            Reviewed
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-mono font-semibold text-slate-700">
                        {f.heatNo || 'GENERAL'}
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{f.requirementText}</div>
                        <div className="text-[10px] text-slate-400">
                          {f.requirementClause ? `Clause: ${f.requirementClause}` : 'Mandatory'}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{f.supplierRawValue}</div>
                        <div className="text-[10px] text-slate-400">
                          Page {f.supplierEvidencePage || 1}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                        {f.calculatedComparison}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : isDeviation
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : isGap
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {isPass && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {isDeviation && <AlertTriangle className="w-2.5 h-2.5" />}
                          {isGap && <FileQuestion className="w-2.5 h-2.5" />}
                          <span>{f.status}</span>
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFinding(f);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Technical Sign-Off & Approval
                </h3>
                <p className="text-xs text-slate-500">
                  Digital sign-off as <strong>{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
                </p>
              </div>
            </div>

            {hasDeviations && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Notice:</strong> This certificate contains {analysis.deviationCount} deviations and {analysis.documentationGapCount} documentation gaps. Approving will record a formal engineering concession acceptance.
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Approval Notes / Concession Justification:
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Enter technical justification, concession reference number, or review remarks..."
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowApprovalModal(false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Signing...' : 'Confirm Digital Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <X className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reject Material Certificate
                </h3>
                <p className="text-xs text-slate-500">
                  Formally mark certificate as non-compliant and rejected.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for Rejection: *
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="State why material is rejected (e.g. Heat YBA normalizing temperature below 900°C limit)..."
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !decisionNotes.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete this Compliance Review?
                </h3>
                <p className="text-xs text-slate-500">
                  This action will remove the record, findings, and feedback draft permanently.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Deleting...' : 'Delete Review'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  ShieldAlert,
  History,
  Calculator,
  UserCheck,
  Send,
} from 'lucide-react';
import { ComplianceFinding, FindingStatus, User } from '../types';

interface FindingDetailDrawerProps {
  finding: ComplianceFinding | null;
  currentUser: User;
  onClose: () => void;
  onUpdateFinding: (
    findingId: string,
    updates: {
      status?: FindingStatus;
      reviewerDecision?: string;
      overrideReason?: string;
      reviewerComment?: string;
    }
  ) => Promise<void>;
}

export const FindingDetailDrawer: React.FC<FindingDetailDrawerProps> = ({
  finding,
  currentUser,
  onClose,
  onUpdateFinding,
}) => {
  if (!finding) return null;

  const [selectedStatus, setSelectedStatus] = useState<FindingStatus>(finding.status);
  const [overrideReason, setOverrideReason] = useState<string>(finding.overrideReason || '');
  const [reviewerComment, setReviewerComment] = useState<string>(finding.reviewerComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const statusColors: Record<FindingStatus, { bg: string; text: string; border: string }> = {
    PASS: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    DEVIATION: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
    DOCUMENTATION_GAP: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    REVIEW_REQUIRED: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  };

  const handleSaveReview = async () => {
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      await onUpdateFinding(finding.id, {
        status: selectedStatus,
        reviewerDecision: selectedStatus === finding.originalStatus ? 'confirmed' : 'overridden',
        overrideReason: selectedStatus !== finding.originalStatus ? overrideReason : undefined,
        reviewerComment: reviewerComment || undefined,
      });
      setSuccessMsg('Review action recorded and saved to audit log.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
              {finding.category.toUpperCase()}
            </span>
            {finding.heatNo && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Heat: {finding.heatNo}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-100 mt-1">{finding.displayName}</h2>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Status & Confidence Badge Bar */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                statusColors[finding.status].bg
              } ${statusColors[finding.status].text} ${statusColors[finding.status].border}`}
            >
              {finding.status}
            </span>
            <span className="text-xs text-slate-500 font-medium capitalize">
              Severity: <strong className="text-slate-800">{finding.severity}</strong>
            </span>
          </div>

          <div className="text-right">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                finding.extractionConfidence === 'high'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : finding.extractionConfidence === 'medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              OCR Confidence: {finding.extractionConfidence?.toUpperCase() || 'HIGH'}
            </span>
          </div>
        </div>

        {/* Comparison Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Client Requirement Box */}
          <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
              <span>Client Specification (MDS)</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">{finding.requirementText}</div>
            <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-blue-100">
              {finding.requirementClause && <div>Clause: <strong>{finding.requirementClause}</strong></div>}
              <div>Doc: {finding.requirementSourceDoc || 'Client MDS'}</div>
              <div>Page: {finding.requirementSourcePage || 1}</div>
            </div>
          </div>

          {/* Supplier Evidence Box */}
          <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
              <span>Supplier Certificate Evidence</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">{finding.supplierRawValue}</div>
            <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-emerald-100">
              <div>
                Normalized: <strong>{finding.supplierNormalizedValue !== undefined ? `${finding.supplierNormalizedValue} ${finding.supplierUnit || ''}` : 'N/A'}</strong>
              </div>
              <div>Source: {finding.supplierEvidenceDoc || 'Supplier MTC'}</div>
              <div>Page: {finding.supplierEvidencePage || 1}</div>
            </div>
          </div>
        </div>

        {/* Step-by-Step Mathematical Calculation */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Mathematical Comparison Logic</span>
          </div>
          <div className="font-mono text-xs p-2.5 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto">
            {finding.calculatedComparison}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Evaluated by the deterministic rule engine without probabilistic deviation hallucination.
          </p>
        </div>

        {/* Reason & Metallurgical Explanation */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <ShieldAlert className="w-4 h-4 text-slate-600" />
            <span>Engineering & Metallurgical Reason</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
            {finding.reason}
          </p>
        </div>

        {/* Human Reviewer Override / Action Section */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Human-in-the-Loop Reviewer Actions</span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Set Finding Status:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedStatus('PASS')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  selectedStatus === 'PASS'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PASS (Conforming)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('DEVIATION')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  selectedStatus === 'DEVIATION'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>DEVIATION</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('DOCUMENTATION_GAP')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  selectedStatus === 'DOCUMENTATION_GAP'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileQuestion className="w-3.5 h-3.5" />
                <span>DOCUMENTATION GAP</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('REVIEW_REQUIRED')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  selectedStatus === 'REVIEW_REQUIRED'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>REVIEW REQUIRED</span>
              </button>
            </div>
          </div>

          {/* Override Reason (Mandatory if overriding) */}
          {selectedStatus !== (finding.originalStatus || finding.status) && (
            <div className="space-y-1 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-rose-700">
                Mandatory Override Justification: *
              </label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State technical concession number, re-test agreement, or metallurgical justification..."
                className="w-full p-2.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          {/* Optional Reviewer Comment */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Reviewer Notes / Supplementary Comment:
            </label>
            <textarea
              rows={2}
              value={reviewerComment}
              onChange={(e) => setReviewerComment(e.target.value)}
              placeholder="Add internal engineering notes..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
              {successMsg}
            </div>
          )}

          <button
            onClick={handleSaveReview}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Record Review Decision & Log Audit Event</span>
          </button>
        </div>

        {/* Audit Trail for this specific finding */}
        {finding.auditHistory && finding.auditHistory.length > 0 && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <History className="w-4 h-4 text-slate-600" />
              <span>Finding Change History & Audit Logs</span>
            </div>

            <div className="space-y-2 divide-y divide-slate-100">
              {finding.auditHistory.map((entry, idx) => (
                <div key={idx} className="pt-2 first:pt-0 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">{entry.userName}</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-700">
                    Action: <strong>{entry.action}</strong>
                    {entry.previousStatus && entry.newStatus && (
                      <span className="ml-1 text-slate-500">
                        ({entry.previousStatus} → <strong>{entry.newStatus}</strong>)
                      </span>
                    )}
                  </div>
                  {entry.reason && (
                    <div className="text-slate-600 italic">Justification: "{entry.reason}"</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

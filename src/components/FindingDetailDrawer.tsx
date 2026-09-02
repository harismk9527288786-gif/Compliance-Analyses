import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
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
  currentUser: _currentUser,
  onClose,
  onUpdateFinding,
}) => {
  if (!finding) return null;

  const [selectedStatus, setSelectedStatus] = useState<FindingStatus>(finding.status);
  const [overrideReason, setOverrideReason] = useState<string>(finding.overrideReason || '');
  const [reviewerComment, setReviewerComment] = useState<string>(finding.reviewerComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (finding) {
      setSelectedStatus(finding.status);
      setOverrideReason(finding.overrideReason || '');
      setReviewerComment(finding.reviewerComment || '');
      setSuccessMsg(null);
    }
  }, [finding?.id, finding?.status]);

  // Escape key close handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      setSuccessMsg('Review action recorded and committed to audit log.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPass = finding.status === 'PASS';
  const isDeviation = finding.status === 'DEVIATION';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 text-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-bold">
              {finding.category.toUpperCase()}
            </span>
            {finding.heatNo && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                Ladle Heat: #{finding.heatNo}
              </span>
            )}
          </div>
          <h2 id="drawer-title" className="text-base font-bold text-white mt-1">
            {finding.displayName}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <X className="w-5 h-5" aria-hidden="true" />
          <span className="sr-only">Close finding drawer</span>
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status & Confidence Badge Bar (Icon + Label + Color) */}
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            {isPass ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>PASS</span>
              </span>
            ) : isDeviation ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>DEVIATION</span>
              </span>
            ) : finding.status === 'REVIEW_REQUIRED' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>REVIEW REQUIRED</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                <FileQuestion className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>DOCUMENTATION GAP</span>
              </span>
            )}

            <span className="text-xs text-slate-600 font-medium capitalize">
              Severity: <strong className="text-slate-900">{finding.severity}</strong>
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border font-mono bg-slate-100 text-slate-700 border-slate-300">
              Confidence: {finding.confidence?.toUpperCase() || 'HIGH'}
            </span>
          </div>
        </div>

        {/* Comparison Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Client Requirement Box */}
          <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50 space-y-2">
            <div className="text-slate-900 font-bold text-xs font-mono uppercase tracking-wider">
              Client Specification (MDS)
            </div>
            <div className="text-sm font-semibold text-slate-900">{finding.requirementText}</div>
            <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200 font-mono">
              {finding.requirementClause && <div>Clause: <strong>{finding.requirementClause}</strong></div>}
              <div>Doc: {finding.requirementSourceDoc || 'Client MDS'}</div>
              <div>Page: {finding.requirementSourcePage || 1}</div>
            </div>
          </div>

          {/* Supplier Evidence Box */}
          <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50 space-y-2">
            <div className="text-slate-900 font-bold text-xs font-mono uppercase tracking-wider">
              Supplier Certificate Evidence
            </div>
            <div className="text-sm font-semibold text-slate-900">{finding.supplierRawValue}</div>
            <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200 font-mono">
              <div>
                Normalized: <strong>{finding.supplierNormalizedValue !== undefined ? `${finding.supplierNormalizedValue} ${finding.supplierUnit || ''}` : 'N/A'}</strong>
              </div>
              <div>Source: {finding.supplierEvidenceDoc || 'Supplier MTC'}</div>
              <div>Page: {finding.supplierEvidencePage || 1}</div>
            </div>
          </div>
        </div>

        {/* Mathematical Comparison Logic */}
        <div className="p-4 rounded-lg border border-slate-300 bg-white space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Calculator className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <span>Mathematical Comparison Logic</span>
          </div>
          <div className="font-mono text-xs p-2.5 bg-slate-900 text-emerald-300 rounded border border-slate-800 overflow-x-auto">
            {finding.calculatedComparison}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Evaluated by the deterministic compliance rule engine.
          </p>
        </div>

        {/* Reason & Metallurgical Explanation */}
        <div className="p-4 rounded-lg border border-slate-300 bg-white space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <ShieldAlert className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <span>Engineering Finding Details</span>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200 font-medium">
            {finding.reason}
          </p>
        </div>

        {/* Human Reviewer Override / Action Section */}
        <div className="p-4 rounded-lg border border-slate-300 bg-slate-50 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <UserCheck className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <span>Human-in-the-Loop QC Sign-Off & Override</span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Set Finding Status:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedStatus('PASS')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  selectedStatus === 'PASS'
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>PASS</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('DEVIATION')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
                  selectedStatus === 'DEVIATION'
                    ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>DEVIATION</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('DOCUMENTATION_GAP')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
                  selectedStatus === 'DOCUMENTATION_GAP'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileQuestion className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>GAP</span>
              </button>
            </div>
          </div>

          {/* Override Reason (Mandatory if overriding) */}
          {selectedStatus !== (finding.originalStatus || finding.status) && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-rose-800">
                Override Justification (Required): *
              </label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State technical concession number, re-test agreement, or metallurgical justification..."
                className="w-full p-2.5 text-xs bg-white border border-rose-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-600 text-slate-900"
              />
            </div>
          )}

          {/* Optional Reviewer Comment */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              QC Engineer Notes:
            </label>
            <textarea
              rows={2}
              value={reviewerComment}
              onChange={(e) => setReviewerComment(e.target.value)}
              placeholder="Add internal quality assurance notes..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
            />
          </div>

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-semibold">
              {successMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveReview}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Commit Review Decision to Audit Trail</span>
          </button>
        </div>

        {/* Immutable Audit Trail for this specific finding */}
        {finding.auditHistory && finding.auditHistory.length > 0 && (
          <div className="p-4 rounded-lg border border-slate-300 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <History className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <span>Immutable Finding History</span>
            </div>

            <div className="space-y-2 divide-y divide-slate-200">
              {finding.auditHistory.map((entry, idx) => (
                <div key={idx} className="pt-2 first:pt-0 text-[11px] space-y-1 font-mono">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-bold text-slate-900">{entry.userName}</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-800">
                    Action: <strong>{entry.action}</strong>
                    {entry.previousStatus && entry.newStatus && (
                      <span className="ml-1 text-slate-600">
                        ({entry.previousStatus} &rarr; <strong>{entry.newStatus}</strong>)
                      </span>
                    )}
                  </div>
                  {entry.reason && (
                    <div className="text-slate-700 italic font-sans">Justification: "{entry.reason}"</div>
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

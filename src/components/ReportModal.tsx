import React, { useState } from 'react';
import {
  X,
  FileText,
  Mail,
  Download,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  Sparkles,
  Edit3,
  Save,
  FileSpreadsheet,
} from 'lucide-react';
import { AnalysisRecord, ComplianceFinding, ExternalFeedbackDraft, User } from '../types';
import { exportAnalysisToExcel, exportAnalysisToPDF } from '../utils/exportUtils';

interface ReportModalProps {
  analysis: AnalysisRecord;
  findings: ComplianceFinding[];
  feedbackDraft?: ExternalFeedbackDraft;
  currentUser: User;
  onClose: () => void;
  onSaveFeedbackDraft?: (draft: ExternalFeedbackDraft) => Promise<void>;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  analysis,
  findings,
  feedbackDraft: initialFeedbackDraft,
  currentUser,
  onClose,
  onSaveFeedbackDraft,
}) => {
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
  const [copied, setCopied] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);

  // Local draft state
  const [draft, setDraft] = useState<ExternalFeedbackDraft>(
    initialFeedbackDraft || {
      id: `feedback-${analysis.id}`,
      analysisId: analysis.id,
      title: `Material Certificate Review & Technical Clarification: ${analysis.mtcNumber}`,
      overallStatus: analysis.deviationCount > 0 ? 'REVIEW REQUIRED' : 'COMPLIANT',
      salutation: `Dear ${analysis.supplierName} Quality Directorate,`,
      openingStatement: `The submitted Material Test Certificate (${analysis.mtcNumber}) for PO ${analysis.poNumber || 'N/A'} has been analyzed against client specification ${analysis.requirementSetTitle}.`,
      conformingSummary: `Chemical composition and primary tensile/yield mechanical properties have been verified against applicable ASTM/NACE thresholds.`,
      clarificationPoints: findings
        .filter((f) => f.status === 'DEVIATION' || f.status === 'DOCUMENTATION_GAP')
        .map((f, i) => ({
          id: `pt-${i + 1}`,
          itemNumber: i + 1,
          findingId: f.id,
          title: `${f.displayName} (${f.heatNo || 'General'})`,
          description:
            f.status === 'DEVIATION'
              ? `Reported value "${f.supplierRawValue}" deviates from specified requirement "${f.requirementText}". Reason: ${f.reason}`
              : `The client specification requires "${f.displayName}" (${f.requirementClause || 'Mandatory'}), which was not identified in the submitted certificate.`,
          actionRequired:
            f.status === 'DEVIATION'
              ? 'Please submit corrective technical concession justification or re-test records.'
              : 'Please attach formal supplementary examination test certificates.',
        })),
      closingStatement:
        'Please provide written clarification and supporting documentation for the above points to enable final material acceptance.',
      status: 'draft',
    }
  );

  const handleCopyExternalText = () => {
    const fullText = `${draft.title}

${draft.salutation}

${draft.openingStatement}

CONFORMING PROPERTIES:
${draft.conformingSummary}

POINTS FOR TECHNICAL CLARIFICATION / ACTION:
${draft.clarificationPoints
  .map(
    (pt) =>
      `${pt.itemNumber}. ${pt.title}
   - Description: ${pt.description}
   - Required Action: ${pt.actionRequired}`
  )
  .join('\n\n')}

${draft.closingStatement}

Best regards,
Quality Assurance & Metallurgical Engineering
Apex Valve & Flow Engineering Ltd.`;

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (onSaveFeedbackDraft) {
      await onSaveFeedbackDraft(draft);
    }
    setIsEditingDraft(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Compliance Review Reports & Feedback
              </h2>
              <p className="text-xs text-slate-400">
                MTC: {analysis.mtcNumber} | {analysis.materialGrade}
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('internal')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'internal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Internal Technical Report</span>
            </button>

            <button
              onClick={() => setActiveTab('external')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'external'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Supplier / Customer Feedback Draft</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {activeTab === 'internal' ? (
            /* Tab 1: Internal Technical Report */
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6 text-slate-900">
              {/* Report Header */}
              <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                    INTERNAL QUALITY ENGINEERING REVIEW
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{analysis.title}</h3>
                  <p className="text-xs text-slate-500">
                    Engine Version: {analysis.ruleEngineVersion} | AI Extraction Grounding: {analysis.aiModelUsed}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportAnalysisToExcel(analysis, findings)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export XLSX</span>
                  </button>
                  <button
                    onClick={() => exportAnalysisToPDF(analysis, findings, draft)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">SUPPLIER</span>
                  <strong className="text-slate-900">{analysis.supplierName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">MTC NUMBER</span>
                  <strong className="text-slate-900 font-mono">{analysis.mtcNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">MATERIAL GRADE</span>
                  <strong className="text-slate-900">{analysis.materialGrade}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CLIENT SPEC</span>
                  <strong className="text-slate-900 truncate block">{analysis.requirementSetTitle}</strong>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">
                    COMPLIANCE DISPOSITION
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    {analysis.finalStatus || (analysis.deviationCount > 0 ? 'REVIEW REQUIRED' : 'COMPLIANT')}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-emerald-300">{analysis.passCount} PASS</span>
                  <span className="text-rose-300">{analysis.deviationCount} DEVIATIONS</span>
                  <span className="text-amber-300">{analysis.documentationGapCount} GAPS</span>
                  <span className="text-blue-300">{analysis.reviewRequiredCount} REVIEW REQ</span>
                </div>
              </div>

              {/* Complete Findings Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Comprehensive Clause Findings Matrix
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Property</th>
                        <th className="p-2.5">Heat</th>
                        <th className="p-2.5">Client MDS</th>
                        <th className="p-2.5">Supplier MTC</th>
                        <th className="p-2.5">Calculation / Logic</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      {findings.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="p-2.5 uppercase text-[10px] font-mono text-slate-500">
                            {f.category}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900">{f.displayName}</td>
                          <td className="p-2.5 font-mono text-slate-600">{f.heatNo || 'GEN'}</td>
                          <td className="p-2.5 text-slate-700">{f.requirementText}</td>
                          <td className="p-2.5 text-slate-900 font-medium">{f.supplierRawValue}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">
                            {f.calculatedComparison}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                f.status === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : f.status === 'DEVIATION'
                                  ? 'bg-rose-100 text-rose-800'
                                  : f.status === 'DOCUMENTATION_GAP'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {f.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Digital Reviewer Sign-off Box */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Technical Reviewer Digital Endorsement</span>
                  </div>
                  <p className="text-xs text-emerald-900 mt-1">
                    Reviewed by: <strong>{analysis.approvedByName || analysis.createdByName}</strong>
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Timestamp: {new Date(analysis.approvedAt || analysis.createdAt).toLocaleString()}
                  </p>
                  {analysis.approvalNotes && (
                    <p className="text-xs text-emerald-900 italic mt-1 bg-white/70 p-2 rounded border border-emerald-200">
                      "{analysis.approvalNotes}"
                    </p>
                  )}
                </div>

                <div className="text-right text-[10px] text-emerald-800 font-mono">
                  <div>SHA-256 Verified</div>
                  <div>Audit Trail Recorded</div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: External Supplier Feedback Draft */
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 font-bold">
                    SUPPLIER CLARIFICATION COMMUNICATION
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Formal Clarification Request Letter
                  </h3>
                  <p className="text-xs text-slate-500">
                    Structured technical letter citing specific heat numbers, deviations, and required actions.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isEditingDraft ? (
                    <button
                      onClick={handleSaveDraft}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Draft</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditingDraft(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Letter</span>
                    </button>
                  )}

                  <button
                    onClick={handleCopyExternalText}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                </div>
              </div>

              {/* Editable Letter Body */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs text-slate-800 leading-relaxed font-sans">
                {isEditingDraft ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">Subject Line:</label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">Salutation:</label>
                      <input
                        type="text"
                        value={draft.salutation}
                        onChange={(e) => setDraft({ ...draft, salutation: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">Opening Statement:</label>
                      <textarea
                        rows={2}
                        value={draft.openingStatement}
                        onChange={(e) => setDraft({ ...draft, openingStatement: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">Conforming Summary:</label>
                      <textarea
                        rows={2}
                        value={draft.conformingSummary}
                        onChange={(e) => setDraft({ ...draft, conformingSummary: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-bold text-slate-900 border-b border-slate-200 pb-2">
                      RE: {draft.title}
                    </div>
                    <div>{draft.salutation}</div>
                    <div>{draft.openingStatement}</div>
                    <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 text-emerald-950">
                      <strong>Conforming Properties:</strong> {draft.conformingSummary}
                    </div>
                  </>
                )}

                {/* Structured Clarification Points */}
                <div className="space-y-3 pt-2">
                  <div className="font-bold text-slate-900">
                    Points Requiring Technical Clarification or Action:
                  </div>

                  {draft.clarificationPoints.map((pt, idx) => (
                    <div
                      key={pt.id || idx}
                      className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/30 space-y-1.5"
                    >
                      <div className="font-bold text-rose-900 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 text-[10px] flex items-center justify-center font-bold">
                          {pt.itemNumber}
                        </span>
                        <span>{pt.title}</span>
                      </div>
                      <div className="text-slate-700 pl-7">{pt.description}</div>
                      <div className="text-rose-900 font-semibold pl-7 flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] uppercase tracking-wider bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                          Action Required:
                        </span>
                        <span>{pt.actionRequired}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {isEditingDraft ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">Closing Statement:</label>
                    <textarea
                      rows={2}
                      value={draft.closingStatement}
                      onChange={(e) => setDraft({ ...draft, closingStatement: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                ) : (
                  <div className="pt-2">{draft.closingStatement}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Document Reference: <strong className="font-mono">{analysis.mtcNumber}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
          >
            Close Report Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

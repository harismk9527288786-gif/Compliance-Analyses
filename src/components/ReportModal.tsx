import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Mail,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Edit3,
  Save,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  Plus,
  Trash2,
  RotateCcw,
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
  onClose,
  onSaveFeedbackDraft,
}) => {
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
  const [copied, setCopied] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Local draft state
  const [draft, setDraft] = useState<ExternalFeedbackDraft>(
    initialFeedbackDraft || {
      id: `feedback-${analysis.id}`,
      analysisId: analysis.id,
      title: `Material Certificate Review & Technical Clarification: ${analysis.mtcNumber}`,
      overallStatus: analysis.deviationCount > 0 ? 'DEVIATIONS DETECTED' : 'COMPLIANT',
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

  const [draftBackup, setDraftBackup] = useState<ExternalFeedbackDraft>(draft);

  useEffect(() => {
    if (initialFeedbackDraft) {
      setDraft(initialFeedbackDraft);
      setDraftBackup(initialFeedbackDraft);
    }
  }, [initialFeedbackDraft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const generateFullText = () => {
    return `${draft.title}

${draft.salutation}

${draft.openingStatement}

CONFORMING PROPERTIES:
${draft.conformingSummary}

POINTS FOR TECHNICAL CLARIFICATION / ACTION:
${draft.clarificationPoints
  .map(
    (pt, idx) =>
      `${idx + 1}. ${pt.title}
   - Description: ${pt.description}
   - Required Action: ${pt.actionRequired}`
  )
  .join('\n\n')}

${draft.closingStatement}

Best regards,
Quality Assurance & Metallurgical Engineering
Apex Valve & Flow Engineering Ltd.`;
  };

  const handleCopyExternalText = () => {
    const fullText = generateFullText();
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLetterTxt = () => {
    const fullText = generateFullText();
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clarification_Letter_${analysis.mtcNumber}_${analysis.supplierName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartEdit = () => {
    setDraftBackup(JSON.parse(JSON.stringify(draft)));
    setIsEditingDraft(true);
    setSaveSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setDraft(JSON.parse(JSON.stringify(draftBackup)));
    setIsEditingDraft(false);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      if (onSaveFeedbackDraft) {
        await onSaveFeedbackDraft(draft);
      }
      setDraftBackup(JSON.parse(JSON.stringify(draft)));
      setIsEditingDraft(false);
      setSaveSuccessMsg('Clarification draft saved successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (e) {
      console.error('Failed to save draft:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddClarificationPoint = () => {
    const newIndex = draft.clarificationPoints.length + 1;
    const newPoint = {
      id: `custom-pt-${Date.now()}`,
      itemNumber: newIndex,
      title: 'Additional Technical Clarification Item',
      description: 'Please describe the observed condition or request specification clarification.',
      actionRequired: 'Provide supporting test evidence or formal supplier concession response.',
    };
    setDraft((prev) => ({
      ...prev,
      clarificationPoints: [...prev.clarificationPoints, newPoint],
    }));
  };

  const handleRemoveClarificationPoint = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      clarificationPoints: prev.clarificationPoints
        .filter((pt) => pt.id !== id)
        .map((pt, idx) => ({ ...pt, itemNumber: idx + 1 })),
    }));
  };

  const handleUpdateClarificationPoint = (
    id: string,
    field: 'title' | 'description' | 'actionRequired',
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      clarificationPoints: prev.clarificationPoints.map((pt) =>
        pt.id === id ? { ...pt, [field]: value } : pt
      ),
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-slate-100 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-base font-bold text-white">
                Compliance Review Reports & Feedback
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                MTC: {analysis.mtcNumber} | {analysis.materialGrade}
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div role="tablist" className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'internal'}
              onClick={() => setActiveTab('internal')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'internal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Internal Technical Report</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'external'}
              onClick={() => setActiveTab('external')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'external'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Supplier Draft</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-100/50">
          {activeTab === 'internal' ? (
            /* Tab 1: Internal Technical Report */
            <div className="bg-white rounded-xl p-6 border border-slate-300 shadow-xs space-y-5 text-slate-900">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-300">
                    INTERNAL QUALITY ENGINEERING REVIEW
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{analysis.title}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Engine Version: {analysis.ruleEngineVersion} | EN 10204 3.1 Traceable
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportAnalysisToExcel(analysis, findings)}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 cursor-pointer transition-colors border border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Export XLSX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportAnalysisToPDF(analysis, findings, draft)}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors border border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">SUPPLIER</span>
                  <strong className="text-slate-900 font-sans">{analysis.supplierName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">MTC NUMBER</span>
                  <strong className="text-slate-900">{analysis.mtcNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">MATERIAL GRADE</span>
                  <strong className="text-slate-900 font-sans">{analysis.materialGrade}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">CLIENT SPEC</span>
                  <strong className="text-slate-900 truncate block font-sans">{analysis.requirementSetTitle}</strong>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-lg bg-slate-900 text-white flex items-center justify-between border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                    COMPLIANCE DISPOSITION
                  </div>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    {analysis.finalStatus || (analysis.deviationCount > 0 ? 'DEVIATIONS DETECTED' : 'COMPLIANT')}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono font-bold">
                  <span className="text-emerald-400">{analysis.passCount} PASS</span>
                  <span className="text-rose-400">{analysis.deviationCount} DEVIATIONS</span>
                  <span className="text-amber-400">{analysis.documentationGapCount} GAPS</span>
                </div>
              </div>

              {/* Complete Findings Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
                  Comprehensive Clause Findings Matrix
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table role="table" className="w-full text-left text-xs border-collapse min-w-[640px]">
                    <caption className="sr-only">Comprehensive findings matrix for this technical review</caption>
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase">
                        <th scope="col" className="py-2.5 px-3">Category</th>
                        <th scope="col" className="py-2.5 px-3">Property</th>
                        <th scope="col" className="py-2.5 px-3">Heat</th>
                        <th scope="col" className="py-2.5 px-3">Client MDS Limit</th>
                        <th scope="col" className="py-2.5 px-3">Supplier Value</th>
                        <th scope="col" className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-normal">
                      {findings.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 uppercase text-[10px] font-mono text-slate-600">
                            {f.category}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{f.displayName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{f.heatNo || 'GEN'}</td>
                          <td className="py-2.5 px-3 text-slate-700">{f.requirementText}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{f.supplierRawValue}</td>
                          <td className="py-2.5 px-3">
                            {f.status === 'PASS' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                                <span>PASS</span>
                              </span>
                            ) : f.status === 'DEVIATION' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                <AlertTriangle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                                <span>DEVIATION</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <FileQuestion className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                                <span>GAP</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: External Supplier Feedback Draft */
            <div className="bg-white rounded-xl p-6 border border-slate-300 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-300">
                    SUPPLIER CLARIFICATION COMMUNICATION
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Formal Clarification Request Letter
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Structured technical letter citing specific heat numbers and non-conformance clauses.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isEditingDraft ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                        <span>Cancel</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={isSaving}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors border border-emerald-400/50 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                        <span>Edit Letter</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadLetterTxt}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors border border-blue-600"
                        title="Download clarification letter as text file"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download (.txt)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyExternalText}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Draft Content: Interactive Form in Edit Mode vs Formatted Text in View Mode */}
              {isEditingDraft ? (
                <div className="p-5 bg-slate-50 rounded-lg border border-slate-300 text-xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Document Subject / Title:
                      </label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Recipient Salutation:
                      </label>
                      <input
                        type="text"
                        value={draft.salutation}
                        onChange={(e) => setDraft({ ...draft, salutation: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Opening Statement:
                    </label>
                    <textarea
                      rows={2}
                      value={draft.openingStatement}
                      onChange={(e) => setDraft({ ...draft, openingStatement: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 leading-relaxed font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Conforming Properties Summary:
                    </label>
                    <textarea
                      rows={2}
                      value={draft.conformingSummary}
                      onChange={(e) => setDraft({ ...draft, conformingSummary: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 leading-relaxed font-sans"
                    />
                  </div>

                  {/* Clarification Points List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-rose-800 font-mono">
                        Points for Technical Clarification ({draft.clarificationPoints.length})
                      </label>
                      <button
                        type="button"
                        onClick={handleAddClarificationPoint}
                        className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add Item</span>
                      </button>
                    </div>

                    {draft.clarificationPoints.map((pt) => (
                      <div key={pt.id} className="p-3.5 bg-white rounded-lg border border-rose-200 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={pt.title}
                            onChange={(e) => handleUpdateClarificationPoint(pt.id, 'title', e.target.value)}
                            placeholder="Item Title (e.g. Tensile Elongation Deviation)"
                            className="w-full p-1.5 text-xs font-bold text-rose-900 bg-rose-50/50 border border-rose-200 rounded focus:outline-none focus:ring-1 focus:ring-rose-600"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveClarificationPoint(pt.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Remove clarification point"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            <span className="sr-only">Remove item</span>
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                            Description & Metallurgical Background:
                          </label>
                          <textarea
                            rows={2}
                            value={pt.description}
                            onChange={(e) => handleUpdateClarificationPoint(pt.id, 'description', e.target.value)}
                            className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-rose-800 mb-0.5">
                            Required Action / Response:
                          </label>
                          <textarea
                            rows={1}
                            value={pt.actionRequired}
                            onChange={(e) => handleUpdateClarificationPoint(pt.id, 'actionRequired', e.target.value)}
                            className="w-full p-1.5 text-xs bg-rose-50/30 border border-rose-200 rounded text-rose-900 font-medium focus:outline-none focus:ring-1 focus:ring-rose-600"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Closing Statement & Sign-Off Instructions:
                    </label>
                    <textarea
                      rows={2}
                      value={draft.closingStatement}
                      onChange={(e) => setDraft({ ...draft, closingStatement: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 leading-relaxed font-sans"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 rounded-lg border border-slate-300 font-mono text-xs space-y-4 text-slate-800">
                  <div>
                    <strong className="block text-slate-900 font-sans">{draft.title}</strong>
                    <div className="text-slate-500 mt-1">{draft.salutation}</div>
                  </div>

                  <div className="leading-relaxed">{draft.openingStatement}</div>

                  <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 uppercase text-[11px]">CONFORMING PROPERTIES:</div>
                    <div className="text-slate-600 font-sans">{draft.conformingSummary}</div>
                  </div>

                  {draft.clarificationPoints.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-bold text-rose-800 uppercase text-[11px]">
                        POINTS FOR TECHNICAL CLARIFICATION / ACTION:
                      </div>
                      {draft.clarificationPoints.map((pt) => (
                        <div key={pt.id} className="p-3 bg-rose-50/50 rounded border border-rose-200 space-y-1">
                          <div className="font-bold text-rose-900">
                            {pt.itemNumber}. {pt.title}
                          </div>
                          <div className="text-slate-700 font-sans text-xs">{pt.description}</div>
                          <div className="text-rose-800 font-bold text-xs pt-1">
                            Required Action: {pt.actionRequired}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="leading-relaxed text-slate-600">{draft.closingStatement}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

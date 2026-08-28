import React, { useState } from 'react';
import {
  Upload,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
  FileText,
  Cpu,
  Layers,
} from 'lucide-react';
import { RequirementSet, User } from '../types';
import { apiFetch, formatErrorMessage } from '../utils/api';
import { extractTextFromPdfClient } from '../utils/clientPdfParser';

interface NewComparisonProps {
  requirementSets: RequirementSet[];
  currentUser: User;
  onAnalysisCreated: (analysisId: string) => void;
  onCancel: () => void;
  initialRequirementSetId?: string;
}

export const NewComparison: React.FC<NewComparisonProps> = ({
  requirementSets,
  currentUser,
  onAnalysisCreated,
  onCancel,
  initialRequirementSetId,
}) => {
  const [mtcFile, setMtcFile] = useState<File | null>(null);
  const [mdsFile, setMdsFile] = useState<File | null>(null);
  const [selectedReqSetId, setSelectedReqSetId] = useState<string>(
    initialRequirementSetId || requirementSets[0]?.id || ''
  );
  const [mdsSourceMode, setMdsSourceMode] = useState<'library' | 'upload'>(
    initialRequirementSetId ? 'library' : 'upload'
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepText, setCurrentStepText] = useState<string>('Initializing verification engine...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processingSteps = [
    'Parsing MTC document structure and identifying ladle heats...',
    'Extracting chemical, tensile, hardness, and heat-treatment tables...',
    'Evaluating against client MDS engineering limits and clauses...',
    'Compiling deterministic compliance verification record...',
  ];

  const handleMtcDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setMtcFile(e.dataTransfer.files[0]);
    }
  };

  const handleMdsDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setMdsFile(e.dataTransfer.files[0]);
      setMdsSourceMode('upload');
    }
  };

  const handleRunComparison = async (usePilotFixture = false) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setCurrentStepText(processingSteps[0]);

    try {
      let stepIdx = 0;
      const stepInterval = setInterval(() => {
        stepIdx = (stepIdx + 1) % processingSteps.length;
        setCurrentStepText(processingSteps[stepIdx]);
      }, 800);

      let mtcDocId: string | undefined;
      let mdsDocId: string | undefined;

      if (!usePilotFixture && mtcFile) {
        const formData = new FormData();
        formData.append('file', mtcFile);
        formData.append('type', 'mtc');
        formData.append('userId', currentUser.id);

        try {
          const clientText = await extractTextFromPdfClient(mtcFile);
          if (clientText && clientText.length > 30) {
            formData.append('extractedText', clientText);
          }
        } catch (e) {
          console.warn('Client-side MTC extraction notice:', e);
        }

        const uploadRes = await apiFetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(formatErrorMessage(err.error || err, 'Certificate extraction could not process uploaded document.'));
        }
        const data = await uploadRes.json();
        mtcDocId = data.document.id;
      }

      if (!usePilotFixture && mdsSourceMode === 'upload' && mdsFile) {
        const formData = new FormData();
        formData.append('file', mdsFile);
        formData.append('type', 'mds');
        formData.append('userId', currentUser.id);

        try {
          const clientText = await extractTextFromPdfClient(mdsFile);
          if (clientText && clientText.length > 30) {
            formData.append('extractedText', clientText);
          }
        } catch (e) {
          console.warn('Client-side MDS extraction notice:', e);
        }

        const uploadRes = await apiFetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(formatErrorMessage(err.error || err, 'Failed to extract requirements from uploaded Material Data Sheet.'));
        }
        const data = await uploadRes.json();
        mdsDocId = data.document.id;
      }

      const payload: any = {
        userId: currentUser.id,
      };

      if (usePilotFixture) {
        payload.requirementSetId = 'reqset-hawa-a105n-rev-a';
        payload.title = 'Pilot Verification: Western Forge MTC WW2606229-3 vs Hawa Valves MDS Rev A';
      } else {
        if (mtcDocId) payload.mtcDocumentId = mtcDocId;
        if (mdsSourceMode === 'library') {
          payload.requirementSetId = selectedReqSetId;
        } else if (mdsDocId) {
          payload.mdsDocumentId = mdsDocId;
        }
      }

      const analysisRes = await apiFetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(stepInterval);

      if (!analysisRes.ok) {
        const err = await analysisRes.json();
        throw new Error(formatErrorMessage(err.error || err, 'Verification engine encountered a processing error.'));
      }

      const result = await analysisRes.json();
      onAnalysisCreated(result.analysis.id);
    } catch (e: any) {
      setIsProcessing(false);
      setErrorMsg(formatErrorMessage(e, 'Verification could not proceed due to an unexpected parsing error.'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-300 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Verify Material Test Certificate</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic cross-reference of Supplier MTC (EN 10204 3.1) with Client MDS engineering limits.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <X className="w-5 h-5" aria-hidden="true" />
          <span className="sr-only">Cancel</span>
        </button>
      </div>

      {/* Benchmark Fixture Card (Industrial, high contrast, no purple gradients) */}
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-700 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Load Benchmark Test Suite (ASTM A105N)</div>
            <div className="text-[11px] text-slate-400 font-mono">
              Western Forge MTC #WW2606229-3 vs Hawa Valves MDS (2 Heats: A228, YBA)
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => handleRunComparison(true)}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0 cursor-pointer disabled:opacity-50 border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Load Benchmark MTC
        </button>
      </div>

      {/* Purpose-Built Domain Error Message */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-bold">Extraction / Verification Notice</div>
            <div className="mt-0.5">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-white rounded-xl p-6 border border-emerald-300 shadow-xs text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-700 animate-spin mx-auto" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Evaluating Certificate</h3>
          <p className="text-xs text-slate-600 font-mono">{currentStepText}</p>
        </div>
      )}

      {/* 2-Step Setup */}
      {!isProcessing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Step 1: Upload MTC */}
          <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono font-bold">
                  1
                </span>
                <span>Supplier MTC Certificate (EN 10204 3.1)</span>
              </div>
              <p className="text-[11px] text-slate-500">PDF or text certificate file</p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleMtcDrop}
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors flex flex-col items-center justify-center min-h-[140px] ${
                mtcFile
                  ? 'border-emerald-600 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              {mtcFile ? (
                <div className="space-y-1.5">
                  <FileCheck2 className="w-6 h-6 text-emerald-700 mx-auto" aria-hidden="true" />
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                    {mtcFile.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {(mtcFile.size / 1024).toFixed(1)} KB
                  </div>
                  <button
                    type="button"
                    onClick={() => setMtcFile(null)}
                    className="text-[11px] text-rose-700 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
                  <div className="text-xs font-semibold text-slate-700">Drag & drop Supplier MTC PDF</div>
                  <label className="inline-block px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer shadow-2xs">
                    Browse File
                    <input
                      type="file"
                      accept=".pdf,.txt,.json"
                      className="hidden"
                      onChange={(e) => e.target.files && setMtcFile(e.target.files[0])}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              *If omitted, the pre-loaded Western Forge MTC is analyzed.
            </div>
          </div>

          {/* Step 2: Select Specification */}
          <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono font-bold">
                    2
                  </span>
                  <span>Client MDS Specification</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMdsSourceMode(mdsSourceMode === 'library' ? 'upload' : 'library')}
                  className="text-[11px] text-blue-700 hover:text-blue-800 font-bold cursor-pointer"
                >
                  {mdsSourceMode === 'library' ? 'Upload Custom' : 'Use Library'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">Material Data Sheet rule set</p>
            </div>

            {mdsSourceMode === 'library' ? (
              <div className="space-y-2.5">
                <select
                  value={selectedReqSetId}
                  onChange={(e) => setSelectedReqSetId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
                >
                  {requirementSets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.clientName} &mdash; {set.materialGrade} ({set.revision})
                    </option>
                  ))}
                </select>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900">
                    {requirementSets.find((s) => s.id === selectedReqSetId)?.title || 'Standard Spec'}
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    Deterministic verification of chemical, tensile, hardness & NDE rules.
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleMdsDrop}
                className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center flex flex-col items-center justify-center min-h-[140px]"
              >
                {mdsFile ? (
                  <div className="space-y-1">
                    <FileText className="w-6 h-6 text-blue-700 mx-auto" aria-hidden="true" />
                    <div className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                      {mdsFile.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMdsFile(null)}
                      className="text-[11px] text-rose-700 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      Change File
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer text-xs text-slate-700 hover:text-slate-900">
                    <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" aria-hidden="true" />
                    <span className="font-semibold">Upload Custom MDS PDF</span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.json"
                      className="hidden"
                      onChange={(e) => e.target.files && setMdsFile(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-500 font-mono">
              Deterministic rule evaluation.
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      {!isProcessing && (
        <div className="bg-white rounded-xl p-4 border border-slate-300 shadow-xs flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleRunComparison(false)}
            className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-xs transition-colors cursor-pointer border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span>Execute Compliance Check</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

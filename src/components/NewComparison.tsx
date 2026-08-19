import React, { useState } from 'react';
import {
  Upload,
  FileText,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  FileCheck2,
  X,
} from 'lucide-react';
import { RequirementSet, User } from '../types';

interface NewComparisonProps {
  requirementSets: RequirementSet[];
  currentUser: User;
  onAnalysisCreated: (analysisId: string) => void;
  onCancel: () => void;
}

export const NewComparison: React.FC<NewComparisonProps> = ({
  requirementSets,
  currentUser,
  onAnalysisCreated,
  onCancel,
}) => {
  const [mtcFile, setMtcFile] = useState<File | null>(null);
  const [mdsFile, setMdsFile] = useState<File | null>(null);
  const [selectedReqSetId, setSelectedReqSetId] = useState<string>(requirementSets[0]?.id || '');
  const [mdsSourceMode, setMdsSourceMode] = useState<'library' | 'upload'>('upload');

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processingSteps = [
    'Computing SHA-256 checksums and validating document headers...',
    'Extracting chemical, mechanical, heat treatment, and NDE data...',
    'Normalizing engineering units (°C, MPa, HBW, %) & computing Carbon Equivalent (CE)...',
    'Executing deterministic compliance rule engine matrix...',
    'Synthesizing evidence-backed findings and supplier clarification drafts...',
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
    setCurrentStep(0);

    try {
      // Advance step animation
      const stepInterval = setInterval(() => {
        setCurrentStep((prev) => (prev < processingSteps.length - 1 ? prev + 1 : prev));
      }, 700);

      let mtcDocId: string | undefined;
      let mdsDocId: string | undefined;

      if (!usePilotFixture && mtcFile) {
        // Upload MTC
        const formData = new FormData();
        formData.append('file', mtcFile);
        formData.append('type', 'mtc');
        formData.append('userId', currentUser.id);

        const uploadRes = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Failed to upload MTC file');
        }
        const data = await uploadRes.json();
        mtcDocId = data.document.id;
      }

      if (!usePilotFixture && mdsSourceMode === 'upload' && mdsFile) {
        // Upload MDS
        const formData = new FormData();
        formData.append('file', mdsFile);
        formData.append('type', 'mds');
        formData.append('userId', currentUser.id);

        const uploadRes = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Failed to upload MDS file');
        }
        const data = await uploadRes.json();
        mdsDocId = data.document.id;
      }

      // Create Analysis
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

      const analysisRes = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(stepInterval);

      if (!analysisRes.ok) {
        const err = await analysisRes.json();
        throw new Error(err.error || 'Failed to run analysis');
      }

      const result = await analysisRes.json();
      onAnalysisCreated(result.analysis.id);
    } catch (e: any) {
      setIsProcessing(false);
      setErrorMsg(e.message || 'An unexpected error occurred during processing.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              New Evaluation Pipeline
            </span>
            <span className="text-xs text-slate-500">EN 10204 3.1 Verification</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            MTC vs MDS Technical Comparison Setup
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provide the Supplier Material Test Certificate (MTC) and the Client Material Data Sheet (MDS).
          </p>
        </div>

        <button
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 1-Click Quick Pilot CTA */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-xl p-5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-800/40">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Instant Pilot Benchmark: ASTM A105N</h3>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              Auto-loads Hawa Valves MDS Rev A and Western Forge MTC WW2606229-3 (Heats A228 & YBA).
            </p>
          </div>
        </div>

        <button
          disabled={isProcessing}
          onClick={() => handleRunComparison(true)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 shrink-0 shadow transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch A105N Pilot Case</span>
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Execution Error</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Processing Animation */}
      {isProcessing && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Executing Compliance Analysis Pipeline
              </h3>
              <p className="text-xs text-slate-500">
                {processingSteps[currentStep]}
              </p>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 transition-all duration-500 rounded-full"
              style={{ width: `${((currentStep + 1) / processingSteps.length) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2 text-[11px] text-slate-500">
            {processingSteps.map((step, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border ${
                  idx <= currentStep
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-medium'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                Step {idx + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dual Upload / Specification Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Supplier MTC */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supplier MTC Certificate</h3>
              <p className="text-[11px] text-slate-500">PDF, TXT, or JSON test certificate</p>
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleMtcDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              mtcFile ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            {mtcFile ? (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-900">{mtcFile.name}</div>
                <div className="text-[11px] text-slate-500">{(mtcFile.size / 1024).toFixed(1)} KB</div>
                <button
                  onClick={() => setMtcFile(null)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-xs font-semibold text-slate-700">Drag and drop Supplier MTC here</p>
                <p className="text-[11px] text-slate-500">or click to browse local files (max 25MB)</p>
                <label className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs">
                  Browse Files
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

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong>Default Fallback:</strong> If no file is uploaded, the system will compare against the Western Forge & Flange Co. MTC WW2606229-3.
          </div>
        </div>

        {/* Right: Client MDS / Requirement Source */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Client Specification (MDS)</h3>
                <p className="text-[11px] text-slate-500">Library or custom upload</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
              <button
                onClick={() => setMdsSourceMode('upload')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  mdsSourceMode === 'upload'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Upload
              </button>
              <button
                onClick={() => setMdsSourceMode('library')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  mdsSourceMode === 'library'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Library
              </button>
            </div>
          </div>

          {mdsSourceMode === 'library' ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Select Approved Requirement Set:
              </label>
              <select
                value={selectedReqSetId}
                onChange={(e) => setSelectedReqSetId(e.target.value)}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {requirementSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.clientName} — {set.materialGrade} ({set.revision})
                  </option>
                ))}
              </select>

              {/* Selected requirement set preview */}
              {selectedReqSetId && (
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs space-y-1">
                  {(() => {
                    const sel = requirementSets.find((s) => s.id === selectedReqSetId);
                    if (!sel) return null;
                    return (
                      <>
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>{sel.title}</span>
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px]">
                            {sel.revision}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] font-mono">{sel.mdsNumber}</p>
                        <p className="text-slate-500 text-[11px] pt-1">
                          Contains {sel.requirements.length} mandatory chemical, mechanical, heat treatment, and NDE clauses.
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleMdsDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                mdsFile ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              {mdsFile ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-900">{mdsFile.name}</div>
                  <div className="text-[11px] text-slate-500">{(mdsFile.size / 1024).toFixed(1)} KB</div>
                  <button
                    onClick={() => setMdsFile(null)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700">Drag and drop Client MDS PDF</p>
                  <p className="text-[11px] text-slate-500">or click to browse local files</p>
                  <label className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs">
                    Browse Files
                    <input
                      type="file"
                      accept=".pdf,.txt,.json"
                      className="hidden"
                      onChange={(e) => e.target.files && setMdsFile(e.target.files[0])}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
        >
          Cancel
        </button>

        <button
          onClick={() => handleRunComparison(false)}
          disabled={isProcessing}
          className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Documents...</span>
            </>
          ) : (
            <>
              <span>Run Compliance Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

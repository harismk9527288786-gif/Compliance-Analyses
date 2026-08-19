import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  Plus,
  Search,
  BookOpen,
  ArrowRight,
  Sparkles,
  PlayCircle,
  FileText,
  Info,
  X,
  ExternalLink,
  Shield,
  Layers,
  Flame,
  Binary,
  Trash2,
} from 'lucide-react';
import { AnalysisRecord, RequirementSet } from '../types';

interface DashboardProps {
  analyses: AnalysisRecord[];
  requirementSets: RequirementSet[];
  onSelectAnalysis: (id: string) => void;
  onOpenNewComparison: () => void;
  onLoadPilotCase: () => void;
  onOpenTestSuite: () => void;
  onOpenLibrary: () => void;
  onClearAllAnalyses?: () => void;
  onDeleteAnalysis?: (id: string) => void;
}

type AboutCategory = 'pass' | 'deviations' | 'gaps' | 'review' | null;

export const Dashboard: React.FC<DashboardProps> = ({
  analyses,
  requirementSets,
  onSelectAnalysis,
  onOpenNewComparison,
  onLoadPilotCase,
  onOpenTestSuite,
  onOpenLibrary,
  onClearAllAnalyses,
  onDeleteAnalysis,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [aboutModalCategory, setAboutModalCategory] = useState<AboutCategory>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);

  // Calculate aggregates
  const totalPass = analyses.reduce((acc, a) => acc + (a.passCount || 0), 0);
  const totalDeviations = analyses.reduce((acc, a) => acc + (a.deviationCount || 0), 0);
  const totalGaps = analyses.reduce((acc, a) => acc + (a.documentationGapCount || 0), 0);
  const totalReviewReq = analyses.reduce((acc, a) => acc + (a.reviewRequiredCount || 0), 0);

  const filteredAnalyses = analyses.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.mtcNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.materialGrade.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.poNumber && a.poNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'deviations') return (a.deviationCount || 0) > 0;
    if (statusFilter === 'gaps') return (a.documentationGapCount || 0) > 0;
    if (statusFilter === 'review') return (a.reviewRequiredCount || 0) > 0;
    if (statusFilter === 'pass' || statusFilter === 'approved') return a.status === 'approved' || (a.passCount || 0) > 0;
    return true;
  });

  const handleCardClick = (category: string) => {
    if (statusFilter === category) {
      setStatusFilter('all');
    } else {
      setStatusFilter(category);
      // Smooth scroll down to the compliance records list
      const target = document.getElementById('recent-analyses-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Quick Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-md border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Deterministic Verification Architecture
            </span>
            <span className="text-xs text-slate-400">EN 10204 3.1 & NACE MR0175 Compliance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Automated MTC vs MDS Compliance Review
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Eliminates manual certificate cross-referencing with deterministic engineering comparison rules,
            automated Carbon Equivalent calculations, multi-heat evaluation, and evidence traceability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onLoadPilotCase}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Load A105N Pilot Test Case</span>
          </button>
          <button
            onClick={onOpenNewComparison}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-300" />
            <span>Upload New Documents</span>
          </button>
          <button
            onClick={onOpenTestSuite}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
          >
            <PlayCircle className="w-4 h-4 text-amber-400" />
            <span>Run Test Suite</span>
          </button>
        </div>
      </div>

      {/* Interactive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PASS Card */}
        <div
          onClick={() => handleCardClick('pass')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left group relative shadow-sm hover:shadow-md ${
            statusFilter === 'pass'
              ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/10'
              : 'border-slate-200 hover:border-emerald-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>Conforming (PASS)</span>
                {statusFilter === 'pass' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white">
                    Active
                  </span>
                )}
              </p>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{totalPass}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-medium text-emerald-700">Satisfies client requirements</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-semibold group-hover:underline flex items-center gap-1">
              <span>{statusFilter === 'pass' ? 'Reset filter' : 'Filter records'}</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('pass');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
              title="About Conforming rules & standards"
            >
              <Info className="w-3 h-3" />
              <span>About Criteria</span>
            </button>
          </div>
        </div>

        {/* DEVIATION Card */}
        <div
          onClick={() => handleCardClick('deviations')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left group relative shadow-sm hover:shadow-md ${
            statusFilter === 'deviations'
              ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/10'
              : 'border-slate-200 hover:border-rose-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>Deviations (FAIL)</span>
                {statusFilter === 'deviations' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white">
                    Active
                  </span>
                )}
              </p>
              <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{totalDeviations}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-medium text-rose-700">Conflicts with specified limit</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-rose-700 font-semibold group-hover:underline flex items-center gap-1">
              <span>{statusFilter === 'deviations' ? 'Reset filter' : 'Filter deviations'}</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('deviations');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
              title="About Deviation engineering rules"
            >
              <Info className="w-3 h-3" />
              <span>About Criteria</span>
            </button>
          </div>
        </div>

        {/* DOCUMENTATION GAP Card */}
        <div
          onClick={() => handleCardClick('gaps')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left group relative shadow-sm hover:shadow-md ${
            statusFilter === 'gaps'
              ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/10'
              : 'border-slate-200 hover:border-amber-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>Documentation Gaps</span>
                {statusFilter === 'gaps' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-600 text-white">
                    Active
                  </span>
                )}
              </p>
              <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{totalGaps}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-medium text-amber-700">Missing test/NDE certificates</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
              <FileQuestion className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-semibold group-hover:underline flex items-center gap-1">
              <span>{statusFilter === 'gaps' ? 'Reset filter' : 'Filter gaps'}</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('gaps');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
              title="About Documentation Gap rules under EN 10204"
            >
              <Info className="w-3 h-3" />
              <span>About Criteria</span>
            </button>
          </div>
        </div>

        {/* REVIEW REQUIRED Card */}
        <div
          onClick={() => handleCardClick('review')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left group relative shadow-sm hover:shadow-md ${
            statusFilter === 'review'
              ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/10'
              : 'border-slate-200 hover:border-blue-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>Review Required</span>
                {statusFilter === 'review' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-600 text-white">
                    Active
                  </span>
                )}
              </p>
              <h3 className="text-3xl font-extrabold text-blue-600 mt-1">{totalReviewReq}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-medium text-blue-700">Ambiguous / human review</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-blue-700 font-semibold group-hover:underline flex items-center gap-1">
              <span>{statusFilter === 'review' ? 'Reset filter' : 'Filter reviews'}</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('review');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
              title="About Human Review triggers"
            >
              <Info className="w-3 h-3" />
              <span>About Criteria</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Analyses & Approved Library */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="recent-analyses-section">
        {/* Recent Analyses (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Recent Compliance Analyses</h2>
                {statusFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-100">
                    Filtered by: {statusFilter.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Deterministic comparison records with evidence traceability and reviewer audit states
              </p>
            </div>

            {/* Filter Buttons & Clear Action */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('deviations')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === 'deviations' ? 'bg-white text-rose-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Deviations
                </button>
                <button
                  onClick={() => setStatusFilter('gaps')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === 'gaps' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gaps
                </button>
                <button
                  onClick={() => setStatusFilter('review')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === 'review' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Review
                </button>
                <button
                  onClick={() => setStatusFilter('pass')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === 'pass' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pass
                </button>
              </div>

              {analyses.length > 0 && onClearAllAnalyses && (
                <button
                  onClick={() => setShowClearConfirmModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                  title="Clear all compliance records from dashboard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All ({analyses.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Search bar inside list */}
          <div className="p-3 bg-slate-50/70 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search MTC #, PO, Material Grade, Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Analysis Cards / List */}
          <div className="divide-y divide-slate-100">
            {filteredAnalyses.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No matching compliance analyses</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {statusFilter !== 'all'
                    ? `No records found matching the "${statusFilter.toUpperCase()}" filter.`
                    : 'Get started by running a comparison against your material data sheet specifications.'}
                </p>
                {statusFilter !== 'all' && (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  >
                    <span>Clear Filter</span>
                  </button>
                )}
              </div>
            ) : (
              filteredAnalyses.map((analysis) => {
                const hasDeviations = analysis.deviationCount > 0;
                const hasGaps = analysis.documentationGapCount > 0;

                return (
                  <div
                    key={analysis.id}
                    className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => onSelectAnalysis(analysis.id)}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{analysis.title}</span>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {analysis.materialGrade}
                        </span>
                        {analysis.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : analysis.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            Rejected
                          </span>
                        ) : hasDeviations ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            Deviations Detected
                          </span>
                        ) : hasGaps ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                            <FileQuestion className="w-3 h-3" />
                            Documentation Gaps
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                            Under Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-500 flex-wrap">
                        <span>Supplier: <strong className="text-slate-700">{analysis.supplierName}</strong></span>
                        <span>MTC: <strong className="text-slate-700 font-mono">{analysis.mtcNumber}</strong></span>
                        {analysis.poNumber && (
                          <span>PO: <strong className="text-slate-700 font-mono">{analysis.poNumber}</strong></span>
                        )}
                        <span>Standard: <strong className="text-slate-700">{analysis.governingStandard}</strong></span>
                      </div>

                      {/* Pill summaries */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {analysis.passCount} PASS
                        </span>
                        {analysis.deviationCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            {analysis.deviationCount} FAIL
                          </span>
                        )}
                        {analysis.documentationGapCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {analysis.documentationGapCount} GAP
                          </span>
                        )}
                        {analysis.reviewRequiredCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {analysis.reviewRequiredCount} REVIEW
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAnalysis(analysis.id);
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Open Review</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteAnalysis && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingAnalysisId(analysis.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          title="Delete this comparison"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <span className="text-[11px] text-slate-400 min-w-[65px] text-right">
                        {new Date(analysis.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Approved Requirement Library (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Approved Requirement Library</h3>
                <p className="text-[11px] text-slate-500">Immutable client MDS specifications</p>
              </div>
            </div>
            <button
              onClick={onOpenLibrary}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {requirementSets.slice(0, 3).map((set) => (
              <div
                key={set.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition-colors cursor-pointer"
                onClick={onOpenLibrary}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{set.clientName}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    {set.revision}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium">{set.materialGrade}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{set.mdsNumber}</div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200">
                  <span>{set.requirements.length} Engineering Clauses</span>
                  <span>Effective: {set.effectiveDate}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Pilot Test Case Ready
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              ASTM A105N (Hawa MDS Rev A) with YBA 890°C heat treatment deviation, 29% elongation deviation, and UT/MPT documentation gaps is pre-configured.
            </p>
          </div>
        </div>
      </div>

      {/* About Compliance Criteria & Rules Modal */}
      {aboutModalCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div
              className={`p-5 border-b flex items-center justify-between ${
                aboutModalCategory === 'pass'
                  ? 'bg-emerald-50/70 border-emerald-100'
                  : aboutModalCategory === 'deviations'
                  ? 'bg-rose-50/70 border-rose-100'
                  : aboutModalCategory === 'gaps'
                  ? 'bg-amber-50/70 border-amber-100'
                  : 'bg-blue-50/70 border-blue-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    aboutModalCategory === 'pass'
                      ? 'bg-emerald-600 text-white'
                      : aboutModalCategory === 'deviations'
                      ? 'bg-rose-600 text-white'
                      : aboutModalCategory === 'gaps'
                      ? 'bg-amber-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {aboutModalCategory === 'pass' && <CheckCircle2 className="w-5 h-5" />}
                  {aboutModalCategory === 'deviations' && <AlertTriangle className="w-5 h-5" />}
                  {aboutModalCategory === 'gaps' && <FileQuestion className="w-5 h-5" />}
                  {aboutModalCategory === 'review' && <HelpCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {aboutModalCategory === 'pass' && 'About Conforming (PASS) Verification'}
                    {aboutModalCategory === 'deviations' && 'About Deviations & Rejections (FAIL)'}
                    {aboutModalCategory === 'gaps' && 'About Documentation Gaps (EN 10204 3.1)'}
                    {aboutModalCategory === 'review' && 'About Human Review & Ambiguity Triggers'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Engineering rule definition, evaluation boundary, and governing standard references
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAboutModalCategory(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[70vh] overflow-y-auto leading-relaxed">
              {aboutModalCategory === 'pass' && (
                <>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
                    <p className="font-semibold text-sm">Deterministic Mathematical Proof of Conformance</p>
                    <p className="mt-1">
                      A parameter is classified as <strong>PASS</strong> when the supplier’s extracted test certificate
                      value satisfies all specified upper and lower bounds defined in the client’s Material Data Sheet (MDS)
                      and base ASTM/ASME standard.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Binary className="w-4 h-4 text-emerald-600" />
                      Evaluated Conformance Rules:
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      <li>
                        <strong>Chemical Element Range Checks</strong>: Element mass fractions (% Carbon, Manganese,
                        Silicon, Phosphorus, Sulfur, Chromium, Nickel, Molybdenum, Copper, Vanadium) are strictly within
                        the ASTM standard and client limits.
                      </li>
                      <li>
                        <strong>Mechanical Thresholds</strong>: Yield Strength (ReH ≥ specified min), Tensile
                        Strength (Rm in specified range), Elongation (A5 ≥ min %), Hardness (≤ 187 HBW for sour service).
                      </li>
                      <li>
                        <strong>Carbon Equivalent Formulas</strong>: Evaluated according to IIW formula
                        CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15 ≤ 0.43%.
                      </li>
                    </ul>
                  </div>

                  <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 font-mono">
                    Standards: ASTM A105 / A105M, ASME Section II Part A, EN 10204 Type 3.1, NACE MR0175 / ISO 15156.
                  </div>
                </>
              )}

              {aboutModalCategory === 'deviations' && (
                <>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900">
                    <p className="font-semibold text-sm">Deterministic Engineering Non-Conformance (FAIL)</p>
                    <p className="mt-1">
                      A parameter is classified as a <strong>DEVIATION</strong> when the supplier certificate value
                      violates an explicit client boundary, such as an insufficient heat treatment temperature, low elongation,
                      or high carbon equivalent.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-600" />
                      Key Rejection Criteria:
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      <li>
                        <strong>Heat Treatment Violation</strong>: Normalization performed below specified temperature
                        (e.g., actual 890°C vs. required minimum 900°C).
                      </li>
                      <li>
                        <strong>Elongation Below Minimum</strong>: Ductility failure (e.g. actual 29% vs. required minimum 30%).
                      </li>
                      <li>
                        <strong>Over-limit Chemistry</strong>: Harmful tramp elements (Phosphorus, Sulfur, Carbon Equivalent) exceeding weldability threshold.
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-bold text-slate-900">Required Action for Deviations:</p>
                    <p className="mt-0.5 text-slate-600">
                      Generate an External Feedback email draft to the supplier requesting an engineering concession,
                      re-test certificate, or material return before goods dispatch.
                    </p>
                  </div>
                </>
              )}

              {aboutModalCategory === 'gaps' && (
                <>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                    <p className="font-semibold text-sm">Missing Verification Documentation</p>
                    <p className="mt-1">
                      A parameter is classified as a <strong>DOCUMENTATION GAP</strong> when the client specification
                      mandates a specific test report or inspection certification that is completely absent from the supplier’s package.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <FileQuestion className="w-4 h-4 text-amber-600" />
                      Common Missing Certifications:
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      <li>
                        <strong>Ultrasonic Examination (UT)</strong>: Missing volumetric NDE report per ASME Section VIII Div 1 Appendix 12.
                      </li>
                      <li>
                        <strong>Magnetic Particle Testing (MPT/MT)</strong>: Missing surface crack inspection per ASME Section VIII Div 1 Appendix 6.
                      </li>
                      <li>
                        <strong>Microstructure & Grain Size</strong>: Missing photomicrograph or ASTM E112 grain size documentation (≥ 5).
                      </li>
                      <li>
                        <strong>NACE MR0175 Compliance Statement</strong>: Missing sour service environmental resistance attestation.
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {aboutModalCategory === 'review' && (
                <>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900">
                    <p className="font-semibold text-sm">Human Engineering Review Gate</p>
                    <p className="mt-1">
                      Items marked <strong>REVIEW REQUIRED</strong> identify clauses where the certificate contains
                      non-standard units, dual material grade designations, or qualifying footnotes that require an authorized QC Engineer sign-off.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      Trigger Scenarios:
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      <li>
                        <strong>Dual Certified Grades</strong>: E.g., material certified as both ASTM A182 F316 and F316L.
                      </li>
                      <li>
                        <strong>Unit Conversions & Notations</strong>: Certificate values provided in non-SI units without standard conversion factors.
                      </li>
                      <li>
                        <strong>Third-party Inspection Agency Endorsements</strong>: Unverified stamp or signature block requiring reviewer verification.
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  const cat = aboutModalCategory;
                  setAboutModalCategory(null);
                  if (cat) handleCardClick(cat);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span>Filter Records for this Category</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setAboutModalCategory(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Clear All Compliance Records?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  This will remove all <strong>{analyses.length}</strong> comparison analysis records from the dashboard. This action will give you a clean slate. You can re-run comparisons or load the pilot sample case anytime.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onClearAllAnalyses) onClearAllAnalyses();
                  setShowClearConfirmModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear Everything</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Analysis Modal */}
      {deletingAnalysisId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Comparison Record?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to delete this compliance review? All associated findings and feedback drafts for this record will be removed.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeletingAnalysisId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteAnalysis && deletingAnalysisId) {
                    onDeleteAnalysis(deletingAnalysisId);
                  }
                  setDeletingAnalysisId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

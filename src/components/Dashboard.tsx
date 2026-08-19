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
  Shield,
  ShieldCheck,
  Layers,
  Flame,
  Binary,
  Trash2,
  Clock,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { AnalysisRecord, RequirementSet, User } from '../types';
import { InfiniteGrid } from './InfiniteGrid';
import { DottedOffsetButton } from './DottedOffsetButton';

interface DashboardProps {
  analyses: AnalysisRecord[];
  requirementSets: RequirementSet[];
  currentUser?: User;
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
  currentUser,
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

  // Dynamic time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = currentUser?.name ? currentUser.name.split(' ')[0] : 'Quality Engineer';
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  // Calculate operational QC aggregates
  const totalReviews = analyses.length;
  const totalPass = analyses.reduce((acc, a) => acc + (a.passCount || 0), 0);
  const totalDeviations = analyses.reduce((acc, a) => acc + (a.deviationCount || 0), 0);
  const totalGaps = analyses.reduce((acc, a) => acc + (a.documentationGapCount || 0), 0);
  const totalReviewReq = analyses.reduce((acc, a) => acc + (a.reviewRequiredCount || 0), 0);
  const totalNeedsReview = totalGaps + totalReviewReq;

  // Filter analyses requiring human attention (Deviations, Gaps, Review triggers, Rejections)
  const attentionItems = analyses.filter(
    (a) =>
      a.deviationCount > 0 ||
      a.documentationGapCount > 0 ||
      a.reviewRequiredCount > 0 ||
      a.status === 'rejected'
  );

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
    if (statusFilter === 'pass' || statusFilter === 'approved')
      return a.status === 'approved' || (a.passCount || 0) > 0;
    return true;
  });

  const handleCardClick = (category: string) => {
    if (statusFilter === category) {
      setStatusFilter('all');
    } else {
      setStatusFilter(category);
      const target = document.getElementById('recent-comparisons-table');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Helper to generate finding snippet for attention cards
  const getAttentionSummary = (a: AnalysisRecord) => {
    if (a.deviationCount > 0) {
      return a.heats?.includes('YBA')
        ? 'Heat treatment temperature (890°C) below MDS requirement (900°C - 960°C)'
        : 'Mechanical or chemical parameters violate specified client MDS boundaries';
    }
    if (a.documentationGapCount > 0) {
      return 'Required supplementary NDE testing documentation (100% UT/MPT) not attached';
    }
    if (a.reviewRequiredCount > 0) {
      return 'Low-confidence extracted parameter or text ambiguity requires human verification';
    }
    return 'Quality non-conformance recorded during deterministic verification';
  };

  return (
    <div className="space-y-6">
      {/* 1. DASHBOARD HERO: Infinite Grid Animated Operational Header */}
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-sm">
        <InfiniteGrid
          cellSize={36}
          lineColor="rgba(148, 163, 184, 0.12)"
          crosshairColor="rgba(16, 185, 129, 0.4)"
          spotlightColor="rgba(16, 185, 129, 0.15)"
          spotlightRadius={260}
          backgroundColor="#090e1a"
          enableTilt={true}
          className="p-5 md:p-6"
        >
          <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-800/60 backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SYSTEM ACTIVE
                </span>
                <span className="text-xs text-slate-400 font-mono">EN 10204 3.1 & ISO 9001 Workstation</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {getGreeting()}
              </h1>
              <p className="text-xs text-slate-400">
                Material certificate compliance at a glance.
              </p>
            </div>

            {/* Action Controls with DottedOffsetButton */}
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <DottedOffsetButton
                onClick={onLoadPilotCase}
                variant="secondary"
                size="sm"
                icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              >
                Pilot Benchmark
              </DottedOffsetButton>

              <DottedOffsetButton
                onClick={onOpenTestSuite}
                variant="secondary"
                size="sm"
                textColor="text-amber-300"
                icon={<PlayCircle className="w-3.5 h-3.5 text-amber-400" />}
              >
                Test Suite
              </DottedOffsetButton>

              <DottedOffsetButton
                onClick={onOpenNewComparison}
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
              >
                + New Comparison
              </DottedOffsetButton>
            </div>
          </div>
        </InfiniteGrid>
      </div>

      {/* 2. KPI CARDS: 4-Card Operational QC Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CONFORMING (PASS) Card */}
        <div
          onClick={() => handleCardClick('pass')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left relative shadow-xs hover:shadow-sm border-l-4 border-l-emerald-500 ${
            statusFilter === 'pass'
              ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-50/20'
              : 'border-slate-200 hover:border-emerald-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  CONFORMING (PASS)
                </span>
                {statusFilter === 'pass' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white font-mono">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                {totalPass}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium text-emerald-700">Satisfies client requirements</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span>{statusFilter === 'pass' ? 'Reset filter' : 'Filter compliant'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('pass');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>Criteria</span>
            </button>
          </div>
        </div>

        {/* DEVIATIONS (FAIL) Card */}
        <div
          onClick={() => handleCardClick('deviations')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left relative shadow-xs hover:shadow-sm border-l-4 border-l-rose-500 ${
            statusFilter === 'deviations'
              ? 'border-rose-500 ring-1 ring-rose-500/30 bg-rose-50/20'
              : 'border-slate-200 hover:border-rose-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  DEVIATIONS (FAIL)
                </span>
                {statusFilter === 'deviations' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white font-mono">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-rose-600 mt-1">
                {totalDeviations}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium text-rose-700">Conflicts with specified limit</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-rose-700 font-semibold flex items-center gap-1">
              <span>{statusFilter === 'deviations' ? 'Reset filter' : 'Filter deviations'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('deviations');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>Criteria</span>
            </button>
          </div>
        </div>

        {/* DOCUMENTATION GAPS Card */}
        <div
          onClick={() => handleCardClick('gaps')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left relative shadow-xs hover:shadow-sm border-l-4 border-l-amber-500 ${
            statusFilter === 'gaps'
              ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-50/20'
              : 'border-slate-200 hover:border-amber-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  DOCUMENTATION GAPS
                </span>
                {statusFilter === 'gaps' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-600 text-white font-mono">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-amber-600 mt-1">
                {totalGaps}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium text-amber-700">Missing test/NDE certificates</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <FileQuestion className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-semibold flex items-center gap-1">
              <span>{statusFilter === 'gaps' ? 'Reset filter' : 'Filter gaps'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('gaps');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>Criteria</span>
            </button>
          </div>
        </div>

        {/* REVIEW REQUIRED Card */}
        <div
          onClick={() => handleCardClick('review')}
          className={`bg-white rounded-xl p-5 border transition-all cursor-pointer text-left relative shadow-xs hover:shadow-sm border-l-4 border-l-blue-500 ${
            statusFilter === 'review'
              ? 'border-blue-500 ring-1 ring-blue-500/30 bg-blue-50/20'
              : 'border-slate-200 hover:border-blue-300'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  REVIEW REQUIRED
                </span>
                {statusFilter === 'review' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-600 text-white font-mono">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-blue-600 mt-1">
                {totalReviewReq}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium text-blue-700">Ambiguous / human review</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-blue-700 font-semibold flex items-center gap-1">
              <span>{statusFilter === 'review' ? 'Reset filter' : 'Filter reviews'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAboutModalCategory('review');
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Info className="w-3 h-3" />
              <span>Criteria</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. NEEDS YOUR ATTENTION SECTION: Key Operational Focus */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Needs Your Attention ({attentionItems.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Items requiring QA/QC engineer review or supplier clarification
          </span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">All recent material reviews are up to date.</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No non-conformances, documentation gaps, or pending review triggers requiring attention.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attentionItems.map((item) => {
              const isDeviation = item.deviationCount > 0 || item.status === 'rejected';
              const isGap = item.documentationGapCount > 0;
              const heatsText = item.heats && item.heats.length > 0 ? ` · Heat ${item.heats.join(', ')}` : '';

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectAnalysis(item.id)}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {isDeviation ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                      ) : isGap ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {item.mtcNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {item.materialGrade}{heatsText}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500 truncate">
                          {item.supplierName}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {getAttentionSummary(item)}
                      </p>

                      <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-400 font-mono">
                        <span>Reviewed: {new Date(item.createdAt).toLocaleDateString()}</span>
                        {item.poNumber && <span>· PO: {item.poNumber}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {isDeviation ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>DEVIATION</span>
                      </span>
                    ) : isGap ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">
                        <FileQuestion className="w-3 h-3" />
                        <span>DOCUMENTATION GAP</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200">
                        <HelpCircle className="w-3 h-3" />
                        <span>REVIEW REQUIRED</span>
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAnalysis(item.id);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Review</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MAIN GRID: Recent Comparisons Record Table (2 cols) & Approved Library (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="recent-comparisons-table">
        {/* Recent Comparisons Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Table Header & Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Recent MTC Compliance Records
                </h2>
                <p className="text-[11px] text-slate-500">
                  Deterministic verification logs with evidence citations & audit history
                </p>
              </div>

              {analyses.length > 0 && onClearAllAnalyses && (
                <button
                  onClick={() => setShowClearConfirmModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer self-start sm:self-auto"
                  title="Clear all compliance records from dashboard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All ({analyses.length})</span>
                </button>
              )}
            </div>

            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('deviations')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === 'deviations'
                      ? 'bg-white text-rose-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Deviations
                </button>
                <button
                  onClick={() => setStatusFilter('gaps')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === 'gaps'
                      ? 'bg-white text-amber-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gaps
                </button>
                <button
                  onClick={() => setStatusFilter('review')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === 'review'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Review
                </button>
                <button
                  onClick={() => setStatusFilter('pass')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === 'pass'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pass
                </button>
              </div>

              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search MTC #, PO, Material, Supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {filteredAnalyses.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No matching compliance analyses found</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  {statusFilter !== 'all'
                    ? `No records found matching the "${statusFilter.toUpperCase()}" filter.`
                    : 'Get started by running a comparison against client Material Data Sheet specifications.'}
                </p>
                {statusFilter !== 'all' && (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  >
                    <span>Clear Filter</span>
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">MTC Number</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Material & Heats</th>
                    <th className="py-2.5 px-3">MDS Specification</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Reviewed</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredAnalyses.map((analysis) => {
                    const hasDeviations = analysis.deviationCount > 0;
                    const hasGaps = analysis.documentationGapCount > 0;
                    const hasReviewReq = analysis.reviewRequiredCount > 0;

                    return (
                      <tr
                        key={analysis.id}
                        onClick={() => onSelectAnalysis(analysis.id)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* MTC ID */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {analysis.mtcNumber}
                          </div>
                          {analysis.poNumber && (
                            <div className="text-[10px] text-slate-400 font-mono">PO: {analysis.poNumber}</div>
                          )}
                        </td>

                        {/* Supplier */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 truncate max-w-[140px]">
                            {analysis.supplierName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                            {analysis.governingStandard || 'ASTM A105 / A105M'}
                          </div>
                        </td>

                        {/* Material & Heats */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-700">
                            {analysis.materialGrade}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            {analysis.heats?.length ? `Heats: ${analysis.heats.join(', ')}` : 'Heat trace: Yes'}
                          </div>
                        </td>

                        {/* MDS Specification */}
                        <td className="py-3 px-3">
                          <div className="text-slate-700 font-mono text-[11px] truncate max-w-[140px]">
                            {analysis.requirementSetTitle || 'Client MDS'}
                          </div>
                          <span className="inline-block px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-mono border border-blue-200">
                            Rev A
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3">
                          {analysis.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              PASS
                            </span>
                          ) : analysis.status === 'rejected' || hasDeviations ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              DEVIATION
                            </span>
                          ) : hasGaps ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">
                              <FileQuestion className="w-3 h-3" />
                              GAP
                            </span>
                          ) : hasReviewReq ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200">
                              <HelpCircle className="w-3 h-3" />
                              REVIEW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700">
                              PENDING
                            </span>
                          )}
                        </td>

                        {/* Reviewed Date */}
                        <td className="py-3 px-3 text-right text-[11px] text-slate-400 font-mono whitespace-nowrap">
                          {new Date(analysis.createdAt).toLocaleDateString()}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectAnalysis(analysis.id);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                            >
                              Open
                            </button>
                            {onDeleteAnalysis && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingAnalysisId(analysis.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Delete this record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Approved Requirement Library (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Approved Requirement Sets
                </h3>
                <p className="text-[11px] text-slate-500">Immutable client specifications</p>
              </div>
            </div>
            <button
              onClick={onOpenLibrary}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Library</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
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
                <div className="text-xs text-slate-700 mt-1 font-medium">{set.materialGrade}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{set.mdsNumber}</div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200 font-mono">
                  <span>{set.requirements.length} Clauses</span>
                  <span>Effective: {set.effectiveDate}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Pilot Prompt Info Box */}
          <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200/80 text-emerald-950 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Pilot Case Pre-Configured
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              ASTM A105N (Hawa MDS Rev A) with Heat YBA 890°C deviation & missing UT/MPT testing is ready to evaluate.
            </p>
          </div>
        </div>
      </div>

      {/* About Compliance Criteria & Rules Modal */}
      {aboutModalCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
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
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    aboutModalCategory === 'pass'
                      ? 'bg-emerald-600 text-white'
                      : aboutModalCategory === 'deviations'
                      ? 'bg-rose-600 text-white'
                      : aboutModalCategory === 'gaps'
                      ? 'bg-amber-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {aboutModalCategory === 'pass' && <CheckCircle2 className="w-4 h-4" />}
                  {aboutModalCategory === 'deviations' && <AlertTriangle className="w-4 h-4" />}
                  {aboutModalCategory === 'gaps' && <FileQuestion className="w-4 h-4" />}
                  {aboutModalCategory === 'review' && <HelpCircle className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {aboutModalCategory === 'pass' && 'About Conforming (PASS) Criteria'}
                    {aboutModalCategory === 'deviations' && 'About Non-Conformance (FAIL) Criteria'}
                    {aboutModalCategory === 'gaps' && 'About Documentation Gaps (EN 10204 3.1)'}
                    {aboutModalCategory === 'review' && 'About Human Review & Ambiguity Triggers'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Deterministic engineering evaluation boundaries and governing standard references
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAboutModalCategory(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-5 space-y-3 text-xs text-slate-700 max-h-[70vh] overflow-y-auto leading-relaxed">
              {aboutModalCategory === 'pass' && (
                <>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                    <p className="font-semibold text-xs">Deterministic Mathematical Proof of Conformance</p>
                    <p className="mt-1 text-[11px]">
                      A parameter is classified as <strong>PASS</strong> when the supplier’s extracted test certificate
                      value satisfies all upper and lower bounds specified in the client’s Material Data Sheet (MDS).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Binary className="w-3.5 h-3.5 text-emerald-600" />
                      Evaluated Conformance Rules:
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
                      <li>
                        <strong>Chemical Element Range Checks</strong>: Element mass fractions (% Carbon, Manganese,
                        Silicon, Phosphorus, Sulfur, Chromium, Nickel, Molybdenum, Copper, Vanadium).
                      </li>
                      <li>
                        <strong>Mechanical Thresholds</strong>: Yield Strength (ReH ≥ min), Tensile
                        Strength (Rm in range), Elongation (A5 ≥ min %), Hardness (≤ 187 HBW for sour service).
                      </li>
                      <li>
                        <strong>Carbon Equivalent Formulas</strong>: Evaluated according to IIW formula
                        CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15 ≤ 0.43%.
                      </li>
                    </ul>
                  </div>

                  <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-500 font-mono">
                    Governing Standards: ASTM A105 / A105M, ASME Section II Part A, EN 10204 Type 3.1, NACE MR0175 / ISO 15156.
                  </div>
                </>
              )}

              {aboutModalCategory === 'deviations' && (
                <>
                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-900">
                    <p className="font-semibold text-xs">Deterministic Engineering Non-Conformance (FAIL)</p>
                    <p className="mt-1 text-[11px]">
                      A parameter is classified as a <strong>DEVIATION</strong> when the supplier certificate value
                      violates an explicit client boundary, such as an insufficient heat treatment temperature, low elongation,
                      or high carbon equivalent.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-rose-600" />
                      Key Rejection Criteria:
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
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

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
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
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                    <p className="font-semibold text-xs">Missing Mandatory Documentation (EN 10204 3.1)</p>
                    <p className="mt-1 text-[11px]">
                      A clause is classified as a <strong>DOCUMENTATION GAP</strong> when the client specification
                      mandates a specific test report or statement (e.g., 100% Ultrasonic Testing, Magnetic Particle Testing,
                      or NACE MR0175 compliance statement) that is absent from the supplier’s certificate package.
                    </p>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <h4 className="font-bold text-slate-900 text-xs">Standard Gap Remediation:</h4>
                    <p className="text-slate-600">
                      Suppliers must provide certified supplementary NDE test reports signed by a Level II / III inspector
                      prior to material release.
                    </p>
                  </div>
                </>
              )}
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
                  This will remove all <strong>{analyses.length}</strong> evaluation records from your dashboard and reset the recent analyses list.
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
                  if (onClearAllAnalyses) {
                    onClearAllAnalyses();
                    setShowClearConfirmModal(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear All</span>
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
                <h3 className="text-lg font-bold text-slate-900">Delete Analysis Record?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to delete this compliance review? This action cannot be undone.
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
                    setDeletingAnalysisId(null);
                  }
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

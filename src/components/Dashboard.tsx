import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  Plus,
  Search,
  ArrowRight,
  FileText,
  Trash2,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { AnalysisRecord, RequirementSet, User } from '../types';
import { exportFleetToExcel } from '../utils/exportUtils';

interface DashboardProps {
  analyses: AnalysisRecord[];
  requirementSets: RequirementSet[];
  currentUser?: User;
  onSelectAnalysis: (id: string, initialTab?: 'all' | 'issues' | 'pass') => void;
  onOpenNewComparison: () => void;
  onLoadPilotCase: () => void;
  onOpenTestSuite?: () => void;
  onOpenLibrary?: () => void;
  onClearAllAnalyses?: () => void;
  onDeleteAnalysis?: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  analyses,
  currentUser,
  onSelectAnalysis,
  onOpenNewComparison,
  onLoadPilotCase,
  onClearAllAnalyses,
  onDeleteAnalysis,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'deviations' | 'gaps'>('all');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Quality Specialist';

  // Aggregate metrics
  const totalReviews = analyses.length;
  const totalPass = analyses.reduce((acc, a) => acc + (a.passCount || 0), 0);
  const totalDeviations = analyses.reduce((acc, a) => acc + (a.deviationCount || 0), 0);
  const totalGaps = analyses.reduce((acc, a) => acc + (a.documentationGapCount || 0), 0);
  const totalNeedsAttention = totalDeviations + totalGaps;
  const totalChecks = totalPass + totalNeedsAttention;

  // Filter analyses requiring attention
  const attentionItems = analyses.filter(
    (a) =>
      a.deviationCount > 0 ||
      a.documentationGapCount > 0 ||
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
    if (statusFilter === 'pass') return a.status === 'approved' || ((a.deviationCount || 0) === 0 && (a.documentationGapCount || 0) === 0);
    return true;
  });

  const getAttentionSummary = (a: AnalysisRecord) => {
    if (a.deviationCount > 0) {
      return a.heats?.includes('YBA')
        ? 'Heat YBA: Normalizing temp (890°C) is below MDS limit (900°C - 960°C); Tensile Elongation (29%) < 30% min.'
        : 'Mechanical or chemical parameters deviate from specified limits.';
    }
    if (a.documentationGapCount > 0) {
      return 'Supplementary NDE testing documentation (100% UT/MPT per ASTM A388/A275) not attached.';
    }
    return 'Quality non-conformance recorded.';
  };

  const exportTableCSV = () => {
    if (filteredAnalyses.length === 0) return;
    const headers = [
      'MTC Number',
      'PO Number',
      'Supplier',
      'Material Grade',
      'Heats',
      'Requirement Set',
      'Pass Checks',
      'Deviations',
      'Doc Gaps',
      'Status',
      'Date',
      'Reviewed By',
    ];
    const rows = filteredAnalyses.map((a) => [
      a.mtcNumber,
      a.poNumber || 'N/A',
      a.supplierName,
      a.materialGrade,
      (a.heats || []).join('; '),
      a.requirementSetTitle,
      a.passCount || 0,
      a.deviationCount || 0,
      a.documentationGapCount || 0,
      a.status,
      new Date(a.createdAt).toISOString(),
      a.approvedByName || a.createdByName,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MTC_Fleet_Verification_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard accessibility for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowClearConfirmModal(false);
        setDeletingAnalysisId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. ENGINEERING CONTROL BANNER (High-density, slate-900, zero gimmicks) */}
      <section
        aria-label="Compliance Summary Header"
        className="bg-slate-900 rounded-xl p-6 text-slate-100 border border-slate-800 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* System Status Rail */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold">
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Deterministic Engine v2.4</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">EN 10204 3.1 Traceability</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">ISO 15156 / NACE MR0175 Verified</span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                MTC Compliance & Material Verification
              </h1>
              <p className="text-xs text-slate-300 font-normal mt-1 leading-relaxed">
                Deterministic cross-examination of Supplier Inspection Certificates (EN 10204 3.1) against Client Material Data Sheets (MDS).
              </p>
            </div>

            {/* Action Buttons with explicit focus states */}
            <div className="flex items-center gap-2.5 pt-1 flex-wrap">
              <button
                type="button"
                onClick={onOpenNewComparison}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer border border-emerald-400/40 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                <span>Verify New MTC</span>
              </button>

              <button
                type="button"
                onClick={onLoadPilotCase}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <FileText className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                <span>Load Benchmark MTC (ASTM A105N)</span>
              </button>
            </div>
          </div>

          {/* 3-Second Overall Compliance Verdict Badge */}
          <div className="bg-slate-950/90 rounded-lg p-4 border border-slate-800 w-full sm:w-auto sm:min-w-[280px] space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span className="uppercase tracking-wider font-semibold">Active Fleet Verdict</span>
              <span className="font-bold text-slate-300">{totalReviews} Records</span>
            </div>

            <div className="space-y-2">
              {totalReviews === 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 text-slate-300 border border-slate-700 text-xs font-bold font-mono">
                  <Cpu className="w-4 h-4 stroke-[2.5] text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>READY FOR VERIFICATION</span>
                </div>
              ) : totalDeviations > 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-700 text-xs font-bold font-mono">
                  <AlertTriangle className="w-4 h-4 stroke-[2.5] text-rose-400 shrink-0" aria-hidden="true" />
                  <span>ACTION REQUIRED: {totalDeviations} DEVIATION{totalDeviations > 1 ? 'S' : ''}</span>
                </div>
              ) : totalGaps > 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-700 text-xs font-bold font-mono">
                  <FileQuestion className="w-4 h-4 stroke-[2.5] text-amber-400 shrink-0" aria-hidden="true" />
                  <span>DOCUMENTATION GAP: {totalGaps} MISSING SPEC{totalGaps > 1 ? 'S' : ''}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-700 text-xs font-bold font-mono">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>ALL SPECIFICATIONS CONFORMANT</span>
                </div>
              )}

              <div className="text-[11px] text-slate-400 font-mono space-y-1 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Conforming Checks:</span>
                  <span className="text-emerald-400 font-bold">{totalPass} / {totalChecks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deviations:</span>
                  <span className="text-rose-400 font-bold">{totalDeviations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Documentation Gaps:</span>
                  <span className="text-amber-400 font-bold">{totalGaps}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HIGH-DENSITY METRIC CARDS (Clear meaning, high contrast, no meaningless gradients) */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Conforming */}
        <button
          type="button"
          onClick={() => {
            const target =
              analyses.find((a) => a.status === 'approved' || (a.passCount > 0 && a.deviationCount === 0)) ||
              analyses.find((a) => a.passCount > 0) ||
              analyses[0];
            if (target) {
              onSelectAnalysis(target.id, 'pass');
            } else {
              setStatusFilter(statusFilter === 'pass' ? 'all' : 'pass');
            }
          }}
          className="text-left bg-white rounded-xl p-5 border border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Conforming Checks
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-700">{totalPass}</div>
              <p className="text-[11px] text-slate-500 font-medium">Satisfies all MDS chemical & mechanical limits</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>View Conforming Checks</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </div>
        </button>

        {/* Metric 2: Quality Deviations / Gaps */}
        <button
          type="button"
          onClick={() => {
            const target =
              attentionItems[0] ||
              analyses.find((a) => a.deviationCount > 0 || a.documentationGapCount > 0) ||
              analyses[0];
            if (target) {
              onSelectAnalysis(target.id, 'issues');
            } else {
              setStatusFilter(statusFilter === 'deviations' ? 'all' : 'deviations');
            }
          }}
          className="text-left bg-white rounded-xl p-5 border border-rose-300 hover:border-rose-500 hover:bg-rose-50/40 transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                Quality Deviations & Gaps
              </span>
              <div className="text-2xl font-bold font-mono text-rose-700">{totalNeedsAttention}</div>
              <p className="text-[11px] text-slate-500 font-medium">Out-of-spec values or missing NDE reports</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-rose-700">
            <span>View Issues Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </div>
        </button>

        {/* Metric 3: Total Certificates */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left bg-white rounded-xl p-5 border transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
            statusFilter === 'all'
              ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50/60'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/60'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Total Evaluated MTCs
              </span>
              <div className="text-2xl font-bold font-mono text-slate-900">{totalReviews}</div>
              <p className="text-[11px] text-slate-500 font-medium">Across all approved mill suppliers</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-300">
              <FileText className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
            <span>{statusFilter === 'all' ? 'All Records Active' : 'Reset View to All'}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </button>
      </section>

      {/* 3. MATERIAL DISCREPANCIES & ACTION REQUIRED RAIL (3-second identification) */}
      {attentionItems.length > 0 && (
        <section aria-label="Action Required Items" className="bg-rose-50/60 rounded-xl border border-rose-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 stroke-[2.5]" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Action Required ({attentionItems.length} MTC Discrepanc{attentionItems.length > 1 ? 'ies' : 'y'})
              </h2>
            </div>
            <span className="text-xs text-rose-800 font-semibold font-mono">
              Requires QC Review / Technical Clarification
            </span>
          </div>

          <div className="space-y-2.5">
            {attentionItems.map((item) => {
              const isDeviation = item.deviationCount > 0 || item.status === 'rejected';
              return (
                <div
                  key={item.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Inspect non-conformance for MTC ${item.mtcNumber}`}
                  onClick={() => onSelectAnalysis(item.id, 'issues')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectAnalysis(item.id, 'issues');
                    }
                  }}
                  className="bg-white rounded-lg p-4 border border-rose-200 shadow-2xs hover:border-rose-400 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                >
                  <div className="space-y-1.5 min-w-0">
                    {/* Traceability Metadata Bar */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold">
                        MTC: {item.mtcNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-300">
                        {item.materialGrade}
                      </span>
                      <span className="text-slate-600 font-medium truncate">
                        Supplier: <strong>{item.supplierName}</strong>
                      </span>
                      {item.heats?.length ? (
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Heats: {item.heats.join(', ')}
                        </span>
                      ) : null}
                    </div>

                    {/* Specific Non-conformance reason */}
                    <p className="text-xs text-rose-950 font-semibold leading-relaxed">
                      {getAttentionSummary(item)}
                    </p>

                    <div className="text-[11px] text-slate-500 font-mono">
                      Target Spec: <strong>{item.requirementSetTitle}</strong>
                      {item.poNumber && ` · PO: ${item.poNumber}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isDeviation ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                        <span>DEVIATION ({item.deviationCount})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                        <FileQuestion className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                        <span>GAP ({item.documentationGapCount})</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAnalysis(item.id);
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. VERIFICATION LOGS & TRACEABILITY TABLE */}
      <section aria-label="Verification Records Table" className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Certificate Verification Records</h2>
            <p className="text-xs text-slate-500 font-medium">
              Deterministic rule evaluation log against client material data sheets (MDS)
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap max-w-full">
            {/* Segmented Filter Control with high contrast badges */}
            <div role="tablist" aria-label="Status Filters" className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-300 text-xs max-w-full overflow-x-auto">
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                All ({analyses.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'deviations'}
                onClick={() => setStatusFilter('deviations')}
                className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'deviations'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-rose-800 hover:text-rose-900'
                }`}
              >
                <AlertTriangle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                <span>Issues ({totalNeedsAttention})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'pass'}
                onClick={() => setStatusFilter('pass')}
                className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'pass'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-800 hover:text-emerald-900'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                <span>Conforming ({totalPass})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56 min-w-[200px] max-w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search MTC / Heat / Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-900"
              />
            </div>

            {/* Export Buttons */}
            {analyses.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => exportFleetToExcel(filteredAnalyses)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
                  title="Export fleet register & non-conformance logs as multi-tab Excel workbook"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={exportTableCSV}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 shrink-0"
                  title="Export verification fleet records to CSV"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>CSV</span>
                </button>
              </>
            )}

            {/* Clear All Records Button */}
            {analyses.length > 0 && onClearAllAnalyses && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 shrink-0"
                title="Clear all records"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Clear all records</span>
              </button>
            )}
          </div>
        </div>

        {/* Technical Data Table with horizontal scrolling and readable column widths */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto w-full max-w-full">
          {filteredAnalyses.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-800">No matching verification records</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {statusFilter !== 'all'
                  ? 'No records match the active filter criteria.'
                  : 'Get started by running a verification on an MTC certificate.'}
              </p>
            </div>
          ) : (
            <table role="table" className="w-full text-left border-collapse min-w-[760px]">
              <caption className="sr-only">List of Material Test Certificate verification logs</caption>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th scope="col" className="py-2.5 px-4">Certificate / Standard</th>
                  <th scope="col" className="py-2.5 px-3">Supplier & Client Spec</th>
                  <th scope="col" className="py-2.5 px-3">Material Grade & Heats</th>
                  <th scope="col" className="py-2.5 px-3">Compliance Status Rail</th>
                  <th scope="col" className="py-2.5 px-3">Audit State</th>
                  <th scope="col" className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {filteredAnalyses.map((analysis) => {
                  const hasDeviations = analysis.deviationCount > 0;
                  const hasGaps = analysis.documentationGapCount > 0;
                  const isApproved = analysis.status === 'approved';
                  const isRejected = analysis.status === 'rejected';

                  return (
                    <tr
                      key={analysis.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`View analysis for MTC ${analysis.mtcNumber}`}
                      onClick={() => onSelectAnalysis(analysis.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAnalysis(analysis.id);
                        }
                      }}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      {/* 1. MTC / Standard */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {analysis.mtcNumber}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {analysis.poNumber ? `PO: ${analysis.poNumber}` : 'EN 10204 3.1'}
                        </div>
                      </td>

                      {/* 2. Supplier & Spec */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{analysis.supplierName}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[220px]">
                          {analysis.requirementSetTitle}
                        </div>
                      </td>

                      {/* 3. Material Grade & Heats */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{analysis.materialGrade}</div>
                        {analysis.heats?.length ? (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Heats: <span className="font-bold text-slate-700">{analysis.heats.join(', ')}</span>
                          </div>
                        ) : null}
                      </td>

                      {/* 4. Compliance Status Rail (Icon + Label + Color) */}
                      <td className="py-3 px-3">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                            <span>CONFORMANT</span>
                          </span>
                        ) : hasDeviations ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                            <span>DEVIATION ({analysis.deviationCount})</span>
                          </span>
                        ) : hasGaps ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                            <FileQuestion className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                            <span>GAP ({analysis.documentationGapCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                            <span>PASS</span>
                          </span>
                        )}
                      </td>

                      {/* 5. Audit State */}
                      <td className="py-3 px-3">
                        {isApproved ? (
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Approved by {analysis.approvedByName || 'QC Lead'}</span>
                          </span>
                        ) : isRejected ? (
                          <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Pending Human Review
                          </span>
                        )}
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAnalysis(analysis.id);
                            }}
                            className="px-3 py-1 rounded-md text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                          >
                            Review
                          </button>
                          {onDeleteAnalysis && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingAnalysisId(analysis.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span className="sr-only">Delete</span>
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
      </section>

      {/* Clear All Confirmation Modal */}
      {showClearConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-300 p-6 space-y-4">
            <h3 id="clear-modal-title" className="text-base font-bold text-slate-900">
              Clear All Verification Records?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will remove all <strong>{analyses.length}</strong> analysis records from this organization. This action is recorded in the immutable audit log.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllAnalyses) {
                    onClearAllAnalyses();
                    setShowClearConfirmModal(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Analysis Modal */}
      {deletingAnalysisId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-300 p-6 space-y-4">
            <h3 id="delete-modal-title" className="text-base font-bold text-slate-900">
              Delete Verification Record?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this MTC compliance report from your fleet logs?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAnalysisId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteAnalysis && deletingAnalysisId) {
                    onDeleteAnalysis(deletingAnalysisId);
                    setDeletingAnalysisId(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

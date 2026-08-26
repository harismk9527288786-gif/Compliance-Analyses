import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  FileText,
  Plus,
  Trash2,
  ArrowRight,
  Filter,
  Download,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { AnalysisRecord, RequirementSet, User } from '../types';
import { exportFleetToExcel } from '../utils/exportUtils';

interface HistoryViewProps {
  analyses: AnalysisRecord[];
  requirementSets: RequirementSet[];
  currentUser?: User;
  onSelectAnalysis: (id: string) => void;
  onOpenNewComparison: () => void;
  onClearAllAnalyses?: () => void;
  onDeleteAnalysis?: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  analyses,
  currentUser: _currentUser,
  onSelectAnalysis,
  onOpenNewComparison,
  onClearAllAnalyses,
  onDeleteAnalysis,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'deviations' | 'gaps'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);

  // Aggregate stats
  const list = Array.isArray(analyses) ? analyses : [];
  const totalRecords = list.length;
  const totalPass = list.filter((a) => a && (a.deviationCount || 0) === 0 && (a.documentationGapCount || 0) === 0 && (a.passCount || 0) > 0).length;
  const totalDeviations = list.filter((a) => a && (a.deviationCount || 0) > 0).length;
  const totalGaps = list.filter((a) => a && (a.documentationGapCount || 0) > 0 && (a.deviationCount || 0) === 0).length;

  // Unique suppliers
  const suppliers = Array.from(new Set(list.map((a) => a?.supplierName).filter(Boolean)));

  const filteredAnalyses = list.filter((a) => {
    if (!a) return false;
    const q = (searchQuery || '').toLowerCase();
    const title = (a.title || '').toLowerCase();
    const mtcNumber = (a.mtcNumber || '').toLowerCase();
    const supplierName = (a.supplierName || '').toLowerCase();
    const materialGrade = (a.materialGrade || '').toLowerCase();
    const poNumber = (a.poNumber || '').toLowerCase();
    const heats = Array.isArray(a.heats) ? a.heats : [];

    const matchesSearch =
      title.includes(q) ||
      mtcNumber.includes(q) ||
      supplierName.includes(q) ||
      materialGrade.includes(q) ||
      poNumber.includes(q) ||
      heats.some((h) => String(h || '').toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (selectedSupplier !== 'all' && a.supplierName !== selectedSupplier) return false;
    if (statusFilter === 'deviations') return (a.deviationCount || 0) > 0;
    if (statusFilter === 'gaps') return (a.documentationGapCount || 0) > 0;
    if (statusFilter === 'pass') return a.status === 'approved' || ((a.deviationCount || 0) === 0 && (a.documentationGapCount || 0) === 0);
    return true;
  });

  // Escape key handler for dialogs
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

  const exportTableCSV = () => {
    if (filteredAnalyses.length === 0) return;
    const headers = ['MTC Number', 'PO Number', 'Supplier', 'Material Grade', 'Heats', 'Requirement Set', 'Pass Checks', 'Deviations', 'Doc Gaps', 'Status', 'Date', 'Reviewed By'];
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
      a.createdByName,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MTC_Verification_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* 1. Header Card */}
      <section
        aria-label="History Overview"
        className="bg-white rounded-xl p-6 sm:p-7 border border-slate-300 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Immutable Verification Archive</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">Fleet Logs</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Verification History & Audit Log
          </h1>

          <p className="text-xs text-slate-600 max-w-2xl font-normal leading-relaxed">
            Deterministic evaluation records, heat-level chemical and mechanical compliance logs, and QC sign-off archives.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {analyses.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportFleetToExcel(filteredAnalyses)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                title="Export complete fleet archive to multi-sheet Excel spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={exportTableCSV}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                title="Export filtered records as CSV"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenNewComparison}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            <span>Verify New MTC</span>
          </button>
        </div>
      </section>

      {/* 2. Statistical Metric Summary */}
      <section aria-label="History Metrics" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left bg-white rounded-xl p-4 border shadow-2xs space-y-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
            statusFilter === 'all'
              ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono">Total Evaluations</span>
          <div className="text-2xl font-bold font-mono text-slate-900">{totalRecords}</div>
          <p className="text-[11px] text-slate-500">All MTC Certificates</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'pass' ? 'all' : 'pass')}
          className={`text-left bg-white rounded-xl p-4 border shadow-2xs space-y-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
            statusFilter === 'pass'
              ? 'border-emerald-600 ring-1 ring-emerald-600 bg-emerald-50'
              : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider font-mono">Conforming</span>
          <div className="text-2xl font-bold font-mono text-emerald-700">{totalPass}</div>
          <p className="text-[11px] text-slate-500">Passed all MDS limits</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'deviations' ? 'all' : 'deviations')}
          className={`text-left bg-white rounded-xl p-4 border shadow-2xs space-y-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
            statusFilter === 'deviations'
              ? 'border-rose-600 ring-1 ring-rose-600 bg-rose-50'
              : 'border-slate-300 hover:border-rose-400 hover:bg-rose-50'
          }`}
        >
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider font-mono">Deviations</span>
          <div className="text-2xl font-bold font-mono text-rose-700">{totalDeviations}</div>
          <p className="text-[11px] text-slate-500">Out-of-specification</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'gaps' ? 'all' : 'gaps')}
          className={`text-left bg-white rounded-xl p-4 border shadow-2xs space-y-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
            statusFilter === 'gaps'
              ? 'border-amber-600 ring-1 ring-amber-600 bg-amber-50'
              : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider font-mono">Documentation Gaps</span>
          <div className="text-2xl font-bold font-mono text-amber-700">{totalGaps}</div>
          <p className="text-[11px] text-slate-500">Missing NDE / certs</p>
        </button>
      </section>

      {/* 3. Filter Toolbar & Table */}
      <section aria-label="Archive Records Table" className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Segmented Filter Control */}
          <div role="tablist" aria-label="Archive Filters" className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-300 text-xs max-w-full overflow-x-auto">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              All Records ({analyses.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'pass'}
              onClick={() => setStatusFilter('pass')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'pass'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
              <span>Conforming ({totalPass})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'deviations'}
              onClick={() => setStatusFilter('deviations')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'deviations'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-800 hover:text-rose-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
              <span>Deviations ({totalDeviations})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'gaps'}
              onClick={() => setStatusFilter('gaps')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'gaps'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:text-amber-900'
              }`}
            >
              <FileQuestion className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
              <span>Doc Gaps ({totalGaps})</span>
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap max-w-full">
            {/* Supplier Filter */}
            {suppliers.length > 1 && (
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="p-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
              >
                <option value="all">All Mill Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search MTC / Heat / PO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-900"
              />
            </div>

            {/* Clear All Records Button */}
            {analyses.length > 0 && onClearAllAnalyses && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                title="Clear all archive records"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Clear archive</span>
              </button>
            )}
          </div>
        </div>

        {/* Technical Data Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto w-full max-w-full">
          {filteredAnalyses.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-800">No records found in archive</p>
              <p className="text-[11px] text-slate-500">Try clearing active search filters.</p>
            </div>
          ) : (
            <table role="table" className="w-full text-left border-collapse min-w-[760px]">
              <caption className="sr-only">List of historical Material Test Certificate verification logs</caption>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th scope="col" className="py-2.5 px-4">Certificate / PO</th>
                  <th scope="col" className="py-2.5 px-3">Supplier & Material</th>
                  <th scope="col" className="py-2.5 px-3">Target Specification</th>
                  <th scope="col" className="py-2.5 px-3">Compliance Status Rail</th>
                  <th scope="col" className="py-2.5 px-3">Date</th>
                  <th scope="col" className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {filteredAnalyses.map((analysis) => {
                  const hasDeviations = analysis.deviationCount > 0;
                  const hasGaps = analysis.documentationGapCount > 0;
                  const isApproved = analysis.status === 'approved';

                  return (
                    <tr
                      key={analysis.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`View archive record for MTC ${analysis.mtcNumber}`}
                      onClick={() => onSelectAnalysis(analysis.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAnalysis(analysis.id);
                        }
                      }}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {analysis.mtcNumber}
                        </div>
                        {analysis.poNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">PO: {analysis.poNumber}</div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{analysis.supplierName}</div>
                        <div className="text-[11px] text-slate-600">
                          {analysis.materialGrade}
                          {analysis.heats?.length ? (
                            <span className="font-mono text-slate-500 ml-1">({analysis.heats.join(', ')})</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-medium truncate max-w-[220px]">{analysis.requirementSetTitle}</div>
                      </td>

                      <td className="py-3 px-3">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                            <span>APPROVED</span>
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

                      <td className="py-3 px-3 text-[11px] text-slate-500 font-mono">
                        {new Date(analysis.createdAt).toLocaleDateString()}
                      </td>

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
                            Inspect
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
          aria-labelledby="clear-history-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-300 p-6 space-y-4">
            <h3 id="clear-history-title" className="text-base font-bold text-slate-900">
              Clear All Historical Records?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will purge all <strong>{analyses.length}</strong> archived records from the organization.
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

      {/* Delete Single Record Modal */}
      {deletingAnalysisId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-history-record-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-300 p-6 space-y-4">
            <h3 id="delete-history-record-title" className="text-base font-bold text-slate-900">
              Delete Verification Record?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this record from the archive?
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

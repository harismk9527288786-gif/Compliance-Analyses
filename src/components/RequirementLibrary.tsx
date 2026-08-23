import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Lock,
  ChevronRight,
  X,
  Trash2,
  Cpu,
} from 'lucide-react';
import { RequirementSet, User } from '../types';

interface RequirementLibraryProps {
  requirementSets: RequirementSet[];
  currentUser: User;
  onSelectSetForComparison?: (setId: string) => void;
  onCreateRequirementSet?: (set: Partial<RequirementSet>) => Promise<void>;
  onDeleteRequirementSet?: (setId: string) => Promise<void>;
  onClearAllRequirementSets?: () => Promise<void>;
  onLoadStandardTemplates?: () => Promise<void>;
}

export const RequirementLibrary: React.FC<RequirementLibraryProps> = ({
  requirementSets,
  onSelectSetForComparison,
  onCreateRequirementSet,
  onDeleteRequirementSet,
  onClearAllRequirementSets,
  onLoadStandardTemplates,
}) => {
  const [selectedSetId, setSelectedSetId] = useState<string>(requirementSets[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClearLibraryModal, setShowClearLibraryModal] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

  // New spec form state
  const [newClientName, setNewClientName] = useState('');
  const [newMaterialGrade, setNewMaterialGrade] = useState('ASTM A105N');
  const [newMdsNumber, setNewMdsNumber] = useState('');
  const [newRevision, setNewRevision] = useState('Rev A');
  const [newTitle, setNewTitle] = useState('');

  const selectedSet = requirementSets.find((s) => s.id === selectedSetId) || requirementSets[0];

  const filteredRequirements = (selectedSet?.requirements || []).filter((req) => {
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesSearch =
      req.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.description && req.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.clauseReference && req.clauseReference.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Escape key handler for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowClearLibraryModal(false);
        setDeletingSetId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateRequirementSet) return;

    await onCreateRequirementSet({
      clientName: newClientName || 'Client Spec',
      materialGrade: newMaterialGrade,
      mdsNumber: newMdsNumber || 'MDS-SPEC-01',
      revision: newRevision || 'Rev A',
      title: newTitle || `${newClientName} ${newMaterialGrade} Specification`,
      requirements: selectedSet?.requirements || [], // clone base requirements
    });

    setShowCreateModal(false);
    setNewClientName('');
    setNewMdsNumber('');
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <section
        aria-label="Library Header"
        className="bg-white rounded-xl p-6 border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold font-mono bg-slate-100 text-slate-800 border border-slate-300">
              MDS Specification Repository
            </span>
            <span className="text-xs text-slate-500 font-mono">Immutable Rules</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1.5">
            Material Data Sheet Requirement Library
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Authoritative, version-controlled client specifications used for deterministic verification.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {requirementSets.length > 0 && onClearAllRequirementSets && (
            <button
              type="button"
              onClick={() => setShowClearLibraryModal(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Library ({requirementSets.length})</span>
            </button>
          )}
          {onLoadStandardTemplates && (
            <button
              type="button"
              onClick={onLoadStandardTemplates}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              title="Load industry benchmark specifications (ASTM A105N, Shell, Aramco)"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Load Benchmark Specs</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            <span>New Specification</span>
          </button>
        </div>
      </section>

      {/* Grid: Left spec list, Right requirements matrix */}
      {requirementSets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-12 text-center space-y-4">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Specification Library is Empty</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              No Material Data Sheet (MDS) specifications loaded. Create a custom specification or load the industry benchmark specifications.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            {onLoadStandardTemplates && (
              <button
                type="button"
                onClick={onLoadStandardTemplates}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 shadow-xs transition-colors cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Cpu className="w-4 h-4 stroke-[2.5] text-emerald-400" aria-hidden="true" />
                <span>Load Benchmark Specs (A105N, Shell, Aramco)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>Create New Specification</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Specification Cards */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
              Client Specifications ({requirementSets.length})
            </h2>

            <div className="space-y-2">
              {requirementSets.map((set) => {
                const isSelected = set.id === selectedSet?.id;
                return (
                  <div
                    key={set.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Select specification ${set.title}`}
                    onClick={() => setSelectedSetId(set.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSetId(set.id);
                      }
                    }}
                    className={`p-4 rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-800 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{set.clientName}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isSelected
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-slate-200 text-slate-800 border-slate-300'
                          }`}
                        >
                          {set.revision}
                        </span>
                        {onDeleteRequirementSet && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSetId(set.id);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isSelected
                                ? 'text-slate-400 hover:text-rose-300 hover:bg-slate-800'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title="Delete this specification"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="sr-only">Delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`text-xs mt-1.5 font-bold ${isSelected ? 'text-slate-100' : 'text-slate-900'}`}>
                      {set.materialGrade}
                    </div>

                    <div className={`text-[11px] font-mono truncate mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                      {set.mdsNumber}
                    </div>

                    <div
                      className={`flex items-center justify-between text-[10px] mt-2 pt-2 border-t font-mono ${
                        isSelected ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{set.requirements.length} Verifiable Clauses</span>
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" aria-hidden="true" />
                        <span>Immutable</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Requirements Clauses Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden flex flex-col p-6 space-y-4">
            {/* Top Bar for Selected Spec */}
            {selectedSet && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{selectedSet.title}</h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-800 border border-slate-300 font-bold">
                        {selectedSet.revision}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {selectedSet.mdsNumber} | Effective: {selectedSet.effectiveDate}
                    </p>
                  </div>

                  {onSelectSetForComparison && (
                    <button
                      type="button"
                      onClick={() => onSelectSetForComparison(selectedSet.id)}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <span>Use for Comparison</span>
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Filter and Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {['all', 'chemical', 'mechanical', 'hardness', 'heat_treatment', 'nde', 'general'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                          categoryFilter === cat
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                        }`}
                      >
                        {cat.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div className="relative sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="text"
                      placeholder="Filter clauses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Matrix Table */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto w-full max-w-full">
              <table role="table" className="w-full text-left text-xs border-collapse min-w-[640px]">
                <caption className="sr-only">List of engineering requirement clauses in selected specification</caption>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                    <th scope="col" className="py-2.5 px-3">Clause / Ref</th>
                    <th scope="col" className="py-2.5 px-3">Category</th>
                    <th scope="col" className="py-2.5 px-3">Property / Test</th>
                    <th scope="col" className="py-2.5 px-3">Rule / Limit</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No requirement clauses match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRequirements.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {req.clauseReference || '§ General'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 uppercase">
                            {req.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {req.displayName}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-800">
                          {req.operator === 'MIN' && `≥ ${req.minValue} ${req.unit || ''}`}
                          {req.operator === 'MAX' && `≤ ${req.maxValue} ${req.unit || ''}`}
                          {req.operator === 'RANGE' && `${req.minValue} – ${req.maxValue} ${req.unit || ''}`}
                          {req.operator === 'MATCH' && `Must match "${req.targetValue}"`}
                          {req.operator === 'REQUIRED' && 'Mandatory Test Certificate'}
                          {req.operator === 'FORBIDDEN' && 'Strictly Prohibited'}
                          {req.operator === 'AGGREGATE' && `Max ${req.maxValue} (${req.description})`}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          p. {req.sourcePage || 1}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Specification Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-spec-title"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="create-spec-title" className="text-base font-bold text-slate-900">
                Create New Specification
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSet} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client / Project Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hawa Valves / Saudi Aramco"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Material Grade:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ASTM A105N / A350 LF2"
                    value={newMaterialGrade}
                    onChange={(e) => setNewMaterialGrade(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">MDS Spec Number:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MDS-01-SAMSS-010"
                    value={newMdsNumber}
                    onChange={(e) => setNewMdsNumber(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Revision:</label>
                  <input
                    type="text"
                    value={newRevision}
                    onChange={(e) => setNewRevision(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Title (Optional):</label>
                  <input
                    type="text"
                    placeholder="Full Specification Title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Create Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Spec Confirmation Modal */}
      {deletingSetId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-spec-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-300 p-6 space-y-4">
            <h3 id="delete-spec-title" className="text-base font-bold text-slate-900">
              Delete Specification?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this specification from the library?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSetId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onDeleteRequirementSet && deletingSetId) {
                    await onDeleteRequirementSet(deletingSetId);
                    setDeletingSetId(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                Delete Specification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Library Confirmation Modal */}
      {showClearLibraryModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-library-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-300 p-6 space-y-4">
            <h3 id="clear-library-title" className="text-base font-bold text-slate-900">
              Clear All Specifications?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will remove all <strong>{requirementSets.length}</strong> specifications from your library.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearLibraryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onClearAllRequirementSets) {
                    await onClearAllRequirementSets();
                    setShowClearLibraryModal(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                Yes, Clear Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

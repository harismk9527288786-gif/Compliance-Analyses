import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  History,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  Building2,
  X,
  Save,
  Trash2,
} from 'lucide-react';
import { RequirementSet, Requirement, User } from '../types';

interface RequirementLibraryProps {
  requirementSets: RequirementSet[];
  currentUser: User;
  onSelectSetForComparison?: (setId: string) => void;
  onCreateRequirementSet?: (set: Partial<RequirementSet>) => Promise<void>;
  onDeleteRequirementSet?: (setId: string) => Promise<void>;
  onClearAllRequirementSets?: () => Promise<void>;
}

export const RequirementLibrary: React.FC<RequirementLibraryProps> = ({
  requirementSets,
  currentUser,
  onSelectSetForComparison,
  onCreateRequirementSet,
  onDeleteRequirementSet,
  onClearAllRequirementSets,
}) => {
  const [selectedSetId, setSelectedSetId] = useState<string>(requirementSets[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClearLibraryModal, setShowClearLibraryModal] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Versioned Quality Repository
            </span>
            <span className="text-xs text-slate-500">MDS & Specification Library</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Material Data Sheet Requirement Library
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative, immutable client specifications. Approved specifications cannot be silently edited.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {requirementSets.length > 0 && onClearAllRequirementSets && (
            <button
              onClick={() => setShowClearLibraryModal(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Library ({requirementSets.length})</span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Specification / Revision</span>
          </button>
        </div>
      </div>

      {/* Grid: Left spec list, Right requirements matrix */}
      {requirementSets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Specification Library is Empty</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No Material Data Sheet (MDS) specifications found. Create a new specification or upload client requirement documents to populate the library.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Specification</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Specification Cards */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Client Specifications ({requirementSets.length})
            </h3>

            <div className="space-y-2">
              {requirementSets.map((set) => {
                const isSelected = set.id === selectedSet?.id;
                return (
                  <div
                    key={set.id}
                    onClick={() => setSelectedSetId(set.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{set.clientName}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {set.revision}
                        </span>
                        {onDeleteRequirementSet && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSetId(set.id);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isSelected
                                ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title="Delete this specification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`text-xs mt-1 font-semibold ${isSelected ? 'text-slate-200' : 'text-slate-900'}`}>
                      {set.materialGrade}
                    </div>

                    <div className={`text-[11px] font-mono truncate mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                      {set.mdsNumber}
                    </div>

                    <div
                      className={`flex items-center justify-between text-[10px] mt-2 pt-2 border-t ${
                        isSelected ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{set.requirements.length} Clauses</span>
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Immutable
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {/* Right: Requirements Clauses Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Top Bar for Selected Spec */}
          {selectedSet && (
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{selectedSet.title}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-bold">
                      {selectedSet.revision}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {selectedSet.mdsNumber} | Effective: {selectedSet.effectiveDate}
                  </p>
                </div>

                {onSelectSetForComparison && (
                  <button
                    onClick={() => onSelectSetForComparison(selectedSet.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-xs self-start"
                  >
                    <span>Use for Comparison</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {['all', 'chemical', 'mechanical', 'heat_treatment', 'hardness', 'nde', 'certification'].map(
                    (cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap capitalize transition-colors ${
                          categoryFilter === cat
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat === 'all' ? 'All Clauses' : cat.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search clauses, limits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Requirements Matrix */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Property / Test</th>
                  <th className="p-3">Rule Type</th>
                  <th className="p-3">Specified Acceptance Limit</th>
                  <th className="p-3">Clause Reference</th>
                  <th className="p-3">Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredRequirements.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3 uppercase text-[10px] font-mono text-slate-500">
                      {req.category}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {req.displayName}
                      {req.mandatory && (
                        <span className="ml-1 text-[9px] text-rose-600 font-bold">*</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {req.operator}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {req.operator === 'MIN' && `Min ${req.minValue} ${req.unit || ''}`}
                      {req.operator === 'MAX' && `Max ${req.maxValue} ${req.unit || ''}`}
                      {req.operator === 'RANGE' && `${req.minValue} – ${req.maxValue} ${req.unit || ''}`}
                      {req.operator === 'MATCH' && `Must equal "${req.targetValue}"`}
                      {req.operator === 'REQUIRED' && 'Mandatory Test Certificate Required'}
                      {req.operator === 'FORBIDDEN' && 'Strictly Prohibited'}
                      {req.operator === 'AGGREGATE' && `Max CE ${req.maxValue}`}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">
                      {req.clauseReference || 'N/A'}
                    </td>
                    <td className="p-3 text-slate-400 font-mono">
                      Page {req.sourcePage || 1}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Create New Requirement Set Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Create New Client Specification
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSet} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Name: *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TotalEnergies E&P"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material Grade:</label>
                  <input
                    type="text"
                    value={newMaterialGrade}
                    onChange={(e) => setNewMaterialGrade(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Revision Level:</label>
                  <input
                    type="text"
                    value={newRevision}
                    onChange={(e) => setNewRevision(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">MDS Document Number: *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GS-EP-PVV-112"
                  value={newMdsNumber}
                  onChange={(e) => setNewMdsNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specification Title:</label>
                <input
                  type="text"
                  placeholder="e.g. Carbon Steel Forgings for Sour Service"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
                <strong>Immutability Governance:</strong> Newly registered specification sets will be initialized with baseline ASTM/NACE clauses and sealed under version control.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow cursor-pointer"
                >
                  Save Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear All Library Modal */}
      {showClearLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Clear Specification Library?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  This will remove all <strong>{requirementSets.length}</strong> client MDS specifications from the quality library.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowClearLibraryModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onClearAllRequirementSets) {
                    setIsDeleting(true);
                    try {
                      await onClearAllRequirementSets();
                      setShowClearLibraryModal(false);
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Clearing...' : 'Yes, Clear All Specs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Specification Modal */}
      {deletingSetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Specification?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to delete this specification? All associated clauses and thresholds in this set will be removed from the library.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeletingSetId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onDeleteRequirementSet && deletingSetId) {
                    setIsDeleting(true);
                    try {
                      await onDeleteRequirementSet(deletingSetId);
                      setDeletingSetId(null);
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Specification'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

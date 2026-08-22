import React, { useState, useEffect } from 'react';
import {
  X,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { TestSuiteResult } from '../types';
import { runAllTestCases } from '../engine/testSuite';

interface TestSuiteModalProps {
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ onClose }) => {
  const [results, setResults] = useState<TestSuiteResult[]>(() => runAllTestCases());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setResults(runAllTestCases());
      setIsRunning(false);
    }, 400);
  };

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0).toFixed(2);

  const categories = ['all', ...Array.from(new Set(results.map((r) => r.category || 'General')))];

  const filteredResults = results.filter(
    (r) => selectedCategory === 'all' || r.category === selectedCategory
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-suite-title"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 text-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <PlayCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="test-suite-title" className="text-base font-bold text-white">
                  Automated Deterministic Verification Suite
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                  {passed} / {results.length} PASSED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Executes all compliance engine rule verification tests
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRerun}
              disabled={isRunning}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Re-run Suite</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <X className="w-5 h-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats Strip */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 stroke-[2.5]" aria-hidden="true" />
              <span className="text-xs font-bold text-slate-900">{passed} Passed</span>
            </div>
            {failed > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-700 stroke-[2.5]" aria-hidden="true" />
                <span className="text-xs font-bold text-rose-700">{failed} Failed</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Execution Time: {totalDuration} ms</span>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                }`}
              >
                {cat === 'all' ? 'All Tests' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Test List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-100/60">
          {filteredResults.map((tc) => {
            const isPass = tc.status === 'passed';
            return (
              <div
                key={tc.id}
                className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        isPass
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {tc.id}
                    </span>
                    <h3 className="font-bold text-slate-900">{tc.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">{tc.durationMs} ms</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono ${
                        isPass
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {isPass ? (
                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                      )}
                      <span>{tc.status}</span>
                    </span>
                  </div>
                </div>

                <p className="text-slate-600">{tc.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">EXPECTED</span>
                    <span className="text-slate-800 font-semibold">{tc.expected}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">ACTUAL</span>
                    <span className="text-slate-900 font-bold">{tc.actual}</span>
                  </div>
                </div>

                {tc.details && (
                  <div className="text-[11px] text-slate-500 font-mono pt-1">
                    Details: {tc.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

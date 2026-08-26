import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Calendar,
  Database,
  Download,
  Clock,
  CheckCircle2,
  FileCheck,
  Lock,
  X,
  RefreshCw,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Organization, RetentionPolicyInfo } from '../types';
import { apiFetch } from '../utils/api';

interface DataRetentionModalProps {
  currentOrg: Organization;
  totalAnalysesCount: number;
  onClose: () => void;
}

export const DataRetentionModal: React.FC<DataRetentionModalProps> = ({
  currentOrg,
  totalAnalysesCount,
  onClose,
}) => {
  const [policyInfo, setPolicyInfo] = useState<RetentionPolicyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        setIsLoading(true);
        const res = await apiFetch('/api/retention-policy');
        if (res.ok) {
          const data = await res.json();
          setPolicyInfo(data.policy);
        }
      } catch (err) {
        console.error('Failed to load retention policy info:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="retention-policy-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="retention-policy-title" className="text-base font-bold text-white tracking-tight">
                Data Retention &amp; Security Policy
              </h2>
              <p className="text-xs text-slate-400">
                30-Day Guaranteed Cloud Storage &amp; Tenancy Terms
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Policy Highlights Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-emerald-400 font-mono">
                <Clock className="w-4 h-4" />
                <span>30 Days</span>
              </div>
              <div className="text-xs font-bold text-white">Guaranteed Retention</div>
              <div className="text-[11px] text-slate-400">All MTC records &amp; logs retained for 30 days.</div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-sky-400 font-mono">
                <Database className="w-4 h-4" />
                <span>Database Sync</span>
              </div>
              <div className="text-xs font-bold text-white">Render PostgreSQL</div>
              <div className="text-[11px] text-slate-400">PostgreSQL cloud storage with persistent disk sync.</div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-amber-400 font-mono">
                <Lock className="w-4 h-4" />
                <span>Tenancy &amp; RBAC</span>
              </div>
              <div className="text-xs font-bold text-white">Strict Org Isolation</div>
              <div className="text-[11px] text-slate-400">Encrypted credentials with tenant separation.</div>
            </div>
          </div>

          {/* Detailed Policy Terms */}
          <div className="space-y-3 text-xs text-slate-300 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 leading-relaxed">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Retention Policy Specifics</span>
            </h3>
            
            <ul className="space-y-2 pl-1 list-none">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">&bull;</span>
                <span>
                  <strong>Account &amp; Organization Data:</strong> User profiles, roles, and organization tenancy settings are preserved securely for ongoing access.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">&bull;</span>
                <span>
                  <strong>30-Day Analysis Lifecycle:</strong> Material Test Certificate (MTC) analyses, chemical/mechanical discrepancy evaluations, and client MDS specifications are guaranteed and active for <strong>30 days from upload</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">&bull;</span>
                <span>
                  <strong>Immutable Quality Audit Trails:</strong> Cryptographic SHA-256 document checksums and reviewer sign-off actions are logged for ISO 9001 compliance verification.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">&bull;</span>
                <span>
                  <strong>1-Click Export Recommendation:</strong> Export formal PDF Technical Verification Reports and Excel compliance logs before the 30-day window for permanent customer archives.
                </span>
              </li>
            </ul>
          </div>

          {/* Current Workspace Status */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-white flex items-center gap-2">
                <span>Active Organization:</span>
                <span className="text-emerald-400 font-mono">{currentOrg?.name || 'My Organization'} ({currentOrg?.code || 'ORG'})</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Active Verification Records: <span className="text-white font-mono font-bold">{totalAnalysesCount || 0} analyses</span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>30-Day Policy Compliant</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="text-[11px] text-slate-400 font-mono">
            Render Cloud Storage &bull; 30-Day Retention Active
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
};

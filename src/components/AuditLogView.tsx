import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  User,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Lock,
} from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditLogViewProps {
  auditLogs: AuditEvent[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.objectType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.objectName && log.objectName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesAction && matchesSearch;
  });

  const actionTypes = [
    { id: 'all', label: 'All Actions' },
    { id: 'UPLOAD_DOCUMENT', label: 'Document Uploads' },
    { id: 'START_ANALYSIS', label: 'Analysis Execution' },
    { id: 'RUN_ANALYSIS', label: 'Engine Executions' },
    { id: 'OVERRIDE_FINDING', label: 'Reviewer Overrides' },
    { id: 'APPROVE_ANALYSIS', label: 'Approvals & Sign-offs' },
    { id: 'CREATE_REQUIREMENT_SET', label: 'Spec Creations' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Enterprise Compliance Ledger
            </span>
            <span className="text-xs text-slate-500">ISO 9001 & ASME Section III Trail</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Tamper-Evident Audit & Verification Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Every file ingestion, rule engine execution, reviewer override, and technical sign-off is immutably recorded.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          <Lock className="w-3.5 h-3.5 text-slate-600" />
          <span>Tenant Organization Isolated</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {actionTypes.map((act) => (
              <button
                key={act.id}
                onClick={() => setActionFilter(act.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  actionFilter === act.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actors, actions, documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor & Role</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Target Resource</th>
                <th className="p-3">Details & Audit Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900">{log.actorName}</div>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {log.actorRole}
                      </span>
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          log.action.includes('APPROVE')
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : log.action.includes('OVERRIDE')
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : log.action.includes('REJECT')
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{log.objectName || log.objectId}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Type: {log.objectType}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[11px] text-slate-600">
                      {log.details ? (
                        <span className="truncate block max-w-sm">
                          {JSON.stringify(log.details)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

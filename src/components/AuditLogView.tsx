import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Lock,
  Download,
} from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditLogViewProps {
  auditLogs: AuditEvent[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const list = Array.isArray(auditLogs) ? auditLogs : [];
  const filteredLogs = list.filter((log) => {
    if (!log) return false;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const q = (searchQuery || '').toLowerCase();
    const actorName = (log.actorName || '').toLowerCase();
    const action = (log.action || '').toLowerCase();
    const objectType = (log.objectType || '').toLowerCase();
    const objectName = (log.objectName || '').toLowerCase();

    const matchesSearch =
      actorName.includes(q) ||
      action.includes(q) ||
      objectType.includes(q) ||
      objectName.includes(q);

    return matchesAction && matchesSearch;
  });

  const exportAuditLogsCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp UTC', 'Actor Name', 'Actor Role', 'Action Event', 'Object Type', 'Object ID', 'Object Name', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.actorName,
      l.actorRole,
      l.action,
      l.objectType,
      l.objectId,
      l.objectName || 'N/A',
      typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details || ''),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Compliance_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const actionTypes = [
    { id: 'all', label: 'All Actions' },
    { id: 'UPLOAD_DOCUMENT', label: 'Document Uploads' },
    { id: 'RUN_ANALYSIS', label: 'Engine Executions' },
    { id: 'OVERRIDE_FINDING', label: 'Reviewer Overrides' },
    { id: 'APPROVE_ANALYSIS', label: 'Approvals & Sign-offs' },
    { id: 'CREATE_REQUIREMENT_SET', label: 'Spec Creations' },
  ];

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <section
        aria-label="Audit Header"
        className="bg-white rounded-xl p-6 border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold font-mono bg-slate-100 text-slate-800 border border-slate-300">
              ISO 9001 & EN 10204 Audit Trail
            </span>
            <span className="text-xs text-slate-500 font-mono">Immutable Compliance Ledger</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1.5">
            Tamper-Evident Verification & Sign-Off Trail
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Every file ingestion, rule engine execution, reviewer override, and technical sign-off is immutably recorded.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {auditLogs.length > 0 && (
            <button
              type="button"
              onClick={exportAuditLogsCSV}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              title="Export filtered audit logs as CSV"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Audit Trail (CSV)</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-lg">
            <Lock className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Tenant Isolated & Cryptographically Grounded</span>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section aria-label="Audit Events List" className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {actionTypes.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => setActionFilter(act.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                  actionFilter === act.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search actors, actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
            />
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto w-full max-w-full">
          <table role="table" className="w-full text-left text-xs border-collapse min-w-[760px]">
            <caption className="sr-only">List of immutable audit events for material verification operations</caption>
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                <th scope="col" className="py-2.5 px-4">Timestamp (UTC)</th>
                <th scope="col" className="py-2.5 px-3">Actor & Role</th>
                <th scope="col" className="py-2.5 px-3">Action Event</th>
                <th scope="col" className="py-2.5 px-3">Target Object</th>
                <th scope="col" className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                    No matching compliance audit entries found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.actorName}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-mono">{log.actorRole}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          log.action.includes('OVERRIDE')
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : log.action.includes('APPROVE')
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : log.action.includes('REJECT')
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 truncate max-w-xs">{log.objectName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Type: {log.objectType} | ID: {log.objectId}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-600">
                      {log.details ? (
                        <span className="truncate max-w-xs block text-right">
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
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
      </section>
    </div>
  );
};

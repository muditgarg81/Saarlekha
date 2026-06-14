import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { Shield, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import clsx from 'clsx';

interface AuditLog {
  id: string;
  action: 'CREATE' | 'EDIT' | 'DELETE' | 'APPROVE' | 'REJECT';
  entity_type: string;
  entity_id: string;
  details: Record<string, any> | null;
  timestamp: string;
  user: { email: string; role: string };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  EDIT: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  APPROVE: 'bg-teal-100 text-teal-700',
  REJECT: 'bg-orange-100 text-orange-700',
};

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', {
        params: { page, limit, action: filterAction || undefined, entity: filterEntity || undefined }
      });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Audit Log
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Immutable record of all create, edit, delete, approve, and reject actions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Shield className="h-4 w-4 text-green-600" />
          <span className="text-green-700 font-medium">Append-only — no entries can be modified</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-card p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <Filter className="h-4 w-4 text-text-secondary self-center" />
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Action</label>
          <select
            className="border border-border rounded-md px-3 py-1.5 text-sm"
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="EDIT">EDIT</option>
            <option value="DELETE">DELETE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REJECT">REJECT</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Entity Type</label>
          <select
            className="border border-border rounded-md px-3 py-1.5 text-sm"
            value={filterEntity}
            onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
          >
            <option value="">All Entities</option>
            <option value="User">User</option>
            <option value="Manpower">Manpower</option>
            <option value="Customer">Customer</option>
            <option value="Item">Item</option>
            <option value="ReportFormat">ReportFormat</option>
            <option value="ReportFormatVersion">ReportFormatVersion</option>
            <option value="JobOrder">JobOrder</option>
            <option value="Machine">Machine</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-text-secondary">
          {total} total entries
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-text-secondary">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-surface transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">{log.user?.email}</div>
                      <div className="text-xs text-text-secondary capitalize">
                        {log.user?.role.replace('_', ' ').toLowerCase()}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide',
                        ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">{log.entity_type}</span>
                      <span className="ml-1 text-xs text-text-secondary font-mono">
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block sm:hidden divide-y divide-border bg-white">
          {loading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border border-border rounded-card p-4 shadow-sm space-y-3 bg-white animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No audit log entries found.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="border border-border rounded-card p-4 shadow-sm space-y-3 bg-white hover:border-primary transition-all relative"
                >
                  {/* Header: Timestamp, Action Badge */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-semibold text-text-secondary font-mono tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide',
                      ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                    )}>
                      {log.action}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="text-xs space-y-2">
                    {/* User */}
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">User:</span>
                      <div className="text-right">
                        <div className="font-semibold text-text-primary">{log.user?.email}</div>
                        <div className="text-[10px] text-text-secondary capitalize">
                          {log.user?.role.replace('_', ' ').toLowerCase()}
                        </div>
                      </div>
                    </div>
                    {/* Entity */}
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">Entity:</span>
                      <span className="font-medium text-text-primary">
                        {log.entity_type} <span className="text-xs font-mono text-text-secondary">({log.entity_id.slice(0, 8)}…)</span>
                      </span>
                    </div>
                    {/* Details block */}
                    {log.details && (
                      <div className="bg-surface/50 p-2.5 rounded border border-border/40 text-[11px] overflow-x-auto font-mono max-h-32 overflow-y-auto">
                        <span className="block text-[9px] text-text-secondary uppercase font-semibold font-sans mb-1">Details</span>
                        <pre className="text-text-primary whitespace-pre-wrap word-break">
                          {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-white">
            <span className="text-sm text-text-secondary">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded border border-border text-text-secondary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded border border-border text-text-secondary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import { ArrowLeft, ClipboardList, Building, User, Calendar, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

interface FormatMeta {
  id: string;
  name: string;
  type: string;
}

interface ProductionLog {
  id: string;
  date: string;
  department: string;
  format: FormatMeta;
  fieldsSchema: { name: string; type: string; unit?: string }[];
  productionQty: number;
  submitter: string;
  payload: Record<string, any>;
}

interface QualityLog {
  id: string;
  date: string;
  department: string;
  format: FormatMeta;
  fieldsSchema: { name: string; type: string; unit?: string }[];
  submitter: string;
  payload: Record<string, any>;
}

interface JobOrderSummaryData {
  id: string;
  jobOrderNumber: string;
  clientName: string;
  orderedQty: number | null;
  orderedQtyUnit: string;
  totalProducedQty: number;
  balanceQty: number;
  productionLogs: ProductionLog[];
  qualityLogs: QualityLog[];
}

export function JobOrderSummary() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<JobOrderSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedQualityGroups, setCollapsedQualityGroups] = useState<Record<string, boolean>>({});

  const fetchSummary = useCallback(async () => {
    if (!orderNumber) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/job-orders/by-number/${encodeURIComponent(orderNumber)}/summary`);
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || `Failed to fetch summary for Job Order ${orderNumber}`);
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Group Quality entries by format ID
  const groupedQualityEntries = useMemo(() => {
    if (!data?.qualityLogs) return [];
    const groups: Record<string, {
      formatId: string;
      formatName: string;
      fields: { name: string; type: string; unit?: string }[];
      entries: QualityLog[];
    }> = {};

    data.qualityLogs.forEach(entry => {
      const formatId = entry.format.id;
      if (!groups[formatId]) {
        groups[formatId] = {
          formatId,
          formatName: entry.format.name,
          fields: entry.fieldsSchema || [],
          entries: []
        };
      }
      groups[formatId].entries.push(entry);
    });

    return Object.values(groups);
  }, [data?.qualityLogs]);

  // Toggle collapsable sections for Quality formats
  const toggleQualityGroup = (formatId: string) => {
    setCollapsedQualityGroups(prev => ({
      ...prev,
      [formatId]: !prev[formatId]
    }));
  };

  // Collect all unique fields across quality logs for unified Excel/PDF exports
  const allUniqueQualityFields = useMemo(() => {
    if (!data?.qualityLogs) return [];
    const fieldMap = new Map<string, { name: string; type: string; unit?: string }>();
    data.qualityLogs.forEach(e => {
      const versionFields = e.fieldsSchema || [];
      versionFields.forEach(f => {
        const key = f.name.toLowerCase().trim();
        if (!fieldMap.has(key)) {
          fieldMap.set(key, f);
        }
      });
    });
    return Array.from(fieldMap.values());
  }, [data?.qualityLogs]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-text-secondary animate-pulse">
        Loading Job Order Summary...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-semibold text-primary hover:underline gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">
          {error || 'Job Order not found.'}
        </div>
      </div>
    );
  }

  const orderQty = data.orderedQty ?? 0;
  const unit = data.orderedQtyUnit || 'units';

  // Export configurations for Production logs
  const prodExportColumns = [
    { header: 'Date', key: 'date' },
    { header: 'Department', key: 'department' },
    { header: 'Format', key: 'format' },
    { header: 'Produced Qty', key: 'productionQty' },
    { header: 'Submitted By', key: 'submitter' }
  ];

  const prodExportRows = data.productionLogs.map(log => ({
    date: new Date(log.date).toLocaleDateString(),
    department: log.department,
    format: log.format?.name ?? 'N/A',
    productionQty: log.productionQty,
    submitter: log.submitter
  }));

  const isCompleted = data.balanceQty <= 0 && orderQty > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-md border border-border bg-white text-text-secondary hover:bg-surface hover:text-text-primary transition-all"
            title="Go Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-primary" /> {data.jobOrderNumber}
              </h1>
              <span className={clsx(
                "px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full",
                isCompleted 
                  ? "bg-green-100 text-green-800" 
                  : data.balanceQty === orderQty 
                    ? "bg-blue-100 text-blue-800" 
                    : "bg-yellow-100 text-yellow-800"
              )}>
                {isCompleted ? 'Completed' : data.balanceQty === orderQty ? 'Open' : 'In Progress'}
              </span>
            </div>
            <p className="text-sm text-text-secondary flex items-center gap-1.5 mt-0.5">
              <Building className="h-3.5 w-3.5" /> {data.clientName}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ordered Card */}
        <div className="bg-white rounded-card border border-border shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Ordered Qty</span>
            <div className="text-2xl font-bold text-text-primary mt-2 tabular-nums">
              {orderQty.toLocaleString()} <span className="text-sm font-medium text-text-secondary">{unit}</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-text-secondary flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-text-secondary" /> Initial order requirement
          </div>
        </div>

        {/* Produced Card */}
        <div className="bg-white rounded-card border border-border shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Total Produced Qty</span>
            <div className="text-2xl font-bold text-primary mt-2 tabular-nums">
              {data.totalProducedQty.toLocaleString()} <span className="text-sm font-medium text-text-secondary">{unit}</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-text-secondary flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-secondary" /> Sum of all production report entry logs
          </div>
        </div>

        {/* Balance Card */}
        <div className={clsx(
          "rounded-card border shadow-sm p-6 flex flex-col justify-between",
          isCompleted 
            ? "bg-green-50/50 border-green-200" 
            : "bg-white border-border"
        )}>
          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Balance Qty</span>
            <div className={clsx(
              "text-2xl font-bold mt-2 tabular-nums",
              isCompleted ? "text-green-700" : "text-amber-600"
            )}>
              {data.balanceQty.toLocaleString()} <span className="text-sm font-medium text-text-secondary">{unit}</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-text-secondary flex items-center gap-1">
            {isCompleted ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-700 font-medium">Order requirements fully satisfied</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Remaining quantity to be produced</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Production Logs Section */}
      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-text-primary">Production Entry Logs</h2>
          <div className="flex items-center gap-3">
            {data.productionLogs.length > 0 && (
              <ExportBar loading={loading} opts={{
                title: `Production Logs - ${data.jobOrderNumber}`,
                subtitle: `Client: ${data.clientName} | Total Produced: ${data.totalProducedQty} ${unit}`,
                filename: `job_order_production_${data.jobOrderNumber}`,
                columns: prodExportColumns,
                rows: prodExportRows
              } as ExportOptions} />
            )}
            <span className="text-sm text-text-secondary font-medium">{data.productionLogs.length} records</span>
          </div>
        </div>

        {data.productionLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            No production logs recorded against this Job Order.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Report Sheet Format</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Produced Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Submitted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {data.productionLogs.map(log => (
                  <tr 
                    key={log.id} 
                    onClick={() => navigate(`/data-entry?entryId=${log.id}`)}
                    className="hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-sm text-text-primary tabular-nums">
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {log.department}
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {log.format?.name ?? 'N/A'}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-text-primary font-semibold tabular-nums">
                      {log.productionQty.toLocaleString()} <span className="text-xs font-normal text-text-secondary">{unit}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-text-secondary" /> {log.submitter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quality Logs Section */}
      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-secondary" />
            <h2 className="text-base font-semibold text-text-primary">Quality Entry Logs</h2>
          </div>
          <div className="flex items-center gap-3">
            {data.qualityLogs.length > 0 && (
              <ExportBar loading={loading} opts={{
                title: `Quality Logs - ${data.jobOrderNumber}`,
                subtitle: `Client: ${data.clientName} | Total Quality Logs: ${data.qualityLogs.length}`,
                filename: `job_order_quality_${data.jobOrderNumber}`,
                columns: [
                  { header: 'Date', key: 'date' },
                  { header: 'Format', key: 'format' },
                  { header: 'Department', key: 'department' },
                  { header: 'Submitted By', key: 'submittedBy' },
                  ...allUniqueQualityFields.map((f: any) => ({ header: f.name + (f.unit ? ` (${f.unit})` : ''), key: f.name }))
                ],
                rows: data.qualityLogs.map(e => {
                  const rowData: Record<string, any> = {
                    date: new Date(e.date).toLocaleDateString(),
                    format: e.format?.name ?? '',
                    department: e.department ?? '',
                    submittedBy: e.submitter ?? '',
                  };
                  allUniqueQualityFields.forEach(f => {
                    rowData[f.name] = e.payload?.[f.name] ?? '';
                  });
                  return rowData;
                })
              } as ExportOptions} />
            )}
            <span className="text-sm text-text-secondary font-medium">{data.qualityLogs.length} records</span>
          </div>
        </div>

        {data.qualityLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            No quality logs recorded against this Job Order.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groupedQualityEntries.map(group => {
              const isCollapsed = collapsedQualityGroups[group.formatId];
              return (
                <div key={group.formatId} className="bg-white">
                  {/* Accordion Toggle Header */}
                  <div 
                    onClick={() => toggleQualityGroup(group.formatId)}
                    className="flex items-center justify-between px-6 py-4 bg-surface/50 border-b border-border cursor-pointer hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary text-sm">{group.formatName}</span>
                      <span className="text-xs text-text-secondary bg-gray-200 px-2 py-0.5 rounded-full font-mono font-semibold">{group.entries.length} logs</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-xs font-semibold">
                      <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Subsection logs table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-surface">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Department</th>
                            {group.fields.map(f => (
                              <th key={f.name} className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                                {f.name}{f.unit ? ` (${f.unit})` : ''}
                              </th>
                            ))}
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Submitted By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                          {group.entries.map(log => (
                            <tr 
                              key={log.id} 
                              onClick={() => navigate(`/data-entry?entryId=${log.id}`)}
                              className="hover:bg-surface cursor-pointer transition-colors"
                            >
                              <td className="px-6 py-3 text-sm text-text-primary tabular-nums">
                                {new Date(log.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-3 text-sm text-text-secondary">
                                {log.department}
                              </td>
                              {group.fields.map(f => (
                                <td key={f.name} className="px-6 py-3 text-sm text-text-primary tabular-nums">
                                  {log.payload?.[f.name] !== undefined ? String(log.payload[f.name]) : '—'}
                                </td>
                              ))}
                              <td className="px-6 py-3 text-sm text-text-secondary flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-text-secondary" /> {log.submitter}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

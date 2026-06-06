import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity, Users, ClipboardList, TrendingUp,
  ChevronRight, Factory, BarChart2, Trash2,
  Wrench, Check, AlertTriangle, X, FileSpreadsheet
} from 'lucide-react';
import clsx from 'clsx';
import { CompaniesTab } from './admin/CompaniesTab';
import { exportExcel, exportPDF, exportCSV, exportTXT } from '../utils/export';
import type { ExportOptions } from '../utils/export';

interface DashboardData {
  kpis: {
    totalProduction: number;
    totalTarget: number;
    overallEfficiency: string | null;
    manpowerCount: number;
    openJobOrders: number;
    recordCount: number;
  };
  operatorEfficiency: { id: string; name: string; production: number; target: number; efficiency: string | null }[];
  machineEfficiency: { id: string; name: string; production: number; target: number; efficiency: string | null }[];
  machineMaintenanceSummary?: {
    machineId: string;
    machineName: string;
    lastMaintenanceDate: string | null;
    maintenanceType: string;
    status: string;
    departmentName: string;
  }[];
  recentEntries: any[];
}

function EfficiencyBadge({ value }: { value: string | null }) {
  if (!value || value === 'N/A') return <span className="text-text-secondary font-mono text-sm">N/A</span>;
  const num = parseFloat(value);
  
  let colorClass = 'text-red-600';
  if (num > 100) {
    colorClass = 'text-green-600';
  } else if (num >= 80) {
    colorClass = 'text-blue-600';
  } else if (num >= 50) {
    colorClass = 'text-orange-500';
  }

  return (
    <span className={clsx('font-mono text-sm font-semibold tabular-nums', colorClass)}>
      {value}%
    </span>
  );
}

function getStatusBadge(status: string) {
  const normalized = (status || 'completed').toLowerCase();
  switch (normalized) {
    case 'completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          <Check className="mr-1 h-3.5 w-3.5 text-green-600" /> Completed
        </span>
      );
    case 'open':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Wrench className="mr-1 h-3.5 w-3.5 text-blue-600" /> Open
        </span>
      );
    case 'partially completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
          <AlertTriangle className="mr-1 h-3.5 w-3.5 text-amber-600" /> Partially Completed
        </span>
      );
    case 'parts missing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <X className="mr-1 h-3.5 w-3.5 text-red-600" /> Parts Missing
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
          {status}
        </span>
      );
  }
}

function ExportDropdown({
  isOpen,
  setIsOpen,
  onExport
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onExport: (format: 'Excel' | 'PDF' | 'CSV' | 'TXT') => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="inline-flex items-center px-2 py-1 border border-border rounded text-xs font-semibold text-text-secondary bg-white hover:bg-surface transition-colors shadow-sm gap-1"
        title="Export options"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Export
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-24 bg-white border border-border rounded shadow-md z-30 text-left py-1">
            {(['Excel', 'PDF', 'CSV', 'TXT'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(fmt);
                  setIsOpen(false);
                }}
                className="block w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-surface transition-colors font-medium"
              >
                {fmt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Dashboard() {
  const { user, selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range — default to last 30 days
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  // Dropdown states for each block's export options
  const [showOperatorExport, setShowOperatorExport] = useState(false);
  const [showMachineExport, setShowMachineExport] = useState(false);
  const [showMaintenanceExport, setShowMaintenanceExport] = useState(false);

  // Export option calculators for Operator, Machine and Maintenance blocks
  const getOperatorExportOpts = (): ExportOptions => ({
    title: 'Operator Efficiency Summary',
    subtitle: `${startDate} to ${endDate}`,
    filename: `operator_efficiency_summary_${startDate}_to_${endDate}`,
    columns: [
      { header: 'Operator', key: 'name' },
      { header: 'Produced Qty', key: 'production' },
      { header: 'Target Qty', key: 'target' },
      { header: 'Efficiency %', key: 'efficiency' }
    ],
    rows: (data?.operatorEfficiency || []).map(op => ({
      name: op.name,
      production: op.production,
      target: op.target,
      efficiency: op.efficiency ? `${op.efficiency}%` : 'N/A'
    }))
  });

  const getMachineExportOpts = (): ExportOptions => ({
    title: 'Machine Efficiency Summary',
    subtitle: `${startDate} to ${endDate}`,
    filename: `machine_efficiency_summary_${startDate}_to_${endDate}`,
    columns: [
      { header: 'Machine', key: 'name' },
      { header: 'Produced Qty', key: 'production' },
      { header: 'Target Qty', key: 'target' },
      { header: 'Efficiency %', key: 'efficiency' }
    ],
    rows: (data?.machineEfficiency || []).map(m => ({
      name: m.name,
      production: m.production,
      target: m.target,
      efficiency: m.efficiency ? `${m.efficiency}%` : 'N/A'
    }))
  });

  const getMaintenanceExportOpts = (): ExportOptions => ({
    title: 'Machine Maintenance Summary',
    subtitle: `${startDate} to ${endDate}`,
    filename: `machine_maintenance_summary_${startDate}_to_${endDate}`,
    columns: [
      { header: 'Machine', key: 'machineName' },
      { header: 'Last Maintained', key: 'lastMaintenanceDate' },
      { header: 'Type', key: 'maintenanceType' },
      { header: 'Status', key: 'status' }
    ],
    rows: (data?.machineMaintenanceSummary || []).map(m => ({
      machineName: m.machineName,
      lastMaintenanceDate: m.lastMaintenanceDate ? new Date(m.lastMaintenanceDate).toLocaleDateString() : 'N/A',
      maintenanceType: m.maintenanceType || 'N/A',
      status: m.status || 'N/A'
    }))
  });

  const handleOperatorExport = async (format: 'Excel' | 'PDF' | 'CSV' | 'TXT') => {
    const opts = getOperatorExportOpts();
    try {
      if (format === 'Excel') await exportExcel(opts);
      else if (format === 'PDF') await exportPDF(opts);
      else if (format === 'CSV') await exportCSV(opts);
      else if (format === 'TXT') await exportTXT(opts);
    } catch (err) {
      console.error('Operator export failed:', err);
    }
  };

  const handleMachineExport = async (format: 'Excel' | 'PDF' | 'CSV' | 'TXT') => {
    const opts = getMachineExportOpts();
    try {
      if (format === 'Excel') await exportExcel(opts);
      else if (format === 'PDF') await exportPDF(opts);
      else if (format === 'CSV') await exportCSV(opts);
      else if (format === 'TXT') await exportTXT(opts);
    } catch (err) {
      console.error('Machine export failed:', err);
    }
  };

  const handleMaintenanceExport = async (format: 'Excel' | 'PDF' | 'CSV' | 'TXT') => {
    const opts = getMaintenanceExportOpts();
    try {
      if (format === 'Excel') await exportExcel(opts);
      else if (format === 'PDF') await exportPDF(opts);
      else if (format === 'CSV') await exportCSV(opts);
      else if (format === 'TXT') await exportTXT(opts);
    } catch (err) {
      console.error('Maintenance export failed:', err);
    }
  };

  const fetchDashboard = useCallback(async () => {
    if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/summary', {
        params: { startDate, endDate }
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, user, selectedCompanyId]);

  useEffect(() => { 
    if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) {
      setLoading(false);
      return;
    }
    fetchDashboard(); 
  }, [fetchDashboard, user, selectedCompanyId]);

  if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome, Super Admin</h1>
          <p className="text-sm text-text-secondary mt-1">
            Please select a company to view its detailed operations dashboard and master records, or onboard a new company.
          </p>
        </div>
        <CompaniesTab />
      </div>
    );
  }

  const kpiCards = data ? [
    {
      name: 'Total Production',
      value: data.kpis.totalProduction.toLocaleString(),
      sub: `Target: ${data.kpis.totalTarget.toLocaleString()}`,
      icon: Factory,
      color: 'bg-blue-50 text-primary',
      href: '/production'
    },
    {
      name: 'Avg Efficiency',
      value: (data.kpis.overallEfficiency && data.kpis.overallEfficiency !== 'N/A') ? `${data.kpis.overallEfficiency}%` : 'N/A',
      sub: `${data.kpis.recordCount} records`,
      icon: TrendingUp,
      color: 'bg-teal-50 text-secondary',
      href: '/production'
    },
    {
      name: 'Active Manpower',
      value: data.kpis.manpowerCount.toString(),
      sub: 'Registered persons',
      icon: Users,
      color: 'bg-purple-50 text-purple-600',
      href: user?.role === 'OPERATIONS' ? undefined : '/manpower'
    },
    {
      name: 'Open Job Orders',
      value: data.kpis.openJobOrders.toString(),
      sub: 'Awaiting completion',
      icon: ClipboardList,
      color: 'bg-amber-50 text-amber-600',
      href: '/job-orders'
    },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {user?.email?.split('@')[0]}
          </h1>
          <p className="text-sm text-text-secondary mt-1">Operations overview for selected period</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/reports/daily?date=${endDate}`}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light transition-colors shadow-sm"
          >
            <ClipboardList className="mr-2 h-4 w-4" /> Generate Daily Report
          </Link>
          <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-2 shadow-sm">
            <input
              type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-sm text-text-primary bg-transparent outline-none"
            />
            <span className="text-text-secondary text-sm">→</span>
            <input
              type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-sm text-text-primary bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-danger p-4 rounded-md text-sm">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-card border border-border p-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-2/3" />
            </div>
          ))
        ) : kpiCards.map(card => {
          const isLink = !!card.href;
          const cardContent = (
            <>
              <div className={clsx('p-3 rounded-lg flex-shrink-0 transition-transform', isLink && 'group-hover:scale-105', card.color)}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className={clsx("text-sm text-text-secondary transition-colors", isLink && "group-hover:text-primary")}>{card.name}</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums mt-0.5">{card.value}</p>
                <p className="text-xs text-text-secondary mt-1">{card.sub}</p>
              </div>
            </>
          );

          if (isLink) {
            return (
              <Link
                key={card.name}
                to={card.href!}
                className="bg-white rounded-card border border-border shadow-sm p-6 flex items-start gap-4 hover:border-primary hover:shadow-md transition-all cursor-pointer group"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <div
              key={card.name}
              className="bg-white rounded-card border border-border shadow-sm p-6 flex items-start gap-4 transition-all"
            >
              {cardContent}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Operator Efficiency Table */}
        <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Operator Efficiency
              </h2>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  isOpen={showOperatorExport}
                  setIsOpen={setShowOperatorExport}
                  onExport={handleOperatorExport}
                />
                <Link to="/production" className="text-xs text-primary hover:underline flex items-center">
                  Detail view <ChevronRight className="h-3 w-3 ml-0.5" />
                </Link>
              </div>
            </div>
            {loading ? (
              <div className="p-6 animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-50 rounded" />)}
              </div>
            ) : data?.operatorEfficiency.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                No production records in this period.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                <table className="min-w-full divide-y divide-border relative">
                  <thead className="bg-surface sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Operator</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tabular-nums bg-surface">Produced</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase bg-surface">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {data?.operatorEfficiency.map(op => (
                      <tr key={op.id}>
                        <td className="px-6 py-3 text-sm font-medium text-text-primary">{op.name}</td>
                        <td className="px-6 py-3 text-sm text-right text-text-secondary tabular-nums">{op.production.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right"><EfficiencyBadge value={op.efficiency} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Machine Efficiency Table */}
        <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-secondary" /> Machine Efficiency
              </h2>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  isOpen={showMachineExport}
                  setIsOpen={setShowMachineExport}
                  onExport={handleMachineExport}
                />
                <Link to="/production" className="text-xs text-primary hover:underline flex items-center">
                  Detail view <ChevronRight className="h-3 w-3 ml-0.5" />
                </Link>
              </div>
            </div>
            {loading ? (
              <div className="p-6 animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-50 rounded" />)}
              </div>
            ) : data?.machineEfficiency.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                No machine records in this period.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                <table className="min-w-full divide-y divide-border relative">
                  <thead className="bg-surface sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Machine</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tabular-nums bg-surface">Produced</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase bg-surface">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {data?.machineEfficiency.map(m => (
                      <tr key={m.id}>
                        <td className="px-6 py-3 text-sm font-medium text-text-primary">{m.name}</td>
                        <td className="px-6 py-3 text-sm text-right text-text-secondary tabular-nums">{m.production.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right"><EfficiencyBadge value={m.efficiency} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Machine Maintenance Summary Table */}
        <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" /> Machine Maintenance
              </h2>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  isOpen={showMaintenanceExport}
                  setIsOpen={setShowMaintenanceExport}
                  onExport={handleMaintenanceExport}
                />
                <Link to="/maintenance" className="text-xs text-primary hover:underline flex items-center">
                  Detail view <ChevronRight className="h-3 w-3 ml-0.5" />
                </Link>
              </div>
            </div>
            {loading ? (
              <div className="p-6 animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-50 rounded" />)}
              </div>
            ) : !data?.machineMaintenanceSummary || data.machineMaintenanceSummary.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                No machines registered or no maintenance logged.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                <table className="min-w-full divide-y divide-border relative">
                  <thead className="bg-surface sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Machine</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Last Maintained</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {data.machineMaintenanceSummary.map(m => (
                      <tr key={m.machineId}>
                        <td className="px-6 py-3 text-sm font-medium text-text-primary">{m.machineName}</td>
                        <td className="px-6 py-3 text-sm text-text-secondary tabular-nums">
                          {m.lastMaintenanceDate ? new Date(m.lastMaintenanceDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-3 text-sm text-text-secondary">{m.maintenanceType}</td>
                        <td className="px-6 py-3 text-sm">{getStatusBadge(m.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Report Entries */}
      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Recent Report Entries</h2>
          <Link to="/data-entry" className="text-xs text-primary hover:underline">+ New Entry</Link>
        </div>
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-50 rounded" />)}
          </div>
        ) : data?.recentEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">No report entries yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Format</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Submitted By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {data?.recentEntries.map((entry: any) => {
                const canDelete = user?.role !== 'OPERATIONS' || entry.submitted_by === user?.id;
                return (
                  <tr 
                    key={entry.id} 
                    onClick={() => navigate(`/data-entry?entryId=${entry.id}`)}
                    className="hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-sm font-medium text-text-primary">
                      {entry.format_version?.format?.name}
                      <span className="ml-2 text-xs text-secondary bg-blue-50 px-1.5 py-0.5 rounded">
                        {entry.format_version?.format?.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{entry.department?.name}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{entry.submitter?.email}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary tabular-nums">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {canDelete && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this report entry?')) {
                              try {
                                await api.delete(`/reports/entries/${entry.id}`);
                                fetchDashboard();
                              } catch (err: any) {
                                alert(err.response?.data?.error || 'Failed to delete report entry');
                              }
                            }
                          }}
                          className="text-text-secondary hover:text-danger p-1 rounded inline-flex items-center transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Links to Detail Views */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Production Detail', href: '/production', icon: Factory },
          { label: 'Quality Reports', href: '/quality', icon: Activity },
          { label: 'Job Order Detail', href: '/job-orders', icon: ClipboardList },
          { label: 'Maintenance Log', href: '/maintenance', icon: BarChart2 },
        ].map(link => (
          <Link key={link.label} to={link.href}
            className="bg-white border border-border rounded-card p-4 flex items-center gap-3 hover:border-primary hover:shadow-sm transition-all group"
          >
            <link.icon className="h-5 w-5 text-text-secondary group-hover:text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-text-secondary group-hover:text-primary">{link.label}</span>
            <ChevronRight className="h-4 w-4 ml-auto text-gray-300 group-hover:text-primary flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

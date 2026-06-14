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
    reportFormatsCount: number;
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
  productionRecords: any[];
  departmentsSummary?: {
    departmentId: string;
    departmentName: string;
    kpis: {
      totalProduction: number;
      totalTarget: number;
      overallEfficiency: string | null;
    };
    operatorEfficiency: { id: string; name: string; production: number; target: number; efficiency: string | null }[];
    machineEfficiency: { id: string; name: string; production: number; target: number; efficiency: string | null }[];
    machineMaintenanceSummary: {
      machineId: string;
      machineName: string;
      lastMaintenanceDate: string | null;
      maintenanceType: string;
      status: string;
      departmentName: string;
    }[];
  }[];
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
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'charts'>('summary');
  const [openedExportDropdownId, setOpenedExportDropdownId] = useState<string | null>(null);

  // Date range — default to last 30 days
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  // Hovered state for interactive SVG line chart
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    date: string;
    production: number;
    target: number;
  } | null>(null);

  // Export option calculators parameterized by rows & department
  const getOperatorExportOpts = (rows: any[], deptName?: string): ExportOptions => ({
    title: deptName ? `${deptName} - Operator Efficiency Summary` : 'Operator Efficiency Summary',
    subtitle: `${startDate} to ${endDate}`,
    filename: `${deptName ? deptName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' : ''}operator_efficiency_summary_${startDate}_to_${endDate}`,
    columns: [
      { header: 'Operator', key: 'name' },
      { header: 'Produced Qty', key: 'production' },
      { header: 'Target Qty', key: 'target' },
      { header: 'Efficiency %', key: 'efficiency' }
    ],
    rows: rows.map(op => ({
      name: op.name,
      production: op.production,
      target: op.target,
      efficiency: op.efficiency ? `${op.efficiency}%` : 'N/A'
    }))
  });

  const getMachineExportOpts = (rows: any[], deptName?: string): ExportOptions => ({
    title: deptName ? `${deptName} - Machine Efficiency Summary` : 'Machine Efficiency Summary',
    subtitle: `${startDate} to ${endDate}`,
    filename: `${deptName ? deptName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' : ''}machine_efficiency_summary_${startDate}_to_${endDate}`,
    columns: [
      { header: 'Machine', key: 'name' },
      { header: 'Produced Qty', key: 'production' },
      { header: 'Target Qty', key: 'target' },
      { header: 'Efficiency %', key: 'efficiency' }
    ],
    rows: rows.map(m => ({
      name: m.name,
      production: m.production,
      target: m.target,
      efficiency: m.efficiency ? `${m.efficiency}%` : 'N/A'
    }))
  });

  const getMaintenanceExportOpts = (rows: any[], deptName?: string): ExportOptions => ({
    title: deptName ? `${deptName} - Machine Maintenance Summary` : 'Machine Maintenance Summary',
    subtitle: `${startDate} to ${endDate}`,
    filename: `${deptName ? deptName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' : ''}machine_maintenance_summary_${startDate}_to_${endDate}`,
    columns: [
      { header: 'Machine', key: 'machineName' },
      { header: 'Last Maintained', key: 'lastMaintenanceDate' },
      { header: 'Type', key: 'maintenanceType' },
      { header: 'Status', key: 'status' }
    ],
    rows: rows.map(m => ({
      machineName: m.machineName,
      lastMaintenanceDate: m.lastMaintenanceDate ? new Date(m.lastMaintenanceDate).toLocaleDateString() : 'N/A',
      maintenanceType: m.maintenanceType || 'N/A',
      status: m.status || 'N/A'
    }))
  });

  const handleOperatorExport = async (format: 'Excel' | 'PDF' | 'CSV' | 'TXT', rows: any[], deptName?: string) => {
    const opts = getOperatorExportOpts(rows, deptName);
    try {
      if (format === 'Excel') await exportExcel(opts);
      else if (format === 'PDF') await exportPDF(opts);
      else if (format === 'CSV') await exportCSV(opts);
      else if (format === 'TXT') await exportTXT(opts);
    } catch (err) {
      console.error('Operator export failed:', err);
    }
  };

  const handleMachineExport = async (format: 'Excel' | 'PDF' | 'CSV' | 'TXT', rows: any[], deptName?: string) => {
    const opts = getMachineExportOpts(rows, deptName);
    try {
      if (format === 'Excel') await exportExcel(opts);
      else if (format === 'PDF') await exportPDF(opts);
      else if (format === 'CSV') await exportCSV(opts);
      else if (format === 'TXT') await exportTXT(opts);
    } catch (err) {
      console.error('Machine export failed:', err);
    }
  };

  const handleMaintenanceExport = async (format: 'Excel' | 'PDF' | 'CSV' | 'TXT', rows: any[], deptName?: string) => {
    const opts = getMaintenanceExportOpts(rows, deptName);
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
        params: { startDate, endDate, departmentId: selectedDepartmentId || undefined }
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, user, selectedCompanyId, selectedDepartmentId]);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) return;
    if (!isAdmin) return;

    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('Failed to load departments for dashboard', err);
      }
    };
    fetchDepts();
  }, [user, selectedCompanyId, isAdmin]);

  useEffect(() => { 
    if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) {
      setLoading(false);
      return;
    }
    fetchDashboard(); 
  }, [fetchDashboard, user, selectedCompanyId]);

  // Aggregation of daily production vs target records
  const getDailyData = useCallback(() => {
    if (!data || !data.productionRecords) return [];
    
    const map: Record<string, { dateStr: string; production: number; target: number }> = {};
    const records = data.productionRecords.filter(r => {
      if (!selectedDepartmentId) return true;
      return r.department_id === selectedDepartmentId || r.machine?.department_id === selectedDepartmentId;
    });

    records.forEach((r: any) => {
      const dStr = new Date(r.date).toISOString().split('T')[0];
      if (!map[dStr]) {
        map[dStr] = { dateStr: dStr, production: 0, target: 0 };
      }
      map[dStr].production += r.production_amount;
      map[dStr].target += r.target_amount;
    });

    return Object.values(map).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [data, selectedDepartmentId]);

  const getFilteredOperatorEfficiency = () => {
    if (!data) return [];
    if (!selectedDepartmentId) return data.operatorEfficiency;
    const dept = data.departmentsSummary?.find(d => d.departmentId === selectedDepartmentId);
    return dept ? dept.operatorEfficiency : [];
  };

  const getFilteredMachineEfficiency = () => {
    if (!data) return [];
    if (!selectedDepartmentId) return data.machineEfficiency;
    const dept = data.departmentsSummary?.find(d => d.departmentId === selectedDepartmentId);
    return dept ? dept.machineEfficiency : [];
  };

  const formatDateLabel = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length !== 3) return dStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${months[monthIdx]}`;
  };

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
      name: 'Production / Target',
      value: (
        <div className="flex flex-col">
          <span>{data.kpis.totalProduction.toLocaleString()}</span>
          <span className="text-sm font-normal text-text-secondary mt-0.5">
            Target: {data.kpis.totalTarget.toLocaleString()}
          </span>
        </div>
      ),
      sub: `Avg Efficiency: ${data.kpis.overallEfficiency ? `${data.kpis.overallEfficiency}%` : 'N/A'}`,
      icon: Factory,
      color: 'bg-blue-50 text-primary',
      href: '/production'
    },
    {
      name: 'Active Manpower',
      value: data.kpis.manpowerCount.toString(),
      sub: 'Registered manpower',
      icon: Users,
      color: 'bg-teal-50 text-secondary',
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
    {
      name: 'Report Builds',
      value: data.kpis.reportFormatsCount.toString(),
      sub: 'Active formats created',
      icon: BarChart2,
      color: 'bg-purple-50 text-purple-600',
      href: user?.role === 'OPERATIONS' ? undefined : '/reports/builder'
    },
  ] : [];

  // Trend chart variables calculation
  const dailyData = getDailyData();
  const maxVal = Math.max(1, ...dailyData.map(d => Math.max(d.production, d.target)));
  const svgWidth = 800;
  const svgHeight = 300;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const points = dailyData.map((d, index) => {
    const x = paddingLeft + (index / Math.max(1, dailyData.length - 1)) * plotWidth;
    const yProd = paddingTop + plotHeight - (d.production / maxVal) * plotHeight;
    const yTarget = paddingTop + plotHeight - (d.target / maxVal) * plotHeight;
    return { x, yProd, yTarget };
  });

  const prodLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yProd}`).join(' ');
  const prodAreaPath = points.length > 0
    ? `${prodLinePath} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`
    : '';
  const targetLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTarget}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const labelInterval = Math.max(1, Math.ceil(dailyData.length / 8));

  // Render Horizontal CSS Comparison charts
  const renderComparisonChart = (title: string, list: any[], icon: any) => {
    const Icon = icon;
    if (list.length === 0) {
      return (
        <div className="bg-white rounded-card border border-border shadow-sm p-6 text-center text-sm text-text-secondary">
          No records in this period.
        </div>
      );
    }

    const cMax = Math.max(1, ...list.map(x => Math.max(x.production, x.target)));

    return (
      <div className="bg-white rounded-card border border-border shadow-sm p-6 space-y-6">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-text-secondary">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary rounded" />
            <span>Below Target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-teal-600 rounded" />
            <span>Target Achieved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-red-500" />
            <span>Target line</span>
          </div>
        </div>
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {list.map(item => {
            const prodPct = (item.production / cMax) * 100;
            const targetPct = (item.target / cMax) * 100;
            const isMet = parseFloat(item.efficiency || '0') >= 100;

            return (
              <div key={item.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-text-primary">{item.name}</span>
                  <span className="text-text-secondary font-mono">
                    {item.production.toLocaleString()} <span className="text-[10px] text-text-secondary">/ {item.target.toLocaleString()}</span> ({item.efficiency ? `${item.efficiency}%` : 'N/A'})
                  </span>
                </div>
                <div className="relative w-full h-3 bg-gray-100 rounded-full">
                  <div
                    style={{ width: `${prodPct}%` }}
                    className={clsx(
                      "h-full rounded-full transition-all duration-500",
                      isMet ? "bg-teal-600" : "bg-primary"
                    )}
                  />
                  {item.target > 0 && (
                    <div
                      style={{ left: `${targetPct}%` }}
                      className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10"
                      title={`Target: ${item.target}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
          {isAdmin && (
            <select
              value={selectedDepartmentId}
              onChange={e => setSelectedDepartmentId(e.target.value)}
              className="border border-border bg-white rounded-md px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary text-text-primary font-medium"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-2 shadow-sm">
            <input
              type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-sm text-text-primary bg-transparent outline-none font-medium"
            />
            <span className="text-text-secondary text-sm">→</span>
            <input
              type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-sm text-text-primary bg-transparent outline-none font-medium"
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
              <div className="flex-1 min-w-0">
                <p className={clsx("text-sm text-text-secondary transition-colors", isLink && "group-hover:text-primary")}>{card.name}</p>
                <div className="text-2xl font-bold text-text-primary tabular-nums mt-0.5">{card.value}</div>
                <p className="text-xs text-text-secondary mt-1 font-semibold">{card.sub}</p>
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

      {/* Tab Switcher */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('summary')}
          className={clsx(
            "pb-3 text-sm font-semibold transition-colors border-b-2 -mb-[2px]",
            activeTab === 'summary'
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={clsx(
            "pb-3 text-sm font-semibold transition-colors border-b-2 -mb-[2px]",
            activeTab === 'charts'
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          Production Charts
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'summary' && (
        <div className="space-y-10">
          {loading ? (
            <div className="space-y-6">
              {[1, 2].map(idx => (
                <div key={idx} className="bg-white border border-border rounded-card p-6 animate-pulse space-y-4">
                  <div className="h-6 bg-gray-100 rounded w-1/4" />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-50 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.departmentsSummary || data.departmentsSummary.length === 0 ? (
            <div className="bg-white border border-border rounded-card p-8 text-center text-sm text-text-secondary">
              No department summaries available.
            </div>
          ) : (
            data.departmentsSummary
              .filter(dept => !selectedDepartmentId || dept.departmentId === selectedDepartmentId)
              .map(dept => (
                <div key={dept.departmentId} className="space-y-4">
                  {/* Department Header Card */}
                  <div className="bg-white border border-border rounded-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-primary rounded-lg">
                        <Factory className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-text-primary">{dept.departmentName} Department</h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Production: <span className="font-mono font-medium tabular-nums text-text-primary">{dept.kpis.totalProduction.toLocaleString()}</span> / Target: <span className="font-mono font-medium tabular-nums text-text-primary">{dept.kpis.totalTarget.toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 sm:text-right">
                      <div>
                        <p className="text-xs text-text-secondary font-semibold">Department Efficiency</p>
                        <div className="mt-0.5">
                          <EfficiencyBadge value={dept.kpis.overallEfficiency} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grid of Tables for this Department */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Operator Efficiency Table */}
                    <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Operator Efficiency
                          </h4>
                          <div className="flex items-center gap-3">
                            <ExportDropdown
                              isOpen={openedExportDropdownId === `${dept.departmentId}-operator`}
                              setIsOpen={(open) => setOpenedExportDropdownId(open ? `${dept.departmentId}-operator` : null)}
                              onExport={(format) => handleOperatorExport(format, dept.operatorEfficiency, dept.departmentName)}
                            />
                            <Link to="/production" className="text-xs text-primary hover:underline flex items-center">
                              Detail <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Link>
                          </div>
                        </div>
                        {dept.operatorEfficiency.length === 0 ? (
                          <div className="p-8 text-center text-xs text-text-secondary">
                            No production records.
                          </div>
                        ) : (
                          <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                            <table className="min-w-full divide-y divide-border relative">
                              <thead className="bg-surface sticky top-0 z-10">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Operator</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase bg-surface">Produced</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase bg-surface">Efficiency</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-white">
                                {dept.operatorEfficiency.map(op => (
                                  <tr key={op.id}>
                                    <td className="px-6 py-3 text-sm font-medium text-text-primary">{op.name}</td>
                                    <td className="px-6 py-3 text-sm text-right text-text-secondary font-mono tabular-nums">{op.production.toLocaleString()}</td>
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
                          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <BarChart2 className="h-4 w-4 text-secondary" /> Machine Efficiency
                          </h4>
                          <div className="flex items-center gap-3">
                            <ExportDropdown
                              isOpen={openedExportDropdownId === `${dept.departmentId}-machine`}
                              setIsOpen={(open) => setOpenedExportDropdownId(open ? `${dept.departmentId}-machine` : null)}
                              onExport={(format) => handleMachineExport(format, dept.machineEfficiency, dept.departmentName)}
                            />
                            <Link to="/production" className="text-xs text-primary hover:underline flex items-center">
                              Detail <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Link>
                          </div>
                        </div>
                        {dept.machineEfficiency.length === 0 ? (
                          <div className="p-8 text-center text-xs text-text-secondary">
                            No machine records.
                          </div>
                        ) : (
                          <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                            <table className="min-w-full divide-y divide-border relative">
                              <thead className="bg-surface sticky top-0 z-10">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Machine</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase bg-surface">Produced</th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase bg-surface">Efficiency</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-white">
                                {dept.machineEfficiency.map(m => (
                                  <tr key={m.id}>
                                    <td className="px-6 py-3 text-sm font-medium text-text-primary">{m.name}</td>
                                    <td className="px-6 py-3 text-sm text-right text-text-secondary font-mono tabular-nums">{m.production.toLocaleString()}</td>
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
                          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-primary" /> Machine Maintenance
                          </h4>
                          <div className="flex items-center gap-3">
                            <ExportDropdown
                              isOpen={openedExportDropdownId === `${dept.departmentId}-maintenance`}
                              setIsOpen={(open) => setOpenedExportDropdownId(open ? `${dept.departmentId}-maintenance` : null)}
                              onExport={(format) => handleMaintenanceExport(format, dept.machineMaintenanceSummary, dept.departmentName)}
                            />
                            <Link to="/maintenance" className="text-xs text-primary hover:underline flex items-center">
                              Detail <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Link>
                          </div>
                        </div>
                        {dept.machineMaintenanceSummary.length === 0 ? (
                          <div className="p-8 text-center text-xs text-text-secondary">
                            No machines or maintenance.
                          </div>
                        ) : (
                          <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                            <table className="min-w-full divide-y divide-border relative">
                              <thead className="bg-surface sticky top-0 z-10">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Machine</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Last Maintained</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase bg-surface">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-white">
                                {dept.machineMaintenanceSummary.map(m => (
                                  <tr key={m.machineId}>
                                    <td className="px-6 py-3 text-sm font-medium text-text-primary">{m.machineName}</td>
                                    <td className="px-6 py-3 text-sm text-text-secondary font-mono tabular-nums">
                                      {m.lastMaintenanceDate ? new Date(m.lastMaintenanceDate).toLocaleDateString() : 'N/A'}
                                    </td>
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
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'charts' && (
        <div className="space-y-8">
          {/* Main SVG Trend Chart */}
          <div className="bg-white rounded-card border border-border shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Daily Production vs Target Trend
                </h3>
                <p className="text-xs text-text-secondary mt-1">Timeline view of actual output vs goals</p>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-primary rounded-full" />
                  <span className="text-text-secondary">Actual Production</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[#006a6a] rounded-full" />
                  <span className="text-text-secondary">Target</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="h-[300px] animate-pulse bg-gray-50 rounded flex items-center justify-center text-sm text-text-secondary">
                Loading chart...
              </div>
            ) : dailyData.length === 0 ? (
              <div className="h-[300px] bg-gray-50 rounded flex items-center justify-center text-sm text-text-secondary">
                No production records available for this period.
              </div>
            ) : (
              <div className="relative">
                <svg viewBox="0 0 800 300" className="w-full h-auto font-sans">
                  {/* Gradients */}
                  <defs>
                    <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0059bb" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#0059bb" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>

                  {/* Y Axis Grid Lines & Labels */}
                  {yTicks.map(tick => {
                    const y = paddingTop + plotHeight - tick * plotHeight;
                    return (
                      <g key={tick}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={svgWidth - paddingRight}
                          y2={y}
                          stroke="#f3f4f6"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 12}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] font-mono font-medium fill-text-secondary"
                        >
                          {Math.round(tick * maxVal).toLocaleString()}
                        </text>
                      </g>
                    );
                  })}

                  {/* X Axis Line */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop + plotHeight}
                    x2={svgWidth - paddingRight}
                    y2={paddingTop + plotHeight}
                    stroke="#c1c6d7"
                    strokeWidth="1.5"
                  />

                  {/* X Axis Labels */}
                  {dailyData.map((d, index) => {
                    if (index % labelInterval !== 0 && index !== dailyData.length - 1) return null;
                    const x = paddingLeft + (index / Math.max(1, dailyData.length - 1)) * plotWidth;
                    return (
                      <text
                        key={index}
                        x={x}
                        y={paddingTop + plotHeight + 20}
                        textAnchor="middle"
                        className="text-[10px] font-semibold fill-text-secondary"
                      >
                        {formatDateLabel(d.dateStr)}
                      </text>
                    );
                  })}

                  {/* Area Path */}
                  {prodAreaPath && (
                    <path
                      d={prodAreaPath}
                      fill="url(#prodGradient)"
                    />
                  )}

                  {/* Lines */}
                  {prodLinePath && (
                    <path
                      d={prodLinePath}
                      fill="none"
                      stroke="#0059bb"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {targetLinePath && (
                    <path
                      d={targetLinePath}
                      fill="none"
                      stroke="#006a6a"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Hover Guideline */}
                  {hoveredPoint && (
                    <line
                      x1={hoveredPoint.x}
                      y1={paddingTop}
                      x2={hoveredPoint.x}
                      y2={paddingTop + plotHeight}
                      stroke="#9ca3af"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Interactive Circles */}
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.yProd}
                        r="4.5"
                        className="fill-[#0059bb] stroke-white stroke-2"
                      />
                      <circle
                        cx={p.x}
                        cy={p.yTarget}
                        r="3.5"
                        className="fill-[#006a6a] stroke-white stroke-1.5"
                      />
                    </g>
                  ))}

                  {/* Transparent Hover Columns */}
                  {dailyData.map((d, idx) => {
                    const x = paddingLeft + (idx / Math.max(1, dailyData.length - 1)) * plotWidth;
                    const colWidth = plotWidth / Math.max(1, dailyData.length);
                    return (
                      <rect
                        key={idx}
                        x={x - colWidth / 2}
                        y={paddingTop}
                        width={colWidth}
                        height={plotHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          const yProd = paddingTop + plotHeight - (d.production / maxVal) * plotHeight;
                          setHoveredPoint({
                            x,
                            y: yProd,
                            date: d.dateStr,
                            production: d.production,
                            target: d.target
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </svg>

                {/* HTML Tooltip overlay */}
                {hoveredPoint && (
                  <div
                    className="absolute bg-white border border-border shadow-lg rounded p-3 text-xs z-20 pointer-events-none transition-all duration-75"
                    style={{
                      left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                      transform: 'translateX(-50%)',
                      top: `${(hoveredPoint.y / svgHeight) * 100 - 35}%`,
                    }}
                  >
                    <p className="font-bold text-text-primary mb-1">{formatDateLabel(hoveredPoint.date)}</p>
                    <div className="space-y-0.5">
                      <p className="text-primary font-medium">Production: <span className="font-mono">{hoveredPoint.production.toLocaleString()}</span></p>
                      <p className="text-secondary font-medium">Target: <span className="font-mono">{hoveredPoint.target.toLocaleString()}</span></p>
                    </div>
                    <p className="text-text-secondary mt-1.5 border-t pt-1 font-semibold">
                      Efficiency: {hoveredPoint.target > 0 ? `${((hoveredPoint.production / hoveredPoint.target) * 100).toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {renderComparisonChart('Operator Production vs Target', getFilteredOperatorEfficiency(), Users)}
            {renderComparisonChart('Machine Production vs Target', getFilteredMachineEfficiency(), BarChart2)}
          </div>
        </div>
      )}

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
                      <span className="ml-2 text-xs text-secondary bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
                        {entry.format_version?.format?.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{entry.department?.name}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{entry.submitter?.email}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary font-mono tabular-nums">
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

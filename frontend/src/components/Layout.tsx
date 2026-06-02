import React, { useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, LayoutDashboard, Users, ShieldAlert, ShieldCheck,
  Factory, FileText, Settings, TrendingUp, Menu, X,
  ClipboardList, Wrench, Shield, ChevronRight, Building2,
  Database, ChevronDown, BarChart3, ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';
import { updateApiBaseURL } from '../utils/api';

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  mobileTab?: boolean; // Show in bottom tab bar on mobile
  children?: { name: string; href: string; roles: string[] }[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'], mobileTab: true },
  {
    name: 'Masters',
    icon: Database,
    roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'],
    children: [
      { name: 'Manpower', href: '/manpower', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
      { name: 'Machines', href: '/machines', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
      { name: 'Customers', href: '/customers', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
      { name: 'Items Master', href: '/items', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
      { name: 'Job Order Columns', href: '/masters/job-orders', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
      { name: 'Maintenance Master', href: '/masters/maintenance', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
    ]
  },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'], mobileTab: true },
  { name: 'Job Orders', href: '/job-orders', icon: ClipboardList, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'], mobileTab: true },
  { name: 'Data Log Entry', href: '/data-entry', icon: FileText, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'], mobileTab: true },
  {
    name: 'Reports',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'],
    children: [
      { name: 'Machine Production', href: '/production', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
      { name: 'Other Production', href: '/reports/other-production', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
      { name: 'Quality', href: '/quality', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
    ]
  },
  { name: 'Report Builder', href: '/reports/builder', icon: Settings, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  {
    name: 'Legal Policies',
    icon: ShieldCheck,
    roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'],
    children: [
      { name: 'Privacy Policy', href: '/legal/privacy', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
      { name: 'Legal Terms', href: '/legal/terms', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
      { name: 'Terms & Conditions', href: '/legal/conditions', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATIONS'] },
    ]
  },
  { name: 'Audit Log', href: '/audit', icon: Shield, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
  { name: 'Admin Panel', href: '/admin', icon: ShieldAlert, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'], mobileTab: true },
];

export function PrivateLayout() {
  const { isAuthenticated, logout, user, selectedCompanyId, selectedCompanyName, clearSelectedCompany } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(
    location.pathname.startsWith('/manpower') ||
    location.pathname.startsWith('/machines') ||
    location.pathname.startsWith('/customers') ||
    location.pathname.startsWith('/items') ||
    location.pathname.startsWith('/masters/job-orders') ||
    location.pathname.startsWith('/masters/maintenance')
  );
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith('/production') ||
    location.pathname.startsWith('/quality') ||
    location.pathname.startsWith('/reports/other-production')
  );
  const [legalOpen, setLegalOpen] = useState(
    location.pathname.startsWith('/legal/')
  );

  // Auto-expand groups if user navigates to a sub-page directly
  React.useEffect(() => {
    if (
      location.pathname.startsWith('/manpower') ||
      location.pathname.startsWith('/machines') ||
      location.pathname.startsWith('/customers') ||
      location.pathname.startsWith('/items') ||
      location.pathname.startsWith('/masters/job-orders') ||
      location.pathname.startsWith('/masters/maintenance')
    ) {
      setMastersOpen(true);
    }
    if (
      location.pathname.startsWith('/production') ||
      location.pathname.startsWith('/quality') ||
      location.pathname.startsWith('/reports/other-production')
    ) {
      setReportsOpen(true);
    }
    if (location.pathname.startsWith('/legal/')) {
      setLegalOpen(true);
    }
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Guard: If Super Admin hasn't selected a company, force redirect them to the landing page `/`
  if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  const filteredNav = ALL_NAV_ITEMS.map(item => {
    if (item.children) {
      const filteredChildren = item.children.filter(child => child.roles.includes(user?.role || ''));
      return { ...item, children: filteredChildren };
    }
    return item;
  }).filter(item => {
    if (!item.roles.includes(user?.role || '')) return false;
    
    // If Super Admin hasn't selected a company, hide all details/reports nav items
    if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) {
      return item.href === '/';
    }

    // Hide parents with no visible children
    if (item.children && item.children.length === 0) return false;
    
    return true;
  });
  
  const mobileTabItems = filteredNav.filter(item => item.mobileTab);

  const NavLink = ({ item }: { item: NavItem }) => {
    if (item.children) {
      const isChildActive = item.children.some(child => 
        location.pathname === child.href || 
        (child.href !== '/' && location.pathname.startsWith(child.href!))
      );
      
      const isOpen = item.name === 'Masters' 
        ? mastersOpen 
        : item.name === 'Legal Policies'
          ? legalOpen
          : reportsOpen;
      const handleParentClick = () => {
        if (item.name === 'Masters') {
          setMastersOpen(!mastersOpen);
        } else if (item.name === 'Legal Policies') {
          setLegalOpen(!legalOpen);
        } else {
          setReportsOpen(!reportsOpen);
        }
        setSidebarOpen(false);
      };
      
      return (
        <div className="space-y-1">
          <Link
            to={item.children[0].href}
            onClick={handleParentClick}
            className={clsx(
              'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors text-left focus:outline-none',
              isChildActive ? 'text-primary' : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
            )}
          >
            <item.icon className={clsx('mr-3 flex-shrink-0 h-5 w-5', isChildActive ? 'text-primary' : 'text-gray-400')} />
            <span className="flex-1">{item.name}</span>
            <ChevronDown 
              className={clsx(
                'h-4 w-4 text-gray-400 transition-transform duration-200', 
                isOpen ? 'transform rotate-180 text-primary' : ''
              )} 
            />
          </Link>
          
          {isOpen && (
            <div className="pl-8 space-y-1 border-l border-border/50 ml-5">
              {item.children.map(child => {
                const isSubActive = location.pathname === child.href || 
                  (child.href !== '/' && location.pathname.startsWith(child.href!));
                return (
                  <Link
                    key={child.name}
                    to={child.href!}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'block px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      isSubActive 
                        ? 'text-primary bg-primary/5 font-semibold' 
                        : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
                    )}
                  >
                    {child.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = location.pathname === item.href ||
      (item.href !== '/' && location.pathname.startsWith(item.href!));
    const displayName = item.href === '/' && user?.role === 'SUPER_ADMIN' && !selectedCompanyId 
      ? 'Companies' 
      : item.name;

    return (
      <Link
        to={item.href!}
        onClick={() => setSidebarOpen(false)}
        className={clsx(
          'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'
        )}
      >
        <item.icon className={clsx('mr-3 flex-shrink-0 h-5 w-5', isActive ? 'text-primary' : 'text-gray-400')} />
        {displayName}
        {isActive && <ChevronRight className="ml-auto h-4 w-4 text-primary/50" />}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border flex-shrink-0">
        <span className="font-bold text-primary text-xl tracking-tight">Saarlekha</span>
        <button className="md:hidden text-text-secondary" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {filteredNav.map(item => <NavLink key={item.name} item={item} />)}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-text-primary truncate">{user?.email}</p>
          <p className="text-xs text-text-secondary capitalize mt-0.5">
            {user?.role.replace(/_/g, ' ').toLowerCase()}
          </p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center px-3 py-2 text-sm font-medium rounded-md text-danger hover:bg-red-50 transition-colors"
        >
          <LogOut className="mr-3 flex-shrink-0 h-5 w-5 text-danger" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-border fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 bg-white shadow-xl z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Desktop top header bar */}
        <header className="hidden md:flex h-14 bg-white border-b border-border items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center space-x-4 text-text-primary">
            {location.pathname !== '/' && (
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center text-xs text-text-secondary hover:text-text-primary bg-white hover:bg-gray-50 border border-border rounded-md px-2.5 py-1.5 font-semibold transition-colors shadow-sm gap-1 mr-2"
                title="Go Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold tracking-wide uppercase text-primary">
                {selectedCompanyName || 'No Company Linked'}
              </span>
            </div>
            {user?.role === 'SUPER_ADMIN' && selectedCompanyId && (
              <button
                onClick={() => {
                  clearSelectedCompany();
                  navigate('/');
                }}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-text-secondary px-2.5 py-1 rounded font-semibold transition-colors border border-border"
              >
                Switch Company
              </button>
            )}
          </div>
          <div className="text-xs text-text-secondary font-medium">
            Logged in: <span className="text-text-primary mr-3">{user?.email}</span>
            Role: <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
              {user?.role.replace(/_/g, ' ')}
            </span>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-white border-b border-border h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="text-text-secondary p-1 -ml-1">
              <Menu className="h-6 w-6" />
            </button>
            {location.pathname !== '/' && (
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center text-xs text-text-secondary hover:text-text-primary bg-white hover:bg-gray-50 border border-border rounded px-2 py-1 font-semibold transition-colors gap-1 mr-1"
                title="Go Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-primary text-base leading-none">Saarlekha</span>
              {selectedCompanyName && (
                <span className="text-[10px] text-text-secondary font-semibold mt-0.5 uppercase tracking-wider truncate max-w-[140px]">
                  {selectedCompanyName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'SUPER_ADMIN' && selectedCompanyId && (
              <button
                onClick={() => {
                  clearSelectedCompany();
                  navigate('/');
                }}
                className="text-[10px] bg-gray-50 hover:bg-gray-100 text-text-secondary px-2 py-0.5 rounded font-semibold transition-colors border border-border"
              >
                Switch
              </button>
            )}
            <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">
              {user?.role.replace(/_/g, ' ').split(' ')[0]}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>

        {/* ── Mobile Bottom Tab Bar ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border flex items-stretch">
          {mobileTabItems.map(item => {
            const href = item.href || '';
            const isActive = location.pathname === href ||
              (href !== '/' && location.pathname.startsWith(href));
            return (
              <Link
                key={item.name}
                to={href}
                className={clsx(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
                  isActive ? 'text-primary' : 'text-text-secondary'
                )}
              >
                <item.icon className={clsx('h-5 w-5', isActive ? 'text-primary' : 'text-gray-400')} />
                <span className={clsx('font-medium', isActive ? 'text-primary' : 'text-text-secondary')}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PublicLayout() {
  const { isAuthenticated } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('api_server_url') || 'http://localhost:5000');
  const [successMsg, setSuccessMsg] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateApiBaseURL(serverUrl);
    setSuccessMsg('Server URL updated successfully!');
    setTimeout(() => {
      setSuccessMsg('');
      setShowSettings(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-card shadow-sm border border-border relative">
        {import.meta.env.DEV && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-4 right-4 text-gray-400 hover:text-primary transition-colors"
            title="Server Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}

        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-primary">Saarlekha</h2>
          <p className="mt-2 text-sm text-text-secondary">Operations Reporting Platform</p>
        </div>

        {import.meta.env.DEV && showSettings && (
          <form onSubmit={handleSaveSettings} className="space-y-4 bg-gray-50 p-4 rounded-md border border-border mt-4 text-left">
            <h3 className="text-sm font-semibold text-text-primary">Server Settings</h3>
            <p className="text-xs text-text-secondary">
              If running on mobile/emulator, change the Server URL/IP to point to the backend server.
            </p>
            <div>
              <label className="block text-xs font-medium text-text-primary">Backend Server URL</label>
              <input
                type="text"
                required
                placeholder="e.g. 192.168.1.100:5000"
                className="mt-1 block w-full border border-border rounded-md shadow-sm py-1.5 px-3 focus:outline-none focus:ring-primary focus:border-primary text-xs"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </div>
            {successMsg && (
              <div className="text-xs text-green-600 font-medium">
                {successMsg}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="py-1 px-3 border border-border rounded-md text-xs font-medium text-text-secondary bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-1 px-3 border border-transparent rounded-md text-xs font-medium text-white bg-primary hover:bg-primary-light"
              >
                Save
              </button>
            </div>
          </form>
        )}

        <Outlet />
      </div>
    </div>
  );
}

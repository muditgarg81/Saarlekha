import React, { useState } from 'react';
import { UsersTab } from './UsersTab';
import { DepartmentsTab } from './DepartmentsTab';
import { CompaniesTab } from './CompaniesTab';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');
  const { user } = useAuth();

  const tabs = [
    { id: 'users', name: 'User Management' },
    { id: 'departments', name: 'Departments' },
    { id: 'companies', name: 'Company Details' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Admin Panel</h1>
      </div>

      <div className="mb-6">
        <div className="sm:hidden">
          <select
            className="block w-full rounded-md border-border py-2 pl-3 pr-10 text-base focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.name}</option>
            ))}
          </select>
        </div>
        <div className="hidden sm:block">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border',
                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
                  )}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'companies' && <CompaniesTab />}
      </div>
    </div>
  );
}

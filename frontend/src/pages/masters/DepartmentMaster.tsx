import React from 'react';
import { DepartmentsTab } from '../admin/DepartmentsTab';
import { Building2 } from 'lucide-react';

export function DepartmentMaster() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center border-b border-border pb-4 mb-6">
        <Building2 className="h-8 w-8 text-primary mr-3" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Department Master</h1>
          <p className="text-sm text-text-secondary">Create, edit, and delete company departments.</p>
        </div>
      </div>
      <DepartmentsTab />
    </div>
  );
}

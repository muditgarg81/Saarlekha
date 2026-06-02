import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

export function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error('Failed to fetch departments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setError(null);
    
    try {
      const res = await api.post('/departments', { name: newDeptName });
      setDepartments([...departments, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDeptName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add department');
    }
  };

  const handleStartEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditingName(dept.name);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setError(null);

    try {
      const res = await api.put(`/departments/${id}`, { name: editingName });
      setDepartments(departments.map(d => d.id === id ? res.data : d).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setEditingName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update department');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the department "${name}"?`)) return;
    setError(null);

    try {
      await api.delete(`/departments/${id}`);
      setDepartments(departments.filter(d => d.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete department');
    }
  };

  if (loading) return <div className="p-4 text-text-secondary">Loading departments...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-danger p-4 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-card border border-border shadow-sm">
        <h3 className="text-lg font-medium text-text-primary mb-4">Add Department</h3>
        <form onSubmit={handleAdd} className="flex gap-4">
          <input
            type="text"
            className="flex-1 border border-border rounded-md px-3 py-2 focus:ring-primary focus:border-primary text-sm"
            placeholder="Department Name (e.g., Quality Control)"
            value={newDeptName}
            onChange={e => setNewDeptName(e.target.value)}
          />
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-36">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {departments.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary text-center">
                  No departments found.
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                    {editingId === dept.id ? (
                      <input
                        type="text"
                        className="border border-border rounded px-2 py-1 text-sm w-full max-w-md focus:ring-primary focus:border-primary"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      dept.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingId === dept.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(dept.id)}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                          title="Save Changes"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleStartEdit(dept)}
                          className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50"
                          title="Edit Department"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(dept.id, dept.name)}
                          className="text-danger hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Delete Department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

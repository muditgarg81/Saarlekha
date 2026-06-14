import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Check, X, Edit, Trash2, Search } from 'lucide-react';
import clsx from 'clsx';

interface Item {
  id: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  submitter: { email: string };
  reject_reason?: string;
}

export function ItemsMaster() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (item.name || '').toLowerCase().includes(term) ||
      (item.status || '').toLowerCase().includes(term) ||
      (item.submitter?.email || '').toLowerCase().includes(term) ||
      (item.reject_reason || '').toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await api.get('/items');
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isDuplicate = items.some(
      item => item.name.toLowerCase().trim() === name.toLowerCase().trim() && item.id !== editingItem?.id
    );
    if (isDuplicate) {
      if (!window.confirm(`An item named "${name.trim()}" already exists. Do you want to save this duplicate?`)) {
        return;
      }
    }

    try {
      if (editingItem) {
        await api.put(`/items/${editingItem.id}`, { name });
        setEditingItem(null);
      } else {
        await api.post('/items', { name, custom_data: {} });
      }
      setShowForm(false);
      setName('');
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save item');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setName('');
    setEditingItem(null);
  };

  const handleStartEdit = (item: Item) => {
    setEditingItem(item);
    setName(item.name || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete the item "${itemName}"?`)) return;
    try {
      await api.delete(`/items/${id}`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete item');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/items/${id}/approve`);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // cancelled
    try {
      await api.patch(`/items/${id}/reject`, { reason });
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Loading items...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">Items Master</h1>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light"
        >
          <Plus className="mr-2 h-4 w-4" /> Propose Item
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            {editingItem ? `Edit Item: ${editingItem.name}` : 'Propose New Item'}
          </h3>
          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary">Item Name / Code</label>
              <input required type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light h-[42px] font-semibold">
                {editingItem ? 'Save Changes' : 'Submit for Approval'}
              </button>
              {editingItem && (
                <button type="button" onClick={handleCancel} className="bg-gray-100 text-text-secondary px-4 py-2 rounded-md hover:bg-gray-200 h-[42px] font-semibold">
                  Cancel
                </button>
              )}
            </div>
          </form>
          {!editingItem && (
            <p className="text-xs text-text-secondary mt-2">Note: All new items must be approved by an administrator before they become Active.</p>
          )}
        </div>
      )}

      {/* Search Bar Panel */}
      <div className="bg-white p-4 rounded-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-secondary" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-md text-sm bg-white placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            placeholder="Search items by name, status, submitter..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-sm text-primary hover:underline font-semibold self-start md:self-auto"
          >
            Clear Search
          </button>
        )}
        <div className="text-sm text-text-secondary font-medium self-end md:self-auto">
          Found {filteredItems.length} matching items
        </div>
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Item Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Submitted By</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                  {item.name}
                  {item.status === 'REJECTED' && item.reject_reason && (
                    <div className="text-xs text-danger mt-1 font-normal">Reason: {item.reject_reason}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={clsx(
                    "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                    item.status === 'ACTIVE' && 'bg-green-100 text-green-800',
                    item.status === 'PENDING' && 'bg-yellow-100 text-yellow-800',
                    item.status === 'REJECTED' && 'bg-red-100 text-red-800'
                  )}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                  {item.submitter?.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center gap-2">
                    {isAdmin && item.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleApprove(item.id)} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded" title="Approve Item">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleReject(item.id)} className="text-danger hover:text-red-900 bg-red-50 p-1.5 rounded" title="Reject Item">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => handleStartEdit(item)} className="text-primary hover:text-primary-light bg-blue-50 p-1.5 rounded" title="Edit Item">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.name)} className="text-danger hover:text-red-900 bg-red-50 p-1.5 rounded" title="Delete Item">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block sm:hidden divide-y divide-border bg-white">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No matching items found.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  className="border border-border rounded-card p-4 shadow-sm space-y-3 bg-white hover:border-primary transition-all relative"
                >
                  {/* Header: Name and Status Badge */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                    <span className={clsx(
                      "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                      item.status === 'ACTIVE' && 'bg-green-100 text-green-800',
                      item.status === 'PENDING' && 'bg-yellow-100 text-yellow-800',
                      item.status === 'REJECTED' && 'bg-red-100 text-red-800'
                    )}>
                      {item.status}
                    </span>
                  </div>

                  {/* Body: Submitted By and rejection reason */}
                  <div className="text-xs text-text-secondary">
                    <span>Submitted By: <span className="font-medium text-text-primary">{item.submitter?.email}</span></span>
                    {item.status === 'REJECTED' && item.reject_reason && (
                      <div className="text-xs text-danger mt-1 bg-red-55/10 p-2 rounded border border-red-200">
                        Reason: {item.reject_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  {(isAdmin || (isAdmin && item.status === 'PENDING')) && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                      {isAdmin && item.status === 'PENDING' && (
                        <>
                          <button 
                            onClick={() => handleApprove(item.id)} 
                            className="text-green-600 hover:bg-green-55/10 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                            title="Approve Item"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button 
                            onClick={() => handleReject(item.id)} 
                            className="text-danger hover:bg-red-55/10 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                            title="Reject Item"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => handleStartEdit(item)} 
                            className="text-primary hover:bg-blue-50 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                            title="Edit Item"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id, item.name)} 
                            className="text-danger hover:bg-red-50 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                            title="Delete Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

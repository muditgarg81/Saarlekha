import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Edit, Mail, Trash2 } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  role: string;
  created_at: string;
  departments: { department: { id: string; name: string } }[];
}

export function UsersTab() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite form state
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OPERATIONS' | 'COMPANY_ADMIN'>('OPERATIONS');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState('');

  // Edit form state
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editDepts, setEditDepts] = useState<string[]>([]);
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments')
      ]);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || (inviteRole === 'OPERATIONS' && selectedDepts.length === 0)) return;
    
    try {
      const res = await api.post('/auth/invite', { 
        email: inviteEmail, 
        role: inviteRole,
        departmentIds: inviteRole === 'OPERATIONS' ? selectedDepts : [] 
      });
      setInviteLink(res.data.inviteLink);
      setInviteEmail('');
      setInviteRole('OPERATIONS');
      setSelectedDepts([]);
      fetchData(); // refresh list
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send invite');
    }
  };

  const toggleDept = (deptId: string) => {
    setSelectedDepts(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  const handleStartEdit = (userData: UserData) => {
    setEditingUser(userData);
    setEditDepts(userData.departments.map(d => d.department.id).filter(Boolean));
    setEditPassword('');
    setEditConfirmPassword('');
  };

  const toggleEditDept = (deptId: string) => {
    setEditDepts(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (editPassword && editPassword !== editConfirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setSavingEdit(true);
    try {
      if (editingUser.role === 'OPERATIONS') {
        await api.put(`/users/${editingUser.id}/departments`, {
          departmentIds: editDepts
        });
      }

      if (editPassword) {
        await api.put(`/users/${editingUser.id}/password`, {
          password: editPassword
        });
      }

      alert('User updated successfully!');
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <div className="p-4 text-text-secondary">Loading users...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-card border border-border shadow-sm">
        <h3 className="text-lg font-medium text-text-primary mb-4">{isSuperAdmin ? 'Invite User' : 'Invite Operations User'}</h3>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary">Email Address</label>
            <input
              type="email"
              required
              className="mt-1 block w-full lg:w-1/2 border border-border rounded-md px-3 py-2 focus:ring-primary focus:border-primary"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>

          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-text-primary">Role</label>
              <select
                className="mt-1 block w-full lg:w-1/2 border border-border rounded-md px-3 py-2 bg-white"
                value={inviteRole}
                onChange={e => {
                  const role = e.target.value as 'OPERATIONS' | 'COMPANY_ADMIN';
                  setInviteRole(role);
                  if (role === 'COMPANY_ADMIN') {
                    setSelectedDepts([]);
                  }
                }}
              >
                <option value="OPERATIONS">Operations</option>
                <option value="COMPANY_ADMIN">Company Admin</option>
              </select>
            </div>
          )}
          
          {inviteRole === 'OPERATIONS' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Assign Departments</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {departments.map(dept => (
                  <label key={dept.id} className="flex items-center space-x-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={selectedDepts.includes(dept.id)}
                      onChange={() => toggleDept(dept.id)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span>{dept.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light"
          >
            Generate Invite Link
          </button>
        </form>

        {inviteLink && (
          <div className="mt-4 p-4 bg-green-50 text-secondary border border-green-200 rounded-md">
            <p className="font-medium mb-2">Success! Share this link with the user:</p>
            <div className="flex items-center">
              <input 
                readOnly 
                value={inviteLink} 
                className="flex-1 p-2 border border-border rounded bg-white text-sm"
              />
              <button 
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="ml-2 px-3 py-2 bg-white border border-border rounded text-sm hover:bg-gray-50"
              >
                Copy
              </button>
              <a 
                href={`https://wa.me/?text=Please set up your Saarlekha operations account here: ${inviteLink}`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 px-3 py-2 bg-[#25D366] text-white rounded text-sm font-medium hover:bg-[#128C7E]"
              >
                WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Departments</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-text-secondary mr-2" />
                    <span className="text-sm font-medium text-text-primary">{u.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                    u.role === 'COMPANY_ADMIN' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary max-w-xs truncate">
                  {u.departments.map(d => d.department.name).join(', ') || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {u.role !== 'SUPER_ADMIN' && (
                    <>
                      <button onClick={() => handleStartEdit(u)} className="text-primary hover:text-blue-900" title="Edit User">
                        <Edit className="h-4 w-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="text-danger hover:text-red-900" title="Delete User">
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block sm:hidden divide-y divide-border bg-white">
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No users found.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {users.map((u) => (
                <div 
                  key={u.id} 
                  className="border border-border rounded-card p-4 shadow-sm space-y-3 bg-white hover:border-primary transition-all relative"
                >
                  {/* Header: Email and Role badge */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Mail className="h-4 w-4 text-text-secondary flex-shrink-0" />
                      <span className="text-sm font-semibold text-text-primary truncate">{u.email}</span>
                    </div>
                    
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0 ${
                      u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'COMPANY_ADMIN' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Body: Departments list */}
                  <div className="text-xs text-text-secondary">
                    <span className="block text-[10px] text-text-secondary uppercase font-semibold">Assigned Departments</span>
                    <span className="font-medium text-text-primary mt-1 block">
                      {u.departments.map(d => d.department.name).join(', ') || '-'}
                    </span>
                  </div>

                  {/* Actions Row */}
                  {u.role !== 'SUPER_ADMIN' && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                      <button 
                        onClick={() => handleStartEdit(u)} 
                        className="text-primary hover:bg-blue-50 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                        title="Edit user"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        className="text-danger hover:bg-red-50 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card max-w-lg w-full p-6 space-y-4 shadow-xl border border-border">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">Edit User: {editingUser.email}</h3>
              <button onClick={() => setEditingUser(null)} className="text-text-secondary hover:text-text-primary text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSaveChanges} className="space-y-4">
              {editingUser.role === 'OPERATIONS' && (
                <div>
                  <label className="block text-sm font-semibold text-text-secondary uppercase mb-2">Assign Departments</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded-md">
                    {departments.map(dept => (
                      <label key={dept.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editDepts.includes(dept.id)}
                          onChange={() => toggleEditDept(dept.id)}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span>{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text-secondary uppercase">Change Password</h4>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">New Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    className="block w-full border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 letter, 1 number"
                  />
                </div>
                {editPassword && (
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      className="block w-full border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                      value={editConfirmPassword}
                      onChange={e => setEditConfirmPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-all font-medium bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition-all shadow-sm disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

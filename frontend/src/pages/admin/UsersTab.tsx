import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Link, Mail, Trash2 } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  role: string;
  created_at: string;
  departments: { department: { name: string } }[];
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {u.role !== 'SUPER_ADMIN' && (
                    <button onClick={() => handleDelete(u.id)} className="text-danger hover:text-red-900">
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Building, Trash2, Edit2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  billing_address: string;
  gst: string;
}

export function CustomerMaster() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '', contact_person: '', phone: '', email: '', billing_address: '', gst: ''
  });

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingCustomer(null);
    setFormData({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gst: '' });
    setShowForm(!showForm || editingCustomer !== null);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      contact_person: customer.contact_person || '',
      phone: customer.phone || '',
      email: customer.email || '',
      billing_address: customer.billing_address || '',
      gst: customer.gst || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isDuplicateName = customers.some(
      c => c.name.toLowerCase().trim() === formData.name.toLowerCase().trim() && c.id !== editingCustomer?.id
    );
    const isDuplicateGst = formData.gst?.trim() && customers.some(
      c => c.gst && c.gst.toLowerCase().trim() === formData.gst.toLowerCase().trim() && c.id !== editingCustomer?.id
    );

    if (isDuplicateName) {
      if (!window.confirm(`A customer company named "${formData.name.trim()}" already exists. Do you want to save this duplicate?`)) {
        return;
      }
    } else if (isDuplicateGst) {
      if (!window.confirm(`A customer with GST number "${formData.gst.trim()}" already exists. Do you want to save this duplicate?`)) {
        return;
      }
    }

    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setShowForm(false);
      setEditingCustomer(null);
      setFormData({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gst: '' });
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${editingCustomer ? 'update' : 'add'} customer`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Loading customers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">Customer Master</h1>
        {isAdmin && (
          <button 
            onClick={handleAddClick}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            {editingCustomer ? 'Edit Customer' : 'New Customer'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Company Name</label>
              <input required type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white focus:ring-primary focus:border-primary" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">GST Number</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white focus:ring-primary focus:border-primary" value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Contact Person</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white focus:ring-primary focus:border-primary" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Phone</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white focus:ring-primary focus:border-primary" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Email</label>
              <input type="email" className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white focus:ring-primary focus:border-primary" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-secondary">Billing Address</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white focus:ring-primary focus:border-primary" value={formData.billing_address} onChange={e => setFormData({...formData, billing_address: e.target.value})} />
            </div>
            <div className="md:col-span-2 pt-2 flex items-center gap-3">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light font-semibold">
                {editingCustomer ? 'Update Customer' : 'Save Customer'}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowForm(false);
                  setEditingCustomer(null);
                  setFormData({ name: '', contact_person: '', phone: '', email: '', billing_address: '', gst: '' });
                }} 
                className="border border-border text-text-secondary px-4 py-2 rounded-md hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <div key={customer.id} className="bg-white rounded-card border border-border shadow-sm p-6 relative hover:shadow-md transition-shadow">
            {isAdmin && (
              <div className="absolute top-4 right-4 flex items-center space-x-2">
                <button 
                  onClick={() => handleEditClick(customer)} 
                  className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50"
                  title="Edit Customer"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(customer.id)} 
                  className="text-danger hover:text-red-900 p-1 rounded hover:bg-red-50"
                  title="Delete Customer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="p-2 bg-surface rounded-lg mr-3">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary truncate pr-16">{customer.name}</h3>
            </div>
            <div className="space-y-1 text-sm text-text-secondary">
              <p>Contact: {customer.contact_person || 'N/A'}</p>
              <p>Phone: {customer.phone || 'N/A'}</p>
              {customer.email && <p>Email: {customer.email}</p>}
              <p>GST: {customer.gst || 'N/A'}</p>
              <p className="truncate" title={customer.billing_address}>Address: {customer.billing_address || 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

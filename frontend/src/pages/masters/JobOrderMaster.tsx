import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ExportBar } from '../../utils/export';
import { Plus, ClipboardList, Trash2, Edit, CheckCircle, XCircle, Lock, MoreVertical, X, Search } from 'lucide-react';
import clsx from 'clsx';
import { injectStandardFields, isStandardField } from '../../utils/standards';

interface Customer {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
}

interface JobOrder {
  id: string;
  order_number: string;
  status: string;
  start_date: string;
  end_date: string;
  customer: Customer;
  department?: Department;
  item?: Item;
  custom_item?: string;
  order_qty?: number;
  order_qty_unit?: string;
  production_qty?: number;
  production_qty_unit?: string;
  custom_data?: Record<string, any>;
}

interface FormatField {
  name: string;
  type: string;
  unit?: string;
  open?: boolean;
  options?: string[];
  formula?: {
    left: string;
    operator: string;
    right: string;
  };
}

export function JobOrderMaster() {
  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [itemsMaster, setItemsMaster] = useState<Item[]>([]);
  const [joSchema, setJoSchema] = useState<FormatField[]>([]);
  const [loading, setLoading] = useState(true);

  const evaluateCalculatedField = (field: FormatField, record: any) => {
    if (field.type !== 'calculated' || !field.formula) return 0;
    const { left, operator, right } = field.formula;

    const getVal = (opName: string) => {
      if (opName === 'order_qty') {
        const v = record.order_qty;
        return v === '' || v === undefined || v === null ? 0 : Number(v);
      }
      if (opName === 'production_qty') {
        const v = record.production_qty;
        return v === '' || v === undefined || v === null ? 0 : Number(v);
      }
      // Custom field
      const customData = record.custom_data || {};
      const customVal = customData[opName];
      if (customVal === '' || customVal === undefined || customVal === null) return 0;
      return Number(customVal) || 0;
    };

    const leftVal = getVal(left);
    const rightVal = getVal(right);

    let result = 0;
    if (operator === '+') result = leftVal + rightVal;
    else if (operator === '-') result = leftVal - rightVal;
    else if (operator === '*') result = leftVal * rightVal;
    else if (operator === '/') result = rightVal !== 0 ? leftVal / rightVal : 0;
    
    return Math.round((result + Number.EPSILON) * 1000) / 1000;
  };

  const getOperandLabel = (val?: string) => {
    if (!val) return '';
    if (val === 'order_qty') return 'Order Qty';
    if (val === 'production_qty') return 'Production Qty';
    return val;
  };

  // Quick inline creation modals state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerModalData, setCustomerModalData] = useState({
    name: '',
    gst: '',
    contact_person: '',
    phone: '',
    email: '',
    billing_address: ''
  });
  
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [deptModalData, setDeptModalData] = useState({
    name: ''
  });

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemModalData, setItemModalData] = useState({
    name: ''
  });
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const { user } = useAuth();
  
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<JobOrder | null>(null);
  
  const [formData, setFormData] = useState<any>({
    order_number: '',
    customer_id: '',
    status: 'OPEN',
    start_date: '',
    end_date: '',
    department_id: '',
    item_id: '',
    custom_item: '',
    order_qty: '',
    order_qty_unit: '',
    production_qty: '',
    production_qty_unit: '',
    custom_data: {}
  });
  const [ignoreItemMaster, setIgnoreItemMaster] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');
  const isOperations = user?.role === 'OPERATIONS';

  const filteredOrders = orders.filter(order => {
    // 1. Date Range Filter
    if (startDate && endDate) {
      const orderDate = order.start_date ? new Date(order.start_date) : new Date((order as any).created_at || Date.now());
      const start = new Date(startDate);
      const end = new Date(endDate);
      orderDate.setHours(0,0,0,0);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      if (!(orderDate >= start && orderDate <= end)) {
        return false;
      }
    }

    // 2. Search Term Filter
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    // Gather all searchable string representations of the values shown in table cells
    const searchableFields: string[] = [
      order.order_number,
      order.customer?.name || '',
      order.department?.name || '',
      order.custom_item ? order.custom_item : (order.item?.name || ''),
      order.order_qty !== null && order.order_qty !== undefined ? String(order.order_qty) : '',
      order.order_qty_unit || '',
      order.production_qty !== null && order.production_qty !== undefined ? String(order.production_qty) : '',
      order.production_qty_unit || '',
      order.status || '',
      (order.status || '').replace('_', ' '),
      order.start_date ? new Date(order.start_date).toLocaleDateString() : 'N/A',
      order.end_date ? new Date(order.end_date).toLocaleDateString() : 'N/A',
    ];

    // Add custom columns display values based on schemas
    joSchema.forEach(field => {
      let val = order.custom_data?.[field.name];
      if (field.type === 'calculated') {
        val = evaluateCalculatedField(field, order);
      }
      if (val !== null && val !== undefined) {
        if (field.type === 'boolean') {
          searchableFields.push(val === true ? 'Yes' : val === false ? 'No' : '');
        } else {
          searchableFields.push(String(val));
        }
      }
    });

    // Also fallback to any raw custom_data values to guarantee indexing
    if (order.custom_data) {
      Object.values(order.custom_data).forEach(val => {
        if (val !== null && val !== undefined) {
          searchableFields.push(String(val));
        }
      });
    }

    return searchableFields.some(fieldVal =>
      fieldVal.toLowerCase().includes(term)
    );
  });

  const getExportData = () => {
    const columns = joSchema.map(field => ({
      header: field.name + (field.unit ? ` (${field.unit})` : ''),
      key: field.name
    }));

    const targetOrders = selectedOrders.length > 0
      ? filteredOrders.filter(order => selectedOrders.includes(order.id))
      : filteredOrders;

    const rows = targetOrders.map(order => {
      const rowObj: Record<string, any> = {};

      joSchema.forEach(field => {
        const normName = field.name.toLowerCase().trim();
        if (normName === 'order number') {
          rowObj[field.name] = order.order_number;
        } else if (normName === 'customer') {
          rowObj[field.name] = order.customer?.name || '';
        } else if (normName === 'department') {
          rowObj[field.name] = order.department?.name || '';
        } else if (normName === 'item description') {
          rowObj[field.name] = order.item?.name || order.custom_item || '';
        } else if (normName === 'start date') {
          rowObj[field.name] = order.start_date ? new Date(order.start_date).toLocaleDateString() : '';
        } else if (normName === 'end/target date') {
          rowObj[field.name] = order.end_date ? new Date(order.end_date).toLocaleDateString() : '';
        } else if (normName === 'status') {
          rowObj[field.name] = order.status;
        } else if (normName === 'order qty') {
          rowObj[field.name] = order.order_qty ?? '';
        } else if (normName === 'order units') {
          rowObj[field.name] = order.order_qty_unit || '';
        } else if (normName === 'production qty') {
          rowObj[field.name] = order.production_qty ?? '';
        } else if (normName === 'production units') {
          rowObj[field.name] = order.production_qty_unit || '';
        } else {
          if (field.type === 'calculated') {
            rowObj[field.name] = evaluateCalculatedField(field, order);
          } else {
            const val = order.custom_data?.[field.name];
            if (field.type === 'boolean') {
              rowObj[field.name] = val === true ? 'Yes' : val === false ? 'No' : '';
            } else {
              rowObj[field.name] = val ?? '';
            }
          }
        }
      });

      return rowObj;
    });

    return {
      title: selectedOrders.length > 0 ? 'Selected Job Orders Report' : 'Job Orders Report',
      subtitle: selectedOrders.length > 0 ? `Exported ${selectedOrders.length} selected items` : (startDate && endDate ? `${startDate} to ${endDate}` : 'All Job Orders'),
      filename: `job_orders_${selectedOrders.length > 0 ? 'selected' : (startDate || 'all') + '_' + (endDate || 'all')}`,
      columns,
      rows
    };
  };

  const filteredItems = itemsMaster.filter(item => 
    item.name && item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenDropdownId(null);
      setShowItemDropdown(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [ordRes, custRes, formatRes, deptRes, itemsRes] = await Promise.all([
        api.get('/job-orders'),
        api.get('/customers'),
        api.get('/reports/formats'),
        api.get('/departments'),
        api.get('/items?status=ACTIVE')
      ]);
      setOrders(ordRes.data);
      setCustomers(custRes.data);
      setDepartments(deptRes.data);
      setItemsMaster(itemsRes.data);
      setSelectedOrders([]);
      const joFmt = formatRes.data.find((f: any) => f.type === 'JOB_ORDER');
      if (joFmt && joFmt.versions && joFmt.versions[0]) {
        setJoSchema(injectStandardFields(joFmt.versions[0].fields_schema || [], 'JOB_ORDER'));
      } else {
        setJoSchema(injectStandardFields([], 'JOB_ORDER'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomFieldChange = (name: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      custom_data: {
        ...prev.custom_data,
        [name]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      order_qty: formData.order_qty === '' || formData.order_qty === undefined || formData.order_qty === null ? null : Number(formData.order_qty),
      production_qty: formData.production_qty === '' || formData.production_qty === undefined || formData.production_qty === null ? null : Number(formData.production_qty),
      order_qty_unit: formData.order_qty_unit === '' ? null : formData.order_qty_unit,
      production_qty_unit: formData.production_qty_unit === '' ? null : formData.production_qty_unit,
    };
    try {
      if (editingOrder) {
        await api.put(`/job-orders/${editingOrder.id}`, payload);
        alert('Job order updated successfully!');
      } else {
        await api.post('/job-orders', payload);
        alert('Job order created successfully!');
      }
      setShowForm(false);
      setEditingOrder(null);
      setIgnoreItemMaster(false);
      setItemSearchQuery('');
      setSelectedOrders([]);
      setFormData({
        order_number: '',
        customer_id: '',
        status: 'OPEN',
        start_date: '',
        end_date: '',
        department_id: '',
        item_id: '',
        custom_item: '',
        order_qty: '',
        order_qty_unit: '',
        production_qty: '',
        production_qty_unit: '',
        custom_data: {}
      });
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to save job order';
      const details = err.response?.data?.details;
      alert(details ? `${msg}: ${details}` : msg);
    }
  };

  const handleStartEdit = (order: JobOrder) => {
    setEditingOrder(order);
    const isIgnore = !!order.custom_item;
    setIgnoreItemMaster(isIgnore);
    setItemSearchQuery(order.item?.name || '');
    setFormData({
      order_number: order.order_number || '',
      customer_id: order.customer?.id || '',
      status: order.status || 'OPEN',
      start_date: order.start_date ? order.start_date.split('T')[0] : '',
      end_date: order.end_date ? order.end_date.split('T')[0] : '',
      department_id: (order as any).department_id || '',
      item_id: (order as any).item_id || '',
      custom_item: (order as any).custom_item || '',
      order_qty: order.order_qty !== undefined && order.order_qty !== null ? String(order.order_qty) : '',
      order_qty_unit: order.order_qty_unit || '',
      production_qty: order.production_qty !== undefined && order.production_qty !== null ? String(order.production_qty) : '',
      production_qty_unit: order.production_qty_unit || '',
      custom_data: order.custom_data || {}
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingOrder(null);
    setIgnoreItemMaster(false);
    setItemSearchQuery('');
    setSelectedOrders([]);
    setFormData({
      order_number: '',
      customer_id: '',
      status: 'OPEN',
      start_date: '',
      end_date: '',
      department_id: '',
      item_id: '',
      custom_item: '',
      order_qty: '',
      order_qty_unit: '',
      production_qty: '',
      production_qty_unit: '',
      custom_data: {}
    });
  };

  const handleDelete = async (id: string, orderNumber: string) => {
    if (!confirm(`Are you sure you want to delete job order "${orderNumber}"?`)) return;
    try {
      await api.delete(`/job-orders/${id}`);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to delete job order';
      const details = err.response?.data?.details;
      alert(details ? `${msg}: ${details}` : msg);
    }
  };

  const toggleDropdown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(prev => (prev === id ? null : id));
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const statusName = newStatus === 'COMPLETED' ? 'completed' : newStatus.toLowerCase();
    if (!confirm(`Are you sure you want to mark this job order as ${statusName}?`)) return;
    try {
      await api.put(`/job-orders/${id}`, { status: newStatus });
      alert(`Job order marked as ${statusName} successfully!`);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update job order status';
      const details = err.response?.data?.details;
      alert(details ? `${msg}: ${details}` : msg);
    }
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/customers', customerModalData);
      const newCust = res.data;
      const custRes = await api.get('/customers');
      setCustomers(custRes.data);
      setFormData((prev: any) => ({
        ...prev,
        customer_id: newCust.id
      }));
      setShowAddCustomerModal(false);
      setCustomerModalData({
        name: '',
        gst: '',
        contact_person: '',
        phone: '',
        email: '',
        billing_address: ''
      });
      alert('Customer created and selected successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create customer');
    }
  };

  const handleAddDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/departments', deptModalData);
      const newDept = res.data;
      const deptRes = await api.get('/departments');
      setDepartments(deptRes.data);
      setFormData((prev: any) => ({
        ...prev,
        department_id: newDept.id
      }));
      setShowAddDeptModal(false);
      setDeptModalData({ name: '' });
      alert('Department created and selected successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create department');
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/items', { name: itemModalData.name, custom_data: {} });
      const newItem = res.data;
      const itemsRes = await api.get('/items?status=ACTIVE');
      setItemsMaster(itemsRes.data);
      
      if (newItem.status === 'ACTIVE') {
        setFormData((prev: any) => ({
          ...prev,
          item_id: newItem.id
        }));
        setItemSearchQuery(newItem.name);
        alert('Item created and selected successfully!');
      } else {
        alert('Item proposed successfully! It will be available once approved by an administrator.');
      }
      
      setShowAddItemModal(false);
      setItemModalData({ name: '' });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create item');
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleBulkDeleteOrders = async () => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedOrders.length} selected job orders?`)) return;

    try {
      await api.post('/job-orders/bulk-delete', { ids: selectedOrders });
      setSelectedOrders([]);
      alert('Selected job orders deleted successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete job orders');
    }
  };

  if (loading) return <div className="p-4">Loading job orders...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Job Orders</h1>
          <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-1.5 shadow-sm text-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none bg-transparent" placeholder="Start Date" />
            <span className="text-text-secondary">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none bg-transparent" placeholder="End Date" />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-text-secondary hover:text-text-primary font-semibold ml-1">Clear</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && selectedOrders.length > 0 && (
            <button
              onClick={handleBulkDeleteOrders}
              className="inline-flex items-center px-4 py-2 bg-danger text-white text-sm font-medium rounded-md hover:bg-red-700 shadow-sm transition-colors animate-in fade-in duration-100"
            >
              Delete Selected ({selectedOrders.length})
            </button>
          )}
          <ExportBar loading={loading} opts={getExportData()} />
          {isAdmin && (
            <button 
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Job Order
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            {editingOrder ? `Edit Job Order: ${editingOrder.order_number}` : 'New Job Order'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {joSchema.map((field, idx) => {
                const normName = field.name.toLowerCase().trim();
                const isDisabled = isOperations && !isStandardField(field.name, 'JOB_ORDER') && !field.open;
                
                if (normName === 'order number') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Order Number</label>
                      <input 
                        type="text" 
                        disabled 
                        className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-gray-100 text-text-secondary font-semibold font-mono" 
                        value={editingOrder ? formData.order_number : 'Auto-generated'} 
                        readOnly 
                      />
                    </div>
                  );
                }
                
                if (normName === 'customer') {
                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-semibold text-text-secondary uppercase">Customer</label>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setShowAddCustomerModal(true)}
                            className="text-xs text-primary hover:text-primary-light font-semibold flex items-center gap-0.5"
                          >
                            <Plus className="h-3 w-3" /> New Customer
                          </button>
                        )}
                      </div>
                      <select required disabled={isOperations} className="block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary" value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})}>
                        <option value="">Select Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  );
                }
                
                if (normName === 'department') {
                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-semibold text-text-secondary uppercase">Department</label>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setShowAddDeptModal(true)}
                            className="text-xs text-primary hover:text-primary-light font-semibold flex items-center gap-0.5"
                          >
                            <Plus className="h-3 w-3" /> New Department
                          </button>
                        )}
                      </div>
                      <select 
                        required 
                        disabled={isOperations} 
                        className="block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary" 
                        value={formData.department_id} 
                        onChange={e => setFormData({...formData, department_id: e.target.value})}
                      >
                        <option value="">Select Department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  );
                }
                
                if (normName === 'item description') {
                  return (
                    <div key={idx} onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <label className="block text-sm font-semibold text-text-secondary uppercase">Item Description</label>
                          {!ignoreItemMaster && (
                            <button
                              type="button"
                              onClick={() => setShowAddItemModal(true)}
                              className="text-xs text-primary hover:text-primary-light font-semibold flex items-center gap-0.5"
                            >
                              <Plus className="h-3 w-3" /> New Item
                            </button>
                          )}
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-text-secondary">
                          <input
                            type="checkbox"
                            disabled={isOperations}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                            checked={ignoreItemMaster}
                            onChange={e => {
                              setIgnoreItemMaster(e.target.checked);
                              if (e.target.checked) {
                                setFormData((prev: any) => ({ ...prev, item_id: '', custom_item: '' }));
                                setItemSearchQuery('');
                              } else {
                                setFormData((prev: any) => ({ ...prev, custom_item: '', item_id: '' }));
                                setItemSearchQuery('');
                              }
                            }}
                          />
                          <span>Ignore Item Master</span>
                        </label>
                      </div>
                      {ignoreItemMaster ? (
                        <input
                          type="text"
                          required
                          disabled={isOperations}
                          placeholder="Enter custom item description..."
                          className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-text-secondary mt-1 font-semibold"
                          value={formData.custom_item || ''}
                          onChange={e => setFormData({ ...formData, custom_item: e.target.value })}
                        />
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            required={!formData.item_id}
                            disabled={isOperations}
                            placeholder="Search items from master..."
                            className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-text-secondary mt-1 font-semibold"
                            value={itemSearchQuery}
                            onFocus={() => setShowItemDropdown(true)}
                            onChange={e => {
                              setItemSearchQuery(e.target.value);
                              setShowItemDropdown(true);
                              setFormData((prev: any) => ({ ...prev, item_id: '' }));
                            }}
                          />
                          {showItemDropdown && !isOperations && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {filteredItems.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-text-secondary">No items found</div>
                              ) : (
                                filteredItems.map(item => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors"
                                    onClick={() => {
                                      setFormData((prev: any) => ({ ...prev, item_id: item.id }));
                                      setItemSearchQuery(item.name || '');
                                      setShowItemDropdown(false);
                                    }}
                                  >
                                    {item.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                
                if (normName === 'start date') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Start Date</label>
                      <input type="date" disabled={isOperations} className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                    </div>
                  );
                }
                
                if (normName === 'end/target date') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">End Date / Target Date</label>
                      <input type="date" disabled={isOperations} className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                    </div>
                  );
                }
                
                if (normName === 'status') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Status</label>
                      <select disabled={isOperations} className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  );
                }
                
                if (normName === 'order qty') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Order Qty</label>
                      <input
                        type="number"
                        step="any"
                        disabled={isOperations}
                        placeholder="e.g. 1000"
                        className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.order_qty !== undefined && formData.order_qty !== null ? formData.order_qty : ''}
                        onChange={e => setFormData({...formData, order_qty: e.target.value})}
                      />
                    </div>
                  );
                }
                
                if (normName === 'order units') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Order Units</label>
                      <input
                        type="text"
                        disabled={isOperations}
                        placeholder="e.g. pcs, kg, mtr"
                        className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.order_qty_unit || ''}
                        onChange={e => setFormData({...formData, order_qty_unit: e.target.value})}
                      />
                    </div>
                  );
                }
                
                if (normName === 'production qty') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Production Qty</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 450"
                        className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.production_qty !== undefined && formData.production_qty !== null ? formData.production_qty : ''}
                        onChange={e => setFormData({...formData, production_qty: e.target.value})}
                      />
                    </div>
                  );
                }
                
                if (normName === 'production units') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Production Units</label>
                      <input
                        type="text"
                        disabled={isOperations}
                        placeholder="e.g. pcs, kg, mtr"
                        className="mt-1 block w-full border border-border rounded-md px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.production_qty_unit || ''}
                        onChange={e => setFormData({...formData, production_qty_unit: e.target.value})}
                      />
                    </div>
                  );
                }
                
                return (
                  <div key={idx}>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                      {field.name} {field.unit && <span className="text-primary text-[10px] ml-1">({field.unit})</span>}
                      {field.open && <span className="text-green-600 text-[10px] ml-2">(Editable)</span>}
                    </label>
                    {field.type === 'dropdown' ? (
                      <select 
                        disabled={isDisabled}
                        className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.custom_data?.[field.name] !== undefined ? String(formData.custom_data[field.name]) : ''}
                        onChange={e => handleCustomFieldChange(field.name, e.target.value)}
                      >
                        <option value="">Select {field.name}...</option>
                        {field.options?.map((opt, oIdx) => (
                          <option key={oIdx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <select 
                        disabled={isDisabled}
                        className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.custom_data?.[field.name] !== undefined ? String(formData.custom_data[field.name]) : ''}
                        onChange={e => handleCustomFieldChange(field.name, e.target.value === 'true')}
                      >
                        <option value="">Select...</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : field.type === 'department' ? (
                      <select 
                        disabled={isDisabled}
                        className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.custom_data?.[field.name] !== undefined ? String(formData.custom_data[field.name]) : ''}
                        onChange={e => handleCustomFieldChange(field.name, e.target.value)}
                      >
                        <option value="">Select Department...</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    ) : field.type === 'calculated' ? (
                      <div>
                        <div className="bg-gray-100 border border-border/60 rounded-md px-3 py-2 text-sm font-semibold text-primary select-none cursor-not-allowed">
                          {evaluateCalculatedField(field, formData)}
                        </div>
                        <span className="text-[10px] text-text-secondary italic">
                          Auto-computed: {getOperandLabel(field.formula?.left)} {field.formula?.operator} {getOperandLabel(field.formula?.right)}
                        </span>
                      </div>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        step={field.type === 'number' ? 'any' : undefined}
                        disabled={isDisabled}
                        className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-text-secondary font-semibold"
                        value={formData.custom_data?.[field.name] !== undefined ? formData.custom_data[field.name] : ''}
                        onChange={e => handleCustomFieldChange(field.name, field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-4 flex gap-2">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light font-semibold shadow-sm text-sm">
                {editingOrder ? 'Save Changes' : 'Create Order'}
              </button>
              <button type="button" onClick={handleCancel} className="bg-gray-100 text-text-secondary px-4 py-2 rounded-md hover:bg-gray-200 font-semibold text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar Panel */}
      <div className="bg-white p-4 rounded-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-secondary" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-md text-sm bg-white placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            placeholder="Search by order #, customer, item, department, status..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setSelectedOrders([]); // reset selection on search
            }}
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedOrders([]);
            }}
            className="text-sm text-primary hover:underline font-semibold self-start md:self-auto"
          >
            Clear Search
          </button>
        )}
        <div className="text-sm text-text-secondary font-medium self-end md:self-auto">
          Found {filteredOrders.length} matching job orders
        </div>
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[260px]">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface">
              <tr>
                {isAdmin && (
                  <th className="w-12 px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                      onChange={handleToggleSelectAllOrders}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Order #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Item Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase font-bold text-primary">Order Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase font-bold text-primary">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase font-bold text-primary">Production</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase font-bold text-primary">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Timeline</th>
                {joSchema.map((field, idx) => (
                  <th key={idx} className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                     {field.name}{field.unit ? ` (${field.unit})` : ''}
                  </th>
                ))}
                {(isAdmin || isOperations) && <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-surface">
                  {isAdmin && (
                    <td className="w-12 px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => handleToggleSelectOrder(order.id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </td>
                  )}
                  {joSchema.map((field, idx) => {
                    const normName = field.name.toLowerCase().trim();
                    let displayVal: React.ReactNode = '—';
                    
                    if (normName === 'order number') {
                      displayVal = (
                        <div className="flex items-center">
                          <ClipboardList className="h-5 w-5 text-text-secondary mr-3 animate-pulse" />
                          <Link 
                            to={`/job-orders/summary/${encodeURIComponent(order.order_number)}`} 
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            {order.order_number}
                          </Link>
                        </div>
                      );
                    } else if (normName === 'customer') {
                      displayVal = order.customer?.name || '—';
                    } else if (normName === 'department') {
                      displayVal = order.department?.name || '—';
                    } else if (normName === 'item description') {
                      displayVal = order.custom_item ? order.custom_item : (order.item?.name || '—');
                    } else if (normName === 'start date') {
                      displayVal = order.start_date ? new Date(order.start_date).toLocaleDateString() : 'N/A';
                    } else if (normName === 'end/target date') {
                      displayVal = order.end_date ? new Date(order.end_date).toLocaleDateString() : 'N/A';
                    } else if (normName === 'status') {
                      displayVal = (
                        <span className={clsx(
                          "px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full",
                          order.status === 'OPEN' && 'bg-blue-100 text-blue-800',
                          order.status === 'IN_PROGRESS' && 'bg-yellow-100 text-yellow-800',
                          order.status === 'COMPLETED' && 'bg-green-100 text-green-800',
                          order.status === 'CANCELLED' && 'bg-red-100 text-red-800'
                        )}>
                          {order.status.replace('_', ' ')}
                        </span>
                      );
                    } else if (normName === 'order qty') {
                      displayVal = order.order_qty !== null && order.order_qty !== undefined ? order.order_qty : '—';
                    } else if (normName === 'order units') {
                      displayVal = order.order_qty_unit || '—';
                    } else if (normName === 'production qty') {
                      displayVal = order.production_qty !== null && order.production_qty !== undefined ? order.production_qty : '—';
                    } else if (normName === 'production units') {
                      displayVal = order.production_qty_unit || '—';
                    } else {
                      let val = order.custom_data?.[field.name];
                      if (field.type === 'calculated') {
                        val = evaluateCalculatedField(field, order);
                      }
                      if (field.type === 'boolean') {
                        displayVal = val === true ? 'Yes' : val === false ? 'No' : '—';
                      } else {
                        displayVal = val !== null && val !== undefined ? String(val) : '—';
                      }
                    }
                    
                    return (
                      <td key={idx} className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium tabular-nums">
                        {displayVal}
                      </td>
                    );
                  })}
                  {(isAdmin || isOperations) && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => toggleDropdown(order.id, e)}
                          className="text-text-secondary hover:text-text-primary bg-surface hover:bg-gray-150 p-1.5 rounded transition-colors border border-border"
                          title="Actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>

                      {openDropdownId === order.id && (
                        <div 
                          className="absolute right-full -top-2 mr-2 w-48 bg-white border border-border rounded-md shadow-lg z-50 py-1 text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Edit Option */}
                          {isOperations && (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'CLOSED') ? (
                            <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 cursor-not-allowed bg-gray-50">
                              <Lock className="h-3.5 w-3.5" />
                              <span>Edit (Locked)</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleStartEdit(order);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-primary hover:bg-surface transition-colors"
                            >
                              <Edit className="h-3.5 w-3.5 text-primary" />
                              <span>Edit Details</span>
                            </button>
                          )}

                          {/* Quick Status Options */}
                          {(order.status === 'OPEN' || order.status === 'IN_PROGRESS') && (
                            <>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handleUpdateStatus(order.id, 'COMPLETED');
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-primary hover:bg-surface transition-colors"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-secondary" />
                                <span>Mark as Completed</span>
                              </button>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handleUpdateStatus(order.id, 'CANCELLED');
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-primary hover:bg-surface transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5 text-danger" />
                                <span>Mark as Cancelled</span>
                              </button>
                            </>
                          )}

                          {/* Delete Option (Admin only) */}
                          {isAdmin && (
                            <>
                              <div className="border-t border-border/60 my-1"></div>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handleDelete(order.id, order.order_number);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-danger hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-danger" />
                                <span>Delete Order</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Modals */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card border border-border shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 animate-duration-150">
            <div className="flex justify-between items-center bg-surface px-6 py-4 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">Create New Customer</h3>
              <button 
                type="button" 
                onClick={() => setShowAddCustomerModal(false)}
                className="text-text-secondary hover:text-text-primary p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Company Name *</label>
                <input 
                  required 
                  type="text" 
                  className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                  value={customerModalData.name} 
                  onChange={e => setCustomerModalData({...customerModalData, name: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">GST Number</label>
                <input 
                  type="text" 
                  className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                  value={customerModalData.gst} 
                  onChange={e => setCustomerModalData({...customerModalData, gst: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Contact Person</label>
                  <input 
                    type="text" 
                    className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                    value={customerModalData.contact_person} 
                    onChange={e => setCustomerModalData({...customerModalData, contact_person: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Phone</label>
                  <input 
                    type="text" 
                    className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                    value={customerModalData.phone} 
                    onChange={e => setCustomerModalData({...customerModalData, phone: e.target.value})} 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Email</label>
                <input 
                  type="email" 
                  className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                  value={customerModalData.email} 
                  onChange={e => setCustomerModalData({...customerModalData, email: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Billing Address</label>
                <input 
                  type="text" 
                  className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                  value={customerModalData.billing_address} 
                  onChange={e => setCustomerModalData({...customerModalData, billing_address: e.target.value})} 
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddCustomerModal(false)}
                  className="bg-gray-100 text-text-secondary px-4 py-2 rounded-md hover:bg-gray-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light font-semibold shadow-sm text-sm"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card border border-border shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 animate-duration-150">
            <div className="flex justify-between items-center bg-surface px-6 py-4 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">Create New Department</h3>
              <button 
                type="button" 
                onClick={() => setShowAddDeptModal(false)}
                className="text-text-secondary hover:text-text-primary p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddDeptSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Department Name *</label>
                <input 
                  required 
                  type="text" 
                  className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                  value={deptModalData.name} 
                  onChange={e => setDeptModalData({ name: e.target.value })} 
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddDeptModal(false)}
                  className="bg-gray-100 text-text-secondary px-4 py-2 rounded-md hover:bg-gray-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light font-semibold shadow-sm text-sm"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-card border border-border shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 animate-duration-150">
            <div className="flex justify-between items-center bg-surface px-6 py-4 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">Propose New Item</h3>
              <button 
                type="button" 
                onClick={() => setShowAddItemModal(false)}
                className="text-text-secondary hover:text-text-primary p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddItemSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Item Name / Code *</label>
                <input 
                  required 
                  type="text" 
                  className="block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" 
                  value={itemModalData.name} 
                  onChange={e => setItemModalData({ name: e.target.value })} 
                />
              </div>
              {!isAdmin && (
                <p className="text-xs text-text-secondary">Note: The item will be proposed with a PENDING status and must be approved by an administrator before it is selectable.</p>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddItemModal(false)}
                  className="bg-gray-100 text-text-secondary px-4 py-2 rounded-md hover:bg-gray-200 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light font-semibold shadow-sm text-sm"
                >
                  {isAdmin ? 'Save Item' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

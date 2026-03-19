import React, { useState, useEffect, useMemo } from 'react';
import { User, Settings, Order, Item, SocialLink, OrderStatus } from '../types';
import { dbService } from '../services/db';
import { sendMetaWhatsAppMessage } from '../services/whatsapp';
import Layout from './Layout';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Package, 
  Share2, 
  Settings as SettingsIcon,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Save,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageCircle,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AdminPanelProps {
  userData: User | null;
  settings: Settings | null;
  onImpersonate: (user: User | null) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ userData, settings, onImpersonate }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  
  // Filters & Search
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Item Form
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newItem, setNewItem] = useState({ name: '', service: '', price: 0, showPriceToCustomer: true });

  // Settings Form
  const [tempSettings, setTempSettings] = useState<Settings | null>(settings);

  // Retail Order State
  const [retailOrder, setRetailOrder] = useState<{ customerName: string; mobile: string; address: string; items: any[] }>({
    customerName: '', mobile: '', address: '', items: []
  });
  const [retailItem, setRetailItem] = useState({ name: '', service: '', quantity: 1 });

  useEffect(() => {
    if (userData) {
      // Limit orders to last 100 for better performance
      const unsubscribeOrders = dbService.subscribeToCollection<Order>('orders', [orderBy('createdAt', 'desc'), limit(100)], (data) => {
        setOrders(data);
      });
      const unsubscribeItems = dbService.subscribeToCollection<Item>('items', [orderBy('name', 'asc')], setItems);
      const unsubscribeUsers = dbService.subscribeToCollection<User>('users', [orderBy('createdAt', 'desc')], setUsers);
      const unsubscribeSocial = dbService.subscribeToCollection<SocialLink>('socialLinks', [], setSocialLinks);

      return () => {
        unsubscribeOrders();
        unsubscribeItems();
        unsubscribeUsers();
        unsubscribeSocial();
      };
    }
  }, [userData]);

  useEffect(() => {
    if (settings) setTempSettings(settings);
  }, [settings]);

  // Stats Calculations
  const stats = useMemo(() => ({
    totalCustomers: users.filter(u => u.role === 'customer').length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    processingOrders: orders.filter(o => o.status === 'processing').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
  }), [users, orders]);

  // Chart Data
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      orders: orders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const createdAtStr = !isNaN(d.getTime()) ? d.toISOString() : '';
        return createdAtStr.startsWith(date);
      }).length,
      revenue: orders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const createdAtStr = !isNaN(d.getTime()) ? d.toISOString() : '';
        return createdAtStr.startsWith(date);
      }).reduce((sum, o) => sum + o.totalAmount, 0),
    }));
  }, [orders]);

  const statusData = [
    { name: 'Pending', value: stats.pendingOrders, color: '#f59e0b' },
    { name: 'Processing', value: stats.processingOrders, color: '#3b82f6' },
    { name: 'Completed', value: stats.completedOrders, color: '#10b981' },
  ];

  // PDF Generation
  const generateBillPDF = async (order: Order) => {
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text(settings?.shopName || 'Shop Name', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text(settings?.address || 'Shop Address', margin, y);
    y += 5;
    doc.text(`Contact: ${settings?.contactNumber || 'N/A'}`, margin, y);
    y += 15;

    // Order Info
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39); // Gray-900
    doc.text(`INVOICE #${order.id.slice(-8).toUpperCase()}`, margin, y);
    y += 10;

    doc.setFontSize(10);
    const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const orderDate = !isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A';
    doc.text(`Date: ${orderDate}`, margin, y);
    y += 5;
    doc.text(`Customer: ${order.customerName}`, margin, y);
    y += 5;
    doc.text(`Mobile: ${order.mobile}`, margin, y);
    y += 15;

    // Table Header
    doc.setFillColor(243, 244, 246); // Gray-100
    doc.rect(margin, y, 170, 10, 'F');
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81); // Gray-700
    doc.text('Item', margin + 5, y + 7);
    doc.text('Qty', margin + 100, y + 7);
    doc.text('Price', margin + 120, y + 7);
    doc.text('Total', margin + 150, y + 7);
    y += 15;

    // Items
    order.items.forEach(item => {
      doc.text(`${item.itemName} (${item.service})`, margin + 5, y);
      doc.text(item.quantity.toString(), margin + 100, y);
      doc.text(`₹${item.price}`, margin + 120, y);
      doc.text(`₹${item.price * item.quantity}`, margin + 150, y);
      y += 8;
    });

    // Footer
    y += 10;
    doc.setDrawColor(229, 231, 235); // Gray-200
    doc.line(margin, y, margin + 170, y);
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text('Total Amount:', margin + 100, y);
    doc.text(`₹${order.totalAmount}`, margin + 150, y);

    doc.save(`invoice-${order.id.slice(-8)}.pdf`);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await dbService.updateDocument('orders', orderId, { status });
    
    // Send status update notification
    const order = orders.find(o => o.id === orderId);
    if (order && settings?.metaWhatsAppConfig?.enabled) {
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);
      await sendMetaWhatsAppMessage(
        settings.metaWhatsAppConfig,
        order.mobile,
        order.customerName,
        `Your order status has been updated to: ${statusText}`
      );
    }
  };

  const handleUpdateTrackingId = async (orderId: string, trackingId: string) => {
    await dbService.updateDocument('orders', orderId, { trackingId });
    
    // Send tracking update notification
    const order = orders.find(o => o.id === orderId);
    if (order && settings?.metaWhatsAppConfig?.enabled && trackingId) {
      await sendMetaWhatsAppMessage(
        settings.metaWhatsAppConfig,
        order.mobile,
        order.customerName,
        `Your order has been shipped! Tracking ID: ${trackingId}`
      );
    }
  };

  const handleSaveItem = async () => {
    if (editingItem) {
      await dbService.updateDocument('items', editingItem.id, newItem);
      setEditingItem(null);
    } else {
      await dbService.addDocument('items', { ...newItem, createdAt: new Date().toISOString() });
    }
    setNewItem({ name: '', service: '', price: 0, showPriceToCustomer: true });
  };

  const handleSaveSettings = async () => {
    if (tempSettings) {
      await dbService.setDocument('settings', 'global', tempSettings);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'retail', label: 'Retail Customer', icon: <Users className="w-5 h-5" /> },
    { id: 'items', label: 'Items', icon: <Package className="w-5 h-5" /> },
    { id: 'social', label: 'Social Media', icon: <Share2 className="w-5 h-5" /> },
    { id: 'users', label: 'Users', icon: <UserCheck className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  return (
    <Layout userData={userData} settings={settings} activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs}>
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Customers', value: stats.totalCustomers, icon: <Users className="w-6 h-6" />, color: 'bg-blue-500' },
              { label: 'Total Orders', value: stats.totalOrders, icon: <ShoppingBag className="w-6 h-6" />, color: 'bg-indigo-500' },
              { label: 'Pending', value: stats.pendingOrders, icon: <Clock className="w-6 h-6" />, color: 'bg-amber-500' },
              { label: 'Revenue', value: `₹${stats.totalRevenue}`, icon: <TrendingUp className="w-6 h-6" />, color: 'bg-emerald-500' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
              >
                <div className={`${stat.color} p-3 rounded-xl text-white shadow-lg shadow-${stat.color.split('-')[1]}-100`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-8">Revenue Overview</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      cursor={{ fill: '#f9fafb' }}
                    />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-8">Order Status</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4 mt-4">
                {statusData.map((status, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-sm text-gray-600">{status.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{status.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-3xl font-bold text-gray-900">Order Management</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tracking ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders
                    .filter(o => {
                      const matchesSearch = (o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) || o.id.includes(orderSearch));
                      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                      const createdAtStr = !isNaN(d.getTime()) ? d.toISOString() : '';
                      const matchesDate = !orderDateFilter || createdAtStr.startsWith(orderDateFilter);
                      return matchesSearch && matchesDate;
                    })
                    .map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-gray-600">#{order.id.slice(-8).toUpperCase()}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {(() => {
                              const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                              return !isNaN(d.getTime()) 
                                ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                                : 'N/A';
                            })()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {(() => {
                              const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                              return !isNaN(d.getTime()) 
                                ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
                                : '';
                            })()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{order.customerName}</p>
                          <p className="text-xs text-gray-500">{order.mobile}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">{order.items.length} items</p>
                          <p className="text-xs text-gray-400 truncate max-w-[150px]">
                            {order.items.map(i => i.itemName).join(', ')}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-bold text-indigo-600">₹{order.totalAmount}</td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            placeholder="Tracking ID"
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-32 focus:border-indigo-500 outline-none"
                            defaultValue={order.trackingId || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (order.trackingId || '')) {
                                handleUpdateTrackingId(order.id, e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            className={`text-xs font-bold px-3 py-1 rounded-full border-none outline-none cursor-pointer ${
                              order.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                              order.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                              'bg-amber-100 text-amber-600'
                            }`}
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generateBillPDF(order)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Download Bill"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => dbService.deleteDocument('orders', order.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Order"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'items' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900">Item Management</h2>
            <button
              onClick={() => {
                setEditingItem(null);
                setNewItem({ name: '', service: '', price: 0, showPriceToCustomer: true });
              }}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Item
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-fit">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g., T-Shirt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Service Type</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newItem.service}
                    onChange={(e) => setNewItem({ ...newItem, service: e.target.value })}
                    placeholder="e.g., Ironing"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price (₹)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => setNewItem({ ...newItem, showPriceToCustomer: !newItem.showPriceToCustomer })}
                    className={`p-2 rounded-lg transition-all ${newItem.showPriceToCustomer ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {newItem.showPriceToCustomer ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <span className="text-sm font-medium text-gray-600">Show price to customer</span>
                </div>
                <button
                  onClick={handleSaveItem}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  {editingItem ? 'Update Item' : 'Save Item'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Added</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Visibility</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {(() => {
                            const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                            return !isNaN(d.getTime()) 
                              ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                              : 'N/A';
                          })()}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{item.service}</td>
                        <td className="px-6 py-4 font-bold text-indigo-600">₹{item.price}</td>
                        <td className="px-6 py-4">
                          {item.showPriceToCustomer ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                              <Eye className="w-3 h-3" /> Visible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                              <EyeOff className="w-3 h-3" /> Hidden
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setNewItem({ name: item.name, service: item.service, price: item.price, showPriceToCustomer: item.showPriceToCustomer });
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => dbService.deleteDocument('items', item.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900">User Management</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users
                    .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                    .map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                              {user.name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {(() => {
                            const d = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                            return !isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A';
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {user.isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                              <AlertCircle className="w-3 h-3" /> Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {user.role !== 'admin' && (
                              <>
                                <button
                                  onClick={() => onImpersonate(user)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Login as User"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => dbService.updateDocument('users', user.uid, { isBlocked: !user.isBlocked })}
                                  className={`p-2 rounded-lg transition-all ${
                                    user.isBlocked 
                                      ? 'text-emerald-600 hover:bg-emerald-50' 
                                      : 'text-red-600 hover:bg-red-50'
                                  }`}
                                  title={user.isBlocked ? 'Unblock User' : 'Block User'}
                                >
                                  {user.isBlocked ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
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
          </div>
        </div>
      )}

      {activeTab === 'settings' && tempSettings && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900">System Settings</h2>
            <button
              onClick={handleSaveSettings}
              className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
            >
              <Save className="w-5 h-5" />
              Save All Changes
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Shop Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Shop Name</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={tempSettings.shopName}
                    onChange={(e) => setTempSettings({ ...tempSettings, shopName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Logo URL</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={tempSettings.logoUrl}
                      onChange={(e) => setTempSettings({ ...tempSettings, logoUrl: e.target.value })}
                    />
                    {tempSettings.logoUrl && (
                      <img src={tempSettings.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={tempSettings.contactNumber}
                    onChange={(e) => setTempSettings({ ...tempSettings, contactNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                  <textarea
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                    value={tempSettings.address}
                    onChange={(e) => setTempSettings({ ...tempSettings, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  WhatsApp API Setup
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp API URL (Direct Link)</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={tempSettings.whatsappApiUrl}
                    onChange={(e) => setTempSettings({ ...tempSettings, whatsappApiUrl: e.target.value })}
                    placeholder="https://api.whatsapp.com/send"
                  />
                  <p className="text-xs text-gray-400 mt-2">Default: https://api.whatsapp.com/send</p>
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900">Meta WhatsApp API (Automatic)</h4>
                    <button
                      onClick={() => setTempSettings({
                        ...tempSettings,
                        metaWhatsAppConfig: {
                          ...(tempSettings.metaWhatsAppConfig || {
                            accessToken: '',
                            phoneNumberId: '',
                            businessAccountId: '',
                            templateName: '',
                            languageCode: 'en_US',
                            enabled: false
                          }),
                          enabled: !tempSettings.metaWhatsAppConfig?.enabled
                        }
                      })}
                      className={`w-12 h-6 rounded-full transition-all relative ${tempSettings.metaWhatsAppConfig?.enabled ? 'bg-emerald-600' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tempSettings.metaWhatsAppConfig?.enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {tempSettings.metaWhatsAppConfig?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Access Token</label>
                        <input
                          type="password"
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          value={tempSettings.metaWhatsAppConfig.accessToken}
                          onChange={(e) => setTempSettings({
                            ...tempSettings,
                            metaWhatsAppConfig: { ...tempSettings.metaWhatsAppConfig!, accessToken: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number ID</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          value={tempSettings.metaWhatsAppConfig.phoneNumberId}
                          onChange={(e) => setTempSettings({
                            ...tempSettings,
                            metaWhatsAppConfig: { ...tempSettings.metaWhatsAppConfig!, phoneNumberId: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Template Name</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          value={tempSettings.metaWhatsAppConfig.templateName}
                          onChange={(e) => setTempSettings({
                            ...tempSettings,
                            metaWhatsAppConfig: { ...tempSettings.metaWhatsAppConfig!, templateName: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Language Code</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          value={tempSettings.metaWhatsAppConfig.languageCode}
                          onChange={(e) => setTempSettings({
                            ...tempSettings,
                            metaWhatsAppConfig: { ...tempSettings.metaWhatsAppConfig!, languageCode: e.target.value }
                          })}
                          placeholder="en_US"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  Customer Popup Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Show Popup to Customers</span>
                    <button
                      onClick={() => setTempSettings({
                        ...tempSettings,
                        popupConfig: { ...tempSettings.popupConfig, show: !tempSettings.popupConfig.show }
                      })}
                      className={`w-12 h-6 rounded-full transition-all relative ${tempSettings.popupConfig.show ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tempSettings.popupConfig.show ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Popup Image URL</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={tempSettings.popupConfig.imageUrl}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        popupConfig: { ...tempSettings.popupConfig, imageUrl: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Popup Text</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={tempSettings.popupConfig.text}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        popupConfig: { ...tempSettings.popupConfig, text: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Popup Link</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={tempSettings.popupConfig.link}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        popupConfig: { ...tempSettings.popupConfig, link: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'retail' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold text-gray-900">Retail Customer Order</h2>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search or enter name"
                    value={retailOrder.customerName}
                    onChange={(e) => {
                      const name = e.target.value;
                      setRetailOrder({ ...retailOrder, customerName: name });
                      
                      // Search in users collection
                      const existingUser = users.find(u => u.name.toLowerCase() === name.toLowerCase());
                      if (existingUser) {
                        setRetailOrder(prev => ({ 
                          ...prev, 
                          mobile: existingUser.mobile || '', 
                          address: existingUser.address || '', 
                          customerName: name 
                        }));
                        return;
                      }

                      // Search in previous retail orders
                      const existingOrder = orders.find(o => o.customerName.toLowerCase() === name.toLowerCase());
                      if (existingOrder) {
                        setRetailOrder(prev => ({ 
                          ...prev, 
                          mobile: existingOrder.mobile || '', 
                          address: existingOrder.address || '', 
                          customerName: name 
                        }));
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                <input
                  type="tel"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={retailOrder.mobile}
                  onChange={(e) => setRetailOrder({ ...retailOrder, mobile: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                <textarea
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                  value={retailOrder.address}
                  onChange={(e) => setRetailOrder({ ...retailOrder, address: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="font-bold text-gray-900 mb-4">Add Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={retailItem.name}
                  onChange={(e) => setRetailItem({ ...retailItem, name: e.target.value })}
                >
                  <option value="">Select Item</option>
                  {Array.from(new Set(items.map(i => i.name))).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={retailItem.service}
                  onChange={(e) => setRetailItem({ ...retailItem, service: e.target.value })}
                  disabled={!retailItem.name}
                >
                  <option value="">Select Service</option>
                  {items.filter(i => i.name === retailItem.name).map(i => <option key={i.id} value={i.service}>{i.service}</option>)}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-20 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={retailItem.quantity}
                    onChange={(e) => setRetailItem({ ...retailItem, quantity: parseInt(e.target.value) })}
                  />
                  <button
                    onClick={() => {
                      const item = items.find(i => i.name === retailItem.name && i.service === retailItem.service);
                      if (item) {
                        setRetailOrder({
                          ...retailOrder,
                          items: [...retailOrder.items, { itemName: item.name, service: item.service, quantity: retailItem.quantity, price: item.price }]
                        });
                        setRetailItem({ name: '', service: '', quantity: 1 });
                      }
                    }}
                    className="flex-1 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {retailOrder.items.length > 0 && (
              <div className="space-y-3">
                {retailOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium">{item.itemName} ({item.service}) x {item.quantity}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">₹{item.price * item.quantity}</span>
                      <button 
                        onClick={() => setRetailOrder({ ...retailOrder, items: retailOrder.items.filter((_, idx) => idx !== i) })}
                        className="text-red-500 hover:bg-red-50 p-1 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">Order Date & Time</span>
                    <span className="text-sm font-medium text-gray-600">
                      {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-xl font-bold">Total: ₹{retailOrder.items.reduce((s, i) => s + (i.price * i.quantity), 0)}</span>
                  <button
                    onClick={async () => {
                      const totalAmount = retailOrder.items.reduce((s, i) => s + (i.price * i.quantity), 0);
                      const totalQuantity = retailOrder.items.reduce((s, i) => s + i.quantity, 0);
                      const newOrder = {
                        ...retailOrder,
                        customerId: 'retail',
                        totalAmount,
                        totalQuantity,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                      };
                      
                      await dbService.addDocument('orders', newOrder);

                      // Send WhatsApp notification for retail order
                      if (settings?.metaWhatsAppConfig?.enabled && retailOrder.mobile) {
                        const itemsSummary = retailOrder.items.map(i => `${i.itemName} (${i.service}) x ${i.quantity}`).join(', ');
                        await sendMetaWhatsAppMessage(
                          settings.metaWhatsAppConfig,
                          retailOrder.mobile,
                          retailOrder.customerName,
                          `New Retail Order: ${itemsSummary}. Total: ₹${totalAmount}`
                        );
                      }

                      setRetailOrder({ customerName: '', mobile: '', address: '', items: [] });
                      setActiveTab('orders');
                    }}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    Confirm Retail Order
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900">Social Media Links</h2>
            <button
              onClick={() => dbService.addDocument('socialLinks', { platform: 'new', url: 'https://' })}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Link
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {socialLinks.map((link) => (
              <div key={link.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-4">
                    <input
                      type="text"
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      value={link.platform}
                      onChange={(e) => dbService.updateDocument('socialLinks', link.id, { platform: e.target.value })}
                    />
                    <input
                      type="text"
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={link.url}
                      onChange={(e) => dbService.updateDocument('socialLinks', link.id, { url: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => dbService.deleteDocument('socialLinks', link.id)}
                    className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminPanel;

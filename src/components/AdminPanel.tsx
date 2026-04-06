import React, { useState, useEffect, useMemo } from 'react';
import { 
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
  updatePassword
} from 'firebase/auth';
import { auth } from '../firebase';
import { User, Settings, Order, Item, SocialLink, OrderStatus } from '../types';
import { ADMIN_EMAILS } from '../constants';
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
  Wallet,
  CreditCard,
  BellRing,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  UserCheck,
  UserX,
  Save,
  Check,
  Sun,
  Moon,
  ShieldCheck,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageCircle,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Linkedin,
  Globe,
  Map,
  User as UserIcon,
  Lock
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
  const [dashboardFilter, setDashboardFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [paymentReceived, setPaymentReceived] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GPay' | 'Other'>('Cash');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Item Form
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newItem, setNewItem] = useState({ name: '', service: '', price: 0, showPriceToCustomer: true });

  // Settings Form
  const [tempSettings, setTempSettings] = useState<Settings | null>(settings);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Profile Form
  const [profileName, setProfileName] = useState(userData?.name || '');
  const [profileMobile, setProfileMobile] = useState(userData?.mobile || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [isClearingData, setIsClearingData] = useState(false);
  const [dangerZonePassword, setDangerZonePassword] = useState('');
  const [confirmDanger, setConfirmDanger] = useState(false);

  useEffect(() => {
    if (userData) {
      setProfileName(userData.name || '');
      setProfileMobile(userData.mobile || '');
    }
  }, [userData]);

  const handleResendVerification = async () => {
    if (!tempSettings?.adminEmail) return;
    setIsResending(true);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user found.');
      await verifyBeforeUpdateEmail(user, tempSettings.adminEmail);
      
      setVerifySuccess('Verification link resent! Please check for an email from "Firebase" in your inbox or Spam folder.');
    } catch (err: any) {
      setVerifyError('Failed to resend: ' + err.message);
    } finally {
      setIsResending(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No user found');
      
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          otp: 'TEST12',
          newEmail: 'TEST_CONNECTION'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMsg = errorData.error + (errorData.details ? ': ' + errorData.details : '');
        if (errorMsg.includes('BadCredentials')) {
          errorMsg = "Invalid Login: Please check your Gmail App Password in Settings > Secrets. Ensure it is exactly 16 characters (no spaces).";
        }
        throw new Error(errorMsg);
      }
      setVerifySuccess('SMTP Connection Successful! Test email sent to ' + user.email);
    } catch (err: any) {
      setVerifyError('SMTP Test Failed: ' + err.message);
    } finally {
      setIsTestingSmtp(false);
    }
  };

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
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    return orders.filter(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      if (isNaN(d.getTime())) return dashboardFilter === 'all';

      switch (dashboardFilter) {
        case 'today':
          return d >= today;
        case 'yesterday':
          return d >= yesterday && d < today;
        case 'week':
          return d >= startOfWeek;
        case 'month':
          return d >= startOfMonth;
        case 'year':
          return d >= startOfYear;
        default:
          return true;
      }
    });
  }, [orders, dashboardFilter]);

  const stats = useMemo(() => ({
    totalCustomers: users.filter(u => u.role === 'customer').length,
    totalOrders: filteredOrders.length,
    pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
    receiveOrders: filteredOrders.filter(o => o.status === 'receive').length,
    processingOrders: filteredOrders.filter(o => o.status === 'processing').length,
    readyOrders: filteredOrders.filter(o => o.status === 'ready').length,
    deliveryOrders: filteredOrders.filter(o => o.status === 'delivery').length,
    totalRevenue: filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    totalPendingAmount: orders.reduce((sum, o) => sum + (o.pendingAmount || 0), 0),
  }), [users, filteredOrders, orders]);

  const filteredPayments = useMemo(() => {
    return orders
      .filter(o => (o.pendingAmount || 0) > 0)
      .filter(o => {
        const search = paymentSearch.toLowerCase();
        return (
          (o.customerName || '').toLowerCase().includes(search) ||
          (o.mobile || '').includes(search) ||
          (o.orderNumber || '').toString().includes(search)
        );
      });
  }, [orders, paymentSearch]);

  // Chart Data
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      orders: filteredOrders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const createdAtStr = !isNaN(d.getTime()) ? d.toISOString() : '';
        return createdAtStr.startsWith(date);
      }).length,
      revenue: filteredOrders.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const createdAtStr = !isNaN(d.getTime()) ? d.toISOString() : '';
        return createdAtStr.startsWith(date);
      }).reduce((sum, o) => sum + o.totalAmount, 0),
    }));
  }, [filteredOrders]);

  const statusData = [
    { name: 'Pending', value: stats.pendingOrders, color: '#f59e0b' },
    { name: 'Received', value: stats.receiveOrders, color: '#6366f1' },
    { name: 'Processing', value: stats.processingOrders, color: '#3b82f6' },
    { name: 'Ready', value: stats.readyOrders, color: '#8b5cf6' },
    { name: 'Delivered', value: stats.deliveryOrders, color: '#10b981' },
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
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (status === 'delivery' && (order.paymentStatus !== 'paid')) {
      setSelectedOrderForPayment(order);
      setPaymentReceived(order.pendingAmount || 0);
      setShowPaymentModal(true);
      return;
    }

    try {
      await dbService.updateDocument('orders', orderId, { status });
      
      const statusLabels: { [key: string]: string } = {
        pending: 'Pending',
        receive: 'Received',
        processing: 'Processing',
        ready: 'Ready for Delivery',
        delivery: 'Delivered'
      };

      const statusText = statusLabels[status] || status;

      // 1. WhatsApp Notification
      if (settings?.metaWhatsAppConfig?.enabled) {
        await sendMetaWhatsAppMessage(
          settings.metaWhatsAppConfig,
          order.mobile,
          order.customerName,
          `Your order status has been updated to: ${statusText}`
        );
      }

      // 2. Email Notification
      const customer = users.find(u => u.uid === order.customerId);
      if (customer?.email) {
        fetch('/api/send-status-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerEmail: customer.email,
            orderData: order,
            newStatus: status
          }),
        }).catch(err => console.error('Status update email failed:', err));
      }

      console.log(`Order ${orderId} status updated to ${status}`);
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrderForPayment) return;
    setPaymentLoading(true);

    try {
      const totalPaid = (selectedOrderForPayment.paidAmount || 0) + paymentReceived;
      const pendingAmount = selectedOrderForPayment.totalAmount - totalPaid;
      const paymentStatus = pendingAmount <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');

      const updateData = {
        paidAmount: totalPaid,
        pendingAmount: Math.max(0, pendingAmount),
        paymentMethod,
        paymentStatus,
        status: 'delivery' as OrderStatus,
        updatedAt: new Date().toISOString()
      };

      await dbService.updateDocument('orders', selectedOrderForPayment.id, updateData);

      // Send payment update notification
      if (settings?.metaWhatsAppConfig?.enabled) {
        const message = `Payment Received: ₹${paymentReceived}. Total Paid: ₹${totalPaid}. Remaining Balance: ₹${Math.max(0, pendingAmount)}. Status: ${paymentStatus.toUpperCase()}`;
        await sendMetaWhatsAppMessage(
          settings.metaWhatsAppConfig,
          selectedOrderForPayment.mobile,
          selectedOrderForPayment.customerName,
          message
        );
      }

      // Send payment update email
      const customer = users.find(u => u.uid === selectedOrderForPayment.customerId);
      if (customer?.email) {
        fetch('/api/send-payment-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerEmail: customer.email,
            orderData: { ...selectedOrderForPayment, ...updateData },
            paymentReceived,
            paymentMethod
          }),
        }).catch(err => console.error('Payment update email failed:', err));
      }

      setShowPaymentModal(false);
      setSelectedOrderForPayment(null);
      setPaymentReceived(0);
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setPaymentLoading(false);
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

  const handleSendPaymentReminder = async (order: Order) => {
    if (!settings?.metaWhatsAppConfig?.enabled) {
      alert('WhatsApp notification is not enabled in settings.');
      return;
    }

    const message = `Reminder: You have a pending payment of ₹${order.pendingAmount} for Order #${order.orderNumber}. Please clear it at your earliest convenience. Thank you!`;

    try {
      await sendMetaWhatsAppMessage(
        settings.metaWhatsAppConfig,
        order.mobile,
        order.customerName,
        message
      );
      alert('Reminder sent successfully!');
    } catch (error) {
      console.error('Failed to send reminder:', error);
      alert('Failed to send reminder. Please try again.');
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

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = async () => {
    if (tempSettings) {
      setIsSavingSettings(true);
      try {
        await dbService.setDocument('settings', 'global', tempSettings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        console.error('Failed to save settings:', error);
      } finally {
        setIsSavingSettings(false);
      }
    }
  };

  const handleUpdateAdminEmail = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setVerifyError('No authenticated user found.');
      return;
    }

    const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
    
    if (!newAdminEmail || (!isGoogleUser && !adminPassword)) {
      setVerifyError(isGoogleUser ? 'Please enter the new admin email.' : 'Please enter both new email and your current password.');
      return;
    }
    
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifySuccess(null);
    
    try {
      // 1. Re-authenticate for password users
      if (!isGoogleUser) {
        const credential = EmailAuthProvider.credential(user.email, adminPassword);
        await reauthenticateWithCredential(user, credential);
      }

      // 2. Generate OTP
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(newOtp);

      // 3. Send OTP to OLD Email (Current Email) via Backend API
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          otp: newOtp,
          newEmail: newAdminEmail
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${errorData.error}${errorData.details ? ': ' + errorData.details : ''}`);
      }
      
      setVerifySuccess(`Verification OTP sent to your CURRENT email: ${user.email}. Please enter it below.`);
      setIsVerifying(true); 
    } catch (err: any) {
      console.error('Admin Email Update Error:', err);
      setVerifyError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleFinalizeEmailUpdate = async () => {
    if (otp !== generatedOtp) {
      setVerifyError('Invalid OTP. Please check your old email.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);
    
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No user found.');
      const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');

      // 1. Re-authenticate to ensure session is fresh (for password users)
      if (!isGoogleUser) {
        try {
          const credential = EmailAuthProvider.credential(user.email, adminPassword);
          await reauthenticateWithCredential(user, credential);
        } catch (authErr: any) {
          throw new Error('Authentication failed: Please check your password.');
        }
      }

      // 2. Update Firestore Settings IMMEDIATELY (This changes where orders/OTPs go)
      if (tempSettings) {
        const updatedSettings = { ...tempSettings, adminEmail: newAdminEmail };
        await dbService.setDocument('settings', 'global', updatedSettings);
        setTempSettings(updatedSettings);
        
        // Update user role for the new email if they already have an account
        const usersList = await dbService.getCollection<User>('users', [where('email', '==', newAdminEmail)]);
        if (usersList.length > 0) {
          await dbService.updateDocument('users', usersList[0].uid, { role: 'admin' });
        }
      }

      // 3. Attempt to update Login Email (Firebase Auth) - Only for password users
      let loginEmailUpdated = false;
      if (!isGoogleUser) {
        try {
          await verifyBeforeUpdateEmail(user, newAdminEmail);
          loginEmailUpdated = true;
        } catch (authErr: any) {
          console.warn('Firebase Auth update failed (Link not sent):', authErr);
        }
      }

      if (isGoogleUser) {
        setVerifySuccess('Success! Your notification email has been updated. You will now receive orders at ' + newAdminEmail + '. (Note: Google login email cannot be changed here).');
      } else if (loginEmailUpdated) {
        setVerifySuccess('Success! Your notification email has been updated. A verification link for your LOGIN email was also sent to ' + newAdminEmail + '.');
      } else {
        setVerifySuccess('Success! Your notification email has been updated. You will now receive orders at ' + newAdminEmail + '. (Note: Login email could not be updated, please use your old email to login).');
      }

      setIsVerifying(false);
      setNewAdminEmail('');
      setAdminPassword('');
      setOtp('');
      setGeneratedOtp('');
      
    } catch (err: any) {
      console.error('Finalize Error:', err);
      setVerifyError(err.message || 'Failed to update email.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      // Update Firestore
      await dbService.updateDocument('users', userData.uid, {
        name: profileName,
        mobile: profileMobile
      });

      // Update Password if requested
      if (currentPassword && newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('New passwords do not match.');
        }
        
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error('User session expired.');

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      setProfileSuccess('Profile updated successfully!');
    } catch (err: any) {
      console.error('Profile Update Error:', err);
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleClearOrders = async () => {
    console.log('handleClearOrders triggered. Password:', dangerZonePassword, 'Confirmed:', confirmDanger);
    if (dangerZonePassword !== 'Admin@2026') {
      console.log('Incorrect password entered:', dangerZonePassword);
      alert('Incorrect Danger Zone password!');
      return;
    }
    if (!confirmDanger) {
      alert('Please check the confirmation box first.');
      return;
    }
    
    setIsClearingData(true);
    try {
      console.log('Calling dbService.clearCollection for orders...');
      await dbService.clearCollection('orders');
      console.log('Orders cleared successfully.');
      alert('All orders have been cleared successfully.');
      setDangerZonePassword('');
      setConfirmDanger(false);
    } catch (err: any) {
      console.error('Failed to clear orders:', err);
      alert('Failed to clear orders: ' + err.message);
    } finally {
      setIsClearingData(false);
    }
  };

  const handleClearCustomers = async () => {
    console.log('handleClearCustomers triggered. Password:', dangerZonePassword, 'Confirmed:', confirmDanger);
    if (dangerZonePassword !== 'Admin@2026') {
      console.log('Incorrect password entered:', dangerZonePassword);
      alert('Incorrect Danger Zone password!');
      return;
    }
    if (!confirmDanger) {
      alert('Please check the confirmation box first.');
      return;
    }

    setIsClearingData(true);
    try {
      console.log('Filtering customers from users list...');
      console.log('Total users in state:', users.length);
      // We only want to delete users with role 'customer'
      const customers = users.filter(u => u.role === 'customer');
      console.log(`Found ${customers.length} customers to delete.`);
      
      if (customers.length === 0) {
        alert('No customers found to clear.');
        setIsClearingData(false);
        return;
      }

      const deletePromises = customers.map(c => {
        console.log(`Deleting customer: ${c.uid} (${c.email})`);
        return dbService.deleteDocument('users', c.uid);
      });
      await Promise.all(deletePromises);
      console.log('Customers cleared successfully.');
      alert('All customers have been cleared successfully.');
      setDangerZonePassword('');
      setConfirmDanger(false);
    } catch (err: any) {
      console.error('Failed to clear customers:', err);
      alert('Failed to clear customers: ' + err.message);
    } finally {
      setIsClearingData(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'retail', label: 'Retail Customer', icon: <Users className="w-5 h-5" /> },
    { id: 'items', label: 'Items', icon: <Package className="w-5 h-5" /> },
    { id: 'social', label: 'Social Media', icon: <Share2 className="w-5 h-5" /> },
    { id: 'payments', label: 'Payments', icon: <Wallet className="w-5 h-5" /> },
    { id: 'users', label: 'Users', icon: <UserCheck className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-5 h-5" /> },
  ];

  const getSocialIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return <Instagram className="w-5 h-5" />;
    if (p.includes('facebook')) return <Facebook className="w-5 h-5" />;
    if (p.includes('whatsapp')) return <MessageCircle className="w-5 h-5" />;
    if (p.includes('twitter') || p.includes(' x')) return <Twitter className="w-5 h-5" />;
    if (p.includes('youtube')) return <Youtube className="w-5 h-5" />;
    if (p.includes('linkedin')) return <Linkedin className="w-5 h-5" />;
    if (p.includes('map') || p.includes('location') || p.includes('google maps')) return <MapPin className="w-5 h-5" />;
    if (p.includes('website') || p.includes('web')) return <Globe className="w-5 h-5" />;
    return <ExternalLink className="w-5 h-5" />;
  };

  return (
    <Layout userData={userData} settings={settings} activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs}>
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'year', label: 'Year' },
                { id: 'all', label: 'All Time' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setDashboardFilter(filter.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    dashboardFilter === filter.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-indigo-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
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
                className="bg-white dark:bg-black p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4"
              >
                <div className={`${stat.color} p-3 rounded-xl text-white shadow-lg shadow-${stat.color.split('-')[1]}-100 dark:shadow-none`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8">Revenue Overview</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings?.themeMode === 'dark' ? '#374151' : '#f3f4f6'} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: settings?.themeMode === 'dark' ? '#9ca3af' : '#9ca3af', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: settings?.themeMode === 'dark' ? '#9ca3af' : '#9ca3af', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: settings?.themeMode === 'dark' ? '#000000' : '#fff', 
                        borderRadius: '12px', 
                        border: settings?.themeMode === 'dark' ? '1px solid #1a1a1a' : 'none', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        color: settings?.themeMode === 'dark' ? '#fff' : '#000'
                      }}
                      itemStyle={{ color: settings?.themeMode === 'dark' ? '#fff' : '#000' }}
                      cursor={{ fill: settings?.themeMode === 'dark' ? '#050505' : '#f9fafb' }}
                    />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8">Order Status</h3>
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
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: settings?.themeMode === 'dark' ? '#000000' : '#fff', 
                        borderRadius: '12px', 
                        border: settings?.themeMode === 'dark' ? '1px solid #1a1a1a' : 'none', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        color: settings?.themeMode === 'dark' ? '#fff' : '#000'
                      }}
                      itemStyle={{ color: settings?.themeMode === 'dark' ? '#fff' : '#000' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4 mt-4">
                {statusData.map((status, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{status.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{status.value}</span>
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Order Management</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="pl-10 pr-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="date"
                  className="pl-10 pr-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order No.</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tracking ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {orders
                    .filter(o => {
                      const matchesSearch = (
                        o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) || 
                        o.id.includes(orderSearch) ||
                        (o.orderNumber && o.orderNumber.toString().includes(orderSearch))
                      );
                      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                      const createdAtStr = !isNaN(d.getTime()) ? d.toISOString() : '';
                      const matchesDate = !orderDateFilter || createdAtStr.startsWith(orderDateFilter);
                      return matchesSearch && matchesDate;
                    })
                    .map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-sm text-indigo-600 dark:text-indigo-400">
                          #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {(() => {
                              const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                              return !isNaN(d.getTime()) 
                                ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                                : 'N/A';
                            })()}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {(() => {
                              const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                              return !isNaN(d.getTime()) 
                                ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
                                : '';
                            })()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900 dark:text-white">{order.customerName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{order.mobile}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-300">{order.items.length} items</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[150px]">
                            {order.items.map(i => i.itemName).join(', ')}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">₹{order.totalAmount}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                              order.paymentMethod === 'UPI' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                              order.paymentMethod === 'GPay' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                              order.paymentMethod === 'Cash' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}>
                              {order.paymentMethod || 'Cash'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                              order.paymentStatus === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                              order.paymentStatus === 'partial' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                              'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            }`}>
                              {order.paymentStatus || 'pending'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            placeholder="Tracking ID"
                            className="text-xs bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 w-32 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none dark:text-white"
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
                              order.status === 'delivery' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                              order.status === 'ready' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                              order.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                              order.status === 'receive' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                              'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            }`}
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                          >
                            <option value="pending" className="dark:bg-black">Pending</option>
                            <option value="receive" className="dark:bg-black">Received</option>
                            <option value="processing" className="dark:bg-black">Processing</option>
                            <option value="ready" className="dark:bg-black">Ready</option>
                            <option value="delivery" className="dark:bg-black">Delivered</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generateBillPDF(order)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                              title="Download Bill"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => dbService.deleteDocument('orders', order.id)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Item Management</h2>
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
            <div className="lg:col-span-1 bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 h-fit">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Item Name</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g., T-Shirt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Service Type</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={newItem.service}
                    onChange={(e) => setNewItem({ ...newItem, service: e.target.value })}
                    placeholder="e.g., Ironing"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Price (₹)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => setNewItem({ ...newItem, showPriceToCustomer: !newItem.showPriceToCustomer })}
                    className={`p-2 rounded-lg transition-all ${newItem.showPriceToCustomer ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}
                  >
                    {newItem.showPriceToCustomer ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Show price to customer</span>
                </div>
                <button
                  onClick={handleSaveItem}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  {editingItem ? 'Update Item' : 'Save Item'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-black rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Added</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visibility</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{item.name}</td>
                        <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                          {(() => {
                            const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                            return !isNaN(d.getTime()) 
                              ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                              : 'N/A';
                          })()}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{item.service}</td>
                        <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">₹{item.price}</td>
                        <td className="px-6 py-4">
                          {item.showPriceToCustomer ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                              <Eye className="w-3 h-3" /> Visible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-full">
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
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => dbService.deleteDocument('items', item.id)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-all"
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users
                    .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                    .filter(u => u.role === 'customer' || u.email === 'ganeshdrycleaner@gmail.com')
                    .map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold">
                              {user.name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {(() => {
                            const d = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                            return !isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A';
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {user.isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full">
                              <AlertCircle className="w-3 h-3" /> Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
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
                                  className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
                                  title="Login as User"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => dbService.updateDocument('users', user.uid, { isBlocked: !user.isBlocked })}
                                  className={`p-2 rounded-lg transition-all ${
                                    user.isBlocked 
                                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/50' 
                                      : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50'
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

      {activeTab === 'settings' && (
        tempSettings ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h2>
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className={`px-8 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg ${
                  saveSuccess 
                    ? 'bg-emerald-600 text-white shadow-emerald-100 dark:shadow-none' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
                } disabled:opacity-50`}
              >
                {isSavingSettings ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isSavingSettings ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save All Changes'}
              </button>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Shop Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Shop Name</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={tempSettings.shopName}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, shopName: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Logo URL</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="flex-1 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={tempSettings.logoUrl}
                      onChange={(e) => setTempSettings(prev => prev ? { ...prev, logoUrl: e.target.value } : prev)}
                    />
                    {tempSettings.logoUrl && (
                      <img src={tempSettings.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contact Number</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={tempSettings.contactNumber}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, contactNumber: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Address</label>
                  <textarea
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white h-24 resize-none"
                    value={tempSettings.address}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, address: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Next Order Number (Counter)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={tempSettings.lastOrderNumber || 10000}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, lastOrderNumber: parseInt(e.target.value) } : prev)}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This number will be incremented for each new order.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                UPI Payment Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">UPI ID (VPA)</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={tempSettings.upiId || ''}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, upiId: e.target.value } : prev)}
                    placeholder="e.g. yourname@upi"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Customers will use this ID to make direct payments.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">UPI Name (Payee Name)</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={tempSettings.upiName || ''}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, upiName: e.target.value } : prev)}
                    placeholder="e.g. Ganesh Dry Cleaner"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  WhatsApp API Setup
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">WhatsApp API URL (Direct Link)</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={tempSettings.whatsappApiUrl}
                    onChange={(e) => setTempSettings(prev => prev ? { ...prev, whatsappApiUrl: e.target.value } : prev)}
                    placeholder="https://api.whatsapp.com/send"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Default: https://api.whatsapp.com/send</p>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 dark:text-white">Meta WhatsApp API (Automatic)</h4>
                    <button
                      onClick={() => setTempSettings(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        metaWhatsAppConfig: {
                          ...(prev.metaWhatsAppConfig || {
                            accessToken: '',
                            phoneNumberId: '',
                            businessAccountId: '',
                            templateName: '',
                            languageCode: 'en_US',
                            enabled: false
                          }),
                          enabled: !prev.metaWhatsAppConfig?.enabled
                        }
                      };
                    })}
                      className={`w-12 h-6 rounded-full transition-all relative ${tempSettings.metaWhatsAppConfig?.enabled ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tempSettings.metaWhatsAppConfig?.enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {tempSettings.metaWhatsAppConfig?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Access Token</label>
                        <input
                          type="password"
                          className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                          value={tempSettings.metaWhatsAppConfig.accessToken}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            metaWhatsAppConfig: { ...prev.metaWhatsAppConfig!, accessToken: e.target.value }
                          } : prev)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number ID</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                          value={tempSettings.metaWhatsAppConfig.phoneNumberId}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            metaWhatsAppConfig: { ...prev.metaWhatsAppConfig!, phoneNumberId: e.target.value }
                          } : prev)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                          value={tempSettings.metaWhatsAppConfig.templateName}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            metaWhatsAppConfig: { ...prev.metaWhatsAppConfig!, templateName: e.target.value }
                          } : prev)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Language Code</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                          value={tempSettings.metaWhatsAppConfig.languageCode}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            metaWhatsAppConfig: { ...prev.metaWhatsAppConfig!, languageCode: e.target.value }
                          } : prev)}
                          placeholder="en_US"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  Customer Popup Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Popup to Customers</span>
                    <button
                      onClick={() => setTempSettings(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          popupConfig: { ...prev.popupConfig, show: !prev.popupConfig.show }
                        };
                      })}
                      className={`w-12 h-6 rounded-full transition-all relative ${tempSettings.popupConfig.show ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tempSettings.popupConfig.show ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Popup Image URL</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={tempSettings.popupConfig.imageUrl}
                      onChange={(e) => setTempSettings(prev => prev ? {
                        ...prev,
                        popupConfig: { ...prev.popupConfig, imageUrl: e.target.value }
                      } : prev)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Popup Text</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={tempSettings.popupConfig.text}
                      onChange={(e) => setTempSettings(prev => prev ? {
                        ...prev,
                        popupConfig: { ...prev.popupConfig, text: e.target.value }
                      } : prev)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Popup Link</label>
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={tempSettings.popupConfig.link}
                      onChange={(e) => setTempSettings(prev => prev ? {
                        ...prev,
                        popupConfig: { ...prev.popupConfig, link: e.target.value }
                      } : prev)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  Appearance Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Theme Mode</label>
                    <div className="flex gap-2">
                      {['light', 'dark'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setTempSettings(prev => prev ? { ...prev, themeMode: mode as 'light' | 'dark' } : prev)}
                          className={`flex-1 py-3 rounded-xl font-bold capitalize transition-all ${
                            tempSettings.themeMode === mode
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 space-y-6">
                <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Use these actions with extreme caution. Deleting data is permanent and cannot be reversed.
                </p>
                
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="max-w-xs flex-1">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Enter Danger Zone Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        className="w-full pl-10 pr-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm dark:text-red-200"
                        placeholder="Enter Password"
                        value={dangerZonePassword}
                        onChange={(e) => setDangerZonePassword(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-red-400 mt-1 font-medium">Password is <strong>Admin@2026</strong> (required to enable buttons).</p>
                  </div>
                  <div className="flex items-center gap-3 bg-red-50/50 dark:bg-red-900/5 p-4 rounded-xl border border-red-100/50 dark:border-red-900/20 flex-1">
                    <input
                      type="checkbox"
                      id="confirmDanger"
                      className="w-5 h-5 rounded border-red-300 dark:border-red-900 text-red-600 focus:ring-red-500 cursor-pointer"
                      checked={confirmDanger}
                      onChange={(e) => setConfirmDanger(e.target.checked)}
                    />
                    <label htmlFor="confirmDanger" className="text-sm font-medium text-red-900 dark:text-red-200 cursor-pointer select-none">
                      I understand that these actions are permanent and cannot be reversed.
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleClearOrders}
                    disabled={isClearingData || !confirmDanger || dangerZonePassword !== 'Admin@2026'}
                    className="flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all border border-red-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isClearingData ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    Clear All Orders
                  </button>
                  <button
                    onClick={handleClearCustomers}
                    disabled={isClearingData || !confirmDanger || dangerZonePassword !== 'Admin@2026'}
                    className="flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all border border-red-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isClearingData ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserX className="w-5 h-5" />}
                    Clear All Customers
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Loading settings...</p>
        </div>
      )
    )}

      {activeTab === 'retail' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Retail Customer Order</h2>
          <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Customer Name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
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
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mobile Number</label>
                <input
                  type="tel"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={retailOrder.mobile}
                  onChange={(e) => setRetailOrder({ ...retailOrder, mobile: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Address</label>
                <textarea
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none dark:text-white"
                  value={retailOrder.address}
                  onChange={(e) => setRetailOrder({ ...retailOrder, address: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Add Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={retailItem.name}
                  onChange={(e) => setRetailItem({ ...retailItem, name: e.target.value })}
                >
                  <option value="" className="dark:bg-black">Select Item</option>
                  {Array.from(new Set(items.map(i => i.name))).map(n => <option key={n} value={n} className="dark:bg-black">{n}</option>)}
                </select>
                <select
                  className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  value={retailItem.service}
                  onChange={(e) => setRetailItem({ ...retailItem, service: e.target.value })}
                  disabled={!retailItem.name}
                >
                  <option value="" className="dark:bg-black">Select Service</option>
                  {items.filter(i => i.name === retailItem.name).map(i => <option key={i.id} value={i.service} className="dark:bg-black">{i.service}</option>)}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-20 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
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
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <span className="text-sm font-medium dark:text-gray-300">{item.itemName} ({item.service}) x {item.quantity}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-bold dark:text-white">₹{item.price * item.quantity}</span>
                      <button 
                        onClick={() => setRetailOrder({ ...retailOrder, items: retailOrder.items.filter((_, idx) => idx !== i) })}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Order Date & Time</span>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-xl font-bold dark:text-white">Total: ₹{retailOrder.items.reduce((s, i) => s + (i.price * i.quantity), 0)}</span>
                  <button
                    onClick={async () => {
                      if (!settings) return;
                      const totalAmount = retailOrder.items.reduce((s, i) => s + (i.price * i.quantity), 0);
                      const totalQuantity = retailOrder.items.reduce((s, i) => s + i.quantity, 0);
                      const nextOrderNumber = (settings.lastOrderNumber || 10000) + 1;
                      
                      const newOrder = {
                        ...retailOrder,
                        customerId: 'retail',
                        totalAmount,
                        totalQuantity,
                        status: 'pending',
                        orderNumber: nextOrderNumber
                      };
                      
                      try {
                        await dbService.addDocument('orders', newOrder);
                        
                        // Increment order counter
                        await dbService.incrementField('settings', 'global', 'lastOrderNumber', 1);

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
                      } catch (err) {
                        console.error('Failed to create retail order:', err);
                        alert('Failed to create order. Please try again.');
                      }
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

      {activeTab === 'payments' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Pending Payments</h2>
              <p className="text-gray-500 dark:text-gray-400">Track and manage customer balances</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 px-6 py-3 rounded-2xl border border-red-100 dark:border-red-900/30">
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Total Outstanding</p>
              <p className="text-2xl font-black text-red-700 dark:text-red-300">₹{stats.totalPendingAmount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-black p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by Name, Mobile, or Order #"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="p-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Order Info</th>
                    <th className="p-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="p-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Bill</th>
                    <th className="p-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="p-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pending</th>
                    <th className="p-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredPayments.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">#{order.orderNumber}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{order.customerName}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {order.mobile}
                          </span>
                        </div>
                      </td>
                      <td className="p-6 text-sm font-bold text-gray-900 dark:text-white">₹{order.totalAmount}</td>
                      <td className="p-6 text-sm font-bold text-emerald-600 dark:text-emerald-400">₹{order.paidAmount || 0}</td>
                      <td className="p-6">
                        <span className="px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-bold border border-red-100 dark:border-red-900/50">
                          ₹{order.pendingAmount}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedOrderForPayment(order);
                              setPaymentReceived(order.pendingAmount || 0);
                              setShowPaymentModal(true);
                            }}
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-xl transition-all"
                            title="Record Payment"
                          >
                            <CreditCard className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleSendPaymentReminder(order)}
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/50 rounded-xl transition-all"
                            title="Send Reminder"
                          >
                            <BellRing className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                            <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 font-medium">No pending payments found. Great job!</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-100">
              {userData?.name?.[0] || 'G'}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Admin Profile</h2>
              <p className="text-gray-500">Manage your personal information and security</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="bg-white dark:bg-black p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-indigo-500" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-500" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    value={userData?.email || ''}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    className="w-full p-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                    value={profileMobile}
                    onChange={(e) => setProfileMobile(e.target.value)}
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-black p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                Change Password
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Leave these fields blank if you don't want to change your password.</p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Current Password</label>
                  <input
                    type="password"
                    className="w-full p-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">New Password</label>
                    <input
                      type="password"
                      className="w-full p-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Confirm New Password</label>
                    <input
                      type="password"
                      className="w-full p-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              </div>
            </div>

            {profileError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {profileSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all"
            >
              {profileLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              Update Profile & Password
            </button>
          </form>
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
              <div key={link.id} className="bg-white dark:bg-black p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800">
                    {getSocialIcon(link.platform)}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold dark:text-white"
                        value={link.platform}
                        onChange={(e) => dbService.updateDocument('socialLinks', link.id, { platform: e.target.value })}
                        placeholder="Platform (e.g. Instagram, WhatsApp, Map)"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        {['Instagram', 'WhatsApp', 'Facebook', 'Map', 'YouTube'].map(p => (
                          <button
                            key={p}
                            onClick={() => dbService.updateDocument('socialLinks', link.id, { platform: p })}
                            className="text-[10px] px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all dark:text-gray-300"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                      value={link.url}
                      onChange={(e) => dbService.updateDocument('socialLinks', link.id, { url: e.target.value })}
                      placeholder="URL (e.g. https://instagram.com/yourname)"
                    />
                  </div>
                  <button
                    onClick={() => dbService.deleteDocument('socialLinks', link.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPaymentModal && selectedOrderForPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-black rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-indigo-600 p-6 text-white">
                <h3 className="text-xl font-bold">Record Payment</h3>
                <p className="text-indigo-100 text-sm">Order #{selectedOrderForPayment.orderNumber} - {selectedOrderForPayment.customerName}</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-black rounded-2xl border border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Bill</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">₹{selectedOrderForPayment.totalAmount}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Already Paid</p>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">₹{selectedOrderForPayment.paidAmount || 0}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Amount Received Now</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                      <input
                        type="number"
                        className="w-full pl-8 pr-4 py-4 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-xl font-black dark:text-white"
                        value={paymentReceived}
                        onChange={(e) => setPaymentReceived(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Cash', 'GPay', 'UPI'].map((method) => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method as any)}
                          className={`py-3 rounded-xl font-bold text-sm transition-all ${
                            paymentMethod === method
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                              : 'bg-gray-50 dark:bg-black text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Remaining Balance</span>
                      <span className="text-lg font-black text-amber-800 dark:text-amber-300">
                        ₹{Math.max(0, selectedOrderForPayment.totalAmount - (selectedOrderForPayment.paidAmount || 0) - paymentReceived)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedOrderForPayment(null);
                    }}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={paymentLoading}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirm & Deliver
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default AdminPanel;

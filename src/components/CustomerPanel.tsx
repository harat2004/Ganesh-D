import React, { useState, useEffect } from 'react';
import { User, Settings, Order, Item, OrderItem, SocialLink } from '../types';
import { dbService } from '../services/db';
import { sendMetaWhatsAppMessage, sendCustomApiMessage } from '../services/whatsapp';
import Layout from './Layout';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Plus, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Package, 
  ExternalLink, 
  X, 
  Edit2,
  MessageCircle,
  Phone,
  MapPin,
  CreditCard,
  User as UserIcon,
  Share2,
  Eye,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Linkedin,
  Globe,
  Map,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { where, orderBy, limit } from 'firebase/firestore';

interface CustomerPanelProps {
  userData: User | null;
  settings: Settings | null;
  isImpersonating?: boolean;
  onStopImpersonating?: () => void;
}

const CustomerPanel: React.FC<CustomerPanelProps> = ({ 
  userData, 
  settings, 
  isImpersonating, 
  onStopImpersonating 
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Order Flow State
  const [orderStep, setOrderStep] = useState(1);
  const [currentItems, setCurrentItems] = useState<OrderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [mobile, setMobile] = useState(userData?.mobile || '');
  const [address, setAddress] = useState(userData?.address || '');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GPay' | 'UPI'>('Cash');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  useEffect(() => {
    console.log('CustomerPanel: userData changed:', userData);
    if (userData?.mobile && !mobile) setMobile(userData.mobile);
    if (userData?.address && !address) setAddress(userData.address);
  }, [userData]);

  useEffect(() => {
    let unsubscribeOrders = () => {};
    if (userData) {
      console.log('CustomerPanel: Fetching data for user:', userData.uid);
      unsubscribeOrders = dbService.subscribeToCollection<Order>(
        'orders', 
        [where('customerId', '==', userData.uid), orderBy('createdAt', 'desc'), limit(50)],
        (data) => {
          console.log('CustomerPanel: Orders received:', data.length);
          setOrders(data);
        }
      );
    }
      
      const unsubscribeItems = dbService.subscribeToCollection<Item>(
        'items',
        [orderBy('name', 'asc')],
        (data) => {
          console.log('CustomerPanel: Items received:', data.length);
          setItems(data);
        }
      );

      const unsubscribeSocial = dbService.subscribeToCollection<SocialLink>(
        'socialLinks',
        [],
        setSocialLinks
      );

      if (settings?.popupConfig?.show) {
        setShowPopup(true);
      }

      return () => {
        unsubscribeOrders();
        unsubscribeItems();
        unsubscribeSocial();
      };
  }, [userData, settings]);

  const handleAddItem = () => {
    const item = items.find(i => i.name === selectedItem && i.service === selectedService);
    if (item) {
      const newItem: OrderItem = {
        itemName: item.name,
        service: item.service,
        quantity,
        price: item.price
      };

      if (editingIndex !== null) {
        const updatedItems = [...currentItems];
        updatedItems[editingIndex] = newItem;
        setCurrentItems(updatedItems);
        setEditingIndex(null);
      } else {
        setCurrentItems([...currentItems, newItem]);
      }
      
      setSelectedItem('');
      setSelectedService('');
      setQuantity(1);
    }
  };

  const handleRemoveItem = (index: number) => {
    setCurrentItems(currentItems.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleEditItem = (index: number) => {
    const item = currentItems[index];
    setSelectedItem(item.itemName);
    setSelectedService(item.service);
    setQuantity(item.quantity);
    setEditingIndex(index);
    // Scroll to top of add item section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalAmount = currentItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalQuantity = currentItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    console.log('handleConfirmOrder called');
    if (!userData) {
      console.error('Order failed: No user data found');
      alert('User data not loaded. Please refresh the page.');
      return;
    }
    if (!settings) {
      console.error('Order failed: No settings found');
      alert('Settings not loaded. Please wait a moment.');
      return;
    }
    if (isSubmitting) {
      console.warn('Order failed: Already submitting');
      return;
    }
    if (!mobile || !address) {
      console.warn('Order failed: Missing mobile or address');
      alert('Please enter your mobile number and delivery address.');
      return;
    }
    if (currentItems.length === 0) {
      console.warn('Order failed: No items in cart');
      alert('Your cart is empty.');
      return;
    }
    
    setIsSubmitting(true);
    // Use the counter from settings to determine the next order number
    const nextOrderNumber = (settings.lastOrderNumber || 10000) + 1;

    const newOrder: Omit<Order, 'id'> = {
      customerId: userData.uid,
      customerName: userData.name || 'Customer',
      mobile,
      address,
      items: currentItems,
      totalQuantity,
      totalAmount,
      status: 'pending',
      orderNumber: nextOrderNumber,
      paymentMethod,
      paymentStatus: 'pending',
      paidAmount: 0,
      pendingAmount: totalAmount
    };

    try {
      console.log('Attempting to create order in Firestore...', newOrder);
      const orderRef = await dbService.addDocument('orders', newOrder);
      console.log('Order created successfully with ID:', orderRef?.id);
      
      console.log('Attempting to increment lastOrderNumber in settings...');
      // Increment the counter in settings atomically
      await dbService.incrementField('settings', 'global', 'lastOrderNumber', 1);
      console.log('Order number incremented successfully');
      
      // Send Email Notification to Admin and Customer
      if (settings?.adminEmail) {
        console.log('Triggering email notification...');
        fetch('/api/send-order-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: settings.adminEmail,
            customerEmail: userData.email,
            orderData: { ...newOrder, orderNumber: nextOrderNumber }
          }),
        }).then(res => {
          console.log('Email notification response status:', res.status);
        }).catch(err => console.error('Email notification failed:', err));
      }
      
      // WhatsApp Notification
      const orderSummary = currentItems.map(item => `${item.itemName} (${item.service}) x ${item.quantity}`).join(', ');
      
      // Custom API Notification (Automatic)
      if (settings?.apiConfig?.isConnected) {
        console.log('Sending WhatsApp via Custom API...');
        
        // 1. Send to Admin
        if (settings.contactNumber) {
          const adminMessage = `*New Order Received!*
*Order #:* ${nextOrderNumber}
*Customer:* ${userData.name}
*Mobile:* ${mobile}
*Total:* ₹${totalAmount}
*Items:* ${orderSummary}`;
          
          await sendCustomApiMessage(settings.apiConfig, settings.contactNumber, adminMessage);
        }

        // 2. Send to Customer
        if (mobile) {
          const customerMessage = `*Order Confirmed!*
Hello ${userData.name}, your order #${nextOrderNumber} has been received successfully.
*Total Amount:* ₹${totalAmount}
*Status:* Pending
Thank you for choosing ${settings.shopName || 'us'}!`;
          
          await sendCustomApiMessage(settings.apiConfig, mobile, customerMessage);
        }
      }
      
      if (settings?.metaWhatsAppConfig?.enabled && settings.contactNumber) {
        console.log('Sending WhatsApp via Meta API...');
        await sendMetaWhatsAppMessage(
          settings.metaWhatsAppConfig,
          settings.contactNumber,
          userData.name,
          `Order Total: ₹${totalAmount}. Items: ${orderSummary}`
        );
      } else if (settings?.whatsappApiUrl && settings?.contactNumber) {
        console.log('Opening WhatsApp fallback link...');
        const message = `*New Order Received!*%0A%0A*Customer:* ${userData.name}%0A*Mobile:* ${mobile}%0A*Total Items:* ${totalQuantity}%0A*Total Amount:* ₹${totalAmount}%0A%0A*Items:*%0A${currentItems.map(item => `- ${item.itemName} (${item.service}) x ${item.quantity}`).join('%0A')}`;
        const whatsappUrl = `${settings.whatsappApiUrl}?phone=${settings.contactNumber}&text=${message}`;
        window.open(whatsappUrl, '_blank');
      }

      console.log('Order process complete, showing success modal');
      // Reset state
      setOrderStep(1);
      setCurrentItems([]);
      setShowOrderSuccess(true);
      setActiveTab('dashboard');
    } catch (error: any) {
      console.error('CRITICAL ERROR during order creation:', error);
      let errorMessage = 'Failed to place order. ';
      if (error.message && error.message.includes('permission-denied')) {
        errorMessage += 'Permission denied. Please check if you are logged in correctly.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'new-order', label: 'New Order', icon: <Plus className="w-5 h-5" /> },
    { id: 'orders', label: 'My Orders', icon: <ShoppingBag className="w-5 h-5" /> },
  ];

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivery').length,
  };

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
      {isImpersonating && (
        <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-50 rounded-xl mb-6 shadow-lg shadow-indigo-100">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium italic">Preview Mode: <strong>{userData?.name}</strong></span>
          </div>
          <button 
            onClick={onStopImpersonating}
            className="bg-white dark:bg-black text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
          >
            Exit Preview
          </button>
        </div>
      )}
      <AnimatePresence>
        {showPopup && settings?.popupConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-black rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowPopup(false)}
                className="absolute top-4 right-4 p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5 dark:text-white" />
              </button>
              {settings.popupConfig.imageUrl && (
                <img src={settings.popupConfig.imageUrl} alt="Offer" className="w-full h-64 object-cover" />
              )}
              <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{settings.popupConfig.text}</h2>
                {settings.popupConfig.link && (
                  <a 
                    href={settings.popupConfig.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    View Offer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Total Orders', value: stats.total, icon: <Package className="w-8 h-8 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Pending', value: stats.pending, icon: <Clock className="w-8 h-8 text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Delivered', value: stats.delivered, icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`${stat.bg} p-6 rounded-2xl border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                </div>
                {stat.icon}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600" />
                Connect With Us
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-black rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
                  >
                    <div className="w-10 h-10 bg-white dark:bg-black rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                      {getSocialIcon(link.platform)}
                    </div>
                    <span className="font-semibold capitalize text-gray-900 dark:text-white">{link.platform}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-indigo-600 p-8 rounded-2xl shadow-lg text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">Ready to place an order?</h3>
                <p className="text-indigo-100 mb-8 max-w-xs">Create a new order now and get it delivered to your doorstep.</p>
                <button
                  onClick={() => setActiveTab('new-order')}
                  className="px-8 py-3 bg-white dark:bg-black text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all flex items-center gap-2 shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  New Order
                </button>
              </div>
              <ShoppingBag className="absolute -right-8 -bottom-8 w-48 h-48 text-indigo-500/30 rotate-12" />
            </div>
          </div>

          <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Available Services
            </h3>
            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No services available at the moment.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Please check back later or contact the administrator.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from(new Set(items.map(i => i.name))).map((name) => (
                  <div key={name} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-100 dark:hover:border-indigo-800 border border-transparent transition-all group cursor-pointer" onClick={() => { setActiveTab('new-order'); setSelectedItem(name); setOrderStep(1); }}>
                    <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 font-bold">
                      {items.filter(i => i.name === name).length} Options
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'new-order' && (
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Order</h2>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${orderStep === 1 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}`}>1</span>
              <div className="w-8 h-px bg-gray-200 dark:bg-gray-800" />
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${orderStep === 2 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}`}>2</span>
            </div>
          </div>

          {orderStep === 1 ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Add Items</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Item</label>
                    <select
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                    >
                      <option value="" className="dark:bg-black">Select an item</option>
                      {Array.from(new Set(items.map(i => i.name))).map(name => (
                        <option key={name} value={name} className="dark:bg-black">{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Service</label>
                    <select
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      disabled={!selectedItem}
                    >
                      <option value="" className="dark:bg-black">Select a service</option>
                      {items.filter(i => i.name === selectedItem).map(item => (
                        <option key={item.id} value={item.service} className="dark:bg-black">
                          {item.service} {item.showPriceToCustomer ? `(₹${item.price})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddItem}
                      disabled={!selectedItem || !selectedService}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {editingIndex !== null ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Update Item
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          Add to List
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white">Current List</h4>
                    {editingIndex !== null && (
                      <button 
                        onClick={() => {
                          setEditingIndex(null);
                          setSelectedItem('');
                          setSelectedService('');
                          setQuantity(1);
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-600"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                  {currentItems.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">No items added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {currentItems.map((item, index) => (
                        <div key={index} className={`flex items-center justify-between p-4 rounded-xl group transition-all ${editingIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-100 dark:ring-indigo-900/20' : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent'}`}>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{item.itemName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.service} x {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-indigo-600 dark:text-indigo-400 mr-2">₹{item.price * item.quantity}</p>
                            <button 
                              onClick={() => handleEditItem(index)} 
                              className="p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleRemoveItem(index)} 
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {currentItems.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setOrderStep(2)}
                    className="px-10 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-xl shadow-indigo-200"
                  >
                    Next Step
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Delivery Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Enter mobile number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      Delivery Address
                    </label>
                    <textarea
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none dark:text-white"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter full delivery address"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Payment Method</h3>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { id: 'Cash', label: 'Cash on Delivery', icon: <ShoppingBag className="w-5 h-5" /> },
                    { id: 'GPay', label: 'Google Pay', icon: <CreditCard className="w-5 h-5" /> },
                    { id: 'UPI', label: 'UPI / PhonePe', icon: <CreditCard className="w-5 h-5" /> }
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setPaymentMethod(method.id as any);
                        setPaymentConfirmed(method.id === 'Cash');
                      }}
                      className={`py-4 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center gap-3 border-2 ${
                        paymentMethod === method.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
                          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                      }`}
                    >
                      {method.icon}
                      <span className="text-center leading-tight">{method.label}</span>
                    </button>
                  ))}
                </div>

                {(paymentMethod === 'GPay' || paymentMethod === 'UPI') && settings?.upiId && (
                  <div className="space-y-6">
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800 text-center">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4">Scan to Pay ₹{totalAmount}</p>
                      
                      {/* QR Code Generator using public API */}
                      <div className="bg-[#ffffff] p-4 rounded-2xl inline-block shadow-sm mb-4 border border-indigo-100">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.upiName || settings.shopName)}&am=${totalAmount}&cu=INR`)}`}
                          alt="Payment QR Code"
                          className="w-40 h-40"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-1">{settings.upiName || settings.shopName}</p>
                      <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mb-6">{settings.upiId}</p>

                      <div className="grid grid-cols-1 gap-3">
                        {paymentMethod === 'GPay' ? (
                          <a 
                            href={`intent://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.upiName || settings.shopName)}&am=${totalAmount}&cu=INR#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`}
                            className="flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                          >
                            <ExternalLink className="w-5 h-5" />
                            Open Google Pay
                          </a>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <a 
                              href={`intent://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.upiName || settings.shopName)}&am=${totalAmount}&cu=INR#Intent;scheme=upi;package=com.phonepe.app;end`}
                              className="flex items-center justify-center gap-2 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 dark:shadow-none"
                            >
                              PhonePe
                            </a>
                            <a 
                              href={`upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.upiName || settings.shopName)}&am=${totalAmount}&cu=INR`}
                              className="flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                            >
                              Other UPI
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {!paymentConfirmed && (
                      <button
                        onClick={() => setPaymentConfirmed(true)}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                        I have completed the payment
                      </button>
                    )}
                    
                    {paymentConfirmed && (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-2xl text-emerald-600 dark:text-emerald-400 text-center font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Payment Confirmed by You
                        <button 
                          onClick={() => setPaymentConfirmed(false)}
                          className="text-xs underline ml-2 opacity-70"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-black p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Order Summary</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Order Date & Time</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Total Items</span>
                    <span className="font-bold text-gray-900 dark:text-white">{totalQuantity}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold text-gray-900 dark:text-white pt-4 border-t border-gray-100 dark:border-gray-800">
                    <span>Total Amount</span>
                    <span className="text-indigo-600 dark:text-indigo-400">₹{totalAmount}</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setOrderStep(1)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (paymentMethod !== 'Cash' && !paymentConfirmed) {
                        alert('Please complete the payment and click "I have completed the payment" first.');
                        return;
                      }
                      console.log('Confirm Order button clicked');
                      handleConfirmOrder();
                    }}
                    disabled={isSubmitting || !settings || (paymentMethod !== 'Cash' && !paymentConfirmed)}
                    className={`flex-[2] py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 dark:shadow-none ${
                      (isSubmitting || !settings || (paymentMethod !== 'Cash' && !paymentConfirmed))
                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : !settings ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading Settings...
                      </>
                    ) : (
                      <>
                        Confirm Order
                        <CheckCircle2 className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
                {(!mobile || !address) && !isSubmitting && (
                  <p className="text-center text-sm text-red-500 mt-2 font-medium">
                    Please fill mobile number and delivery address to confirm.
                  </p>
                )}
                {paymentMethod !== 'Cash' && !paymentConfirmed && !isSubmitting && (
                  <p className="text-center text-sm text-amber-600 mt-2 font-bold">
                    ⚠️ Complete payment to enable "Confirm Order" button.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">My Orders</h2>
          {orders.length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No orders yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">You haven't placed any orders yet. Start shopping now!</p>
              <button
                onClick={() => setActiveTab('new-order')}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                Create First Order
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-black p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Order No.</p>
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">#{order.orderNumber || order.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      order.status === 'delivery' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                      order.status === 'ready' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                      order.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                      order.status === 'receive' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  {order.trackingId && (
                    <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                      <p className="text-xs font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider mb-1">Tracking ID</p>
                      <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 font-mono">{order.trackingId}</p>
                    </div>
                  )}
                  
                  <div className="space-y-3 mb-6">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{item.itemName} ({item.service}) x {item.quantity}</span>
                        <span className="font-bold text-gray-900 dark:text-white">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Total Amount</p>
                      <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">₹{order.totalAmount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Date</p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {(() => {
                          const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                          return !isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A';
                        })()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {showOrderSuccess && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-black rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8"
            >
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Successful!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">Your order has been placed successfully. You can track its status in the "My Orders" tab.</p>
              <button
                onClick={() => setShowOrderSuccess(false)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
              >
                Great, Thanks!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default CustomerPanel;

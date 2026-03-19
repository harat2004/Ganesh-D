import React, { useState, useEffect } from 'react';
import { User, Settings, Order, Item, OrderItem, SocialLink } from '../types';
import { dbService } from '../services/db';
import { sendMetaWhatsAppMessage } from '../services/whatsapp';
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
  MessageCircle,
  Phone,
  MapPin,
  User as UserIcon,
  Share2,
  Eye
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
  
  // Order Flow State
  const [orderStep, setOrderStep] = useState(1);
  const [currentItems, setCurrentItems] = useState<OrderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [mobile, setMobile] = useState(userData?.mobile || '');
  const [address, setAddress] = useState(userData?.address || '');

  useEffect(() => {
    if (userData) {
      console.log('CustomerPanel: Fetching data for user:', userData.uid);
      const unsubscribeOrders = dbService.subscribeToCollection<Order>(
        'orders', 
        [where('customerId', '==', userData.uid), orderBy('createdAt', 'desc'), limit(50)],
        (data) => {
          console.log('CustomerPanel: Orders received:', data.length);
          setOrders(data);
        }
      );
      
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
    }
  }, [userData, settings]);

  const handleAddItem = () => {
    const item = items.find(i => i.name === selectedItem && i.service === selectedService);
    if (item) {
      setCurrentItems([...currentItems, {
        itemName: item.name,
        service: item.service,
        quantity,
        price: item.price
      }]);
      setSelectedItem('');
      setSelectedService('');
      setQuantity(1);
    }
  };

  const handleRemoveItem = (index: number) => {
    setCurrentItems(currentItems.filter((_, i) => i !== index));
  };

  const totalAmount = currentItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalQuantity = currentItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (!userData) return;
    
    const newOrder: Omit<Order, 'id'> = {
      customerId: userData.uid,
      customerName: userData.name,
      mobile,
      address,
      items: currentItems,
      totalQuantity,
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await dbService.addDocument('orders', newOrder);
      
      // WhatsApp Notification
      const orderSummary = currentItems.map(item => `${item.itemName} (${item.service}) x ${item.quantity}`).join(', ');
      
      if (settings?.metaWhatsAppConfig?.enabled && settings.contactNumber) {
        // Send automatic message via Meta API
        await sendMetaWhatsAppMessage(
          settings.metaWhatsAppConfig,
          settings.contactNumber,
          userData.name,
          `Order Total: ₹${totalAmount}. Items: ${orderSummary}`
        );
      } else if (settings?.whatsappApiUrl && settings?.contactNumber) {
        // Fallback to direct link if Meta API is not enabled
        const message = `*New Order Received!*%0A%0A*Customer:* ${userData.name}%0A*Mobile:* ${mobile}%0A*Total Items:* ${totalQuantity}%0A*Total Amount:* ₹${totalAmount}%0A%0A*Items:*%0A${currentItems.map(item => `- ${item.itemName} (${item.service}) x ${item.quantity}`).join('%0A')}`;
        const whatsappUrl = `${settings.whatsappApiUrl}?phone=${settings.contactNumber}&text=${message}`;
        window.open(whatsappUrl, '_blank');
      }

      // Reset state
      setOrderStep(1);
      setCurrentItems([]);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Error creating order:', error);
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
    completed: orders.filter(o => o.status === 'completed').length,
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
            className="bg-white text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-all"
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
              className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowPopup(false)}
                className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              {settings.popupConfig.imageUrl && (
                <img src={settings.popupConfig.imageUrl} alt="Offer" className="w-full h-64 object-cover" />
              )}
              <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{settings.popupConfig.text}</h2>
                {settings.popupConfig.link && (
                  <a 
                    href={settings.popupConfig.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
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
              { label: 'Total Orders', value: stats.total, icon: <Package className="w-8 h-8 text-blue-500" />, bg: 'bg-blue-50' },
              { label: 'Pending', value: stats.pending, icon: <Clock className="w-8 h-8 text-amber-500" />, bg: 'bg-amber-50' },
              { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />, bg: 'bg-emerald-50' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`${stat.bg} p-6 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                {stat.icon}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
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
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <span className="font-semibold capitalize">{link.platform}</span>
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
                  className="px-8 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  New Order
                </button>
              </div>
              <ShoppingBag className="absolute -right-8 -bottom-8 w-48 h-48 text-indigo-500/30 rotate-12" />
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Available Services
            </h3>
            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No services available at the moment.</p>
                <p className="text-xs text-gray-400 mt-1">Please check back later or contact the administrator.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from(new Set(items.map(i => i.name))).map((name) => (
                  <div key={name} className="p-4 bg-gray-50 rounded-xl text-center hover:bg-indigo-50 hover:border-indigo-100 border border-transparent transition-all group cursor-pointer" onClick={() => { setActiveTab('new-order'); setSelectedItem(name); setOrderStep(1); }}>
                    <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">
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
            <h2 className="text-3xl font-bold text-gray-900">Create New Order</h2>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${orderStep === 1 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>1</span>
              <div className="w-8 h-px bg-gray-200" />
              <span className={`w-8 h-8 rounded-full flex items-center justify-center ${orderStep === 2 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>2</span>
            </div>
          </div>

          {orderStep === 1 ? (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Add Items</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Item</label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                    >
                      <option value="">Select an item</option>
                      {Array.from(new Set(items.map(i => i.name))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Service</label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      disabled={!selectedItem}
                    >
                      <option value="">Select a service</option>
                      {items.filter(i => i.name === selectedItem).map(item => (
                        <option key={item.id} value={item.service}>
                          {item.service} {item.showPriceToCustomer ? `(₹${item.price})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
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
                      <Plus className="w-5 h-5" />
                      Add to List
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-bold text-gray-900 mb-4">Current List</h4>
                  {currentItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">No items added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {currentItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl group">
                          <div>
                            <p className="font-bold text-gray-900">{item.itemName}</p>
                            <p className="text-sm text-gray-500">{item.service} x {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-bold text-indigo-600">₹{item.price * item.quantity}</p>
                            <button onClick={() => handleRemoveItem(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-5 h-5" />
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
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Delivery Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Enter mobile number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      Delivery Address
                    </label>
                    <textarea
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter full delivery address"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Order Summary</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Order Date & Time</span>
                    <span className="font-medium">
                      {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total Items</span>
                    <span className="font-bold">{totalQuantity}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold text-gray-900 pt-4 border-t border-gray-100">
                    <span>Total Amount</span>
                    <span className="text-indigo-600">₹{totalAmount}</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setOrderStep(1)}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmOrder}
                    disabled={!mobile || !address}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200"
                  >
                    Confirm Order
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-gray-900">My Orders</h2>
          {orders.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-500 mb-8">You haven't placed any orders yet. Start shopping now!</p>
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
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order ID</p>
                      <p className="font-mono text-sm text-gray-600">{order.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      order.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  {order.trackingId && (
                    <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Tracking ID</p>
                      <p className="text-sm font-bold text-indigo-700 font-mono">{order.trackingId}</p>
                    </div>
                  )}
                  
                  <div className="space-y-3 mb-6">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.itemName} ({item.service}) x {item.quantity}</span>
                        <span className="font-bold text-gray-900">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">Total Amount</p>
                      <p className="text-xl font-bold text-indigo-600">₹{order.totalAmount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Date</p>
                      <p className="text-sm font-medium text-gray-600">
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
    </Layout>
  );
};

export default CustomerPanel;

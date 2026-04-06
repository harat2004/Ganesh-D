import React from 'react';
import { auth } from '../firebase';
import { User, Settings } from '../types';
import { LogOut, User as UserIcon, Settings as SettingsIcon, LayoutDashboard, ShoppingBag, Users, Package, Share2, Menu, X, Sun, Moon } from 'lucide-react';
import { dbService } from '../services/db';

interface LayoutProps {
  children: React.ReactNode;
  userData: User | null;
  settings: Settings | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: { id: string; label: string; icon: React.ReactNode }[];
}

const Layout: React.FC<LayoutProps> = ({ children, userData, settings, activeTab, setActiveTab, tabs }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    auth.signOut();
  };

  const toggleTheme = async () => {
    const newMode = settings?.themeMode === 'dark' ? 'light' : 'dark';
    console.log('Toggling theme to:', newMode);
    try {
      // Update Firestore
      console.log('Updating Firestore with new theme mode:', newMode);
      await dbService.setDocument('settings', 'global', { themeMode: newMode });
      
      // Immediate UI feedback by toggling class on html element
      if (newMode === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
        console.log('Manually added "dark" class and set colorScheme for immediate feedback');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
        console.log('Manually removed "dark" class and set colorScheme for immediate feedback');
      }
    } catch (error) {
      console.error('Failed to toggle theme:', error);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-black flex flex-col md:flex-row transition-colors duration-300 ${settings?.themeMode === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                {settings?.shopName?.[0] || 'S'}
              </div>
            )}
            <span className="font-bold text-gray-900 dark:text-white truncate">{settings?.shopName || 'Shop Name'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            title={settings?.themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {settings?.themeMode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 font-semibold">
              {userData?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userData?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{userData?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              {settings?.shopName?.[0] || 'S'}
            </div>
          )}
          <span className="font-bold text-gray-900 dark:text-white text-sm">{settings?.shopName || 'Shop Name'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {settings?.themeMode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-black shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  {settings?.shopName?.[0] || 'S'}
                </div>
              )}
              <span className="font-bold text-gray-900 dark:text-white truncate">{settings?.shopName || 'Shop Name'}</span>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

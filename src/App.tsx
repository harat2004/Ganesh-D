import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { dbService } from './services/db';
import { User, Settings } from './types';
import { ADMIN_EMAILS } from './constants';
import Auth from './components/Auth';
import CustomerPanel from './components/CustomerPanel';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (user) {
        // Subscribe to user document to handle new user creation delay
        unsubscribeUser = dbService.subscribeToDocument<User>('users', user.uid, async (data) => {
          let finalData = data;
          
          // Initial check with hardcoded email if doc doesn't exist or role is wrong
          const userEmail = user.email?.toLowerCase();
          const isAdminEmail = userEmail && ADMIN_EMAILS.some(email => email.toLowerCase() === userEmail);

          if (!finalData) {
            // Create default user document if missing
            const newUser: User = {
              uid: user.uid,
              name: user.displayName || 'Customer',
              email: user.email || '',
              role: isAdminEmail ? 'admin' : 'customer',
              isBlocked: false,
              createdAt: new Date().toISOString()
            };
            console.log('Creating missing user document:', newUser);
            await dbService.setDocument('users', user.uid, newUser);
            finalData = newUser;
          } else if (isAdminEmail && finalData.role !== 'admin') {
            // Update role to admin if it's a hardcoded admin email
            const updatedData = { ...finalData, role: 'admin' as const };
            await dbService.setDocument('users', user.uid, updatedData);
            finalData = updatedData;
          }
          
          setUserData(finalData);
          setIsAuthReady(true);
          setLoading(false);
        });
      } else {
        setUserData(null);
        setIsAuthReady(true);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  useEffect(() => {
    const mode = settings?.themeMode || 'light';
    console.log('Applying theme mode:', mode);
    
    // Apply to html element for Tailwind dark: variants
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [settings?.themeMode]);

  useEffect(() => {
    const unsubscribe = dbService.subscribeToDocument<Settings>('settings', 'global', async (data) => {
      if (!data && userData?.role === 'admin') {
        // Initialize default settings if they don't exist
        const defaultSettings: Settings = {
          shopName: 'Ganesh Dry Cleaner',
          adminEmail: ADMIN_EMAILS[0],
          logoUrl: 'https://cdn-icons-png.flaticon.com/512/2970/2970922.png',
          address: 'Main Market, Your City',
          contactNumber: '9876543210',
          whatsappApiUrl: 'https://api.whatsapp.com/send',
          popupConfig: {
            imageUrl: 'https://picsum.photos/seed/dryclean/800/400',
            text: 'Welcome to Ganesh Dry Cleaner! Quality service at your doorstep.',
            link: '',
            show: true
          },
          themeType: 'type1',
          themeMode: 'light',
          lastOrderNumber: 10000,
          upiId: '',
          upiName: ''
        };
        await dbService.setDocument('settings', 'global', defaultSettings);
      }
      setSettings(data);
    });
    return () => unsubscribe();
  }, [userData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-black">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  const handleImpersonate = (user: User | null) => {
    setImpersonatedUser(user);
  };

  const displayUser = impersonatedUser || userData;
  const userEmail = firebaseUser?.email?.toLowerCase();
  const isAdmin = userEmail && ADMIN_EMAILS.some(email => email.toLowerCase() === userEmail);

  const urlParams = new URLSearchParams(window.location.search);
  const isAuthAction = urlParams.has('oobCode');

  return (
    <ErrorBoundary>
      {(!firebaseUser || isAuthAction) ? (
        <Auth settings={settings} />
      ) : displayUser?.isBlocked ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-4 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Account Blocked</h1>
          <p className="text-gray-700">Your account has been blocked by the administrator. Please contact support.</p>
          <button
            onClick={() => auth.signOut()}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      ) : (displayUser?.role === 'admin' && isAdmin) ? (
        <AdminPanel userData={displayUser} settings={settings} onImpersonate={handleImpersonate} />
      ) : (
        <CustomerPanel 
          userData={displayUser} 
          settings={settings} 
          isImpersonating={!!impersonatedUser}
          onStopImpersonating={() => setImpersonatedUser(null)}
        />
      )}
    </ErrorBoundary>
  );
};

export default App;

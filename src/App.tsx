import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { dbService } from './services/db';
import { User, Settings } from './types';
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        let data = await dbService.getDocument<User>('users', user.uid);
        
        // Force admin role for the specific email
        const adminEmail = 'shreecharbhujadigitalstudio@gmail.com';
        if (user.email === adminEmail) {
          if (!data || data.role !== 'admin') {
            const adminData: User = data ? { ...data, role: 'admin' } : {
              uid: user.uid,
              name: user.displayName || 'Admin',
              email: user.email,
              role: 'admin',
              isBlocked: false,
              createdAt: new Date().toISOString()
            };
            await dbService.setDocument('users', user.uid, adminData);
            data = adminData;
          }
        }
        
        setUserData(data);
      } else {
        setUserData(null);
      }
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthReady && firebaseUser) {
      const unsubscribe = dbService.subscribeToDocument<Settings>('settings', 'global', async (data) => {
        if (!data && userData?.role === 'admin') {
          // Initialize default settings if they don't exist
          const defaultSettings: Settings = {
            shopName: 'My Digital Studio',
            logoUrl: '',
            address: '123 Studio Street, City',
            contactNumber: '1234567890',
            whatsappApiUrl: 'https://api.whatsapp.com/send',
            popupConfig: {
              imageUrl: 'https://picsum.photos/seed/offer/800/400',
              text: 'Welcome to our new store! Get 20% off on your first order.',
              link: '',
              show: true
            },
            themeType: 'type1'
          };
          await dbService.setDocument('settings', 'global', defaultSettings);
        }
        setSettings(data);
      });
      return () => unsubscribe();
    } else {
      setSettings(null);
    }
  }, [isAuthReady, userData, firebaseUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  const handleImpersonate = (user: User | null) => {
    setImpersonatedUser(user);
  };

  const displayUser = impersonatedUser || userData;

  return (
    <ErrorBoundary>
      {!firebaseUser ? (
        <Auth />
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
      ) : displayUser?.role === 'admin' ? (
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

import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { User } from '../types';
import { LogIn, UserPlus, Mail, Lock, Loader2, Chrome, KeyRound, AlertTriangle, Copy, Check } from 'lucide-react';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const currentOrigin = window.location.origin;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      // Try to fetch a non-existent doc to test connectivity
      await dbService.getDocument('settings', 'global');
      setConnectionStatus('success');
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network Error: Please check your internet or see Troubleshooting below.');
        setShowTroubleshoot(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const existingUser = await dbService.getDocument<User>('users', user.uid);
      if (!existingUser) {
        const isAdmin = user.email === 'shreecharbhujadigitalstudio@gmail.com';
        // Create new user
        const newUser: User = {
          uid: user.uid,
          name: user.displayName || 'New User',
          email: user.email || '',
          role: isAdmin ? 'admin' : 'customer',
          isBlocked: false,
          createdAt: new Date().toISOString()
        };
        await dbService.setDocument('users', user.uid, newUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Network Error: Please check your internet or see Troubleshooting below.');
        setShowTroubleshoot(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await updateProfile(user, { displayName: name });
        
        const isAdmin = email === 'shreecharbhujadigitalstudio@gmail.com';
        const newUser: User = {
          uid: user.uid,
          name: name,
          email: email,
          role: isAdmin ? 'admin' : 'customer',
          isBlocked: false,
          createdAt: new Date().toISOString()
        };
        await dbService.setDocument('users', user.uid, newUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please Sign In instead.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network Error: Please check your internet or see Troubleshooting below.');
        setShowTroubleshoot(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-500">
            {isLogin ? 'Sign in to manage your orders' : 'Join us to start ordering'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-bold">Error:</span>
            </div>
            <p className="break-words">{error}</p>
            {error.includes('network-request-failed') && (
              <button 
                onClick={() => setShowTroubleshoot(true)}
                className="text-xs font-bold underline text-left"
              >
                Show Troubleshooting Steps
              </button>
            )}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
            <span className="font-bold">Success:</span> {message}
          </div>
        )}

        {showTroubleshoot && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 text-xs space-y-3">
            <h4 className="font-bold text-amber-800 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Troubleshooting Login Issues
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-amber-900">
              <li>
                <strong>Check Internet:</strong> 
                <button 
                  type="button"
                  onClick={testConnection}
                  disabled={testingConnection}
                  className="ml-2 px-2 py-0.5 bg-amber-200 rounded hover:bg-amber-300 transition-colors inline-flex items-center gap-1"
                >
                  {testingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test Connection'}
                  {connectionStatus === 'success' && <Check className="w-3 h-3 text-green-600" />}
                  {connectionStatus === 'error' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                </button>
                {connectionStatus === 'success' && <p className="mt-1 text-green-700 font-bold">Network is OK! Issue might be Firebase Domain Authorization.</p>}
                {connectionStatus === 'error' && <p className="mt-1 text-red-700 font-bold">Network is BLOCKED! Check your internet or ad-blocker.</p>}
              </li>
              <li>
                <strong>Add Domain to Firebase:</strong> Firebase needs to know this website is safe.
                <div className="mt-2 p-2 bg-white rounded border border-amber-100 flex items-center justify-between gap-2">
                  <code className="truncate flex-1">{currentOrigin}</code>
                  <button onClick={copyToClipboard} className="p-1 hover:bg-gray-100 rounded">
                    {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="mt-1 opacity-70">Go to Firebase Console &gt; Auth &gt; Settings &gt; Authorized Domains &gt; Add Domain</p>
              </li>
              <li><strong>Disable Ad-Blockers:</strong> Some extensions block Firebase requests.</li>
              <li><strong>Use Incognito Mode:</strong> Try opening this app in a private window.</li>
            </ol>
            <button 
              onClick={() => setShowTroubleshoot(false)}
              className="w-full py-1 text-amber-700 font-bold hover:bg-amber-100 rounded transition-colors"
            >
              Close Troubleshooting
            </button>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Full Name"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              placeholder="Email Address"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={isLogin}
            />
          </div>

          {isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                <KeyRound className="w-4 h-4" />
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Sign Up
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <Chrome className="w-5 h-5 text-red-500" />
          Sign in with Google
        </button>

        <p className="text-center mt-8 text-gray-600">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;

import { useState, useCallback, useRef, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import { loadOrCreateUser, canUseFreeToday, markFreeUsed, deductCredit } from './lib/credits.js';
import { fetchAndClean } from './lib/snapshot-free.js';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import AuthModal from './components/AuthModal.jsx';
import InputCard from './components/InputCard.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import Pricing from './components/Pricing.jsx';
import Features from './components/Features.jsx';
import Footer from './components/Footer.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [freeUsedToday, setFreeUsedToday] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState('quick');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2500);
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const data = await loadOrCreateUser(firebaseUser.uid, firebaseUser.email);
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email,
          });
          setCredits(data.credits);
          setFreeUsedToday(data.freeUsedToday);
        } catch (err) {
          console.error('Failed to load user data:', err);
          toast('Error loading account — try again.');
        }
      } else {
        setUser(null);
        setCredits(0);
        setFreeUsedToday(null);
        setResult(null);
      }
    });
    return () => unsub();
  }, [toast]);

  const requireAuth = useCallback((fn) => {
    if (!user) { setAuthOpen(true); return; }
    fn();
  }, [user]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles the rest
      setAuthOpen(false);
      toast('Signed in!');
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return;
      console.error('Sign-in error:', err);
      toast('Sign-in failed — try again.');
    }
  }, [toast]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      toast('Signed out.');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }, [toast]);

  const handleBuy = useCallback((amount) => {
    requireAuth(() => {
      // TODO: replace with real Stripe checkout
      setCredits(c => c + amount);
      toast(`Added ${amount} credits! You now have ${credits + amount}.`);
    });
  }, [requireAuth, credits, toast]);

  const handleSnapshot = useCallback((url, exampleType) => {
    requireAuth(async () => {
      if (!url?.trim()) { toast('Paste a URL first!'); return; }

      const SPA_HOSTS = ['linear.app', 'figma.com', 'notion.so'];
      let host = '';
      try { host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch { host = url; }
      const isSpa = SPA_HOSTS.some(d => host.includes(d)) || exampleType === 'spa';

      if (mode === 'quick') {
        // Free mode — SPA check
        if (isSpa) {
          setResult({ type: 'linear-blocked', host });
          return;
        }

        // Check 1-per-day limit
        if (!canUseFreeToday(freeUsedToday)) {
          toast('Free limit reached — 1 per day. Try again tomorrow or get AI credits!');
          return;
        }

        // Real fetch
        setLoading(true);
        setResult({ type: 'loading', host });
        try {
          const { html, sizeKB } = await fetchAndClean(url);
          await markFreeUsed(user.uid);
          const today = new Date().toISOString().slice(0, 10);
          setFreeUsedToday(today);
          setResult({ type: 'free-success', host, html, sizeKB });
        } catch (err) {
          console.error('Snapshot failed:', err);
          setResult(null);
          toast(err.message || 'Failed to capture — try a different URL.');
        } finally {
          setLoading(false);
        }

      } else if (mode === 'ai') {
        if (credits < 1) { toast('No credits!'); return; }
        try {
          const newCredits = await deductCredit(user.uid, credits);
          setCredits(newCredits);
          setResult({ type: 'linear-ai', host });
        } catch (err) {
          console.error('Credit deduct failed:', err);
          toast('Error — credit not deducted. Try again.');
        }
      } else {
        setResult({ type: 'hn', host });
      }
    });
  }, [mode, credits, freeUsedToday, user, requireAuth, toast]);

  const handleDismissStamp = useCallback(() => {
    setResult(r => r ? { ...r, type: 'linear-dismissed' } : r);
  }, []);

  return (
    <>
      <Nav
        user={user}
        credits={credits}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={handleSignOut}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignIn={handleSignIn}
      />
      <Hero />
      <InputCard
        mode={mode}
        onModeChange={setMode}
        onSnapshot={handleSnapshot}
        onRequireAuth={requireAuth}
      />
      <ResultsPanel
        result={result}
        mode={mode}
        loading={loading}
        onDismissStamp={handleDismissStamp}
        onUpgradeMode={() => setMode('ai')}
        toast={toast}
      />
      <Pricing onBuy={handleBuy} />
      <Features />
      <Footer />
      <Toast message={toastMsg} />
    </>
  );
}

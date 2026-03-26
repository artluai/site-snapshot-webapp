import { useState, useCallback, useRef } from 'react';
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
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState('quick');
  const [result, setResult] = useState(null); // { type: 'hn' | 'linear-blocked' | 'linear-ai' | 'upload' | null }
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2500);
  }, []);

  const requireAuth = useCallback((fn) => {
    if (!user) { setAuthOpen(true); return; }
    fn();
  }, [user]);

  const handleSignIn = useCallback(() => {
    // TODO: replace with real Firebase Google sign-in
    setUser({ name: 'User', email: 'user@example.com' });
    setCredits(1);
    setAuthOpen(false);
    toast('Signed in! You have 1 free snapshot today.');
  }, [toast]);

  const handleSignOut = useCallback(() => {
    setUser(null);
    setCredits(0);
    setResult(null);
    toast('Signed out.');
  }, [toast]);

  const handleBuy = useCallback((amount) => {
    requireAuth(() => {
      // TODO: replace with real Stripe checkout
      setCredits(c => c + amount);
      toast(`Added ${amount} credits! You now have ${credits + amount}.`);
    });
  }, [requireAuth, credits, toast]);

  const handleSnapshot = useCallback((url, exampleType) => {
    requireAuth(() => {
      if (!url?.trim()) { toast('Paste a URL first!'); return; }
      const SPA_HOSTS = ['linear.app', 'figma.com', 'notion.so'];
      let host = '';
      try { host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch { host = url; }
      const isSpa = SPA_HOSTS.some(d => host.includes(d)) || exampleType === 'spa';

      if (mode === 'quick' && isSpa) {
        setResult({ type: 'linear-blocked', host });
      } else if (mode === 'ai') {
        if (credits < 1) { toast('No credits!'); return; }
        setCredits(c => c - 1);
        setResult({ type: 'linear-ai', host });
      } else {
        setResult({ type: 'hn', host });
      }
    });
  }, [mode, credits, requireAuth, toast]);

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

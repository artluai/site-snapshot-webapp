import { useState, useCallback, useRef, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import { loadOrCreateUser, canUseFreeToday, markFreeUsed } from './lib/credits.js';
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

const RESPONSIVE_CSS = `
@media(max-width:768px){
  .hero-grid{grid-template-columns:1fr!important;padding:24px 20px 0!important;min-height:auto!important}
  .hero-title{font-size:40px!important;letter-spacing:-2px!important}
  .hero-visual{min-height:280px!important;border-radius:16px!important;padding:20px!important}
  .nav-bar{padding:16px 20px!important}
  .nav-outline{display:none!important}
  .input-section{padding:20px 20px 50px!important}
  .input-card{padding:24px!important}
  .input-row{flex-direction:column!important}
  .snap-btn{width:100%!important}
  .result-section{padding:0 20px 20px!important}
  .feat-section{padding:40px 20px!important}
  .feat-title{font-size:28px!important}
  .feat-grid{grid-template-columns:1fr!important}
  .upload-grid{grid-template-columns:1fr!important}
  .pricing-grid{grid-template-columns:1fr!important}
  .enhance-card{flex-direction:column!important;text-align:center!important}
  .footer-bar{padding:24px 20px!important;flex-direction:column!important;gap:8px!important}
  .pricing-section{padding:30px 20px!important}
  .hero-desc{font-size:16px!important}
  .mode-chips{flex-wrap:wrap!important}
  .preview-frame{height:280px!important}
  .compat-grid{grid-template-columns:1fr!important}
  .example-grid{grid-template-columns:1fr!important}
}
`;

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
    toastTimer.current = setTimeout(() => setToastMsg(''), 3000);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const data = await loadOrCreateUser(firebaseUser.uid, firebaseUser.email);
          setUser({ uid: firebaseUser.uid, name: firebaseUser.displayName || 'User', email: firebaseUser.email });
          setCredits(data.credits);
          setFreeUsedToday(data.freeUsedToday);
        } catch (err) {
          console.error('Failed to load user data:', err);
          toast('Error loading account — try again.');
        }
      } else {
        setUser(null); setCredits(0); setFreeUsedToday(null); setResult(null);
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
      setAuthOpen(false);
      toast('Signed in!');
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return;
      console.error('Sign-in error:', err);
      toast('Sign-in failed — try again.');
    }
  }, [toast]);

  const handleSignOut = useCallback(async () => {
    try { await signOut(auth); toast('Signed out.'); }
    catch (err) { console.error('Sign-out error:', err); }
  }, [toast]);

  const handleSnapshot = useCallback((url, exampleType) => {
    requireAuth(async () => {
      if (!url?.trim()) { toast('Paste a URL first!'); return; }

      if (mode === 'ai' || mode === 'upload') {
        toast('AI mode coming soon!');
        return;
      }

      const SPA_HOSTS = ['linear.app', 'figma.com', 'notion.so'];
      let host = '';
      try { host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch { host = url; }
      const isSpa = SPA_HOSTS.some(d => host.includes(d)) || exampleType === 'spa';

      if (isSpa) { setResult({ type: 'linear-blocked', host }); return; }

      if (!canUseFreeToday(freeUsedToday)) {
        toast('Free limit reached — 1 per day. AI mode coming soon!');
        return;
      }

      setLoading(true);
      setResult({ type: 'loading', host });
      try {
        const { html, sizeKB } = await fetchAndClean(url);
        await markFreeUsed(user.uid);
        setFreeUsedToday(new Date().toISOString().slice(0, 10));
        setResult({ type: 'free-success', host, html, sizeKB });
      } catch (err) {
        console.error('Snapshot failed:', err);
        setResult(null);
        toast(err.message || 'Failed to capture — try a different URL.');
      } finally {
        setLoading(false);
      }
    });
  }, [mode, freeUsedToday, user, requireAuth, toast]);

  const handleDismissStamp = useCallback(() => {
    setResult(r => r ? { ...r, type: 'linear-dismissed' } : r);
  }, []);

  return (
    <>
      <style>{RESPONSIVE_CSS}</style>
      <Nav user={user} credits={credits} onSignIn={() => setAuthOpen(true)} onSignOut={handleSignOut} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSignIn={handleSignIn} />
      <Hero />
      <InputCard mode={mode} onModeChange={setMode} onSnapshot={handleSnapshot} onRequireAuth={requireAuth} />
      <ResultsPanel result={result} mode={mode} loading={loading} onDismissStamp={handleDismissStamp} onUpgradeMode={() => toast('AI mode coming soon!')} toast={toast} />
      <Pricing />
      <Features />
      <Footer />
      <Toast message={toastMsg} />
    </>
  );
}

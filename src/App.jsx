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

  const handleBuy = useCallback((amount) => {
    requireAuth(() => {
      // TODO: Stripe checkout
      setCredits(c => c + amount);
      toast(`Added ${amount} credits!`);
    });
  }, [requireAuth, credits, toast]);

  // Parse streaming response from snapshot-ai
  const parseStreamResponse = async (response) => {
    // Check if it's a JSON error (non-streaming)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return { ok: false, error: data.error || 'Unknown error' };
    }

    // Read streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let creditsRemaining = null;
    let sizeKB = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }

    // Parse: first line is JSON metadata, last bit after final \n is JSON done marker
    const lines = fullText.split('\n');
    let htmlParts = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.event === 'start') {
          creditsRemaining = parsed.creditsRemaining;
        } else if (parsed.event === 'done') {
          sizeKB = parsed.sizeKB || 0;
        } else if (parsed.event === 'error') {
          return { ok: false, error: parsed.error || 'Stream error' };
        } else {
          htmlParts.push(line);
        }
      } catch {
        // Not JSON — it's HTML content
        htmlParts.push(line);
      }
    }

    let html = htmlParts.join('\n').trim();
    // Strip markdown fences if present
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      return { ok: false, error: 'AI did not return valid HTML — try again' };
    }

    return { ok: true, html, sizeKB, creditsRemaining };
  };

  const callAI = async (bodyPayload, host) => {
    setLoading(true);
    setResult({ type: 'ai-loading', host });
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/snapshot-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const errData = await response.json();
        toast(errData.error || 'AI snapshot failed.');
        setResult(null);
        return;
      }

      const data = await parseStreamResponse(response);
      if (!data.ok) {
        toast(data.error || 'AI snapshot failed.');
        setResult(null);
      } else {
        if (data.creditsRemaining !== null) setCredits(data.creditsRemaining);
        setResult({ type: 'ai-success', host, html: data.html, sizeKB: data.sizeKB });
      }
    } catch (err) {
      console.error('AI snapshot failed:', err);
      setResult(null);
      toast('AI snapshot failed — try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSnapshot = useCallback((url, exampleType) => {
    requireAuth(async () => {
      if (mode !== 'upload' && !url?.trim()) { toast('Paste a URL first!'); return; }

      const SPA_HOSTS = ['linear.app', 'figma.com', 'notion.so'];
      let host = '';
      if (url) {
        try { host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch { host = url; }
      }
      const isSpa = SPA_HOSTS.some(d => host.includes(d)) || exampleType === 'spa';

      if (mode === 'quick') {
        if (isSpa) { setResult({ type: 'linear-blocked', host }); return; }

        // Auto-fallback to AI if free is used up and user has credits
        if (!canUseFreeToday(freeUsedToday)) {
          if (credits >= 1) {
            toast('Free limit reached — using 1 AI credit instead.');
            await callAI({ url, mode: 'ai' }, host);
            return;
          }
          toast('Free limit reached — 1 per day. Get AI credits for unlimited snapshots!');
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

      } else if (mode === 'ai') {
        if (credits < 1) { toast('No credits! Purchase credits to use AI mode.'); return; }
        await callAI({ url, mode: 'ai' }, host);

      } else if (mode === 'upload') {
        toast('Use the upload zone to drop screenshots first.');
      }
    });
  }, [mode, credits, freeUsedToday, user, requireAuth, toast]);

  const handleUploadSnapshot = useCallback(async (images) => {
    if (!user) { setAuthOpen(true); return; }
    if (credits < 1) { toast('No credits!'); return; }
    if (!images?.length) { toast('Upload at least a desktop screenshot.'); return; }
    await callAI({ mode: 'upload', images }, 'screenshot rebuild');
  }, [user, credits, toast]);

  const handleDismissStamp = useCallback(() => {
    setResult(r => r ? { ...r, type: 'linear-dismissed' } : r);
  }, []);

  return (
    <>
      <Nav user={user} credits={credits} onSignIn={() => setAuthOpen(true)} onSignOut={handleSignOut} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSignIn={handleSignIn} />
      <Hero />
      <InputCard mode={mode} onModeChange={setMode} onSnapshot={handleSnapshot} onUploadSnapshot={handleUploadSnapshot} onRequireAuth={requireAuth} />
      <ResultsPanel result={result} mode={mode} loading={loading} onDismissStamp={handleDismissStamp} onUpgradeMode={() => setMode('ai')} toast={toast} />
      <Pricing onBuy={handleBuy} />
      <Features />
      <Footer />
      <Toast message={toastMsg} />
    </>
  );
}

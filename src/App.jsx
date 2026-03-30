import { useState, useCallback, useRef, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import {
  loadOrCreateUser,
  canUseFreeToday,
  markFreeUsed,
  subscribeToUser,
} from './lib/credits.js';
import { fetchAndClean } from './lib/snapshot-free.js';
import { createJob, getArtifactUrl, startJob, subscribeToJob } from './lib/jobs.js';
import { uploadJobSourceFiles } from './lib/uploads.js';
import { createCheckoutSession } from './lib/billing.js';
import { initGoogleTag, trackCheckoutStarted, trackPurchaseCompleted } from './lib/analytics.js';
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
  const [checkoutPack, setCheckoutPack] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);
  const userDocUnsubRef = useRef(null);
  const jobUnsubRef = useRef(null);
  const artifactRequestKey = useRef('');
  const checkoutHandledRef = useRef('');

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3000);
  }, []);

  const stopListeningToJob = useCallback(() => {
    jobUnsubRef.current?.();
    jobUnsubRef.current = null;
    artifactRequestKey.current = '';
  }, []);

  const syncJobResult = useCallback(async (job) => {
    if (!job) return;

    const host = job.source?.host || 'snapshot';

    if (job.status === 'queued' || job.status === 'running' || job.status === 'awaiting_upload') {
      setResult({
        type: 'job-progress',
        host,
        phase: job.progress?.phase || 'queued',
        percent: job.progress?.percent ?? 0,
        message: job.progress?.message || 'Processing your job',
      });
      return;
    }

    if (job.status === 'succeeded') {
      const requestKey = `${job.id}:${job.result?.storagePath || ''}`;
      if (!job.result?.storagePath || artifactRequestKey.current === requestKey) return;

      artifactRequestKey.current = requestKey;
      try {
        const [preview, download] = await Promise.all([
          getArtifactUrl(job.id, 'inline'),
          getArtifactUrl(job.id, 'attachment'),
        ]);

        setResult({
          type: 'ai-success',
          host,
          previewUrl: preview.url,
          downloadUrl: download.url,
          fileName: job.result.fileName,
          sizeKB: Math.round((job.result.bytes || 0) / 1024),
        });
      } catch (error) {
        console.error('Artifact URL error:', error);
        setResult({
          type: 'job-failed',
          host,
          message: 'Snapshot finished, but its download link could not be loaded.',
        });
      }
      return;
    }

    if (job.status === 'failed') {
      setResult({
        type: 'job-failed',
        host,
        message: job.error?.message || 'The job failed before the snapshot was ready.',
      });
    }
  }, []);

  const startListeningToJob = useCallback((uid, jobId) => {
    stopListeningToJob();
    jobUnsubRef.current = subscribeToJob(uid, jobId, (job) => {
      void syncJobResult(job);
    });
  }, [stopListeningToJob, syncJobResult]);

  useEffect(() => {
    initGoogleTag();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = null;

      if (firebaseUser) {
        try {
          setUser({ uid: firebaseUser.uid, name: firebaseUser.displayName || 'User', email: firebaseUser.email });
          await loadOrCreateUser(firebaseUser.uid, firebaseUser.email);
          userDocUnsubRef.current = subscribeToUser(firebaseUser.uid, (data) => {
            setCredits(data.credits);
            setFreeUsedToday(data.freeUsedToday);
          });
        } catch (err) {
          console.error('Failed to load user data:', err);
          toast('Error loading account — try again.');
        }
      } else {
        stopListeningToJob();
        setUser(null); setCredits(0); setFreeUsedToday(null); setResult(null);
      }
    });
    return () => {
      unsub();
      userDocUnsubRef.current?.();
      stopListeningToJob();
      clearTimeout(toastTimer.current);
    };
  }, [stopListeningToJob, toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const pack = params.get('pack') || '';
    const sessionId = params.get('session_id') || '';

    if (!checkout) return;

    const checkoutKey = `${checkout}:${pack}:${sessionId}`;
    if (checkoutHandledRef.current === checkoutKey) return;
    checkoutHandledRef.current = checkoutKey;

    if (checkout === 'success') {
      trackPurchaseCompleted({ pack, transactionId: sessionId });
      toast('Payment received. Credits should appear in a few seconds.');
    } else if (checkout === 'cancelled') {
      toast('Checkout canceled.');
    }

    params.delete('checkout');
    params.delete('pack');
    params.delete('session_id');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
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

  const handleBuyCredits = useCallback((pack) => {
    requireAuth(async () => {
      if (!pack) return;

      setCheckoutPack(pack);
      try {
        trackCheckoutStarted(pack);
        const session = await createCheckoutSession(pack);
        window.location.href = session.url;
      } catch (err) {
        console.error('Checkout error:', err);
        toast(err.message || 'Failed to open checkout.');
        setCheckoutPack('');
      }
    });
  }, [requireAuth, toast]);

  const handleSnapshot = useCallback((payload) => {
    const runSnapshot = async (activeUser) => {
      const url = payload?.url || '';
      const exampleType = payload?.exampleType;
      const files = Array.isArray(payload?.files) ? payload.files : [];

      if (mode !== 'upload' && !url?.trim()) { toast('Paste a URL first!'); return; }
      if (mode === 'upload' && !files.some((file) => file.slot === 'desktop')) {
        toast('Upload at least a desktop screenshot first.');
        return;
      }

      const SPA_HOSTS = ['linear.app', 'figma.com', 'notion.so'];
      let host = mode === 'upload' ? 'uploaded screenshots' : '';
      try { host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch { host = mode === 'upload' ? 'uploaded screenshots' : url; }
      const isSpa = mode !== 'upload' && (SPA_HOSTS.some(d => host.includes(d)) || exampleType === 'spa');

      if (mode === 'quick' && isSpa) { setResult({ type: 'linear-blocked', host }); return; }

      if (mode === 'quick' && !canUseFreeToday(freeUsedToday)) {
        toast('Free limit reached — 1 per day. Switch to AI mode for more.');
        return;
      }

      setLoading(true);
      setResult({ type: mode === 'quick' ? 'loading' : 'job-progress', host, phase: 'creating', percent: 2, message: 'Creating your job' });
      try {
        if (mode === 'ai') {
          const job = await createJob({ mode: 'browser_html', url });
          setResult({
            type: 'job-progress',
            host: job.source?.host || host,
            phase: 'queued',
            percent: 5,
            message: 'Job queued and waiting for the worker',
          });
          startListeningToJob(user.uid, job.jobId);
          return;
        }

        if (mode === 'upload') {
          const job = await createJob({ mode: 'vision_rebuild' });
          setResult({
            type: 'job-progress',
            host,
            phase: 'uploading_inputs',
            percent: 10,
            message: 'Uploading screenshots for the worker',
          });

          const uploadedFiles = await uploadJobSourceFiles(user.uid, job.jobId, files);
          startListeningToJob(user.uid, job.jobId);
          await startJob({ jobId: job.jobId, files: uploadedFiles });
          return;
        }

        const { html, sizeKB } = await fetchAndClean(url);
        await markFreeUsed(activeUser.uid);
        setFreeUsedToday(new Date().toISOString().slice(0, 10));
        setResult({ type: 'free-success', host, html, sizeKB });
      } catch (err) {
        console.error('Snapshot failed:', err);
        const message = err?.message || 'Failed to capture — try a different URL.';
        const isUploadDispatchFailure = mode === 'upload'
          && /request failed|worker dispatch failed|cloud tasks enqueue failed/i.test(message);

        if (!isUploadDispatchFailure) {
          setResult(null);
        }

        toast(err.message || 'Failed to capture — try a different URL.');
      } finally {
        setLoading(false);
      }
    };

    requireAuth(() => {
      void runSnapshot(user);
    });
  }, [mode, freeUsedToday, user, requireAuth, startListeningToJob, toast]);

  const handleDismissStamp = useCallback(() => {
    setResult(r => r ? { ...r, type: 'linear-dismissed' } : r);
  }, []);

  return (
    <>
      <style>{RESPONSIVE_CSS}</style>
      <Nav user={user} credits={credits} onSignIn={() => setAuthOpen(true)} onSignOut={handleSignOut} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSignIn={handleSignIn} />
      <Hero />
      <InputCard mode={mode} onModeChange={setMode} onSnapshot={handleSnapshot} />
      <ResultsPanel result={result} mode={mode} loading={loading} onDismissStamp={handleDismissStamp} onUpgradeMode={() => setMode('ai')} toast={toast} />
      <Pricing user={user} loadingPack={checkoutPack} onBuy={handleBuyCredits} />
      <Features />
      <Footer />
      <Toast message={toastMsg} />
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { downloadHTML } from '../lib/snapshot-free.js';

export default function ResultsPanel({ result, mode, loading, onDismissStamp, onUpgradeMode, toast }) {
  const ref = useRef(null);
  useEffect(() => {
    if (result) ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [result]);

  if (!result) return <div ref={ref} />;

  return (
    <section style={S.section} ref={ref}>
      {result.type === 'loading' && <LoadingResult host={result.host} variant="green" />}
      {result.type === 'ai-loading' && <AILoadingResult host={result.host} />}
      {result.type === 'free-success' && <FreeResult host={result.host} html={result.html} sizeKB={result.sizeKB} toast={toast} onUpgrade={onUpgradeMode} />}
      {result.type === 'ai-success' && <AIResult host={result.host} html={result.html} sizeKB={result.sizeKB} toast={toast} />}
      {result.type === 'hn' && <HNResult host={result.host} toast={toast} onUpgrade={onUpgradeMode} />}
      {(result.type === 'linear-blocked' || result.type === 'linear-dismissed') && (
        <LinearResult blocked={result.type === 'linear-blocked'} host={result.host} onDismiss={onDismissStamp} toast={toast} />
      )}
      {result.type === 'linear-ai' && <LinearAIResult host={result.host} toast={toast} />}
    </section>
  );
}

function StatusCard({ steps, variant }) {
  const [visible, setVisible] = useState([]);
  useEffect(() => {
    setVisible([]);
    steps.forEach((_, i) => {
      setTimeout(() => setVisible(v => [...v, i]), (i + 1) * 400);
    });
  }, [steps]);

  const bg = variant === 'green' ? '#f0fdf4' : variant === 'purple' ? '#f5f0ff' : '#fffbeb';
  const border = variant === 'green' ? '#bbf7d0' : variant === 'purple' ? '#e2d8f5' : '#fde68a';

  return (
    <div style={{ ...S.status, background: bg, borderColor: border }}>
      {steps.map((s, i) => (
        <div key={i} style={{ ...S.statusItem, opacity: visible.includes(i) ? 1 : 0, transform: visible.includes(i) ? 'translateY(0)' : 'translateY(8px)', transition: 'all .3s' }}>
          <span style={{ ...S.dot, background: visible.includes(steps.length - 1) || i < steps.length - 1 ? '#22c55e' : '#7c5cfc' }} />
          {s}
        </div>
      ))}
    </div>
  );
}

/* ── Loading states ── */
function LoadingResult({ host }) {
  return (
    <div style={{ ...S.status, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
      <div style={S.statusItem}>
        <span style={{ ...S.dot, background: '#22c55e', animation: 'pulse 1.5s ease infinite' }} />
        Fetching {host}...
      </div>
      <div style={{ paddingLeft: 18, fontSize: 12, color: '#999', marginTop: 4 }}>
        connecting · downloading HTML · this takes a few seconds
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

function AILoadingResult({ host }) {
  const [step, setStep] = useState(0);
  const steps = [
    `Fetching ${host}...`,
    'Analyzing design system — colors, fonts, layout...',
    'Claude is rebuilding the interface...',
    'Building interactions and responsive views...',
  ];

  useEffect(() => {
    const timers = [];
    timers.push(setTimeout(() => setStep(1), 2000));
    timers.push(setTimeout(() => setStep(2), 5000));
    timers.push(setTimeout(() => setStep(3), 12000));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ ...S.status, background: '#f5f0ff', borderColor: '#e2d8f5' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ ...S.statusItem, opacity: i <= step ? 1 : 0, transform: i <= step ? 'translateY(0)' : 'translateY(8px)', transition: 'all .4s' }}>
          <span style={{ ...S.dot, background: i < step ? '#22c55e' : '#7c5cfc', animation: i === step ? 'pulse 1.5s ease infinite' : 'none' }} />
          {s}
        </div>
      ))}
      {step >= 2 && (
        <div style={{ paddingLeft: 18, fontSize: 12, color: '#999', marginTop: 4 }}>
          identifying components · building structure · inlining styles · adding responsive toggle
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

/* ── AI success — real HTML preview ── */
function AIResult({ host, html, sizeKB, toast }) {
  const [view, setView] = useState('desktop');

  const handleDownload = () => {
    const filename = `ai-snapshot-${host.replace(/[^a-z0-9]/gi, '-')}.html`;
    downloadHTML(html, filename);
    toast('Downloaded ' + filename);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      toast('HTML copied to clipboard!');
    } catch {
      toast('Copy failed — try download instead.');
    }
  };

  return (
    <>
      <StatusCard variant="purple" steps={[
        `Fetched ${host}`,
        'Extracted design system — colors, fonts, layout',
        'AI rebuilt the interface with working interactions',
        `AI snapshot complete — ${sizeKB}KB with responsive toggle ✓`,
      ]} />
      <div style={S.preview}>
        <div style={S.previewBar}>
          <div style={S.dots}><span style={{ ...S.dotC, background: '#ff6b6b' }} /><span style={{ ...S.dotC, background: '#fbbf24' }} /><span style={{ ...S.dotC, background: '#22c55e' }} /></div>
          <span style={S.previewTitle}>AI snapshot — {host}</span>
          <div style={S.toggle}>
            <button style={{ ...S.toggleBtn, ...(view === 'desktop' ? S.toggleActive : {}) }} onClick={() => setView('desktop')}>Desktop</button>
            <button style={{ ...S.toggleBtn, ...(view === 'mobile' ? S.toggleActive : {}) }} onClick={() => setView('mobile')}>Mobile</button>
          </div>
        </div>
        <div style={{ ...S.frame, height: 420, ...(view === 'mobile' ? { maxWidth: 390, margin: '0 auto', height: 500 } : {}) }}>
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none' }}
            sandbox="allow-same-origin allow-scripts"
            title={`AI Snapshot of ${host}`}
          />
        </div>
      </div>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={handleDownload}>↓ DOWNLOAD HTML</button>
        <button style={S.btnGhost} onClick={handleCopy}>COPY TO CLIPBOARD</button>
      </div>
    </>
  );
}

/* ── Free success — real HTML preview ── */
function FreeResult({ host, html, sizeKB, toast, onUpgrade }) {
  const [view, setView] = useState('desktop');

  const handleDownload = () => {
    const filename = `snapshot-${host.replace(/[^a-z0-9]/gi, '-')}.html`;
    downloadHTML(html, filename);
    toast('Downloaded ' + filename);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      toast('HTML copied to clipboard!');
    } catch {
      toast('Copy failed — try download instead.');
    }
  };

  return (
    <>
      <StatusCard variant="green" steps={[
        `Fetched ${host}`,
        'Stripped scripts & tracking pixels',
        `Snapshot ready — ${sizeKB}KB single file ✓`,
      ]} />
      <div style={S.preview}>
        <div style={S.previewBar}>
          <div style={S.dots}><span style={{ ...S.dotC, background: '#ff6b6b' }} /><span style={{ ...S.dotC, background: '#fbbf24' }} /><span style={{ ...S.dotC, background: '#22c55e' }} /></div>
          <span style={S.previewTitle}>snapshot — {host}</span>
          <div style={S.toggle}>
            <button style={{ ...S.toggleBtn, ...(view === 'desktop' ? S.toggleActive : {}) }} onClick={() => setView('desktop')}>Desktop</button>
            <button style={{ ...S.toggleBtn, ...(view === 'mobile' ? S.toggleActive : {}) }} onClick={() => setView('mobile')}>Mobile</button>
          </div>
        </div>
        <div style={{ ...S.frame, ...(view === 'mobile' ? { maxWidth: 390, margin: '0 auto', height: 500 } : {}) }}>
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none' }}
            sandbox="allow-same-origin"
            title={`Snapshot of ${host}`}
          />
        </div>
      </div>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={handleDownload}>↓ DOWNLOAD HTML</button>
        <button style={S.btnGhost} onClick={handleCopy}>COPY TO CLIPBOARD</button>
      </div>
      <div style={S.enhance}>
        <div>
          <h3 style={S.enhTitle}>This is the basic version ⚡</h3>
          <p style={S.enhDesc}>It captured the content. AI mode would also match exact fonts, add working links, and include a responsive mobile view.</p>
        </div>
        <button style={S.enhBtn} onClick={onUpgrade}>UPGRADE TO AI — 1 CREDIT →</button>
      </div>
    </>
  );
}

/* ── HN mock result (kept for demo/examples) ── */
function HNResult({ host, toast, onUpgrade }) {
  return (
    <>
      <StatusCard variant="green" steps={[
        `Fetched ${host} — 14KB HTML`,
        'Stripped 2 scripts',
        'Inlined 1 stylesheet — 4KB',
        'Snapshot ready — 11KB single file ✓',
      ]} />
      <PreviewCard title={`snapshot — ${host}`}>
        <HNMock />
      </PreviewCard>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={() => toast('Downloaded snapshot.html')}>↓ DOWNLOAD HTML</button>
        <button style={S.btnGhost} onClick={() => toast('Copied!')}>COPY TO CLIPBOARD</button>
        <button style={S.btnGhost}>VIEW SOURCE</button>
      </div>
      <div style={S.enhance}>
        <div>
          <h3 style={S.enhTitle}>This is the basic version ⚡</h3>
          <p style={S.enhDesc}>It captured the content well. AI mode would also match exact fonts, add working links, and include a responsive mobile view.</p>
        </div>
        <button style={S.enhBtn} onClick={onUpgrade}>UPGRADE TO AI — 1 CREDIT →</button>
      </div>
    </>
  );
}

function LinearResult({ blocked, host, onDismiss, toast }) {
  return (
    <>
      <PreviewCard title={`snapshot — ${host}${blocked ? '' : ' (limited)'}`}>
        <div style={S.linWrap}>
          <LinearMock />
          {blocked && (
            <div style={S.blockedOverlay}>
              <div style={S.stamp}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
                <div style={S.stampTitle}>Free mode can't capture this accurately</div>
                <div style={S.stampDesc}>{host} is a JavaScript app — the free snapshot only grabs an empty shell. AI mode reads the page like a real browser and rebuilds the full interface.</div>
                <button style={S.stampBtn} onClick={onDismiss}>LET ME SEE ANYWAY →</button>
              </div>
            </div>
          )}
        </div>
      </PreviewCard>
    </>
  );
}

function LinearAIResult({ host, toast }) {
  return (
    <>
      <StatusCard variant="purple" steps={[
        `Fetched ${host} — 890KB`,
        'Extracted — 22 colors, Inter font, sidebar+main layout',
        'Claude is rebuilding the interface...',
        'AI snapshot complete — 64KB with responsive toggle ✓',
      ]} />
      <PreviewCard title={`AI snapshot — ${host}`}>
        <LinearMock />
      </PreviewCard>
      <div style={S.actions}>
        <button style={S.btnPrimary} onClick={() => toast('Downloaded ai-snapshot.html')}>↓ DOWNLOAD HTML</button>
        <button style={S.btnGhost} onClick={() => toast('Copied!')}>COPY TO CLIPBOARD</button>
        <button style={S.btnGhost}>VIEW SOURCE</button>
      </div>
    </>
  );
}

function PreviewCard({ title, children }) {
  const [view, setView] = useState('desktop');
  return (
    <div style={S.preview}>
      <div style={S.previewBar}>
        <div style={S.dots}><span style={{ ...S.dotC, background: '#ff6b6b' }} /><span style={{ ...S.dotC, background: '#fbbf24' }} /><span style={{ ...S.dotC, background: '#22c55e' }} /></div>
        <span style={S.previewTitle}>{title}</span>
        <div style={S.toggle}>
          <button style={{ ...S.toggleBtn, ...(view === 'desktop' ? S.toggleActive : {}) }} onClick={() => setView('desktop')}>Desktop</button>
          <button style={{ ...S.toggleBtn, ...(view === 'mobile' ? S.toggleActive : {}) }} onClick={() => setView('mobile')}>Mobile</button>
        </div>
      </div>
      <div style={{ ...S.frame, ...(view === 'mobile' ? { maxWidth: 390, margin: '0 auto', height: 500 } : {}) }}>
        {children}
      </div>
    </div>
  );
}

function HNMock() {
  return (
    <div style={S.hn}>
      <div style={S.hnBar}><span style={S.hnY}>Y</span><span style={S.hnBold}>Hacker News</span><span style={S.hnLinks}>new | past | comments | ask | show | jobs</span></div>
      <div style={S.hnItems}>
        {HN.map((h, i) => (
          <div key={i} style={S.hnItem}>
            <span style={S.hnRank}>{i + 1}.</span>
            <div><div style={S.hnTitle}>{h.title}</div><div style={S.hnMeta}>{h.meta}</div></div>
          </div>
        ))}
      </div>
      <div style={S.hnFoot}>Guidelines | FAQ | Lists | API | Security | Legal | Apply to YC</div>
    </div>
  );
}

function LinearMock() {
  return (
    <div style={S.lin}>
      <div style={S.linSide}>
        <div style={S.linLogo}><span style={S.linLogoIcon}>L</span> Linear</div>
        {['My Issues', 'Active', 'Backlog', 'Projects', 'Views', 'Teams'].map((item, i) => (
          <div key={i} style={{ ...S.linSideItem, ...(i === 0 ? { color: '#fff', background: '#2a2a35' } : {}) }}>{item}</div>
        ))}
      </div>
      <div style={S.linMain}>
        <div style={S.linHead}>My Issues <span style={S.linCount}>12</span></div>
        {ISSUES.map((iss, i) => (
          <div key={i} style={S.linIssue}>
            <div style={{ ...S.linPri, ...(iss.pri === 'urgent' ? { borderColor: '#f97316', background: 'rgba(249,115,22,.15)' } : iss.pri === 'high' ? { borderColor: '#eab308', background: 'rgba(234,179,8,.1)' } : iss.pri === 'med' ? { borderColor: '#3b82f6', background: 'rgba(59,130,246,.1)' } : {}) }} />
            <span style={S.linId}>{iss.id}</span>
            <span style={S.linT}>{iss.title}</span>
            <span style={S.linTag}>{iss.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const HN = [
  { title: 'Show HN: I built a tool to freeze any website into one HTML file', meta: '142 points · 3 hours ago · 87 comments' },
  { title: 'Why SQLite is the most deployed database in the world', meta: '298 points · 6 hours ago · 194 comments' },
  { title: 'The Unreasonable Effectiveness of Plain Text', meta: '187 points · 4 hours ago · 112 comments' },
  { title: 'Ask HN: What are you working on this weekend?', meta: '94 points · 2 hours ago · 203 comments' },
  { title: 'A visual guide to CSS Grid in 2026', meta: '156 points · 5 hours ago · 67 comments' },
  { title: 'Rust vs Go for backend services: a practical comparison', meta: '211 points · 7 hours ago · 289 comments' },
  { title: 'How I built a SaaS in 30 days with no funding', meta: '134 points · 4 hours ago · 98 comments' },
  { title: 'The architecture of a one-person startup', meta: '267 points · 8 hours ago · 178 comments' },
];

const ISSUES = [
  { id: 'LIN-482', title: 'Fix auth redirect loop on mobile Safari', tag: 'Bug', pri: 'urgent' },
  { id: 'LIN-479', title: 'Add dark mode support to settings page', tag: 'Feature', pri: 'high' },
  { id: 'LIN-476', title: 'Update onboarding flow copy', tag: 'Improvement', pri: 'med' },
  { id: 'LIN-471', title: 'Migrate analytics to PostHog', tag: 'Task', pri: '' },
  { id: 'LIN-468', title: 'Review Q2 roadmap priorities', tag: 'Task', pri: '' },
  { id: 'LIN-465', title: 'Keyboard shortcuts not firing in Firefox', tag: 'Bug', pri: 'high' },
];

const S = {
  section: { maxWidth: 1200, margin: '0 auto', padding: '0 40px 40px' },
  status: { borderRadius: 16, padding: '20px 24px', marginBottom: 20, border: '2px solid' },
  statusItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, color: '#333' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  preview: { background: '#fff', border: '2px solid #eee', borderRadius: 20, overflow: 'hidden', marginBottom: 20, boxShadow: '0 4px 24px rgba(0,0,0,.04)' },
  previewBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #eee' },
  dots: { display: 'flex', gap: 5 },
  dotC: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  previewTitle: { flex: 1, fontSize: 12, color: '#999', fontWeight: 500 },
  toggle: { display: 'flex', gap: 4 },
  toggleBtn: { background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#999', fontFamily: 'inherit' },
  toggleActive: { background: '#1a1a1a', color: '#fff' },
  frame: { height: 340, background: '#fafafa', overflow: 'hidden', transition: 'all .3s' },
  actions: { display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  btnPrimary: { background: '#1a1a1a', color: '#fff', border: '2px solid #1a1a1a', borderRadius: 50, padding: '12px 24px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '-.2px' },
  btnGhost: { background: '#fff', color: '#1a1a1a', border: '2px solid #ddd', borderRadius: 50, padding: '12px 24px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '-.2px' },
  enhance: { background: 'linear-gradient(135deg,#f0e6ff 0%,#e6f0ff 50%,#f0fdf4 100%)', border: '2px solid #e2d8f5', borderRadius: 20, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  enhTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: '-.5px' },
  enhDesc: { fontSize: 13, color: '#666', lineHeight: 1.5 },
  enhBtn: { background: '#7c5cfc', color: '#fff', border: 'none', borderRadius: 50, padding: '14px 28px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-.3px', flexShrink: 0 },
  hn: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontSize: 11, background: '#f6f6ef', color: '#333', overflow: 'hidden' },
  hnBar: { background: '#ff6600', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 },
  hnY: { color: '#fff', fontSize: 10, fontWeight: 700 },
  hnBold: { color: '#fff', fontSize: 10, fontWeight: 700 },
  hnLinks: { color: '#000', fontSize: 9, opacity: .7 },
  hnItems: { padding: '4px 8px', flex: 1, overflow: 'hidden' },
  hnItem: { padding: '3px 0', display: 'flex', gap: 6, borderBottom: '1px solid #e8e8df' },
  hnRank: { color: '#999', minWidth: 18, textAlign: 'right', fontSize: 10 },
  hnTitle: { color: '#000', fontWeight: 500, fontSize: 10 },
  hnMeta: { color: '#999', fontSize: 8, marginTop: 1 },
  hnFoot: { padding: '4px 8px', fontSize: 7, color: '#999', borderTop: '1px solid #e8e8df' },
  linWrap: { width: '100%', height: '100%', position: 'relative' },
  lin: { width: '100%', height: '100%', display: 'flex', fontSize: 11, background: '#19181f', color: '#e0e0e0', overflow: 'hidden' },
  linSide: { width: 170, background: '#131219', padding: 12, borderRight: '1px solid #2a2a35', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  linSideItem: { padding: '6px 8px', borderRadius: 6, fontSize: 10, color: '#888' },
  linLogo: { fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  linLogoIcon: { width: 18, height: 18, background: '#5e5ce6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' },
  linMain: { flex: 1, padding: 16, display: 'flex', flexDirection: 'column' },
  linHead: { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
  linCount: { background: '#2a2a35', color: '#888', padding: '2px 8px', borderRadius: 50, fontSize: 10 },
  linIssue: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #1f1e26', fontSize: 11 },
  linPri: { width: 14, height: 14, border: '1.5px solid #555', borderRadius: 3, flexShrink: 0 },
  linId: { color: '#555', fontSize: 9, minWidth: 48 },
  linT: { color: '#d0d0d0', flex: 1 },
  linTag: { fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#2a2a35', color: '#888' },
  blockedOverlay: { position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(3px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 },
  stamp: { background: '#fff', border: '2px solid #fde68a', borderRadius: 20, padding: '28px 36px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.08)', maxWidth: 380, transform: 'rotate(-2deg)' },
  stampTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 6, color: '#92400e' },
  stampDesc: { fontSize: 12, color: '#999', lineHeight: 1.5, marginBottom: 16 },
  stampBtn: { background: '#7c5cfc', color: '#fff', border: 'none', borderRadius: 50, padding: '12px 28px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '-.3px' },
};

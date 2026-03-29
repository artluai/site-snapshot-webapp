import { useState } from 'react';

export default function InputCard({ mode, onModeChange, onSnapshot }) {
  const [url, setUrl] = useState('');
  const [desktopFile, setDesktopFile] = useState(null);
  const [mobileFile, setMobileFile] = useState(null);

  const handleSubmit = () => {
    if (mode === 'upload') {
      onSnapshot({
        files: [
          desktopFile ? { slot: 'desktop', blob: desktopFile } : null,
          mobileFile ? { slot: 'mobile', blob: mobileFile } : null,
        ].filter(Boolean),
      });
      return;
    }

    onSnapshot({ url });
  };
  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  const tryHN = () => {
    setUrl('https://news.ycombinator.com');
    onSnapshot({ url: 'https://news.ycombinator.com', exampleType: 'blog' });
  };
  const tryLinear = () => {
    setUrl('https://linear.app');
    onSnapshot({ url: 'https://linear.app', exampleType: 'spa' });
  };

  const primaryButtonLabel = mode === 'ai'
    ? 'START AI JOB →'
    : mode === 'upload'
      ? 'UPLOAD + START JOB →'
      : 'SAVE COPY →';

  return (
    <section style={S.section} className="input-section" id="input-section">
      <div style={S.card} className="input-card">
        <div style={S.label}>PASTE A PAGE LINK TO GET STARTED</div>

        {mode !== 'upload' && (
          <div style={S.row} className="input-row">
            <input style={S.field} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey} placeholder="https://any-website.com" />
            <button style={S.snap} className="snap-btn" onClick={handleSubmit}>{primaryButtonLabel}</button>
          </div>
        )}

        {mode === 'upload' && (
          <>
            <div style={S.uploadGrid} className="upload-grid">
              <label style={S.uploadCard}>
                <span style={S.uploadTitle}>Desktop screenshot</span>
                <span style={S.uploadHint}>Required. Best results: sharp full-width screenshot with readable text.</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" style={S.fileInput} onChange={(e) => setDesktopFile(e.target.files?.[0] || null)} />
                <span style={S.uploadFile}>{desktopFile ? desktopFile.name : 'Choose image'}</span>
              </label>
              <label style={S.uploadCard}>
                <span style={S.uploadTitle}>Mobile screenshot</span>
                <span style={S.uploadHint}>Optional. Add if you want the mobile layout copied more closely.</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" style={S.fileInput} onChange={(e) => setMobileFile(e.target.files?.[0] || null)} />
                <span style={S.uploadFile}>{mobileFile ? mobileFile.name : 'Choose image'}</span>
              </label>
            </div>
            <div style={S.uploadTips}>
              <strong style={{ color: '#1a1a1a' }}>Beta tips:</strong> screenshot mode works best on one page at a time, with crisp text and visible sections. Long pages are supported, but quality can still vary.
            </div>
            <div style={S.uploadWarning}>
              <strong style={{ color: '#7c2d12' }}>Credit warning:</strong> screenshot rebuild is still beta. Jobs use 1 credit even if the result needs manual cleanup or is only partially accurate.
            </div>
            <div style={S.uploadActions}>
              <button style={S.snap} className="snap-btn" onClick={handleSubmit}>UPLOAD + START JOB →</button>
            </div>
          </>
        )}

        <div style={S.modes} className="mode-chips">
          {MODES.map(m => (
            <button
              key={m.id}
              style={{
                ...S.chip,
                ...(mode === m.id ? S.chipActive : {}),
                ...(m.disabled ? S.chipDisabled : {}),
              }}
              onClick={() => m.disabled ? null : onModeChange(m.id)}
            >
              <span style={{ marginRight: 4 }}>{m.emoji}</span>
              {m.label}
              {m.disabled && <span style={S.soon}>SOON</span>}
            </button>
          ))}
        </div>

        <div style={S.modeDesc}>
          {mode === 'quick' && (
            <div>Quick mode fetches the page through our proxy, strips out scripts and junk, and gives you a simpler HTML file. <strong style={{ color: '#555' }}>Free, 1 per day.</strong></div>
          )}
          {mode === 'ai' && (
            <div>Worker-based AI job — loads the page in a real browser, saves the finished HTML as a file, and lets you preview or download it when ready. <strong style={{ color: '#555' }}>1 credit per snapshot.</strong></div>
          )}
          {mode === 'upload' && (
            <div>Screenshot rebuild <span style={S.betaInline}>BETA</span> — uploads images into storage, then the worker turns them into a durable HTML artifact. Best for simple landing pages and clear screenshots. <strong style={{ color: '#555' }}>1 credit per snapshot, even when the beta output needs cleanup.</strong></div>
          )}
        </div>

        <div style={S.freeGroup}>
          <div style={S.freeLabel}><span style={S.freeBadge}>⚡ FREE</span> These examples show where quick mode works well and where it does not</div>
          <div style={S.freeBody}>
            <div style={S.compatGrid} className="compat-grid">
              <div style={S.compatGood}>
                <div style={S.compatHead}>✅ Free mode works best on</div>
                <div style={S.compatItem}><span style={S.compatUrl}>news.ycombinator.com</span></div>
                <div style={S.compatItem}><span style={S.compatUrl}>craigslist.org</span></div>
                <div style={S.compatItem}><span style={S.compatUrl}>wikipedia.org</span></div>
                <div style={{ ...S.compatItem, fontStyle: 'italic', color: '#aaa' }}>blogs, docs, static sites</div>
              </div>
              <div style={S.compatNeeds}>
                <div style={{ ...S.compatHead, color: '#92400e' }}>⚠️ Often needs AI mode</div>
                <div style={S.compatItem}><span style={S.compatUrl}>linear.app</span></div>
                <div style={S.compatItem}><span style={S.compatUrl}>figma.com</span></div>
                <div style={S.compatItem}><span style={S.compatUrl}>notion.so</span></div>
                <div style={{ ...S.compatItem, fontStyle: 'italic', color: '#aaa' }}>dashboards, SPAs, React apps</div>
              </div>
            </div>
            <div style={S.exLabel}>Try an example</div>
            <div style={S.exGrid} className="example-grid">
              <div style={S.exCard} onClick={tryHN}>
                <div style={S.exTop}><span style={S.exBadgeFree}>⚡ FREE</span></div>
                <div style={S.exUrl}>news.ycombinator.com</div>
                <div style={S.exDesc}>Simple HTML page. Quick mode usually works well here.</div>
                <span style={S.exArrow}>→</span>
              </div>
              <div style={S.exCardSpa} onClick={tryLinear}>
                <div style={S.exTop}><span style={S.exBadgeAi}>🧠 NEEDS AI</span></div>
                <div style={S.exUrl}>linear.app</div>
                <div style={S.exDesc}>JavaScript app. See why free mode is limited here.</div>
                <span style={S.exArrow}>→</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const MODES = [
  { id: 'quick', emoji: '⚡', label: 'Free', disabled: false },
  { id: 'ai', emoji: '🧠', label: 'AI', disabled: false },
  { id: 'upload', emoji: '📸', label: 'AI + Screenshot Beta', disabled: false },
];

const S = {
  section: { maxWidth: 1200, margin: '0 auto', padding: '50px 40px' },
  card: { background: '#fff', border: '2px solid #eee', borderRadius: 20, padding: 36, boxShadow: '0 4px 24px rgba(0,0,0,.04)' },
  label: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 14, letterSpacing: '-.3px' },
  row: { display: 'flex', gap: 10 },
  field: { flex: 1, border: '2px solid #eee', borderRadius: 14, padding: '16px 20px', fontFamily: 'inherit', fontSize: 15, outline: 'none', color: '#1a1a1a' },
  snap: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 32px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-.3px' },
  uploadGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  uploadCard: { display: 'flex', flexDirection: 'column', gap: 8, border: '2px dashed #ddd', borderRadius: 16, padding: 20, cursor: 'pointer', background: '#fafafa' },
  uploadTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  uploadHint: { fontSize: 12, color: '#777', lineHeight: 1.4 },
  fileInput: { display: 'none' },
  uploadFile: { marginTop: 8, fontSize: 12, color: '#5b21b6', fontWeight: 600 },
  uploadTips: { marginTop: 12, fontSize: 12, color: '#777', lineHeight: 1.5, background: '#faf7ff', border: '1px solid #ece3ff', borderRadius: 12, padding: '10px 12px' },
  uploadWarning: { marginTop: 10, fontSize: 12, color: '#9a3412', lineHeight: 1.5, background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: '10px 12px' },
  uploadActions: { marginTop: 14, display: 'flex', justifyContent: 'flex-end' },
  modes: { display: 'flex', gap: 8, marginTop: 20 },
  chip: { background: '#f5f5f5', border: '2px solid transparent', borderRadius: 50, padding: '10px 20px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  chipActive: { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  chipDisabled: { opacity: 0.4, cursor: 'default', pointerEvents: 'none' },
  soon: { fontSize: 8, fontWeight: 700, background: '#7c5cfc', color: '#fff', padding: '2px 6px', borderRadius: 50, marginLeft: 4, letterSpacing: '.3px' },
  betaInline: { display: 'inline-block', fontSize: 10, fontWeight: 700, background: '#ede9fe', color: '#5b21b6', padding: '2px 6px', borderRadius: 999, margin: '0 6px 0 4px', verticalAlign: 'middle', letterSpacing: '.3px' },
  modeDesc: { fontSize: 13, color: '#999', marginTop: 12, lineHeight: 1.5 },
  freeGroup: { border: '2px solid #eee', borderRadius: 16, marginTop: 16, overflow: 'hidden' },
  freeLabel: { background: '#f8f8f8', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 6 },
  freeBadge: { background: '#1a1a1a', color: '#fff', fontSize: 9, padding: '2px 8px', borderRadius: 50, fontWeight: 700 },
  freeBody: { padding: 16 },
  compatGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 },
  compatGood: { padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #dcfce7' },
  compatNeeds: { padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fef3c7' },
  compatHead: { fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#166534' },
  compatItem: { fontSize: 11, color: '#666', marginBottom: 3 },
  compatUrl: { color: '#333', fontWeight: 500 },
  exLabel: { fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 },
  exGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  exCard: { padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: '1.5px solid #eee', position: 'relative' },
  exCardSpa: { padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: '1.5px solid #eee', position: 'relative' },
  exTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  exBadgeFree: { fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: '#dcfce7', color: '#166534', textTransform: 'uppercase', letterSpacing: '.3px' },
  exBadgeAi: { fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: '#ede9fe', color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '.3px' },
  exUrl: { fontSize: 13, fontWeight: 600, color: '#333' },
  exDesc: { fontSize: 11, color: '#999', lineHeight: 1.3 },
  exArrow: { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#ccc', fontSize: 14 },
};

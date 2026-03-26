import { useState } from 'react';

export default function InputCard({ mode, onModeChange, onSnapshot, onRequireAuth, loading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = () => { if (!loading) onSnapshot(url); };
  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  const tryHN = () => {
    setUrl('https://news.ycombinator.com');
    onRequireAuth(() => onSnapshot('https://news.ycombinator.com', 'blog'));
  };
  const tryLinear = () => {
    setUrl('https://linear.app');
    onRequireAuth(() => onSnapshot('https://linear.app', 'spa'));
  };

  return (
    <section style={S.section} className="input-section" id="input-section">
      <div style={S.card} className="input-card">
        <div style={S.label}>PASTE A LINK TO GET STARTED</div>

        {mode !== 'upload' && (
          <div style={S.row} className="input-row">
            <input style={S.field} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey} placeholder="https://any-website.com" />
            <button
              style={{ ...S.snap, ...(loading ? { opacity: .5, pointerEvents: 'none' } : {}) }}
              className="snap-btn"
              onClick={handleSubmit}
            >
              {loading ? 'CAPTURING...' : mode === 'ai' ? '🧠 AI SNAPSHOT →' : 'SAVE COPY →'}
            </button>
          </div>
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
          {mode === 'quick' && <div>Instant basic copy — grabs the page, strips out junk, gives you a clean file. <strong style={{ color: '#555' }}>Free, 1 per day.</strong></div>}
          {mode === 'ai' && <div>Pro capture — a real browser visits the page, renders everything including JavaScript, and saves a perfect copy. <strong style={{ color: '#555' }}>1 credit per snapshot.</strong><div style={S.creditNote}>5 credits for $9.99 · 20 credits for $29.99</div></div>}
          {mode === 'upload' && <div>No link? Drop screenshots. AI rebuilds the site from images. <strong style={{ color: '#555' }}>Coming soon.</strong></div>}
        </div>

        {/* Free group — compat grid + examples */}
        {mode !== 'upload' && (
          <div style={{ ...S.freeGroup, ...(mode !== 'quick' ? S.freeGroupDimmed : {}) }}>
            <div style={S.freeLabel}><span style={S.freeBadge}>⚡ FREE</span> These examples and limits apply to the free tier</div>
            <div style={S.freeBody}>
              <div style={S.compatGrid} className="compat-grid">
                <div style={S.compatGood}>
                  <div style={S.compatHead}>✅ Works great on</div>
                  <div style={S.compatItem}><span style={S.compatUrl}>news.ycombinator.com</span></div>
                  <div style={S.compatItem}><span style={S.compatUrl}>craigslist.org</span></div>
                  <div style={S.compatItem}><span style={S.compatUrl}>wikipedia.org</span></div>
                  <div style={{ ...S.compatItem, fontStyle: 'italic', color: '#aaa' }}>blogs, docs, static sites</div>
                </div>
                <div style={S.compatNeeds}>
                  <div style={{ ...S.compatHead, color: '#92400e' }}>⚠️ Needs AI mode</div>
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
                  <div style={S.exDesc}>Simple HTML — free mode captures this perfectly</div>
                  <span style={S.exArrow}>→</span>
                </div>
                <div style={S.exCardSpa} onClick={tryLinear}>
                  <div style={S.exTop}><span style={S.exBadgeAi}>🧠 NEEDS AI</span></div>
                  <div style={S.exUrl}>linear.app</div>
                  <div style={S.exDesc}>React SPA — see what free mode misses</div>
                  <span style={S.exArrow}>→</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const MODES = [
  { id: 'quick', emoji: '⚡', label: 'Free', disabled: false },
  { id: 'ai', emoji: '🧠', label: 'AI', disabled: false },
  { id: 'upload', emoji: '📸', label: 'AI + Screenshot', disabled: true },
];

const S = {
  section: { maxWidth: 1200, margin: '0 auto', padding: '50px 40px' },
  card: { background: '#fff', border: '2px solid #eee', borderRadius: 20, padding: 36, boxShadow: '0 4px 24px rgba(0,0,0,.04)' },
  label: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 14, letterSpacing: '-.3px' },
  row: { display: 'flex', gap: 10 },
  field: { flex: 1, border: '2px solid #eee', borderRadius: 14, padding: '16px 20px', fontFamily: 'inherit', fontSize: 15, outline: 'none', color: '#1a1a1a' },
  snap: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 32px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-.3px' },
  modes: { display: 'flex', gap: 8, marginTop: 20 },
  chip: { background: '#f5f5f5', border: '2px solid transparent', borderRadius: 50, padding: '10px 20px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  chipActive: { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  chipDisabled: { opacity: 0.4, cursor: 'default', pointerEvents: 'none' },
  soon: { fontSize: 8, fontWeight: 700, background: '#7c5cfc', color: '#fff', padding: '2px 6px', borderRadius: 50, marginLeft: 4, letterSpacing: '.3px' },
  modeDesc: { fontSize: 13, color: '#999', marginTop: 12, lineHeight: 1.5 },
  creditNote: { marginTop: 8, fontSize: 12, color: '#7c5cfc', fontWeight: 600 },
  freeGroup: { border: '2px solid #eee', borderRadius: 16, marginTop: 16, overflow: 'hidden', transition: 'opacity .3s' },
  freeGroupDimmed: { opacity: .4, pointerEvents: 'none' },
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

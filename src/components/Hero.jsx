import { useEffect, useRef, useState } from 'react';

export default function Hero() {
  const [phase, setPhase] = useState('idle'); // idle, scanning, revealed
  const [urlText, setUrlText] = useState('snapshot — example.com');
  const timer = useRef(null);

  useEffect(() => {
    function cycle() {
      setPhase('idle');
      setUrlText('snapshot — example.com');
      setTimeout(() => {
        setUrlText('scanning — news.ycombinator.com');
        setPhase('scanning');
      }, 200);
      setTimeout(() => {
        setPhase('revealed');
        setUrlText('snapshot — news.ycombinator.com');
      }, 2600);
      timer.current = setTimeout(cycle, 7000);
    }
    cycle();
    return () => clearTimeout(timer.current);
  }, []);

  return (
    <section style={S.hero}>
      <div style={S.text}>
        <h1 style={S.h1}>
          <span style={S.mint}>SAVE</span> A COPY OF{' '}
          <span style={S.yellow}>ANY WEBSITE</span> IN SECONDS
        </h1>
        <p style={S.sub}>Paste a link. Get a perfect copy you can download, share, or keep forever. No install. Just paste and go.</p>
        <button style={S.cta} onClick={() => document.querySelector('#input-section')?.scrollIntoView({ behavior: 'smooth' })}>
          TRY IT FREE →
        </button>
      </div>
      <div style={S.visual}>
        <div style={S.browser}>
          <div style={S.bar}>
            <span style={{ ...S.dot, background: '#ff6b6b' }} />
            <span style={{ ...S.dot, background: '#fbbf24' }} />
            <span style={{ ...S.dot, background: '#22c55e' }} />
            <div style={S.urlBar}>{urlText}</div>
          </div>
          <div style={S.body}>
            {/* scan line */}
            <div style={{
              ...S.scanLine,
              opacity: phase === 'scanning' ? 1 : 0,
              animation: phase === 'scanning' ? 'scanDown 2.2s ease-in-out forwards' : 'none',
            }} />
            {/* placeholder */}
            <div style={{ ...S.before, opacity: phase === 'idle' ? 1 : 0 }}>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                <div>your copy previews here</div>
              </div>
            </div>
            {/* HN content */}
            <div style={{
              ...S.after,
              clipPath: phase === 'revealed' ? 'inset(0)' : phase === 'scanning' ? undefined : 'inset(0 0 100% 0)',
              animation: phase === 'scanning' ? 'reveal 2.2s ease-in-out forwards' : 'none',
            }}>
              <div style={S.hnBar}><span style={S.hnY}>Y</span><span style={S.hnTitle}>Hacker News</span><span style={S.hnLinks}>new | past | comments</span></div>
              {HN_ITEMS.map((item, i) => (
                <div key={i} style={S.hnItem}>
                  <b style={{ color: '#000', fontWeight: 500, fontSize: 9 }}>{i + 1}. {item.title}</b>
                  <div style={{ color: '#999', fontSize: 7, marginTop: 1 }}>{item.meta}</div>
                </div>
              ))}
              <div style={S.hnFoot}>Guidelines | FAQ | API | Security | Apply to YC</div>
            </div>
          </div>
        </div>
        <div style={{ ...S.tag, top: 20, right: 20, animation: 'fl1 3s ease-in-out infinite' }}>ONE FILE ✓</div>
        <div style={{ ...S.tag, bottom: 20, left: 20, background: '#7c5cfc', transform: 'rotate(-3deg)', animation: 'fl2 3.5s ease-in-out infinite' }}>WORKS OFFLINE ⚡</div>
        <div style={{ ...S.tag, bottom: 60, right: 30, background: '#ff6b6b', transform: 'rotate(2deg)', animation: 'fl3 4s ease-in-out infinite' }}>FREE TO START</div>
        <style>{`
          @keyframes scanDown{0%{top:0;opacity:0}8%{opacity:1}92%{opacity:1}100%{top:calc(100% - 4px);opacity:0}}
          @keyframes reveal{0%{clip-path:inset(0 0 100% 0)}100%{clip-path:inset(0 0 0% 0)}}
          @keyframes fl1{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
          @keyframes fl2{0%,100%{transform:rotate(-3deg) translateY(0)}50%{transform:rotate(-3deg) translateY(-8px)}}
          @keyframes fl3{0%,100%{transform:rotate(2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-5px)}}
        `}</style>
      </div>
    </section>
  );
}

const HN_ITEMS = [
  { title: 'Show HN: I built a tool to freeze any website', meta: '142 pts · 3h ago · 87 comments' },
  { title: 'Why SQLite is the most deployed database', meta: '298 pts · 6h ago · 194 comments' },
  { title: 'The Unreasonable Effectiveness of Plain Text', meta: '187 pts · 4h ago · 112 comments' },
  { title: 'Ask HN: What are you working on?', meta: '94 pts · 2h ago · 203 comments' },
  { title: 'A visual guide to CSS Grid in 2026', meta: '156 pts · 5h ago · 67 comments' },
  { title: 'Rust vs Go for backend services', meta: '211 pts · 7h ago · 289 comments' },
];

const S = {
  hero: { maxWidth: 1200, margin: '0 auto', padding: '40px 40px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center', minHeight: 480 },
  text: {},
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3, marginBottom: 16 },
  mint: { background: '#c4f5e1', padding: '0 8px', borderRadius: 6, display: 'inline' },
  yellow: { background: '#fef3a0', padding: '0 8px', borderRadius: 6, display: 'inline' },
  sub: { fontSize: 18, color: '#666', lineHeight: 1.6, marginBottom: 28, maxWidth: 440 },
  cta: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 14, padding: '18px 36px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, cursor: 'pointer', letterSpacing: '-.3px' },
  visual: { background: '#c4f5e1', borderRadius: 24, padding: 32, position: 'relative', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  browser: { background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.08)', width: '100%', maxWidth: 420, overflow: 'hidden', position: 'relative' },
  bar: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #eee' },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  urlBar: { flex: 1, background: '#f5f5f5', borderRadius: 6, padding: '6px 12px', fontSize: 11, color: '#999', marginLeft: 8 },
  body: { position: 'relative', minHeight: 220, background: '#fafafa', overflow: 'hidden' },
  scanLine: { position: 'absolute', top: 0, left: 0, width: '100%', height: 4, background: 'linear-gradient(90deg,transparent 0%,#4ade80 20%,#4ade80 80%,transparent 100%)', zIndex: 20, boxShadow: '0 0 24px rgba(74,222,128,.8), 0 0 80px rgba(74,222,128,.4)', transition: 'opacity .3s' },
  before: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', zIndex: 6, transition: 'opacity .6s', pointerEvents: 'none' },
  after: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', fontSize: 10, background: '#f6f6ef', color: '#333', zIndex: 5 },
  hnBar: { background: '#ff6600', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 },
  hnY: { color: '#fff', fontSize: 9, fontWeight: 700 },
  hnTitle: { color: '#fff', fontSize: 9, fontWeight: 700 },
  hnLinks: { color: '#000', fontSize: 8, opacity: .6 },
  hnItem: { padding: '3px 8px', borderBottom: '1px solid #e8e8df' },
  hnFoot: { padding: '3px 8px', fontSize: 7, color: '#bbb', marginTop: 'auto' },
  tag: { position: 'absolute', background: '#1a1a1a', color: '#fff', fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 50, letterSpacing: '.3px', cursor: 'default' },
};

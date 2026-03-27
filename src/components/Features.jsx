export default function Features() {
  return (
    <section style={S.section} className="feat-section">
      <div style={S.inner}>
        <h2 style={S.h2} className="feat-title">SAVE IT. SHARE IT.<br /><span style={S.purple}>KEEP IT FOREVER.</span></h2>
        <div style={S.grid} className="feat-grid">
          {FEATS.map((f, i) => (
            <div key={i} style={S.card}>
              <div style={S.emoji}>{f.emoji}</div>
              <div style={S.title}>{f.title}</div>
              <div style={S.desc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATS = [
  { emoji: '📄', title: "ONE FILE, THAT'S IT", desc: 'Your copy is a single file. Open it in any browser, email it, save it to your desktop. It just works.' },
  { emoji: '📱', title: 'DESKTOP & MOBILE', desc: 'Built-in switcher lets you preview how the site looks on phone vs. computer. Both views in one file.' },
  { emoji: '🗂️', title: 'KEEPS ALL THE PAGES', desc: "Tabs, menus, dropdowns — everything clickable stays clickable in your copy. Not just a screenshot." },
  { emoji: '🎨', title: 'LOOKS IDENTICAL', desc: 'AI mode matches the exact colors, fonts, and spacing. Your copy looks like the real thing.' },
  { emoji: '📸', title: 'NO LINK? SCREENSHOT IT (BETA)', desc: 'Drop a desktop and mobile screenshot. AI rebuilds the page from images. Works best on clear landing pages and readable screenshots.' },
  { emoji: '🔒', title: 'PRIVATE & FREE', desc: 'Quick mode runs entirely on your device. Nothing leaves your browser. AI mode is optional.' },
];

const S = {
  section: { background: '#1a1a1a', color: '#fff', padding: '60px 40px', marginTop: 40 },
  inner: { maxWidth: 1200, margin: '0 auto' },
  h2: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: -2, marginBottom: 32, lineHeight: 1.1 },
  purple: { color: '#c4b5fd' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  card: { background: '#2a2a2a', borderRadius: 16, padding: 24 },
  emoji: { fontSize: 28, marginBottom: 10 },
  title: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-.3px' },
  desc: { fontSize: 13, color: '#999', lineHeight: 1.5 },
};

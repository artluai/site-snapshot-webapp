export default function Pricing({ onBuy }) {
  return (
    <section style={S.section} id="pricing">
      <div style={S.header}>
        <h2 style={S.h2}>SIMPLE PRICING</h2>
        <p style={S.sub}>Free mode is free forever. AI credits never expire.</p>
      </div>
      <div style={S.grid}>
        {TIERS.map((t, i) => (
          <div key={i} style={{ ...S.card, ...(t.featured ? S.featured : {}) }}>
            {t.badge && <div style={S.badge}>{t.badge}</div>}
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.emoji}</div>
            <div style={S.name}>{t.name}</div>
            <div style={S.price}>{t.price}<span style={S.cents}>{t.cents || ''}</span></div>
            <div style={S.perUnit}>{t.perUnit}</div>
            <div style={S.features}>
              {t.features.map((f, j) => (
                <div key={j} style={f.no ? { color: '#ccc' } : {}}>{f.no ? '✗' : '✓'} {f.text}</div>
              ))}
            </div>
            {t.btnText && (
              <button style={{ ...S.btn, ...(t.featured ? S.btnPurple : S.btnDark) }} onClick={() => onBuy(t.credits)}>
                {t.btnText}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const TIERS = [
  {
    emoji: '⚡', name: 'FREE', price: '$0', perUnit: '1 basic snapshot per day',
    features: [
      { text: 'Instant results' }, { text: 'Clean single-file output' }, { text: 'Runs in your browser' },
      { text: 'No AI analysis', no: true }, { text: 'No responsive toggle', no: true }, { text: "Won't work on SPAs", no: true },
    ],
  },
  {
    emoji: '🧠', name: 'STARTER', price: '$9', cents: '.99', perUnit: '5 AI credits · $2 each',
    featured: true, badge: 'MOST POPULAR', credits: 5, btnText: 'GET 5 CREDITS →',
    features: [
      { text: 'Everything in Free' }, { text: 'AI design analysis' }, { text: 'Responsive desktop/mobile' },
      { text: 'Working tabs & navigation' }, { text: 'Screenshot rebuild' }, { text: 'Credits never expire' },
    ],
  },
  {
    emoji: '🚀', name: 'PRO PACK', price: '$29', cents: '.99', perUnit: '20 AI credits · $1.50 each',
    credits: 20, btnText: 'GET 20 CREDITS →',
    features: [
      { text: 'Everything in Starter' }, { text: '4× more credits' }, { text: '25% cheaper per snapshot' },
      { text: 'Priority processing' }, { text: 'Credits never expire' }, { text: 'Rebuild from screenshots' },
    ],
  },
];

const S = {
  section: { maxWidth: 1200, margin: '0 auto', padding: '50px 40px' },
  header: { textAlign: 'center', marginBottom: 32 },
  h2: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: -2, marginBottom: 8 },
  sub: { fontSize: 15, color: '#888' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 900, margin: '0 auto' },
  card: { background: '#fff', border: '2px solid #eee', borderRadius: 20, padding: '32px 24px', textAlign: 'center', position: 'relative' },
  featured: { borderColor: '#7c5cfc', boxShadow: '0 4px 24px rgba(124,92,252,.12)' },
  badge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#7c5cfc', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 50, letterSpacing: '.5px', whiteSpace: 'nowrap' },
  name: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 },
  price: { fontSize: 32, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 },
  cents: { fontSize: 18, color: '#888' },
  perUnit: { fontSize: 13, color: '#999', marginBottom: 20 },
  features: { fontSize: 12, color: '#666', lineHeight: 1.8, textAlign: 'left' },
  btn: { marginTop: 20, width: '100%', border: 'none', borderRadius: 50, padding: 12, fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnPurple: { background: '#7c5cfc', color: '#fff' },
  btnDark: { background: '#1a1a1a', color: '#fff' },
};

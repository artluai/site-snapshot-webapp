export default function Pricing({ user, loadingPack, onBuy }) {
  return (
    <section style={S.section} className="pricing-section" id="pricing">
      <div style={S.header}>
        <h2 style={S.h2}>SIMPLE PRICING</h2>
        <p style={S.sub}>Free mode is for simpler pages. AI credits power worker-based snapshots and screenshot rebuilds.</p>
      </div>
      <div style={S.grid} className="pricing-grid">
        {TIERS.map((t, i) => (
          <div key={i} style={{ ...S.card, ...(t.featured ? S.featured : {}) }}>
            {t.badge && <div style={S.badge}>{t.badge}</div>}
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.emoji}</div>
            <div style={S.name}>{t.name}</div>
            <div style={S.price}>{t.price}{t.cents && <span style={S.cents}>{t.cents}</span>}</div>
            <div style={S.perUnit}>{t.perUnit}</div>
            <div style={S.features}>
              {t.features.map((f, j) => (
                <div key={j} style={f.no ? { color: '#ccc' } : {}}>{f.no ? '✗' : '✓'} {f.text}</div>
              ))}
            </div>
            {t.btnText && (
              <button
                style={{
                  ...S.btn,
                  ...(t.featured ? S.btnPurple : S.btnDark),
                  opacity: loadingPack === t.pack ? 0.75 : 1,
                  cursor: loadingPack === t.pack ? 'wait' : 'pointer',
                }}
                onClick={() => onBuy?.(t.pack)}
                disabled={loadingPack === t.pack}
              >
                {loadingPack === t.pack ? 'OPENING CHECKOUT...' : (user ? t.btnText : 'SIGN IN TO BUY')}
              </button>
            )}
          </div>
        ))}
      </div>
      <p style={S.note}>
        AI jobs cost 1 credit each. Failed AI jobs should return the reserved credit automatically. Screenshot rebuild is still beta and may need cleanup even when a job succeeds.
      </p>
    </section>
  );
}

const TIERS = [
  {
    emoji: '⚡', name: 'FREE', price: '$0', perUnit: '1 basic snapshot per day',
    features: [
      { text: 'No sign-in required for the first free try' }, { text: 'Clean single-file output' }, { text: 'Best on simpler pages' },
      { text: 'No AI worker capture', no: true }, { text: 'No screenshot rebuild', no: true }, { text: 'Limited on JavaScript-heavy pages', no: true },
    ],
  },
  {
    emoji: '🧠', name: 'STARTER', price: '$9', cents: '.99', perUnit: '4 AI credits · $2.50 each',
    featured: true, badge: 'MOST POPULAR', pack: 'starter', credits: 4, btnText: 'GET 4 CREDITS →',
    features: [
      { text: 'Everything in Free' }, { text: 'Browser-based worker capture' }, { text: 'Durable HTML file with preview/download' },
      { text: 'Better on JavaScript-heavy pages' }, { text: 'Screenshot rebuild (beta)' }, { text: 'Failed jobs refund the credit' },
    ],
  },
  {
    emoji: '🚀', name: 'PRO PACK', price: '$29', cents: '.99', perUnit: '15 AI credits · $2 each',
    pack: 'pro', credits: 15, btnText: 'GET 15 CREDITS →',
    features: [
      { text: 'Everything in Starter' }, { text: '15 credits up front' }, { text: 'Lower cost per snapshot' },
      { text: 'Best for repeated use' }, { text: 'Credits currently do not expire' }, { text: 'Includes screenshot rebuild beta' },
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
  btn: { marginTop: 20, width: '100%', border: 'none', borderRadius: 50, padding: 12, fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700 },
  btnPurple: { background: '#7c5cfc', color: '#fff' },
  btnDark: { background: '#1a1a1a', color: '#fff' },
  note: { maxWidth: 900, margin: '18px auto 0', fontSize: 12, color: '#777', lineHeight: 1.6, textAlign: 'center' },
};

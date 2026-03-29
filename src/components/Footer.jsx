const FOOTER_LINKS = [
  { key: 'privacy', label: 'privacy', href: import.meta.env.VITE_PRIVACY_URL || '' },
  { key: 'terms', label: 'terms', href: import.meta.env.VITE_TERMS_URL || '' },
  { key: 'contact', label: 'contact', href: import.meta.env.VITE_CONTACT_URL || '' },
].filter((item) => item.href);

export default function Footer() {
  return (
    <div style={S.footer} className="footer-bar">
      <div style={S.left}>
        <span>built with the <a href="#" style={S.link}>site-snapshot</a> Claude skill</span>
        <span>hosted checkout by Stripe</span>
      </div>
      <div style={S.right}>
        {FOOTER_LINKS.length > 0 && (
          <span style={S.links}>
            {FOOTER_LINKS.map((item, index) => (
              <span key={item.key}>
                {index > 0 ? ' · ' : ''}
                <a href={item.href} style={S.link} target="_blank" rel="noreferrer">{item.label}</a>
              </span>
            ))}
          </span>
        )}
        <span>by <a href="https://artlu.ai" style={S.link}>artlu.ai</a> — 100 projects in 100 days</span>
      </div>
    </div>
  );
}

const S = {
  footer: { maxWidth: 1200, margin: '0 auto', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, color: '#bbb' },
  left: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  right: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' },
  links: { color: '#999' },
  link: { color: '#888', textDecoration: 'none' },
};

const FOOTER_LINKS = [
  { key: 'privacy', label: 'privacy', href: import.meta.env.VITE_PRIVACY_URL || '/privacy' },
  { key: 'terms', label: 'terms', href: import.meta.env.VITE_TERMS_URL || '/terms' },
  { key: 'contact', label: 'contact', href: import.meta.env.VITE_CONTACT_URL || '/contact' },
];

export default function Footer() {
  return (
    <div style={S.footer} className="footer-bar">
      <div style={S.left}>
        <span>downloadable html snapshots</span>
        <span>hosted checkout by Stripe</span>
      </div>
      <div style={S.right}>
        <span style={S.links}>
          {FOOTER_LINKS.map((item, index) => (
            <span key={item.key}>
              {index > 0 ? ' · ' : ''}
              <a href={item.href} style={S.link}>{item.label}</a>
            </span>
          ))}
        </span>
        <span>SiteSnapshot</span>
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

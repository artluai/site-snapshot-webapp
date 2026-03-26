export default function Footer() {
  return (
    <div style={S.footer}>
      <span>built with the <a href="#" style={S.link}>site-snapshot</a> Claude skill</span>
      <span>by <a href="https://artlu.ai" style={S.link}>artlu.ai</a> — 100 projects in 100 days</span>
    </div>
  );
}

const S = {
  footer: { maxWidth: 1200, margin: '0 auto', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#bbb' },
  link: { color: '#888', textDecoration: 'none' },
};

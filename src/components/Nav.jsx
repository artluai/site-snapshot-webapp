export default function Nav({ user, credits, onSignIn, onSignOut }) {
  return (
    <nav style={S.nav}>
      <div style={S.logo} onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>
        <div style={S.icon}>S</div> snapshot
      </div>
      <div style={S.right}>
        <button style={S.outline} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>pricing</button>
        {user && <span style={S.badge}>✦ {credits} credits</span>}
        {user ? (
          <div style={S.avatar} onClick={onSignOut} title="Sign out">{user.name?.[0] || 'U'}</div>
        ) : (
          <button style={S.pill} onClick={onSignIn}>sign in</button>
        )}
      </div>
    </nav>
  );
}

const S = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 100 },
  logo: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  icon: { width: 32, height: 32, background: '#1a1a1a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  pill: { background: '#1a1a1a', color: '#fff', border: 'none', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, padding: '10px 22px', borderRadius: 50, cursor: 'pointer', letterSpacing: '-.2px' },
  outline: { background: 'transparent', color: '#1a1a1a', border: '2px solid #e0e0e0', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, padding: '10px 22px', borderRadius: 50, cursor: 'pointer', letterSpacing: '-.2px' },
  badge: { background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 50, border: '1px solid #bbf7d0' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#666', cursor: 'pointer' },
};

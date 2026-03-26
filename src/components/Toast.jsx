export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={S.toast}>{message}</div>
  );
}

const S = {
  toast: { position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '12px 28px', borderRadius: 50, fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.15)', whiteSpace: 'nowrap' },
};

export default function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: message ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(80px)',
      background: '#1a1a1a', color: '#fff', padding: '12px 24px', borderRadius: 50,
      fontSize: 13, fontWeight: 600, zIndex: 9999, transition: 'transform .3s',
      pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  );
}

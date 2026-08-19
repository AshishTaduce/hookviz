export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--mono)',
        fontSize: '14px',
      }}
    >
      404 — trace not found
    </div>
  );
}

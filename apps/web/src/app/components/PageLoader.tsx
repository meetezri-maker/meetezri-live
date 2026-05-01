const keyframes = `
@keyframes meetezri-spin {
  to { transform: rotate(360deg); }
}
`;

export function PageLoader() {
  return (
    <>
      <style>{keyframes}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100vh',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid var(--color-border-secondary)',
            borderTopColor: 'var(--color-text-primary)',
            animation: 'meetezri-spin 0.75s linear infinite',
          }}
        />
      </div>
    </>
  );
}

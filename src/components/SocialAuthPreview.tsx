import { useId, useState } from 'react';

function GoogleMark() {
  return <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
  </svg>;
}

function AppleMark() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
    <path d="M17.05 12.54c.02 3 2.64 4 2.67 4.01-.02.07-.42 1.43-1.38 2.83-.83 1.21-1.7 2.41-3.06 2.44-1.33.03-1.76-.79-3.28-.79-1.52 0-2 .76-3.25.82-1.31.05-2.3-1.31-3.13-2.51-1.71-2.46-3.02-6.95-1.26-10a4.85 4.85 0 0 1 4.11-2.49c1.29-.03 2.51.87 3.3.87.79 0 2.27-1.07 3.83-.91.65.03 2.46.26 3.62 1.96-.09.06-2.16 1.26-2.14 3.77ZM14.55 5.18c.69-.84 1.15-2.01 1.02-3.18-.99.04-2.2.66-2.91 1.5-.64.74-1.2 1.94-1.05 3.08 1.11.09 2.24-.57 2.94-1.4Z" />
  </svg>;
}

// Visual preview only. No OAuth calls, redirects or account changes.
export default function SocialAuthPreview({ disabled = false }: { disabled?: boolean }) {
  const descriptionId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="auth-social">
      <div className="auth-divider"><span />O continúa con<span /></div>
      <div className="auth-social-buttons">
        <button type="button" disabled={disabled} onClick={() => setSelected('Google')} aria-label="Continuar con Google (próximamente)" aria-describedby={descriptionId}><GoogleMark /><span>Google</span></button>
        <button type="button" disabled={disabled} onClick={() => setSelected('Apple')} aria-label="Continuar con Apple (próximamente)" aria-describedby={descriptionId}><AppleMark /><span>Apple</span></button>
      </div>
      <p className="auth-social-notice" id={descriptionId} role="status" aria-live="polite">{selected ? `El acceso con ${selected} estará disponible próximamente.` : 'Google y Apple estarán disponibles próximamente.'}</p>
    </div>
  );
}

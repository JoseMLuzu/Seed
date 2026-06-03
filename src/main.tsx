import {Component, StrictMode, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Seeds failed to render', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f5f5f7',
        color: '#1d1d1f',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif'
      }}>
        <section style={{ maxWidth: 340, textAlign: 'center' }}>
          <div style={{
            width: 72,
            height: 72,
            margin: '0 auto 18px',
            borderRadius: 22,
            display: 'grid',
            placeItems: 'center',
            background: '#e8efe7',
            color: '#436f52',
            fontSize: 34,
            fontWeight: 800
          }}>
            S
          </div>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.15 }}>Seeds necesita recargar</h1>
          <p style={{ margin: '10px 0 20px', color: '#6e6e73', fontSize: 15, lineHeight: 1.45 }}>
            Hubo un problema cargando la interfaz.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '13px 18px',
              background: '#436f52',
              color: 'white',
              fontWeight: 800,
              fontSize: 15
            }}
          >
            Recargar Seeds
          </button>
        </section>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

const capacitorBridge = (window as Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
}).Capacitor;
const isNativeShell = location.protocol === 'capacitor:' || capacitorBridge?.isNativePlatform?.() === true;

if (isNativeShell && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => registrations.forEach(registration => registration.unregister()))
    .catch(() => undefined);
}

if (!isNativeShell && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

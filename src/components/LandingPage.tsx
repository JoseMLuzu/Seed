import { ArrowRight, ChevronRight, Leaf, LockKeyhole, Sprout } from 'lucide-react';
import AuthWorld from './AuthWorld';
import SocialAuthPreview from './SocialAuthPreview';
import './auth.css';

export default function LandingPage({ onEnter, onShowLogin, onShowRegister }: {
  onEnter: () => void;
  onShowLogin: () => void;
  onShowRegister: () => void;
}) {
  return (
    <main className="auth-page welcome-page">
      <div className="auth-shell">
        <header className="auth-header">
          <div className="auth-brand">
            <span className="auth-brand-mark"><Leaf strokeWidth={1.5} aria-hidden="true" /></span>
            <span><strong>Seeds</strong><span className="auth-brand-tagline">GROW WHAT MATTERS</span></span>
          </div>
          <button type="button" className="auth-header-action" onClick={onEnter}>Explorar sin cuenta<ChevronRight size={14} /></button>
        </header>
        <div className="auth-content">
          <AuthWorld />
          <section className="auth-panel" aria-labelledby="welcome-title">
            <div className="auth-heading welcome-heading">
              <p className="auth-eyebrow">BIENVENIDO A TU PEQUEÑO UNIVERSO</p>
              <h1 id="welcome-title">Haz crecer<br />lo que importa.</h1>
              <p>Un lugar para tus ideas, tus proyectos y eso que quieres hacer realidad. Planta una semilla. Empieza a tu ritmo.</p>
            </div>
            <div className="welcome-actions">
              <button type="button" className="auth-submit" onClick={onShowRegister}>Crear cuenta<ArrowRight size={20} /></button>
              <button type="button" className="welcome-login" onClick={onShowLogin}>Iniciar sesión<ArrowRight size={19} /></button>
            </div>
            <SocialAuthPreview />
            <button type="button" className="auth-guest" onClick={onEnter}><Sprout size={18} /> Explorar mi jardín sin cuenta <ArrowRight size={16} /></button>
            <p className="auth-footnote"><LockKeyhole size={12} /> Un jardín personal para lo que te importa.</p>
          </section>
        </div>
        <footer className="auth-footer welcome-footer"><span>Una idea es un buen comienzo.</span><span>Planta. Cuida. Crece.</span></footer>
      </div>
    </main>
  );
}

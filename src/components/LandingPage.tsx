import { useEffect, useRef } from 'react';
import { ArrowRight, ChevronRight, Leaf, LockKeyhole } from 'lucide-react';
import AuthEntryPage, { type AuthEntryProps } from './AuthEntryPage';
import AuthWorld from './AuthWorld';
import PasswordRecoveryPanel from './PasswordRecoveryPanel';
import SocialAuthPreview from './SocialAuthPreview';
import './auth.css';

export type AuthRoute = 'landing' | 'login' | 'register' | 'forgot' | 'reset';

type LandingPageProps = Omit<AuthEntryProps, 'mode' | 'onSwitchMode' | 'onForgotPassword'> & {
  route: AuthRoute;
  onEnter: () => void;
  onShowLanding: () => void;
  onShowLogin: () => void;
  onShowRegister: () => void;
  onShowForgot: () => void;
  authConfigured: boolean;
  canUpdatePassword: boolean;
  onRequestPasswordReset: () => Promise<void>;
  onUpdatePassword: () => Promise<void>;
};

export default function LandingPage({
  route,
  onEnter,
  onShowLanding,
  onShowLogin,
  onShowRegister,
  onShowForgot,
  authConfigured,
  canUpdatePassword,
  onRequestPasswordReset,
  onUpdatePassword,
  ...authProps
}: LandingPageProps) {
  const isLanding = route === 'landing';
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0 });
    pageRef.current?.querySelector<HTMLElement>('.auth-panel')?.scrollTo({ top: 0 });
  }, [route]);

  return (
    <main ref={pageRef} className="auth-page welcome-page">
      <div className="auth-shell">
        <header className="auth-header">
          <button
            type="button"
            className="auth-brand"
            onClick={onShowLanding}
            aria-label="Seeds: volver al inicio"
          >
            <span className="auth-brand-mark"><Leaf strokeWidth={1.5} aria-hidden="true" /></span>
            <span><strong>Seeds</strong><span className="auth-brand-tagline">GROW WHAT MATTERS</span></span>
          </button>
          <button type="button" className="auth-header-action" onClick={onEnter}>
            Explorar sin cuenta<ChevronRight size={14} />
          </button>
        </header>

        <div className="auth-content">
          <AuthWorld />

          {isLanding ? (
            <section className="auth-panel auth-panel-swap" aria-labelledby="welcome-title">
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
              <p className="auth-footnote"><LockKeyhole size={12} /> Un jardín personal para lo que te importa.</p>
            </section>
          ) : route === 'login' || route === 'register' ? (
            <AuthEntryPage
              key={route}
              mode={route}
              onSwitchMode={route === 'login' ? onShowRegister : onShowLogin}
              onForgotPassword={onShowForgot}
              {...authProps}
            />
          ) : (
            <PasswordRecoveryPanel
              key={route}
              mode={route}
              email={authProps.authEmail}
              setEmail={authProps.setAuthEmail}
              password={authProps.authPassword}
              setPassword={authProps.setAuthPassword}
              confirmPassword={authProps.authConfirmPassword}
              setConfirmPassword={authProps.setAuthConfirmPassword}
              configured={authConfigured}
              canUpdatePassword={canUpdatePassword}
              status={authProps.authStatus}
              onRequestReset={onRequestPasswordReset}
              onUpdatePassword={onUpdatePassword}
              onBackToLogin={onShowLogin}
              onRequestAnotherLink={onShowForgot}
            />
          )}
        </div>

        <footer className="auth-footer welcome-footer">
          <span>Una idea es un buen comienzo.</span>
          <span>Planta. Cuida. Crece.</span>
        </footer>
      </div>
    </main>
  );
}

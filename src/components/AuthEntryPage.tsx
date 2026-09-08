import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, User } from 'lucide-react';
import SocialAuthPreview from './SocialAuthPreview';
import { passwordPolicyError, passwordRequirements } from '../authValidation';

export type AuthEntryProps = {
  mode: 'login' | 'register';
  onSwitchMode: () => void;
  accountName: string;
  setAccountName: (value: string) => void;
  authEmail: string;
  setAuthEmail: (value: string) => void;
  authPassword: string;
  setAuthPassword: (value: string) => void;
  authConfirmPassword: string;
  setAuthConfirmPassword: (value: string) => void;
  authDisabledReason: string;
  authStatus: string;
  onSignIn: () => Promise<void>;
  onSignUp: () => Promise<void>;
};

export default function AuthEntryPage(props: AuthEntryProps) {
  const { mode, onSwitchMode, accountName, setAccountName, authEmail, setAuthEmail, authPassword, setAuthPassword, authConfirmPassword, setAuthConfirmPassword, authDisabledReason, authStatus, onSignIn, onSignUp } = props;
  const isRegister = mode === 'register';
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const submissionRef = useRef(false);
  const [attempted, setAttempted] = useState(false);
  const confirmMismatch = isRegister && Boolean(authConfirmPassword) && authPassword !== authConfirmPassword;
  const disabledReason = isRegister && !accountName.trim() ? 'Escribe tu nombre para crear tu jardín.'
    : authDisabledReason || (isRegister ? passwordPolicyError(authPassword) : '')
      || (isRegister && !authConfirmPassword ? 'Confirma tu contraseña para crear tu jardín.' : '')
      || (confirmMismatch ? 'Las contraseñas no coinciden.' : '');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (disabledReason || submissionRef.current) return;
    submissionRef.current = true;
    setSubmitting(true);
    setLocalError('');
    try { await (isRegister ? onSignUp() : onSignIn()); }
    catch { setLocalError('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'); }
    finally { submissionRef.current = false; setSubmitting(false); }
  };
  const status = localError || authStatus || (attempted ? disabledReason : '');

  return (
    <section className="auth-panel auth-panel-swap" aria-labelledby="auth-title">
      <div className="auth-heading">
        <p className="auth-eyebrow">{isRegister ? 'TODO EMPIEZA CON UNA SEMILLA' : 'TU JARDÍN TE ESPERA'}</p>
        <h1 id="auth-title">{isRegister ? 'Crea tu universo.' : 'Vuelve a tu mundo.'}</h1>
        <p>{isRegister ? 'Dale un lugar a tus ideas, conviértelas en proyectos y crece a tu ritmo.' : 'Tus ideas, proyectos y pequeños logros, en un solo lugar. Retoma lo que importa.'}</p>
      </div>

      <form className="auth-form" onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting}>
                <legend className="sr-only">{isRegister ? 'Datos para crear tu cuenta' : 'Datos de inicio de sesión'}</legend>
                {isRegister && <label className="auth-field">
                  <User size={20} aria-hidden="true" /><span className="sr-only">Tu nombre</span>
                  <input name="name" value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="Tu nombre" autoComplete="name" required maxLength={80} />
                </label>}
                <label className="auth-field">
                  <Mail size={20} aria-hidden="true" /><span className="sr-only">Correo electrónico</span>
                  <input name="email" type="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} placeholder="Correo electrónico" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required />
                </label>
                <div className="auth-field">
                  <LockKeyhole size={20} aria-hidden="true" />
                  <label className="sr-only" htmlFor="auth-password">Contraseña</label>
                  <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} value={authPassword} onChange={event => setAuthPassword(event.target.value)} placeholder="Contraseña" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={6} aria-describedby={isRegister ? 'auth-password-rules' : undefined} />
                  <button type="button" className="auth-eye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                </div>
                {isRegister && <>
                  <label className={`auth-field${confirmMismatch ? ' auth-field-invalid' : ''}`}>
                    <LockKeyhole size={20} aria-hidden="true" /><span className="sr-only">Confirmar contraseña</span>
                    <input name="confirm-password" type={showPassword ? 'text' : 'password'} value={authConfirmPassword} onChange={event => setAuthConfirmPassword(event.target.value)} placeholder="Confirma tu contraseña" autoComplete="new-password" required minLength={6} aria-invalid={confirmMismatch} aria-describedby={confirmMismatch ? 'auth-confirm-error' : undefined} />
                  </label>
                  {confirmMismatch && <p id="auth-confirm-error" className="auth-field-error">Las contraseñas no coinciden.</p>}
                  <div className="auth-password-rules" id="auth-password-rules">
                    <p>Tu contraseña debe tener:</p>
                    <ul>{passwordRequirements.map(rule => <li key={rule.label} data-met={rule.test(authPassword)}><Check size={14} aria-hidden="true" /><span>{rule.label}<span className="sr-only">{rule.test(authPassword) ? ': cumplido' : ': pendiente'}</span></span></li>)}</ul>
                  </div>
                </>}
                <button type="submit" className="auth-submit" disabled={submitting}>
                  {submitting ? <><LoaderCircle className="auth-spinner" size={20} /><span>{isRegister ? 'Creando tu cuenta…' : 'Entrando a tu mundo…'}</span></> : <><span>{isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</span><ArrowRight size={20} /></>}
                </button>
        </fieldset>
        {status && <p className="auth-status" role="status" aria-live="polite">{status}</p>}
      </form>

      <SocialAuthPreview disabled={submitting} />
      <p className="auth-switch">{isRegister ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}{' '}<button type="button" onClick={onSwitchMode} disabled={submitting}>{isRegister ? 'Iniciar sesión' : 'Crear cuenta'}</button></p>
      <p className="auth-footnote"><LockKeyhole size={12} /> Un jardín personal para lo que te importa.</p>
    </section>
  );
}

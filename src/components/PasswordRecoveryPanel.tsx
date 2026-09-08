import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, KeyRound, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { passwordPolicyError, passwordRequirements } from '../authValidation';

type PasswordRecoveryPanelProps = {
  mode: 'forgot' | 'reset';
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  configured: boolean;
  canUpdatePassword: boolean;
  status: string;
  onRequestReset: () => Promise<void>;
  onUpdatePassword: () => Promise<void>;
  onBackToLogin: () => void;
  onRequestAnotherLink: () => void;
};

export default function PasswordRecoveryPanel({
  mode,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  configured,
  canUpdatePassword,
  status,
  onRequestReset,
  onUpdatePassword,
  onBackToLogin,
  onRequestAnotherLink,
}: PasswordRecoveryPanelProps) {
  const isReset = mode === 'reset';
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [localError, setLocalError] = useState('');
  const submissionRef = useRef(false);
  const confirmMismatch = isReset && Boolean(confirmPassword) && password !== confirmPassword;
  const disabledReason = !configured
    ? 'El acceso con cuenta aún no está disponible en esta versión.'
    : isReset && !canUpdatePassword
      ? 'El enlace ya no es válido o expiró. Solicita uno nuevo.'
      : !isReset && !email.trim()
        ? 'Escribe el correo de tu cuenta.'
        : isReset
          ? passwordPolicyError(password)
            || (!confirmPassword ? 'Confirma tu nueva contraseña.' : '')
            || (confirmMismatch ? 'Las contraseñas no coinciden.' : '')
          : '';
  const visibleStatus = localError || status || (attempted ? disabledReason : '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (disabledReason || submissionRef.current) return;
    submissionRef.current = true;
    setSubmitting(true);
    setLocalError('');
    try {
      await (isReset ? onUpdatePassword() : onRequestReset());
    } catch {
      setLocalError('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      submissionRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-panel auth-panel-swap" aria-labelledby="recovery-title">
      <div className="auth-heading">
        <p className="auth-eyebrow">{isReset ? 'CULTIVA UN NUEVO COMIENZO' : 'RECUPERA TU JARDÍN'}</p>
        <h1 id="recovery-title">{isReset ? 'Crea una nueva contraseña.' : 'Recupera tu acceso.'}</h1>
        <p>{isReset
          ? 'Elige una contraseña segura para volver a entrar a tu mundo.'
          : 'Te enviaremos un enlace seguro para que puedas elegir una nueva contraseña.'}</p>
      </div>

      <form className="auth-form" onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting}>
          <legend className="sr-only">{isReset ? 'Nueva contraseña' : 'Recuperar contraseña'}</legend>
          {!isReset && (
            <label className="auth-field">
              <Mail size={20} aria-hidden="true" /><span className="sr-only">Correo electrónico</span>
              <input name="recovery-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Correo electrónico" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required />
            </label>
          )}
          {isReset && <>
            <label className="auth-field">
              <KeyRound size={20} aria-hidden="true" /><span className="sr-only">Nueva contraseña</span>
              <input name="new-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" required minLength={6} aria-describedby="recovery-password-rules" />
            </label>
            <label className={`auth-field${confirmMismatch ? ' auth-field-invalid' : ''}`}>
              <LockKeyhole size={20} aria-hidden="true" /><span className="sr-only">Confirmar nueva contraseña</span>
              <input name="confirm-new-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirma tu nueva contraseña" autoComplete="new-password" required minLength={6} aria-invalid={confirmMismatch} aria-describedby={confirmMismatch ? 'recovery-confirm-error' : undefined} />
            </label>
            {confirmMismatch && <p id="recovery-confirm-error" className="auth-field-error">Las contraseñas no coinciden.</p>}
            <div className="auth-password-rules" id="recovery-password-rules">
              <p>Tu contraseña debe tener:</p>
              <ul>{passwordRequirements.map(rule => <li key={rule.label} data-met={rule.test(password)}><Check size={14} aria-hidden="true" /><span>{rule.label}<span className="sr-only">{rule.test(password) ? ': cumplido' : ': pendiente'}</span></span></li>)}</ul>
            </div>
          </>}
          <button type="submit" className="auth-submit" disabled={submitting || (isReset && !canUpdatePassword)}>
            {submitting
              ? <><LoaderCircle className="auth-spinner" size={20} /><span>{isReset ? 'Guardando…' : 'Enviando…'}</span></>
              : <><span>{isReset ? 'Guardar contraseña' : 'Enviar enlace'}</span><ArrowRight size={20} /></>}
          </button>
        </fieldset>
        {visibleStatus && <p className="auth-status" role="status" aria-live="polite">{visibleStatus}</p>}
      </form>

      <p className="auth-switch">
        {isReset && !canUpdatePassword ? <button type="button" onClick={onRequestAnotherLink}>Solicitar otro enlace</button> : <>
          ¿Recordaste tu contraseña?{' '}<button type="button" onClick={onBackToLogin}>Iniciar sesión</button>
        </>}
      </p>
      <p className="auth-footnote"><LockKeyhole size={12} /> El enlace de recuperación solo puede usarse una vez.</p>
    </section>
  );
}

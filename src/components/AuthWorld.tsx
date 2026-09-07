import { BarChart3, Droplets, Folder, Lightbulb, Sprout, Target } from 'lucide-react';
import AuthPlanet from './AuthPlanet';

const features = {
  login: [
    { icon: Lightbulb, title: 'Ideas', text: 'Captura lo que nace' },
    { icon: Folder, title: 'Proyectos', text: 'Dales un siguiente paso' },
    { icon: Target, title: 'Foco', text: 'Una cosa a la vez' },
    { icon: BarChart3, title: 'Cosechas', text: 'Celebra tu avance' },
  ],
  register: [
    { icon: Sprout, title: 'Jardines', text: 'Un lugar para cada idea' },
    { icon: Droplets, title: 'Riego', text: 'Vuelve a lo importante' },
    { icon: Target, title: 'Foco', text: 'Haz espacio para avanzar' },
    { icon: BarChart3, title: 'Cosechas', text: 'Mira cuánto has crecido' },
  ],
};

export default function AuthWorld({ mode = 'login', paused = false }: { mode?: 'login' | 'register'; paused?: boolean }) {
  return (
    <section className="auth-world" aria-label="Un pequeño mundo para tus ideas">
      <div className="auth-world-art">
        <div className="auth-sun" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-three" aria-hidden="true" />
        <div className="auth-space-rocks" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
        <AuthPlanet paused={paused} />
        <ul className="auth-features" aria-label="Lo que puedes hacer en Seeds">
          {features[mode].map(({ icon: Icon, title, text }, index) => (
            <li key={title} className={`auth-feature auth-feature-${index}`}>
              <Icon className="auth-feature-icon" size={23} strokeWidth={1.8} />
              <span><strong>{title}</strong><span>{text}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <p className="auth-world-caption"><span /> Una idea pequeña. Un mundo de posibilidades.</p>
    </section>
  );
}

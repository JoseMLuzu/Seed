import { GARDEN_VOCABULARY, type GardenLanguage } from './gardenVocabulary';

export function GardenerGlossary({ language }: { language: GardenLanguage }) {
  const en = language === 'en';
  const groups = { content: en ? 'What you keep' : 'Lo que guardas', routine: en ? 'Your routine' : 'Tu rutina', spaces: en ? 'Your spaces' : 'Tus espacios', states: en ? 'States' : 'Estados' } as const;
  return <details className="gardener-glossary">
    <summary>{en ? 'The gardener’s language' : 'El lenguaje del jardinero'}</summary>
    <p>{en ? 'Botanical names, clear functions. Watering is not completion; rest is not failure.' : 'Nombres del jardín, funciones claras. Regar no es completar; descansar no es fracasar.'}</p>
    {Object.entries(groups).map(([group, title]) => <section key={group}><h3>{title}</h3><dl>{Object.values(GARDEN_VOCABULARY).filter(term => term.group === group).map(term => <div key={term.es.name}><dt>{term[language].name}{'planned' in term && term.planned && <span>{en ? 'Coming later' : 'Por venir'}</span>}</dt><dd>{term[language].meaning}</dd></div>)}</dl></section>)}
  </details>;
}
